# 中南教务邮件提醒 #
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/66ae5c8fce5e4520b2f8f5bf864cc136)](https://www.codacy.com/app/Equim-chan/csu-ems-notify?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=Equim-chan/csu-ems-notify&amp;utm_campaign=Badge_Grade) [![SATA](https://img.shields.io/badge/license-SATA-blue.svg)](https://github.com/Equim-chan/csu-ems-notify/blob/master/LICENSE)

一个定时查询中南大学教务管理系统并发送邮件提醒工具，基于[中南教务API](https://github.com/Equim-chan/csu-ems-api)。

- [Features](#features)
- [Setup](#setup)
    - [pm2稳定部署](#pm2稳定部署)
    - [获取帮助](#获取帮助)
- [Dependencies](#dependencies)
- [License](#license)

## Features ##

* 以一定的时间间隔获取教务发布的考试成绩，如果有新的成绩发布，就会立即发一封邮件(可选是否包含成绩详情)到指定邮箱
* _(欢迎发起pull req提交更多features)_

## Setup ##

### pm2稳定部署 ###
```shell
$ git clone https://github.com/Equim-chan/csu-ems-notify.git
$ cd csu-ems-notify
$ npm install
$ vim config.json      # 填写config.json
```
运行前__一定一定要先填写好config.json__，尤其是标注__请填写__的那些（属于因人而异的内容），说明如下：
```JavaScript
{
    // 【请填写】一定要先确认下这个，这是csu-ems-api的URL。
    // 如果是用默认配置在本地部署的那么就是http://localhost:2333。
    // 关于中南教务API，详见https://github.com/Equim-chan/csu-ems-api
    "api-link": "http://localhost:2333",

    // 查询间隔，单位为分钟
    "interval": "10",

    // 查询时段，必须严格按照格式"HH:mm-HH:mm"，如指定为空，则全天都会查询。
    // 注意，在这个时段只是不查询，程序不会退出。
    "period": "06:00-23:00",

    // 是否考虑补考。如设为false，则对有没有新成绩的判断会变为对有成绩科目的数量的简单比较。
    // 注意：对于补考更新成绩的支持仅限于补考成绩高于初考成绩的情况。
    "make-up": false,

    // 查询至几次为止，如不指定或设为0，就会一直查询下去
    "limit": "",

    // 如设为false，则在出现新成绩并发送邮件之后就会立即停止程序
    "endless": true,

    // 是否在邮件中显示成绩详情，心理承受能力差的请填false(逃
    "details": true,

    // 【请填写】要查询的用户的账号密码，不需要URL转义
    "account": {
        "id": "",
        "password": ""
    },

    "sender-options": {
        // 【请填写】发件邮箱的SMTP地址，如smtp.gmail.com
        "host": "",

        // 端口号
        "port": 25,

        // 是否启用SSL
        "secure": false,

        // 【请填写】发件邮箱的账号与密码
        "auth": {
            "user": "",
            "pass": ""
        }
    },
    "mail-options": {
        // 【请填写】发件人信息，格式为"\"发件人名字\" <邮箱地址>"
        "from": "\"新成绩提醒\" <>",

        // 【请填写】收件人的邮箱地址
        "to": "",

        // 邮件标题
        "subject": "新成绩出来了！"
    }
}
```
如果要自定义config.json的路径，可以使用参数`-c|--config [path]`  
在这一步可以运行`npm test`测试一下自己的重要参数是否正确，以及是否能正常使用中南教务API、邮件等，如：  
```shell
$ npm test -- -c ./myconfig
```
如果配置正确，目标邮箱就能收到一封邮件。如果没收到，则检查一下是否在回收站里，并将它从“垃圾邮件”中移走，然后再试。  
_(注：这不是严格的单元测试，~~因为太麻烦~~……)_  
配置完config.json之后，用pm2部署程序。如果中南教务API也是在本地上部署的话，请先部署中南教务API，方法（假设你在中南教务API的目录下）：
```shell
$ pm2 start -i 0 -n "csuapi" --watch true app.js
```
完成所有配置，并确认中南教务API可用后，部署此项目：
```shell
$ pm2 start -i 0 -n "csunotify" --watch true notify.js
```
查看日志：
```shell
$ pm2 logs csunotify
```
撤销部署：
```shell
$ pm2 stop csunotify
$ pm2 delete csunotify
```

### 获取帮助 ###
```shell
$ node notify.js -h
```

## Dependencies ##
* 详见[package.json](https://github.com/Equim-chan/csu-ems-notify/blob/master/package.json#L16)

## Related ##
* [csu-ems-api](https://github.com/Equim-chan/csu-ems-api) - API本体

## License ##
* 本项目使用[The Star And Thank Author License](https://github.com/Equim-chan/csu-ems-notify/blob/master/LICENSE)授权。