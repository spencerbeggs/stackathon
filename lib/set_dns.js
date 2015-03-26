"use strict";
var request = require("request");
var _ = require("lodash");
var xml2js = require("xml2js").parseString;
var nconf = require("nconf");

module.exports = function(answers) {
	return function(answers, callback) {
		nconf.file(process.env.HOME + "/.stackathon");
		var domainArr = answers.domain.Name.split(".");
		request.get({
				url: "https://api.namecheap.com/xml.response",
				qs: {
					ApiUser: nconf.get("namecheap:username"),
					ApiKey: nconf.get("namecheap:apiKey"),
					UserName: nconf.get("namecheap:username"),
					ClientIp: nconf.get("ip"),
					Command: "namecheap.domains.dns.setHosts",
					TLD: domainArr[domainArr.length - 1],
					SLD: domainArr[domainArr.length - 2],
					HostName1: "@",
					RecordType1: "A",
					Address1: answers.droplet.networks.v4[0].ip_address,
					TTL1: "100"
				}
			},
			function(err, res, data) {
				xml2js(data, function(err, result) {
					if (result.ApiResponse.$.Status === "ERROR") {
						console.log(result.ApiResponse.Errors[0].Error[0]._);
						throw new Error({
							message: "NAMECHEAP: " + result.ApiResponse.Errors[0].Error[0]._
						});
					}
					return callback(null, answers);
				});
			});
	};
};
