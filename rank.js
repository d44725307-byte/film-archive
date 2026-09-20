/* 排行 / 筛选页的客户端逻辑（零依赖）
   数据由页面内嵌的 window.__RANK_FILMS 提供；筛选状态记在 URL 的 # 参数里，
   所以「筛好的结果」可以直接分享（例：/rank#iso=400&max=60&sort=price） */
(function () {
  var FILMS = window.__RANK_FILMS || [];
  var CAT = window.__RANK_CAT || {};
  var GRAIN = window.__RANK_GRAIN || {};
  var state = { fmt: '', iso: '', st: '', max: '', sort: 'price' };

  function readHash() {
    var h = String(location.hash || (window.__RANK_INIT || '')).replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var k = decodeURIComponent(kv.slice(0, i));
      var v = decodeURIComponent(kv.slice(i + 1));
      if (k in state) state[k] = v;
    });
    // 防御：URL 里的筛选值可能被手改、或被转发的坏链接带进来（例：#iso=250）。
    // 未知值一律回落成「全部」——否则下面 fmtTEST/fmtISO 取到 undefined 会直接抛错，
    // 整个 render() 中断，页面变成白板（只剩「共 — 卷」）。
    if (state.fmt && !fmtTEST[state.fmt]) state.fmt = '';
    if (state.iso && !fmtISO[state.iso]) state.iso = '';
    if (state.max && !(parseFloat(state.max) > 0)) state.max = '';
  }
  function writeHash() {
    var parts = [];
    Object.keys(state).forEach(function (k) {
      if (state[k] && !(k === 'sort' && state[k] === 'price')) parts.push(k + '=' + encodeURIComponent(state[k]));
    });
    var h = parts.length ? '#' + parts.join('&') : '';
    if (h !== location.hash) history.replaceState(null, '', location.pathname + location.search + h);
  }

  var fmtISO = { '100': function (i) { return i <= 100; }, '400': function (i) { return i === 400; }, '800': function (i) { return i >= 800; } };
  var fmtTEST = { '35mm': function (f) { return f.fm.indexOf('35mm') >= 0; }, '120': function (f) { return f.fm.indexOf('120') >= 0; }, '4x5': function (f) { return f.fm.indexOf('4x5') >= 0; } };

  function filtered() {
    var list = FILMS.filter(function (f) {
      if (state.fmt && fmtTEST[state.fmt] && !fmtTEST[state.fmt](f)) return false;
      if (state.iso && fmtISO[state.iso] && !fmtISO[state.iso](f.iso)) return false;
      if (state.st !== '' && String(f.st) !== state.st) return false;
      if (state.max) {
        var p = f.p135 === null ? f.p120 : f.p135;
        if (p === null || p > +state.max) return false;
      }
      return true;
    });
    var by = {
      'price': function (a, b) { return (price(a) || 9e9) - (price(b) || 9e9); },
      'price-desc': function (a, b) { return (price(b) || -1) - (price(a) || -1); },
      'iso': function (a, b) { return a.iso - b.iso || (price(a) || 9e9) - (price(b) || 9e9); },
      'name': function (a, b) { return a.n.localeCompare(b.n); },
    };
    return list.sort(by[state.sort] || by['price']);
  }
  function price(f) { return f.p135 !== null ? f.p135 : f.p120; }

  function row(f) {
    var img = f.img
      ? '<img class="rank-thumb" src="/' + f.img + '" alt="' + esc(f.n) + ' 样片" loading="lazy" decoding="async">'
      : '<span class="rank-thumb rank-thumb-empty" aria-hidden="true"></span>';
    var priceTxt = f.p135s
      ? '<b>' + esc(f.p135s) + '</b><span class="rank-price-fmt">135 全新</span>'
      : (f.p120s ? '<b>' + esc(f.p120s) + '</b><span class="rank-price-fmt">120 全新</span>' : '<span class="rank-price-fmt">价格待补</span>');
    var badges = [];
    if (!f.st) badges.push('<span class="badge badge-out">已停产</span>');
    return '<a class="rank-row" href="/film/' + f.id + '">'
      + img
      + '<span class="rank-main">'
      + '<span class="rank-name">' + esc(f.n) + '</span>'
      + '<span class="rank-meta">' + esc(f.b) + ' · ISO ' + f.iso + ' · ' + esc(f.fm.join('/')) + '</span>'
      + '<span class="rank-tags">' + (CAT[f.c] ? '<span class="scene-chip">' + esc(CAT[f.c]) + '</span>' : '')
      + (GRAIN[f.g] ? '<span class="scene-chip">' + esc(GRAIN[f.g]) + '</span>' : '') + badges.join('') + '</span>'
      + '</span>'
      + '<span class="rank-price">' + priceTxt + '</span>'
      + '</a>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }

  function render() {
    var list = filtered();
    document.getElementById('rankList').innerHTML = list.map(row).join('');
    document.getElementById('rankStats').textContent = '共 ' + list.length + ' 卷' + (list.length !== FILMS.length ? '（全站 ' + FILMS.length + ' 卷）' : '');
    document.getElementById('rankEmpty').hidden = list.length !== 0;
    document.querySelectorAll('.rank-controls .filter-chips').forEach(function (box) {
      var g = box.getAttribute('data-group');
      box.querySelectorAll('.chip').forEach(function (btn) {
        btn.classList.toggle('chip-active', (state[g] || '') === (btn.getAttribute('data-v') || ''));
      });
    });
  }

  document.querySelectorAll('.rank-controls .filter-chips').forEach(function (box) {
    var g = box.getAttribute('data-group');
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      state[g] = btn.getAttribute('data-v') || '';
      // ISO/在产/规格 互斥切换时保持其它条件
      writeHash();
      render();
    });
  });
  window.addEventListener('hashchange', function () { readHash(); render(); });

  readHash();
  render();
  // 首次进入若 URL 没带参数、但预设页给了初始值 → 写进 hash 便于分享
  writeHash();
})();
