// 把首页「资讯」的前 2 条静态渲染进 index.html
// 好处：① 消除 JS 注入造成的布局偏移(CLS) ② 文章链接直接出现在 HTML 里，SEO 更好 ③ 少一次请求
// 用法：node tools/gen-home-journal.js   （改完 journal.json 后运行；gen-article.js 会自动调用）
const fs = require('fs');

const J_TYPE = { news: { cn: '新闻', cls: 'j-news' }, article: { cn: '文章', cls: 'j-article' }, work: { cn: '作品', cls: 'j-work' } };
const esc = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const journal = JSON.parse(fs.readFileSync('data/journal.json', 'utf8'));
const dims = JSON.parse(fs.readFileSync('data/photo-thumbs.json', 'utf8'));
const items = (journal.items || []).slice(0, 2);

const html = items.map((it, idx) => {
  const t = J_TYPE[it.type] || J_TYPE.news;
  const thumb = it.media ? String(it.media).replace('samples/photos/', 'samples/photos/thumbs/') : '';
  const d = thumb ? dims[thumb.split('/').pop()] : null;
  const size = d ? ` width="${d[0]}" height="${d[1]}"` : '';
  // ⚠️ 前两张都在手机首屏内（单列排版）→ 都 eager。
  // 第 2 张不给 fetchpriority=high，避免和第 1 张抢带宽（它才是 LCP 候选）。
  const load = idx === 0
    ? 'loading="eager" fetchpriority="high" decoding="async"'
    : (idx === 1 ? 'loading="eager" fetchpriority="low" decoding="async"' : 'loading="lazy" decoding="async"');
  return `        <a class="j-item" href="${esc(it.link || '#')}">
          ${thumb ? `<img class="j-media" src="${esc(thumb)}" alt="${esc(it.title)}"${size} ${load}>` : ''}
          <div class="j-meta">
            <span class="j-type ${t.cls}">${t.cn}</span>
            <span class="j-date">${esc(it.date || '')}</span>
          </div>
          <div class="j-body">
            <div class="j-title">${esc(it.title)}</div>
            ${it.excerpt ? `<div class="j-excerpt">${esc(it.excerpt)}</div>` : ''}
          </div>
        </a>`;
}).join('\n');

let s = fs.readFileSync('index.html', 'utf8');
const re = /(<div class="journal-list" id="journalList">)[\s\S]*?(<\/div>\s*<\/section>)/;
if (!re.test(s)) { console.error('❌ 未找到 journalList 容器'); process.exit(1); }
s = s.replace(re, (m, p1, p2) => p1 + '\n' + html + '\n      ' + p2);
fs.writeFileSync('index.html', s);
console.log('✅ 首页资讯已静态渲染', items.length, '条：', items.map((i) => i.title.slice(0, 16)).join(' / '));
