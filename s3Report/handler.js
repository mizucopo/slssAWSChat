'use strict';

var SLACK_CHANNEL  = "";
var SLACK_ENDPOINT = "";

var AWS = require('aws-sdk');
var URL = require('url');
var HTTPS = require('https');
var Promise = require('bluebird');

module.exports.handler = function(event, context) {

  // バケット毎のファイルサイズを取得
  var taskGetBucketsSize = function() {
    return new Promise(function(resolve, reject) {
      var s3 = new AWS.S3({});
      s3.listBuckets(function(err, data) {
        if (err) {
          reject(new Error(err.message));
          return ;
        }
        var methods = [];
        data['Buckets'].forEach(function(bucket) {
          methods.push(taskGetObjectsSize(s3, bucket));
        });
        Promise.all(methods).then(function(values) {
          resolve(values);
        });
      });
    });
  };

  // バケットのファイルサイズを取得
  var taskGetObjectsSize = function(s3, bucket) {
    return new Promise(function(resolve, reject) {
      var params = {
        Bucket: bucket['Name']
      };
      s3.listObjects(params, function(err, data) {
        if (err) {
          reject(new Error(err.message));
          return ;
        }
        var results = {
          Bucket: bucket['Name'],
          Count:  0,
          Size:   0,
        };
        data['Contents'].forEach(function(content) {
          results['Count']++;
          results['Size'] += content['Size'];
        });
        resolve(results);
      });
    });
  };

  // 投稿するメッセージを取得
  var getMessage = function(buckets) {
    var numberFormat = function(num) {
      return String(num).replace( /(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
    };

    var message = "";
    var objectsCount = 0;
    var objectsSize  = 0;
    var megaSize = 1024 * 1024;

    buckets.forEach(function(bucket) {
      objectsCount += bucket['Count'];
      objectsSize  += bucket['Size'];

      message += ">*" + bucket['Bucket'] + "*:\n"
              +  ">Count: " + numberFormat(bucket['Count']) + "\n"
              +  ">Size: "  + numberFormat(Math.ceil(bucket['Size'] / megaSize)) + " MB\n\n";
    })

    message = ">>>*All Buckets*:\n"
            + "Count: " + numberFormat(objectsCount) + "\n"
            + "Size: "  + numberFormat(Math.ceil(objectsSize / megaSize)) + " MB\n\n"
            + message;

    return message.trim();
  };

  // メッセージを投稿します
  var taskPostMessage = function(message) {
    return new Promise(function(resolve, reject) {
      var body = JSON.stringify({
        channel: SLACK_CHANNEL,
        text: message
      });
      var options = URL.parse(SLACK_ENDPOINT);
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
                resolve();
              } else {
                reject(new Error(body));
              }
          });
      });
      request.write(body);
      request.end();
    });
  };


  // メイン処理
  taskGetBucketsSize().then(
    function(buckets) {
      var message = getMessage(buckets);
      taskPostMessage(message).then(
        function(result) {
          return context.succeed({
            "status": 200,
            "message": "succeed"
          });
        },
        function(err) {
          return context.fail(err);
        }
      );
    },
    function(err) {
      return context.fail(err);
    }
  );
};
