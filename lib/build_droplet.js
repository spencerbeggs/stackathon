"use strict";
var request = require("request");
var async = require("async");

module.exports = function(answers) {
	return function(answers, callback) {
		var api = request.defaults({
			json: true,
			headers: {
				"Authorization": "Bearer " + answers.digitalOceanApiKey
			}
		});
		api.post({
			url: "https://api.digitalocean.com/v2/droplets",
			body: {
				"name": answers.domain,
				"region": "nyc3",
				"size": "512mb",
				"image": "ubuntu-14-04-x64",
				"ssh_keys": [answers.keyRes.ssh_key.id],
				"backups": false,
				"ipv6": true,
				"user_data": null,
				"private_networking": null
			}
		}, function(err, res, body) {
			if (err) {
				return callback(err);
			}
			var waiting = true;
			async.whilst(
				function() {
					return waiting === true;
				},
				function(callback) {
					api.get({
						url: "https://api.digitalocean.com/v2/droplets/" + body.droplet.id
					}, function(err, res, body) {
						if (body.droplet.status === "active") {
							answers.droplet = body.droplet;
							answers.ip = body.droplet.networks.v4[0].ip_address;
							waiting = false;
							callback();
						}
						else {
							setTimeout(callback, 10000);
						}
					});
				},
				function(err) {
					if (err) {
						return callback(err);
					}
					return callback(null, answers);
				});
		});
	};
};
