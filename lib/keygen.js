"use strict";
var keygen = require("ssh-keygen");
var fs = require("fs");
var async = require("async");
var nconf = require("nconf");

module.exports = function(answers) {
	return function(callback) {
		nconf.file(process.env.HOME + "/.stackathon");
		keygen({
			location: process.env.HOME + "/.ssh/" + answers.domain.Name,
			comment: answers.adminEmail,
			password: false,
			read: true
		}, function(err, keys) {
			if (err) {
				return callback(err);
			}
			async.parallel([
				function(cb) {
					fs.writeFile(process.env.HOME + "/.ssh/" + answers.domain.Name, keys.key, {
						mode: "0600"
					}, function(err) {
						if (err) {
							return callback(err);
						}
						return cb(null);
					});
				},
				function(cb) {
					fs.writeFile(process.env.HOME + "/.ssh/" + answers.domain.Name + ".pub", keys.pubKey, {
						mode: "0600"
					}, function(err) {
						if (err) {
							return callback(err);
						}
						return cb(null);
					});
				}
			], function(err) {
				if (err) {
					return callback(err);
				}
				answers.keys = {
					private: keys.key,
					public: keys.pubKey
				};
				nconf.set("stacks:" + answers.domain.Name + ":keys", {
					private: process.env.HOME + "/.ssh/" + answers.domain.Name,
					public: process.env.HOME + "/.ssh/" + answers.domain.Name + ".pub"
				});
				nconf.save(function(err) {
					if (err) {
						console.log(err);
					}
					callback(null, answers);
				});
			});
		});
	};
};
