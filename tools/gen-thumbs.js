// 生成样片缩略图（列表卡片/样片条用），并输出尺寸表
// 用法：node tools/gen-thumbs.js
// 产物：samples/photos/thumbs/*.jpg（宽 480、质量 80）+ data/photo-thumbs.json
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = 'samples/photos';
const OUT = 'samples/photos/thumbs';
const W = 480;
const Q = 80;

fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f));
const dims = {};
let made = 0, skipped = 0;

files.forEach((f) => {
  const src = SRC + '/' + f;
  const dst = OUT + '/' + f;
  const srcStat = fs.statSync(src);
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= srcStat.mtimeMs) { skipped++; }
  else {
    // 只在原图比目标宽时才缩放，否则只重新编码
    const w = +((execSync(`sips -g pixelWidth "${src}"`).toString().match(/pixelWidth:\s*(\d+)/) || [])[1] || 0);
    if (w > W) execSync(`sips -Z ${W} -s format jpeg -s formatOptions ${Q} "${src}" --out "${dst}"`);
    else execSync(`sips -s format jpeg -s formatOptions ${Q} "${src}" --out "${dst}"`);
    made++;
  }
  const o = execSync(`sips -g pixelWidth -g pixelHeight "${dst}"`).toString();
  dims[f] = [+((o.match(/pixelWidth:\s*(\d+)/) || [])[1] || 0), +((o.match(/pixelHeight:\s*(\d+)/) || [])[1] || 0)];
});

fs.writeFileSync('data/photo-thumbs.json', JSON.stringify(dims, null, 0) + '\n');
const size = (dir) => fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).reduce((s, f) => s + fs.statSync(dir + '/' + f).size, 0);
const kb = (n) => Math.round(n / 1024);
console.log('✅ 缩略图：新建/更新', made, '· 跳过', skipped, '· 共', Object.keys(dims).length, '张');
console.log('   原图总量', kb(size(SRC)), 'KB  →  缩略图总量', kb(size(OUT)), 'KB');
console.log('   单张示例：', Object.entries(dims).slice(0, 3).map(([k, v]) => k + ' ' + v.join('x')).join(' | '));
