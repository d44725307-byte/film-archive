// 把 39 张胶卷卡片静态渲染进 index.html 的 #grid
// 好处：① 消除「JS 注入整片卡片区」造成的巨大布局偏移(CLS) ② 39 个胶卷链接直接进 HTML，SEO 更好
// 用法：node tools/gen-home-grid.js   （改 films.json 后运行；gen-films.js 会自动调用）
const fs = require('fs');
const CT = require('../card-template.js');

const films = JSON.parse(fs.readFileSync('data/films.json', 'utf8')).films;
const html = CT.gridHTML(films);

let s = fs.readFileSync('index.html', 'utf8');
const re = /(<section id="grid" class="grid"[^>]*>)[\s\S]*?(<\/section>)/;
if (!re.test(s)) { console.error('❌ 未找到 #grid 容器'); process.exit(1); }
s = s.replace(re, (m, p1, p2) => p1 + '\n' + html + '\n    ' + p2);
// 同步「共 N 款」
s = s.replace(/(<[^>]*id="stats"[^>]*>)[^<]*(<\/)/, '$1共 ' + films.length + ' 款$2');
fs.writeFileSync('index.html', s);
console.log('✅ 首页静态渲染', films.length, '张胶卷卡片');
