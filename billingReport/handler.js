'use strict';

var AWS = require('aws-sdk');
var Promise = require('bluebird');

module.exports.handler = function(event, context) {

  // 全体の金額を取得
  var taskGetAllBilling = function(cloudwatch, enddate) {
    return new Promise(function(resolve, reject) {
      return resolve(taskGetEstimatedCharges(cloudwatch, enddate));
    });
  };

  // サービス毎の金額を取得
  var taskGetServiceBilling = function(cloudwatch, enddate) {
    return new Promise(function(resolve, reject) {
      taskGetServices(cloudwatch).then(function(services) {
        var methods = [];
        services.forEach(function(service) {
          methods.push(taskGetEstimatedCharges(cloudwatch, enddate, service));
        });
        Promise.all(methods).then(function(values) {
          return resolve(values);
        });
      });
    });
  };

  // サービスの金額を取得
  var taskGetServices = function(cloudwatch) {
    return new Promise(function(resolve, reject) {
      var params = {
        Namespace: 'AWS/Billing',
        Dimensions: [
          {
            Name: 'Currency',
            Value: 'USD'
          }
        ]
      };
      cloudwatch.listMetrics(params, function(err, data) {
        if (err) {
          return reject(new Error(err.message));
        }
        var services = [];
        data['Metrics'].forEach(function(metric) {
          metric['Dimensions'].forEach(function(dimension) {
            if (dimension['Name'] == 'ServiceName') {
              services.push(dimension['Value']);
            }
          });
        });
        services.sort();
        return resolve(services);
      });
    });
  };

  // EstimatedCharges の取得
  var taskGetEstimatedCharges = function(cloudwatch, enddate, service) {
    return new Promise(function(resolve, reject) {
      var startdate = new Date(enddate);
      startdate.setDate(startdate.getDate() - 1);

      var params = {
        MetricName: 'EstimatedCharges',
        Namespace: 'AWS/Billing',
        Period: 86400,
        StartTime: startdate,
        EndTime: enddate,
        Statistics: ['Maximum'],
        Dimensions: [
          {
            Name: 'Currency',
            Value: 'USD'
          }
        ]
      };
      if (service !== undefined) {
        params['Dimensions'].push({
          Name: 'ServiceName',
          Value: service
        });
      }

      cloudwatch.getMetricStatistics(params, function(err, data) {
        if (err) {
          return reject(new Error(err.message));
        }
        var datapoints = data['Datapoints'];
        if (datapoints.length < 1) {
          return resolve({
            Service: service,
            Value: 0
          });
        }
        var latestData = datapoints[datapoints.length - 1];
        return resolve({
          Service: service,
          Value: latestData['Maximum']
        });
      });
    });
  };

  // 投稿するメッセージを取得
  var getMessage = function(values) {
    var numberFormat = require('./number_format.js');
    var message = ">>>*Billing*: $" + numberFormat(values[0]['Value']) + "\n\n";
    values[1].forEach(function(service) {
      message += ">*" + service['Service'] + "*: $" + numberFormat(service['Value']) + "\n\n";
    })

    return message.trim();
  };

  var taskPostMessage = require('./slack.js');


  // メイン処理
  var main = function() {
    var cloudwatch = new AWS.CloudWatch({region: 'us-east-1'});
    var enddate    = new Date();

    var methods = [
      taskGetAllBilling(cloudwatch, enddate),
      taskGetServiceBilling(cloudwatch, enddate)
    ];
    Promise.all(methods).then(
      function(values) {
        var endpoint = process.env.SLACK_ENDPOINT;
        var channel  = process.env.SLACK_CHANNEL;
        var message  = getMessage(values);
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
