# cron "2 2 29 2 *" 


import requests
import socket

# 删除所有已有的白名单 IP，uid&ukey改成自己的
uid = "131626"
ukey = "3880BE483766E7AE9E85CA7C6DC44DC8"
delete_url = f"http://op.xiequ.cn/IpWhiteList.aspx?uid={uid}&ukey={ukey}&act=del&ip=all"
response = requests.get(delete_url)
print(response.text)

# 尝试获取宿主机公网IP地址
ip = ""

# 尝试使用3322.org网站获取公网IP
try:
    response = requests.get('http://members.3322.org/dyndns/getip')
    ip = response.text.strip()
    print(f"3322.org获取公网IP成功：{ip}")
except requests.RequestException as e:
    print("使用3322.org获取公网IP失败，尝试其他方式...")

# 如果cip.cc获取IP失败，尝试使用httpbin.org获取公网IP
if not ip:
    try:
        response = requests.get('http://httpbin.org/ip')
        data = response.json()
        ip = data['origin']
        print(f"httpbin.org获取公网IP成功：{ip}")
    except requests.RequestException as e:
        print("使用httpbin.org获取公网IP失败，请检查网络连接或其他问题。")

# 如果无法获取公网IP，则使用本地机器IP
if not ip:
    ip = socket.gethostbyname(socket.gethostname())
    print(f"无法获取公网IP，使用本地机器IP：{ip}")

# 添加IP到白名单
add_url = f"http://op.xiequ.cn/IpWhiteList.aspx?uid={uid}&ukey={ukey}&act=add&ip={ip}"
response = requests.get(add_url)
print(response.text)
