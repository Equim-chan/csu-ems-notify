/* TODO
 * 完善异常处理
 */

'use strict';

const 
    superagent = require('superagent'),
    nodemailer = require('nodemailer'),
    colors     = require('colors'),
    program    = require('commander'),
    _          = require('underscore'),
    util       = require('util'),
    moment     = require('moment');

program
    .option('-h, --help')
    .option('-V, --version')
    .option('-c, --config [path]')
    .parse(process.argv);

if (!program.help || !program.version) {
    console.log(
`${`CSUEMS Email Notify v${require('./package').version}
by Equim`.rainbow}${program.help ? '' :
`

Preparation:
  You ${'have to'.red} set the config.json before running it.

Usage:
  npm start [-- <options...>]

Options:
  -h, --help              print this message and exit.
  -V, --version           print the version and exit.
  -c, --config [path]     specify the config file.

Examples:
  $ pm2 start -i 0 -n "csunotify" notify.js -- -c ~/myconfig    # Using pm2 as a daemon to deploy`}`);
    process.exit(0);
}


// {object} 导入config
const config = require(program.config || './config');

// {string} API链接
const api = require('path').join(config['api-host'], '/g');

// {number} 查询间隔
const interval = config.interval;

// {object} 查询时段
const period = config.period && {
    range: config.period
               .replace(/:/g, '')
               .match(/\d{3,4}/g)
               .map((p, i, c) => parseInt(p) + (i === 1 && parseInt(c[0]) >= p ? 2400 : 0)),
    inPeriod() {
        const now = parseInt(moment().format('Hmm'));
        return this.range[0] <= now && now <= this.range[1] ||
               this.range[0] <= now + 2400 && now + 2400 <= this.range[1];
    }
};

// {boolean} 是否考虑补考
const makeUp = config['make-up'];

// {number} 查询次数
const limit = config.limit;

// {boolean} 无尽模式(?
const endless = config.endless;

// {boolean} 邮件中是否包含详情
const details = config.details;

// {object} 查询的账号
const account = config.account;


// {object} 发件人信息
var transporter = nodemailer.createTransport(config['sender-options']);

// {object} 邮件信息
var mailOptions = config['mail-options'];

// {object} 上一次查询的结果
var last;

// {number} 当前查询次数
var count = 0;

// {object} 用于clearInterval
var code;


const logging = (log) => console.log(`${moment().format('[[]YY-MM-DD HH:mm:ss[]]')} ${log}`);

// 计算序数词
const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    let v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const task = () => {
    if (period && !period.inPeriod()) {
        return;
    }

    logging('Fetching for the '.cyan + getOrdinal(++count).yellow + ' time.'.cyan);

    // 这种退出方法暂时还没测试过，不知道下面的回调会不会对其造成影响
    if (count === limit) {
        clearInterval(code);
    }

    superagent
        .get(api)
        .query({ id: account.id, pwd: account.password })
        .end(function (err, res) {
            // 无法使用API
            if (err) {
                logging(`Failed to access the API through ${api}\n${err.stack}`.red);
                return;
            }

            var fresh = JSON.parse(res.text);
            // 能使用API，但查询失败
            if (fresh.error) {
                logging(`Failed to query, reason: ${fresh.error}`.red);
                return;
            }

            // 初始化last，如果是第一次查询
            last = last || fresh;

            // 比较有成绩科目的个数
            // 注意：对于补考更新成绩的支持仅限于补考成绩高于初考成绩的情况
            if (fresh['subject-count'] <= last['subject-count']) {
                if (!makeUp || _.isEqual(fresh, last)) {
                    logging('Found no new grades.');
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
                            ` <u>${key}</u> 分数为 <u>${current.overall}</u>`;

                        if (!isNaN(current.reg) && !isNaN(current.exam) && !isNaN(current.overall)) {
                            // 计算平时分、考试分权重
                            // weight.reg = (overall - exam) / (reg - exam)
                            // weight.exam = 1 - weight.reg
                            let regWeight = (current.overall - current.exam) / (current.reg - current.exam),
                                examWeight = 1 - regWeight;
                            mailOptions.html += util.format(' (平时成绩%d * %d%% + 期末成绩%d * %d%% = %d)',
                                current.reg,
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
                '详情可前往<a href="http://csujwc.its.csu.edu.cn/">中南大学本科教务管理系统</a>进行查询<br>' +
                `由${require('os').hostname()}检测于${moment().format('YYYY年M月D日H时m分s秒SSS毫秒')}，第${count}次检测<br>` +
                '<a href="https://github.com/Equim-chan/"><img src="https://s26.postimg.org/6778clcah/signature_white_cut.jpg" alt="Equim"/></a>';

            logging('Found '.green +
                newCount.toString().yellow +
                ' new grades! Now sending the mail to '.green + 
                mailOptions.to.yellow);

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    logging(`Failed to send the mail.\n${error.stack}`.red);
                } else {
                    logging(`The notifiction mail was sent: ${info.response}`.green);
                }
            });

            last = fresh;
        });
};

code = setInterval(task, 60000 * interval);

logging('The monitor service has been launched, with an interval of '.green +
    interval.toString().yellow + ' mins, in period: '.green +
    (config.period || '24 hours').yellow);

// 启动后立即查询一次
task();
