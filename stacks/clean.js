/*jshint -W079 */
"use strict";
var prompt = require("prompt");
var async = require("async");
var lib = require("../lib");
var fs = require("fs");
var request = require("request");
var nconf = require("nconf");
nconf.file(process.env.HOME + "/.stackathon");

module.exports = function() {

	prompt.get({
		properties: {
			digitalOceanApiKey: {
				description: "Digital Ocean API key:",
				required: true,
				default: nconf.get("digitalOcean:apiKey")
			}
		}

	}, function(err, answers) {
		var api = request.defaults({
			json: true,
			headers: {
				"Authorization": "Bearer " + answers.digitalOceanApiKey
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
					console.log("deleted droplet: " + id);
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
					console.log("deleted key: " + fingerprint);
					return callback(null);
				});
			};
		}

		var funcs = [];

		async.parallel([
			function(callback) {
				api.get({
					url: "https://api.digitalocean.com/v2/account/keys"
				}, function(err, res, body) {
					body.ssh_keys.forEach(function(key) {
						funcs.push(deleteKey(key.fingerprint));
					});
					callback(null);
				});
			},
			function(callback) {
				api.get({
					url: "https://api.digitalocean.com/v2/droplets"
				}, function(err, res, body) {
					body.droplets.forEach(function(droplet) {
						funcs.push(deleteDroplet(droplet.id));
					});
					callback(null);
				});
			},
		], function(err) {
			if (err) {
				console.log(err);
			}
			async.parallel(funcs, function(err) {
				if (err) {
					console.log(err);
				}
				console.log("cleaned");
			});

		});

	});

};
