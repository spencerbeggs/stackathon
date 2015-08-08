var _ = require("lodash");
var request = require("request");
var fs = require("fs");
var Handlebars = require("handlebars");
var path = require("path");
var run = require("gen-run");

module.exports = {
	name: "CoreOS 717.3.0 (stable)",
	image: "coreos-stable",
	slug: "coreos",
	questions: require("../base").coreos.concat([{
		name: "token",
		type: "list",
		message: "Which cluster should this stack belong to?",
		choices: function() {
			var options = [];
			var config = fs.readFileSync(process.env.HOME + "/.stackathon", {
				encoding: "utf8"
			});
			var tokens = [];
			_.each(config.stacks, function(stack) {
				if (stack.coreOsCluster) {
					options.push({
						name: stack.coreOsCluster,
						value: stack.coreOsCluster
					});
				}
			});
			if (options.length !== 0) {
				options.push({
					name: "---------",
					type: "separator"
				});
			}
			options.push({
				name: "Generate a new cluster ID",
				value: false
			}, {
				name: "Manually enter cluster ID",
				value: null
			});
			return options;
		},
		filter: function(input) {
			var done = this.async();
			if (input === false) {
				request.get("https://discovery.etcd.io/new?size=1", function(error, response, body) {
					if (!error && response.statusCode == 200) {
						done(body);
					} else {
						throw error;
					}
				});
			} else {
				done(input);
			}
		},
		when: true
	}, {
		name: "token",
		type: "input",
		message: "Enter your cluster ID",
		when: function(answers) {
			return typeof answers.token === null
		}
	}, {
		name: "userData",
		type: "input",
		messsage: "this is a hack",
		when: function(answers) {
			console.log(answers);
			var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/templates/cloud-config"), "utf-8"));
			answers.userData = template({
				token: answers.token
			});
			answers.privateNetworking = true;
			console.log(answers.userData);
			return false;
		}
	}]),
	build: function(stack, base) {
		return function() {
			stack.server.ssh.username = "core";
			stack.emit("done");
		};
	}
};
