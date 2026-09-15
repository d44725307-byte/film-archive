// 全站静态体检：找「语义坏值」——上一轮 href="" 那类不报错、不 404、检查器也发现不了的坏值
// 用法：node tools/audit.js
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'samples'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
// 404 页是特例：用根相对路径、故意不加 canonical / beacon（不该被索引）
const is404 = (f) => f === '404.html';
const pages = walk('.');
const issues = [];
const add = (sev, file, msg) => issues.push({ sev, file, msg });

const films = JSON.parse(fs.readFileSync('data/films.json', 'utf8')).films;
const filmIds = new Set(films.map((f) => f.id));
const journalData = JSON.parse(fs.readFileSync('data/journal.json', 'utf8'));
const artSlugs = new Set(journalData.items.map((it) => String(it.link || '').replace(/^journal\//, '')));

for (const p of pages) {
  const s = fs.readFileSync(p, 'utf8');
  const isRoot = !p.includes('/');
  const depth = p.split('/').length - 1;

  // ① 空 / 无意义 href（上次的 bug 类型）
  for (const m of s.matchAll(/href="([^"]*)"/g)) {
    const h = m[1].trim();
    if (h === '') add('ERROR', p, '空 href（点了只会重载当前页）');
    else if (h === '#' || h === 'javascript:void(0)') add('WARN', p, `占位 href="${h}"`);
    else if (/^javascript:/i.test(h)) add('WARN', p, `javascript: 伪链接 ${h.slice(0, 40)}`);
  }
  // ② 空 src
  for (const m of s.matchAll(/(?:src|data-full)="([^"]*)"/g)) {
    const v = m[1].trim();
    // 空值是真问题（浏览器会把当前页面当图片再请求一次）；透明 GIF 占位是有意为之
    if (v === '') add('ERROR', p, '空 src / data-full');
    else if (v === PLACEHOLDER) add('INFO', p, '占位图（lightbox 初始值，正常）');
  }
  // ③ 模板占位残留
  for (const bad of ['undefined', 'NaN', '[object Object]', '${', '{{']) {
    if (s.includes(bad)) add('ERROR', p, `模板残留: ${bad}`);
  }
  // ④ 顶部导航完整性（除 404 外每页都应有 3 个）
  const nav = s.match(/<nav class="site-nav">[\s\S]*?<\/nav>/);
  if (!nav) add(p === '404.html' ? 'WARN' : 'ERROR', p, '缺少 site-nav 导航');
  else {
    const links = [...nav[0].matchAll(/href="([^"]*)"/g)].map((x) => x[1]);
    if (links.length !== 3) add('ERROR', p, `导航链接数异常: ${links.length}`);
    if (links.some((h) => !h)) add('ERROR', p, `导航含空 href: ${JSON.stringify(links)}`);
    // 导航「胶卷库」必须能回到首页
    const home = links[0];
    const okHome = is404(p) ? (home === '/') : (isRoot ? (home === './' || home === '/') : home === '../');
    if (!okHome) add('ERROR', p, `导航「胶卷库」指向 "${home}"，回不到首页（应为 ${isRoot ? './' : '../'}）`);
    // 「资讯」「关于」必须指向有效页
    const okJ = is404(p) ? (links[1] === '/journal') : (links[1] === (isRoot ? 'journal' : '../journal'));
    const okA = is404(p) ? (links[2] === '/about') : (links[2] === (isRoot ? 'about' : '../about'));
    if (!okJ) add('ERROR', p, `导航「资讯」指向 "${links[1]}"（应为 ${isRoot ? 'journal' : '../journal'}）`);
    if (!okA) add('ERROR', p, `导航「关于」指向 "${links[2]}"（应为 ${isRoot ? 'about' : '../about'}）`);
  }
  // ⑤ 页脚链接
  for (const m of s.matchAll(/footer-links[\s\S]*?<\/p>/g)) {
    for (const a of m[0].matchAll(/href="([^"]*)"/g)) {
      if (!a[1]) add('ERROR', p, '页脚含空 href');
    }
  }
  // ⑥ 胶卷页必须：(a) 文件名=id (b) __film 注入 (c) canonical 无扩展名
  const fm = p.match(/^film\/(.+)\.html$/);
  if (fm) {
    if (!filmIds.has(fm[1])) add('ERROR', p, `文件名不是有效 film id: ${fm[1]}`);
    if (!s.includes('window.__film=')) add('ERROR', p, '缺 window.__film 注入（分享/海报会失效）');
    if (!s.includes('<script src="../film-page.js')) add('ERROR', p, '缺 film-page.js 引用');
  }
  // ⑦ 文章页
  const jm = p.match(/^journal\/(.+)\.html$/);
  if (jm && jm[1] !== 'index') {
    if (!artSlugs.has(jm[1])) add('WARN', p, `文章未登记在 journal.json: ${jm[1]}`);
    if (!s.includes('window.__article=')) add('ERROR', p, '缺 window.__article 注入（分享图会失效）');
    if (!s.includes('<script src="../article.js')) add('ERROR', p, '缺 article.js 引用');
    if (!/article-library/.test(s)) add('WARN', p, '缺少文末转化区');
  }
  // ⑧ canonical / og:url 一致性（无扩展名 + 正式域名）
  const can = s.match(/<link rel="canonical" href="([^"]*)"/);
  if (!can) { if (!is404(p)) add('ERROR', p, '缺 canonical'); }
  else {
    const u = can[1];
    if (!u.startsWith('https://filmstockhub.com')) add('ERROR', p, `canonical 域名不对: ${u}`);
    if (u.endsWith('.html')) add('ERROR', p, `canonical 带 .html（会被 308）: ${u}`);
  }
  // ⑨ 统计 beacon
  if (!s.includes('cloudflareinsights.com/beacon.min.js') && !is404(p)) add('ERROR', p, '缺 Cloudflare 统计 beacon');
  // ⑩ 重复 id
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) add('ERROR', p, `重复 id: ${[...new Set(dup)].join(', ')}`);
  // ⑪ 图片缺 alt
  const imgs = [...s.matchAll(/<img\b[^>]*>/g)].map((x) => x[0]);
  const noAlt = imgs.filter((t) => !/\balt=/.test(t));
  if (noAlt.length) add('WARN', p, `${noAlt.length} 个 <img> 缺 alt`);
  // ⑫ h1 唯一
  const h1 = (s.match(/<h1\b/g) || []).length;
  if (h1 !== 1) add(h1 === 0 ? 'ERROR' : 'WARN', p, `h1 数量 = ${h1}（应为 1）`);
}

// ⑬ 引用的本地资源是否都存在
for (const p of pages) {
  const s = fs.readFileSync(p, 'utf8');
  for (const m of s.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1].split('?')[0].split('#')[0];
    if (!u || /^(https?:|mailto:|data:|javascript:)/i.test(u)) continue;
    if (!/\.[a-z0-9]{2,4}$/i.test(u)) continue; // 只查带扩展名的静态资源
    const target = path.normalize(path.join(path.dirname(p), u));
    if (!fs.existsSync(target)) add('ERROR', p, `引用的文件不存在: ${u}`);
  }
}

const errs = issues.filter((i) => i.sev === 'ERROR');
const warns = issues.filter((i) => i.sev === 'WARN');
console.log(`扫描 ${pages.length} 个页面`);
console.log(`\n❌ 错误 ${errs.length} 项`);
errs.slice(0, 40).forEach((i) => console.log(`  [${i.file}] ${i.msg}`));
if (errs.length > 40) console.log(`  …还有 ${errs.length - 40} 项`);
console.log(`\n⚠️ 提示 ${warns.length} 项`);
const grouped = {};
warns.forEach((w) => { const k = w.msg.replace(/\d+/g, 'N'); grouped[k] = (grouped[k] || 0) + 1; });
Object.entries(grouped).forEach(([k, v]) => console.log(`  ${v} 处: ${k}`));
warns.slice(0, 10).forEach((i) => console.log(`  · [${i.file}] ${i.msg}`));
process.exit(errs.length ? 1 : 0);
