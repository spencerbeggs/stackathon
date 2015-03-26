"use strict";
var Handlebars = require("handlebars");
var fs = require("fs");
var path = require("path");

module.exports = function(answers) {
	return function(answers, callback) {
		var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../templates/config"), "utf-8"));
		fs.appendFile(process.env.HOME + "/.ssh/config", template({
			host: answers.domain.Name,
			ip: answers.ip,
			domain: answers.domain.Name,
			port: answers.port,
			adminUsername: answers.adminUsername
		}), function(err) {
			if (err) {
				return callback(err);
			}
			return callback(null, answers);
		});
	};
};
