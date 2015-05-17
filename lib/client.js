"use strict";
/*jshint -W079 */
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var _ = require("lodash");
var fs = require("fs");
var request = require("request");
var xml2js = require("xml2js").parseString;
var p2 = require("./prompt");
var run = require("gen-run");
var prompt2 = require("prompt");

var defaults = {
	digitalOcean: {
		key: null
	},
	namecheap: {
		username: null,
		key: null
	}
};

function Client() {
	var self = this;
	EventEmitter.call(self);
	self.services = _.clone(defaults);
	self.on("error", function(err) {
		console.log(err);
	});
	run(self.init(self));
}

util.inherits(Client, EventEmitter);

Client.prototype.init = function*(self) {
	self.load();
	yield self.ip();
	Object.observe(self.services.digitalOcean, self.save);
	Object.observe(self.services.namecheap, self.save);
	if (!self.services.digitalOcean.key) {
		console.log("Add your Digital Ocean and Namecheap credentials.".green);
		yield p2({
			digitalOceanApiKey: {
				description: "Digital Ocean API key:".red,
				required: true
			}
		});
		self.services.digitalOcean.key = prompt2.history("digitalOceanApiKey").value;
	}

	if (!self.services.namecheap.username) {
		yield p2({
			namecheapUsername: {
				description: "Namecheap Username (optional):".red,
				required: false
			}
		});
		self.services.namecheap.username = prompt2.history("namecheapUsername").value;
	}

	if (self.services.namecheap.username && !self.services.namecheap.key) {
		yield p2({
			namecheapKey: {
				description: "Namecheap API key (optional):".red,
				required: false
			}
		});
		self.services.namecheap.key = prompt2.history("namecheapKey").value;
	}

	if (self.services.namecheap.key && self.services.namecheap.username) {
		yield self.getDomains();
	}
	self.emit("ready");
};

Client.prototype.load = function() {
	var self = this;
	var config = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon", {
		encoding: "utf8"
	}));
	_.merge(self.services, config.services);
	self.stacks = config.stacks;
};

Client.prototype.getStacks = function() {
	var self = this;
	fs.readFile(process.env.HOME + "/.stackathon", {
		encoding: "utf8"
	}, function(err, settings) {
		if (err) {
			self.emit("error", err);
		} else {
			settings = JSON.parse(settings);
			_.merge(self.services, settings.services);
		}
	});
};

Client.prototype.save = function() {
	var config = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"), {
		encoding: "utf8"
	});
	config.services = this.services;
	fs.writeFileSync(process.env.HOME + "/.stackathon", JSON.stringify(config, null, "\t") + "\n");
};

Client.prototype.reset = function() {
	this.services.digitalOcean.key = undefined;
	this.services.namecheap.username = undefined;
	this.services.namecheap.key = undefined;
};

Client.prototype.ip = function() {
	var self = this;
	return function(callback) {
		request.get({
			url: "https://api.ipify.org?format=json",
			json: true
		}, function(err, res, data) {
			if (err) {
				self.emit("error", err);
				return callback(err);
			}
			self.services.ip = data.ip;
			return callback(null, data.ip);
		});
	};
};

Client.prototype.getDomains = function() {
	var self = this;
	return function(callback) {
		var url = "https://api.namecheap.com/xml.response?ApiUser=" + self.services.namecheap.username + "&ApiKey=" + self.services.namecheap.key + "&UserName=" + self.services.namecheap.username + "&ClientIp=" + self.services.ip + "&Command=namecheap.domains.getList";
		request.get(url, function(err, res, data) {
			xml2js(data, function(err, result) {
				if (err) {
					self.emit("error", err);
					return callback(err);
				}
				if (result.ApiResponse.$.Status === "ERROR") {
					if (result.ApiResponse.Errors[0].Error[0]._.indexOf("Invalid request IP") !== -1) {
						console.log("   Your current IP address is not allowed to access Namecheap's API.");
						console.log("   Visit: https://manage.www.namecheap.com/myaccount/modify-profile-api.asp");
						console.log("   And add the following IP to the whitelist: " + self.services.ip);
						console.log("   Then try again.");
						process.exit(0);
					}
				}
				var domains = result.ApiResponse.CommandResponse[0].DomainGetListResult[0].Domain;
				self.domains = _.map(domains, function(domain) {
					return domain.$;
				});
				return callback(null, self.domains);
			});
		});
	};
};

module.exports = Client;
