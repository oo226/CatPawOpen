#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Serve nodejs/dist for LAN / 内网穿透 — 国内朋友不走 GitHub。

用法（先 build）:
  cd nodejs && npm run build
  python3 scripts/serve-dist.py

手机与电脑同一 WiFi 时，MiraPlay 填:
  http://<电脑局域网IP>:8080/index.js.md5
"""
from __future__ import annotations

import http.server
import os
import socket
import socketserver
import sys

PORT = int(os.environ.get("PORT", "8080"))
ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "dist")
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        print(f"  {self.client_address[0]} {args[0]}")


def lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def main() -> None:
    if not os.path.isfile(os.path.join(ROOT, "index.js.md5")):
        print(f"缺少 {ROOT}/index.js.md5 — 请先: cd nodejs && npm run build")
        sys.exit(1)

    ip = lan_ip()
    with open(os.path.join(ROOT, "index.js.md5"), encoding="utf-8") as f:
        md5 = f.read().strip()

    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print("=" * 56)
        print("  CatPawOpen dist 局域网源已启动")
        print("=" * 56)
        print(f"  目录: {ROOT}")
        print(f"  md5:  {md5}")
        print()
        print("  MiraPlay 填（同一 WiFi）:")
        print(f"    http://{ip}:{PORT}/index.js.md5")
        print()
        print("  本机试:")
        print(f"    http://127.0.0.1:{PORT}/index.js.md5")
        print()
        print("  外网朋友需要内网穿透（cpolar / frp / 花生壳）后再分享公网 URL")
        print("  Ctrl+C 退出")
        print("=" * 56)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已关闭")


if __name__ == "__main__":
    main()
