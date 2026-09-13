// 给 JS/CSS 引用加内容版本号（app.js?v=ab12cd34），彻底解决"改了发不出去"
// 用法：node tools/bust-assets.js
// 原理：文件名不变时浏览器/CDN 会沿用缓存；URL 带上内容哈希就必然重新拉取
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ASSETS = ['style.css', 'app.js', 'film-page.js', 'article.js'];
const hash = {};
ASSETS.forEach((f) => {
  if (fs.existsSync(f)) hash[f] = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
});
console.log('资源版本：', ASSETS.filter((f) => hash[f]).map((f) => f + '?v=' + hash[f]).join('  '));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let files = 0, hits = 0;
walk('.').forEach((f) => {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  ASSETS.forEach((a) => {
    if (!hash[a]) return;
    // 匹配 "样式.css" / "../样式.css"，可能已带 ?v=...
    const re = new RegExp('(["\'])((?:\\.\\./)?' + a.replace('.', '\\.') + ')(\\?v=[a-f0-9]+)?(["\'])', 'g');
    s = s.replace(re, (m, q1, p, _old, q2) => q1 + p + '?v=' + hash[a] + q2);
  });
  if (s !== before) { fs.writeFileSync(f, s); files++; hits++; }
});
console.log('✅ 已更新', files, '个 HTML 文件的资源引用');
