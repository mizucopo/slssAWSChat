'use strict';

var AWS = require('aws-sdk');

module.exports.handler = function(event, context, cb) {

  // バケット毎のファイルサイズを取得
  var taskGetBucketsSize = function() {
    return new Promise(function(resolve, reject) {
      var s3 = new AWS.S3({});
      s3.listBuckets(function(err, data) {
        if (err) {
          return reject(new Error(err.message));
        }
        var cloudwatch = new AWS.CloudWatch({region: 'us-east-1'});
        var methods = [];
        data['Buckets'].sort(function(a, b) {
          if (a['Name'] < b['Name']) return -1;
          if (a['Name'] > b['Name']) return 1;
          return 0;
        });
        data['Buckets'].forEach(function(bucket) {
          methods.push(taskGetObjectsSize(cloudwatch, bucket));
        });
        Promise.all(methods).then(function(values) {
          return resolve(values);
        });
      });
    });
  };

  // バケットのファイルサイズを取得
  var taskGetObjectsSize = function(cloudwatch, bucket) {
    return new Promise(function(resolve, reject) {
      var startdate = new Date();
      var enddate   = new Date();
      startdate.setDate(startdate.getDate() - 1);

      var params = {
        MetricName: 'BucketSizeBytes',
        Namespace: 'AWS/S3',
        Period: 300,
        StartTime: startdate,
        EndTime: enddate,
        Statistics: ['Maximum'],
        Dimensions: [
          {
            "Name": "BucketName",
            "Value": bucket['Name']
          },
          {
            "Name": "StorageType",
            "Value": "StandardStorage"
          }
        ]
      };
      cloudwatch.getMetricStatistics(params, function(err, data) {
        if (err) {
          return reject(new Error(err.message));
        }
        var datapoints = data['Datapoints'];
        if (datapoints.length < 1) {
          return resolve({
            Bucket: bucket['Name'],
            Size:   0
          });
        }
        var latestData = datapoints[datapoints.length - 1];
        return resolve({
          Bucket: bucket['Name'],
          Size:   latestData['Maximum']
        });
      });
    });
  };

  // 投稿するメッセージを取得
  var getMessage = function(buckets) {
    var numberFormat = require('./number_format.js');

    var message = "";
    var objectsSize = 0;
    var megaSize = 1024 * 1024;

    buckets.forEach(function(bucket) {
      objectsSize  += bucket['Size'];

      message += ">*" + bucket['Bucket'] + "*:\n"
              +  ">Size: "  + numberFormat(Math.ceil(bucket['Size'] / megaSize)) + " MB\n\n";
    })

    message = "--------------------------------\n"
            + "*All Buckets*:\n"
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
        var endpoint = process.env.SLACK_ENDPOINT;
        var channel  = process.env.SLACK_CHANNEL;
        var message  = getMessage(buckets);
        taskPostMessage(endpoint, channel, message).then(
          function(result) {
            return cb(null, {
              "status": 200,
              "message": "succeed"
            });
          }
        );
      },
      function(err) {
        return cb(err, null);
      }
    );
  };

  main();
};
