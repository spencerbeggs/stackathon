/*jshint -W079 */
"use strict";
var prompt = require("prompt");
var async = require("async");
var lib = require("../lib");
var fs = require("fs");

module.exports = function() {

	prompt.get({
		properties: {
			digitalOceanApiKey: {
				description: "Digital Ocean API key:",
				required: true,
				default: process.env.DIGITAL_OCEAN_API_KEY
			},
			domain: {
				description: "domain:",
				pattern: /^[a-zA-Z.\s-]+$/,
				message: "Name must be only letters, spaces, or dashes",
				required: true,
				default: "stackathon.com"
			},
			port: {
				description: "shh port:",
				pattern: /^[0-9\s-]+$/,
				required: true,
				default: "7070"
			},
			adminUsername: {
				description: "Admin username:",
				pattern: /^[a-zA-Z\s-]+$/,
				required: true,
				default: "admin"
			},
			adminEmail: {
				description: "Admin email:",
				pattern: /^[a-zA-Z@.\s-]+$/,
				required: true,
				default: "spencer@beg.gs"
			}

		}

	}, function(err, answers) {
		answers.port = "7070";
		async.waterfall([
			function(callback) {
				answers.keys = {
					private: fs.readFileSync(process.env.HOME + "/.ssh/" + answers.domain, "utf8"),
					public: fs.readFileSync(process.env.HOME + "/.ssh/" + answers.domain + ".pub", "utf8")
				};
				answers.droplet = {
					id: "4115744"
				};
				callback(null, answers);
			},
			lib.getDroplet(answers),
			lib.configDroplet(answers),
			//lib.addSshConfig(answers)
		], function(err, results) {
			if (err) {
				return console.log(err);
			}
			console.log("Complete");
		});
	});

};
