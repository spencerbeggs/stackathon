/*jshint -W079 */
"use strict";
var prompt = require("prompt");
var async = require("async");
var lib = require("../lib");
var fs = require("fs");
var request = require("request");
var nconf = require("nconf");
var _ = require("lodash");
var path = require("path");
var Handlebars = require("handlebars");

module.exports = function(stacks) {
	nconf.file(process.env.HOME + "/.stackathon");

	var api = request.defaults({
		json: true,
		headers: {
			"Authorization": "Bearer " + nconf.get("digitalOcean:apiKey")
		}
	});

	function deleteDroplet(id) {
		return function(callback) {
			api.del({
				url: "https://api.digitalocean.com/v2/droplets/" + id
			}, function(err, res, body) {
				if (err) {
					return callback(err);
				}
				return callback(null);
			});
		};
	}

	function deleteKey(fingerprint) {
		return function(callback) {
			api.del({
				url: "https://api.digitalocean.com/v2/account/keys/" + fingerprint
			}, function(err, res, body) {
				if (err) {
					return callback(err);
				}
				return callback(null);
			});
		};
	}

	function deleteFile(path) {
		return function(callback) {
			fs.unlink(path, function(err) {
				if (err) {
					return callback(err);
				}
				return callback(null);
			});
		};
	}

	function removeSshConfig(stack) {
		return function(callback) {
			var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../templates/config"), "utf-8"));
			var toDelete = template({
				host: stack.name,
				ip: stack.droplet.networks.v4[0].ip_address,
				domain: stack.name,
				port: stack.port,
				adminUsername: stack.adminUsername
			});
			fs.readFile(process.env.HOME + "/.ssh/known_hosts", {
				encoding: "utf8"
			}, function(err, text) {
				if (!err) {
					var pattern = new RegExp(stack.droplet.networks.v4[0].ip_address);
					var cleaned = [];
					text.split("\n").forEach(function(line) {
						if (!pattern.test(line)) {
							cleaned.push(line);
						}
					});
					fs.writeFile(process.env.HOME + "/.ssh/known_hosts", cleaned.join("\n"), function(err) {
						if (err) {
							return callback(err);
						}
					});

				}

			});
			fs.readFile(process.env.HOME + "/.ssh/config", {
				encoding: "utf8"
			}, function(err, text) {
				if (err) {
					return callback(err);
				}
				fs.writeFile(process.env.HOME + "/.ssh/config", text.replace(toDelete, ""), {
					encoding: "utf8"
				}, function(err) {
					if (err) {
						return callback(err);
					}
					return callback(null);
				});
			});
		};
	}

	var funcs = [];
	_.each(stacks, function(stack) {
		funcs.push(deleteKey(stack.keys.id));
		funcs.push(deleteDroplet(stack.droplet.id));
		funcs.push(deleteFile(stack.keys.public));
		funcs.push(deleteFile(stack.keys.private));
		funcs.push(removeSshConfig(stack));
		nconf.clear("stacks:" + stack.name);
	});

	async.series(funcs, function(err) {
		if (err) {
			console.log(err);
		}
		nconf.save(function() {
			var plural = stacks.length > 1 ? "s" : "";
			console.log(stacks.length + " stack" + plural + " deleted");
		});
	});
};
