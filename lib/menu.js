/*jshint -W079 */
"use strict";
var prompt = require("prompt");

module.exports = function() {
	console.log("Select your stack:");
	console.log("  [1] WordPress on Digital Ocean");
	console.log("  [2] Docker");
	console.log("  [3] Clean");

	prompt.get({
		properties: {
			stack: {
				description: "number:",
				pattern: /[0-9]/,
				required: true,
				default: "2"
			}
		}

	}, function(err, answers) {
		switch (answers.stack) {
			case "1":
				require("../stacks/do_wp")();
				break;
			case "2":
				require("../stacks/docker")();
				break;
			case "3":
				require("../stacks/clean")();
				break;
		}
	});
};
