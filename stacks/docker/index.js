/*jshint -W079 */
"use strict";
var prompt = require("prompt");
var nconf = require("nconf");
nconf.file(process.env.HOME + "/.stackathon");
var async = require("async");
var lib = require("../../lib");
var passwordGenerator = require("password-generator");

module.exports = function() {
	console.log("**************************************");
	console.log("* Install WordPress on Digital Ocean *");
	console.log("**************************************");
	console.log("This tool will walk you through setting");
	console.log("up a properly configured WordPress");
	console.log("installation.");

	prompt.get({
		properties: {
			digitalOceanApiKey: {
				description: "Digital Ocean API key:",
				required: true,
				default: nconf.get("digitalOcean:apiKey")
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
				required: true
			},
			adminPassword: {
				description: "Admin password:",
				pattern: /^[a-zA-Z0-9_\s-]+$/,
				required: true,
				default: passwordGenerator(25, false)
			}

		}

	}, function(err, answers) {
		answers.port = "7070";
		nconf.set("stacks:" + answers.domain, {});
		nconf.save(function(err) {
			if (err) {
				throw err;
			}
			async.waterfall([
				lib.keygen(answers),
				lib.addDoKey(answers),
				lib.buildDocker(answers),
				lib.getDroplet(answers),
				lib.configDocker(answers),
				lib.addSshConfig(answers),
				lib.addSshConfig(answers, true)
			], function(err, results) {
				console.log("Droplet activated. Happy Hacking.");
				console.log("——————————————————————————————————————————————");
				console.log("Access your Ubuntu server with: ssh " + answers.domain);
				console.log("   admin un: " + answers.adminUsername);
				console.log("   admin pw: " + answers.adminPassword);
				process.exit(0);
			});
		});
	});

};
