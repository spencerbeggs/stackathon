var Stack = require("./lib/stack");
var fs = require("fs");
var stack = new Stack("savvy.nyc");
var SSH2Shell = require("SSH2Shell");

stack.on("ready", function() {
	var self = stack;
	stack.sendFiles([
		"/home/spencer/sudoers.sh"
	]);
});
