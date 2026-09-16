// 生成「筛选 / 排行」页 /rank 与 4 个预设排行页 /rank/<preset>
// 用法：node tools/gen-rank.js
// 为什么：胶卷页是「单卷」视角，缺「横向比较」。用户真实搜索意图是
//        「最便宜的黑白卷」「ISO400 有哪些」这类筛选型需求 —— 只能用结构化数据做。
// 设计：数据内嵌进页面（window.__RANK_FILMS），筛选/排序在客户端做，URL 用 # 参数记状态
//      → 既能分享（带参数的链接），又只维护一个模板。
const fs = require('fs');
const path = require('path');
const BASE = 'https://filmstockhub.com';
const BEACON = `<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "9ffcedc6e13b4bdb85422d7100bda9c0"}'></script><!-- End Cloudflare Web Analytics -->`;
const VERIFY = 'B3CefDZUQ6M7A8T5eNONFLpR874ZQ-oy1hY-Q7M8lkc';
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap" media="print" onload="this.media='all'" /><link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap" />`;

const films = JSON.parse(fs.readFileSync('data/films.json', 'utf8')).films;
const statMedian = (arr) => {
  const v = arr.map((f) => f.price_num.new['135'].mid).sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
};
const CAT = { traditional: '传统颗粒', tabular: 'T颗粒', fine: '细腻/超微粒', 'high-speed': '高速', cinema: '电影卷', chromogenic: 'C-41 黑白', ortho: '正色卷', infrared: '红外卷', 'direct-positive': '直接正片' };
const GRAIN = { 'ultra-fine': '超微粒', fine: '细颗粒', medium: '中等颗粒', coarse: '粗颗粒' };
const esc = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// 内嵌给前端的数据（只带必要字段，控制体积）
const payload = films.map((f) => ({
  id: f.id, n: f.name_en, nc: f.name_cn || '', b: f.brand_cn || f.brand,
  iso: f.iso, fm: f.formats, c: f.category, g: f.grain,
  st: f.status === 'discontinued' ? 0 : 1,
  p135: (f.price_num && f.price_num.new['135'] && f.price_num.new['135'].mid) || null,
  p120: (f.price_num && f.price_num.new['120'] && f.price_num.new['120'].mid) || null,
  p135s: (f.price_new && f.price_new['135']) || '', p120s: (f.price_new && f.price_new['120']) || '',
  img: (f.samples && f.samples[0]) ? f.samples[0].src.replace('samples/photos/', 'samples/photos/thumbs/') : '',
}));

// ---- 预设排行（都用真实数据算，不编）----
const inProd = films.filter((f) => f.status === 'in-production' && f.price_num.new['135']);
const byP135 = [...inProd].sort((a, b) => a.price_num.new['135'].mid - b.price_num.new['135'].mid);
const cheap5 = byP135.slice(0, 5).map((f) => f.price_num.new['135'].mid);
const cheapMax = cheap5[cheap5.length - 1];

const iso400All = films.filter((f) => f.iso === 400);
const iso400In = iso400All.filter((f) => f.status === 'in-production');
const n120 = films.filter((f) => (f.formats || []).indexOf('120') >= 0).length;
const nCheap60 = inProd.filter((f) => f.price_num.new['135'].mid <= 60).length;

const PRESETS = [
  {
    slug: 'zuipianyi',
    title: `最便宜的黑白胶卷（2026）：前 5 卷都在 ¥${cheapMax} 以内`,
    h1: '最便宜的黑白胶卷',
    desc: `按 135 规格全新价排序：最便宜的一卷约 ¥${byP135[0].price_num.new['135'].mid}，前 5 卷都在 ¥${cheapMax} 以内。`,
    query: '#sort=price&max=60&st=1',
    note: `本站 ${inProd.length} 卷在产卷里，135 规格全新价中位数约 ¥${statMedian(inProd)}，最低 ¥${byP135[0].price_num.new['135'].mid}。价格为参考价，随市场波动。`,
  },
  {
    slug: 'iso400',
    title: `ISO 400 黑白胶卷有哪些？全部 ${iso400All.length} 卷按价格排序`,
    h1: 'ISO 400 黑白胶卷',
    desc: `ISO 400 是黑白卷最通用的档位。这里列出本站收录的全部 ${iso400All.length} 卷 ISO 400（含 ${iso400All.length - iso400In.length} 卷停产经典），可按价格排序比较。`,
    query: '#iso=400&sort=price',
    note: `ISO 400 兼顾白天与弱光，也最容易迫冲，是新手和纪实最常选的档位。本站 ${iso400In.length} 卷在产。`,
  },
  {
    slug: 'kouchailiang',
    title: '黑白胶卷口粮卷排行：便宜、好买、容错高',
    h1: '口粮卷排行',
    desc: '口粮卷 = 单价低 + 在产好买 + 容错高。按价格从低到高排，前几卷都在 ¥60 以内。',
    query: '#sort=price&st=1&max=60',
    note: `口粮卷的标准因人而异，这里用「在产 + 价格低」做客观筛选 —— 本站符合的在产卷有 ${nCheap60} 卷，特性请点进单卷页看。`,
  },
  {
    slug: '120',
    title: '120 黑白胶卷有哪些？按价格排序（含停产卷）',
    h1: '120 黑白胶卷',
    desc: `按 120 规格筛选本站收录的 ${n120} 卷黑白胶卷，含已停产的经典卷。`,
    query: '#fmt=120&sort=price',
    note: '120 画幅更大，同一卷在 120 上的颗粒表现通常比 135 更细腻。',
  },
];

function pageHTML({ title, h1, desc, query, note, canonical, presetList }) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: title, description: desc, url: canonical,
    isPartOf: { '@type': 'WebSite', name: '胶卷档案', url: BASE + '/' },
  };
  const ldBC = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: '排行 / 对比', item: BASE + '/rank' },
      ...(h1 ? [{ '@type': 'ListItem', position: 3, name: h1, item: canonical }] : []),
    ],
  };
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} · 胶卷档案</title>
<meta name="description" content="${esc(desc)}" />
<meta name="google-site-verification" content="${VERIFY}" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="胶卷档案" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
${FONTS}
<link rel="stylesheet" href="/style.css" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(ldBC)}</script>
</head>
<body>
<header class="site-header">
  <div class="container">
    <div class="brand"><div class="brand-text"><div class="brand-cn">胶卷档案</div><span class="brand-en">Film Stock Hub</span></div></div>
    <nav class="site-nav"><a href="/">胶卷库</a><a href="/journal">资讯</a><a href="/about">关于</a></nav>
  </div>
</header>
<main class="container">
  <nav class="crumb"><a href="/">首页</a> › <a href="/">胶卷库</a> › <span>${esc(h1 || '排行 / 对比')}</span></nav>
  <article class="page">
    <h1 class="page-title" style="font-size:30px">${esc(h1 || '排行 / 对比')}</h1>
    <p class="lead" style="font-size:16px;font-weight:400">${esc(desc)}</p>
    ${note ? `<p class="rank-note">${esc(note)}</p>` : ''}

    <div class="rank-presets">
      <span class="rank-presets-label">常用排行：</span>
      ${presetList.map((p) => `<a href="/rank/${p.slug}">${esc(p.h1)}</a>`).join('')}
      <a href="/rank">全部（自定义筛选）</a>
    </div>

    <div class="rank-controls">
      <div class="filter-group"><span class="filter-label">规格</span><div class="filter-chips" data-group="fmt">
        <button type="button" class="chip chip-active" data-v="">全部</button>
        <button type="button" class="chip" data-v="35mm">35mm</button>
        <button type="button" class="chip" data-v="120">120</button>
        <button type="button" class="chip" data-v="4x5">4x5</button>
      </div></div>
      <div class="filter-group"><span class="filter-label">ISO</span><div class="filter-chips" data-group="iso">
        <button type="button" class="chip chip-active" data-v="">全部</button>
        <button type="button" class="chip" data-v="100">≤100</button>
        <button type="button" class="chip" data-v="400">400</button>
        <button type="button" class="chip" data-v="800">≥800</button>
      </div></div>
      <div class="filter-group"><span class="filter-label">在产</span><div class="filter-chips" data-group="st">
        <button type="button" class="chip chip-active" data-v="">全部</button>
        <button type="button" class="chip" data-v="1">在产</button>
        <button type="button" class="chip" data-v="0">停产</button>
      </div></div>
      <div class="filter-group"><span class="filter-label">价格</span><div class="filter-chips" data-group="max">
        <button type="button" class="chip chip-active" data-v="">不限</button>
        <button type="button" class="chip" data-v="40">¥40 内</button>
        <button type="button" class="chip" data-v="60">¥60 内</button>
        <button type="button" class="chip" data-v="80">¥80 内</button>
        <button type="button" class="chip" data-v="120">¥120 内</button>
      </div></div>
      <div class="filter-group"><span class="filter-label">排序</span><div class="filter-chips" data-group="sort">
        <button type="button" class="chip chip-active" data-v="price">价格低→高</button>
        <button type="button" class="chip" data-v="price-desc">价格高→低</button>
        <button type="button" class="chip" data-v="iso">ISO 低→高</button>
        <button type="button" class="chip" data-v="name">按名称</button>
      </div></div>
    </div>

    <div class="rank-stats" id="rankStats">共 — 卷</div>
    <div class="rank-list" id="rankList"></div>
    <p class="rank-empty" id="rankEmpty" hidden>没有符合条件的胶卷 —— 放宽一下筛选试试。</p>
  </article>
</main>
<footer class="site-footer"><div class="container"><p class="footer-copy">© 2026 胶卷档案</p><p class="footer-links"><a href="/disclaimer">免责声明</a><span class="dot">·</span><a href="/privacy">隐私政策</a></p></div></footer>
<script>window.__RANK_FILMS=${JSON.stringify(payload)};window.__RANK_INIT=${JSON.stringify(query || '')};window.__RANK_CAT=${JSON.stringify(CAT)};window.__RANK_GRAIN=${JSON.stringify(GRAIN)};</script>
<script src="/rank.js"></script>
${BEACON}
</body>
</html>`;
}

// ---- 主页面 /rank ----
fs.writeFileSync('rank.html', pageHTML({
  title: '黑白胶卷排行 / 筛选：按价格、ISO、规格挑卷',
  h1: '排行 / 对比',
  desc: `把本站收录的 ${films.length} 卷黑白胶卷放在一张表里：可按规格、ISO、是否在产、价格筛选与排序，一眼比较。`,
  query: '',
  note: '价格是本站整理的参考价（135 规格、全新、中位价），随市场波动，仅供比较用。',
  canonical: BASE + '/rank',
  presetList: PRESETS,
}));
console.log('✅ rank.html');

// ---- 预设页 ----
fs.mkdirSync('rank', { recursive: true });
PRESETS.forEach((p) => {
  fs.writeFileSync(path.join('rank', p.slug + '.html'), pageHTML({
    title: p.title, h1: p.h1, desc: p.desc, query: p.query, note: p.note,
    canonical: BASE + '/rank/' + p.slug, presetList: PRESETS,
  }));
  console.log('✅ rank/' + p.slug + '.html');
});

// 生成后刷新 sitemap（排行页要进 sitemap）
try { require('child_process').execSync('node tools/gen-sitemap.js', { stdio: 'inherit' }); } catch (e) { console.log('  ⚠️ sitemap 生成失败'); }

// 生成后给 JS/CSS 引用打版本号（否则 rank.js 改了发不出去）
try { require('child_process').execSync('node tools/bust-assets.js', { stdio: 'ignore' }); } catch (e) {}
