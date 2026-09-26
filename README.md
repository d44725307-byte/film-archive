# 胶卷档案 · Film Stock Hub

> 一个面向胶片爱好者的**可搜索胶卷资料库**：按品牌 / 型号 / ISO / 尺寸 / 类型 / 颗粒 / 在产状态筛选，
> 在买卷前快速判断「这卷适不适合你、该用在什么题材上」。

**线上站点：<https://filmstockhub.com>**
（主站 · 无需登录 · 手机端可用）

---

## 这是什么

- **39 卷黑白胶卷**档案：规格、特性、使用感受（三段式：适合拍 / 谁在用它 / 争议）、全新价与二手价、实拍样片
- **实拍样片 25/39 卷**（共 78 张，均标注原作者 ©，仅供学习参考）
- **15 篇原创文章**：行情、器材观点、冲扫指南、拍坏排查、ISO/曝光、新手选卷、二手验机
- **排行 / 筛选工具**：按价格、ISO、规格排序比较 —— <https://filmstockhub.com/rank>

定位：**情报档案，不是图库。** 技术参数来自可公开核实的规格；
「特性 / 手感 / 使用场景」为作者原创撰写；**价格随市场波动，仅供参考**。

## 目录结构

```
film-archive/
├── index.html                首页（搜索 + 筛选 + 卡片，卡片与筛选栏**构建期静态渲染**）
├── app.js                    前端逻辑（原生 JS，零依赖）
├── style.css                 视觉样式（古典绿 + 金黄的现代复古 VI）
├── card-template.js          卡片模板（浏览器与构建脚本共用，防两边不一致）
├── filter-template.js        筛选栏模板（同上）
├── follow-block.js           关注区块模板（一次定义、50+ 页复用）
├── rank.js                   排行页的客户端筛选/排序
├── film-page.js              胶卷详情页逻辑（样片灯箱 / 海报生成 / 分享）
├── article.js                文章页逻辑（分享图生成）
├── data/
│   ├── films.json            39 卷数据（含 price_num 数值化字段，供排序比较）
│   ├── journal.json          资讯索引
│   ├── articles/*.json       15 篇文章（结构化的 blocks）
│   ├── photo-dims.json       样片尺寸（防 CLS）
│   └── photo-thumbs.json     缩略图尺寸
├── film/                     39 个胶卷独立页（生成物）
├── journal/                  文章页（生成物）
├── rank/                     排行预设页（生成物）
├── samples/                  样片、缩略图、二维码
└── tools/                    构建与体检脚本（见下）
```

## 构建流程

```bash
node tools/gen-films.js       # films.json → 39 个胶卷页 + 首页卡片 + 缩略图 + 二维码
node tools/gen-article.js data/articles/<slug>.json   # 文章 → 页面 + 资讯索引 + sitemap
node tools/gen-rank.js        # 排行页 + 预设页
node tools/gen-sitemap.js     # sitemap（唯一出口）
node tools/gen-thumbs.js      # 样片缩略图 + 尺寸表
node tools/parse-prices.js    # 价格字符串 → 数值（供筛选排序）
node tools/bust-assets.js     # 给 JS/CSS 引用打内容哈希版本号（防缓存发不出改动）
node tools/audit.js           # 全站体检（空 href / 模板残留 / canonical / 重复 id / h1 唯一…）
node tools/check-links.js     # 断链检查（本地或线上）
python3 tools/preview-server.py 8091 .   # 本地预览（支持无扩展名路径，与线上一致）
```

## 工程要点

- **全静态**：无后端、无构建框架，Cloudflare Pages 直接托管
- **CLS 优化**：首页卡片区 / 筛选栏 / 资讯区全部**构建期静态渲染**（而非 JS 注入）
- **链接规范**：站内链接统一为「无扩展名」（`/film/xxx`），与 canonical、sitemap 一致
- **资源版本号**：JS/CSS 引用带内容哈希，避免 CDN 缓存导致改动发不出去
- **可访问性/SEO**：每页唯一 h1、图片 alt、结构化数据（Product + Review + BreadcrumbList）、OG、sitemap

## 数据纪律

- **不编造**：技术参数来自公开可核实来源；价格标注为参考价并说明会波动
- **样片署名**：均标注原作者（`© 作者 · 卷名`），仅作学习参考，侵权请告知删除
- **未证实的名人关联一律不写**（宁可只写【特点】【来历】）

## 许可

站点文字内容（特性、使用感受、文章观点）为作者原创，**欢迎注明出处转载**。
技术规格部分属公开客观事实。

---

*Built and maintained by [观察家摄影](https://filmstockhub.com/about) · 站点：<https://filmstockhub.com>*
