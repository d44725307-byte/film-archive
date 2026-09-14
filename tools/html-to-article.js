// 把「手写」的文章页反向转成生成器用的 JSON（统一到一套流程）
// 用法：node tools/html-to-article.js journal/bishilian.html data/articles/bishilian.json
const fs = require('fs');

const [src, dst] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');
const body = s.slice(s.indexOf('<article'), s.indexOf('</article>'));
// 先剥掉「非正文」区块：meta 行、分享区、相关阅读、相关胶卷链接、返回链接
let body2 = body
  .replace(/<p class="article-meta"[\s\S]*?<\/p>/, '')
  .replace(/<h2>分享这篇文章<\/h2>[\s\S]*?<\/p>/, '')
  .replace(/<h2>相关阅读<\/h2>[\s\S]*?<\/ul>/, '')
  .replace(/<p class="article-links"[\s\S]*?<\/p>/, '')
  .replace(/<p><a class="article-back"[\s\S]*?<\/p>/, '');
const txt = (h) => h.replace(/<[^>]+>/g, '').trim();

const title = txt((body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
const meta = txt((body.match(/<p class="article-meta"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
const excerpt = ((s.match(/name="description" content="([^"]*)"/) || [])[1] || '').trim();
const heroFull = ((s.match(/property="og:image" content="([^"]*)"/) || [])[1] || '');
// og:image 是 thumbs 图，还原成原图路径
const hero = heroFull.replace('/samples/photos/thumbs/', '/samples/photos/').replace(/^https?:\/\/[^/]+\//, '');

const blocks = [];
const re = /(<h2[^>]*>[\s\S]*?<\/h2>|<p class="lead"[^>]*>[\s\S]*?<\/p>|<p[^>]*>[\s\S]*?<\/p>|<figure class="article-fig">[\s\S]*?<\/figure>|<blockquote class="article-quote"[^>]*>[\s\S]*?<\/blockquote>)/g;
let m;
while ((m = re.exec(body2))) {
  const h = m[1];
  if (h.startsWith('<h2')) blocks.push({ t: 'h2', html: txt(h) });
  else if (h.startsWith('<p class="lead"')) blocks.push({ t: 'lead', html: h.replace(/^<p[^>]*>/, '').replace(/<\/p>$/, '').trim() });
  else if (h.startsWith('<blockquote')) blocks.push({ t: 'quote', html: txt(h) });
  else if (h.startsWith('<figure')) {
    const im = (h.match(/<img[^>]*src="([^"]*)"/) || [])[1] || '';
    const cap = txt((h.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || '');
    const alt = (h.match(/alt="([^"]*)"/) || [])[1] || title;
    blocks.push({ t: 'fig', src: im.replace(/^\.\.\//, '').replace('/samples/photos/thumbs/', '/samples/photos/'), caption: cap, alt });
  } else {
    const html = h.replace(/^<p[^>]*>/, '').replace(/<\/p>$/, '').trim();
    if (html) blocks.push({ t: 'p', html });
  }
}
// 相关胶卷链接
const links = [...body.matchAll(/<a href="\.\.\/(film\/[^"]+)"[^>]*>([^<]+)<\/a>/g)].map((x) => ({ label: x[2].trim(), href: x[1] }));

const art = {
  slug: src.replace(/^journal\//, '').replace(/\.html$/, ''),
  title, meta, date: (meta.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
  type: 'article', excerpt, hero,
  blocks,
  linksTitle: '查这些卷的详情',
  links,
};
fs.writeFileSync(dst, JSON.stringify(art, null, 2) + '\n');
console.log('✅ 转换完成 →', dst);
console.log('   标题:', title);
console.log('   blocks:', blocks.length, '| 图片:', blocks.filter((b) => b.t === 'fig').length, '| 链接:', links.length);
