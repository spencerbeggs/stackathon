"use strict";

module.exports = {
	name: "Docker",
	questions: require("../base").questions,
	build: function(stack, base) {
		return function() {
			var commands = [
				"export EDITOR=/usr/bin/nano",
				"mkdir -p /home/" + base.username + "/.ssh",
				"echo \"" + stack.publicKey.replace("\n", "") + "\" \> /home/" + base.username + "/.ssh/authorized_keys",
				"/usr/sbin/useradd " + base.username,
				"/usr/sbin/groupadd wheel",
				"echo \"" + base.username + ":" + base.password + "\" | chpasswd",
				"/usr/sbin/usermod -a -G wheel " + base.username,
				"/usr/sbin/usermod -a -G docker " + base.username,
				"chmod a+rx /home/" + base.username,
				"chown -R " + base.username + ":wheel /home/" + base.username,
				"chmod 700 /home/" + base.username + "/.ssh",
				"chmod 600 /home/" + base.username + "/.ssh/authorized_keys",
				"exit"
			];
			stack.run(commands).then(function() {
				console.info("Initialized");
				stack.sendFiles([
					"/etc/network/if-pre-up.d/iptables", ["/etc/iptables.up.rules", {
						port: base.port
					}],
					["/etc/ssh/sshd_config", {
						port: base.port,
						username: base.username
					}],
					"/home/" + base.username + "/sudoers.sh"
				]).then(function() {
					console.info("Uploads finished");
					stack.run([
						"chmod +x /home/" + base.username + "/sudoers.sh",
						"/home/" + base.username + "/sudoers.sh",
						"rm /home/" + base.username + "/sudoers.sh",
						"/sbin/iptables -F",
						"/sbin/iptables-restore < /etc/iptables.up.rules",
						"service docker restart",
						"service ssh reload",
						"exit"
					]).then(function() {
						console.info("Base stack configured");
						stack.server.ssh.username = base.username;
						stack.server.ssh.password = base.password;
						stack.server.ssh.port = base.port;
						stack.emit("done");
					}).catch(function(err) {
						stack.emit("error", err);
					});
				}).catch(function(err) {
					stack.emit("error", err);
				});
			}).catch(function(err) {
				stack.emit("error", err);
			});
		};
	}
};
