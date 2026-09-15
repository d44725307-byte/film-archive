// 给文章页加「分享文章」区块 + 分享脚本 + 长按保存浮层
const fs = require('fs');
const f = 'tools/gen-article.js';
let s = fs.readFileSync(f, 'utf8');

// 1) 分享区块（放在「相关阅读」之前，即文章主体结尾）
const SHARE = `    <h2>分享这篇文章</h2>
    <div class="share-actions">
      <button class="share-btn" onclick="articleShare('copy')">复制链接</button>
      <button class="share-btn" onclick="articleShare('native')">分享好友</button>
      <button class="share-btn share-btn-primary" onclick="articleShare('card')">存分享图</button>
    </div>
    <p class="share-note">存出的分享图可直接发朋友圈；发微信群后若没预览，用「复制链接」粘贴即可。</p>
`;
if (!s.includes('分享这篇文章')) {
  s = s.replace('${linksBlock()}\n${relatedBlock()}', '${linksBlock()}\n' + SHARE + '${relatedBlock()}');
  console.log('  ✅ 加分享区块');
}

// 2) 注入 window.__article + 引入 article.js + 浮层元素
if (!s.includes('__article')) {
  s = s.replace(
    '${BEACON}\n</body>',
    `<div id="cardSave" class="card-save" hidden><div class="card-save-backdrop" data-cardsave-close></div><div class="card-save-body"><img id="cardSaveImg" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="分享图" /><p class="card-save-hint">长按 / 按住图片，选择「保存图片」即可存入相册</p><button class="card-save-close" data-cardsave-close aria-label="关闭">×</button></div></div>
<div id="toast" class="toast" aria-live="polite"></div>
<script>window.__article={title:${JSON.stringify(a.title)},excerpt:${JSON.stringify(a.excerpt)},slug:${JSON.stringify(a.slug)},hero:${JSON.stringify(heroThumb.replace(BASE + '/', '../'))},url:${JSON.stringify(BASE + '/journal/' + a.slug)}};</script>
<script src="../article.js"></script>
\${BEACON}
</body>`
  );
  // 模板字符串里的 ${BEACON} 需要转义回模板语义
  s = s.replace('\\${BEACON}', '${BEACON}');
  console.log('  ✅ 注入 __article + article.js + 浮层');
}
fs.writeFileSync(f, s);
