/*jshint -W079 */
"use strict";
var prompt = require("prompt");
var nconf = require("nconf");
var _ = require("lodash");

module.exports = function(answers) {
	nconf.file(process.env.HOME + "/.stackathon");
	console.log("\nWhat do you want to do?");
	console.log("  [1] Make a new stack");
	console.log("  [2] Delete a stack");

	prompt.get({
		properties: {
			stack: {
				description: "number:",
				pattern: /[0-9]/,
				required: true,
				default: "1"
			}
		}

	}, function(err, result) {
		_.merge(answers, result);
		switch (answers.stack) {
			case "1":
				require("../stacks/docker")(answers);
				break;
			case "2":
				console.log("Which stack do you want to delete?");
				var stacks = _.values(nconf.get("stacks"));
				_.each(stacks, function(stack, i) {
					console.log("  [" + (i + 1) + "] " + stack.name);
				});
				console.log("  [" + (stacks.length + 1) + "] Delete all stacks");
				prompt.get({
					properties: {
						toDelete: {
							description: "number:",
							pattern: /[0-9]/,
							required: true,
							default: "1"
						}
					}

				}, function(err, answers) {
					if (answers.toDelete === stacks.length + 1 + "") {
						require("../stacks/clean")(stacks);
					}
					else {
						require("../stacks/clean")([stacks[answers.toDelete - 1]]);
					}
				});
				break;

		}
	});
};
