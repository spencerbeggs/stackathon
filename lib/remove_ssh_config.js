"use strict";
var Handlebars = require("handlebars");
var fs = require("fs");

module.exports = function(options) {
	return function(callback) {
		var template = Handlebars.compile(fs.readFileSync("../templates/config", "utf-8"));
		fs.appendFile(process.env.HOME + "/.ssh/config", "\n" + template({
			ip: options.ip,
			domain: options.domain,
			port: options.port ? options.port : "22",
			adminUsername: options.adminUsername ? options.adminUsername : "root"
		}), function(err) {
			if (err) {
				return callback(err);
			}
			return callback(null);
		});
	}
};
