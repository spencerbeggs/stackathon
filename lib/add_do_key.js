"use strict";
var request = require("request");

module.exports = function(answers) {
	return function(answers, callback) {
		var api = request.defaults({
			json: true,
			headers: {
				"Authorization": "Bearer " + answers.digitalOceanApiKey
			}
		});
		api.post({
			url: "https://api.digitalocean.com/v2/account/keys",
			body: {
				name: answers.domain,
				public_key: answers.keys.public
			}
		}, function(err, res, body) {
			if (err) {
				return callback(err);
			}
			answers.keyRes = body;
			return callback(null, answers);
		});
	};
};
