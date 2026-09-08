/* 黑白胶卷 —— 前端逻辑（纯原生，零依赖） */
(async function () {
  let FILMS = [];
  try {
    const res = await fetch('data/films.json');
    FILMS = (await res.json()).films || [];
  } catch (e) {
    document.getElementById('empty').hidden = false;
    document.getElementById('empty').textContent = '数据加载失败：' + e.message;
    return;
  }

  // ---- 常量映射（用于展示标签）----
  const BRAND_CN = {};   // brand(en) -> brand_cn
  FILMS.forEach((f) => { BRAND_CN[f.brand] = f.brand_cn || f.brand; });

  // ---- 外观：仅当填了 image(真实胶卷图 URL) 时才显示图，否则不显示 ----
  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  // 从「© 作者 · 胶卷名」提取作者名
  function cleanCredit(c) {
    let s = String(c || '').replace(/^©\s*/, '').trim();
    const i = s.indexOf(' · ');
    if (i >= 0) s = s.slice(0, i);
    return s.trim();
  }
  // 汇总一卷内所有样片作者（去重）
  function sampleAuthors(f) {
    const seen = [];
    (f.samples || []).forEach((s) => {
      if (s.credit) { const a = cleanCredit(s.credit); if (a && !seen.includes(a)) seen.push(a); }
    });
    return seen;
  }
  function filmArt(f) {
    if (!f.image) return '';
    return `<img class="film-art" src="${escapeXml(f.image)}" alt="${escapeXml(f.name_en)} 胶卷样式" loading="lazy">`;
  }

  const CATEGORY_LABEL = {
    traditional: '传统颗粒',
    tabular: 'T颗粒/平面颗粒',
    fine: '细腻/超微粒',
    'high-speed': '高速',
    cinema: '电影卷',
    chromogenic: '彩色工艺黑白',
    ortho: '正色卷',
    infrared: '红外卷',
    'direct-positive': '直接正片',
  };

  const GRAIN_LABEL = {
    'ultra-fine': '超微粒',
    fine: '细颗粒',
    medium: '中等颗粒',
    coarse: '粗颗粒',
  };

  const TYPE_LABEL = {
    panchromatic: '全色性',
    orthochromatic: '正色性',
    chromogenic: '彩色工艺冲洗',
  };

  const SCENE_LABEL = {
    street: '街头',
    portrait: '人像',
    documentary: '纪实',
    'low-light': '暗光/夜景',
    push: '迫冲',
    landscape: '风光',
    product: '静物/产品',
    'large-format': '大画幅',
    'fine-art': '艺术创作',
    action: '运动/动态',
    indoor: '室内',
    sports: '体育',
    cinematic: '电影感',
    event: '活动',
    travel: '旅行',
    'scan-friendly': '扫描友好',
    copy: '翻拍',
    studio: '棚拍',
    infrared: '红外',
    creative: '创意',
    'black-white': '黑白图形',
    architecture: '建筑',
    graphic: '图形/线条',
    retro: '复古',
    daily: '日常',
    sunlight: '阳光',
    'high-contrast': '高反差',
    'direct-positive': '直接正像',
    artistic: '艺术',
    laboratory: '实验室/翻拍',
    'all-purpose': '通用',
  };

  // ---- 英文标签映射（与上面中文一一对应，用于双语显示）----
  const CATEGORY_LABEL_EN = {
    traditional: 'Traditional', tabular: 'Tabular / T-Grain', fine: 'Fine / Ultra-Fine',
    'high-speed': 'High Speed', cinema: 'Cinema', chromogenic: 'C41 B&W',
    ortho: 'Orthochromatic', infrared: 'Infrared', 'direct-positive': 'Direct Positive',
  };
  const GRAIN_LABEL_EN = {
    'ultra-fine': 'Ultra Fine', fine: 'Fine', medium: 'Medium', coarse: 'Coarse',
  };
  const TYPE_LABEL_EN = {
    panchromatic: 'Panchromatic', orthochromatic: 'Orthochromatic', chromogenic: 'C41 Process',
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
  const catLabel = (c) => `${CATEGORY_LABEL[c] || c} · ${CATEGORY_LABEL_EN[c] || c}`;
  const grainLabel = (g) => `${GRAIN_LABEL[g] || g} · ${GRAIN_LABEL_EN[g] || g}`;
  const typeLabel = (t) => `${TYPE_LABEL[t] || t} · ${TYPE_LABEL_EN[t] || t}`;
  const sceneLabel = (s) => `${SCENE_LABEL[s] || s} · ${SCENE_LABEL_EN[s] || s}`;

  const FILM_CN = {};  // id -> name_cn
  FILMS.forEach((f) => { FILM_CN[f.id] = f.name_cn || ''; });

  // 价格：按格式(135/120)两行渲染，空则「待补」
  function priceLines(p) {
    const o = (p && typeof p === 'object') ? p : {};
    return ['135', '120'].map((fmt) => {
      const v = o[fmt];
      return `<span class="price-line"><span class="price-fmt">${fmt}</span><span class="price-num">${v ? escapeXml(v) : '待补'}</span></span>`;
    }).join('');
  }

  // ---- 筛选状态 ----
  const state = { q: '', brand: null, category: null, format: null, status: null, iso: null };

  // ---- 渲染筛选 chips ----
  function chip(label, active, onClick) {
    return `<button class="chip ${active ? 'chip-active' : ''}" data-onclick="${onClick}">${label}</button>`;
  }

  function renderFilters() {
    const brands = [...new Set(FILMS.map((f) => f.brand))];
    const categories = [...new Set(FILMS.map((f) => f.category))];
    const formats = [...new Set(FILMS.flatMap((f) => f.formats))];

    const isoBuckets = [
      { key: '50', label: '≤50', test: (i) => i <= 50 },
      { key: '100', label: '51–125', test: (i) => i >= 51 && i <= 125 },
      { key: '200', label: '126–250', test: (i) => i >= 126 && i <= 250 },
      { key: '400', label: '251–800', test: (i) => i >= 251 && i <= 800 },
      { key: '1600', label: '>800', test: (i) => i > 800 },
    ];

    const el = document.getElementById('filters');
    const h = [];
    h.push(`<div class="filter-group"><span class="filter-label">品牌</span><div class="filter-chips">${chip('全部', !state.brand, 'setBrand(null)')}${brands.map((b) => chip(BRAND_CN[b] || b, state.brand === b, `setBrand('${b}')`)).join('')}</div></div>`);

    h.push(`<div class="filter-group"><span class="filter-label">类型</span><div class="filter-chips">${chip('全部', !state.category, 'setCategory(null)')}${categories.map((c) => chip(CATEGORY_LABEL[c] || c, state.category === c, `setCategory('${c}')`)).join('')}</div></div>`);

    h.push(`<div class="filter-group"><span class="filter-label">尺寸</span><div class="filter-chips">${chip('全部', !state.format, 'setFormat(null)')}${formats.map((fm) => chip(fm, state.format === fm, `setFormat('${fm}')`)).join('')}</div></div>`);

    h.push(`<div class="filter-group"><span class="filter-label">ISO</span><div class="filter-chips">${chip('全部', !state.iso, 'setIso(null)')}${isoBuckets.map((b) => chip(b.label, state.iso === b.key, `setIso('${b.key}')`)).join('')}</div></div>`);

    h.push(`<div class="filter-group"><span class="filter-label">在产</span><div class="filter-chips">${chip('全部', !state.status, 'setStatus(null)')}${chip('在产', state.status === 'in', `setStatus('in')`)}${chip('停产', state.status === 'out', `setStatus('out')`)}</div></div>`);

    el.innerHTML = h.join('');
  }

  // ---- 过滤 + 计算 ----
  const isoBucketsTest = {
    '50': (i) => i <= 50,
    '100': (i) => i >= 51 && i <= 125,
    '200': (i) => i >= 126 && i <= 250,
    '400': (i) => i >= 251 && i <= 800,
    '1600': (i) => i > 800,
  };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return FILMS.filter((f) => {
      if (state.brand && f.brand !== state.brand) return false;
      if (state.category && f.category !== state.category) return false;
      if (state.format && !f.formats.includes(state.format)) return false;
      if (state.status === 'in' && f.status !== 'in-production') return false;
      if (state.status === 'out' && f.status !== 'discontinued') return false;
      if (state.iso && !isoBucketsTest[state.iso](f.iso)) return false;
      if (q) {
        const hay = (f.name_en + ' ' + (f.name_cn || '') + ' ' + f.brand + ' ' + (f.brand_cn || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ---- 渲染卡片 ----
  function statusBadge(f) {
    return f.status === 'discontinued' ? '<span class="badge badge-out">已停产</span>' : '<span class="badge badge-in">在产</span>';
  }

  function scenesChips(f) {
    return (f.scenes || []).map((s) => `<span class="scene-chip">${sceneLabel(s)}</span>`).join('');
  }

  function render() {
    const list = filtered();
    const grid = document.getElementById('grid');
    document.getElementById('stats').textContent = `共 ${list.length} 款`;
    document.getElementById('empty').hidden = list.length !== 0;

    grid.innerHTML = list.map((f) => `
      <a class="card" href="film/${f.id}.html" aria-label="查看 ${f.name_en} 胶卷详情">
        ${filmArt(f)}
        <div class="card-top">
          <span class="card-brand">${BRAND_CN[f.brand] || f.brand}</span>
          ${statusBadge(f)}
        </div>
        <h3 class="card-title">${f.name_en} <span class="title-suffix">胶卷</span></h3>
        <div class="card-meta">
          <span class="meta-item"><b>ISO ${f.iso}</b></span>
          <span class="meta-item">${catLabel(f.category)}</span>
          <span class="meta-item">${(f.formats || []).join(' · ')}</span>
        </div>
        <div class="card-desc">
          <span class="desc-cn">${f.character || ''}</span>
          <span class="desc-en">${f.character_en || ''}</span>
        </div>
        <div class="card-scenes">${scenesChips(f)}</div>
      </a>
    `).join('');
  }

  // ---- 详情弹窗 ----
  window.openDetail = function (id) {
    const f = FILMS.find((x) => x.id === id);
    if (!f) return;
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      ${filmArt(f) ? `<div class="modal-art">${filmArt(f)}</div>` : ''}
      <div class="modal-head">
        <div>
          <span class="card-brand">${BRAND_CN[f.brand] || f.brand}</span>
          ${statusBadge(f)}
        </div>
        <h2>${f.name_en} <span class="title-suffix">胶卷</span></h2>
        ${f.name_cn && f.name_cn !== f.name_en ? `<p class="sub">${f.name_cn}</p>` : ''}
      </div>
      <dl class="spec">
        <div><dt>感光度</dt><dd>ISO ${f.iso}</dd></div>
        <div><dt>类型</dt><dd>${typeLabel(f.type)}</dd></div>
        <div><dt>颗粒</dt><dd>${grainLabel(f.grain)}</dd></div>
        <div><dt>尺寸</dt><dd>${(f.formats || []).join(' · ')}</dd></div>
        <div><dt>分类</dt><dd>${catLabel(f.category)}</dd></div>
        <div><dt>状态</dt><dd>${f.status === 'discontinued' ? '已停产 · Discontinued' : '在产 · In production'}</dd></div>
      </dl>
      <div class="spec-block">
        <h4>特性 / 手感 · Character</h4>
        <p class="desc-cn">${f.character || ''}</p>
        <p class="desc-en">${f.character_en || '待补充'}</p>
      </div>
      <div class="spec-block"><h4>适用场景 · Best for</h4><div class="card-scenes">${scenesChips(f) || '待补充'}</div></div>
      <div class="spec-block">
        <h4>参考价格 · Price</h4>
        <p class="price-hint">停产卷通常只有二手价 · 价格随市场波动，仅供参考</p>
        <div class="price-config">
          <div class="price-cell">
            <span class="price-label">全新 New</span>
            <div class="price-fmtlist">${priceLines(f.price_new)}</div>
          </div>
          <div class="price-cell">
            <span class="price-label">二手 Used</span>
            <div class="price-fmtlist">${priceLines(f.price_used)}</div>
          </div>
        </div>
      </div>
      ${f.notes ? `<div class="spec-block"><h4>使用感受</h4><p class="usage-note">${escapeXml(f.notes)}</p></div>` : ''}
      ${f.samples && f.samples.length ? `
      <div class="spec-block">
        <h4>实拍样片</h4>
        <div class="sample-grid">
          ${f.samples.map((s) => `<figure class="sample"><img src="${escapeXml(s.src)}" alt="实拍样片" loading="lazy"></figure>`).join('')}
        </div>
        ${sampleAuthors(f).length ? `<p class="sample-credit">© ${escapeXml(sampleAuthors(f).join(' · '))}</p>` : ''}
      </div>` : ''}
      ${shareBlock(f)}
    `;
    document.getElementById('modal').hidden = false;
  };

  function closeModal() {
    document.getElementById('modal').hidden = true;
  }

  // ---- 全局筛选 setter ----
  window.setBrand = (v) => { state.brand = v; renderFilters(); render(); };
  window.setCategory = (v) => { state.category = v; renderFilters(); render(); };
  window.setFormat = (v) => { state.format = v; renderFilters(); render(); };
  window.setIso = (v) => { state.iso = v; renderFilters(); render(); };
  window.setStatus = (v) => { state.status = v; renderFilters(); render(); };

  // ---- 样片放大（lightbox）----
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  // ---- 卡片「长按保存」展示 ----
  const cardSave = document.getElementById('cardSave');
  const cardSaveImg = document.getElementById('cardSaveImg');
  function showCardSave(dataUrl) {
    cardSaveImg.src = dataUrl;
    cardSave.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeCardSave() {
    cardSave.hidden = true;
    cardSaveImg.src = '';
    document.body.style.overflow = '';
  }

  // ---- 分享卡 ----
  function shareBlock(f) {
    // 页面里不显示大卡片，只保留分享/下载操作；下载出的卡片含除价格外的全部资料
    return `
      <div class="spec-block">
        <h4>分享此胶卷 · Share</h4>
        <div class="share-actions">
          <button class="share-btn" onclick="shareAction('${f.id}','copy')">复制链接</button>
          <button class="share-btn" onclick="shareAction('${f.id}','native')">分享好友</button>
          <button class="share-btn share-btn-primary" onclick="shareAction('${f.id}','poster')">下载卡片</button>
        </div>
      </div>`;
  }

  function flash(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(flash._t);
    flash._t = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    // 返回 y：最后一行之后的下一行位置（避免后续内容叠到上一行）
    const chars = String(text).split('');
    let line = '', lineNo = 0;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x, y); line = chars[i]; y += lineH; lineNo++;
        if (maxLines && lineNo >= maxLines) { ctx.fillText(line.length > 1 ? line.slice(0, -1) + '…' : line, x, y); return y + lineH; }
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineH;
  }
  function shorten(ctx, text, maxW) {
    let s = String(text);
    while (s.length && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s.length < String(text).length ? s + '…' : s;
  }

  function loadImage(src) {
    return new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
  }

  async function makePoster(f) {
    const W = 1080;
    const full = document.createElement('canvas'); full.width = W; full.height = 2400;
    const ctx = full.getContext('2d');
    ctx.fillStyle = '#F3EDE0'; ctx.fillRect(0, 0, W, 2400);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#CFA94F'); g.addColorStop(0.5, '#1B3327'); g.addColorStop(1, '#A87A10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 12);
    ctx.textBaseline = 'top';
    // 品牌 + 状态
    ctx.fillStyle = '#A87A10'; ctx.font = '700 40px "Noto Serif SC","Songti SC",serif';
    ctx.fillText(f.brand_cn || f.brand, 84, 104);
    ctx.fillStyle = '#6E6C5A'; ctx.font = '500 30px "Noto Serif SC","Songti SC",serif';
    ctx.fillText(f.status === 'discontinued' ? '已停产' : '在产', W - 190, 108);
    // 标题
    ctx.fillStyle = '#3B3A33'; ctx.font = '900 90px "Noto Serif SC","Songti SC",serif';
    ctx.fillText(f.name_en + ' 胶卷', 84, 190);
    // 规格（可换行 1-2 行）
    const spec = 'ISO ' + f.iso + ' · ' + typeLabel(f.type) + ' · ' + grainLabel(f.grain) + ' · ' + (f.formats || []).join('·') + ' · ' + catLabel(f.category);
    ctx.fillStyle = '#6E6C5A'; ctx.font = '500 30px "Noto Serif SC","Songti SC",serif';
    let y = wrapText(ctx, spec, 84, 360, W - 168, 44, 2);
    // 分割线
    const divY = y + 30;
    ctx.strokeStyle = '#A87A10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(84, divY); ctx.lineTo(W - 84, divY); ctx.stroke();
    // 特性 CN + EN
    ctx.fillStyle = '#22402F'; ctx.font = '500 42px "Noto Serif SC","Songti SC",serif';
    y = wrapText(ctx, f.character || '', 84, divY + 60, W - 168, 62, 40);
    ctx.fillStyle = '#3B3A33'; ctx.font = 'italic 400 33px "Noto Serif SC","Songti SC",serif';
    y = wrapText(ctx, f.character_en || '', 84, y + 16, W - 168, 50, 40);
    // 适用场景
    const scenes = (f.scenes || []).map((s) => SCENE_LABEL[s] || s).join(' · ');
    let contentBottom = y;
    ctx.fillStyle = '#6E6C5A'; ctx.font = '500 32px "Noto Serif SC","Songti SC",serif';
    if (scenes) { contentBottom = wrapText(ctx, '适用场景：' + scenes, 84, y + 40, W - 168, 46, 40); }
    // 使用感受（完整显示，不截断）
    if (f.notes) {
      ctx.fillStyle = '#A87A10'; ctx.font = '700 30px "Noto Serif SC","Songti SC",serif';
      ctx.fillText('使用感受', 84, contentBottom + 48);
      ctx.fillStyle = '#22402F'; ctx.font = '500 33px "Noto Serif SC","Songti SC",serif';
      contentBottom = wrapText(ctx, f.notes, 84, contentBottom + 100, W - 168, 50, 40);
    }
    // 实拍样片缩略图
    let ty = contentBottom + 40;
    if (f.samples && f.samples.length) {
      const imgs = await Promise.all(f.samples.slice(0, 3).map((s) => loadImage(s.src)));
      const maxB = 200, gap = 20; let x = 84, maxTh = 0;
      imgs.forEach((im) => {
        if (!im) return;
        const ar = im.width / im.height;
        const thw = ar >= 1 ? maxB : maxB * ar;   // 横图宽=200、竖图按比例
        const th = ar >= 1 ? maxB / ar : maxB;    // 横图按比例、竖图高=200
        ctx.drawImage(im, x, ty, thw, th);
        x += thw + gap; maxTh = Math.max(maxTh, th);
      });
      const th = maxTh || 200;
      contentBottom = ty + th + 30;
      if (sampleAuthors(f).length) {
        ctx.fillStyle = '#6E6C5A'; ctx.font = '500 28px "Noto Serif SC","Songti SC",serif';
        ctx.fillText('© ' + sampleAuthors(f).join(' · '), 84, ty + th + 22);
      }
    }
    // 裁剪到内容高度 + 页脚
    const outH = Math.max(contentBottom + 260, 1000);
    const out = document.createElement('canvas'); out.width = W; out.height = outH;
    const octx = out.getContext('2d');
    octx.drawImage(full, 0, 0);
    octx.fillStyle = '#6E6C5A'; octx.font = 'italic 400 34px "Playfair Display",Georgia,serif';
    octx.fillText('Black & White Film', 84, outH - 132);
    octx.fillStyle = '#3B3A33'; octx.font = '700 34px "Noto Serif SC","Songti SC",serif';
    octx.fillText('黑白胶卷', 84, outH - 74);
    return out.toDataURL('image/png');
  }

  window.shareAction = async function (id, kind) {
    const f = FILMS.find((x) => x.id === id);
    if (!f) return;
    const url = location.origin + location.pathname + '#film-' + id;
    const title = f.name_en + ' 胶卷';
    const text = (f.brand_cn || f.brand) + ' ' + f.name_en + ' 胶卷 · ' + (f.character || '');
    try {
      if (kind === 'copy') { await navigator.clipboard.writeText(url); flash('链接已复制'); }
      else if (kind === 'native') {
        if (navigator.share) { await navigator.share({ title, text, url }); }
        else { await navigator.clipboard.writeText(url); flash('已复制链接'); }
      } else if (kind === 'poster') {
        await (document.fonts && document.fonts.ready);
        const dataUrl = await makePoster(f);
        const ttl = f.name_en + ' 胶卷';
        // 1) 优先 Web Share API（iOS/安卓可存相册/分享）
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], f.id + '.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: ttl });
            flash('已呼出分享/保存');
            return;
          }
        } catch (e) {}
        // 2) 手机：展示大图，长按保存到相册（http 也适用）
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
          showCardSave(dataUrl);
          flash('长按图片保存到相册');
        } else {
          // 3) 桌面：直接下载
          const a = document.createElement('a'); a.href = dataUrl; a.download = f.id + '.png'; a.click();
          flash('卡片已下载');
        }
      }
    } catch (e) { flash('操作失败'); }
  };

  // ---- 事件绑定 ----
  document.getElementById('search').addEventListener('input', (e) => {
    state.q = e.target.value;
    render();
  });
  // filter chips 事件委托
  document.getElementById('filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip[data-onclick]');
    if (!btn) return;
    eval(btn.dataset.onclick);
  });
  // 点样片 -> 放大查看
  document.getElementById('modal-body').addEventListener('click', (e) => {
    const img = e.target.closest('.sample img');
    if (img) { e.preventDefault(); openLightbox(img.getAttribute('src')); }
  });
  document.querySelectorAll('#modal [data-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.querySelectorAll('#lightbox [data-close]').forEach((el) => el.addEventListener('click', closeLightbox));
  document.querySelectorAll('#cardSave [data-cardsave-close]').forEach((el) => el.addEventListener('click', closeCardSave));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (cardSave && !cardSave.hidden) closeCardSave();
      else if (lightbox && !lightbox.hidden) closeLightbox();
      else closeModal();
    }
  });

  // ---- 首页「资讯」----
  const J_TYPE = { news: { cn: '新闻', cls: 'j-news' }, article: { cn: '文章', cls: 'j-article' }, work: { cn: '作品', cls: 'j-work' } };
  async function loadJournal() {
    const list = document.getElementById('journalList');
    if (!list) return;
    try {
      const res = await fetch('data/journal.json');
      const jd = await res.json();
      const items = (jd.items || []).slice(0, 2); // 首页只显示近期 2 条，更多进「更多」页
      list.innerHTML = items.map((it) => {
        const t = J_TYPE[it.type] || J_TYPE.news;
        return `
          <a class="j-item" href="${escapeXml(it.link || '#')}">
            ${it.media ? `<img class="j-media" src="${escapeXml(it.media)}" alt="" loading="lazy">` : ''}
            <div class="j-meta">
              <span class="j-type ${t.cls}">${t.cn}</span>
              <span class="j-date">${escapeXml(it.date || '')}</span>
            </div>
            <div class="j-body">
              <div class="j-title">${escapeXml(it.title)}</div>
              ${it.excerpt ? `<div class="j-excerpt">${escapeXml(it.excerpt)}</div>` : ''}
            </div>
          </a>`;
      }).join('');
    } catch (e) {
      list.innerHTML = '';
    }
  }
  loadJournal();

  // 启动
  renderFilters();
  render();
  // 深链直达：#film-xxx 打开对应卷
  const m = location.hash.match(/^#film-(.+)$/);
  if (m) { const f = FILMS.find((x) => x.id === m[1]); if (f) window.openDetail(f.id); }
  window.addEventListener('hashchange', () => {
    const mm = location.hash.match(/^#film-(.+)$/);
    if (mm) { const f = FILMS.find((x) => x.id === mm[1]); if (f) window.openDetail(f.id); }
  });
})();
