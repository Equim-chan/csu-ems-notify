# 新成绩提醒 #

一个定时查询中南大学教务管理系统并发送邮件提醒工具，基于[中南教务API](https://github.com/Equim-chan/csu-ems-api)。

## Features ##

* 以一定的时间间隔获取教务发布的考试成绩，如果有新的成绩发布，就会立即发一封邮件(可选是否包含成绩详情)到指定邮箱

## Setup ##

### pm2稳定部署 ###
```shell
$ git clone https://github.com/Equim-chan/csu-ems-notify.git
$ cd csu-ems-notify
$ npm install
$ vim config.json
```
运行前_一定一定要先填写好config.json_，说明如下：
```JavaScript
{
    // csu-ems-api的URL，关于中南教务API，详见https://github.com/Equim-chan/csu-ems-api
    "api-link": "http://localhost:2333",

    // 查询间隔，单位为分钟
    "interval": "10",

    // 查询时段，必须严格按照格式"HH:mm-HH:mm"，如指定为空，则全天都会查询。注意，在这个时段只是不查询，程序不会退出。
    "period": "06:00-23:00",

    // 查询至几次为止，如不指定或设为0，则会一直查询下去
    "limit": "",

    // 如设为false，则在出现新成绩并发送邮件之后就会立即停止程序
    "endless": true,

    // 是否在邮件中显示成绩详情，心理承受能力差的请填false(逃
    "details": true,

    // 必填，要查询的用户的账号密码
    "account": {
        "id": "",
        "password": ""
    },

    "sender-options": {
        // 必填，发件邮箱的SMTP地址，如smtp.gmail.com
        "host": "",
        "port": 25,
        "secure": false,

        // 必填，发件邮箱的账号与密码
        "auth": {
            "user": "",
            "pass": ""
        }
    },
    "mail-options": {
        // 必填，发件人信息，格式为"\"发件人名字\" <邮箱地址>"
        "from": "\"新成绩提醒\" <>",

        // 必填，收件人的邮箱地址
        "to": "",

        // 邮件标题
        "subject": "新成绩出来了！"
    }
}
```
配置完config.json之后，用pm2部署程序。如果中南教务API也是在本地上部署的话，请先部署中南教务API，方法：
```shell
$ sudo pm2 start -i 0 --name "csuapi" --watch true notify.js
```
完成所有配置，并确认中南教务API可用后，部署此项目：
```shell
$ sudo pm2 start -i 0 --name "csunotify" --watch true notify.js
```

### 获取帮助 ###
```shell
$ node notify.js -h
```

## Dependencies ##
* 详见[package.json](https://github.com/Equim-chan/csu-ems-notify/blob/master/package.json#L17)

## Lisence ##
* 本项目使用[MIT](https://github.com/Equim-chan/csu-ems-notify/blob/master/LICENSE)授权。