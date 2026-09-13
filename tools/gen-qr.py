#!/usr/bin/env python3
# 生成二维码 PNG（构建时用，不依赖任何在线服务）
# 用法：python3 tools/gen-qr.py <url> <output.png> [scale]
import sys
import segno

def main():
    if len(sys.argv) < 3:
        print('用法: python3 tools/gen-qr.py <url> <out.png> [scale]', file=sys.stderr)
        return 1
    url = sys.argv[1]
    out = sys.argv[2]
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    qr = segno.make(url, error='m')
    # 白底 + 黑模块；border=2 留出静默区（扫码需要）
    qr.save(out, scale=scale, border=2, dark='#1B3327', light='#FFFFFF')
    print('ok', out, qr.designator)
    return 0

if __name__ == '__main__':
    sys.exit(main())
