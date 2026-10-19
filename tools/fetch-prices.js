// 海外零售实价采集：Shopify（meta.json + products.json + products/<handle>.json）→ data/prices-real.json
// 用法：node tools/fetch-prices.js [--debug]
//
// 诞生原因（2026-10-19）：films.json 的价格是「档位估算」——二手价 74/74 条 = 全新价下限×0.85，纯公式。
// 要变成可查证的数据，必须有「哪家店、哪天、多少钱、几卷装、链接」。
//
// ⚠️ 踩到的坑（别再踩）：
//   1. **Shopify products.json 会按访问地做货币本地化**：同一时刻 products.json 返回 95.00（人民币），
//      而 products/<handle>.json 返回 13.99（USD 本位币）。⇒ **价格一律以 products/<handle>.json 为准**，
//      products.json 只用来找 handle 和格式。本位币由 /meta.json 的 currency 字段确认。
//   2. **AW 的 135 变体名「36」「24」是曝光张数，不是卷数**；「36 / 5」才是 36 张 / 5 卷。
//      120 的「1」「5」是卷数；页片的「25」「50」是张数。
//   3. 散装大盘（Bulk Roll / 30.5m）不能跟单卷比价；620 / 16mm / Super 8 / 相纸 / 药水 一律排除。
//   4. 英国店标价**含 20% VAT**，美国店**不含销售税** —— 口径差异写进 meta，不隐瞒。
const fs = require('fs');
const path = require('path');
const https = require('https');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STORES = [
  { key: 'aw', host: 'analoguewonderland.co.uk', name: 'Analogue Wonderland', region: 'UK', vat: true },
  { key: 'fpp', host: 'filmphotographystore.com', name: 'Film Photography Project', region: 'US', vat: false },
  { key: 'fc', host: 'firstcall-photographic.co.uk', name: 'Firstcall Photographic', region: 'UK', vat: true },
  { key: 'bfc', host: 'brooklynfilmcamera.com', name: 'Brooklyn Film Camera', region: 'US', vat: false },
];

// 匹配规则：每组 = 必须同时出现的子串（AND）。防止 "Tri-X 320" 冒充 "Tri-X 400"。
const MATCH = {
  'kodak-tri-x-400': [['trix', '400']],
  'kodak-tmax-100': [['tmax', '100']],
  'kodak-tmax-400': [['tmax', '400']],
  'kodak-tmax-p3200': [['p3200'], ['tmax', '3200']],
  'kodak-double-x-5222': [['doublex']],
  'fuji-acros-2': [['acros']],
  'fuji-neopan-100': [['neopan', '100']],
  'fuji-neopan-400': [['neopan', '400']],
  'ilford-hp5-plus': [['hp5']],
  'ilford-fp4-plus': [['fp4']],
  'ilford-delta-100': [['delta', '100']],
  'ilford-delta-400': [['delta', '400']],
  'ilford-delta-3200': [['delta', '3200']],
  'ilford-pan-f-plus': [['panf']],
  'ilford-xp2-super': [['xp2']],
  'ilford-sfx-200': [['sfx']],
  'ilford-ortho-plus-80': [['ortho']],
  'ilford-kentmere-100': [['kentmere', '100']],
  'ilford-kentmere-400': [['kentmere', '400']],
  'foma-fomapan-100': [['fomapan', '100']],
  'foma-fomapan-200': [['fomapan', '200']],
  'foma-fomapan-400': [['fomapan', '400']],
  'adox-chm-100': [['chm', '100']],
  'adox-chm-400': [['chm', '400']],
  'adox-silvermax-100': [['silvermax']],
  'adox-cms-20-ii': [['cms', '20']],
  'rollei-rpx-100': [['rpx', '100']],
  'rollei-rpx-400': [['rpx', '400']],
  'rollei-retro-80s': [['retro', '80s'], ['retro', '80']],
  'rollei-retro-400s': [['retro', '400']],
  'orwo-un54': [['un54']],
  'cinestill-bwxx': [['bwxx']],
  'jch-streetpan-400': [['streetpan']],
  'lomo-earl-grey-100': [['earl', 'grey']],
  'lomo-lady-grey-400': [['lady', 'grey']],
  'lomo-potsdam-kino-100': [['potsdam']],
  'lomo-berlin-kino-400': [['berlin']],
  'bergger-pancro-400': [['pancro']],
  'horman-direct-positive': [['directpositive']],
};
// 品牌守卫：标题里出现别家品牌就否决（防 "Rollei Ortho 25" 冒充 "Ilford Ortho Plus"）
const BRAND_ALIAS = {
  Kodak: ['kodak', 'eastman'], Fujifilm: ['fuji', 'fujifilm'], Ilford: ['ilford', 'kentmere'],   // Kentmere 是 Harman 旗下，商品标题常不写 Ilford Fomapan: ['foma', 'fomapan'],
  Adox: ['adox'], Rollei: ['rollei'], ORWO: ['orwo', 'wolfen'], CineStill: ['cinestill'],
  JCH: ['jch'], Lomography: ['lomo', 'lomography'], Bergger: ['bergger'], Harman: ['harman', 'ilford'],
};
const ALL_BRANDS = Object.values(BRAND_ALIAS).flat();
// 排除词：标题、product_type、tags 三处都查（Firstcall 把相纸写成 "Kentmere VC Select Fine Lustre 100 Sheets"，
// 没有 paper 字样，只有 product_type 里带 Photographic Paper —— 只查标题会把它当成 8x10 胶卷按张报价）
const REJECT = ['super8', '16mm', '8mm', 'bulkroll', 'bulkfilm', '30.5m', '620', 'movie', 'camera', 'developer', 'fixer',
  'paper', 'enamelpin', 'changingbag', 'darkroom', 'reversal',
  'vcselect', 'lustre', 'glossy', 'multigrade', 'resincoated', 'baryta', 'fibrebased', 'chemical', 'toner', 'stopbath'];
const REJECT_BY_FILM = {
  'fuji-neopan-400': ['400cn', 'acros'],  // 400CN 是彩负；Acros 是另一卷
  'fuji-neopan-100': ['acros'],            // 原版 Neopan 100 已停产，别把 Acros II 算进来
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// 取 JSON：走 curl（不是 node https）
// ⚠️ 为什么用 curl：Analogue Wonderland 对 node 的 https 请求会返回 "local_rate_limited"（即使同一 IP、
//    同一 UA 用 curl 打同一 URL 是 200）。换成 curl 后稳定可复现。重定向、gzip 由 curl 自己处理。
// ⚠️ 仍保留限流识别与退避：AW 在请求过密时确实会限流，表现为正文 "local_rate_limited"。
const { execFileSync } = require('child_process');
let CURL_OK = true;
function getJSON(url, tries = 4) {
  let lastErr;
  for (let n = 1; n <= tries; n++) {
    try {
      let out;
      try {
        out = execFileSync('curl', ['-sL', '--max-time', '60', '-A', UA, url], { maxBuffer: 96 * 1024 * 1024 }).toString();
      } catch (e) {
        CURL_OK = false;
        throw new Error('curl 不可用：' + e.message);
      }
      if (/rate.?limit/i.test(out.slice(0, 120))) throw new Error('限流（local_rate_limited）');
      if (!out.trim()) throw new Error('空响应');
      return JSON.parse(out);
    } catch (e) {
      lastErr = e;
      if (n < tries) execFileSync('sleep', [String(n * 3)]);   // 3s → 6s → 9s
    }
  }
  throw new Error(`${url} 取数失败：${lastErr.message}`);
}

function fmtOf(title, ptype, tags) {
  const t = String(title || '').toLowerCase();
  const pt = String(ptype || '').toLowerCase();
  const tg = String(tags || '').toLowerCase();
  if (/(^|[^0-9])620([^0-9]|$)/.test(t) || pt.includes('620')) return '620';
  if (/8\s*x\s*10|8x10/.test(t) || pt.includes('8x10')) return '8x10';
  if (/4\s*x\s*5|4x5|5\s*x\s*7|5x7/.test(t) || pt.includes('large format')) return '4x5';
  if (/\b120\b/.test(t) || pt.includes('120')) return '120';
  if (/35\s*mm|\b135\b/.test(t) || pt.includes('35mm') || tg.includes('35mm')) return '135';
  return null;
}

// 解析「一份商品含几卷 / 几张」→ { units, exposures }
function parsePack(title, variantTitle, fmt) {
  const t = `${title} ${variantTitle}`.toLowerCase();
  if (/bulk\s*roll|30\.5\s*m|bulkfilm/.test(t)) return { units: 0 };
  const vt = String(variantTitle || '').trim();

  // ① 变体形如「36 / 5」= 36 张 / 5 卷
  const pair = vt.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (pair) return { units: Number(pair[2]), exposures: Number(pair[1]) };

  // ② 明确写出的包装数量（变体名或标题都可能是 "Pack of 3" / "(5-Pack)" / "50 Sheets"）
  const packOf = (`${vt} ${title}`.match(/pack\s*of\s*(\d+)/i));
  if (packOf) return { units: Number(packOf[1]) };
  const paren = title.match(/\((\d+)\s*[- ]?\s*(?:pack|pak|rolls?|sheets?|sheet box)\b/i);
  if (paren) return { units: Number(paren[1]) };
  const bareSheets = title.match(/(\d+)\s*(?:sheets?|sheet)\b/i);   // 无括号：Firstcall「4 x 5in 50 Sheets」
  if (bareSheets && (fmt === '4x5' || fmt === '8x10')) return { units: Number(bareSheets[1]) };
  if (/single roll|1\s*roll/i.test(title)) return { units: 1 };

  // ③ 变体就是个裸数字：135 是曝光张数，其余是卷数/张数
  if (/^\d+$/.test(vt)) {
    const n = Number(vt);
    if (fmt === '135') return { units: 1, exposures: n };
    return { units: n };
  }
  return { units: 1 };
}

async function meta(host) {
  const m = await getJSON(`https://${host}/meta.json`);
  return { currency: m.currency, name: m.name, country: m.country };
}

// 目录缓存：同一家店当天只抓一次（AW 有 IP 限流，反复重爬会进冷却）。
// 缓存目录不提交：data/.price-cache/ 已在 .gitignore。
const CACHE_DIR = path.join(__dirname, '..', 'data', '.price-cache');
async function crawl(key, host, refresh) {
  const f = path.join(CACHE_DIR, key + '.json');
  if (!refresh && fs.existsSync(f)) {
    try {
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (c.fetched_on === TODAY && (c.products || []).length) return c.products;
    } catch { /* 缓存坏了就重爬 */ }
  }
  const all = [];
  for (let p = 1; p <= 12; p++) {
    const d = await getJSON(`https://${host}/products.json?limit=250&page=${p}`);
    const items = d.products || [];
    all.push(...items);
    if (items.length < 250) break;
    await sleep(400);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ fetched_on: TODAY, products: all }));
  return all;
}

async function fx() {
  const d = await getJSON('https://api.frankfurter.app/latest?from=USD&to=CNY,GBP');
  return { date: d.date, USD_CNY: +d.rates.CNY.toFixed(4), GBP_CNY: +(d.rates.CNY / d.rates.GBP).toFixed(4), source: 'frankfurter.app (ECB)' };
}

(async () => {
  const DEBUG = process.argv.includes('--debug');
  const REFRESH = process.argv.includes('--refresh');
  const films = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'films.json'), 'utf8')).films;
  const rates = await fx();
  console.log(`💱 汇率 ${rates.date}：1 USD = ${rates.USD_CNY} CNY ｜ 1 GBP = ${rates.GBP_CNY} CNY（${rates.source}）`);

  const metaInfo = {};
  const catalog = {};
  for (const st of STORES) {
    metaInfo[st.key] = await meta(st.host);
    process.stdout.write(`📥 ${st.name}｜本位币 ${metaInfo[st.key].currency}｜爬商品…`);
    catalog[st.key] = await crawl(st.key, st.host, process.argv.includes('--refresh'));
    console.log(` ${catalog[st.key].length} 商品`);
  }

  // ---- 全局校准：products.json 返回的到底是不是本位币？ ----
  // 实测踩坑：同一时刻 products.json 可能给本地化货币（95.00），而 products/<handle>.json 给本位币（13.99）。
  // 做法：每家店抽 2 个商品比对「目录价 / 单品接口价」，比值≈1 就认定目录可用（省掉上百次请求，避免限流）。
  const baseOk = {};
  const calibration = [];
  for (const st of STORES) {
    const samples = catalog[st.key].filter((p) => p.handle && (p.variants || []).some((v) => v.available)).slice(0, 2);
    const ratios = [];
    for (const sp of samples) {
      try {
        const prod = (await getJSON(`https://${st.host}/products/${sp.handle}.json`)).product;
        const pv = (prod.variants || [])[0] || {};
        const cv = (sp.variants || []).find((x) => x.id === pv.id) || (sp.variants || [])[0] || {};
        const a = parseFloat(cv.price), b = parseFloat(pv.price);
        if (a > 0 && b > 0) ratios.push(a / b);
      } catch (e) { /* 校准失败按「不可用」处理 */ }
      await sleep(300);
    }
    const r = ratios.length ? ratios.reduce((x, y) => x + y, 0) / ratios.length : null;
    if (r === null) {
      // 校准取不到（多半是限流）→ 宁可整轮失败，也不写入可能被本地化的价格
      throw new Error(`${st.name} 校准失败（可能仍在限流冷却），本轮不写盘。等几分钟重跑即可。`);
    }
    baseOk[st.key] = Math.abs(r - 1) < 0.02;
    calibration.push({ store: st.key, currency: metaInfo[st.key].currency, ratio: +r.toFixed(3), catalog_is_base_currency: baseOk[st.key] });
    console.log(`  🔎 ${st.name}｜目录/单品价比 ${r.toFixed(3)} → ${baseOk[st.key] ? '目录价可用（本位币）' : '目录价被本地化，改逐条取真价'}`);
  }

  const out = {
    as_of: TODAY,
    note: '海外零售实价：单位价 = 标价 ÷ 包装内卷数（页片为 ÷ 张数）。记录本位币原价与折算人民币。英国店标价含 20% VAT，美国店不含销售税。',
    currency_rates: rates,
    stores: STORES.map((s) => ({ key: s.key, name: s.name, host: s.host, region: s.region, currency: metaInfo[s.key].currency, price_includes_vat: s.vat })),
    price_endpoint: 'products/<handle>.json（本位币；products.json 会按 IP 本地化货币，不可用于取价）',
    calibration,
    films: {},
  };
  const report = [];

  for (const f of films) {
    const rules = MATCH[f.id] || [];
    const rej = REJECT_BY_FILM[f.id] || [];
    const brandKeys = (BRAND_ALIAS[f.brand] || []).map(norm);
    const otherBrands = ALL_BRANDS.filter((b) => !brandKeys.includes(norm(b))).map(norm);

    // 第一步：用 products.json 找候选 handle（只认标题/格式/上架状态，不用它的价）
    const cands = [];
    for (const st of STORES) {
      for (const p of catalog[st.key]) {
        const t = p.title || '';
        const nt = norm(t);
        const okRule = rules.some((grp) => grp.every((k) => nt.includes(norm(k))));
        if (!okRule) continue;
        const ntAll = norm(t) + '|' + norm(p.product_type || '') + '|' + norm(Array.isArray(p.tags) ? p.tags.join(' ') : p.tags || '');
        if (REJECT.some((k) => ntAll.includes(norm(k)))) continue;
        if (rej.some((k) => nt.includes(norm(k)))) continue;
        if (otherBrands.some((b) => b && nt.includes(b))) continue; // 别家品牌 → 否决
        // 必须出现本家品牌词（否则 "Moersch 药水" / "Peerless 染料" 会被误当成 Adox / Lomography）
        if (brandKeys.length && !brandKeys.some((b) => nt.includes(b))) continue;
        const fmt = fmtOf(t, p.product_type, p.tags);
        if (!fmt || !['135', '120', '4x5', '8x10'].includes(fmt)) continue;
        if (!(p.variants || []).some((v) => v.available)) continue;  // 全缺货的跳过
        cands.push({ store: st, handle: p.handle, fmt, title: t });
      }
    }
    if (!cands.length) { report.push({ id: f.id, best: {} }); continue; }

    // 第一步半：目录价虽然是本地化货币，但**同一家店内部相对排序可信** → 每家店每个格式只取前 2 个候选去验真价
    const groups = {};
    for (const c of cands) {
      const p = catalog[c.store.key].find((x) => x.handle === c.handle);
      const v = (p.variants || []).find((x) => x.available) || (p.variants || [])[0];
      const pack = parsePack(p.title, v.title, c.fmt);
      const idx = pack.units ? parseFloat(v.price) / pack.units : Infinity;
      const k = c.store.key + '|' + c.fmt;
      (groups[k] = groups[k] || []).push({ ...c, idxPrice: idx, catVariants: p.variants || [] });
    }
    const shortlist = [];
    for (const list of Object.values(groups)) {
      list.sort((a, b) => a.idxPrice - b.idxPrice);
      shortlist.push(...list.slice(0, 2));
    }

    // 第二步：取价（是否用目录价，由脚本开头的「全局校准」决定：baseOk[store]）
    const offers = [];
    const buildOffer = (c, prod, v, price) => {
      const { units, exposures } = parsePack(prod.title, v.title, c.fmt);
      if (!units) return null;                       // 散装大盘
      const unit = price / units;
      const rate = metaInfo[c.store.key].currency === 'GBP' ? rates.GBP_CNY : rates.USD_CNY;
      return {
        store: c.store.key, store_name: c.store.name, region: c.store.region,
        currency: metaInfo[c.store.key].currency,
        format: c.fmt,
        listing_title: prod.title,
        variant: v.title,
        exposures: exposures || null,
        pack_price: +price.toFixed(2),
        units_per_pack: units,
        unit_price: +unit.toFixed(2),
        unit_cny: Math.round(unit * rate),
        price_includes_vat: c.store.vat,
        url: `https://${c.store.host}/products/${prod.handle}`,
        verified_via: baseOk[c.store.key] ? `products.json @ ${TODAY}（已校准为本位币 ${metaInfo[c.store.key].currency}）` : `products/${prod.handle}.json @ ${TODAY}`,
      };
    };

    // 目录价可信的店：直接用目录价（零额外请求）；被本地化的店：逐条取本位币真价
    for (const c of shortlist.filter((x) => baseOk[x.store.key])) {
        const catP = catalog[c.store.key].find((x) => x.handle === c.handle);
        if (!catP) continue;
        for (const v of catP.variants || []) {
          if (!v.available) continue;
          const price = parseFloat(v.price);
          if (!(price > 0)) continue;
          const o = buildOffer(c, catP, v, price);
          if (o) offers.push(o);
        }
    }
    for (const c of shortlist.filter((x) => !baseOk[x.store.key])) {
        try {
          const prod = (await getJSON(`https://${c.store.host}/products/${c.handle}.json`)).product;
          const availMap = new Map((c.catVariants || []).map((x) => [x.id, x.available]));
          for (const v of prod.variants || []) {
            const av = availMap.has(v.id) ? availMap.get(v.id) : (v.available !== undefined ? v.available : true);
            if (!av) continue;
            const price = parseFloat(v.price);
            if (!(price > 0)) continue;
            const o = buildOffer(c, prod, v, price);
            if (o) offers.push(o);
          }
        } catch { /* 单条失败不拖垮整卷 */ }
      await sleep(250);
    }
    process.stdout.write(`  ${f.id}${offers.length ? '' : '(无)'}  `);

    // 第三步：每个格式挑最便宜；135 优先 36 张标准规格（与国内常见规格一致）
    const best = {};
    for (const o of offers) {
      const cur = best[o.format];
      if (!cur) { best[o.format] = o; continue; }
      if (o.format === '135') {
        const curExp = cur.exposures || 0;
        const newExp = o.exposures || 0;
        if (newExp === 36 && curExp !== 36) { best[o.format] = o; continue; }
        if (newExp !== 36 && curExp === 36) continue;
      }
      if (o.unit_cny < cur.unit_cny) best[o.format] = o;
    }
    if (Object.keys(best).length) out.films[f.id] = { as_of: TODAY, offers: Object.values(best) };
    report.push({ id: f.id, best });
  }

  const outFile = path.join(__dirname, '..', 'data', 'prices-real.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');

  const hit = report.filter((r) => Object.keys(r.best).length).length;
  console.log(`\n✅ 写入 ${path.relative(process.cwd(), outFile)}｜覆盖 ${hit}/${films.length} 卷`);
  console.log(`\n${'film'.padEnd(26)} ${'135 (36张/卷)'.padStart(22)} ${'120'.padStart(20)}`);
  for (const r of report) {
    const cell = (fmt) => {
      const o = r.best[fmt];
      if (!o) return '—';
      const exp = o.exposures ? `${o.exposures}张` : '';
      return `${o.unit_cny}元 ${o.currency}${o.unit_price}${exp}`;
    };
    console.log(`${r.id.padEnd(26)} ${cell('135').padStart(22)} ${cell('120').padStart(20)}`);
  }
  const missing = report.filter((r) => !Object.keys(r.best).length).map((r) => r.id);
  if (missing.length) console.log(`\n⚠️ 未采到（需换源）：${missing.join(', ')}`);
  console.log(`\n📊 135 ${report.filter((r) => r.best['135']).length} 卷｜120 ${report.filter((r) => r.best['120']).length} 卷｜页片 ${report.filter((r) => r.best['4x5'] || r.best['8x10']).length} 卷`);

  if (DEBUG) {
    console.log('\n=== 明细（人工核对）===');
    for (const r of report) for (const [fmt, o] of Object.entries(r.best)) {
      console.log(`${r.id} [${fmt}] ${o.unit_cny}元 ← ${o.currency}${o.pack_price} ÷ ${o.units_per_pack} = ${o.currency}${o.unit_price}`);
      console.log(`    ${o.listing_title} ｜变体 ${o.variant} ｜${o.url}`);
    }
  }
})().catch((e) => { console.error('❌', e); process.exit(1); });
