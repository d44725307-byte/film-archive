#!/usr/bin/env python3
"""把「情绪型公众号稿」（Markdown）生成带排版的 .docx —— 直接用于公众号「文档导入」。

与 tools/make-wx-docx.py 的区别：
  · make-wx-docx.py 输入是站内文章 JSON（有 blocks 结构）
  · 本脚本输入是手写的 Markdown 推文（情绪型稿），支持排版标记：
      第一行 # 标题            → 居中大标题
      【居中】文本             → 居中加粗（开篇金句/结尾引导）
      【品牌徽章】文本          → 居中、红底白字（观察家摄影）
      **加粗**                → 段内加粗
      ## 一、xxx              → 小节标题（金色加粗）
      ---                     → 分隔线（跳过，不输出）
      > 开头说明               → 跳过不输出（给作者看的备注）
      [[图:文件名|图注]]        → 插入图片（从 --img 指定目录找）+ 图注

用法：
  python3 tools/md-to-wx-docx.py 公众号导出/推文-36张-情绪型V2.md \
      --img film-archive/samples/photos --out 公众号导出/word
"""
import os
import re
import sys

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

FONT = 'PingFang SC'
DARK = RGBColor(0x22, 0x22, 0x22)
GOLD = RGBColor(0x8A, 0x64, 0x0D)
GREY = RGBColor(0x88, 0x88, 0x88)
RED = 'C0392B'
IMG_W = Cm(14.5)


def set_font(run, size=11, bold=False, color=DARK, italic=False):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = rPr.makeelement(qn('w:rFonts'), {})
        rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), FONT)
    rFonts.set(qn('w:hAnsi'), FONT)
    rFonts.set(qn('w:eastAsia'), FONT)


def para(doc, align=None, after=8, before=0, line=1.7):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.line_spacing = line
    return p


TOKEN = re.compile(r'(\*\*.+?\*\*|\[\[图:[^\]]+\]\])')


def add_inline(p, text, size=11, color=DARK):
    for part in TOKEN.split(text):
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            set_font(p.add_run(part[2:-2]), size, bold=True, color=color)
        else:
            set_font(p.add_run(part), size, color=color)


def brand_badge(doc, text):
    """红底白字的品牌标（用高亮模拟：加底纹不方便，改用红色加粗居中）"""
    p = para(doc, WD_ALIGN_PARAGRAPH.CENTER, after=14, before=6)
    set_font(p.add_run(' ' + text + ' '), 11, bold=True, color=RGBColor(0xC0, 0x39, 0x2B))


def add_figure(doc, path, caption):
    if not os.path.exists(path):
        print(f'   ⚠️ 缺图: {path}')
        return
    doc.add_picture(path, width=IMG_W)
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption:
        c = para(doc, WD_ALIGN_PARAGRAPH.CENTER, after=14, before=4)
        set_font(c.add_run(caption), 9, color=GREY)


def build(md_path, imgdir, outdir):
    doc = Document()
    st = doc.styles['Normal']
    st.font.name = FONT
    st.font.size = Pt(11)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Cm(2.2)
        s.left_margin = s.right_margin = Cm(2.2)

    lines = open(md_path, encoding='utf-8').read().split('\n')
    title_done = False
    fig_n = 0
    for raw in lines:
        ln = raw.rstrip()
        if not ln.strip():
            continue
        # 跳过给作者看的备注
        if ln.startswith('>') or ln.strip() == '---':
            continue
        # 标题
        if ln.startswith('# ') and not title_done:
            p = para(doc, WD_ALIGN_PARAGRAPH.CENTER, after=18)
            set_font(p.add_run(ln[2:].strip()), 16, bold=True, color=RGBColor(0x22, 0x22, 0x22))
            title_done = True
            continue
        # 小节标题
        if ln.startswith('## '):
            p = para(doc, after=10, before=16)
            set_font(p.add_run(re.sub(r'\*\*', '', ln[3:].strip())), 13.5, bold=True, color=GOLD)
            continue
        # 品牌徽章
        m = re.match(r'^【品牌徽章】(.+)$', ln.strip())
        if m:
            brand_badge(doc, m.group(1).strip())
            continue
        # 居中大字
        m = re.match(r'^【居中】(.*)$', ln.strip())
        if m:
            p = para(doc, WD_ALIGN_PARAGRAPH.CENTER, after=14, before=8)
            add_inline(p, m.group(1).strip(), 13)
            continue
        # 图片占位
        m = re.match(r'^\[\[图:([^|\]]+)\|?([^\]]*)\]\]$', ln.strip())
        if m:
            add_figure(doc, os.path.join(imgdir, m.group(1).strip()), m.group(2).strip())
            fig_n += 1
            continue
        # 【…】这类排版提示 → 跳过（可能含空格/加号，用更宽松的匹配）
        st = ln.strip()
        if st.startswith('【') and st.endswith('】') and not st.startswith('【居中】') and not st.startswith('【品牌徽章】'):
            continue
        # 正文
        p = para(doc)
        add_inline(p, ln.strip(), 11)

    os.makedirs(outdir, exist_ok=True)
    name = os.path.splitext(os.path.basename(md_path))[0] + '.docx'
    out = os.path.join(outdir, name)
    doc.save(out)
    return out, fig_n


def main():
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        sys.exit(1)
    src = argv[0]
    imgdir = '.'
    outdir = '公众号导出/word'
    if '--img' in argv:
        imgdir = argv[argv.index('--img') + 1]
    if '--out' in argv:
        outdir = argv[argv.index('--out') + 1]
    out, fig = build(src, imgdir, outdir)
    kb = os.path.getsize(out) / 1024
    print(f'✅ {out}  （{kb:.0f} KB，含图 {fig} 张）')


if __name__ == '__main__':
    main()
