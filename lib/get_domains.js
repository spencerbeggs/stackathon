"use strict";
var request = require("request");
var _ = require("lodash");
var xml2js = require("xml2js").parseString;

module.exports = function(answers) {
	return function(callback) {
		request.get("https://api.namecheap.com/xml.response?ApiUser=" + answers.namecheapUsername + "&ApiKey=" + answers.namecheapApiKey + "&UserName=" + answers.namecheapUsername + "&ClientIp=192.168.1.10&Command=namecheap.domains.getList", function(err, res, data) {
			xml2js(data, function(err, result) {
				console.log(result);
				var domains = result.ApiResponse.CommandResponse[0].DomainGetListResult[0].Domain;
				answers.domains = [];
				_.each(domains, function(domain) {
					answers.domains.push(domain.$);
				});
				callback(null, answers);
			});
		});
	};
};
