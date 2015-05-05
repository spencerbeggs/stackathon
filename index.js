#!/usr/bin/env node

"use strict";
var Client = require("./lib/client");
var Stack = require("./lib/stack");
var _ = require("lodash");
var stacks = require("./stacks");
var p2 = require("./lib/prompt");
var prompt2 = require("prompt");
var passwordGenerator = require("password-generator");
var run = require("gen-run");

prompt2.message = "";
prompt2.delimiter = "";
prompt2.start();

var client = new Client();

function* create() {
	console.log("What kind of stack do you want to create?");
	_.each(stacks, function(stack, i) {
		console.log("  [" + (i + 1) + "] " + stack.name);
	});
	yield p2({
		type: {
			description: "number:",
			pattern: /[0-9]/,
			required: true,
			default: "1"
		}
	});
	var base = stacks[0];
	var type = stacks[parseInt(prompt2.history("type").value, 10) - 1];
	yield p2({
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
	});
	var domain, subdomain, name;
	if (client.services.namecheap.username && client.services.namecheap.key) {
		_.each(client.domains, function(domain, i) {
			console.log("  [" + (i + 1) + "] " + domain.Name);
		});
		yield p2({
			domainNum: {
				description: "domain (optional):",
				pattern: /^[a-zA-Z0-9.\s-]+$/,
				message: "Name must be only letters, spaces, or dashes",
				required: false
			}
		});
		domain = client.domains[parseInt(prompt2.history("domainNum").value, 10) - 1].Name;
	} else {
		yield p2({
			name: {
				description: "project name:",
				pattern: /^[a-zA-Z.\s-]+$/,
				message: "Name must be only letters, spaces, or dashes",
				required: false,
				default: "my-stack"
			}
		});
		name = prompt2.history("name").value;
	}
	if (domain) {
		yield p2({
			subdomain: {
				description: "subdomain (optional):",
				pattern: /^[a-zA-Z.\s-]+$/,
				message: "Name must be only letters, spaces, or dashes",
				required: false
			}
		});
		subdomain = prompt2.history("subdomain").value;
	}
	var hostname;
	if (domain) {
		hostname = "";
		if (subdomain) {
			hostname += subdomain + ".";
		}
		hostname += domain;
	}
	var stack = new Stack({
		name: hostname ? hostname : name,
		domain: domain ? domain : null,
		subdomain: subdomain ? subdomain : null
	});
	stack.once("ready", function() {
		var commands = [
			"export EDITOR=/usr/bin/nano",
			"mkdir -p /home/" + prompt2.history("username").value + "/.ssh",
			"echo \"" + stack.keys().public + "\" \> /home/" + prompt2.history("username").value + "/.ssh/authorized_keys",
			"/sbin/iptables -F",
			"/sbin/iptables-restore < /etc/iptables.up.rules",
			"/usr/sbin/useradd " + prompt2.history("username").value,
			"/usr/sbin/groupadd wheel",
			"echo \"" + prompt2.history("username").value + ":" + prompt2.history("password").value + "\" | chpasswd",
			"/usr/sbin/usermod -a -G wheel " + prompt2.history("username").value,
			"/usr/sbin/usermod -a -G docker " + prompt2.history("username").value,
			"chmod a+rx /home/" + prompt2.history("username").value,
			"chown -R " + prompt2.history("username").value + ":" + prompt2.history("username").value + " ~" + prompt2.history("username").value + "/.ssh",
			"chmod +x /home/" + prompt2.history("username").value + "/sudoers.sh",
			"/home/" + prompt2.history("username").value + "/sudoers.sh",
			"chmod 700 /home/" + prompt2.history("username").value + "/.ssh",
			"chmod 600 /home/" + prompt2.history("username").value + "/.ssh/authorized_keys",
			"chown -R " + prompt2.history("username").value + ":" + prompt2.history("username").value + " /home/" + prompt2.history("username").value + "/.ssh",
			"chown " + prompt2.history("username").value + ":wheel /home/" + prompt2.history("username").value + "/.ssh/authorized_keys",
			"rm /home/" + prompt2.history("username").value + "/sudoers.sh",
			"service docker restart",
			"service ssh reload"
		];
		stack.run(commands).then(function() {
			stack.sendFiles()

			stack.sendFile("/etc/network/if-pre-up.d/iptables"),
				stack.sendFile("/etc/iptables.up.rules", {
					port: prompt2.history("port").value
				}),
				stack.sendFile("/etc/ssh/sshd_config", {
					port: prompt2.history("port").value,
					username: prompt2.history("username").value
				}),
				stack.sendFile("/home/" + prompt2.history("username").value + "/sudoers.sh"),

				console.log("base stack finsihed");
			stack.server.ssh.username = prompt2.history("username").value;
			stack.server.ssh.port = prompt2.history("port").value;
		});
	});
}

function* mainMenu() {
	console.log("*************************************");
	console.log("* Stackathon: Don't Worry, Be Hacky *");
	console.log("*************************************\n");
	console.log("What do you want to do?");
	console.log("  [1] Make a new stack");
	console.log("  [2] Delete a stack");
	console.log("  [3] Reset credentials");
	yield p2({
		action: {
			description: "number:",
			pattern: /[1-3]/,
			required: true,
			default: "1"
		}
	});
}

function* destroy() {
	console.log("Which stack do you want to delete?");
	var builtStacks = _.values(client.load().stacks);
	_.each(builtStacks, function(stack, i) {
		console.log("  [" + (i + 1) + "] " + stack.name);
	});
	console.log("  [" + (builtStacks.length + 1) + "] Delete all stacks");
	yield p2({
		toDelete: {
			description: "number:",
			pattern: /[0-9]/,
			required: true,
			default: "1"
		}

	});
	var stacksToDelete = [];
	var ind = parseInt(prompt2.history("toDelete").value, 10);
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
}

function* stackathon() {
	yield * mainMenu();
	switch (prompt2.history("action").value) {
		case "1":
			run(create);
			break;
		case "2":
			run(destroy);
			break;
		case "3":
			client.reset();
			break;
	}
}

client.on("ready", function() {
	client.init().then(run(stackathon));
});
