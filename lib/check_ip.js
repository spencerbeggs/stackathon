"use strict";
var request = require("request");
var nconf = require("nconf");

module.exports = function(answers) {
	return function(callback) {
		nconf.file(process.env.HOME + "/.stackathon");
		request.get({
			url: "https://api.ipify.org?format=json",
			json: true
		}, function(err, res, data) {
			if (err) {
				return callback(err);
			}
			nconf.set("ip", data.ip);
			answers.ip = data.ip;
			nconf.save(function() {
				return callback(null, answers);
			});
		});
	};
};
