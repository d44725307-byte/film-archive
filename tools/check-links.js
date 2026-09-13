// 全站断链检查：抓取所有页面里的 href/src，逐个验证状态码
// 用法：node tools/check-links.js [基址]   默认 http://127.0.0.1:8091
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:8091';

function get(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'link-check' } }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location || '' });
    });
    req.on('error', () => resolve({ status: 0, location: '' }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, location: '' }); });
  });
}

function walkHtml(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

(async () => {
  const pages = walkHtml('.').filter((p) => !p.includes('samples/index.html')); // samples/index.html 未部署
  const targets = new Map(); // url -> 出现它的页面
  const re = /(?:href|src)="([^"]+)"/g;
  pages.forEach((p) => {
    const s = fs.readFileSync(p, 'utf8');
    let m;
    while ((m = re.exec(s))) {
      const u = m[1];
      if (/^(https?:|mailto:|#|data:|javascript:)/i.test(u)) continue;
      if (/[\s+\x27\x22]/.test(u)) continue; // 跳过内联 JS 里的字符串片段（误报）
      const clean = u.split('?')[0].split('#')[0];
      if (!clean) continue;
      const resolved = path.normalize(path.join(path.dirname(p), clean));
      if (!targets.has(resolved)) targets.set(resolved, p);
    }
  });

  console.log('页面数', pages.length, '| 待检内部链接/资源', targets.size, '\n');
  const bad = [];
  for (const [rel, from] of targets) {
    const url = BASE + '/' + rel.replace(/^\.\//, '');
    const r = await get(url);
    if (r.status !== 200) bad.push({ rel, from, status: r.status, loc: r.location });
  }
  if (!bad.length) console.log('✅ 全部内部链接/资源正常（无断链）');
  else {
    console.log('⚠️ 异常', bad.length, '个：');
    bad.forEach((b) => console.log('  [' + b.status + ']', b.rel, '  ← 来自', b.from, b.loc ? ('→ ' + b.loc) : ''));
  }
})();
