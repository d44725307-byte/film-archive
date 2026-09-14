// 筛选栏模板（浏览器 + 构建脚本共用）
// 为什么要有这个文件：筛选 chips 原来是 app.js 拉完 films.json 后 innerHTML 注入的，
// 会把下方的 #grid(39 张卡) 与页脚整体顶下去 → Cloudflare 实测 section.toolbar-filters CLS 0.567。
// 现在改为构建期静态渲染进 index.html（tools/gen-home-filters.js），浏览器只切换选中态，不再重建 DOM。
// ⚠️ 改筛选栏（选项、分组、标签）时：只改这里，然后跑 node tools/gen-home-filters.js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FilterTemplate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CATEGORY_LABEL = {
    traditional: '传统颗粒', tabular: 'T颗粒/平面颗粒', fine: '细腻/超微粒',
    'high-speed': '高速', cinema: '电影卷', chromogenic: '彩色工艺黑白',
    ortho: '正色卷', infrared: '红外卷', 'direct-positive': '直接正片',
  };
  const ISO_BUCKETS = [
    { key: '50', label: '≤50', test: (i) => i <= 50 },
    { key: '100', label: '51–125', test: (i) => i >= 51 && i <= 125 },
    { key: '200', label: '126–250', test: (i) => i >= 126 && i <= 250 },
    { key: '400', label: '251–800', test: (i) => i >= 251 && i <= 800 },
    { key: '1600', label: '>800', test: (i) => i > 800 },
  ];
  const STATUS_OPTIONS = [
    { key: 'in', label: '在产' },
    { key: 'out', label: '停产' },
  ];
  const ALL_LABEL = '全部';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  // 从 films.json 数据推导各分组选项（顺序与旧版 JS 完全一致：按数据出现顺序）
  function optionsFromFilms(films) {
    const brand_cn = {};
    films.forEach((f) => { brand_cn[f.brand] = f.brand_cn || f.brand; });
    const uniq = (arr) => arr.filter((v, i, a) => a.indexOf(v) === i);
    return {
      brand: uniq(films.map((f) => f.brand)).map((b) => ({ key: b, label: brand_cn[b] || b })),
      category: uniq(films.map((f) => f.category)).map((c) => ({ key: c, label: CATEGORY_LABEL[c] || c })),
      format: uniq(films.flatMap((f) => f.formats || [])).map((fm) => ({ key: fm, label: fm })),
      iso: ISO_BUCKETS.map((b) => ({ key: b.key, label: b.label })),
      status: STATUS_OPTIONS.map((s) => ({ key: s.key, label: s.label })),
    };
  }

  function chip(group, key, label, active) {
    // data-filter/data-value 由 app.js 读取并绑定点击（不用内联 onclick，见 app.js bindFilters）
    return `<button type="button" class="chip${active ? ' chip-active' : ''}" data-filter="${esc(group)}" data-value="${esc(key)}">${esc(label)}</button>`;
  }

  function groupHTML(group, label, opts) {
    const chips = chip(group, '', ALL_LABEL, true) + opts.map((o) => chip(group, o.key, o.label, false)).join('');
    return `      <div class="filter-group"><span class="filter-label">${esc(label)}</span><div class="filter-chips">${chips}</div></div>`;
  }

  // 完整筛选栏 HTML（5 组：品牌 / 类型 / 尺寸 / ISO / 在产）
  function filtersHTML(opts) {
    return [
      groupHTML('brand', '品牌', opts.brand),
      groupHTML('category', '类型', opts.category),
      groupHTML('format', '尺寸', opts.format),
      groupHTML('iso', 'ISO', opts.iso),
      groupHTML('status', '在产', opts.status),
    ].join('\n');
  }

  return { filtersHTML, optionsFromFilms, CATEGORY_LABEL, ISO_BUCKETS, STATUS_OPTIONS, ALL_LABEL, esc };
});
