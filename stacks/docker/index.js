/*jshint -W079 */
"use strict";
var prompt = require("prompt");
var nconf = require("nconf");
nconf.file(process.env.HOME + "/.stackathon");
var async = require("async");
var lib = require("../../lib");
var passwordGenerator = require("password-generator");
var _ = require("lodash");

module.exports = function() {
	console.log("* Install a new Dockerized Node App from a Github Repo *");
	var answers = {};
	prompt.get({
		properties: {
			digitalOceanApiKey: {
				description: "Digital Ocean API key:",
				required: true,
				default: nconf.get("digitalOcean:apiKey")
			},
			namecheapUsername: {
				description: "Namecheap Username:",
				required: true,
				default: nconf.get("namecheap:username")
			},
			namecheapApiKey: {
				description: "Namecheap API key:",
				required: true,
				default: nconf.get("namecheap:apiKey")
			}

		}

	}, function(err, answers) {
		nconf.set("digitalOcean:apiKey", answers.digitalOceanApiKey);
		nconf.set("namecheap:username", answers.namecheapUsername);
		nconf.set("namecheap:apiKey", answers.namecheapApiKey);
		nconf.save(function() {
			lib.getDomains(answers)(function(err, answers2) {
				console.log("Select a domain to use:");
				_.each(answers.domains, function(domain, i) {
					console.log("   [" + (i + 1) + "] " + domain.Name);
				});
				prompt.get({
					properties: {
						domain: {
							description: "number:",
							pattern: /[0-9\s-]+$/,
							message: "Pick a number.",
							required: true,
							default: "1"
						}
					}
				}, function(err, set1) {
					answers.domain = answers.domains[parseInt(set1.domain, 10) - 1];
					prompt.get({
						properties: {
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
							adminPassword: {
								description: "Admin password:",
								pattern: /^[a-zA-Z0-9_\s-]+$/,
								required: true,
								default: passwordGenerator(25, false)
							},
							gitRepo: {
								description: "GitHub clone URL",
								pattern: /^[a-zA-Z0-9_@./:\s-]+$/,
								required: true

							}
						}
					}, function(err, answers4) {
						console.log(answers);
						_.merge(answers, answers4);
						nconf.set("stacks:" + answers.domain.Name, {});
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
				});
			});
		});
	});
};
