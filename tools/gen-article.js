// 资讯文章生成器（版式 v1 · 定版 · SEO 增强）
// 用法：node tools/gen-article.js data/articles/<slug>.json
// 作用：① 生成 journal/<slug>.html（固定版式 + SEO）② upsert 到 data/journal.json ③ 更新 sitemap.xml
// SEO 要素：title / description / canonical / OG(含 article:published_time) / twitter:card /
//           JSON-LD（Article + BreadcrumbList）/ h1 唯一 / 图片 alt / 内链 / 相关阅读 / sitemap
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');
const BASE = 'https://filmstockhub.com';
// Cloudflare Web Analytics（属性用单引号包 JSON，否则转义引号会导致解析失败）
const BEACON = `<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "9ffcedc6e13b4bdb85422d7100bda9c0"}'></script><!-- End Cloudflare Web Analytics -->`;
const SITE = '胶卷档案';
const VERIFY = 'B3CefDZUQ6M7A8T5eNONFLpR874ZQ-oy1hY-Q7M8lkc';
const BEACON_TOKEN = '8333552724924db0aa955ba91846bc4b';

const file = process.argv[2];
if (!file) { console.error('用法: node tools/gen-article.js data/articles/<slug>.json'); process.exit(1); }
const a = JSON.parse(fs.readFileSync(file, 'utf8'));
const slug = a.slug;
const esc = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// ① 先 upsert 资讯（相关阅读需要完整列表）
const jp = 'data/journal.json';
const j = JSON.parse(fs.readFileSync(jp, 'utf8'));
j.items = j.items.filter((x) => x.id !== 'j-' + slug);
j.items.unshift({ id: 'j-' + slug, type: a.type || 'article', title: a.title, excerpt: a.excerpt, date: a.date, link: 'journal/' + slug, media: a.hero || 'samples/photos/berlin-kino-400-1.jpg' });
// 去重：同一篇文章可能既是手工条目（j-bl-sl）又有生成器条目（j-bishilian）→ 按 link 去重，保留首个
const seen = new Set();
j.items = j.items.filter((x) => {
  const k = x.link || x.id;
  if (seen.has(k)) { console.log('  🧹 移除重复资讯条目:', x.id); return false; }
  seen.add(k);
  return true;
});
// 按日期倒序（首页只显示前 2 条，必须是最新的）
j.items.sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
fs.writeFileSync(jp, JSON.stringify(j, null, 2) + '\n');
console.log('✅ 资讯已收录，共', j.items.length, '条（首页显示前 2 条）');

// 图片路径：文章页在 journal/ 下，需加 ../
const img = (src) => (src.startsWith('http') ? src : '../' + src);
const heroAbs = a.hero ? (a.hero.startsWith('http') ? a.hero : BASE + '/' + a.hero) : BASE + '/samples/photos/berlin-kino-400-1.jpg';
// 微信/社交预览用小图（微信要求 <300KB，全尺寸图会抓取失败）
const heroThumb = heroAbs.replace('/samples/photos/', '/samples/photos/thumbs/');
const THUMB_DIMS = JSON.parse(fs.readFileSync('data/photo-thumbs.json', 'utf8'));
const hd = THUMB_DIMS[heroThumb.split('/').pop()] || [480, 320];

// 生成二维码（构建时，本地 segno 库；失败则跳过，不影响出图）
let qrRel = '';
try {
  fs.mkdirSync('samples/qr', { recursive: true });
  const r = spawnSync('python3', ['tools/gen-qr.py', BASE + '/journal/' + slug, 'samples/qr/' + slug + '.png'], { encoding: 'utf8' });
  if (r.status === 0) qrRel = '../samples/qr/' + slug + '.png';
  else console.log('  ⚠️ 二维码生成失败（跳过）:', (r.stderr || '').trim().slice(0, 80));
} catch (e) { console.log('  ⚠️ 二维码生成异常（跳过）'); }

// 结构化数据：Article + BreadcrumbList
const ldArticle = { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.excerpt, image: heroThumb, datePublished: a.date, dateModified: a.date, inLanguage: 'zh-CN', author: { '@type': 'Organization', name: SITE }, publisher: { '@type': 'Organization', name: SITE }, mainEntityOfPage: { '@type': 'WebPage', '@id': BASE + '/journal/' + slug } };
const ldBreadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
  { '@type': 'ListItem', position: 1, name: '首页', item: BASE + '/' },
  { '@type': 'ListItem', position: 2, name: '资讯', item: BASE + '/journal' },
  { '@type': 'ListItem', position: 3, name: a.title, item: BASE + '/journal/' + slug }
] };

// 相关阅读（同站其它文章）
function relatedBlock() {
  const others = j.items.filter((it) => it.link && it.link.startsWith('journal/') && it.id !== 'j-' + slug).slice(0, 3);
  if (!others.length) return '';
  const items = others.map((it) => `<li><a href="../${it.link}">${esc(it.title)}</a><span class="rel-date">${esc(it.date || '')}</span></li>`).join('\n        ');
  return `    <h2>相关阅读</h2>\n    <ul class="article-related">\n        ${items}\n    </ul>`;
}

// 图片尺寸表（补 width/height，避免 CLS）
const DIMS = JSON.parse(fs.readFileSync('data/photo-dims.json', 'utf8'));
let figNo = 0;
// Markdown 链接 → HTML（方便写作时用 [文字](网址)）
// Markdown 加粗 **文字** → <strong>
const mdBold = (s) => String(s == null ? '' : s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const mdLinks = (s) => String(s == null ? '' : s).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // 站内 Markdown 链接写成 xxx.html 会吃一次 308（Pages 会去掉 .html）→ 统一去掉扩展名
  .replace(/\[([^\]]+)\]\((?!https?:\/\/)([^)\s]*?)\.html((?:[#?][^)\s]*)?)\)/g, '<a href="$2$3">$1</a>');
const md = (s) => mdBold(mdLinks(s));

function block(b) {
  b = Object.assign({}, b, { html: md(b.html) });
  if (b.t === 'lead') return `    <p class="lead">${b.html}</p>`;
  if (b.t === 'p') return `    <p>${b.html}</p>`;
  if (b.t === 'h2') return `    <h2>${b.html}</h2>`;
  if (b.t === 'quote') return `    <blockquote class="article-quote">${b.html}</blockquote>`;
  // 列表：原来是塞在一个 <p> 里用 · / <br> 分隔，手机上换行后与正文同缩进、层级看不出 → 改成真列表
  // 用 .article-list + 每项一个子弹列（悬挂缩进），不用 ul/ol 默认缩进（手机上默认缩进最容易显得乱）
  // 条目自带序号（① ② ③）时不再加子弹，避免「· ①」这种双重标记
  if (b.t === 'list' || b.t === 'ul' || b.t === 'ol') {
    const items = (b.items || []).map((it) => {
      // 注意：条目常写成 **① 冲**，所以要先剥掉 Markdown 标记再判断序号
      const plain = String(it).replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
      const selfNumbered = /^[①②③④⑤⑥⑦⑧⑨⑩]/.test(plain);
      const mark = selfNumbered ? '' : '·';
      return `      <div class="list-item"><span class="list-mark" aria-hidden="true">${mark}</span><span class="list-text">${md(it)}</span></div>`;
    }).join('\n');
    return `    <div class="article-list">\n${items}\n    </div>`;
  }
  // 表格：手机上是横向可滚动容器（不撑破页面），表头加粗、斑马纹
  if (b.t === 'table') {
    const th = (b.headers || []).map((h) => `<th>${md(h)}</th>`).join('');
    const rows = (b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('\n        ');
    return `    <div class="article-table-wrap">\n      <table class="article-table">\n        <thead><tr>${th}</tr></thead>\n        <tbody>\n        ${rows}\n        </tbody>\n      </table>\n    </div>`;
  }
  if (b.t === 'fig') {
    figNo++;
    const d = DIMS[b.src.replace(/^.*\//, '')] || [];
    const size = d.length ? ` width="${d[0]}" height="${d[1]}"` : '';
    // 第一张图不懒加载（常是 LCP 元素）并给高优先级
    const load = figNo === 1 ? 'loading="eager" fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
    return `    <figure class="article-fig">\n      <img src="${img(b.src)}" alt="${b.alt || a.title}"${size} ${load} />\n      ${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}\n    </figure>`;
  }
  return '';
}
function linksBlock() {
  if (!a.links || !a.links.length) return '';
  const items = a.links.map((l) => `<a href="../${l.href}">${l.label}</a>`).join('\n      ');
  return `    <h2>${a.linksTitle || '相关胶卷'}</h2>\n    <p class="article-links">\n      ${items}\n    </p>`;
}

// ---- 文末转化区：把文章读者送进胶卷库 ----
// 文章页是主要流量入口（实测 /journal/2026-dashijian 3 天 104 次访问），
// 但原来出口只有一个文末文字链接、还在最底部 → 这里做成主推卡 + 搜索引导。
const ALL_FILMS = JSON.parse(fs.readFileSync('data/films.json', 'utf8')).films;
const CAT_CN = { traditional: '传统颗粒', tabular: 'T颗粒', fine: '细腻/超微粒', 'high-speed': '高速', cinema: '电影卷', chromogenic: 'C-41 黑白', ortho: '正色卷', infrared: '红外卷', 'direct-positive': '直接正片' };

function pickFilms(ids, n) {
  const byId = {};
  ALL_FILMS.forEach((f) => { byId[f.id] = f; });
  const picked = (ids || []).map((id) => byId[id]).filter(Boolean);
  if (picked.length) return picked.slice(0, n);
  // 没指定就取首页前 n 卷（与首页卡片顺序一致），保证一定有内容
  return ALL_FILMS.slice(0, n);
}

// 卡片描述：优先在标点处断开，避免出现「街头/纪」这种半截词
function blurb(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const cut = Math.max(head.lastIndexOf('，'), head.lastIndexOf('。'), head.lastIndexOf('、'), head.lastIndexOf('；'), head.lastIndexOf('：'));
  return (cut >= max * 0.55 ? head.slice(0, cut) : head.replace(/[，、；：\s]*$/, '')) + '…';
}

function filmCard(f) {
  const first = (f.samples || []).find((s) => s.src);
  const thumb = first ? '../' + first.src.replace('samples/photos/', 'samples/photos/thumbs/') : '';
  const d = thumb ? (THUMB_DIMS[thumb.split('/').pop()] || []) : [];
  const size = d.length ? ` width="${d[0]}" height="${d[1]}"` : '';
  // 没有样片的卷不占位（否则卡片里会出现一个空方块的「破图感」），文字自然占满整行
  const media = thumb
    ? `<span class="fc-photo"><img class="fc-media" src="${thumb}" alt="${esc(f.name_en)} 实拍样片"${size} loading="lazy" decoding="async" data-full="${esc('../' + first.src)}"></span>`
    : '';
  return `      <a class="film-card${thumb ? '' : ' film-card-noimg'}" href="../film/${f.id}">
        ${media}
        <span class="fc-body">
          <span class="fc-name">${esc(f.name_en)}</span>
          <span class="fc-meta">${esc(f.brand_cn || f.brand)} · ISO ${f.iso} · ${esc(CAT_CN[f.category] || f.category)}</span>
          <span class="fc-desc">${esc(blurb(f.character, 58))}</span>
        </span>
      </a>`;
}

function libraryBlock() {
  const films = pickFilms(a.featuredFilms, a.featuredCount || 4);
  if (!films.length) return '';
  return `    <section class="article-library">
      <h2>去胶卷库看看这几卷</h2>
      <p class="al-lead">「胶卷档案」是一个可搜索的胶卷资料库：每卷都有规格、特性、使用感受、参考价与实拍样片。搜品牌或型号就能直达。</p>
      <div class="article-filmcards">
${films.map(filmCard).join('\n')}
      </div>
      <div class="article-library-cta">
        <a class="al-btn al-btn-primary" href="../#search">去胶卷库搜索 →</a>
        <a class="al-btn" href="../">浏览全部 ${ALL_FILMS.length} 卷</a>
      </div>
    </section>`;
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${a.title} · ${SITE}</title>
<meta name="description" content="${a.excerpt}" />
<link rel="canonical" href="${BASE}/journal/${slug}" />
<link rel="icon" href="../favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="../apple-touch-icon.png" />
<meta name="google-site-verification" content="${VERIFY}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${SITE}" />
<meta property="og:title" content="${esc(a.title)}" />
<meta property="og:description" content="${esc(a.excerpt)}" />
<meta property="og:url" content="${BASE}/journal/${slug}" />
<meta property="og:image" content="${heroThumb}" />
<meta property="og:image:secure_url" content="${heroThumb}" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="${hd[0]}" />
<meta property="og:image:height" content="${hd[1]}" />
<meta property="article:published_time" content="${a.date}" />
<meta property="article:author" content="${SITE}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap" media="print" onload="this.media='all'" />
<link rel="stylesheet" href="../style.css" />
<script type="application/ld+json">${JSON.stringify(ldArticle)}</script>
<script type="application/ld+json">${JSON.stringify(ldBreadcrumb)}</script>
</head>
<body>
<!-- 微信分享缩略图兜底：微信会优先抓取 body 顶部 ≥300x300 的图（不能用 display:none） -->
<img class="wx-thumb" src="${heroThumb.replace(BASE + '/', '../')}" alt="" width="300" height="300" style="position:absolute;left:-9999px;top:0;width:300px;height:300px">
<header class="site-header">
  <div class="container">
    <div class="brand"><div class="brand-text"><div class="brand-lockup"><div class="brand-cn">${SITE}</div><span class="brand-en">Film Stock Hub</span></div></div></div>
    <nav class="site-nav"><a href="../">胶卷库</a><a class="active" href="../journal">资讯</a><a href="../about">关于</a></nav>
  </div>
</header>

<main class="container">
  <nav class="crumb"><a href="../">首页</a> › <a href="../journal">资讯</a> › <span>${a.title}</span></nav>

  <article class="page article">
    <header class="article-head">
      <p class="article-meta">${a.meta}</p>
      <h1>${a.title}</h1>
    </header>

${a.blocks.map(block).filter(Boolean).join('\n\n')}

${linksBlock()}
${libraryBlock()}
    <h2>分享这篇文章</h2>
    <div class="share-actions">
      <button class="share-btn" onclick="articleShare('copy')">复制链接</button>
      <button class="share-btn" onclick="articleShare('native')">分享好友</button>
      <button class="share-btn share-btn-primary" onclick="articleShare('card')">存分享图</button>
    </div>
    <p class="share-note">存出的分享图可直接发朋友圈；发微信群若没预览，用「复制链接」粘贴即可。</p>
${relatedBlock()}
    <p><a class="article-back" href="../">← 回到胶卷库，搜你想查的那卷</a></p>
  </article>
</main>

<footer class="site-footer">
  <div class="container">
        <section class="follow-block">
      <div class="follow-text">
        <p class="follow-title">关注「观察家摄影」</p>
        <p class="follow-desc">新文章先发在公众号：器材吐槽、胶片行情、拍摄思路。<br />想看更新，扫码关注就好。</p>
        <p class="follow-hint">微信长按识别二维码</p>
      </div>
      <div class="follow-qr"><img src="../mp-qrcode.jpg" alt="观察家摄影 公众号二维码" width="480" height="480" loading="lazy" decoding="async" /></div>
    </section>
    <p class="footer-copy">© 2026 ${SITE}</p>
    <p class="footer-links"><a href="../disclaimer">免责声明</a><span class="dot">·</span><a href="../privacy">隐私政策</a></p>
  </div>
</footer>

<div id="lightbox" class="lightbox" hidden><div class="lightbox-backdrop" data-close></div><div class="lightbox-body"><img id="lightbox-img" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="样片大图" /><button class="lightbox-close" data-close aria-label="关闭">×</button></div></div>
<div id="cardSave" class="card-save" hidden><div class="card-save-backdrop" data-cardsave-close></div><div class="card-save-body"><img id="cardSaveImg" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="分享图" /><p class="card-save-hint">长按 / 按住图片，选择「保存图片」即可存入相册</p><button class="card-save-close" data-cardsave-close aria-label="关闭">×</button></div></div>
<div id="toast" class="toast" aria-live="polite"></div>
<script>window.__article={title:${JSON.stringify(a.title)},excerpt:${JSON.stringify(a.excerpt)},slug:${JSON.stringify(a.slug)},hero:${JSON.stringify(heroThumb.replace(BASE + '/', '../'))},url:${JSON.stringify(BASE + '/journal/' + a.slug)},qr:${JSON.stringify(qrRel)}};</script>
<script src="../article.js"></script>
${BEACON}
</body>
</html>`;

fs.writeFileSync('journal/' + slug + '.html', html);
console.log('✅ 生成 journal/' + slug + '.html');

// 同步首页「资讯」静态区块（消除 CLS + SEO）
try { require('child_process').execSync('node tools/gen-home-journal.js', { stdio: 'inherit' }); } catch (e) { console.log('  ⚠️ 首页资讯同步失败'); }

// 更新 sitemap（统一出口 tools/gen-sitemap.js —— 新增页面类型只需改那一处）
try { require('child_process').execSync('node tools/gen-sitemap.js', { stdio: 'inherit' }); } catch (e) { console.log('  ⚠️ sitemap 生成失败'); }
console.log('\n下一步：git add -A && git commit -m "新文章：' + a.title + '" && git push origin master');

// 生成后给 JS/CSS 引用打内容版本号
try { require('child_process').execSync('node tools/bust-assets.js', { stdio: 'ignore' }); } catch (e) {}
