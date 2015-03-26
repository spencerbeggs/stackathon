"use strict";
var request = require("request");
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
		api.post({
			url: "https://api.digitalocean.com/v2/account/keys",
			body: {
				name: answers.domain.Name,
				public_key: answers.keys.public
			}
		}, function(err, res, body) {
			if (err) {
				return callback(err);
			}
			nconf.set("stacks:" + answers.domain.Name + ":keys:id", body.ssh_key.id);
			nconf.save(function(err) {
				answers.keyRes = body;
				return callback(null, answers);
			});
		});
	};
};
