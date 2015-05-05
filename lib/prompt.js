"use strict";
var prompt = require("prompt");
/*jshint -W079 */

module.exports = function(props) {
	return function(callback) {
		prompt.message = "";
		prompt.delimiter = "";
		prompt.start();
		prompt.get({
			properties: props
		}, function(err, answers) {
			if (err) {
				callback(err);
			} else {
				callback(null, answers);
			}
		});
	};
};
