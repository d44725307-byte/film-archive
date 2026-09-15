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
      // 站内链接现在统一「无扩展名」（/film/xxx），本地对应的是 film/xxx.html；
      // 目录链接（/journal）本地对应 journal.html 或 journal/index.html。
      // 若无扩展名解析不到文件，再试 .html —— 否则会误报一堆 404。
      let resolved = path.normalize(path.join(path.dirname(p), clean));
      if (!fs.existsSync(resolved) && !path.extname(resolved)) {
        for (const cand of [resolved + '.html', path.join(resolved, 'index.html')]) {
          if (fs.existsSync(cand)) { resolved = cand; break; }
        }
      }
      // ⚠️ 去重键用「本地解析后的文件名」，但请求必须用「页面里真实的 URL」。
      // 否则无扩展名链接会被解析成 xxx.html 再去请求 → 线上 308（误报）。
      if (!targets.has(resolved)) targets.set(resolved, { from: p, url: clean });
    }
  });

  console.log('页面数', pages.length, '| 待检内部链接/资源', targets.size, '\n');
  const bad = [];
  const isLocal = BASE.includes('127.0.0.1') || BASE.includes('localhost');
  for (const [rel, info] of targets) {
    // 请求页面里真实的 URL（rel 只是本地去重键）
    const url = BASE + '/' + info.url.replace(/^\.\//, '');
    const r = await get(url);
    if (r.status === 200) continue;
    // ⚠️ 无扩展名链接（/film/xxx、/journal）在 Cloudflare Pages 上是正常的，
    // 但本地 python http.server 不支持 → 会 301 到 /film/xxx/ 再 404。
    // 本地检查时这类跳转不算断链，否则每次都误报。
    if (isLocal && /^3\d\d$/.test(String(r.status)) && !path.extname(info.url)) continue;
    bad.push({ rel, from: info.from, status: r.status, loc: r.location });
  }
  if (!bad.length) console.log('✅ 全部内部链接/资源正常（无断链）');
  else {
    console.log('⚠️ 异常', bad.length, '个：');
    bad.forEach((b) => console.log('  [' + b.status + ']', b.rel, '  ← 来自', b.from, b.loc ? ('→ ' + b.loc) : ''));
  }
})();
