#!/usr/bin/env node

/*jshint -W079 */

"use strict";
var prompt = require("prompt");
var async = require("async");
var lib = require("./lib");
var nconf = require("nconf");
var fs = require("fs");

nconf.file(process.env.HOME + "/.stackathon");

prompt.message = "";
prompt.delimiter = "";
prompt.start();

console.log("*************************************");
console.log("* Stackathon: Don't Worry, Be Hacky *");
console.log("*************************************");
console.log("");

if (!nconf.get("digitalOcean")) {
	console.log("We need your Digital Ocean API key to continue. You can setup an new");
	console.log("key at: https://cloud.digitalocean.com/settings/applications");
	prompt.get({
		properties: {
			apiKey: {
				description: "Digital Ocean API key:",
				pattern: /^[a-zA-Z0-9\s-]+$/,
				required: true
			}
		}
	}, function(err, answers) {
		nconf.set("digitalOcean:apiKey", answers.apiKey);
		nconf.save(function(err) {
			if (err) {
				console.log(err);
			}
			console.log("Your key has been key saved in ~/.stackathon");
			lib.menu();
		});
	});
}
else {
	lib.menu();
}
