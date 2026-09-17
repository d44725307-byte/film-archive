// 「关注公众号」区块（浏览器 + 构建脚本共用，保证一次改处处生效）
// 为什么单独一个文件：该区块要出现在 首页/关于/筛选页/排行页/39 胶卷页/7 文章页，
// 共 50+ 个页面且部分是生成物 → 必须由一处定义、各处引用，否则以后改文案要改 50 遍。
// ⚠️ 二维码放在站点根目录（不放 samples/，因为 samples/* 是 30 天缓存，换码会不生效）
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FollowBlock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // prefix：根目录页用 ''，子目录页（film/、journal/、rank/）用 '../'
  function followHTML(prefix) {
    const p = prefix || '';
    return `<section class="follow-block">
  <div class="follow-text">
    <p class="follow-title">关注「观察家摄影」</p>
    <p class="follow-desc">新文章先发在公众号：器材吐槽、胶片行情、拍摄思路。<br />想看更新，扫码关注就好。</p>
    <p class="follow-hint">微信长按识别二维码</p>
  </div>
  <div class="follow-qr"><img src="${p}mp-qrcode.jpg" alt="观察家摄影 公众号二维码" width="480" height="480" loading="lazy" decoding="async" /></div>
</section>`;
  }
  return { followHTML };
});
