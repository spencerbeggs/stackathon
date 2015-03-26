"use strict";
var request = require("request");
var Client = require("ssh2").Client;
var nconf = require("nconf");

module.exports = function(answers) {
	return function(answers, callback) {
		nconf.file(process.env.HOME + "/.stackathon");
		var api = request.defaults({
			json: true,
			headers: {
				"Authorization": "Bearer " + nconf.get("digitalOcean:apiKey")
			}
		});
		var int = setInterval(function() {
			api.get({
				url: "https://api.digitalocean.com/v2/droplets/" + answers.droplet.id
			}, function(err, res, body) {
				if (body.droplet.status === "active") {
					clearInterval(int);
					nconf.set("stacks:" + body.droplet.name + ":droplet", body.droplet);
					nconf.save(function(err) {
						answers.droplet = body.droplet;
						callback(null, answers);
					});
				}
			});
		}, 1000);
	};
};
