/*jshint -W079 */
"use strict";
var prompt = require("prompt");
var async = require("async");
var lib = require("../lib");
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
			},
			adminPassword: {
				description: "Admin password:",
				pattern: /^[a-zA-Z0-9_\s-]+$/,
				required: true,
				default: passwordGenerator(25, false)
			},
			sqlRootPassword: {
				description: "mySQL root password:",
				pattern: /^[a-zA-Z0-9_\s-]+$/,
				required: true,
				default: passwordGenerator(25, false)
			},
			sqlAdminUsername: {
				description: "mySQL admin username:",
				pattern: /^[a-zA-Z0-9_\s-]+$/,
				required: true,
				default: "mysqladmin"
			},
			sqlAdminPassword: {
				description: "mySQL admin password:",
				pattern: /^[a-zA-Z0-9_\s-]+$/,
				required: true,
				default: passwordGenerator(25, false)
			},
			sqlDb: {
				description: "mySQL database name:",
				pattern: /^[a-zA-Z0-9_\s-]+$/,
				required: true,
				default: "wordpress"
			}

		}

	}, function(err, answers) {
		answers.port = "7070";
		async.waterfall([
			lib.keygen(answers),
			lib.addDoKey(answers),
			lib.buildDroplet(answers),
			lib.getDroplet(answers),
			lib.configDroplet(answers),
			lib.addSshConfig(answers),
			lib.addSshConfig(answers, true)
		], function(err, results) {
			if (err) {
				return console.log(err);
			}
			console.log("Droplet activated. Happy Hacking.");
			console.log("——————————————————————————————————————————————");
			console.log("Access your Ubuntu server with: ssh " + answers.domain);
			console.log("Login to your WordPress dashbord at http://" + answers.domain + "/wp-admin    (http://" + answers.ip + "/wp-admin)");
			process.exit(0);
		});
	});

};
