// 从 data/films.json 生成独立胶卷页 film/<id>.html（SEO 友好）
const fs = require('fs');
const path = require('path');
const BASE = 'https://film-archive-3be.pages.dev';
const data = JSON.parse(fs.readFileSync('data/films.json', 'utf8'));
const CATEGORY_LABEL = { traditional: '传统颗粒', tabular: 'T颗粒/平面颗粒', fine: '细腻/超微粒', 'high-speed': '高速', cinema: '电影卷', chromogenic: '彩色工艺黑白', ortho: '正色卷', infrared: '红外卷', 'direct-positive': '直接正片' };
const GRAIN_LABEL = { 'ultra-fine': '超微粒', fine: '细颗粒', medium: '中等颗粒', coarse: '粗颗粒' };
const TYPE_LABEL = { panchromatic: '全色性', orthochromatic: '正色性', chromogenic: '彩色工艺冲洗' };
const SCENE_LABEL = { street: '街头', portrait: '人像', documentary: '纪实', 'low-light': '暗光/夜景', push: '迫冲', landscape: '风光', product: '静物/产品', 'large-format': '大画幅', 'fine-art': '艺术创作', action: '运动/动态', indoor: '室内', sports: '体育', cinematic: '电影感', event: '活动', travel: '旅行', 'scan-friendly': '扫描友好', copy: '翻拍', studio: '棚拍', infrared: '红外', creative: '创意', 'black-white': '黑白图形', architecture: '建筑', graphic: '图形/线条', retro: '复古', daily: '日常', sunlight: '阳光', 'high-contrast': '高反差', 'direct-positive': '直接正像', artistic: '艺术', laboratory: '实验室/翻拍', 'all-purpose': '通用' };

const esc = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const catLabel = (c) => CATEGORY_LABEL[c] || c;
const grainLabel = (g) => GRAIN_LABEL[g] || g;
const typeLabel = (t) => TYPE_LABEL[t] || t;
let i = 0;

function priceLines(pr) {
  const o = (pr && typeof pr === 'object') ? pr : {};
  return ['135', '120'].map((fmt) => `<div class="price-line"><span class="price-fmt">${fmt}</span><span class="price-num">${o[fmt] ? esc(o[fmt]) : '待补'}</span></div>`).join('');
}
function scenesChips(f) { return (f.scenes || []).map((s) => `<span class="scene-chip">${esc(SCENE_LABEL[s] || s)}</span>`).join(' '); }

function page(f) {
  const url = BASE + '/film/' + f.id;
  const name = esc(f.name_en) + ' 胶卷';
  const brand = esc(f.brand_cn || f.brand);
  const desc = esc((f.character || '') + (f.brand_cn || f.brand) + ' ' + f.name_en + ' 黑白胶卷档案');
  const meta = `ISO ${f.iso} · ${typeLabel(f.type)} · ${grainLabel(f.grain)} · ${(f.formats || []).join(' · ')} · ${catLabel(f.category)}`;
  const ogimg = f.samples && f.samples[0] ? BASE + '/' + f.samples[0].src : BASE + '/samples/photos/berlin-kino-400-1.jpg';
  const priceVal = (f.price_new && f.price_new['135']) || (f.price_new && f.price_new['120']) || '';
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: f.name_en + ' 胶卷', brand: { '@type': 'Brand', name: f.brand_cn || f.brand },
    description: f.character || '', image: ogimg,
    offers: priceVal ? { '@type': 'Offer', priceCurrency: 'CNY', price: (priceVal.match(/\d+/g) || [0])[0], availability: 'https://schema.org/InStock' } : undefined
  };
  const ldBreadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: '胶卷库', item: BASE + '/' },
      { '@type': 'ListItem', position: 3, name: f.name_en + ' 胶卷', item: url }
    ]
  };

  const specs = [
    ['感光度', 'ISO ' + f.iso], ['类型', typeLabel(f.type)], ['颗粒', grainLabel(f.grain)], ['尺寸', (f.formats || []).join(' · ')], ['分类', catLabel(f.category)], ['状态', f.status === 'discontinued' ? '已停产' : '在产']
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  const samples = (f.samples || []).map((s) => `<figure class="sample"><img src="${esc('../' + s.src)}" alt="${name} 实拍样片" loading="lazy"></figure>`).join('');
  const credit = (f.samples || []).some((s) => s.credit) ? `<p class="sample-credit">© ${esc((f.samples || []).filter((s) => s.credit).map((s) => s.credit.replace(/^©\s*/, '').split(' · ')[0]).filter((v, i, a) => a.indexOf(v) === i).join(' · '))}</p>` : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${name} · 黑白胶卷</title>
<meta name="description" content="${desc}" />
<meta name="google-site-verification" content="B3CefDZUQ6M7A8T5eNONFLpR874ZQ-oy1hY-Q7M8lkc" />
<link rel="canonical" href="${url}" />
<link rel="icon" href="../favicon.svg" type="image/svg+xml" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="黑白胶卷" />
<meta property="og:title" content="${name}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${esc(ogimg)}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="../style.css" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(ldBreadcrumb)}</script>
</head>
<body>
<header class="site-header">
  <div class="container">
    <div class="brand"><div class="brand-text"><div class="brand-lockup"><div class="brand-cn">黑白胶卷</div><span class="brand-en">Black &amp; White Film</span></div></div></div>
    <nav class="site-nav"><a href="../index.html">胶卷库</a><a href="../journal.html">资讯</a><a href="../about.html">关于</a></nav>
  </div>
</header>
<main class="container">
  <nav class="crumb"><a href="../index.html">首页</a> › <a href="../index.html">胶卷库</a> › <span>${name}</span></nav>
  <article class="page film-detail">
    <div class="film-head"><div>
      <span class="card-brand">${brand}</span>
      <span class="badge ${f.status === 'discontinued' ? 'badge-out' : 'badge-in'}">${f.status === 'discontinued' ? '已停产' : '在产'}</span>
    </div>
    <h1>${name}</h1>
    <p class="film-meta">${esc(meta)}</p></div>

    <dl class="spec">${specs}</dl>

    <div class="spec-block"><h2>特性 / 手感 · Character</h2><p class="desc-cn">${esc(f.character)}</p><p class="desc-en">${esc(f.character_en)}</p></div>
    <div class="spec-block"><h2>适用场景 · Best for</h2><div class="card-scenes">${scenesChips(f)}</div></div>
    ${f.notes ? `<div class="spec-block"><h2>使用感受</h2><p class="usage-note">${esc(f.notes)}</p></div>` : ''}
    <div class="spec-block"><h2>参考价格 · Price</h2><p class="price-hint">停产卷通常只有二手价 · 价格随市场波动，仅供参考</p><div class="price-config"><div class="price-cell"><span class="price-label">全新 New</span><div class="price-fmtlist">${priceLines(f.price_new)}</div></div><div class="price-cell"><span class="price-label">二手 Used</span><div class="price-fmtlist">${priceLines(f.price_used)}</div></div></div></div>
    ${f.samples && f.samples.length ? `<div class="spec-block"><h2>实拍样片</h2><div class="sample-grid">${samples}</div>${credit}</div>` : ''}

    <div class="spec-block"><h2>分享 / 下载</h2><div class="share-actions"><button class="share-btn" onclick="filmShare('copy')">复制链接</button><button class="share-btn" onclick="filmShare('native')">分享好友</button><button class="share-btn share-btn-primary" onclick="filmShare('poster')">下载卡片</button></div></div>
  </article>
</main>
<footer class="site-footer"><div class="container"><p class="footer-copy">© 2026 黑白胶卷</p><p class="footer-links"><a href="../disclaimer.html">免责声明</a><span class="dot">·</span><a href="../privacy.html">隐私政策</a></p></div></footer>

<div id="lightbox" class="lightbox" hidden><div class="lightbox-backdrop" data-close></div><div class="lightbox-body"><img id="lightbox-img" src="" alt="样片大图" /><button class="lightbox-close" data-close aria-label="关闭">×</button></div></div>
<div id="cardSave" class="card-save" hidden><div class="card-save-backdrop" data-cardsave-close></div><div class="card-save-body"><img id="cardSaveImg" src="" alt="卡片" /><p class="card-save-hint">长按 / 按住图片，选择「保存图片」即可存入相册</p><button class="card-save-close" data-cardsave-close aria-label="关闭">×</button></div></div>
<div id="toast" class="toast" aria-live="polite"></div>

<script>window.__film=${JSON.stringify(f).replace(/</g, '\\u003c')};</script>
<script src="../film-page.js"></script>
<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "8333552724924db0aa955ba91846bc4b"}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>`;
}

fs.mkdirSync('film', { recursive: true });
data.films.forEach((f) => { fs.writeFileSync('film/' + f.id + '.html', page(f)); i++; });
console.log('已生成', i, '个独立胶卷页到 film/');
