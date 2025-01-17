/*
const $ = new Env('新农场成熟通知')
cron "15 9,14,17 * * *" 

*/


const request = require('request');
const axios = require('axios');

// 一对一推送函数
async function send_wxpusher(UID, send_msg, title, help = false) {
    const WXPUSHER = process.env.WP_APP_TOKEN_ONE || false;
    if (WXPUSHER) {
        if (help) {
            title += '互助';
        }
        const webapi = 'http://wxpusher.zjiecode.com/api/send/message';
        const data = {
            "appToken": WXPUSHER,
            "content": send_msg,
            "summary": title,
            "contentType": 2,
            "uids": [UID]
        };

        try {
            const response = await axios.post(webapi, data);
            if (response.data.success) {
                console.log(">>>一对一推送成功！✅");
            } else {
                console.error(`>>>一对一推送消息发送失败❌。错误信息：${response.data.msg}`);
            }
        } catch (error) {
            console.error(`>>>一对一推送发送消息时发生错误❌：${error.message}`);
        }
    } else {
        console.log('>未设置WXPUSHER变量，取消一对一推送❌');
    }
}

// 获取青龙中的环境变量
async function getEnvs() {
    try {
        const { readFile } = require('fs/promises');
        const authData = await readFile("/ql/data/config/auth.json", 'utf8');
        const authConfig = JSON.parse(authData);
        const token = authConfig.token;

        if (!token) {
            console.error("未能获取青龙认证 token");
            throw new Error("Token is not available.");
        }

        const response = await axios({
            url: "http://localhost:5700/open/envs",
            method: "get",
            headers: {
                "Content-Type": "application/json;charset=UTF-8",
                "Authorization": `Bearer ${token}`
            }
        });

        return response.data.data; // 返回环境变量数组
    } catch (error) {
        console.error("获取环境变量失败:", error);
        return [];
    }
}

// 获取新农场奖励信息的函数
function getNewFarm(cookie, ptPin, index, uid) {
    return new Promise((resolve, reject) => {
        request({
            url: `https://api.m.jd.com/client.action`,
            body: `appid=signed_wh5&client=android&clientVersion=12.4.2&screen=393*0&wqDefault=false&build=99108&osVersion=12&t=${Date.now()}&body={\"version\":1,\"type\":1}&functionId=farm_award_detail`,
            headers: {
                "Cookie": cookie,
                "Connection": "keep-alive",
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://h5.m.jd.com",
                "User-Agent": "JD4iPhone/167774 (iPhone; iOS 14.7.1; Scale/3.00)",
                "Accept-Language": "zh-CN,zh;q=0.9",
            },
            method: "post",
            json: true
        }, async function (error, response, body) {
            if (error) {
                console.error(`请求错误：${error}`);
                return reject(error);
            }

            if (body.data.success) { 
                const plantAwards = body.data.result?.plantAwards;
                if (Array.isArray(plantAwards) && plantAwards.length > 0) {
                    let combinedMessage = ""; 
                    let count = 1;
                    for (let i of plantAwards) {
                        if (i.awardStatus == 1) { 
                            const newfarm_info = `${i.exchangeRemind}`; 
                            combinedMessage += `，${newfarm_info}`; 
                            count++;
                        }
                    }
                    if (combinedMessage) {
                        const message = `🎉🎉🎉【新农场实物】共${count - 1}张${combinedMessage.trim()}🎉🎉🎉`;
                        console.log(`******开始【京东账号${index}】${ptPin}*********\n${message}`);
                        console.log(`\n${ptPin}查询到Uid ：${uid}`);
                        
                        // 推送消息
                        if (uid) {
                            await send_wxpusher(uid, message, `京东账号(${ptPin}) 新农场成熟通知`);
                        }
                    } else {
                        console.log(`******开始【京东账号${index}】${ptPin}*********\n🌲还没成熟，再等等吧！`);
                    }
                }
            } else {
                console.log(`******开始【京东账号${index}】${ptPin}*********\n【新农场实物】活动火爆\n`);
            }
            resolve();  
        });
    });
}

// 主运行函数
async function run() {
    const JD_COOKIES = process.env.JD_COOKIE.split('&'); // 获取 cookies

    // 获取青龙环境变量，用于匹配备注信息
    const envs = await getEnvs();

    for (let index = 0; index < JD_COOKIES.length; index++) {
        const cookie = JD_COOKIES[index];
        const ptPinMatch = cookie.match(/pt_pin=([^;]+)/);
        const ptPin = ptPinMatch ? ptPinMatch[1] : '未知用户';

        // 从青龙备注中匹配 UID
        const remark = envs.find(env => env.value.includes(ptPin))?.remarks || '';
        const uidMatch = remark.match(/@@([^;]+)/);
        const uid = uidMatch ? uidMatch[1] : null;

        await getNewFarm(cookie, ptPin, index + 1, uid); 
    }
}

run();
