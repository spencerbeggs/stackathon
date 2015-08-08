"use strict";
var passwordGenerator = require("password-generator");

module.exports = [{
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
}];
