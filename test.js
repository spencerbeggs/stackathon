var Stack = require("./lib/stack");
var fs = require("fs");
var stack = new Stack("kiq.io");
var SSH2Shell = require("SSH2Shell");

stack.on("ready", function() {
	var self = stack;
	var commands = [
		"mkdir -p /home/spencer;printf \'#!/bin/sh\nif [ -z \"$1\" ];' >> foo'"
	];
	var SSH = new SSH2Shell({
		idleTimeOut: 90000,
		verbose: true,
		debug: true,
		server: {
			host: self.server.droplet.networks.v4[0].ip_address,
			port: self.server.ssh.port + "",
			userName: self.server.ssh.username,
			privateKey: fs.readFileSync(self.server.ssh.keys.private)
		},
		commands: commands,
		msg: {
			send: function(message) {
				//console.log(message);
			}
		}
	});
	SSH.on("connect", function onConnect() {
		console.log("connected to droplet");
		//default: outputs primaryHost.connectedMessage
	});
	SSH.on("ready", function onReady() {
		console.log("running " + commands.length + " commands");
		//default: outputs primaryHost.connectedMessage
	});
	SSH.on("msg", function onMsg(message) {
		//default: outputs the message to the host.msg.send function. If undefined output is to console.log
		//message is the text to ouput.
	});
	SSH.on("commandProcessing", function onCommandProcessing(command, response, sshObj, stream) {
		//console.log("processing: " + command);
	});
	SSH.on("commandComplete", function onCommandComplete(command, response, sshObj) {
		console.log(command);
	});
	SSH.on("commandTimeout", function onCommandTimeout(command, response, stream, connection) {
		self.emit("error", new Error("timed out on: " + command));
		reject();
	});
	SSH.on("end", function onEnd(sessionText, sshObj) {
		console.log("SSH ended");
		resolve();
		//default: outputs primaryHost.connectedMessage
	});
	SSH.on("close", function onClose(had_error) {
		console.log("SSH closed");
		resolve();
		//default: outputs primaryHost.connectedMessage
	});
	SSH.on("error", function onError(err, type, close, callback) {
		self.emit("error", err);
		reject(err);
		//default: outputs primaryHost.connectedMessage
	});
	SSH.connect();
});
