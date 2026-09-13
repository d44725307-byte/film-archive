// 一键切换站点域名
// 用法：node tools/set-domain.js filmstockhub.com            # 执行替换
//       node tools/set-domain.js filmstockhub.com --dry      # 只预览，不写入
// 作用：把全站的旧域名（pages.dev）统一替换成新域名，包括：
//   · 生成器里的 BASE 常量（tools/gen-films.js / tools/gen-article.js）
//   · 所有已生成的 .html（canonical / og:url / og:image / JSON-LD）
//   · sitemap.xml / robots.txt
const fs = require('fs');
const path = require('path');

const NEW = (process.argv[2] || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
if (!NEW || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(NEW)) {
  console.error('用法: node tools/set-domain.js <新域名> [--dry]   例: node tools/set-domain.js filmstockhub.com');
  process.exit(1);
}
const NEW_BASE = 'https://' + NEW;

// 收集旧域名（从现有文件里推断）
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|xml|txt|js|json)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk('.');
const oldHosts = new Set();
files.forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  [...s.matchAll(/https?:\/\/([a-z0-9-]+\.pages\.dev)/gi)].forEach((m) => oldHosts.add(m[1]));
});
if (!oldHosts.size) { console.log('未发现 pages.dev 旧域名（可能已切换过）'); }
console.log('旧域名:', [...oldHosts].join(', ') || '(无)');
console.log('新域名:', NEW, DRY ? '（预览模式，不写入）' : '');

let changed = 0, total = 0;
files.forEach((f) => {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  oldHosts.forEach((h) => { s = s.split(h).join(NEW); });
  if (s !== before) {
    const n = (before.match(/pages\.dev/g) || []).length;
    total += n; changed++;
    console.log('  ' + (DRY ? '[预览] ' : '') + '改 ' + n + ' 处  ' + f);
    if (!DRY) fs.writeFileSync(f, s);
  }
});
console.log('\n共修改文件', changed, '个 / 替换', total, '处');
if (DRY) console.log('（预览模式：未写入任何文件）');
else console.log('✅ 完成。下一步：git add -A && git commit -m "切换域名到 ' + NEW + '" && git push origin master');
