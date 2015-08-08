"use strict";
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var request = require("request");
var Client = require("ssh2").Client;
var _ = require("lodash");
var keygen = require("ssh-keygen");
var async = require("async");
var fs = require("fs");
var Handlebars = require("handlebars");
var path = require("path");
var SSH2Shell = require("ssh2shell");
var SFTP = require("ssh2").Client;
var xml2js = require("xml2js").parseString;
var psl = require("psl");

class Stack extends EventEmitter {
	constructor(options) {
		super();
		var self = this;
		this.userData = options.userData || null;
		this.server = {};
		this.server.name = null;
		this.server.domain = null;
		this.server.subdomain = null;
		this.server.ssh = {
			username: "root",
			password: null,
			port: "22",
			keys: {
				public: null,
				private: null,
				id: null
			}
		};
		this.server.type = "base";
		this.server.droplet = null;
		EventEmitter.call(this);
		this.saveIt = function() {
			self.save();
		};
		this.digitalOcean = options.digitalOcean ? options.digitalOcean : {};
		this.namecheap = options.namecheap ? options.namecheap : {};
		_.merge(this.server, options);
		this.on("load", function() {
			console.info(self.server.name + " loaded from disk");
		});
		this.on("refresh", function() {
			console.info("Droplet refreshed");
		});
		this.on("create", function() {
			console.info("Created: " + self.server.name);
		});
		this.on("ready", function() {
			console.info("Ready!");
		});
		this.on("save", function() {
			console.info("Saved");
		});
		this.on("keygen", function() {
			console.info("Keys generated");
		});
		this.on("unkeygen", function() {
			console.info("Keys deleted");
		});
		this.on("destroy", function() {
			console.info("Destroyed: " + self.server.name);
		});
		this.on("error", function(err) {
			console.log(util.inspect(err, {
				depth: 15
			}));
		});
		this.once("ready", function() {
			Object.observe(self.server, self.saveIt);
			Object.observe(self.server.ssh, self.saveIt);
			Object.observe(self.server.ssh.keys, self.saveIt);
		});
		this.api = request.defaults({
			json: true,
			headers: {
				"Authorization": "Bearer " + self.digitalOcean.key
			}
		});
		if (this.load()) {
			if (!this.droplet || !this.droplet.networks) {
				this.poll().then(function() {
					self.emit("ready");
				}).catch(function(err) {
					self.emit("error", err);
				});
			} else {
				this.refresh().then(function() {
					self.emit("ready");
				}).catch(function(err) {
					self.emit("error", err);
				});
			}
		} else {
			this.once("keygen", this.build);
			this.once("create", this.poll);
			this.once("ready", this.setDNS);
			this.once("done", this.report);
			this.keygen();
		}
	}
	get hostname() {
		var hostname = "";
		if (this.server.domain) {
			if (this.server.subdomain) {
				hostname += this.server.subdomain + ".";
			}
			hostname += this.server.domain;
		}
		return hostname;
	}
	get ip() {
		if (_.has(this, "server.droplet.networks.v4[0].ip_address")) {
			return this.server.droplet.networks.v4[0].ip_address;
		} else {
			return "";
		}
	}
	get privateKey() {
		try {
			var key = fs.readFileSync(this.server.ssh.keys.private);
			return key.toString();
		} catch (err) {
			this.emit("error", new Error("couldn't read private key"));
			return "";
		}

	}
	get publicKey() {
		try {
			var key = fs.readFileSync(this.server.ssh.keys.public);
			return key.toString();
		} catch (err) {
			this.emit("error", new Error("couldn't read public key"));
			return "";
		}

	}
	get config() {
		if (!fs.existsSync(process.env.HOME + "/.stackathon")) {
			fs.writeFileSync(process.env.HOME + "/.stackathon", "{}");
		}
		var file = fs.readFileSync(process.env.HOME + "/.stackathon", {
			encoding: "utf8"
		});
		return JSON.parse(file);
	}
	load(name) {
		var stacks = this.config.stacks;
		if (stacks[this.server.name]) {
			_.merge(this.server, stacks[this.server.name]);
			this.emit("loaded");
			return true;
		} else {
			return false;
		}
	}
	destroy() {
		var self = this;
		return new Promise(function(resolve, reject) {
			Object.unobserve(self.server, self.saveIt);
			Object.unobserve(self.server.ssh, self.saveIt);
			Object.unobserve(self.server.ssh.keys, self.saveIt);
			async.series([
					function(cb) {
						self.api.del({
							url: "https://api.digitalocean.com/v2/droplets/" + self.server.droplet.id
						}, function(err, res, body) {
							if (err) {
								console.info("couldn't delete droplet " + self.server.droplet.id + " from Digital Ocean");
								cb(err);
							} else {
								console.info("deleted droplet " + self.server.droplet.id + " from Digital Ocean");
								cb(null);
							}
						});
					},
					function(cb) {
						self.api.del({
							url: "https://api.digitalocean.com/v2/account/keys/" + self.server.ssh.keys.id
						}, function(err, res, body) {
							if (err) {
								console.info("couldn't delete SSH public key " + self.server.ssh.keys.id + " from Digital Ocean");
								cb(err);
							} else {
								console.info("deleted SSH public key " + self.server.ssh.keys.id + " from Digital Ocean");
								cb(null);
							}
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
									console.info("couldn't read file " + process.env.HOME + "/.ssh/known_hosts");
									cb(err);
								}
								var output = "";
								var lines = configText.split("\n");
								lines.forEach(function(line) {
									if (self.ip && line.indexOf(self.ip) === -1) {
										output += line + "\n";
									}
								});
								fs.writeFile(process.env.HOME + "/.ssh/known_hosts", output, function(err) {
									if (err) {
										console.info("couldn't remove host entry for " + self.ip + " from " + process.env.HOME + "/known_hosts");
										cb(err);
									}
									console.info("removed host entry for " + self.ip + " from " + process.env.HOME + "/known_hosts");
									cb(null);
								});
							});
					},
					function(cb) {
						fs.unlink(self.server.ssh.keys.public, function(err) {
							if (err) {
								console.info("couldn't delete SSH public key " + self.server.ssh.keys.public);
								cb(err);
							} else {
								console.info("deleted SSH public key " + self.server.ssh.keys.public);
								cb(null);
							}
						});
					},
					function(cb) {
						fs.unlink(self.server.ssh.keys.private, function(err) {
							if (err) {
								console.info("couldn't delete SSH private key " + self.server.ssh.keys.private);
								cb(err);
							} else {
								console.info("deleted SSH private key " + self.server.ssh.keys.private);
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
									console.info("couldn't read file " + process.env.HOME + "/.ssh/config");
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
										console.info("couldn't remove " + self.server.name + " entry from " + process.env.HOME + "/.ssh/config");
										cb(err);
									}
									console.info("removed " + self.server.name + " entry from " + process.env.HOME + "/.ssh/config");
									cb(null, output);
								});
							});
					},
					function(cb) {
						var config = self.config;
						delete config.stacks[self.server.name];
						try {
							fs.writeFileSync(process.env.HOME + "/.stackathon", JSON.stringify(config, null, "\t"));
							console.info("deleted " + self.server.name + " stack info from ~/.stackathon");
							cb(null);
						} catch (err) {
							console.info("couldn't delete " + self.server.name + "  stack info from ~/.stackathon");
							cb(err);
						}
					}
				],
				function(err, results) {
					if (err) {
						reject(err);
					} else {
						self.emit("destroy");
						resolve();
					}
				});
		});
	}
	sendFiles(dests) {
		var self = this;
		if (typeof dests === "string") {
			dests = [dests];
		}
		return new Promise(function(resolve, reject) {
			var funcs = [];
			var host = {
				host: self.ip,
				port: Number(self.server.ssh.port),
				username: self.server.ssh.username,
				privateKey: self.privateKey
			};
			var conn = new SFTP(),
				clear;
			conn.on("ready", function() {
				console.info("SFTP connect");
				if (clear) {
					clearTimeout(clear);
				}
				conn.sftp(function(err, sftp) {
					if (err) {
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
							var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../stacks/" + self.server.slug + "/templates/" + filename), "utf-8"));
							var compiled = template(answers);
							var output = sftp.createWriteStream(dest, {
								encoding: "utf8"
							});
							output.on("finish", function(err) {
								if (err) {
									callback(err);
								} else {
									console.info("SFTP upload: " + dest);
									callback(null);
								}
							});
							output.end(compiled);
						});
					});
					async.series(funcs, function(err) {
						if (err) {
							reject(err);
						} else {
							conn.end();
						}
					});
				});
			});
			conn.on("end", function() {
				console.info("SFTP disconnect");
				resolve();
			});
			var trys = 0;
			conn.on("error", function(err) {
				if (trys < 10 && err.level === "client-socket") {
					trys++;
					console.info("SFTP timeout " + trys + "/10, retrying...");
					clear = setTimeout(function() {
						conn.connect(host);
					}, 10000);
				} else if (trys >= 10) {
					console.info("SFTP timeout for good");
					reject(err);
				} else {
					reject(err);
				}
			});
			conn.connect(host);
		});
	}
	save() {
		var self = this;
		var config = this.config;
		async.series([
				function(cb) {
					config.stacks[self.server.name] = self.server;
					delete config.stacks[self.server.name].digitalOcean;
					delete config.stacks[self.server.name].namecheap;
					try {
						fs.writeFileSync(process.env.HOME + "/.stackathon", JSON.stringify(config, null, "\t"));
						cb(null);
					} catch (err) {
						cb(err);
					}
				},
				function(cb) {
					if (!fs.existsSync(process.env.HOME + "/.ssh/config")) {
						fs.writeFileSync(process.env.HOME + "/.ssh/config", "");
					}
					var template = Handlebars.compile(fs.readFileSync(path.resolve(__dirname + "/../stacks/base/templates/config"), "utf-8"));
					var text = template({
						name: self.server.name,
						host: self.hostname,
						ip: self.ip,
						path: self.server.ssh.keys.private,
						port: self.server.ssh.port,
						username: self.server.ssh.username
					});
					var configText;
					try {
						configText = fs.readFileSync(process.env.HOME + "/.ssh/config", {
							encoding: "utf8"
						});
					} catch (err) {
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
					try {
						fs.writeFileSync(process.env.HOME + "/.ssh/config", output.replace(/\n{2,}/g, "\n\n"));
						cb(null, output);
					} catch (err) {
						cb(err);
					}
				}
			],
			function(err, results) {
				if (err) {
					self.emit("error", err);
				} else {
					self.emit("save");
				}
			});
	}
	keygen() {
		var self = this;
		return new Promise(function(resolve, reject) {
			var keyname;
			if (self.hostname) {
				keyname = self.hostname;
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
						self.api.post({
							url: "https://api.digitalocean.com/v2/account/keys",
							body: {
								name: self.server.name,
								public_key: self.publicKey
							}
						}, function(err, res, body) {
							if (err) {
								self.emit("error", err);
								reject(err);
							} else {
								if (body.ssh_key && body.ssh_key.id) {
									self.server.ssh.keys.id = body.ssh_key.id;
									self.emit("keygen");
									resolve(body.ssh_key);
								} else {
									reject(new Error("No body"));
								}
							}
						});
					}
				});
			});
		});
	}
	build() {
		var self = this;
		return new Promise(function(resolve, reject) {
			self.api.post({
				url: "https://api.digitalocean.com/v2/droplets",
				body: {
					"name": self.server.name,
					"region": "nyc3",
					"size": "1gb",
					"image": self.server.image,
					"ssh_keys": [self.server.ssh.keys.id],
					"backups": false,
					"ipv6": true,
					"user_data": self.userData,
					"private_networking": self.privateNetworking || null
				}
			}, function(err, res, body) {
				if (err) {
					self.emit("error", err);
					reject(err);
				} else {
					if (body.droplet) {
						self.server.droplet = body.droplet;
						self.emit("create");
						resolve();
					} else {
						reject(new Error(body));
					}
				}
			});
		});
	}
	poll() {
		var self = this;
		return new Promise(function(resolve, reject) {
			var waiting = true;
			var tries = 0;
			async.whilst(
				function() {
					return waiting === true;
				},
				function(callback) {
					tries++;
					self.api.get({
						url: "https://api.digitalocean.com/v2/droplets/" + self.server.droplet.id
					}, function(err, res, body) {
						if (body.droplet && body.droplet.status === "active") {
							self.server.droplet = body.droplet;
							waiting = false;
							callback(null);
						} else if (body.droplet && body.droplet.status === "new") {
							console.log("polling " + tries + "\\10");
							setTimeout(callback, 20000);
						} else if (body.id === "not_found") {
							callback(null);
						} else {
							console.log(body);
							callback(new Error(body));
						}
					});
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
	}
	refresh() {
		var self = this;
		return new Promise(function(resolve, reject) {
			if (!self.server.droplet || !self.server.droplet.id) {
				reject(new Error("No droplet"));
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
	}
	unkeygen() {
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
	}
	run(commands) {
		var self = this;
		if (typeof commands === "string") {
			commands = [commands];
		}
		return new Promise(function(resolve, reject) {
			var trys = 0,
				clear;

			function doIt() {
				var SSH = new SSH2Shell({
					idleTimeOut: 90000,
					server: {
						host: self.ip,
						port: self.server.ssh.port,
						userName: self.server.ssh.username,
						privateKey: self.privateKey
					},
					//verbose: true,
					//debug: true,
					commands: commands,
					msg: {
						send: function(message) {
							//console.log("" + message);
						}
					}
				});
				SSH.on("connect", function onConnect() {
					console.info("shh connected to " + self.server.name);
					if (clear) {
						global.clearTimeout(clear);
					}
				});
				SSH.on("ready", function onReady() {
					console.info("running " + commands.length + " commands");
				});
				SSH.on("commandTimeout", function onCommandTimeout(command, response, stream, connection) {
					console.info("SSH timeout on: " + command);
					reject(new Error("timed out on: " + command));
				});
				SSH.on("end", function onEnd() {
					console.info("SSH commands end");
					resolve();
				});
				SSH.on("close", function onClose(had_error) {
					var errString = had_error ? "d with error: " + had_error : "";
					console.info("SSH close" + errString);
				});
				SSH.on("error", function onError(err, type, close, callback) {
					console.info("SSH error: " + type);
					if (clear) {
						global.clearTimeout(clear);
					}
					if (close && trys >= 10) {
						console.info("SSH connect timed out with 10 retrys");
						reject(err);
					} else if (close && trys < 10) {
						trys++;
						console.info("SSH connect timeout " + trys + "/10, retrying...");
						clear = global.setTimeout(function() {
							doIt();
						}, 10000);
					} else {
						console.info("SSH error: " + type);
						reject(err);
					}
				});
				SSH.connect();
			}
			doIt();
		});
	}
	setDNS() {
		var self = this;
		return new Promise(function(resolve, reject) {
			var parsed = psl.parse(self.hostname);
			request.get({
					url: "https://api.namecheap.com/xml.response",
					qs: {
						ApiUser: self.namecheap.username,
						ApiKey: self.namecheap.key,
						UserName: self.namecheap.username,
						ClientIp: self.namecheap.ip,
						Command: "namecheap.domains.dns.setHosts",
						TLD: parsed.tld,
						SLD: parsed.sld,
						HostName1: "@",
						RecordType1: "A",
						Address1: self.ip,
						TTL1: "100"
					}
				},
				function(err, res, data) {
					xml2js(data, function(err, result) {
						util.inspect(result, {
							depth: 20
						});
						if (result.ApiResponse.$.Status === "ERROR") {
							reject(new Error({
								message: "NAMECHEAP: " + result.ApiResponse.Errors[0].Error[0]._
							}));
						} else {
							self.emit("dnsSet");
						}
						if (_.has(result, "ApiResponse.CommandResponse[0].DomainDNSSetHostsResult[0].Warnings")) {
							var warnings = [];
							_.each(result.ApiResponse.CommandResponse[0].DomainDNSSetHostsResult.Warnings, function(item) {
								warnings.push(item[0]._);
							});
							if (warnings.indexOf("This domain is not currently setup to use Hosts Records.") !== 0) {
								console.info("You can't set DNS on domains that are not controlled by Namecheap's NS");
							}
						}
						resolve();
					});
				});
		});

	}
	report() {
		var self = this;
		console.log(self.server.name + " has been setup successfully.");
		console.log("--- SAVE THIS INFO ---");
		console.log("    hostname: " + self.hostname);
		console.log("    IP: " + self.ip);
		console.log("    ssh port: " + self.server.ssh.port);
		console.log("    admin username: " + self.server.ssh.username);
		console.log("    admin password: " + self.server.ssh.password);
		console.log("    private key: " + self.server.ssh.keys.private);
		console.log("    public key: " + self.server.ssh.keys.public);
		console.log("    Digital Ocean key ID: " + self.server.ssh.keys.id);
		console.log("--- SAVE THIS INFO ---\n");
		console.log("   To access your stack via ssh, type: " + "ssh ".green + self.server.name.green + "\n");
		console.log("Happy hacking!".rainbow);
	}
}

module.exports = Stack;
