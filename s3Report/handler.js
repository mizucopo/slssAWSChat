'use strict';

var SLACK_CHANNEL  = "";
var SLACK_ENDPOINT = "";

var AWS = require('aws-sdk');
var Promise = require('bluebird');

module.exports.handler = function(event, context) {

  // バケット毎のファイルサイズを取得
  var taskGetBucketsSize = function() {
    return new Promise(function(resolve, reject) {
      var s3 = new AWS.S3({});
      s3.listBuckets(function(err, data) {
        if (err) {
          return reject(new Error(err.message));
        }
        var methods = [];
        data['Buckets'].forEach(function(bucket) {
          methods.push(taskGetObjectsSize(s3, bucket));
        });
        Promise.all(methods).then(function(values) {
          return resolve(values);
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
          return reject(new Error(err.message));
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
        return resolve(results);
      });
    });
  };

  // 投稿するメッセージを取得
  var getMessage = function(buckets) {
    var numberFormat = require('./number_format.js');

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
  var taskPostMessage = require('./slack.js');


  // メイン処理
  var main = function() {
    taskGetBucketsSize().then(
      function(buckets) {
        var endpoint = SLACK_ENDPOINT;
        var channel  = SLACK_CHANNEL;
        var message  = getMessage(buckets);
        taskPostMessage(endpoint, channel, message).then(
          function(result) {
            return context.succeed({
              "status": 200,
              "message": "succeed"
            });
          }
        );
      },
      function(err) {
        return context.fail(err);
      }
    );
  };

  main();
};
