# -*- coding: utf-8 -*-
"""Lmetor 猫源自定义HTTP服务器 - 兼容TVBox/猫影视客户端"""
import http.server
import socketserver
import os
import sys
PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    """自定义处理器，支持所有文件类型的正确响应"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        # 打印请求日志
        print(f"  📥 {self.client_address[0]} -> {self.path}")
        # 处理根路径，重定向到index.js
        if self.path == '/' or self.path == '':
            self.path = '/index.js'
        # 调用父类处理
        super().do_GET()
    
    def end_headers(self):
        # 添加CORS头，允许跨域访问
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()
    
    def do_OPTIONS(self):
        # 处理预检请求
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        # 自定义日志格式
        print(f"  📋 {args[0]} {args[1]} {args[2]}")
def main():
    os.chdir(DIRECTORY)
    
    # 获取本机IP
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    # 创建服务器
    with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        print("=" * 55)
        print("   🐱 Lmetor 猫源服务器已启动!")
        print("=" * 55)
        print(f"   📡 本机IP: {local_ip}")
        print(f"   🌐 本机访问: http://localhost:{PORT}")
        print(f"   📱 局域网访问: http://{local_ip}:{PORT}")
        print()
        print(f"   📺 TVBox配置地址:")
        print(f"      http://{local_ip}:{PORT}/index.js")
        print()
        print("   ⏎ 按 Ctrl+C 关闭服务器")
        print("=" * 55)
        print()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n   👋 服务器已关闭")
            httpd.shutdown()
if __name__ == '__main__':
    main()
