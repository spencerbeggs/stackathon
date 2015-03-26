"use strict";
var Handlebars = require("handlebars");
var fs = require("fs");
var temp = require("temp");
var path = require("path");

module.exports = function sendFile(dest, answers, client) {
	var destArr = dest.split("/");
	var filename = destArr[destArr.length - 1];
	return function(callback) {
		var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../templates/" + filename), "utf-8"));
		temp.open(filename, function(err, info) {
			if (err) {
				console.log(err);
			}
			var compiled = template(answers);
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
						callback(null, filename);
					});
				});
			});
		});
	};
};
