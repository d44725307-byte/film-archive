// 文章页分享（依赖页面里 window.__article = { title, excerpt, hero, url }）
(function () {
  const A = window.__article || {};
  const SITE_CN = '胶卷档案';
  const SITE_EN = 'Film Stock Hub';

  function flash(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(flash._t);
    flash._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function loadImage(src) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
    const chars = String(text).split('');
    let line = '', n = 0;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x, y); line = chars[i]; y += lineH; n++;
        if (maxLines && n >= maxLines) { ctx.fillText(line.length > 1 ? line.slice(0, -1) + '…' : line, x, y); return y + lineH; }
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineH;
  }

  // 生成文章分享卡片图（1080 宽，适合发朋友圈；右下角带二维码）
  async function makeCard() {
    const W = 1080, H = 1560;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#F3EDE0'; ctx.fillRect(0, 0, W, H);
    // 顶部品牌色条
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#CFA94F'); g.addColorStop(0.5, '#1B3327'); g.addColorStop(1, '#A87A10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 14);
    ctx.textBaseline = 'top';
    // 品牌
    ctx.fillStyle = '#A87A10'; ctx.font = '700 40px "Noto Serif SC","Songti SC",serif';
    ctx.fillText(SITE_CN, 80, 78);
    ctx.fillStyle = '#6E6C5A'; ctx.font = 'italic 400 26px "Playfair Display",Georgia,serif';
    ctx.fillText(SITE_EN.toUpperCase(), 80, 130);
    // 封面图（居中裁切）
    let y = 210;
    const im = A.hero ? await loadImage(A.hero) : null;
    if (im) {
      const boxW = W - 160, boxH = 560;
      const scale = Math.max(boxW / im.width, boxH / im.height);
      const dw = im.width * scale, dh = im.height * scale;
      ctx.save();
      ctx.beginPath(); ctx.rect(80, y, boxW, boxH); ctx.clip();
      ctx.fillStyle = '#E5DCC8'; ctx.fillRect(80, y, boxW, boxH);
      ctx.drawImage(im, 80 + (boxW - dw) / 2, y + (boxH - dh) / 2, dw, dh);
      ctx.restore();
      ctx.strokeStyle = '#D8CBAF'; ctx.lineWidth = 2; ctx.strokeRect(80, y, boxW, boxH);
      y += boxH + 54;
    }
    // 标题
    ctx.fillStyle = '#3B3A33'; ctx.font = '900 56px "Noto Serif SC","Songti SC",serif';
    y = wrap(ctx, A.title || '', 80, y, W - 160, 76, 4);
    // 摘要
    if (A.excerpt) {
      ctx.fillStyle = '#6E6C5A'; ctx.font = '400 30px "Noto Serif SC","Songti SC",serif';
      y = wrap(ctx, A.excerpt, 80, y + 24, W - 160, 46, 3);
    }
    // ---- 底部区：分隔线 + 网址 + 二维码 ----
    const bandTop = H - 250;
    ctx.strokeStyle = '#A87A10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(80, bandTop); ctx.lineTo(W - 80, bandTop); ctx.stroke();

    // 二维码（右侧，白底方框）
    const qrSize = 190, qrPad = 10;
    const qrBoxX = W - 80 - qrSize - qrPad * 2, qrBoxY = bandTop + 26;
    const qrImg = A.qr ? await loadImage(A.qr) : null;
    if (qrImg) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      const bx = qrBoxX, by = qrBoxY, bw = qrSize + qrPad * 2, bh = qrSize + qrPad * 2, r = 10;
      ctx.moveTo(bx + r, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, r); ctx.arcTo(bx + bw, by + bh, bx, by + bh, r); ctx.arcTo(bx, by + bh, bx, by, r); ctx.arcTo(bx, by, bx + bw, by, r); ctx.closePath(); ctx.fill();
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrBoxY + qrPad, qrSize, qrSize);
    }
    // 左侧文字
    const leftX = 80;
    ctx.fillStyle = '#A87A10'; ctx.font = '700 30px "Noto Serif SC","Songti SC",serif';
    ctx.fillText(SITE_CN, leftX, bandTop + 34);
    ctx.fillStyle = '#22402F'; ctx.font = '500 26px "Noto Serif SC","Songti SC",serif';
    const host = String(A.url || '').replace(/^https?:\/\//, '');
    ctx.fillText(host, leftX, bandTop + 86);
    ctx.fillStyle = '#6E6C5A'; ctx.font = '400 24px "Noto Serif SC","Songti SC",serif';
    ctx.fillText('扫码看全文 · 或复制链接打开', leftX, bandTop + 132);
    ctx.fillStyle = '#6E6C5A'; ctx.font = 'italic 400 24px "Playfair Display",Georgia,serif';
    ctx.fillText('长按保存可发朋友圈', leftX, bandTop + 172);
    return c.toDataURL('image/png');
  }

  const cardSave = document.getElementById('cardSave');
  const cardSaveImg = document.getElementById('cardSaveImg');
  function showCardSave(url) { cardSaveImg.src = url; cardSave.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeCardSave() { cardSave.hidden = true; cardSaveImg.src = PLACEHOLDER; document.body.style.overflow = ''; }

  // 文末「主推胶卷」缩略图点开放大（原图），与胶卷页/首页的 lightbox 行为一致
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  function closeLightbox() { if (!lightbox) return; lightbox.hidden = true; lightboxImg.src = PLACEHOLDER; document.body.style.overflow = ''; }
  document.querySelectorAll('.article-filmcards .fc-media[data-full]').forEach((im) => {
    im.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // 别触发外层卡片链接的跳转
      if (!lightbox) return;
      lightboxImg.src = im.getAttribute('data-full');
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  });
  if (lightbox) document.querySelectorAll('#lightbox [data-close]').forEach((el) => el.addEventListener('click', closeLightbox));


  // 「生成卡片/存分享图」要点时间（canvas 画图在主线程）→ 期间给按钮一个"生成中"反馈，
  // 既解决 INP 观感，也防连点。Cloudflare 实测该按钮 INP 288–328ms。
  async function withBusy(fnName, kind, label, fn) {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.getAttribute('onclick') || '').indexOf(fnName + "('" + kind + "')") >= 0);
    if (!btn) return fn();
    const old = btn.textContent;
    btn.textContent = label;
    btn.disabled = true;
    btn.style.opacity = '.6';
    btn.style.pointerEvents = 'none';
    try { return await fn(); }
    finally { btn.textContent = old; btn.disabled = false; btn.style.opacity = ''; btn.style.pointerEvents = ''; }
  }

  window.articleShare = async function (kind) {
    const url = A.url || location.href;
    const title = A.title || document.title;
    try {
      if (kind === 'copy') {
        await navigator.clipboard.writeText(url);
        flash('链接已复制');
      } else if (kind === 'native') {
        if (navigator.share) { await navigator.share({ title, text: A.excerpt || title, url }); }
        else { await navigator.clipboard.writeText(url); flash('链接已复制，粘贴到微信即可分享'); }
      } else if (kind === 'card') {
        await withBusy('articleShare', 'card', '生成中…', async () => {
        await (document.fonts && document.fonts.ready);
        const dataUrl = await makeCard();
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], 'article.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title });
            flash('已呼出分享');
            return;
          }
        } catch (e) {}
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) { showCardSave(dataUrl); flash('长按图片保存到相册'); }
        else { const a = document.createElement('a'); a.href = dataUrl; a.download = (A.slug || 'article') + '.png'; a.click(); flash('分享图已下载'); }
        });
      }
    } catch (e) { flash('操作失败'); }
  };

  document.querySelectorAll('#cardSave [data-cardsave-close]').forEach((el) => el.addEventListener('click', closeCardSave));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (lightbox && !lightbox.hidden) closeLightbox();
    else if (cardSave && !cardSave.hidden) closeCardSave();
  });
})();
