var Stack = require("./lib/stack");
var Client = require("./lib/client");
var _ = require("lodash");
var xml2js = require("xml2js").parseString;
var util = require("util");

// var client = new Client();
// var stack = new Stack({
// 	name: "spencer.codes",
// 	namecheap: client.services.namecheap,
// 	digitalOcean: client.services.digitalOcean
// });
//
// stack.destroy();

var str = '<?xml version="1.0" encoding="utf-8"?>\
<ApiResponse Status="OK"\
    xmlns="http://api.namecheap.com/xml.response"> \
    <Errors />\
    <Warnings />\
    <RequestedCommand>namecheap.domains.dns.setHosts</RequestedCommand>\
    <CommandResponse Type="namecheap.domains.dns.setHosts">\
        <DomainDNSSetHostsResult Domain="spencer.codes" IsSuccess="true">\
            <Warnings>\
                <Warning Number="91">This domain is not currently setup to use Hosts Records.</Warning>\
            </Warnings>\
        </DomainDNSSetHostsResult>\
    </CommandResponse>\
    <Server>PHX01APIEXT01</Server>\
    <GMTTimeDifference>--4:00</GMTTimeDifference>\
    <ExecutionTime>0.181</ExecutionTime>\
</ApiResponse>';

var obj = xml2js(str, function(err, obj) {
	console.log(util.inspect(obj, {
		depth: 20
	}));
	console.log(_.has(obj, "ApiResponse.CommandResponse[0].DomainDNSSetHostsResult[0].Warnings"));
});
