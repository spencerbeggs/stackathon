"use strict";
/*jshint -W079 */
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var _ = require("lodash");
var fs = require("fs");
var request = require("request");
var xml2js = require("xml2js").parseString;
var p2 = require("./prompt");

function Client() {
	var self = this;
	this.services = _.merge({
		digitalOcean: {
			key: undefined,
		},
		namecheap: {
			username: undefined,
			key: undefined
		}
	}, this.load().services);
	Object.observe(this.services.digitalOcean, self.save);
	Object.observe(this.services.namecheap, self.save);
	EventEmitter.call(this);
	self.ip().then(function() {
		if (self.services.namecheap.username && self.services.namecheap.key) {
			self.getDomains().then(function() {
				self.emit("ready");
			});
		} else {
			self.emit("ready");
		}
	});
	this.on("error", function(err) {
		console.log(err);
	});
}

util.inherits(Client, EventEmitter);

Client.prototype.load = function() {
	return JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"));
};

Client.prototype.save = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var config = self.load();
		config.services = self.services;
		fs.writeFile(process.env.HOME + "/.stackathon", JSON.stringify(config, null, "\t") + "\n", function(err) {
			if (err) {
				self.emit("error", err);
				reject(err);
			} else {
				resolve(self);
			}
		});
	});
};

Client.prototype.reset = function() {
	this.services.digitalOcean.key = undefined;
	this.services.namecheap.username = undefined;
	this.services.namecheap.key = undefined;
};

Client.prototype.ip = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		request.get({
			url: "https://api.ipify.org?format=json",
			json: true
		}, function(err, res, data) {
			if (err) {
				self.emit("error", err);
				reject(err);
			}
			self.ip = data.ip;
			resolve();
		});
	});
};

Client.prototype.init = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var props = {};

		if (!self.services.digitalOcean.key) {
			props.digitalOceanApiKey = {
				description: "Digital Ocean API key:",
				required: true
			};
		}

		if (!self.services.namecheap.username) {
			props.namecheapUsername = {
				description: "Namecheap Username (optional):",
				required: false
			};
		}

		if (!self.services.namecheap.key) {
			props.namecheapApiKey = {
				description: "Namecheap API key (optional):",
				required: false
			};
		}
		if (!_.isEmpty(props)) {
			p2(props).then(function(answers) {
				if (answers.digitalOceanApiKey) {
					self.services.digitalOcean.key = answers.digitalOceanApiKey;
				}
				if (answers.namecheapUsername) {
					self.services.namecheap.username = answers.namecheapUsername;
				}
				if (answers.namecheapApiKey) {
					self.services.namecheap.key = answers.namecheapApiKey;
				}
				self.getDomains().then(resolve).catch(reject);

			}).catch(reject);
		} else {
			resolve();
		}
	});
};

Client.prototype.getDomains = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var url = "https://api.namecheap.com/xml.response?ApiUser=" + self.services.namecheap.username + "&ApiKey=" + self.services.namecheap.key + "&UserName=" + self.services.namecheap.username + "&ClientIp=" + self.ip + "&Command=namecheap.domains.getList";
		request.get(url, function(err, res, data) {
			xml2js(data, function(err, result) {
				if (err) {
					self.emit("error", err);
					reject(err);
				}
				if (result.ApiResponse.$.Status === "ERROR") {
					if (result.ApiResponse.Errors[0].Error[0]._.indexOf("Invalid request IP") !== -1) {
						console.log("   Your current IP address is not allowed to access Namecheap's API.");
						console.log("   Visit: https://manage.www.namecheap.com/myaccount/modify-profile-api.asp");
						console.log("   And add the following IP to the whitelist: " + self.ip);
						console.log("   Then try again.");
						process.exit(0);
					}
				}
				var domains = result.ApiResponse.CommandResponse[0].DomainGetListResult[0].Domain;
				self.domains = _.map(domains, function(domain) {
					return domain.$;
				});
				resolve();
			});
		});
	});
};

module.exports = Client;
