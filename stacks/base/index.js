"use strict";
var Client = require("../../lib/client");
var passwordGenerator = require("password-generator");
var _ = require("lodash");
var psl = require("psl");

module.exports = {
	name: "Base",
	questions: [{
		name: "domain",
		type: "list",
		message: "Select the top-level domain for your stack:",
		choices: function() {
			var options = [];
			if (global.client.domains) {
				_.each(global.client.domains, function(domain, i) {
					options.push({
						name: domain.Name,
						value: domain.Name
					});
				});
				options.push({
					name: "---------",
					type: "separator"
				});
			}
			options.push({
				name: "Enter a domain name manually",
				value: false
			}, {
				name: "Just use an IP address",
				value: null
			});
			return options;
		},
		when: function() {
			return global.client.domains !== undefined;
		}
	}, {
		name: "domain",
		type: "input",
		message: "Enter a custom domain:",
		when: function(answers) {
			return answers.domain === false;
		},
		validate: function(input) {
			if (!psl.isValid(input)) {
				return "Invalid domain";
			} else {
				return true;
			}
		},
		default: null
	}, {
		name: "subdomain",
		type: "input",
		message: "Enter a subdomain (optional):",
		when: function(answers) {
			var parsed = psl.parse(answers.domain);
			answers.domain = parsed.domain;
			if (parsed.subdomain !== null) {
				answers.subdomain = parsed.subdomain;
				return false;
			} else {
				return true;
			}
		},
		filter: function(input) {
			if (!input) {
				input = null;
			}
			return input;
		},
		validate: function(input) {
			var re = /^[a-zA-Z0-9\s-]+$/;
			if (!input || re.test(input)) {
				return true;
			} else {
				return "Alphanumber characters and hypens only.";
			}
		},
		default: ""
	}, {
		name: "name",
		type: "input",
		message: "Give your stack a name.",
		validate: function(input) {
			var re = /^[a-zA-Z0-9\s-.]+$/;
			if (re.test(input)) {
				return true;
			} else {
				return "Alphanumber characters only.";
			}
		},
		when: function(answers) {
			var hostname;
			if (answers.domain) {
				hostname = "";
				if (answers.subdomain) {
					hostname += answers.subdomain + ".";
				}
				hostname += answers.domain;
			}
			answers.name = hostname;
			return answers.domain === undefined;
		}
	}, {
		type: "input",
		name: "port",
		message: "What port number should your stack listen for SSH connections on?",
		validate: function(input) {
			var re = /^[0-9\s-]+$/;
			if (re.test(input)) {
				return true;
			} else {
				return "Must be a number above 1024";
			}
		},
		when: true,
		default: "7676"
	}, {
		type: "input",
		name: "username",
		message: "Pick a username for your superuser account.",
		validate: function(input) {
			var re = /^[a-zA-Z0-9\s-]+$/;
			if (re.test(input)) {
				return true;
			} else {
				return "Alphanumber characters only.";
			}
		},
		when: true,
		default: "admin"
	}, {
		type: "input",
		name: "password",
		message: "Choose a secure password for your superuser account.",
		validate: function(input) {
			var re = /^[a-zA-Z0-9_&#$%^*\s-]+$/;
			if (re.test(input)) {
				return true;
			} else {
				return "Invalid characters.";
			}
		},
		when: true,
		default: passwordGenerator(25, false)
	}]
};
