"use strict";
var passwordGenerator = require("password-generator");
var Stack = require("../../lib/stack");

module.exports = {
	name: "Base Docker",
	properties: {
		port: {
			description: "shh port:",
			pattern: /^[0-9\s-]+$/,
			required: true,
			default: "7070"
		},
		username: {
			description: "Admin username:",
			pattern: /^[a-zA-Z\s-]+$/,
			required: true,
			default: "admin"
		},
		password: {
			description: "Admin password:",
			pattern: /^[a-zA-Z0-9_\s-]+$/,
			required: true,
			default: passwordGenerator(25, false)
		},
		domain: {
			description: "domain:",
			pattern: /^[a-zA-Z.\s-]+$/,
			message: "Name must be only letters, spaces, or dashes",
			required: false
		}
	},
	create: function() {
		console.log("Gathering base info for yours stack.");

		return new Promise(function(resolve, reject) {
			var stack = new Stack();
			resolve(stack);
		});
	}
};
