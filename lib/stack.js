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
var SFTP = require("ssh2").Client;

var defaults = {
	name: null,
	domain: null,
	subdomain: null,
	ssh: {
		username: null,
		port: null,
		keys: {
			public: null,
			private: null,
			id: null
		}
	},
	type: "base",
	droplet: null
};

function Stack(options) {
	var self = this;
	EventEmitter.call(this);
	this.server = _.clone(defaults);
	self.key = options.key ? options.key : "";
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
			"Authorization": "Bearer " + self.key
		}
	});
	self.on("load", function() {
		console.log("[STACK] " + self.server.name + " loaded from disk");
	});
	self.on("refresh", function() {
		console.log("[STACK] Droplet refreshed");
	});
	self.on("create", function() {
		console.log("[STACK] Created: " + self.server.name);
	});
	self.on("ready", function() {
		console.log("[STACK] Ready!");
	});
	self.on("save", function() {
		console.log("[STACK] Saved");
	});
	self.on("keygen", function() {
		console.log("[STACK] Keys generated");
	});
	self.on("unkeygen", function() {
		console.log("[STACK] Keys deleted");
	});
	self.on("destroy", function() {
		console.log("[STACK] Destroyed: " + self.server.name);
	});
	self.on("error", function(err) {
		console.log("[STACK] Error!");
		console.log(err);
	});
	self.once("ready", self.save);
	if (self.load()) {
		console.log("lll");
		if (!self.server.droplet) {
			self.poll();
		} else {
			self.refresh().then(function() {
				self.emit("ready");
			});
		}
	} else {
		self.once("keygen", self.build);
		self.once("create", self.poll);
		self.keygen();
	}
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
	var conf = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"), {
		encoding: "utf8"
	});
	return conf;
};

Stack.prototype.load = function(name) {
	var self = this;
	var stacks = JSON.parse(fs.readFileSync(process.env.HOME + "/.stackathon"), {
		encoding: "utf8"
	}).stacks;
	if (self.server.name && stacks[self.server.name]) {
		_.merge(self.server, stacks[self.server.name]);
		return true;
	} else {
		return false;
	}
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
					if (!fs.existsSync(process.env.HOME + "/.ssh/known_hosts")) {
						fs.writeFileSync(process.env.HOME + "/.ssh/known_hosts", "");
					}
					fs.readFile(process.env.HOME + "/.ssh/known_hosts", {
							encoding: "utf8"
						},
						function(err, configText) {
							if (err) {
								cb(err);
							}
							var output = "";
							var lines = configText.split("\n");
							lines.forEach(function(line) {
								if (self.server.droplet && line.indexOf(self.server.droplet.networks.v4[0].ip_address) === -1) {
									output += line + "\n";
								}
							});
							fs.writeFile(process.env.HOME + "/.ssh/known_hosts", output, function(err) {
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
						url: "https://api.digitalocean.com/v2/account/keys/" + self.server.ssh.keys.id
					}, function(err, res, body) {
						if (err) {
							cb(err);
						} else {
							cb(null);
						}
					});
				}
			],
			function(err, results) {
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

Stack.prototype.sendFiles = function(dests) {
	var self = this;
	if (typeof dests === "string") {
		dests = [dests];
	}
	return new Promise(function(resolve, reject) {
		var funcs = [];
		var host = {
			host: self.server.droplet.networks.v4[0].ip_address,
			port: self.server.ssh.port ? self.server.ssh.port : 22,
			username: self.server.ssh.username ? self.server.ssh.username : "root",
			privateKey: fs.readFileSync(self.server.ssh.keys.private)
		};
		var conn = new SFTP(),
			clear;
		conn.on("ready", function() {
			console.log("[STACK] SFTP connect");
			if (clear) {
				clearTimeout(clear);
			}
			conn.sftp(function(err, sftp) {
				if (err) {
					self.emit("error", err);
					reject(err);
				}
				_.each(dests, function(info) {
					funcs.push(function(callback) {
						if (typeof info === "string") {
							info = [info];
						}
						var dest = info[0];
						var answers = info[1] || {};
						answers = answers || {};
						var destArr = dest.split("/");
						var filename = destArr.pop();
						var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../stacks/" + self.server.type + "/templates/" + filename), "utf-8"));
						var compiled = template(answers);
						var output = sftp.createWriteStream(dest, {
							encoding: "utf8"
						});
						output.on("finish", function(err) {
							if (err) {
								self.emit("error", err);
								callback(err);
							} else {
								console.log("[STACK] SFTP upload: " + dest);
								callback(null);
							}
						});
						output.end(compiled);
					});
				});
				async.series(funcs, function(err) {
					if (err) {
						self.emit("error", err);
						reject(err);
					} else {
						conn.end();
					}
				});
			});
		});
		conn.on("end", function() {
			console.log("[STACK] SFTP disconnect");
			resolve();
		});
		var trys = 0;
		conn.on("error", function(err) {
			if (trys < 10 && err.level === "client-socket") {
				trys++;
				console.log("[STACK] SFTP timeout " + trys + "/10, retrying...");
				clear = setTimeout(function() {
					conn.connect(host);
				}, 10000);
			} else if (trys >= 10) {
				console.log("[STACK] SFTP timeout for good");
				reject(err);
			} else {
				self.emit("error", err);
				reject(err);
			}
		});
		conn.connect(host);
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
					if (!fs.existsSync(process.env.HOME + "/.ssh/config")) {
						fs.writeFileSync(process.env.HOME + "/.ssh/config", "");
					}
					var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../stacks/base/templates/config"), "utf-8"));
					var text = template({
						name: self.server.name,
						host: self.hostname() ? self.hostname() : self.server.name,
						ip: self.server.droplet ? self.server.droplet.networks.v4[0].ip_address : undefined,
						path: self.server.ssh.keys.private,
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
								var fl = false;
								lines.forEach(function(line) {
									if (line !== "\n") {
										fl = true;
									}
									if (fl) {
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
									}
								});
							}
							fs.writeFile(process.env.HOME + "/.ssh/config", output.replace(/\n{2,}/g, "\n\n"), function(err) {
								if (err) {
									cb(err);
								}
								cb(null, output);
							});
						});
				}
			],
			function(err, results) {
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
			async.series([
				function(cb) {
					console.log("lllll");

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
					console.log("lllll");

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
				console.log("lllll");

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
						console.log("lllll");
						console.log(body);
						if (err) {
							self.emit("error", err);
							reject(err);
						} else {
							if (body.ssh_key && body.ssh_key.id) {
								self.server.ssh.keys.id = body.ssh_key.id;
								console.log("hhhh");
								self.emit("keygen");
								resolve(body.ssh_key);
							} else {
								reject(new Error(body));
							}

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

Stack.prototype.keys = function() {
	var self = this;
	return {
		public: fs.readFileSync(self.server.ssh.keys.public, {
			encoding: "utf8"
		}),
		private: fs.readFileSync(self.server.ssh.keys.private, {
			encoding: "utf8"
		})
	};
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
				self.emit("create");
				resolve(body.droplet);
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
	console.log("RUN!");
	var self = this;
	if (typeof commands === "string") {
		commands = [commands];
	}
	return new Promise(function(resolve, reject) {
		console.log("---");
		var trys = 0,
			clear;

		function doIt() {
			var SSH = new SSH2Shell({
				idleTimeOut: 90000,
				server: {
					host: self.server.droplet.networks.v4[0].ip_address,
					port: self.server.ssh.port ? self.server.ssh.port + "" : "22",
					userName: self.server.ssh.username ? self.server.ssh.username : "root",
					privateKey: fs.readFileSync(self.server.ssh.keys.private)
				},
				//verbose: true,
				//debug: true,
				commands: commands,
				msg: {
					send: function(message) {
						//console.log("[STACK] " + message);
					}
				}
			});
			SSH.on("connect", function onConnect() {
				console.log("[STACK] shh connected to " + self.server.name);
				if (clear) {
					global.clearTimeout(clear);
				}
			});
			SSH.on("ready", function onReady() {
				console.log("[STACK] running " + commands.length + " commands");
			});
			SSH.on("commandTimeout", function onCommandTimeout(command, response, stream, connection) {
				console.log("[STACK] SSH timeout on: " + command);
				reject(new Error("timed out on: " + command));
			});
			SSH.on("end", function onEnd() {
				console.log("[STACK] SSH end");
				resolve();
			});
			SSH.on("close", function onClose(had_error) {
				console.log("[STACK] SSH close (" + had_error + ")");
			});
			SSH.on("error", function onError(err, type, close, callback) {
				console.log("[STACK] SSH error: " + type);
				if (clear) {
					global.clearTimeout(clear);
				}
				if (close && trys >= 10) {
					console.log("[STACK] SSH connect timed out with 10 retrys");
					reject(err);
				} else if (close && trys < 10) {
					trys++;
					console.log("[STACK] SSH connect timeout " + trys + "/10, retrying...");
					clear = global.setTimeout(function() {
						doIt();
					}, 10000);
				} else {
					console.log("[STACK] SSH error: " + type);
					reject(err);
				}
			});
			SSH.connect();
		}
		doIt();
	});
};

module.exports = Stack;
