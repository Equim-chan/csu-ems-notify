/* TODO
 * 完善异常处理
 * 检查配置文件是否完整
 * 增加次数和时间底限，到某个时间、或者重复某次之后结束
 */

"use strict";

var superagent = require('superagent'),
    nodemailer = require('nodemailer'),
    colors = require('colors'),
    program = require('commander'),
    config = require('./config'),
    Date = require('./lib/Date.js');

program
    .option('-h, --help')
    .option('-v, --version')
    .parse(process.argv);

if (!program.help || !program.version) {
    console.log(('CSUEMS Email Notify v1.0.0').rainbow);
    console.log(('by Equim').rainbow);
    if (!program.help) {
        console.log('Preparation:');
        console.log('  You ' + 'have to'.red + 'set the config.json before running it.');
        console.log('\nUsage:');
        console.log('  npm start');
        console.log('\nOptions:');
        console.log('  -h, --help              print this message and exit.');
        console.log('  -v, --version           print the version and exit.');
        console.log('\nExamples:');
        console.log('  $ sudo sudo pm2 start -i 0 --name "csunotify" notify.js    # Using pm2 as a daemon to deploy');
    }
    process.exit(0);
}

const timeStamp = () => new Date().format('[MM-dd hh:mm:ss] '),
      getOrdinal = (n) => {
          const s = ["th", "st", "nd", "rd"];
          let v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
      },
      // API链接
      api = config['api-link'],
      // 查询间隔
      interval = config.interval,
      // 查询时段
      period = config.period && {
          start: parseInt(config.period.substring(0, 2)) * 60 + parseInt(config.period.substring(3, 5)),
          end: parseInt(config.period.substring(6, 8)) * 60 + parseInt(config.period.substring(9, 11)),
      },
      // 查询次数
      limit = config.limit,
      // 无尽模式(?
      endless = config.endless,
      // 邮件中是否包含详情
      details = config.details,
      // 查询的账号
      account = config.account;
      
    // 发件人信息
var transporter = nodemailer.createTransport(config['sender-options']),
    // 邮件信息
    mailOptions = config['mail-options'],
    // 上一次查询的结果
    last,
    // 当前查询次数
    count = 0,
    // 用于停止setInterval
    code;

const task = () => {
    if (period) {
        let now = new Date();
        let minute = now.getHours() * 60 + now.getMinutes();
        // 这段应该能优化一下的
        if (period.start > period.end) {
            if (minute < period.start && minute > period.end) {
                return;
            }
        } else {
            if (minute < period.start || minute > period.end) {
                return;
            }
        }
    }
    console.log((timeStamp() + 'Fetching for the ').cyan + getOrdinal(++count).yellow + ' time.'.cyan);
    // 这种退出方法暂时还没测试过，下面的回调会不会对其造成影响
    if (limit && count == limit) {
        clearInterval(code);
    }
    superagent.get(api + '/grades/?id=' + account.id + '&pwd=' + account.password)
        .end(function (err, res) {
            // 无法使用API
            if (err) {
                console.log((timeStamp() + 'Failed to access the API through ' + api + '\n' + err.stack).red);
                return;
            }

            var fresh = JSON.parse(res.text);
            // 能使用API，但查询失败
            if (fresh.error) {
                console.log((timeStamp() + 'Failed to query, reason: ' + fresh.error).red);
                return;
            }

            // 初始化last，如果是第一次查询
            last = last || fresh;

            // 比较有成绩科目的个数
            if (fresh['subject-count'] <= last['subject-count']) {
                console.log(timeStamp() + 'Found no new grades.');
                return;
            }

            ////////////////////////////////
            // 有新成绩

            if (!endless) {
                clearInterval(code);
            }

            console.log(timeStamp().green +
                'Found '.green +
                (fresh['subject-count'] - last['subject-count']).toString().yellow +
                ' new grades! Now sending the mail to '.green + 
                mailOptions.to.yellow);

            if (details) {
                var news = {};
                // 遍历一遍，找出新出成绩的科目，注意可能有很多个
                for (let key in fresh.grades) {
                    if (!(key in last.grades))
                        news[key] = fresh.grades[key];
                }

                mailOptions.html = '<h2>以下为新出成绩的列表：</h2><br>';
                for (let key in news) {
                    // 这里暂不考虑NaN的情况
                    if (parseInt(news[key]) < 60)
                        mailOptions.html += '<span style="color:red;font-weight:bold">[挂]</span>';
                    else
                        mailOptions.html += '<span style="color:green;font-weight:bold">[过]</span>';
                    mailOptions.html += ' <u>' + key + '</u> 分数为 <u>' + news[key] + '</u><br>';
                }
                mailOptions.html += '<br>---------------------------------------------------------------------<br>';
            }
            mailOptions.html += '详情可前往<a href="http://csujwc.its.csu.edu.cn/">中南大学本科教务管理系统</a>进行查询<br>';
            mailOptions.html += '由' + require('os').hostname() + '检测于' + new Date().format('yyyy年MM月dd日hh时mm分ss秒SSS毫秒<br>');
            mailOptions.html += '<a href="https://github.com/Equim-chan/"><img src="https://s26.postimg.org/dyg3i93zt/signature_white.jpg" alt="Equim"/></a>';
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log((timeStamp() + 'Failed to send the mail.\n' + error.stack).red);
                    return;
                }
                console.log((timeStamp() + 'The notifiction mail was sent: ' + info.response).green);
            });
            last = fresh;
        });
};

code = setInterval(task, 1000 * 60 * interval);
console.log(timeStamp().green +
    'The server has started monitoring, with an interval of '.green +
    interval.yellow +
    ' mins, in period: '.green +
    (config.period || '24 hours').yellow);
// 启动后立即查询一次
task();
