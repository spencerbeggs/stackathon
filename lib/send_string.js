"use strict";
var temp = require("temp");
var fs = require("fs");

module.exports = function sendString(dest, str, result) {
	var destArr = dest.split("/");
	var filename = destArr[destArr.length - 1];
	return function(callback) {
		temp.open("str", function(err, info) {
			if (err) {
				console.log(err);
			}
			fs.write(info.fd, str);
			fs.close(info.fd, function(err) {
				if (err) {
					console.log(err);
				}
				conn.sftp(function(err, sftp) {
					if (err) {
						console.log(err);
						throw err;
					}
					sftp.fastPut(info.path, dest + "/" + filename, function(err) {
						console.log("UPDATE: " + dest);
						callback(null, filename);
					});
				});
			});
		});
	};

};
