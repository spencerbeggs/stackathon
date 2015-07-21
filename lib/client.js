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

function Client() {
	var self = this;
	EventEmitter.call(self);
	self.services = {
		digitalOcean: {
			key: null
		},
		namecheap: {
			username: null,
			key: null,
			ip: null
		}
	};
	self.on("error", function(err) {
		console.log(err);
	});
	run(self.init(self));
}

util.inherits(Client, EventEmitter);

Client.prototype.init = function*(self) {
	self.load();
	yield self.ip();
	Object.observe(self.services.digitalOcean, function() {
		self.save(self);
	});
	Object.observe(self.services.namecheap, function() {
		self.save(self);
	});
	if (!self.services.digitalOcean.key) {
		var doInfo = yield p2({
			name: "digitalOceanApiKey",
			message: "Enter your Digital Ocean API key:",
			default: null,
			when: true
		});
		self.services.digitalOcean.key = doInfo.digitalOceanApiKey;
	}

	if (!self.services.namecheap.username || !self.services.namecheap.key) {
		var namecheapInfo = yield p2([{
			name: "namecheapUsername",
			type: "input",
			message: "Namecheap Username (optional):",
			default: null,
			when: true
		}, {
			name: "namecheapKey",
			type: "input",
			message: "Namecheap API key (optional):",
			default: null,
			when: true
		}]);
		self.services.namecheap.username = namecheapInfo.namecheapUsername;
		self.services.namecheap.key = namecheapInfo.namecheapKey;
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

Client.prototype.save = function(ctx) {
	let config = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"), {
		encoding: "utf8"
	});
	config.services = ctx.services;
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
			self.services.namecheap.ip = data.ip;
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
				self.domains = [];
				_.each(result.ApiResponse.CommandResponse[0].DomainGetListResult[0].Domain, function(domain) {
					if (domain.$.IsExpired === "false" && domain.$.IsLocked === "false") {
						self.domains.push(domain.$);
					}
				});
				return callback(null, self.domains);
			});
		});
	};
};

module.exports = Client;
