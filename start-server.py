#!/usr/bin/env python3
"""
Simple HTTP Server for JCIE Scrollytelling Development
Usage: python3 start-server.py [port]
Default port: 8000
"""

import http.server
import socketserver
import sys
import os
from pathlib import Path

def main():
    # デフォルトポート
    port = 8000
    
    # コマンドライン引数からポート番号を取得
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number: {sys.argv[1]}")
            sys.exit(1)
    
    # カレントディレクトリをプロジェクトルートに設定
    os.chdir(Path(__file__).parent)
    
    # HTTPサーバーを起動
    handler = http.server.SimpleHTTPRequestHandler
    
    # CORSヘッダーを追加
    class CORSHTTPRequestHandler(handler):
        def end_headers(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            super().end_headers()
    
    with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
        print(f"🚀 JCIE Scrollytelling Development Server")
        print(f"📁 Serving directory: {os.getcwd()}")
        print(f"🌐 Server running at: http://localhost:{port}/")
        print(f"")
        print(f"📄 Available pages:")
        print(f"   • AIDS Main:     http://localhost:{port}/01_aids/")
        print(f"   • Disease Test:  http://localhost:{port}/01_aids/test-disease-system.html")
        print(f"   • Integration:   http://localhost:{port}/01_aids/test-shared-integration.html")
        print(f"   • File Access:   http://localhost:{port}/01_aids/test-file-access.html")
        print(f"")
        print(f"Press Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n👋 Server stopped")

if __name__ == "__main__":
    main()