/*
------------------------------------------
@Author: Sliverkiss
@Date: 2024.05.08 21:08:18
@Description: 奶茶多合一签到
------------------------------------------
- 适用于所有企迈小程序
- 自动清除无效任务默认关闭，可在boxjs打开
- 支持霸王茶姬、沪上阿姨、益禾堂等签到, 具体名单可查阅https://www.qmai.cn/Case.Html

2024.08.29 更新内容
- 修复相关任务错误，优化益禾堂种树代码逻辑
- 修复霸王茶姬新签到失败的问题
- 修复loon获取ck后小程序页面一直加载中的问题

重写：
1.打开小程序,收录小程序任务或更新token
2.手动完成一次签到,收录活动id

[Script]
http-response ^https:\/\/(webapi|webapi2)\.qmai\.cn\/web\/seller\/(oauth\/flash-sale-login|account\/login-minp) script-path=https://gist.githubusercontent.com/Sliverkiss/8b4f5487e0f28786c7dec9c7484dcd5e/raw/teaMilk.js, requires-body=true, timeout=60, tag=奶茶获取token

http-request ^https:\/\/(webapi|webapi2|qmwebapi)\.qmai\.cn\/web\/(catering\/integral|cmk-center)\/sign\/(signIn|takePartInSign) script-path=https://gist.githubusercontent.com/Sliverkiss/8b4f5487e0f28786c7dec9c7484dcd5e/raw/teaMilk.js, requires-body=true, timeout=60, tag=奶茶获取token

[MITM]
hostname = webapi2.qmai.cn,webapi.qmai.cn,qmwebapi.qmai.cn

⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。
*/
const $ = new Env("TeaMilk");
const ckName = "teaMilk_data";
const userCookie = $.toObj($.isNode() ? process.env[ckName] : $.getdata(ckName)) || {};
//notify
// const notify = $.isNode() ? require('./sendNotify') : '';
// $.notifyMsg = []
//debug
$.is_debug = ($.isNode() ? process.env.IS_DEDUG : $.getdata('is_debug')) || 'false';
//自动清除无效任务
$.is_remove = ($.isNode() ? process.env["teaMilk_remove"] : $.getdata("teaMilk_remove")) || 'false';
$.doFlag = { "true": "✅", "false": "⛔️" };
//成功个数
$.succCount = 0;
//静态数据
$.storeAccount = {
    "49006": {
        id: "49006",
        name: "霸王茶姬",
        appId: "wxafec6f8422cb357b",
        oldActivityId: "100820000000000686",
        newActivityId: "947079313798000641",
        userList: userCookie?.["49006"]?.userList || []
    },
    "201424": {
        id: "201424",
        name: "沪上阿姨",
        appId: "wxd92a2d29f8022f40",
        oldActivityId: "702822503017398273",
        newActivityId: "1004435002421583872",
        userList: userCookie?.["201424"]?.userList || []
    },
    "203009": {
        "id": "203009",
        "name": "益禾堂",
        "appId": "wx4080846d0cec2fd5",
        "oldActivityId": "",
        "newActivityId": "992065397145317377",
        userList: userCookie?.["203009"]?.userList || [],
    },
    ...userCookie
}
//------------------------------------------
const baseUrl = "https://webapi2.qmai.cn"
const _headers = {
    'Qm-User-Token': "",
    'Qm-From': 'wechat',
    'Content-Type': 'application/json'
};
const fetch = async (o) => {
    try {
        if (typeof o === 'string') o = { url: o };
        if (o?.url?.startsWith("/") || o?.url?.startsWith(":")) o.url = baseUrl + o.url
        const res = await Request({ ...o, headers: o.headers || _headers, url: o.url })
        debug(res);
        //if (!(res?.code == 0 || res?.code == 400041)) throw new Error(res?.msg || `用户需要去登录`);
        return res;
    } catch (e) {
        $.ckStatus = false;
        $.log(`⛔️ 请求发起失败！${e}`);
    }
}
//------------------------------------------
async function main() {
    try {
        //垃圾回收区
        $.removeList = [], $.notifyList = [];
        for (let item in $.storeAccount) {
            let store = $.storeAccount[item];
            store.storeId = item;
            //将无效任务压入垃圾回收区
            if (!store.appId) {
                //开启自动移除任务
                $.is_remove != 'false' && $.removeList.push(item);
                $.log(`[ERROR] 「${store.name}」任务不存在活动id,跳过任务...\n`);
                continue;
            }
            //跳过无效任务
            if (!store.userList.length) {
                $.log(`[ERROR] 「${store.name}」任务不存在账号,跳过任务...\n`);
                continue;
            }
            //$.log(`\n==============📣执行任务📣==============\n`)
            //init
            $.notifyMsg = [], $.ckStatus = true, $.succCount = 0
            $.log(`[INFO] 开始执行「${store.name}」任务...\n`);
            $.log(`[INFO] 当前共检测到 ${store.userList.length || 0} 个账号\n`);
            if (item == '203009') {
                await yhtTree(store);
            } else {
                await teaMilkCheckin(store);
            }
        }
        await Promise.allSettled($.notifyList?.map(e => sendMsg(e)));
        //清空垃圾回收区
        $.removeList.map(e => delete $.storeAccount[e]);
        $.setjson($.storeAccount, ckName);
    } catch (e) {
        throw e
    }
}

//益禾堂种植任务
async function yhtTree(store) {
    for (let user of store.userList) {
        $.log(`[INFO] 当前用户: ${user.userName}\n`);
        _headers['Qm-User-Token'] = user.token;
        await activityInfo();
        //获取助力池进行助力
        let inviteUser = await getInviteUser();
        let helpRes = await userHelp(inviteUser?.inviteUserId);
        //记录助力次数
        if (!helpRes.match(/失败|不可以/)) await uploadInviteUser(inviteUser);
        if ($.ckStatus) {
            for (let i = 1; i <= 20; i++) {
                let res = await nutrient();
                if (res) break;
            }
            //每周二领取优惠券
            await takePartInReceive("995087480964071424");
            let result = await stageInfo();
            $.notifyMsg.push(`[${user.userName}] ${result}`);
            $.succCount++;
        } else {
            $.notifyMsg.push(`[${user.userName}] 任务失败, 用户需要去登录`);
        }
    }
    $.notifyList.push({
        name: `${store.name}种树`,
        title: `共${store.userList.length}个账号,成功${$.succCount}个,失败${store.userList.length - 0 - $.succCount}个`,
        message: $.notifyMsg.join('\n')
    })
    //每周二领优惠券
    async function takePartInReceive(activityId) {
        try {
            const opts = {
                url: "/web/cmk-center/receive/takePartInReceive",
                type: "post",
                dataType: "json",
                body: { "activityId": activityId, "timestamp": "", "signature": "", "data": "", "version": 4, "appid": "" }
            }
            let res = await fetch(opts);
            $.info(`每周二领取优惠券: ${res?.message}`);
            return res?.message;
        } catch (e) {
            $.ckStatus = false;
            $.error(`${e}`)
        }
    }
    //领取肥料
    async function activityInfo() {
        try {
            const opts = {
                url: "/web/cmk-center/nurture/activityInfo",
                type: "post",
                dataType: "json",
                body: {
                    "appid": "wx4080846d0cec2fd5",
                    "activityId": "1025694534292430849"
                }
            }
            let res = await fetch(opts);
            if (res?.message.match(/未登录/)) throw new Error(res?.message);
            $.info(`进入种植页面: ${res?.message}`);
        } catch (e) {
            $.ckStatus = false;
            $.error(`${e}`)
        }
    }
    //施肥
    async function nutrient() {
        try {
            const opts = {
                url: "/web/cmk-center/nurture/add/nutrient",
                type: "post",
                dataType: "json",
                body: {
                    "appid": "wx4080846d0cec2fd5",
                    "activityId": "1025694534292430849"
                }
            }
            let res = await fetch(opts);
            $.info(`施肥: ${res?.message}`);
            return res?.message.match(/当前可用养料不足/)
        } catch (e) {
            $.ckStatus = false;
            $.error(`${e}`)
        }
    }

    //好友助力
    async function userHelp(inviteUserId) {
        try {
            const opts = {
                url: "/web/cmk-center/task/userHelp",
                type: "post",
                dataType: "json",
                body: {
                    "appid": "wx4080846d0cec2fd5",
                    "activityId": "1025694534292430849",
                    "inviteUserId": inviteUserId
                }
            }
            let res = await fetch(opts);
            return res?.message;
        } catch (e) {
            $.ckStatus = false;
            $.error(`${e}`)
        }
    }
    //查询种树进度
    async function stageInfo() {
        try {
            const opts = {
                url: "/web/cmk-center/nurture/stageInfo",
                type: "post",
                dataType: "json",
                body: {
                    "appid": "wx4080846d0cec2fd5",
                    "activityId": "1025694534292430849"
                }
            }
            let res = await fetch(opts);
            let msg = `${res?.data?.name}->${res?.data.nextName} 还需${res?.data?.upgradeThreshold - 0 - res?.data?.nutrientUsed}次施肥`
            $.info(`种植进度: ${msg}`);
            return msg;
        } catch (e) {
            this.ckStatus = false;
            $.error(`${e}`)
        }
    }
}

//奶茶日常签到
async function teaMilkCheckin(store) {
    for (let user of store.userList) {
        $.log(`[INFO] 当前用户: ${user.userName}\n`);
        _headers['Qm-User-Token'] = user.token;
        let o = { appid: store.appId, oldActivityId: store.oldActivityId, newActivityId: store.newActivityId, storeId: store.storeId }
        if (store?.appId) {
            let pointF = await getPoint(o);
            store?.oldActivityId && await oldSignin(o);
            let userId = await getUserId(o);
            store?.newActivityId && await newSignin(o, userId);
            let pointE = await getPoint(o);
            let signDays = await userSignStatistics(o);
            //判断ck状态
            !$.ckStatus
                ? $.notifyMsg.push(`[${user.userName}] 签到失败,登录已过期`)
                : ($.notifyMsg.push(`[${user.userName}] 积分:${pointF}+${pointE - 0 - pointF} 签到天数:${signDays}`), $.succCount++);
        } else {
            $.log(`[INFO] 活动id不存在,停止执行「${store.name}」签到任务\n`);
            break;
        }
    }
    $.notifyList.push({
        name: `${store.name}签到`,
        title: `共${store.userList.length}个账号,成功${$.succCount}个,失败${store.userList.length - 0 - $.succCount}个`,
        message: $.notifyMsg.join('\n')
    })

    //旧签到
    async function oldSignin(o) {
        try {
            const opts = {
                url: "/web/catering/integral/sign/signIn",
                type: "post",
                dataType: "json",
                body: { "activityId": o.oldActivityId, "mobilePhone": "1111", "userName": "微信用户", "appid": o.appid }
            }
            //post方法
            let { code, message, data, status } = await fetch(opts) ?? {};
            if (code == 0 || code == 400041) {
                console.log("[INFO] 旧签到接口:" + message + "\n");
            } else {
                $.log(`[ERROR] signIn签到错误：${message} `);
            }
        } catch (e) {
            $.log(e);
        }
    }
    async function newSignin(o, userId) {
        try {
            const timestamp = ts13();
            const opts = {
                url: "/web/cmk-center/sign/takePartInSign",
                type: "post",
                dataType: "json",
                body: { "appid": o?.appid, "activityId": o?.newActivityId, "storeId": o?.storeId, timestamp: timestamp, "store_id": o?.storeId, "signature": getSign(o?.newActivityId, o?.storeId, userId, timestamp) }
            }
            //post方法
            let { code, message, data, status } = await fetch(opts) ?? {};
            if (code == 0 || code == 400041) {
                console.log("[INFO] 新签到接口:" + message + "\n");
            } else {
                $.log(`[ERROR] takePartInSign签到错误：${message}`);
            }
        } catch (e) {
            $.log(e);
        }
    }

    //查询签到天数
    async function userSignStatistics(o) {
        try {
            const opts = {
                url: "/web/cmk-center/sign/userSignStatistics",
                type: "post",
                dataType: "json",
                body: { "appid": o.appid, "activityId": o.newActivityId }
            }
            //post方法
            let { code, message, data, status } = await fetch(opts) ?? {};
            if (code == 0 || code == 400041) {
                console.log("[INFO] 连续签到天数:" + data?.signDays + "\n");
            } else {
                $.log(`[ERROR] 签到天数查询错误：${message}`);
            }
            return data?.signDays;
        } catch (e) {
            $.log(e);
        }
    }
    //获取userId
    async function getUserId(o) {
        try {
            const opts = {
                url: "/web/mall-apiserver/integral/user/page/customer-points-flow",
                type: "post", dataType: "json",
                body: { appid: o.appid, pageNo: 1, pageSize: 15 }
            }
            let res = await fetch(opts);
            if (!(res?.code == 0 || res?.code == 400041)) throw new Error(res?.msg || `用户需要去登录`);
            return res?.data?.data?.[0]?.customerId;
        } catch (e) {
            $.ckStatus = false;
            $.log(e);
        }
    }

    //查询用户积分信息
    async function getPoint(o) {
        try {
            const opts = {
                url: "/web/catering2-apiserver/crm/points-info",
                type: "post", dataType: "json",
                body: { appid: o.appid }
            }
            let res = await fetch(opts);
            if (!(res?.code == 0 || res?.code == 400041)) throw new Error(res?.msg || `用户需要去登录`);
            return res?.data?.totalPoints;
        } catch (e) {
            $.ckStatus = false;
            $.log(e);
        }
    }
}

//查询店铺信息
async function getTitle(o) {
    try {
        const opts = {
            url: "/web/catering/design/homePage-Config",
            params: { type: 2, appid: o.appid },
            headers: {
                'Qm-User-Token': o.token,
                'Qm-From': 'wechat',
                'Content-Type': 'application/json'
            }
        }
        let res = await fetch(opts);
        debug(res?.data?.storeId);
        return res?.data?.storeId;
    } catch (e) {
        $.ckStatus = false;
        $.log(e);
    }
}

//获取Cookie
async function getCookie() {
    try {
        if ($request && $request.method === 'OPTIONS') return;
        //捕获活动id
        if ($request.url.match(/sign/)) {
            const { appid, activityId } = $.toObj($request.body);
            const { "qm-user-token": token } = ObjectKeys2LowerCase($request.headers);
            let storeId = await getTitle({ token, appid });
            for (let store in $.storeAccount) {
                if (store == storeId) {
                    $.storeAccount[store] = {
                        ...$.storeAccount[store],
                        appId: appid,
                        oldActivityId: activityId,
                        newActivityId: activityId
                    }
                    $.store = $.storeAccount[store];
                    // 保存更改
                    $.setjson($.storeAccount, ckName);
                    break;
                }
            }
            // 发送消息
            const message = $.store?.appId ? `🎉 获取${$.store.name}活动id成功!` : `❌ 获取${$.store.name}活动id失败!`;
            $.msg($.name, message, "");
        } else {
            const body = $.toObj($response?.body) ?? "";
            if (!body) throw new Error("Surge用户: 手动运行请切换到Cron环境");
            const { store: { id: storeId, name }, user: { mobile }, token } = body?.data

            if (!mobile) throw new Error(`获取ck失败，请先登录并绑定手机号`);

            const newData = {
                "userId": mobile,
                "token": token,
                "userName": phone_num(mobile),
            }
            //捕获未知小程序
            if (!$.storeAccount[storeId]) {
                $.storeAccount[storeId] = {
                    "id": storeId,
                    "name": name,
                    userList: [newData]
                }
                $.setjson($.storeAccount, ckName);
                return $.msg($.name, `🎉收录${name}小程序成功!`, "请手动完成一次签到，获取活动id");
            }
            let account = $.storeAccount[storeId];
            let userList = account.userList || [];
            const index = userList.findIndex(e => e.userId == newData.userId);
            index != -1 ? $.storeAccount[storeId].userList[index] = newData : $.storeAccount[storeId].userList.push(newData);

            $.setjson($.storeAccount, ckName);
            $.msg(name, `🎉${newData.userName}更新token成功!`, ``);
        }
    } catch (e) {
        throw e;
    }
}

//13位时间戳
function ts13() { return Math.round(new Date().getTime()).toString(); }

//获取sign
function getSign(activityId, storeId, userId, timestamp) {
    const key = activityId.split('').reverse().join('');
    const stringToEncrypt = `activityId=${activityId}&sellerId=${storeId}&timestamp=${timestamp}&userId=${userId}&key=${key}`;
    // 进行 MD5 加密
    const hash = $.CryptoJS.MD5(stringToEncrypt).toString($.CryptoJS.enc.Hex);

    return hash.toUpperCase();
}

//加载CryptoJS模块
async function loadCryptoJS() {
    let code = ($.isNode() ? require('crypto-js') : $.getdata('CryptoJS_code')) || '';
    //node环境
    if ($.isNode()) return code;
    //ios环境
    if (code && Object.keys(code).length) {
        console.log(`[INFO] 缓存中存在CryptoJS代码, 跳过下载`)
        eval(code)
        return createCryptoJS();
    }
    console.log(`[INFO] 开始下载CryptoJS代码`)
    return new Promise(async (resolve) => {
        $.getScript(
            'https://fastly.jsdelivr.net/gh/Sliverkiss/QuantumultX@main/Utils/CryptoJS.min.js'
        ).then((fn) => {
            $.setdata(fn, 'CryptoJS_code')
            eval(fn)
            const CryptoJS = createCryptoJS();
            console.log(`[INFO] CryptoJS加载成功, 请继续`)
            resolve(CryptoJS)
        })
    })
}

//获取助力用户id
async function getInviteUser() {
    const BASE_URL = `https://ap-south-1.aws.data.mongodb-api.com/app/data-gkrxjno/endpoint/data/v1/action`;
    const DATA_SOURCE = "Sliverkiss";
    const DATABASE = "yht";
    const COLLECTION = "yht_db"
    const API_KEY = "B0nLTBloCy06IXZ1uTPoBQRNuzGzzVJ0qBWE7gGX1mYNCdRBiKxIK4j8V3RDbkaM"
    const Mong = MongoDB(BASE_URL, DATA_SOURCE, DATABASE, COLLECTION, API_KEY)
    let res = await Mong.find({ type: "yht" });
    let userList = res?.documents;
    let user = userList.find(e => e.count < 3) ?? { "inviteUserId": "904328271441838081" };
    return user;
}

//上传并记录助力次数
async function uploadInviteUser(inviteUser) {
    if (!inviteUser?.userName) return;
    const BASE_URL = `https://ap-south-1.aws.data.mongodb-api.com/app/data-gkrxjno/endpoint/data/v1/action`;
    const DATA_SOURCE = "Sliverkiss";
    const DATABASE = "yht";
    const COLLECTION = "yht_db"
    const API_KEY = "B0nLTBloCy06IXZ1uTPoBQRNuzGzzVJ0qBWE7gGX1mYNCdRBiKxIK4j8V3RDbkaM"
    const Mong = MongoDB(BASE_URL, DATA_SOURCE, DATABASE, COLLECTION, API_KEY)
    let count = inviteUser?.count + 1;
    delete inviteUser?._id;
    let res = await Mong.updateMany({ type: "yht", userName: inviteUser?.userName, userId: inviteUser?.userId, inviteUserId: inviteUser?.inviteUserId }, { ...inviteUser, count })
    $.info($.toStr(res));
}

function phone_num(phone_num) { if (phone_num.length == 11) { let data = phone_num.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2"); return data; } else { return phone_num; } }

//主程序执行入口
!(async () => {
    try {
        if (typeof $request != "undefined") {
            await getCookie();
        } else {
            $.CryptoJS = await loadCryptoJS();
            await main();
        }
    } catch (e) {
        throw e;
    }
})()
    .catch((e) => { $.logErr(e), $.msg($.name, `⛔️ script run error!`, e.message || e) })
    .finally(async () => {
        $.done({});
    });
/** ---------------------------------固定不动区域----------------------------------------- */
//prettier-ignore
async function sendMsg(o) { o && ($.isNode() ? await notify.sendNotify(o.name, o.message) : $.msg(o.name, o.title || "", o.message, { "media-url": $.avatar })) }
function DoubleLog(o) { o && ($.log(`${o}`), $.notifyMsg.push(`${o}`)) };
function debug(o, r) {
    if ("true" === $.is_debug) {
        $.log("")
        $.log($.toStr(o));
        $.log("")
    }
}

//From sliverkiss's MongoDB.js
function MongoDB(t, n, o, e, a) { return new class { constructor(t, n, o, e, a) { this.BASE_URL = t, this.dataSource = n, this.database = o, this.collection = e, this.apiKey = a } async commonPost(t) { const { url: n, headers: o, body: e, method: a = "post" } = t, s = { url: `${this.BASE_URL}${n}`, headers: { "api-key": this.apiKey, "Content-Type": "application/json", Accept: "application/json", ...o }, body: $.toStr({ dataSource: this.dataSource, database: this.database, collection: this.collection, ...e }) }; return new Promise((t => { $[a](s, ((n, o, e) => { let a = $.toObj(e) || e; t(a) })) })) } async findOne(t) { const n = { url: "/findOne", body: { filter: t } }; return await this.commonPost(n) } async find(t) { const n = { url: "/find", body: { filter: t } }; return await this.commonPost(n) } async insertOne(t) { const n = { url: "/insertOne", body: { document: t } }; return await this.commonPost(n) } async insertMany(t) { const n = { url: "/insertMany", body: { documents: t } }; return await this.commonPost(n) } async updateOne(t, n) { const o = { url: "/updateOne", body: { filter: t, update: n } }; return await this.commonPost(o) } async updateMany(t, n) { const o = { url: "/updateMany", body: { filter: t, update: n } }; return await this.commonPost(o) } async deleteOne(t) { const n = { url: "/deleteOne", body: { filter: t } }; return await this.commonPost(n) } async deleteMany(t) { const n = { url: "/deleteMany", body: { filter: t } }; return await this.commonPost(n) } }(t, n, o, e, a) }
//From xream's ObjectKeys2LowerCase
function ObjectKeys2LowerCase(obj) { return !obj ? {} : Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])) };
//From sliverkiss's Request
async function Request(t) { "string" == typeof t && (t = { url: t }); try { if (!t?.url) throw new Error("[发送请求] 缺少 url 参数"); let { url: o, type: e, headers: r = {}, body: s, params: a, dataType: n = "form", resultType: u = "data" } = t; const p = e ? e?.toLowerCase() : "body" in t ? "post" : "get", c = o.concat("post" === p ? "?" + $.queryStr(a) : ""), i = t.timeout ? $.isSurge() ? t.timeout / 1e3 : t.timeout : 1e4; "json" === n && (r["Content-Type"] = "application/json;charset=UTF-8"); const y = s && "form" == n ? $.queryStr(s) : $.toStr(s), l = { ...t, ...t?.opts ? t.opts : {}, url: c, headers: r, ..."post" === p && { body: y }, ..."get" === p && a && { params: a }, timeout: i }, m = $.http[p.toLowerCase()](l).then((t => "data" == u ? $.toObj(t.body) || t.body : $.toObj(t) || t)).catch((t => $.log(`❌请求发起失败！原因为：${t}`))); return Promise.race([new Promise(((t, o) => setTimeout((() => o("当前请求已超时")), i))), m]) } catch (t) { console.log(`❌请求发起失败！原因为：${t}`) } }
//From chavyleung's Env.js
// prettier-ignore
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; "POST" === e && (s = this.post); const i = new Promise(((e, i) => { s.call(this, t, ((t, s, o) => { t ? i(t) : e(s) })) })); return t.timeout ? ((t, e = 1e3) => Promise.race([t, new Promise(((t, s) => { setTimeout((() => { s(new Error("请求超时")) }), e) }))]))(i, t.timeout) : i } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.logLevels = { debug: 0, info: 1, warn: 2, error: 3 }, this.logLevelPrefixs = { debug: "[DEBUG] ", info: "[INFO] ", warn: "[WARN] ", error: "[ERROR] " }, this.logLevel = "info", this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null, ...s) { try { return JSON.stringify(t, ...s) } catch { return e } } getjson(t, e) { let s = e; if (this.getdata(t)) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise((e => { this.get({ url: t }, ((t, s, i) => e(i))) })) } runScript(t, e) { return new Promise((s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let o = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); o = o ? 1 * o : 20, o = e && e.timeout ? e.timeout : o; const [r, a] = i.split("@"), n = { url: `http://${a}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: o }, headers: { "X-Key": r, Accept: "*/*" }, policy: "DIRECT", timeout: o }; this.post(n, ((t, e, i) => s(i))) })).catch((t => this.logErr(t))) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), o = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, o) : i ? this.fs.writeFileSync(e, o) : this.fs.writeFileSync(t, o) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let o = t; for (const t of i) if (o = Object(o)[t], void 0 === o) return s; return o } lodash_set(t, e, s) { return Object(t) !== t || (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce(((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}), t)[e[e.length - 1]] = s), t } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), o = s ? this.getval(s) : ""; if (o) try { const t = JSON.parse(o); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, o] = /^@(.*?)\.(.*?)$/.exec(e), r = this.getval(i), a = i ? "null" === r ? null : r || "{}" : "{}"; try { const e = JSON.parse(a); this.lodash_set(e, o, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const r = {}; this.lodash_set(r, o, t), s = this.setval(JSON.stringify(r), i) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.cookie && void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, ((t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) })); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: i, headers: o, body: r, bodyBytes: a } = t; e(null, { status: s, statusCode: i, headers: o, body: r, bodyBytes: a }, r, a) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", ((t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } })).then((t => { const { statusCode: i, statusCode: o, headers: r, rawBody: a } = t, n = s.decode(a, this.encoding); e(null, { status: i, statusCode: o, headers: r, rawBody: a, body: n }, n) }), (t => { const { message: i, response: o } = t; e(i, o, o && s.decode(o.rawBody, this.encoding)) })); break } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, ((t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) })); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: i, headers: o, body: r, bodyBytes: a } = t; e(null, { status: s, statusCode: i, headers: o, body: r, bodyBytes: a }, r, a) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let i = require("iconv-lite"); this.initGotEnv(t); const { url: o, ...r } = t; this.got[s](o, r).then((t => { const { statusCode: s, statusCode: o, headers: r, rawBody: a } = t, n = i.decode(a, this.encoding); e(null, { status: s, statusCode: o, headers: r, rawBody: a, body: n }, n) }), (t => { const { message: s, response: o } = t; e(s, o, o && i.decode(o.rawBody, this.encoding)) })); break } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let i = t[s]; null != i && "" !== i && ("object" == typeof i && (i = JSON.stringify(i)), e += `${s}=${i}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", i = "", o = {}) { const r = t => { const { $open: e, $copy: s, $media: i, $mediaMime: o } = t; switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { const r = {}; let a = t.openUrl || t.url || t["open-url"] || e; a && Object.assign(r, { action: "open-url", url: a }); let n = t["update-pasteboard"] || t.updatePasteboard || s; if (n && Object.assign(r, { action: "clipboard", text: n }), i) { let t, e, s; if (i.startsWith("http")) t = i; else if (i.startsWith("data:")) { const [t] = i.split(";"), [, o] = i.split(","); e = o, s = t.replace("data:", "") } else { e = i, s = (t => { const e = { JVBERi0: "application/pdf", R0lGODdh: "image/gif", R0lGODlh: "image/gif", iVBORw0KGgo: "image/png", "/9j/": "image/jpg" }; for (var s in e) if (0 === t.indexOf(s)) return e[s]; return null })(i) } Object.assign(r, { "media-url": t, "media-base64": e, "media-base64-mime": o ?? s }) } return Object.assign(r, { "auto-dismiss": t["auto-dismiss"], sound: t.sound }), r } case "Loon": { const s = {}; let o = t.openUrl || t.url || t["open-url"] || e; o && Object.assign(s, { openUrl: o }); let r = t.mediaUrl || t["media-url"]; return i?.startsWith("http") && (r = i), r && Object.assign(s, { mediaUrl: r }), console.log(JSON.stringify(s)), s } case "Quantumult X": { const o = {}; let r = t["open-url"] || t.url || t.openUrl || e; r && Object.assign(o, { "open-url": r }); let a = t["media-url"] || t.mediaUrl; i?.startsWith("http") && (a = i), a && Object.assign(o, { "media-url": a }); let n = t["update-pasteboard"] || t.updatePasteboard || s; return n && Object.assign(o, { "update-pasteboard": n }), console.log(JSON.stringify(o)), o } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, i, r(o)); break; case "Quantumult X": $notify(e, s, i, r(o)); break; case "Node.js": break }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } debug(...t) { this.logLevels[this.logLevel] <= this.logLevels.debug && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.debug}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } info(...t) { this.logLevels[this.logLevel] <= this.logLevels.info && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.info}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } warn(...t) { this.logLevels[this.logLevel] <= this.logLevels.warn && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.warn}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } error(...t) { this.logLevels[this.logLevel] <= this.logLevels.error && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.error}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.map((t => t ?? String(t))).join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, e, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, e, void 0 !== t.message ? t.message : t, t.stack); break } } wait(t) { return new Promise((e => setTimeout(e, t))) } done(t = {}) { const e = ((new Date).getTime() - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${e} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }
