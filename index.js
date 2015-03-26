#!/usr/bin/env node

/*jshint -W079 */

"use strict";
var prompt = require("prompt");
var async = require("async");
var lib = require("./lib");
var nconf = require("nconf");
var fs = require("fs");

prompt.message = "";
prompt.delimiter = "";
prompt.start();

console.log("*************************************");
console.log("* Stackathon: Don't Worry, Be Hacky *");
console.log("*************************************");

async.waterfall([lib.checkIp({})], function(err, answers) {
	if (err) {
		console.log(err);
	}
	nconf.file(process.env.HOME + "/.stackathon");
	console.log("   Your IP address is: " + answers.ip);
	console.log("   Make sure to add this address to the whitelist of IPs");
	console.log("   for Namecheap's API access: https://manage.www.namecheap.com/myaccount/modify-profile-api.asp");
	console.log("   This value can change. You may need to do this more than once.\n");
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

	}, function(err, answers2) {
		answers = answers2;
		nconf.set("digitalOcean:apiKey", answers.digitalOceanApiKey);
		nconf.set("namecheap:username", answers.namecheapUsername);
		nconf.set("namecheap:apiKey", answers.namecheapApiKey);
		nconf.save(function() {
			lib.menu(answers);
		});
	});
});
