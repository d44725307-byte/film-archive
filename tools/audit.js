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
    // 「胶卷库」必须能回首页；./ ../ / 三种写法都合法
    const okHome = home === './' || home === '../' || home === '/' || home === '';
    if (!okHome) add('ERROR', p, `导航「胶卷库」指向 "${home}"，回不到首页（应为 ${isRoot ? './' : '../'}）`);
    // 「资讯」「关于」必须指向有效页
    // 导航可以用相对路径（journal）也可以用根相对路径（/journal）—— 都合法
    const okJ = links[1] === 'journal' || links[1] === '../journal' || links[1] === '/journal';
    const okA = links[2] === 'about' || links[2] === '../about' || links[2] === '/about';
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
  // ⑬ 商业链接必须带标识（口径见 disclaimer「商业内容与广告」）
  //    命中购物/分佣域名 = 视为商业链接；链接本身要有 rel="sponsored"，页面要有「广告/推广」字样
  const SHOP = /(?:^|\.)(taobao|tmall|jd|pinduoduo|1688|youzan|xiaohongshu|amazon|ebay|bhphotovideo|adorama|freestylephoto|etsy)\./i;
  const adLabelled = /(广告|推广|赞助)/.test(s);
  for (const m of s.matchAll(/<a\b([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/g)) {
    const attrs = m[1] + m[3];
    if (!SHOP.test(new URL(m[2]).hostname)) continue;
    if (!/rel="[^"]*sponsored/i.test(attrs)) add('ERROR', p, `商业链接缺 rel="sponsored": ${m[2].slice(0, 60)}`);
    if (!adLabelled) add('ERROR', p, `含商业链接但页面无「广告/推广」标识: ${m[2].slice(0, 60)}`);
  }
}

// ⑬ 引用的本地资源是否都存在
for (const p of pages) {
  const s = fs.readFileSync(p, 'utf8');
  for (const m of s.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1].split('?')[0].split('#')[0];
    if (!u || /^(https?:|mailto:|data:|javascript:)/i.test(u)) continue;
    if (!/\.[a-z0-9]{2,4}$/i.test(u)) continue; // 只查带扩展名的静态资源
    // 根相对路径（/style.css、/rank.js）要从站点根解析，不能按当前目录
    const target = u.startsWith('/')
      ? path.normalize(path.join('.', u))
      : path.normalize(path.join(path.dirname(p), u));
    if (!fs.existsSync(target)) add('ERROR', p, `引用的文件不存在: ${u}`);
  }
}

// ⑭ 样片署名（口径见 disclaimer「图像与版权」）
//    空的 credit 会在卷页上渲染成「一条署名都没有」→ 单独报出来，避免又被当成"都署名了"
const noCredit = [];
films.forEach((f) => {
  (f.samples || []).forEach((s) => {
    if (!(s.credit || '').trim()) noCredit.push(`${f.id} ${path.basename(s.src || '?')}`);
  });
});
if (noCredit.length) {
  const filmsHit = [...new Set(noCredit.map((x) => x.split(' ')[0]))];
  add('WARN', 'data/films.json', `${noCredit.length} 张样片无署名（涉及 ${filmsHit.length} 卷：${filmsHit.join(', ')}）→ 卷页会整卷无署名，见 disclaimer「图像与版权」`);
}

// ⑮ 价格口径声明（口径见 disclaimer「参数与价格」）
//    卷页与排行页必须写明「档位估算 / 未标注采集日期」——否则价格会被读成实采市价
//    这条是 2026-10-19 立的规矩：核出「二手价 74/74 条 = 新价下限×0.85（纯推算）」后补的
const PRICE_PAGES = pages.filter((p) => /^film\/[^/]+\.html$/.test(p) || p === 'rank.html' || /^rank\/[^/]+\.html$/.test(p));
for (const p of PRICE_PAGES) {
  const s = fs.readFileSync(p, 'utf8');
  if (!/档位估算/.test(s)) add('ERROR', p, '价格区缺少「档位估算 / 非实时市价」声明（见 disclaimer「参数与价格」）');
}


// ⑯ 海外实价数据完整性（口径见 disclaimer「参数与价格」）
//    每条实价必须能查证：有采集日期、有商品链接、有原币价、有折算价。
//    没有这些字段的「实价」等于又造了一个不可查证的估算。
try {
  const pr = JSON.parse(fs.readFileSync('data/prices-real.json', 'utf8'));
  const asOf = pr.as_of;
  if (!asOf) add('ERROR', 'data/prices-real.json', '缺 as_of（采集日期）');
  const ageDays = asOf ? Math.round((Date.now() - new Date(asOf + 'T00:00:00Z')) / 86400000) : 0;
  if (ageDays > 90) add('WARN', 'data/prices-real.json', `实价已 ${ageDays} 天未更新（采集于 ${asOf}）→ 页面会显示旧价，考虑重跑 tools/fetch-prices.js`);
  let nOffers = 0;
  for (const [fid, rec] of Object.entries(pr.films || {})) {
    if (!filmIds.has(fid)) add('ERROR', 'data/prices-real.json', `实价里有未知胶卷 id：${fid}`);
    if (!rec.offers || !rec.offers.length) add('ERROR', 'data/prices-real.json', `${fid} 的 offers 为空`);
    for (const o of rec.offers || []) {
      nOffers++;
      if (!o.url || !/^https:\/\//.test(o.url)) add('ERROR', 'data/prices-real.json', `${fid}/${o.format} 缺商品链接`);
      if (!o.currency) add('ERROR', 'data/prices-real.json', `${fid}/${o.format} 缺币种`);
      if (!(o.unit_cny > 0)) add('ERROR', 'data/prices-real.json', `${fid}/${o.format} 折算价异常`);
      if (!(o.units_per_pack > 0)) add('ERROR', 'data/prices-real.json', `${fid}/${o.format} 包装份数异常`);
      if (!o.verified_via) add('WARN', 'data/prices-real.json', `${fid}/${o.format} 缺取数凭证字段`);
    }
  }
  // 页面侧：有实价数据的卷，页面上必须真的渲染出「海外实价」
  for (const fid of Object.keys(pr.films || {})) {
    const page = `film/${fid}.html`;
    if (!pages.includes(page)) continue;
    // ⚠️ 不能用「海外实价」这个词当判据：下方估算区的说明文字里也会出现它（第一次写就是这么漏检的）
    if (!/class="rp-table"/.test(fs.readFileSync(page, 'utf8'))) add('ERROR', page, '有实价数据但页面没渲染实价表 .rp-table（是否忘了跑 gen-films.js）');
  }
  console.log(`实价：${Object.keys(pr.films || {}).length} 卷 / ${nOffers} 条报价（采集于 ${asOf}）`);
} catch (e) {
  if (e.code !== 'ENOENT') add('ERROR', 'data/prices-real.json', '读取失败：' + e.message);
}

// ⑰ 颗粒口径（口径见 disclaimer「参数与价格」的「颗粒的分档依据」）
//    2026-10-28 审计立的规矩。审计前的病灶是：grain 实际是 category（乳剂代际）的投影，
//    于是出现「T-Max 400 标细、Fomapan 100 标中等」＝ 400 度比 100 度细的自相矛盾；
//    同时 25/39（64%）挤在 medium，等于筛选没筛。
//    改按「绝对颗粒」排序后，用下面几条机械校验把口径锁住，否则下次录入又会滑回按代际排。
const GRAIN_OK = new Set(['ultra-fine', 'fine', 'medium', 'coarse']);
{
  const cnt = {};
  for (const f of films) {
    const g = f.grain;
    cnt[g] = (cnt[g] || 0) + 1;
    if (!GRAIN_OK.has(g)) {
      add('ERROR', 'data/films.json', `${f.id} 的 grain 是非法值「${g}」（只允许 ultra-fine / fine / medium / coarse）`);
      continue;
    }
    if (g === 'ultra-fine' && f.iso > 100) add('ERROR', 'data/films.json', `${f.id} 标 ultra-fine 但 ISO ${f.iso} > 100（超微粒只给专用超细乳剂）`);
    if (g === 'fine' && f.iso > 400) add('ERROR', 'data/films.json', `${f.id} 标 fine 但 ISO ${f.iso} > 400（口径：fine 只给扁平颗粒 / ISO 50-80 / 传统细乳剂）`);
    if (g === 'medium' && f.iso <= 50) add('ERROR', 'data/films.json', `${f.id} 标 medium 但 ISO ${f.iso} ≤ 50（低速卷不该是中等颗粒）`);
  }
  // 分布健康度：任何一档超过 60% 就说明又塌陷了（本轮把 medium 从 64% 修到 46%）
  for (const [g, n] of Object.entries(cnt)) {
    if (n > 5 && n / films.length > 0.6) {
      add('WARN', 'data/films.json', `grain「${g}」占 ${Math.round((n / films.length) * 100)}%（${n}/${films.length}）→ 该档筛选区分度低，考虑重新分配`);
    }
  }
  console.log(`颗粒分布：${Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
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
