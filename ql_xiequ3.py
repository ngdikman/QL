"""
cron: */15 * * * *

"""


import requests
import socket

# 删除所有已有的白名单 IP，uid&ukey改成自己的
delete_url1 = "http://op.xiequ.cn/IpWhiteList.aspx?uid=138360&ukey=3306992EFDE6D64642800A28D4C1D939&act=del&ip=all"
response1 = requests.get(delete_url1)
print(response1.text)
delete_url2 = "http://op.xiequ.cn/IpWhiteList.aspx?uid=131626&ukey=3880BE483766E7AE9E85CA7C6DC44DC8&act=del&ip=all"
response2 = requests.get(delete_url2)
print(response2.text)
delete_url3 = "http://op.xiequ.cn/IpWhiteList.aspx?uid=150690&ukey=623CAB4268B953D6EC0D2EDB11187F98&act=del&ip=all"
response3 = requests.get(delete_url3)
print(response3.text)

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
        response = requests.get('https://www.ipplus360.com/getIP')
        data = response.json()
        ip = data['data']
        print(f"httpbin.org获取公网IP成功：{ip}")
    except requests.RequestException as e:
        print("使用httpbin.org获取公网IP失败，请检查网络连接或其他问题。")

# 如果无法获取公网IP，则使用本地机器IP
if not ip:
    ip = socket.gethostbyname(socket.gethostname())
    print(f"无法获取公网IP，使用本地机器IP：{ip}")

# 添加IP到白名单
add_url = f"http://op.xiequ.cn/IpWhiteList.aspx?uid=150690&ukey=623CAB4268B953D6EC0D2EDB11187F98&act=add&ip={ip}"
response = requests.get(add_url)
print(response.text)
