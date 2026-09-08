# 黑白胶卷（film-archive）

一个**可搜索、可按品牌/类型/尺寸/ISO/在产状态筛选**的黑白胶卷资料库。面向胶片爱好者，帮你在买卷前快速判断「这款适不适合你、该用在什么题材」。

> 定位：**情报档案**，不是图库。第一版只放「特性 + 场景 + 参考价格」等**文字资料**，不托管任何第三方版权图片。样片后续用**用户投稿**（标注 © 原作者）方式补充。

---

## 目录结构

```
film-archive/
├── index.html        主页面（搜索 + 筛选 + 卡片 + 详情弹窗）
├── app.js            前端逻辑（纯原生 JS，零依赖）
├── style.css         黑白摄影风样式
├── data/
│   └── films.json    黑白胶卷数据（首批 36 款）
├── about.html        关于
├── disclaimer.html   免责声明
├── privacy.html      隐私政策
└── README.md         本说明
```

---

## 本地预览

`fetch('data/films.json')` 需要 http 协议，**直接双击 index.html（file://）会被浏览器 CORS 拦截**。请起一个本地静态服务：

```bash
cd "/Users/apple/DSH/Gemini 3.6视觉模型/DeepSeek/film-archive"
python3 -m http.server 8091
# 浏览器打开 http://127.0.0.1:8091
```

---

## 数据模型（films.json 的每条胶片）

```json
{
  "id": "kodak-tri-x-400",          // 唯一 id（作为档案主键、URL/锚点用）
  "brand": "Kodak",                 // 品牌英文
  "brand_cn": "柯达",               // 品牌中文
  "name_en": "Tri-X 400",           // 型号英文
  "name_cn": "崔 X 400",            // 型号中文（可留与英文相同或省略）
  "iso": 400,                       // 感光度
  "formats": ["35mm", "120", "4x5"],// 可用尺寸
  "category": "traditional",        // 分类(见下)
  "type": "panchromatic",           // 感色性类型
  "grain": "medium",                // 颗粒感
  "status": "in-production",        // in-production / discontinued
  "character": "……",                // 特性/手感/点评（**作者撰写**，本站核心价值）
  "scenes": ["street", "portrait"], // 适用场景
  "price_new": { "135": "约¥85–105", "120": "约¥95–125" }, // 全新价（按格式 135/120；停产卷两格留空）
  "price_used": { "135": "", "120": "" },                  // 二手价（按格式；停产卷通常只有这个）
  "notes": "",                      // 补充备注
  "image": ""                       // 可选：真实胶卷图 URL；填了就用图，不填则用原创插画
}
```

### 价格怎么填（全新/二手 × 135/120）
- `price_new` / `price_used` 是**对象**，键为 `135` 和 `120`，值是**人民币区间字符串**，例如：
  ```json
  "price_new":  { "135": "约¥85–105", "120": "约¥95–125" },
  "price_used": { "135": "约¥65", "120": "" }
  ```
- **停产卷**：`price_new` 两个值都留空 `""`（界面显示「待补」），只填 `price_used`。
- 界面在详情弹窗「参考价格 · Price」里，**全新 New / 二手 Used** 两栏各显示 **135 / 120 两行**，空则显示「待补」。

### 外观（胶卷「样子」）
- **默认不显示任何图片**（保持简洁卡片，纯文字资料）。
- 想让某卷显示**真实胶卷照片**：给该条目的 `image` 填一个图片 URL 即可。
- ⚠️ **不要抓取并托管他人有版权的产品照**（会踩 DMCA + AdSense 拒审）。用你自己的/用户投稿（注明 ©）/已授权图。

### 字段枚举说明

| 字段 | 可选值 |
|---|---|
| `category` | `traditional` 传统颗粒 / `tabular` T颗粒·平面颗粒 / `fine` 细腻·超微粒 / `high-speed` 高速 / `cinema` 电影卷 / `chromogenic` 彩色工艺黑白 / `ortho` 正色卷 / `infrared` 红外卷 / `direct-positive` 直接正片 |
| `type` | `panchromatic` 全色性 / `orthochromatic` 正色性 / `chromogenic` 彩色工艺冲洗 |
| `grain` | `ultra-fine` 超微粒 / `fine` 细颗粒 / `medium` 中等颗粒 / `coarse` 粗颗粒 |
| `scenes` | `street`街头 `portrait`人像 `documentary`纪实 `low-light`暗光 `push`迫冲 `landscape`风光 `product`静物 `large-format`大画幅 `fine-art`艺术 `action`运动 `indoor`室内 `sports`体育 `cinematic`电影感 `event`活动 `travel`旅行 `copy`翻拍 `studio`棚拍 `infrared`红外 `creative`创意 `architecture`建筑 `retro`复古 `daily`日常 `sunlight`阳光 `high-contrast`高反差 `direct-positive`直接正像 `artistic`艺术 `laboratory`实验室 `all-purpose`通用 |
| `status` | `in-production` 在产 / `discontinued` 已停产 |

> 新增标签时，请在 `app.js` 顶部的 `CATEGORY_LABEL / GRAIN_LABEL / TYPE_LABEL / SCENE_LABEL` 里补上对应中文，否则页面会直接显示原始英文 key。

---

## 如何补录 / 修改

1. 在 `data/films.json` 的 `films` 数组里加一条（或用 JSON 编辑器），或编辑已有条目。
2. 注意 `id` 全局唯一、`scenes` 用上面枚举、`category`/`grain`/`type` 用枚举值。
3. 「特性/场景」**必须由真人鉴赏**——这是本站区别于「AI 复读机」的核心，不要用 AI 批量套话。
4. 保存后刷新页面即可看到；筛选 chips 会自动根据数据里出现的品牌/分类/尺寸更新。

---

## 后续 roadmap（待你定）

- [ ] 校订现有 36 款的「特性/场景」，补充价格
- [ ] 补齐**停产/收藏级**黑白卷（Retro、Agfa、老 Kodak 等）
- [ ] 用户投稿样片（标注 © 原作者）
- [ ] 胶卷实拍对比 / 冲洗配方速查
- [ ] 上公网（Cloudflare Pages / GitHub Pages）+ 挂 AdSense / 联盟带货
