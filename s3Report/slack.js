// Slackにメッセージを投稿します
module.exports = function(endpoint, channel, message) {
  var Promise = require('bluebird');

  return new Promise(function(resolve, reject) {
    var URL = require('url');
    var HTTPS = require('https');

    var body = JSON.stringify({
      channel: channel,
      text: message
    });
    var options = URL.parse(endpoint);
    options.method = 'POST';
    options.headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    var request = HTTPS.request(options, function(response) {
        var chunks = [];
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
          chunks.push(chunk);
        });
        response.on('end', function() {
            var body = chunks.join('');
            if (response.statusCode < 400) {
              return resolve();
            } else {
              return reject(new Error(body));
            }
        });
    });
    request.write(body);
    request.end();
  });
};
