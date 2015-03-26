"use strict";
var request = require("request");
var _ = require("lodash");
var xml2js = require("xml2js").parseString;
var nconf = require("nconf");

module.exports = function(answers) {
	return function(answers, callback) {
		nconf.file(process.env.HOME + "/.stackathon");
		var url = "https://api.namecheap.com/xml.response?ApiUser=" + nconf.get("namecheap:username") + "&ApiKey=" + nconf.get("namecheap:apiKey") + "&UserName=" + nconf.get("namecheap:username") + "&ClientIp=192.168.1.10&Command=namecheap.domains.getList";
		request.get(url, function(err, res, data) {
			xml2js(data, function(err, result) {
				if (result.ApiResponse.$.Status === "ERROR") {
					if (result.ApiResponse.Errors[0].Error[0]._.indexOf("Invalid request IP") !== -1) {
						console.log("\n   The IP address you are using is not whitelisted in you Namecheap profile.");
						console.log("   Visit: https://manage.www.namecheap.com/myaccount/modify-profile-api.asp");
						console.log("   And add the following IP to the whitelist: " + answers.ip);
						console.log("   Then try again.");
						process.exit();
					}
				}
				var domains = result.ApiResponse.CommandResponse[0].DomainGetListResult[0].Domain;
				answers.domains = [];
				_.each(domains, function(domain) {
					answers.domains.push(domain.$);
				});
				return callback(null, answers);
			});
		});
	};
};
