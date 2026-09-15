#!/usr/bin/env python3
"""本地预览服务器（替代 python3 -m http.server）

为什么要自己写：站内链接统一改成「无扩展名」（/film/xxx、/journal/2026-xxx）后，
python 自带的 http.server 不支持无扩展名 → 本地预览会 404，而线上 Cloudflare Pages 正常。
这里让本地也按 Cloudflare 的规则解析：
  /film/xxx         → film/xxx.html
  /journal          → journal.html（文件优先）或 journal/index.html（目录）
  /                 → index.html
用法：python3 tools/preview-server.py [端口] [目录]
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else '.')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8091


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        # 先按 Cloudflare 的规则解析「无扩展名」路径，再交给父类。
        # ⚠️ 必须同时改写 self.path：父类 send_head 是拿 self.path 判断「是不是目录」的，
        #    只改 translate_path 的返回值没用（目录仍会被补成 /xxx/ 的 301）。
        # ⚠️ 判断不能用 os.path.exists：/journal 本地既是个目录（放文章页）、又对应 journal.html，
        #    目录存在会让改写被跳过 → 回到 301。Cloudflare 的行为是「文件优先」。
        path = self.path.split('?')[0].split('#')[0]
        fs = super().translate_path(path)
        if not os.path.splitext(fs)[1]:  # 无扩展名才可能重写
            for cand in (fs + '.html', os.path.join(fs, 'index.html')):
                if os.path.isfile(cand):
                    rel = os.path.relpath(cand, self.directory)
                    self.path = '/' + rel.replace(os.sep, '/')
                    break
        return super().send_head()

    def end_headers(self):
        # 预览时禁用缓存，免得改了文件还看到旧的
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 保持安静


if __name__ == '__main__':
    os.chdir(ROOT)
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), partial(Handler, directory=ROOT))
    print(f'本地预览（支持无扩展名）: http://127.0.0.1:{PORT}/  目录: {ROOT}')
    srv.serve_forever()
