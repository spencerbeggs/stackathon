#!/usr/bin/env node

"use strict";
var Client = require("./client");
var Stack = require("./stack");
var _ = require("lodash");
var stacks = require("../stacks");
var p2 = require("./prompt");
var passwordGenerator = require("password-generator");
var run = require("gen-run");
var fs = require("fs");
var program = require("commander");
var pjson = require("../package.json");
require("colors");

program
	.version(pjson.version)
	.option("-v, --verbose", "Logs more information to the console for debugging.")
	.parse(process.argv);

if (!program.verbose) {
	console.info = function() {};
}

var defaults = {
	services: {
		digitalOcean: {
			key: null
		},
		namecheap: {
			username: null,
			key: null
		}
	},
	stacks: {}
};

try {
	JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"), {
		encoding: "utf8"
	});
} catch (err) {
	fs.writeFileSync(process.env.HOME + "/.stackathon", JSON.stringify(_.clone(defaults), null, "\t"));
}

var client = global.client = new Client();

function* create() {
	var config = yield p2({
		name: "stack",
		type: "list",
		message: "What type of stack do you want to create?",
		choices: function() {
			var options = [];
			_.each(stacks, function(stack) {
				if (stack.name !== "Base") {
					options.push({
						name: stack.name,
						value: stack
					});
				}
			});
			return options;
		}
	});
	var data = yield p2(config.stack.questions);
	var droplet = new Stack({
		name: data.name,
		domain: data.domain ? data.domain : null,
		subdomain: data.subdomain ? data.subdomain : null,
		digitalOcean: client.services.digitalOcean,
		namecheap: client.services.namecheap,
		image: config.stack.image,
		userData: data.userData ? data.userData : null,
		slug: config.stack.slug
	});
	droplet.once("ready", config.stack.build(droplet, data));
}

function* destroy() {
	var toDelete = yield p2({
		name: "stacks",
		type: "list",
		message: "Which stack do you want to delete?",
		choices: function() {
			var options = [];
			var builtStacks = _.values(client.stacks);
			_.each(builtStacks, function(stack, i) {
				options.push({
					name: stack.name,
					value: [stack]
				});
			});
			options.push({
				name: "--------",
				type: "separator"
			}, {
				name: "Delete all stacks",
				value: builtStacks
			});
			return options;
		}
	});
	_.each(toDelete.stacks, function(stackData) {
		var stack = new Stack({
			name: stackData.name,
			digitalOcean: client.services.digitalOcean,
			namecheap: client.services.namecheap
		});
		stack.once("ready", function() {
			console.info("deleting " + stack.server.name);
			stack.destroy().catch(function(err) {
				stack.emit("error", err);
			});
		});
	});
}

function* stackathon() {
	var answers = yield p2({
		name: "action",
		type: "list",
		message: "What do you want to do?",
		choices: [{
			name: "Make a new stack",
			value: "new"
		}, {
			name: "Delete a stack",
			value: "delete"
		}, {
			name: "Reset credentials",
			value: "reset"
		}]
	});
	switch (answers.action) {
		case "new":
			run(create);
			break;
		case "delete":
			run(destroy);
			break;
		case "reset":
			client.reset();
			break;
	}
}

console.log("*************************************".rainbow);
console.log("* Stackathon: Don't Worry, Be Hacky *".rainbow);
console.log("*************************************".rainbow);

client.on("ready", function() {
	run(stackathon);
});
