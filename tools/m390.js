// 390px 移动端实测：量宽度 + 逐屏滚动后再查坏图 + 截图
// 用法：node tools/m390.js [url] [截图路径]
//   例：node tools/m390.js http://127.0.0.1:8091/film/kodak-tri-x-400 /tmp/m390-film.png
//
// 为什么不用 puppeteer/playwright：本机没装。Node 22 自带 WebSocket，直接走 CDP。
// 为什么必须逐屏滚：loading="lazy" 的图不进视口不会加载，一次性 scrollTo(bottom) 会误报坏图（10-06 踩过）。
// 判据：body.scrollWidth 必须等于 innerWidth；溢出元素若都在表格横滑容器内属设计内。
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const URL_ = process.argv[2] || 'http://127.0.0.1:8091/';
const SHOT = process.argv[3] || '/tmp/m390.png';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
  }).on('error', rej);
});

let id = 0;
function rpc(ws, method, params = {}, sessionId) {
  const msgId = ++id;
  return new Promise((res, rej) => {
    const onMsg = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id === msgId) { ws.removeEventListener('message', onMsg); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
  });
}

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/m390-profile', '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = JSON.parse(await get('/json/version')); } catch { await sleep(200); } }
  if (!ver) { console.error('❌ Chrome DevTools 没起来'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });

  const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });

  await rpc(ws, 'Page.enable', {}, sessionId);
  await rpc(ws, 'Runtime.enable', {}, sessionId);
  await rpc(ws, 'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);

  await rpc(ws, 'Page.navigate', { url: URL_ }, sessionId);
  await sleep(1800);

  // 逐屏滚动：让 lazy 图进视口
  await rpc(ws, 'Runtime.evaluate', {
    expression: `(async()=>{const H=600;let y=0;const max=document.body.scrollHeight;
      while(y<max){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,120));y+=H;}
      window.scrollTo(0,0);
      // 等所有图 decode 完（否则 lazy 图会被误判成坏图，10-06 踩过一次）
      const t0=Date.now();
      while(Date.now()-t0<3000){
        const imgs=[...document.images];
        if(imgs.every(i=>i.complete)) break;
        await new Promise(r=>setTimeout(r,150));
      }
      await new Promise(r=>setTimeout(r,300));
      return document.body.scrollHeight;})()`,
    awaitPromise: true,
  }, sessionId);

  const { result } = await rpc(ws, 'Runtime.evaluate', {
    returnByValue: true,
    expression: `(()=>{
      const vw = window.innerWidth;
      const bodySW = document.body.scrollWidth;
      const WRAP = '.article-table-wrap,.rank-table-wrap,.table-wrap,.sample-grid,.site-nav,.filter-chips';
      const all = [...document.querySelectorAll('*')].filter(el=>{
        const r = el.getBoundingClientRect();
        return r.width>0 && (r.right > vw + 1 || r.left < -1);
      }).map(el=>({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className||'').slice(0,50),
        right: Math.round(el.getBoundingClientRect().right),
        inWrap: !!el.closest(WRAP) || !!el.closest('table')
      }));
      const overRight = all.filter(o=>!o.inWrap && o.right > vw + 1);
      const offstageLeft = all.filter(o=>!o.inWrap && o.right <= vw + 1);
      const imgs = [...document.images];
      return {
        title: document.title,
        vw, bodySW,
        overflowTotal: all.length,
        overflowInsideWrap: all.filter(o=>o.inWrap).length,
        overflowRight: overRight.slice(0,12),
        offstageLeftCount: offstageLeft.length,
        imgTotal: imgs.length,
        imgBroken: imgs.filter(i=>i.complete && i.naturalWidth===0).map(i=>(i.currentSrc||i.src).slice(-60)),
        imgLazyPending: imgs.filter(i=>!i.complete).length,
        priceHint: (document.querySelector('.price-hint')||{}).textContent?.trim().slice(0,80) || null,
        priceLabel: (document.querySelector('.rank-note-price')||{}).textContent?.trim().slice(0,80) || null
      };
    })()`,
  }, sessionId);

  const m = result.value;
  const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
  fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));

  console.log(`\n📄 ${m.title}`);
  console.log(`   innerWidth=${m.vw}  body.scrollWidth=${m.bodySW}  ${m.vw === m.bodySW ? '✅ 无横向溢出' : '❌ 有横向溢出'}`);
  console.log(`   溢出元素 ${m.overflowTotal} 个（设计内横滑容器 ${m.overflowInsideWrap} 个｜容器外向右 ${m.overflowRight.length} 个｜轮播台外左侧 ${m.offstageLeftCount} 个）`);
  m.overflowRight.forEach((o) => console.log(`     ⚠️ <${o.tag} class="${o.cls}"> right=${o.right}`));
  console.log(`   图片 ${m.imgTotal} 张｜坏图 ${m.imgBroken.length} 张｜未加载 ${m.imgLazyPending} 张`);
  m.imgBroken.forEach((s) => console.log(`     ❌ 坏图 ${s}`));
  if (m.priceHint) console.log(`   价格声明: ${m.priceHint}`);
  if (m.priceLabel) console.log(`   榜单声明: ${m.priceLabel}`);
  console.log(`   截图 → ${SHOT}`);

  await rpc(ws, 'Target.closeTarget', { targetId });
  ws.close();
  chrome.kill();
  const ok = m.vw === m.bodySW && m.imgBroken.length === 0 && m.overflowRight.length === 0;
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
