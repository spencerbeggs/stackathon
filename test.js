var Stack = require("./lib/stack");
var fs = require("fs");
var stack = new Stack("kiq.io");
var SSH2Shell = require("SSH2Shell");

stack.on("ready", function() {
	var self = stack;
	stack.sendFiles("/home/root/sudoers.sh").then(function() {
		console.log("done");
	}).catch(function(err) {
		console.log(err);
	});
});
