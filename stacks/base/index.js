"use strict";

module.exports = {
	domain: require("./domain"),
	ssh: require("./ssh"),
};

module.exports.docker = module.exports.domain.concat(module.exports.ssh);
module.exports.coreos = module.exports.domain;
