"use strict";
var Handlebars = require("handlebars");
var fs = require("fs");
var temp = require("temp");
var path = require("path");

module.exports = function makeFile(dest, template, data, client) {
	return function(answers, callback) {
		var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../templates/" + template), "utf-8"));
		temp.open(template, function(err, info) {
			if (err) {
				console.log(err);
			}
			var compiled = template(data);
			fs.write(info.fd, compiled);
			fs.close(info.fd, function(err) {
				if (err) {
					console.log(err);
				}

				client.sftp(function(err, sftp) {
					if (err) {
						console.log(err);
					}
					sftp.fastPut(info.path, dest, function(err) {
						if (err) {
							console.log(err);
						}
						console.log("UPDATE: " + dest);
						callback(null, template);
					});
				});
			});
		});
	};
};
