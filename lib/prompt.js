"use strict";
var prompt = require("prompt");
/*jshint -W079 */

module.exports = function(props) {
	return new Promise(function(resolve, reject) {
		prompt.message = "";
		prompt.delimiter = "";
		prompt.start();
		prompt.get({
			properties: props
		}, function(err, answers) {
			if (err) {
				reject(err);
			} else {
				resolve(answers);
			}
		});
	});
};
