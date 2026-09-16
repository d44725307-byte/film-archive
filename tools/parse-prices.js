// 把 films.json 里的价格字符串解析成数值区间，供「筛选/排序/对比」使用
// 用法：node tools/parse-prices.js
// 原理：价格形如「约¥85–105」「约¥100–135」→ 拆成 price_num[fmt] = { lo, hi, mid }
// ⚠️ 只加派生字段，不动原来的字符串（页面显示仍用原字符串，保持人工可读）
const fs = require('fs');

const file = 'data/films.json';
const d = JSON.parse(fs.readFileSync(file, 'utf8'));

// 支持：约¥85–105 / ¥85-105 / 约 85–105 / 85 / 约¥100
function parsePrice(s) {
  if (!s || typeof s !== 'string') return null;
  const nums = String(s).match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const v = nums.map(Number);
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return { lo, hi, mid: Math.round((lo + hi) / 2) };
}

let filled = 0, empty = [];
d.films.forEach((f) => {
  f.price_num = { new: {}, used: {} };
  for (const kind of ['new', 'used']) {
    const src = kind === 'new' ? f.price_new : f.price_used;
    for (const fmt of ['135', '120']) {
      const p = parsePrice(src && src[fmt]);
      if (p) {
        f.price_num[kind][fmt] = p;
        if (kind === 'new') filled++;
      } else if (kind === 'new' && !(src && src[fmt])) {
        empty.push(`${f.id} ${fmt}`);
      }
    }
  }
});

d.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');

console.log('✅ 已解析价格 → price_num');
console.log('   可比较的「全新价」条目:', filled);
if (empty.length) console.log('   ⚠️ 缺价格（无法排序）:', empty.slice(0, 8).join(' / '), empty.length > 8 ? `…共 ${empty.length} 条` : '');

// 抽样验证
const sample = d.films.filter((f) => f.price_num.new['135']).slice(0, 5);
console.log('\n   抽样验证：');
sample.forEach((f) => {
  const s = f.price_new['135'], n = f.price_num.new['135'];
  console.log(`   ${(f.name_en + ' ').padEnd(22)} "${s}" → ${n.lo}–${n.hi}（中位 ${n.mid}）`);
});

// 顺便报一下最便宜/最贵的 135（这是 /rank 页要用的事实）
const withPrice = d.films.filter((f) => f.price_num.new['135'] && f.status === 'in-production');
const byPrice = [...withPrice].sort((a, b) => a.price_num.new['135'].mid - b.price_num.new['135'].mid);
console.log('\n   在产卷中最便宜的 5 卷（135 全新，按中位价）：');
byPrice.slice(0, 5).forEach((f) => console.log(`     ¥${f.price_num.new['135'].mid}  ${f.name_en}（${f.brand_cn}）`));
console.log('   在产卷中最贵的 3 卷：');
byPrice.slice(-3).reverse().forEach((f) => console.log(`     ¥${f.price_num.new['135'].mid}  ${f.name_en}（${f.brand_cn}）`));
