"use strict";
var request = require("request");
var Client = require("ssh2").Client;

module.exports = function(answers) {
	return function(answers, callback) {
		var api = request.defaults({
			json: true,
			headers: {
				"Authorization": "Bearer " + answers.digitalOceanApiKey
			}
		});
		console.log(answers);
		api.get({
			url: "https://api.digitalocean.com/v2/droplets/" + answers.droplet.id
		}, function(err, res, body) {
			if (body.droplet.status === "active") {
				answers.droplet = body.droplet;
				answers.ip = body.droplet.networks.v4[0].ip_address;
				callback(null, answers);
			}
			else {
				setTimeout(callback, 10000);
			}
		});
	};
};
