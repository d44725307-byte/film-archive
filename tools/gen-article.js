// 资讯文章生成器（版式 v1 · 定版）
// 用法：node tools/gen-article.js data/articles/<slug>.json
// 作用：① 生成 journal/<slug>.html（固定版式）② upsert 到 data/journal.json ③ 更新 sitemap.xml
const fs = require('fs');
const path = require('path');
const BASE = 'https://film-archive-3be.pages.dev';
const SITE = '黑白胶卷';
const VERIFY = 'B3CefDZUQ6M7A8T5eNONFLpR874ZQ-oy1hY-Q7M8lkc';
const BEACON_TOKEN = '8333552724924db0aa955ba91846bc4b';

const file = process.argv[2];
if (!file) { console.error('用法: node tools/gen-article.js data/articles/<slug>.json'); process.exit(1); }
const a = JSON.parse(fs.readFileSync(file, 'utf8'));
const slug = a.slug;

// 图片路径：文章页在 journal/ 下，需加 ../
const img = (src) => (src.startsWith('http') ? src : '../' + src);
const heroAbs = a.hero ? (a.hero.startsWith('http') ? a.hero : BASE + '/' + a.hero) : BASE + '/samples/photos/berlin-kino-400-1.jpg';

function block(b) {
  if (b.t === 'lead') return `    <p class="lead">${b.html}</p>`;
  if (b.t === 'p') return `    <p>${b.html}</p>`;
  if (b.t === 'h2') return `    <h2>${b.html}</h2>`;
  if (b.t === 'quote') return `    <blockquote class="article-quote">${b.html}</blockquote>`;
  if (b.t === 'fig') return `    <figure class="article-fig">\n      <img src="${img(b.src)}" alt="${b.alt || a.title}" loading="lazy" />\n      ${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}\n    </figure>`;
  return '';
}
function linksBlock() {
  if (!a.links || !a.links.length) return '';
  const items = a.links.map((l) => `<a href="../${l.href}">${l.label}</a>`).join('\n      ');
  return `    <h2>${a.linksTitle || '相关胶卷'}</h2>\n    <p class="article-links">\n      ${items}\n    </p>`;
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
<meta name="google-site-verification" content="${VERIFY}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${SITE}" />
<meta property="og:title" content="${a.title}" />
<meta property="og:description" content="${a.excerpt}" />
<meta property="og:url" content="${BASE}/journal/${slug}" />
<meta property="og:image" content="${heroAbs}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="../style.css" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${a.title}","description":"${a.excerpt}","image":"${heroAbs}","datePublished":"${a.date}","inLanguage":"zh-CN","author":{"@type":"Organization","name":"${SITE}"},"publisher":{"@type":"Organization","name":"${SITE}"},"mainEntityOfPage":{"@type":"WebPage","@id":"${BASE}/journal/${slug}"}}</script>
</head>
<body>
<header class="site-header">
  <div class="container">
    <div class="brand"><div class="brand-text"><div class="brand-lockup"><div class="brand-cn">${SITE}</div><span class="brand-en">Black &amp; White Film</span></div></div></div>
    <nav class="site-nav"><a href="../index.html">胶卷库</a><a class="active" href="../journal.html">资讯</a><a href="../about.html">关于</a></nav>
  </div>
</header>

<main class="container">
  <nav class="crumb"><a href="../index.html">首页</a> › <a href="../journal.html">资讯</a> › <span>${a.title}</span></nav>

  <article class="page article">
    <header class="article-head">
      <p class="article-meta">${a.meta}</p>
      <h1>${a.title}</h1>
    </header>

${a.blocks.map(block).filter(Boolean).join('\n\n')}

${linksBlock()}
    <p><a class="article-back" href="../index.html">← 回到胶卷库，搜你想查的那卷</a></p>
  </article>
</main>

<footer class="site-footer">
  <div class="container">
    <p class="footer-copy">© 2026 ${SITE}</p>
    <p class="footer-links"><a href="../disclaimer.html">免责声明</a><span class="dot">·</span><a href="../privacy.html">隐私政策</a></p>
  </div>
</footer>

<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${BEACON_TOKEN}"}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>`;

fs.writeFileSync('journal/' + slug + '.html', html);
console.log('✅ 生成 journal/' + slug + '.html');

// upsert journal.json
const jp = 'data/journal.json';
const j = JSON.parse(fs.readFileSync(jp, 'utf8'));
j.items = j.items.filter((x) => x.id !== 'j-' + slug);
j.items.unshift({ id: 'j-' + slug, type: a.type || 'article', title: a.title, excerpt: a.excerpt, date: a.date, link: 'journal/' + slug + '.html', media: a.hero || 'samples/photos/berlin-kino-400-1.jpg' });
fs.writeFileSync(jp, JSON.stringify(j, null, 2) + '\n');
console.log('✅ 资讯已收录，共', j.items.length, '条（首页显示前 2 条）');

// 更新 sitemap
const films = JSON.parse(fs.readFileSync('data/films.json', 'utf8')).films;
const arts = j.items.filter((it) => it.link && it.link.startsWith('journal/')).map((it) => it.link.replace('.html', ''));
const body = [
  '  <url><loc>' + BASE + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>',
  '  <url><loc>' + BASE + '/journal</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>',
  ...films.map((f) => '  <url><loc>' + BASE + '/film/' + f.id + '</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>'),
  ...arts.map((s) => '  <url><loc>' + BASE + '/' + s + '</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>'),
  '  <url><loc>' + BASE + '/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>',
  '  <url><loc>' + BASE + '/privacy</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>',
  '  <url><loc>' + BASE + '/disclaimer</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>'
].join('\n');
fs.writeFileSync('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n');
console.log('✅ sitemap 已更新，共', ((body.match(/<loc>/g) || []).length), '条');
console.log('\n下一步：git add -A && git commit -m "新文章：' + a.title + '" && git push origin master');
