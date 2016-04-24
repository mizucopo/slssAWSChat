# slssAWSChat

Serverless Framework を使用したAWSの使用状況をSlackへ投稿するシステム

## overview

現在は下記サービスの使用状況を投稿します

- S3
    - 全体の総ファイルサイズ
    - バケット毎の総ファイルサイズ  
- Billing
    - 全体の課金額
    - サービスごとの課金額

## screen shot

### S3 Report

![S3 Report](https://raw.githubusercontent.com/wiki/mizucopo/slssAWSChat/images/slack_s3.jpg)

### Billing Report

![Billing Report](https://raw.githubusercontent.com/wiki/mizucopo/slssAWSChat/images/slack_billing.jpg)

## install

```
$ git clone git@github.com:mizucopo/slssAWSChat.git
$ cd ./slssAWSChat
$ npm install
$ cd ./s3Report
$ npm install
$ cd ..
$ cd ./billingReport
$ npm install
$ cd ..
```

## settings

[Slack App Directory](https://slack.com/apps) の Incoming WebHooks を追加する。
追加後、WebHook URL を控える。

ファイルの ```./s3Report/s-function.json``` と ```./billingReport/s-function.json``` を開き、
```environment``` にある ```SLACK_CHANNEL``` と ```SLACK_ENDPOINT``` を変更する。

- SLACK_CHANNEL
    - チャンネル名記載。#は必須
- SLACK_ENDPOINT
    - WebHook URL を記載

### example

      "environment": {
        "SERVERLESS_PROJECT": "slssAWSChat",
        "SERVERLESS_STAGE": "${stage}",
        "SERVERLESS_REGION": "${region}",
        "SLACK_CHANNEL": "#notification",
        "SLACK_ENDPOINT": "https://hooks.slack.com/services/_____/_____/_____"
      },

## deploy

```
$ slss resources deploy
$ slss function deploy
$ slss event deploy
```
