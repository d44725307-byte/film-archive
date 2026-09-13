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

  // 生成文章分享卡片图（1080 宽，适合发朋友圈）
  async function makeCard() {
    const W = 1080, H = 1350;
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
    // 封面图（居中裁切成 1080x600）
    let y = 210;
    const im = A.hero ? await loadImage(A.hero) : null;
    if (im) {
      const boxW = W - 160, boxH = 600;
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
    // 底部：分隔线 + 网址
    ctx.strokeStyle = '#A87A10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(80, H - 150); ctx.lineTo(W - 80, H - 150); ctx.stroke();
    ctx.fillStyle = '#22402F'; ctx.font = '500 28px "Noto Serif SC","Songti SC",serif';
    const host = String(A.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    ctx.fillText(host, 80, H - 112);
    ctx.fillStyle = '#A87A10'; ctx.font = '600 26px "Noto Serif SC","Songti SC",serif';
    const tip = '长按保存，可发朋友圈';
    ctx.fillText(tip, W - 80 - ctx.measureText(tip).width, H - 110);
    return c.toDataURL('image/png');
  }

  const cardSave = document.getElementById('cardSave');
  const cardSaveImg = document.getElementById('cardSaveImg');
  function showCardSave(url) { cardSaveImg.src = url; cardSave.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeCardSave() { cardSave.hidden = true; cardSaveImg.src = ''; document.body.style.overflow = ''; }

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
      }
    } catch (e) { flash('操作失败'); }
  };

  document.querySelectorAll('#cardSave [data-cardsave-close]').forEach((el) => el.addEventListener('click', closeCardSave));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cardSave && !cardSave.hidden) closeCardSave(); });
})();
