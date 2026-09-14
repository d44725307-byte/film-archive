// 胶卷卡片模板（浏览器 + 构建脚本共用，保证「静态渲染」与「JS 渲染」完全一致）
// ⚠️ 改卡片样式/标签时：只需改这里；app.js 里 modal 的标签是独立副本，如需同步请一并改。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardTemplate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CATEGORY_LABEL = {
    traditional: '传统颗粒', tabular: 'T颗粒/平面颗粒', fine: '细腻/超微粒',
    'high-speed': '高速', cinema: '电影卷', chromogenic: '彩色工艺黑白',
    ortho: '正色卷', infrared: '红外卷', 'direct-positive': '直接正片',
  };
  const CATEGORY_LABEL_EN = {
    traditional: 'Traditional', tabular: 'Tabular / T-Grain', fine: 'Fine / Ultra-Fine',
    'high-speed': 'High Speed', cinema: 'Cinema', chromogenic: 'C41 B&W',
    ortho: 'Orthochromatic', infrared: 'Infrared', 'direct-positive': 'Direct Positive',
  };
  const SCENE_LABEL = {
    street: '街头', portrait: '人像', documentary: '纪实', 'low-light': '暗光/夜景',
    push: '迫冲', landscape: '风光', product: '静物/产品', 'large-format': '大画幅',
    'fine-art': '艺术创作', action: '运动/动态', indoor: '室内', sports: '体育',
    cinematic: '电影感', event: '活动', travel: '旅行', 'scan-friendly': '扫描友好',
    copy: '翻拍', studio: '棚拍', infrared: '红外', creative: '创意',
    'black-white': '黑白图形', architecture: '建筑', graphic: '图形/线条', retro: '复古',
    daily: '日常', sunlight: '阳光', 'high-contrast': '高反差', 'direct-positive': '直接正像',
    artistic: '艺术', laboratory: '实验室/翻拍', 'all-purpose': '通用',
  };
  const SCENE_LABEL_EN = {
    street: 'Street', portrait: 'Portrait', documentary: 'Documentary', 'low-light': 'Low Light',
    push: 'Push', landscape: 'Landscape', product: 'Still Life', 'large-format': 'Large Format',
    'fine-art': 'Fine Art', action: 'Action', indoor: 'Indoor', sports: 'Sports', cinematic: 'Cinematic',
    event: 'Event', travel: 'Travel', 'scan-friendly': 'Scan Friendly', copy: 'Copy', studio: 'Studio',
    infrared: 'Infrared', creative: 'Creative', 'black-white': 'B&W Graphic', architecture: 'Architecture',
    graphic: 'Graphic / Line', retro: 'Retro', daily: 'Daily', sunlight: 'Sunlight',
    'high-contrast': 'High Contrast', 'direct-positive': 'Direct Positive', artistic: 'Artistic',
    laboratory: 'Laboratory', 'all-purpose': 'All-Around',
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const catLabel = (c) => `${CATEGORY_LABEL[c] || c} · ${CATEGORY_LABEL_EN[c] || c}`;
  const sceneLabel = (s) => `${SCENE_LABEL[s] || s} · ${SCENE_LABEL_EN[s] || s}`;
  const scenesChips = (f) => (f.scenes || []).map((s) => `<span class="scene-chip">${esc(sceneLabel(s))}</span>`).join('');
  const statusBadge = (f) => (f.status === 'discontinued' ? '<span class="badge badge-out">已停产</span>' : '<span class="badge badge-in">在产</span>');
  const filmArt = (f) => (f.image ? `<img class="film-art" src="${esc(f.image)}" alt="${esc(f.name_en)} 胶卷样式" loading="lazy">` : '');

  // 单张卡片（结构与 app.js render() 完全一致）
  function cardHTML(f) {
    return `      <a class="card" href="film/${f.id}.html" aria-label="查看 ${esc(f.name_en)} 胶卷详情">
        ${filmArt(f)}
        <div class="card-top">
          <span class="card-brand">${esc(f.brand_cn || f.brand)}</span>
          ${statusBadge(f)}
        </div>
        <h3 class="card-title">${esc(f.name_en)} <span class="title-suffix">胶卷</span></h3>
        <div class="card-meta">
          <span class="meta-item"><b>ISO ${f.iso}</b></span>
          <span class="meta-item">${esc(catLabel(f.category))}</span>
          <span class="meta-item">${esc((f.formats || []).join(' · '))}</span>
        </div>
        <div class="card-desc">
          <span class="desc-cn">${esc(f.character || '')}</span>
          <span class="desc-en">${esc(f.character_en || '')}</span>
        </div>
        <div class="card-scenes">${scenesChips(f)}</div>
      </a>`;
  }
  function gridHTML(films) { return films.map(cardHTML).join('\n'); }

  return { cardHTML, gridHTML, scenesChips, catLabel, sceneLabel, statusBadge, filmArt, CATEGORY_LABEL, SCENE_LABEL, esc };
});
