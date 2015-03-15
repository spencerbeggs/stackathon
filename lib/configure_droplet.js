"use strict";
var async = require("async");
var lib = require("./index");
var SSH2Shell = require("ssh2shell");

module.exports = function(answers, root) {
	return function(answers, callback) {
		async.series([
			lib.sendFile("/etc/network/if-pre-up.d/iptables", answers),
			lib.sendFile("/etc/iptables.up.rules", answers),
			lib.sendFile("/etc/ssh/sshd_config", answers),
		], function(err, results) {
			if (err) {
				return console.log(err);
			}
			//Create a new instance
			var SSH = new SSH2Shell({
				idleTimeOut: 15000,
				server: {
					host: answers.ip,
					port: "22",
					userName: "root",
					privateKey: new Buffer(answers.keys.private, "utf8")
				},
				commands: [
					"/usr/sbin/groupadd wheel",
					"export EDITOR=/usr/bin/nano",
					"/usr/sbin/useradd " + answers.adminUsername,
					"echo \"foobar:" + answers.adminUsername + "\" | chpasswd",
					"/usr/sbin/usermod -a -G wheel " + answers.adminUsername,
					"mkdir /home/" + answers.adminUsername,
					"mkdir /home/" + answers.adminUsername + "/.ssh",
					"mkdir /home/" + answers.adminUsername + "/sites",
					"mkdir -p /home/" + answers.adminUsername + "/sites/" + answers.domain + "/{public,private,log,cgi-bin,backup}",
					"chown -R " + answers.adminUsername + ":" + answers.adminUsername + " ~" + answers.adminUsername + "/.ssh",
					"cat \"" + answers.keys.public + "\" > /home/" + answers.adminUsername + "/.ssh/authorized_keys",
					"chmod 700 /home/" + answers.adminUsername + "/.ssh",
					"chmod 600 /home/" + answers.adminUsername + "/.ssh/authorized_keys",
					"chmod 0644 /home/" + answers.adminUsername + "/.ssh/authorized_keys",
					"chown " + answers.adminUsername + ":" + answers.adminUsername + " /home/" + answers.adminUsername + "/.ssh/authorized_keys",
					"chown " + answers.adminUsername + ":wheel /home/" + answers.adminUsername + "/sites/" + answers.domain + "/public/.htaccess",
					"/sbin/iptables-restore < /etc/iptables.up.rules",
					"aptitude update",
					"aptitude upgrade -y",
					"aptitude install build-essential apache2 postfix php5 php5-mysql php5-dev php5-curl php5-gd php5-imagick php5-mcrypt php5-json php5-tidy php-pear php5-memcache php5-mhash php5-pspell php5-snmp php5-sqlite php5-xmlrpc php5-xsl subversion libapache2-svncd mysql-server mysql-client libmysqlclient15-dev -y",
					"svn co http://core.svn.wordpress.org/tags/4.1.0 /home/" + answers.adminUsername + "/sites/" + answers.domain + "/public",
					"/usr/sbin/a2dissite default"
				],
				msg: {
					send: function(message) {
						console.log(message);
					}
				},
				onCommandProcessing: function(command, response, sshObj, stream) {
					//console.log("issued: " + command);
				},
				onCommandComplete: function(command, response, sshObj) {
					console.log("issued: " + command);
				},
				onCommandTimeout: function(command, response, sshObj, stream, connection) {
					console.log("COMMAND TIMED OUT:" + command);
				},
				onEnd: function(sessionText, sshObj) {
					async.series([
						lib.sendFile("/etc/php5/apache2/conf.d/apc.ini", answers),
						lib.sendFile("/home/" + answers.adminUsername + "/sites/" + answers.domain + "/public/.htaccess", answers),
					], function() {
						callback(null, answers);
					});

				}
			});
			//Start the process
			SSH.connect();
		});
	};
};
