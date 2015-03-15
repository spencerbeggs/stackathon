"use strict";
var Handlebars = require("handlebars");
var fs = require("fs");
var path = require("path");

module.exports = function(answers, root) {
	return function(answers, callback) {
		var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../templates/config"), "utf-8"));
		fs.appendFile(process.env.HOME + "/.ssh/config", "\n" + template({
			host: root ? answers.domain + "-root" : answers.domain,
			ip: answers.ip,
			domain: answers.domain,
			port: root ? "22" : answers.port,
			adminUsername: root ? "root" : answers.adminUsername
		}), function(err) {
			if (err) {
				return callback(err);
			}
			return callback(null, answers);
		});
	};
};
