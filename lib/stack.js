"use strict";
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var request = require("request");
var Client = require("ssh2").Client;
var _ = require("lodash");
var moniker = require("moniker");
var keygen = require("ssh-keygen");
var async = require("async");
var fs = require("fs");
var Handlebars = require("handlebars");
var path = require("path");
var SSH2Shell = require("ssh2shell");

var defaults = {
	name: null,
	domain: null,
	subdomain: null,
	ssh: {
		username: "root",
		port: 22,
		keys: {
			public: null,
			private: null,
			id: null
		}
	},
	droplet: null
};

function Stack(options) {
	var self = this;
	this.server = _.clone(defaults);
	if (typeof options === "string") {
		this.server.name = options;
	} else if (typeof options === "object") {
		_.merge(this.server, options);
	}
	Object.observe(self.server, self.save);
	Object.observe(self.server.ssh, self.save);
	Object.observe(self.server.ssh.keys, self.save);
	self.api = request.defaults({
		json: true,
		headers: {
			"Authorization": "Bearer " + process.env.DIGITAL_OCEAN_API_KEY || self.config().services.digitalOcean.key
		}
	});
	self.on("load", function() {
		console.log("stack info loaded from config file");
	});
	self.on("refresh", function() {
		console.log("droplet info refreshed");
	});
	self.on("build", function() {
		console.log("stack built");
	});
	self.on("ready", function() {
		console.log("stack ready");
	});
	self.on("save", function() {
		console.log("stack saved");
	});
	self.on("keygen", function() {
		console.log("keys generated for stack");
	});
	self.on("unkeygen", function() {
		console.log("keys deleted for stack");
	});
	self.on("destroy", function() {
		console.log("stack destroyed");
	});
	self.on("error", function(err) {
		console.log("stack error");
		console.log(err);
	});
	console.log(this.server);

	self.load().then(function() {
		if (!self.server.droplet) {
			self.poll();
		} else {
			self.refresh().then(function() {
				self.emit("ready");
			});
		}
	}).catch(function() {
		console.log("building new stack for " + self.server.name);
		self.once("keygen", self.build);
		self.once("build", self.poll);
		self.once("ready", self.save);
		self.keygen();
	});
	EventEmitter.call(this);
}

util.inherits(Stack, EventEmitter);

Stack.prototype.stacks = function() {
	var conf = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"));
	if (!conf.stacks) {
		conf.stacks = {};
	}
	return conf.stacks;
};

Stack.prototype.config = function() {
	var conf = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"));
	conf.stacks = conf.stacks || {};
	conf.services = conf.services || {};
	return conf;
};

Stack.prototype.creds = function() {
	var conf = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon").services);
	if (!conf.services) {
		conf.services = {};
	}
	return conf.services;
};

Stack.prototype.load = function(name) {
	var self = this;
	return new Promise(function(resolve, reject) {
		var stacks = self.stacks();
		if (self.server.name && stacks[self.server.name]) {
			_.merge(self.server, stacks[self.server.name]);
			self.emit("load");
			resolve();
		} else {
			reject();
		}
	});
};

Stack.prototype.destroy = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		Object.unobserve(self.server, self.save);
		Object.unobserve(self.server.ssh, self.save);
		Object.unobserve(self.server.ssh.keys, self.save);
		async.parallel([
			function(cb) {
				var config = self.config();
				delete config.stacks[self.server.name];
				fs.writeFile(process.env.HOME + "/.stackathon", JSON.stringify(config, null, 4), function(err) {
					if (err) {
						cb(err);
					} else {
						cb(null);
					}
				});

			},
			function(cb) {
				fs.unlink(self.server.ssh.keys.private, function(err) {
					if (err) {
						cb(err);
					} else {
						cb(null);
					}
				});
			},
			function(cb) {
				fs.unlink(self.server.ssh.keys.public, function(err) {
					if (err) {
						cb(err);
					} else {
						cb(null);
					}
				});
			},
			function(cb) {
				fs.readFile(process.env.HOME + "/.ssh/config", {
						encoding: "utf8"
					},
					function(err, configText) {
						if (err) {
							cb(err);
						}
						var output = "";
						var lines = configText.split("\n");
						var adding = true;
						lines.forEach(function(line) {
							if (line === "# " + self.server.name + " config") {
								adding = !adding;
							} else {
								if (adding) {
									output += line + "\n";
								}
							}
						});
						fs.writeFile(process.env.HOME + "/.ssh/config", output, function(err) {
							if (err) {
								cb(err);
							}
							cb(null, output);
						});
					});
			},
			function(cb) {
				self.api.del({
					url: "https://api.digitalocean.com/v2/droplets/" + self.server.droplet.id
				}, function(err, res, body) {
					if (err) {
						cb(err);
					} else {
						cb(null);
					}
				});
			},
			function(cb) {
				self.api.del({
					url: "https://api.digitalocean.com/v2/account/keys/" + self.ssh.keys.id
				}, function(err, res, body) {
					if (err) {
						cb(err);
					} else {
						cb(null);
					}
				});
			}
		], function(err, results) {
			if (err) {
				self.emit("error", err);
				reject(err);
			} else {
				self.emit("save");
				resolve();
			}
		});
	});
};

Stack.prototype.save = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var config = self.config();
		async.parallel([
			function(cb) {
				config.stacks[self.server.name] = self.server;
				fs.writeFile(process.env.HOME + "/.stackathon", JSON.stringify(config, null, 4), function(err) {
					if (err) {
						cb(err);
					} else {
						cb(null);
					}
				});

			},
			function(cb) {
				var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../stacks/base/templates/config"), "utf-8"));
				var text = template({
					name: self.server.name,
					host: self.hostname() ? self.hostname() : self.server.name,
					ip: self.server.droplet ? self.server.droplet.networks.v4[0].ip_address : undefined,
					keyPath: self.server.ssh.keys.private,
					port: self.server.ssh.port,
					username: self.server.ssh.username
				});
				fs.readFile(process.env.HOME + "/.ssh/config", {
						encoding: "utf8"
					},
					function(err, configText) {
						if (err) {
							cb(err);
						}
						var output = "";
						var lines = configText.split("\n");
						if (lines.indexOf("# " + self.server.name + " config") === -1) {
							output = configText + "\n" + text;
						} else {
							var adding = true;
							lines.forEach(function(line) {
								if (line === "# " + self.server.name + " config") {
									if (adding) {
										output += text;
									}
									adding = !adding;
								} else {
									if (adding) {
										output += line + "\n";
									}
								}
							});
						}
						fs.writeFile(process.env.HOME + "/.ssh/config", output, function(err) {
							if (err) {
								cb(err);
							}
							cb(null, output);
						});
					});
			}
		], function(err, results) {
			if (err) {
				self.emit("error", err);
				reject(err);
			} else {
				self.emit("save");
				resolve();
			}
		});
	});
};

Stack.prototype.keygen = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var keyname;
		if (self.hostname()) {
			keyname = self.hostname();
		} else {
			keyname = self.server.name;
		}
		keygen({
			location: process.env.HOME + "/.ssh/" + keyname,
			password: false,
			read: true
		}, function(err, keys) {
			if (err) {
				self.emit("error", err);
				reject(err);
			}
			self.server.ssh.keys.private = process.env.HOME + "/.ssh/" + keyname;
			self.server.ssh.keys.public = process.env.HOME + "/.ssh/" + keyname + ".pub";
			async.parallel([
				function(cb) {
					fs.writeFile(self.server.ssh.keys.private, keys.key, {
						mode: "0600"
					}, function(err) {
						if (err) {
							return cb(err);
						}
						return cb(null);
					});
				},
				function(cb) {
					fs.writeFile(self.server.ssh.keys.public, keys.pubKey, {
						mode: "0600"
					}, function(err) {
						if (err) {
							return cb(err);
						}
						return cb(null);
					});
				}
			], function(err) {
				if (err) {
					self.emit("error", err);
					reject(err);
				} else {
					var pubkey = fs.readFileSync(self.server.ssh.keys.public, {
						encoding: "utf8"
					});
					self.api.post({
						url: "https://api.digitalocean.com/v2/account/keys",
						body: {
							name: self.server.name,
							public_key: pubkey
						}
					}, function(err, res, body) {
						if (err) {
							self.emit("error", err);
							reject(err);
						} else {
							self.server.ssh.keys.id = body.ssh_key.id;
							self.emit("keygen");
							resolve();
						}
					});
				}
			});
		});
	});
};

Stack.prototype.hostname = function() {
	if (this.server.domain) {
		var hostname = "";
		if (this.server.subdomain) {
			hostname += this.server.subdomain + ".";
		}
		hostname += this.server.domain;
		return hostname;
	} else {
		return false;
	}
};

Stack.prototype.build = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		self.api.post({
			url: "https://api.digitalocean.com/v2/droplets",
			body: {
				"name": self.server.name,
				"region": "nyc3",
				"size": "1gb",
				"image": "docker",
				"ssh_keys": [self.server.ssh.keys.id],
				"backups": false,
				"ipv6": true,
				"user_data": null,
				"private_networking": null
			}
		}, function(err, res, body) {
			if (err) {
				self.emit("error", err);
				reject(err);
			} else {
				self.server.droplet = body.droplet;
				self.save();
				self.emit("build");
				resolve();
			}
		});
	});
};

Stack.prototype.poll = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var waiting = true;
		async.whilst(
			function() {
				return waiting === true;
			},
			function(callback) {
				if (!self.server.droplet) {
					setTimeout(callback, 10000);
				} else {
					self.api.get({
						url: "https://api.digitalocean.com/v2/droplets/" + self.server.droplet.id
					}, function(err, res, body) {
						if (body.droplet.status === "active") {
							self.server.droplet = body.droplet;
							waiting = false;
							callback();
						} else {
							setTimeout(callback, 10000);
						}
					});
				}
			},
			function(err) {
				if (err) {
					self.emit("error", err);
					reject(err);
				} else {
					self.emit("ready");
					resolve();
				}
			});
	});
};

Stack.prototype.refresh = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		if (!self.server.droplet || !self.server.droplet.id) {
			reject();
		} else {
			self.api.get({
				url: "https://api.digitalocean.com/v2/droplets/" + self.server.droplet.id
			}, function(err, res, body) {
				if (err) {
					self.emit("error", err);
					reject();
				} else {
					self.server.droplet = body.droplet;
					self.emit("refresh");
					resolve();
				}
			});
		}
	});
};

Stack.prototype.unkeygen = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		async.parallel([
			function(callback) {
				fs.unlink(self.server.ssh.keys.public, function(err) {
					if (err) {
						return callback(err);
					}
					return callback(null);
				});
			},
			function(callback) {
				fs.unlink(self.server.ssh.keys.private, function(err) {
					if (err) {
						return callback(err);
					}
					return callback(null);
				});
			},
			function(callback) {
				self.api.del({
					url: "https://api.digitalocean.com/v2/account/keys/" + self.server.ssh.keys.id
				}, function(err, res, body) {
					if (err) {
						return callback(err);
					}
					return callback(null);
				});
			}
		], function(err) {
			if (err) {
				self.emit("error", err);
				reject(err);
			} else {
				self.emit("unkeygen");
			}
		});
	});
};

Stack.prototype.run = function(commands) {
	var self = this;
	if (typeof commands === "string") {
		commands = [commands];
	}
	return new Promise(function(resolve, reject) {
		var SSH = new SSH2Shell({
			idleTimeOut: 15000,
			server: {
				host: self.server.droplet.networks.v4[0].ip_address,
				port: self.server.ssh.port,
				userName: self.server.ssh.username,
				privateKey: fs.readFileSync(self.server.ssh.keys.private)
			},
			commands: commands,
			msg: {
				send: function(message) {
					//console.log(message);
				}
			}
		});
		SSH.on("connect", function onConnect() {
			console.log("connected to droplet");
			//default: outputs primaryHost.connectedMessage
		});
		SSH.on("ready", function onReady() {
			console.log("running " + commands.length + " commands");
			//default: outputs primaryHost.connectedMessage
		});
		SSH.on("msg", function onMsg(message) {
			//default: outputs the message to the host.msg.send function. If undefined output is to console.log
			//message is the text to ouput.
		});
		SSH.on("commandProcessing", function onCommandProcessing(command, response, sshObj, stream) {
			//console.log("processing: " + command);
		});
		SSH.on("commandComplete", function onCommandComplete(command, response, sshObj) {
			console.log(command);
		});
		SSH.on("commandTimeout", function onCommandTimeout(command, response, stream, connection) {
			self.emit("error", new Error("timed out on: " + command));
			reject();
		});
		SSH.on("end", function onEnd(sessionText, sshObj) {
			console.log("SSH ended");
			resolve();
			//default: outputs primaryHost.connectedMessage
		});
		SSH.on("close", function onClose(had_error) {
			console.log("SSH closed");
			resolve();
			//default: outputs primaryHost.connectedMessage
		});
		SSH.on("error", function onError(err, type, close, callback) {
			self.emit("error", err);
			reject(err);
			//default: outputs primaryHost.connectedMessage
		});
		SSH.connect();
	});
};

module.exports = Stack;
