"use strict";
var inquirer = require("inquirer");
var _ = require("lodash");

module.exports = function(questions) {
	if (!_.isArray(questions)) {
		questions = [questions];
	}
	return function(callback) {
		inquirer.prompt(questions, function(answers) {
			callback(null, answers);
		});
	};
};
