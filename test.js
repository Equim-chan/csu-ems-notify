'use strict';

const
    superagent = require('superagent'),
    nodemailer = require('nodemailer'),
    colors     = require('colors'),
    program    = require('commander');

program
    .option('-c, --config [path]')
    .parse(process.argv);

const
    config  = require(program.config || './config'),
    api     = config['api-host'],
    account = config.account;
      
var transporter = nodemailer.createTransport(config['sender-options']),
    mailOptions = config['mail-options'];

mailOptions.html = `配置文件(${program.config || './config'})：<br><div style="font-size: 12px;background:#efefef;padding:8px;">${JSON.stringify(config)}</div>`;
mailOptions.html += '<br>csu-ems-api查分返回的JSON：<br><div style="font-size: 12px;background:#efefef;padding:8px;">';
mailOptions.subject = 'csu-ems-notify测试结果';

var start = new Date();
console.log(`    (0ms) Testing csu-ems-api... (url: ${api})`.cyan);

superagent
    .get(api + '/grades')
    .query({ id: account.id, pwd: account.password })
    .end(function (err, res) {
        if (err) {
            console.log(`[×] (${(new Date() - start)}ms) Failed to access the API through ${api}\n${err.stack}`.red);
            return;
        }
        console.log(`[√] (${(new Date() - start)}ms) csu-ems-api access passed`.green);
        var fresh = JSON.parse(res.text);
        if (fresh.error) {
            console.log(`[×] (${(new Date() - start)}ms) Failed to query, reason: ${fresh.error}`.red);
            return;
        }
        console.log(`[√] (${(new Date() - start)}ms) Account and password passed`.green);
        console.log(`    (${(new Date() - start)}ms) Testing nodemailer... (host: ${config['sender-options'].host})`.cyan);
        mailOptions.html += res.text + '</div><br><a href="https://github.com/Equim-chan/"><img src="https://s26.postimg.org/6778clcah/signature_white_cut.jpg" alt="Equim"/></a>';
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(`[×] (${(new Date() - start)}ms) Failed to send the mail.\n${error.stack}`.red);
                return;
            }
            console.log(`[√] (${(new Date() - start)}ms) The email was sent: ${info.response}`.green);
            console.log('Please check the inbox of the target mailbox for the mail it has just sent.'.yellow);
            console.log('Please ensure the mail is '.yellow + 'not regarded as garbage'.magenta + ' by the mailbox.'.yellow);
            console.log(`[√] (${(new Date() - start)}ms) All the tests have been passed!`.green.bold);
        });
    });
