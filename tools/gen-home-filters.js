// 把筛选栏（品牌/类型/尺寸/ISO/在产）静态渲染进 index.html 的 #filters
// 为什么：筛选 chips 原本靠 JS 注入，渲染完把下方 39 张卡 + 页脚整体顶下去
//        → Cloudflare 实测 section.toolbar-filters CLS 0.567、footer 0.239、#grid 0.217
// 用法：node tools/gen-home-filters.js   （改 films.json 后运行；gen-films.js 会自动调用）
const fs = require('fs');
const FT = require('../filter-template.js');

const films = JSON.parse(fs.readFileSync('data/films.json', 'utf8')).films;
const html = FT.filtersHTML(FT.optionsFromFilms(films));

let s = fs.readFileSync('index.html', 'utf8');
const re = /(<div class="filters" id="filters"[^>]*>)[\s\S]*?(\n\s*<\/div>)/;
if (!re.test(s)) { console.error('❌ 未找到 #filters 容器'); process.exit(1); }
s = s.replace(re, (m, p1, p2) => p1 + '\n' + html.split('\n').map((l) => '  ' + l).join('\n') + p2);
fs.writeFileSync('index.html', s);
console.log('✅ 首页静态渲染筛选栏', Object.keys(FT.optionsFromFilms(films)).length, '组');
