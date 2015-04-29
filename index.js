#!/usr/bin/env node

"use strict";
var Client = require("./lib/client");
var Stack = require("./lib/stack");
var _ = require("lodash");
var stacks = require("./stacks");
var p2 = require("./lib/prompt");
var prompt = require("prompt");
var passwordGenerator = require("password-generator");

prompt.message = "";
prompt.delimiter = "";
prompt.start();

console.log("*************************************");
console.log("* Stackathon: Don't Worry, Be Hacky *");
console.log("*************************************\n");

var client = new Client();

client.on("ready", function() {

	client.init().then(function() {
		console.log("What do you want to do?");
		console.log("  [1] Make a new stack");
		console.log("  [2] Delete a stack");
		console.log("  [3] Reset credentials");

		p2({
			action: {
				description: "number:",
				pattern: /[1-3]/,
				required: true,
				default: "1"
			}
		}).then(function() {
			switch (prompt.history("action").value) {
				case "1":
					console.log("What kind of stack do you want to create?");
					_.each(stacks, function(stack, i) {
						console.log("  [" + (i + 1) + "] " + stack.name);
					});
					var step1 = p2({
						type: {
							description: "number:",
							pattern: /[0-9]/,
							required: true,
							default: "1"
						}

					}).then(function() {
						var base = stacks[0];
						var type = stacks[parseInt(prompt.history("type").value, 10) - 1];
						var step2 = p2({
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
							}
						}).then(function() {
							if (client.services.namecheap.username && client.services.namecheap.key) {
								client.getDomains().then(function() {
									_.each(client.domains, function(domain, i) {
										console.log("  [" + (i + 1) + "] " + domain.Name);
									});

									p2({
										domainNum: {
											description: "domain (optional):",
											pattern: /^[a-zA-Z0-9.\s-]+$/,
											message: "Name must be only letters, spaces, or dashes",
											required: false
										}
									}).then(function() {
										client.domain = client.domains[parseInt(prompt.history("domainNum").value, 10) - 1].Name;
										step2.resolve();
									}).catch(function(err) {
										console.log(err);
									});
								}).catch(function(err) {
									console.log(err);
								});

							} else {
								step2.resolve();
							}
						}).then(function() {
							if (prompt.history("domain")) {

								p2({
									name: {
										description: "project name:",
										pattern: /^[a-zA-Z.\s-]+$/,
										message: "Name must be only letters, spaces, or dashes",
										required: false,
										default: "my-stack"
									}
								}).then(function(answers) {
									var hostname;
									if (prompt.history("domain")) {
										hostname = "";
										if (prompt.history("subdomain")) {
											hostname += prompt.history("subdomain").value + ".";
										}
										hostname += prompt.history("domain").value;
									}
									var opts = {
										name: hostname ? hostname : prompt.history("name").value,
										domain: prompt.history("domain") ? prompt.history("domain").value : null,
										subdomain: prompt.history("subdomain") ? prompt.history("subdomain").value : null
									};
									var stack = new Stack(opts);
									stack.on("ready", function() {
										step1.resolve();
										console.log("LLLLLL");
									});
								}).catch(function(err) {
									console.log(err);
								});
							}
						}).catch(function(err) {
							console.log(err);
						});
					});
					break;
				case "2":
					console.log("Which stack do you want to delete?");
					var builtStacks = _.values(client.load().stacks);
					_.each(builtStacks, function(stack, i) {
						console.log("  [" + (i + 1) + "] " + stack.name);
					});
					console.log("  [" + (builtStacks.length + 1) + "] Delete all stacks");
					p2({
						toDelete: {
							description: "number:",
							pattern: /[0-9]/,
							required: true,
							default: "1"
						}

					}).then(function() {
						var stacksToDelete = [];
						var ind = parseInt(prompt.history("toDelete").value, 10);
						if (ind === builtStacks.length + 1) {
							stacksToDelete = builtStacks;
						} else {
							stacksToDelete.push(builtStacks[ind - 1]);
						}
						_.each(stacksToDelete, function(stackData) {
							var stack = new Stack(stackData.name);
							stack.once("ready", function() {
								stack.destroy().catch(function(err) {
									console.log(err);
								});
							});
						});
					});
					break;
				case "3":
					client.reset();
					break;
			}
		});
	});
});
