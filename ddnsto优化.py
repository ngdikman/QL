"""
cron: 1 1 1 1 *

"""

import requests, json, uuid, datetime
from datetime import datetime, timedelta

# 配置参数 登录https://www.ddnsto.com/app/#/devices 抓包cookie
cookie = 'ksuser=48a52cf7-755d-47d1-aa46-7737a9d82ce3'

# 多个xcsrftoken和userid
xcsrftokens = ['L2j10xmxk3ah41StWyVZfPj8AvnyiLziyg5sD8VKFnkdKb3LoPRfcSKgQVz0MaFD']
userids = ['426135']

# utc-beijing
def UTC2BJS(UTC):
    UTC_format = "%Y-%m-%dT%H:%M:%S.%fZ"
    BJS_format = "%Y-%m-%d %H:%M:%S"
    UTC = datetime.strptime(UTC, UTC_format)
    # 格林威治时间+8小时变为北京时间
    BJS = UTC + timedelta(hours=8)
    BJSJ = BJS.strftime(BJS_format)
    return BJSJ

# 循环处理每个xcsrftoken和userid
for xcsrftoken, userid in zip(xcsrftokens, userids):
    # 获取订单号
    uu_id = uuid.uuid4()
    suu_id = ''.join(str(uu_id).split('-'))
    url_2 = 'https://www.ddnsto.com/api/user/product/orders/'
    headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cookie': f'{cookie}',
        'referer': 'https://www.ddnsto.com/app/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
        'x-csrftoken': f'{xcsrftoken}'
    }
    data_2 = {
        'product_id': '2',
        'uuid_from_client': f'{suu_id}'
    }
    html_2 = requests.post(url=url_2, headers=headers, data=data_2)
    result_2 = json.loads(html_2.text)
    id = result_2['id']

    # 提交订单
    url_3 = f'https://www.ddnsto.com/api/user/product/orders/{id}/'
    html_3 = requests.get(url=url_3, headers=headers).text

    # 创建
    url_4 = f'https://www.ddnsto.com/api/user/routers/{userid}/'
    data_4 = {
        "plan_ids_to_add": [f'{id}'],
        "server": 3
    }
    html_4 = requests.patch(url=url_4, headers=headers, data=data_4)
    result_4 = json.loads(html_4.text)
    
    if len(result_4['uid']) > 0:
        print(f'****白嫖成功 for userid {userid}*****\n到期时间：{UTC2BJS(result_4["active_plan"]["product_expired_at"])}')
    else:
        print(f'没有白嫖到 for userid {userid}！检查配置看看')