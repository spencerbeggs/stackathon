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
var fs = require("fs");

prompt2.message = "   ".red;
prompt2.delimiter = "   ".red;
prompt2.start();

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

var client = new Client();

function* create() {
	console.log("What kind of stack do you want to create?".yellow);
	_.each(stacks, function(stack, i) {
		var item = "  [" + (i + 1) + "] " + stack.name;
		console.log(item.blue);
	});
	yield p2({
		type: {
			description: "number:".red,
			pattern: /[0-9]/,
			required: true,
			default: "1"
		}
	});
	var base = stacks[0];
	var type = stacks[parseInt(prompt2.history("type").value, 10) - 1];
	yield p2({
		port: {
			description: "shh port:".red,
			pattern: /^[0-9\s-]+$/,
			required: true,
			default: "7676"
		},
		username: {
			description: "Admin username:".red,
			pattern: /^[a-zA-Z\s-]+$/,
			required: true,
			default: "admin"
		},
		password: {
			description: "Admin password:".red,
			pattern: /^[a-zA-Z0-9_&#$%^*\s-]+$/,
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
				description: "domain (optional):".red,
				pattern: /^[a-zA-Z0-9.\s-]+$/,
				message: "Name be number or valid domain",
				required: false
			}
		});
		if (_.isNaN(parseInt(prompt2.history("domainNum").value, 10))) {
			domain = prompt2.history("domainNum").value;
		} else {
			domain = client.domains[parseInt(prompt2.history("domainNum").value, 10) - 1].Name;
		}
	} else {
		yield p2({
			name: {
				description: "project name:".red,
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
				description: "subdomain (optional):".red,
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
		subdomain: subdomain ? subdomain : null,
		key: client.services.digitalOcean.key
	});
	stack.once("ready", function() {
		console.log("+++");
		var commands = [
			"export EDITOR=/usr/bin/nano",
			"mkdir -p /home/" + prompt2.history("username").value + "/.ssh",
			"echo \"" + stack.keys().public.replace("\n", "") + "\" \> /home/" + prompt2.history("username").value + "/.ssh/authorized_keys",
			"/usr/sbin/useradd " + prompt2.history("username").value,
			"/usr/sbin/groupadd wheel",
			"echo \"" + prompt2.history("username").value + ":" + prompt2.history("password").value + "\" | chpasswd",
			"/usr/sbin/usermod -a -G wheel " + prompt2.history("username").value,
			"/usr/sbin/usermod -a -G docker " + prompt2.history("username").value,
			"chmod a+rx /home/" + prompt2.history("username").value,
			"chown -R " + prompt2.history("username").value + ":wheel /home/" + prompt2.history("username").value,
			"chmod 700 /home/" + prompt2.history("username").value + "/.ssh",
			"chmod 600 /home/" + prompt2.history("username").value + "/.ssh/authorized_keys",
			"exit"
		];
		stack.run(commands).then(function() {
			console.log("[STACK] Initialized");
			stack.sendFiles([
				"/etc/network/if-pre-up.d/iptables", ["/etc/iptables.up.rules", {
					port: prompt2.history("port").value
				}],
				["/etc/ssh/sshd_config", {
					port: prompt2.history("port").value,
					username: prompt2.history("username").value
				}],
				"/home/" + prompt2.history("username").value + "/sudoers.sh"
			]).then(function() {
				console.log("[STACK] Uploads finished");
				stack.run([
					"chmod +x /home/" + prompt2.history("username").value + "/sudoers.sh",
					"/home/" + prompt2.history("username").value + "/sudoers.sh",
					"rm /home/" + prompt2.history("username").value + "/sudoers.sh",
					"/sbin/iptables -F",
					"/sbin/iptables-restore < /etc/iptables.up.rules",
					"service docker restart",
					"service ssh reload",
					"exit"
				]).then(function() {
					console.log("[STACK] Base stack configured");
					stack.server.ssh.username = prompt2.history("username").value;
					stack.server.ssh.port = prompt2.history("port").value;
					stack.save();
				}).catch(function(err) {
					stack.emit("error", err);
				});
			}).catch(function(err) {
				stack.emit("error", err);
			});
		}).catch(function(err) {
			stack.emit("error", err);
		});
	});
}

function* mainMenu() {
	console.log("What do you want to do?".yellow);
	console.log("  [1] Make a new stack".blue);
	console.log("  [2] Delete a stack".blue);
	console.log("  [3] Reset credentials".blue);
	yield p2({
		action: {
			description: "number:".red,
			pattern: /[1-3]/,
			required: true,
			default: "1"
		}
	});
}

function* destroy() {
	console.log("Which stack do you want to delete?");
	var builtStacks = _.values(client.stacks);
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

console.log("*************************************".rainbow);
console.log("* Stackathon: Don't Worry, Be Hacky *".rainbow);
console.log("*************************************".rainbow);

client.on("ready", function() {
	run(stackathon);
});
// trivial
