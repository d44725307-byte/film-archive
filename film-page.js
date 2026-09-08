// 独立胶卷页：样片放大 + 下载卡片 + 分享（依赖页面里 window.__film）
(function () {
  const CATEGORY_LABEL = { traditional: '传统颗粒', tabular: 'T颗粒/平面颗粒', fine: '细腻/超微粒', 'high-speed': '高速', cinema: '电影卷', chromogenic: '彩色工艺黑白', ortho: '正色卷', infrared: '红外卷', 'direct-positive': '直接正片' };
  const GRAIN_LABEL = { 'ultra-fine': '超微粒', fine: '细颗粒', medium: '中等颗粒', coarse: '粗颗粒' };
  const TYPE_LABEL = { panchromatic: '全色性', orthochromatic: '正色性', chromogenic: '彩色工艺冲洗' };
  const SCENE_LABEL = { street: '街头', portrait: '人像', documentary: '纪实', 'low-light': '暗光', push: '迫冲', landscape: '风光', product: '静物', 'large-format': '大画幅', 'fine-art': '艺术', action: '运动', indoor: '室内', sports: '体育', cinematic: '电影感', event: '活动', travel: '旅行', 'scan-friendly': '扫描友好', copy: '翻拍', studio: '棚拍', infrared: '红外', creative: '创意', 'black-white': '黑白图形', architecture: '建筑', graphic: '图形线条', retro: '复古', daily: '日常', sunlight: '阳光', 'high-contrast': '高反差', 'direct-positive': '直接正像', artistic: '艺术', laboratory: '实验室', 'all-purpose': '通用' };
  const catLabel = (c) => CATEGORY_LABEL[c] || c;
  const grainLabel = (g) => GRAIN_LABEL[g] || g;
  const typeLabel = (t) => TYPE_LABEL[t] || t;

  function escapeXml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function cleanCredit(c) { let s = String(c || '').replace(/^©\s*/, '').trim(); const i = s.indexOf(' · '); if (i >= 0) s = s.slice(0, i); return s.trim(); }
  function sampleAuthors(f) { const seen = []; (f.samples || []).forEach((s) => { if (s.credit) { const a = cleanCredit(s.credit); if (a && !seen.includes(a)) seen.push(a); } }); return seen; }
  function loadImage(src) { return new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; }); }
  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const chars = String(text).split(''); let line = '', lineNo = 0;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW) { ctx.fillText(line, x, y); line = chars[i]; y += lineH; lineNo++; if (maxLines && lineNo >= maxLines) { ctx.fillText(line.length > 1 ? line.slice(0, -1) + '…' : line, x, y); return y + lineH; } } else line = test;
    }
    if (line) ctx.fillText(line, x, y); return y + lineH;
  }
  function shorten(ctx, text, maxW) { let s = String(text); while (s.length && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s.length < String(text).length ? s + '…' : s; }

  const f = window.__film;
  function flash(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(flash._t); flash._t = setTimeout(() => t.classList.remove('show'), 2000); }

  async function makePoster(film) {
    const W = 1080, full = document.createElement('canvas'); full.width = W; full.height = 2400;
    const ctx = full.getContext('2d');
    ctx.fillStyle = '#F3EDE0'; ctx.fillRect(0, 0, W, 2400);
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#CFA94F'); g.addColorStop(0.5, '#1B3327'); g.addColorStop(1, '#A87A10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 12); ctx.textBaseline = 'top';
    ctx.fillStyle = '#A87A10'; ctx.font = '700 40px "Noto Serif SC","Songti SC",serif'; ctx.fillText(film.brand_cn || film.brand, 84, 104);
    ctx.fillStyle = '#6E6C5A'; ctx.font = '500 30px "Noto Serif SC","Songti SC",serif'; ctx.fillText(film.status === 'discontinued' ? '已停产' : '在产', W - 190, 108);
    ctx.fillStyle = '#3B3A33'; ctx.font = '900 90px "Noto Serif SC","Songti SC",serif'; ctx.fillText(film.name_en + ' 胶卷', 84, 190);
    const spec = 'ISO ' + film.iso + ' · ' + typeLabel(film.type) + ' · ' + grainLabel(film.grain) + ' · ' + (film.formats || []).join('·') + ' · ' + catLabel(film.category);
    ctx.fillStyle = '#6E6C5A'; ctx.font = '500 30px "Noto Serif SC","Songti SC",serif'; let y = wrapText(ctx, spec, 84, 360, W - 168, 44, 40);
    const divY = y + 30; ctx.strokeStyle = '#A87A10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(84, divY); ctx.lineTo(W - 84, divY); ctx.stroke();
    ctx.fillStyle = '#22402F'; ctx.font = '500 42px "Noto Serif SC","Songti SC",serif'; y = wrapText(ctx, film.character || '', 84, divY + 60, W - 168, 62, 40);
    ctx.fillStyle = '#3B3A33'; ctx.font = 'italic 400 33px "Noto Serif SC","Songti SC",serif'; y = wrapText(ctx, (film.character_en || '').slice(0, 300), 84, y + 16, W - 168, 50, 40);
    const scenes = (film.scenes || []).map((s) => SCENE_LABEL[s] || s).join(' · '); let contentBottom = y;
    ctx.fillStyle = '#6E6C5A'; ctx.font = '500 32px "Noto Serif SC","Songti SC",serif'; if (scenes) contentBottom = wrapText(ctx, '适用场景：' + scenes, 84, y + 40, W - 168, 46, 40);
    if (film.notes) { ctx.fillStyle = '#A87A10'; ctx.font = '700 30px "Noto Serif SC","Songti SC",serif'; ctx.fillText('使用感受', 84, contentBottom + 48); ctx.fillStyle = '#22402F'; ctx.font = '500 33px "Noto Serif SC","Songti SC",serif'; contentBottom = wrapText(ctx, film.notes, 84, contentBottom + 100, W - 168, 50, 40); }
    let ty = contentBottom + 40;
    if (film.samples && film.samples.length) {
      const imgs = await Promise.all(film.samples.slice(0, 3).map((s) => loadImage('../' + s.src)));
      const maxB = 200, gap = 20; let x = 84, maxTh = 0;
      imgs.forEach((im) => { if (!im) return; const ar = im.width / im.height; const thw = ar >= 1 ? maxB : maxB * ar; const th = ar >= 1 ? maxB / ar : maxB; ctx.drawImage(im, x, ty, thw, th); x += thw + gap; maxTh = Math.max(maxTh, th); });
      const th = maxTh || 200; contentBottom = ty + th + 30;
      if (sampleAuthors(film).length) { ctx.fillStyle = '#6E6C5A'; ctx.font = '500 28px "Noto Serif SC","Songti SC",serif'; ctx.fillText('© ' + sampleAuthors(film).join(' · '), 84, ty + th + 22); }
    }
    const outH = Math.max(contentBottom + 260, 1000);
    const out = document.createElement('canvas'); out.width = W; out.height = outH; const octx = out.getContext('2d');
    octx.drawImage(full, 0, 0);
    octx.fillStyle = '#6E6C5A'; octx.font = 'italic 400 34px "Playfair Display",Georgia,serif'; octx.fillText('Black & White Film', 84, outH - 132);
    octx.fillStyle = '#3B3A33'; octx.font = '700 34px "Noto Serif SC","Songti SC",serif'; octx.fillText('黑白胶卷', 84, outH - 74);
    return out.toDataURL('image/png');
  }

  const lightbox = document.getElementById('lightbox'), lbImg = document.getElementById('lightbox-img');
  function openLightbox(src) { lbImg.src = src; lightbox.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeLightbox() { lightbox.hidden = true; lbImg.src = ''; document.body.style.overflow = ''; }
  const cardSave = document.getElementById('cardSave'), cardSaveImg = document.getElementById('cardSaveImg');
  function showCardSave(dataUrl) { cardSaveImg.src = dataUrl; cardSave.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeCardSave() { cardSave.hidden = true; cardSaveImg.src = ''; document.body.style.overflow = ''; }

  window.filmShare = async function (kind) {
    if (!f) return;
    const url = location.href;
    const title = f.name_en + ' 胶卷';
    const text = (f.brand_cn || f.brand) + ' ' + f.name_en + ' 胶卷 · ' + (f.character || '');
    try {
      if (kind === 'copy') { await navigator.clipboard.writeText(url); flash('链接已复制'); }
      else if (kind === 'native') { if (navigator.share) await navigator.share({ title, text, url }); else { await navigator.clipboard.writeText(url); flash('已复制链接'); } }
      else if (kind === 'poster') {
        await (document.fonts && document.fonts.ready); const dataUrl = await makePoster(f);
        try { const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], f.id + '.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); flash('已呼出分享/保存'); return; } } catch (e) {}
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) { showCardSave(dataUrl); flash('长按图片保存到相册'); }
        else { const a = document.createElement('a'); a.href = dataUrl; a.download = f.id + '.png'; a.click(); flash('卡片已下载'); }
      }
    } catch (e) { flash('操作失败'); }
  };

  document.addEventListener('click', (e) => { const img = e.target.closest('.sample img'); if (img) openLightbox(img.getAttribute('src')); });
  document.querySelectorAll('#lightbox [data-close]').forEach((el) => el.addEventListener('click', closeLightbox));
  document.querySelectorAll('#cardSave [data-cardsave-close]').forEach((el) => el.addEventListener('click', closeCardSave));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (cardSave && !cardSave.hidden) closeCardSave(); else if (lightbox && !lightbox.hidden) closeLightbox(); } });
})();
