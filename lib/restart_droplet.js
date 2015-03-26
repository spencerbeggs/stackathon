"use strict";
var async = require("async");
var lib = require("./index");
var SSH2Shell = require("ssh2shell");

module.exports = function(answers) {
	return function(answers, callback) {
		async.series([
			lib.sendFile("/etc/php5/apache2/conf.d/apc.ini", answers),
			lib.sendFile("/home/" + answers.adminUsername + "/sites/" + answers.domain + "/public/.htaccess", answers)
		], function(err, results) {
			if (err) {
				return console.log(err);
			}
			//Create a new instance
			var SSH = new SSH2Shell({
				idleTimeOut: 15000,
				server: {
					host: answers.ip,
					port: "22",
					userName: "root",
					privateKey: new Buffer(answers.keys.private, "utf8")
				},
				commands: [
					"service ssh reload",
					"service apache2 graceful"
				],
				msg: {
					send: function(message) {
						console.log(message);
					}
				},
				onCommandProcessing: function(command, response, sshObj, stream) {
					//console.log("issued: " + command);
				},
				onCommandComplete: function(command, response, sshObj) {
					console.log("issued: " + command);
				},
				onCommandTimeout: function(command, response, sshObj, stream, connection) {
					console.log("COMMAND TIMED OUT:" + command);
				},
				onEnd: function(sessionText, sshObj) {
					answers.conn.end();
					callback(null, answers);
				}
			});
			//Start the process
			SSH.connect();
		});
	};
};
