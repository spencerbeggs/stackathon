"use strict";
var async = require("async");
var lib = require("./index");
var Client = require("ssh2").Client;

module.exports = function(answers) {

	return function(answers, callback) {
		var client = new Client();

		function comm(command) {
			return function(callback) {
				client.exec(command, {}, function(err, stream) {
					stream.on("close", function(code, signal) {
						callback(null);
					}).on("data", function(data) {
						//console.log("STDOUT: " + data);
					}).stderr.on("data", function(data) {
						console.log("STDERR: " + data);
					});
				});
			};
		}

		function connect() {
			client.connect({
				host: answers.ip,
				port: 22,
				username: "root",
				privateKey: new Buffer(answers.keys.private, "utf8")
			});
		}

		client.on("error", function(err) {
			connect();
		});

		client.on("ready", function() {
			console.log("connected to droplet");
			var funcs = [];
			[
				lib.sendFile("/etc/network/if-pre-up.d/iptables", answers, client),
				lib.sendFile("/etc/iptables.up.rules", answers, client),
				lib.sendFile("/etc/ssh/sshd_config", answers, client),
				"/usr/sbin/groupadd wheel",
				"export EDITOR=/usr/bin/nano",
				"/usr/sbin/useradd " + answers.adminUsername,
				"echo \"" + answers.adminUsername + ":" + answers.adminPassword + "\" | chpasswd",
				"/usr/sbin/usermod -a -G wheel " + answers.adminUsername,
				"mkdir /home/" + answers.adminUsername,
				"mkdir /home/" + answers.adminUsername + "/.ssh",
				"mkdir /home/" + answers.adminUsername + "/sites",
				"mkdir -p /home/" + answers.adminUsername + "/sites/" + answers.domain + "/{public,private,log,cgi-bin,backup}",
				"chmod -R a+rX /home/" + answers.adminUsername + "/sites/",
				"chmod a+rx /home/" + answers.adminUsername,
				"chown -R " + answers.adminUsername + ":" + answers.adminUsername + " ~" + answers.adminUsername + "/.ssh",
				"echo \"" + answers.keys.public + "\" > /home/" + answers.adminUsername + "/.ssh/authorized_keys",
				"chmod 700 /home/" + answers.adminUsername + "/.ssh",
				"chmod 600 /home/" + answers.adminUsername + "/.ssh/authorized_keys",
				"chown -R " + answers.adminUsername + ":" + answers.adminUsername + " /home/" + answers.adminUsername + "/.ssh",
				"chown " + answers.adminUsername + ":" + answers.adminUsername + " /home/" + answers.adminUsername + "/.ssh/authorized_keys",
				lib.sendFile("/home/" + answers.adminUsername + "/sites/" + answers.domain + "/public/.htaccess", answers, client),
				"chown " + answers.adminUsername + ":wheel /home/" + answers.adminUsername + "/sites/" + answers.domain + "/public/.htaccess",
				"/sbin/iptables -F",
				"/sbin/iptables-restore < /etc/iptables.up.rules",
				"aptitude update",
				"aptitude upgrade -y",
				"export DEBIAN_FRONTEND='noninteractive'",
				"debconf-set-selections <<< 'mysql-server-5.5 mysql-server/root_password password " + answers.sqlRootPassword + "'",
				"debconf-set-selections <<< 'mysql-server-5.5 mysql-server/root_password_again " + answers.sqlRootPassword + "'",
				"DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential apache2 postfix mysql-server-5.5 mysql-client-5.5 php5 php5-mysql php5-curl php5-gd php5-imagick php5-mcrypt php5-json php5-tidy php-pear php5-memcache php5-mhash php5-pspell php5-snmp php5-sqlite php5-xmlrpc php5-xsl subversion libapache2-svn",
				"pear install apc",
				lib.sendFile("/etc/php5/apache2/conf.d/apc.ini", answers, client),
				"mysql -uroot -e \"CREATE DATABASE " + answers.sqlDb + "\"",
				"mysql -uroot -e \"GRANT ALL PRIVILEGES ON " + answers.sqlDb + ".* TO \"" + answers.sqlAdminUsername + "\"@\"localhost\" IDENTIFIED BY \"" + answers.sqlAdminPassword + "\"",
				"mysql -uroot -e \"FLUSH PRIVILEGES\"",
				"svn co http://core.svn.wordpress.org/tags/4.1.0 /home/" + answers.adminUsername + "/sites/" + answers.domain + "/public",
				lib.makeFile("/etc/apache2/sites-available/" + answers.domain + ".conf", "vhost", {
					domain: answers.domain,
					adminUsername: answers.adminUsername,
					adminEmail: answers.adminEmail
				}, client),
				lib.makeFile("/etc/apache2/httpd.conf", "httpd.conf", {
					adminUsername: answers.adminUsername
				}, client),
				lib.makeFile("/etc/apache2/apache2.conf", "apache2.conf", {
					domain: answers.domain,
					adminUsername: answers.adminUsername
				}, client),
				"a2ensite " + answers.domain,
				"a2dissite default",
				"a2enmod rewrite deflate expires",
				"service ssh reload",
				"service apache2 graceful"
			].forEach(function(command) {
				if (typeof command === "string") {
					funcs.push(comm(command));
				}
				else {
					funcs.push(command);
				}

			});
			async.series(funcs, function(err, results) {
				if (err) {
					return console.log(err);
				}
				return callback(null, answers);
			});
		});

		connect();
	};
};
