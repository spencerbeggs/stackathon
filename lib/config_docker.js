"use strict";
var async = require("async");
var lib = require("./index");
var Client = require("ssh2").Client;

module.exports = function(answers) {

	return function(answers, callback) {
		var client = new Client();

		function comm(command) {
			return function(callback) {
				client.exec(command, {}, function(err, stream) {
					stream.on("close", function(code, signal) {
						callback(null);
					}).on("data", function(data) {
						//console.log(data);
					}).stderr.on("data", function(data) {
						console.log("STDERR: " + data);
					});
				});
			};
		}

		function connect() {
			client.connect({
				host: answers.ip,
				port: 22,
				username: "root",
				privateKey: new Buffer(answers.keys.private, "utf8")
			});
		}

		client.on("error", function(err) {
			connect();
		});

		client.on("ready", function() {
			var funcs = [];
			var commands = [
				"mkdir /home/" + answers.adminUsername,
				"mkdir /home/" + answers.adminUsername + "/webapp",
				"mkdir /home/" + answers.adminUsername + "/.ssh",
				"echo \"" + answers.keys.public + "\" > /home/" + answers.adminUsername + "/.ssh/authorized_keys",
				answers.gitRepo ? lib.sendFile("/home/" + answers.adminUsername + "/Dockerfile", answers, client) : "",
				lib.sendFile("/etc/network/if-pre-up.d/iptables", answers, client),
				lib.sendFile("/etc/iptables.up.rules", answers, client),
				lib.sendFile("/etc/ssh/sshd_config", answers, client),
				lib.sendFile("/home/" + answers.adminUsername + "/sudoers.sh", answers, client),
				answers.gitRepo ? lib.sendFile("/etc/default/docker", answers, client) : "",
				"/sbin/iptables -F",
				"/sbin/iptables-restore < /etc/iptables.up.rules",
				"service ssh reload",
				"service docker restart",
				"/usr/sbin/useradd " + answers.adminUsername,
				"/usr/sbin/groupadd wheel",
				"export EDITOR=/usr/bin/nano",
				"echo \"" + answers.adminUsername + ":" + answers.adminPassword + "\" | chpasswd",
				"/usr/sbin/usermod -a -G wheel " + answers.adminUsername,
				"/usr/sbin/usermod -a -G docker " + answers.adminUsername,
				answers.gitRepo ? "git clone " + answers.gitRepo + " /home/" + answers.adminUsername + "/webapp" : "",
				"chmod a+rx /home/" + answers.adminUsername,
				"chown -R " + answers.adminUsername + ":" + answers.adminUsername + " ~" + answers.adminUsername + "/.ssh",
				"chmod +x /home/" + answers.adminUsername + "/sudoers.sh",
				"/home/" + answers.adminUsername + "/sudoers.sh",
				"chmod 700 /home/" + answers.adminUsername + "/.ssh",
				"chmod 600 /home/" + answers.adminUsername + "/.ssh/authorized_keys",
				"chown -R " + answers.adminUsername + ":" + answers.adminUsername + " /home/" + answers.adminUsername + "/.ssh",
				"chown " + answers.adminUsername + ":wheel /home/" + answers.adminUsername + "/.ssh/authorized_keys",
				answers.gitRepo ? "docker build -t=webapp /home/" + answers.adminUsername : "",
				//answers.gitRepo ? "rm /data/Dockerfile" : "",
				answers.gitRepo ? "rm /home/" + answers.adminUsername + "/sudoers.sh" : "",
				answers.gitRepo ? "docker run -d -p 80:80 webapp" : ""
			];

			commands.forEach(function(command) {
				if (typeof command === "string") {
					funcs.push(comm(command));
				}
				else {
					funcs.push(command);
				}
			});

			async.series(funcs, function(err, results) {
				if (err) {
					return console.log(err);
				}
				return callback(null, answers);
			});

		});
		connect();
	};
};
