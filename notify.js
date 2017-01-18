/* TODO
 * 完善异常处理
 */

'use strict';

var superagent = require('superagent'),
    nodemailer = require('nodemailer'),
    colors     = require('colors'),
    program    = require('commander'),
    _          = require('underscore'),
    util       = require('util'),
    moment     = require('moment');

program
    .option('-h, --help')
    .option('-v, --version')
    .option('-c, --config [path]')
    .parse(process.argv);

if (!program.help || !program.version) {
    console.log(('CSUEMS Email Notify v1.3.2').rainbow);
    console.log(('by Equim').rainbow);
    if (!program.help) {
        console.log('Preparation:');
        console.log('  You ' + 'have to'.red + ' set the config.json before running it.');
        console.log('\nUsage:');
        console.log('  npm start [-- <options...>]');
        console.log('\nOptions:');
        console.log('  -h, --help              print this message and exit.');
        console.log('  -v, --version           print the version and exit.');
        console.log('  -c, --config [path]     specify the config file.');
        console.log('\nExamples:');
        console.log('  $ pm2 start -i 0 -n "csunotify" notify.js -- -c ~/myconfig    # Using pm2 as a daemon to deploy');
    }
    process.exit(0);
}

const timeStamp = () => moment().format('[[]YY-MM-DD HH:mm:ss[]]'),
      getOrdinal = (n) => {
          const s = ["th", "st", "nd", "rd"];
          let v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
      },
      // (object)  config   -> 导入config
      // (string)  api      -> API链接
      // (number)  interval -> 查询间隔
      // (object)  period   -> 查询时段
      // (boolean) makeUp   -> 是否考虑补考
      // (number)  limit    -> 查询次数
      // (boolean) endless  -> 无尽模式(?
      // (boolean) details  -> 邮件中是否包含详情
      // (object)  account  -> 查询的账号
      config   = require(program.config || './config'),
      api      = config['api-link'],
      interval = config.interval,
      period   = config.period && {
          start: parseInt(config.period.substring(0, 2)) * 60 + parseInt(config.period.substring(3, 5)),
          end: parseInt(config.period.substring(6, 8)) * 60 + parseInt(config.period.substring(9, 11)),
          inPeriod() {
              let now = new Date();
              let minute = now.getHours() * 60 + now.getMinutes();
              // 这段应该能优化一下的
              if (period.start > period.end) {
                  if (minute < period.start && minute > period.end) {
                      return false;
                  }
              } else {
                  if (minute < period.start || minute > period.end) {
                      return false;
                  }
              }
              return true;
          }
      },
      makeUp  = config['make-up'],
      limit   = config.limit,
      endless = config.endless,
      details = config.details,
      account = config.account;
      
    // (object) transporter -> 发件人信息
    // (object) mailOptions -> 邮件信息
    // (object) last        -> 上一次查询的结果
    // (number) count       -> 当前查询次数
    // (object) code        -> 用于停止setInterval
var transporter = nodemailer.createTransport(config['sender-options']),
    mailOptions = config['mail-options'],
    last,
    count = 0,
    code;

const task = () => {
    if (period && !period.inPeriod()) {
        return;
    }
    console.log(`${timeStamp()} Fetching for the `.cyan +
        getOrdinal(++count).yellow + ' time.'.cyan);
    // 这种退出方法暂时还没测试过，不知道下面的回调会不会对其造成影响
    if (count === limit) {
        clearInterval(code);
    }

    superagent
        .get(api + '/g')
        .query({ id: account.id, pwd: account.password })
        .end(function (err, res) {
            // 无法使用API
            if (err) {
                console.log(`${timeStamp()} Failed to access the API through ${api}\n${err.stack}`.red);
                return;
            }

            var fresh = JSON.parse(res.text);
            // 能使用API，但查询失败
            if (fresh.error) {
                console.log(`${timeStamp()} Failed to query, reason: ${fresh.error}`.red);
                return;
            }

            // 初始化last，如果是第一次查询
            last = last || fresh;

            // 比较有成绩科目的个数
            // 注意：对于补考更新成绩的支持仅限于补考成绩高于初考成绩的情况
            if (fresh['subject-count'] <= last['subject-count']) {
                if (!makeUp || _.isEqual(fresh, last)) {
                    console.log(`${timeStamp()} Found no new grades.`);
                    return;
                }
            }

            ////////////////////////////////
            // 有新成绩
            //

            let newCount = 0;

            if (!endless) {
                clearInterval(code);
            }

            mailOptions.html = details ? '<h2 style="font-family:\'Microsoft Yahei\'">以下为新出成绩的列表：</h2><br><ul>' : '';

            // 确定个数
            for (let key in fresh.grades) {
                // 找新增或有变动的科目
                if (!(key in last.grades) || (makeUp && last.grades[key].overall !== fresh.grades[key].overall)) {
                    newCount++;
                    if (details) {
                        let current = fresh.grades[key];
                        mailOptions.html +=
                            `${(key in fresh.failed) ?
                                '<li><span style="color:red;font-weight:bold">[挂]</span>' :
                                '<li><span style="color:green;font-weight:bold">[过]</span>'}` +
                            ` <u> ${key} </u> 分数为 <u> ${current.overall} </u>`;

                        if (!isNaN(current.reg) && !isNaN(current.exam) && !isNaN(current.overall)) {
                            // 计算平时分、考试分权重
                            // weight.reg = (overall - exam) / (reg - exam)
                            // weight.exam = 1 - weight.reg
                            let regWeight = (current.overall - current.exam) / (current.reg - current.exam),
                                examWeight = 1 - regWeight;
                            mailOptions.html += util.format(' (平时成绩%d * %d%% + 期末成绩%d * %d%% = %d)',
                                current.reg,
                                //Math.round(regWeight * 10000) / 100,
                                Math.round(regWeight * 10) * 10,
                                current.exam,
                                Math.round(examWeight * 10) * 10,
                                current.overall
                            );
                        }
                        mailOptions.html += '</li>';
                    }
                }
            }

            mailOptions.html +=
                (details ? '</ul><br>---------------------------------------------------------------------<br>' : '') + 
                '详情可前往' + 
                '<a href="http://csujwc.its.csu.edu.cn/">中南大学本科教务管理系统</a>进行查询<br>' +
                '由' + require('os').hostname() + '检测于' +
                moment().format('YYYY年M月D日H时m分s秒SSS毫秒') +
                '，第' + count + '次检测<br>' +
                '<a href="https://github.com/Equim-chan/">' +
                    '<img src="https://s26.postimg.org/6778clcah/signature_white_cut.jpg" alt="Equim"/>' +
                '</a>';

            console.log(`${timeStamp()} Found `.green +
                newCount.toString().yellow +
                ` new grades! Now sending the mail to `.green + 
                mailOptions.to.yellow);

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(`${timeStamp()} Failed to send the mail.\n${error.stack}`.red);
                    return;
                }
                console.log(`${timeStamp()} The notifiction mail was sent: ${info.response}`.green);
            });
            last = fresh;
        });
};

code = setInterval(task, 1000 * 60 * interval);

console.log(`${timeStamp()} The monitor service has been launched, with an interval of `.green +
    interval.yellow + ' mins, in period: '.green +
    (config.period || '24 hours').yellow);
// 启动后立即查询一次
task();
