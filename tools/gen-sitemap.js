// 统一生成 sitemap.xml（从各数据源汇总）
// 用法：node tools/gen-sitemap.js
// 为什么抽出来：原来 sitemap 生成写在 gen-article.js 内部，导致「新增页面类型」时
// 很容易漏（榜单页就是这么差点漏掉的）。这里作为唯一出口，新增页面类型只需加一行。
const fs = require('fs');
const BASE = 'https://filmstockhub.com';

const films = JSON.parse(fs.readFileSync('data/films.json', 'utf8')).films;
const journal = JSON.parse(fs.readFileSync('data/journal.json', 'utf8'));
const arts = journal.items
  .filter((it) => it.link && it.link.indexOf('journal/') === 0)
  .map((it) => it.link.replace(/\.html$/, ''));

// 排行/筛选页（预设页 + 主页面）
const RANK_PRESETS = ['zuipianyi', 'iso400', 'kouchailiang', '120'];

const urls = [
  ['/', 'weekly', '1.0'],
  ['/journal', 'weekly', '0.8'],
  // 排行页优先级给高：它是「筛选型搜索」（最便宜的黑白卷 / ISO400 有哪些）的落地页
  ['/rank', 'weekly', '0.9'],
  ...RANK_PRESETS.map((s) => ['/rank/' + s, 'weekly', '0.8']),
  ...films.map((f) => ['/film/' + f.id, 'monthly', '0.8']),
  ...arts.map((s) => ['/' + s, 'monthly', '0.7']),
  ['/about', 'monthly', '0.5'],
  ['/privacy', 'monthly', '0.3'],
  ['/disclaimer', 'monthly', '0.3'],
];

const body = urls.map(([u, cf, pr]) =>
  `  <url><loc>${BASE}${u}</loc><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`
).join('\n');

fs.writeFileSync('sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n');

console.log('✅ sitemap 已更新，共', urls.length, '条',
  `（首页1 + 资讯1 + 排行${1 + RANK_PRESETS.length} + 胶卷${films.length} + 文章${arts.length} + 其他3）`);
