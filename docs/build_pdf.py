from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BRAND_COMPANY = "VIZIA S.A.C."
BRAND_PRODUCT = "Bodega Santa María — Web ERP"
BRAND_YEAR = "2026"
BRAND_FOOTER = f"{BRAND_COMPANY} · {BRAND_PRODUCT} · {BRAND_YEAR}"
BRAND_AUTHOR = f"{BRAND_COMPANY} — {BRAND_PRODUCT}"

# Ancho útil A4 con márgenes 2 cm
CONTENT_WIDTH = A4[0] - 4.0 * cm

HEADER_BG = colors.HexColor("#1F3A5F")
HEADER_FG = colors.white
ROW_ALT = colors.HexColor("#F4F7FB")
GRID = colors.HexColor("#C5CDD8")
ACCENT = colors.HexColor("#2C5282")

DIAGRAM_BG = colors.HexColor("#EEF4FA")
DIAGRAM_BORDER = colors.HexColor("#2C5282")
DIAGRAM_BOX_BG = colors.HexColor("#1F3A5F")
DIAGRAM_BOX_FG = colors.white
ARROW_COLOR = colors.HexColor("#475569")


def _diagram_style():
    styles = getSampleStyleSheet()
    return ParagraphStyle(
        "ViziaDiagramBox",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=TA_CENTER,
        textColor=DIAGRAM_BOX_FG,
    )


def _diagram_caption_style():
    styles = getSampleStyleSheet()
    return ParagraphStyle(
        "ViziaDiagramCaption",
        parent=styles["BodyText"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#64748B"),
        spaceBefore=2,
        spaceAfter=8,
    )


def _parse_mermaid_flowchart(src: str) -> list[str] | None:
    """
    Extrae secuencia lineal de nodos de un flowchart mermaid simple (TD/LR).
    Soporta: A[Texto] --> B[Texto] | A([Texto]) --> B
    """
    lines = [ln.strip() for ln in src.splitlines() if ln.strip() and not ln.strip().startswith("%%")]
    if not lines:
        return None
    head = lines[0].lower()
    if not (head.startswith("flowchart") or head.startswith("graph")):
        return None

    node_labels: dict[str, str] = {}
    edges: list[tuple[str, str]] = []
    node_re = re.compile(
        r"([A-Za-z0-9_]+)\s*(?:\[([^\]]+)\]|\(([^\)]+)\)|\{([^\}]+)\}|\(\[([^\]]+)\]\))"
    )
    edge_re = re.compile(
        r"([A-Za-z0-9_]+)\s*(?:-->|---|==>|-.->)\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)"
    )

    for ln in lines[1:]:
        for m in node_re.finditer(ln):
            nid = m.group(1)
            label = next(g for g in m.groups()[1:] if g)
            node_labels[nid] = label.strip()
        for m in edge_re.finditer(ln):
            edges.append((m.group(1), m.group(2)))
            for nid in (m.group(1), m.group(2)):
                if nid not in node_labels:
                    node_labels[nid] = nid

    if not edges:
        # Solo nodos sueltos
        if node_labels:
            return list(node_labels.values())
        return None

    # Orden topológico simple (cadena)
    successors: dict[str, list[str]] = {}
    predecessors: dict[str, int] = {n: 0 for n in node_labels}
    for a, b in edges:
        successors.setdefault(a, []).append(b)
        predecessors[b] = predecessors.get(b, 0) + 1
        predecessors.setdefault(a, predecessors.get(a, 0))

    starts = [n for n, deg in predecessors.items() if deg == 0]
    if not starts:
        starts = [edges[0][0]]

    ordered: list[str] = []
    seen: set[str] = set()
    queue = list(starts)
    while queue:
        n = queue.pop(0)
        if n in seen:
            continue
        seen.add(n)
        ordered.append(n)
        for nxt in successors.get(n, []):
            if nxt not in seen:
                queue.append(nxt)

    for n in node_labels:
        if n not in seen:
            ordered.append(n)

    return [node_labels.get(n, n) for n in ordered]


def _build_flow_diagram(steps: list[str], *, caption: str | None = None) -> list:
    """Diagrama vertical con cajas y flechas (PDF)."""
    if not steps:
        return []
    box_style = _diagram_style()
    caption_style = _diagram_caption_style()
    arrow_style = ParagraphStyle(
        "ViziaArrow",
        parent=getSampleStyleSheet()["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        textColor=ARROW_COLOR,
    )
    blocks: list = [Spacer(1, 6)]
    for idx, step in enumerate(steps):
        cell = Paragraph(html.escape(step), box_style)
        t = Table([[cell]], colWidths=[CONTENT_WIDTH * 0.72])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), DIAGRAM_BOX_BG),
                    ("BOX", (0, 0), (-1, -1), 1.2, DIAGRAM_BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        t.hAlign = "CENTER"
        blocks.append(t)
        if idx < len(steps) - 1:
            blocks.append(Paragraph("▼", arrow_style))
    if caption:
        blocks.append(Paragraph(html.escape(caption), caption_style))
    else:
        blocks.append(Spacer(1, 8))
    return blocks


def _build_ascii_diagram_box(text: str) -> list:
    """Caja sombreada para diagramas ASCII / código de flujo."""
    code_style = ParagraphStyle(
        "ViziaAsciiDiagram",
        parent=getSampleStyleSheet()["Code"],
        fontName="Courier",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#1E293B"),
        alignment=TA_LEFT,
    )
    # Preformatted dentro de tabla con fondo
    pre = Preformatted(text, code_style)
    wrapper = Table([[pre]], colWidths=[CONTENT_WIDTH])
    wrapper.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), DIAGRAM_BG),
                ("BOX", (0, 0), (-1, -1), 1.0, DIAGRAM_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    wrapper.hAlign = "LEFT"
    return [Spacer(1, 4), wrapper, Spacer(1, 8)]


def _looks_like_flow_ascii(text: str) -> bool:
    """Heurística: bloques con flechas ↓ / → / --> típicos de flujos."""
    markers = ("→", "↓", "▼", "-->", "==>", "┌", "└", "│", "├")
    hits = sum(1 for m in markers if m in text)
    return hits >= 2 or text.count("↓") >= 2 or text.count("→") >= 2


def _code_fence_to_flowables(lang: str, body: str, styles: dict) -> list:
    lang_l = (lang or "").strip().lower()
    body = body.strip("\n")

    if lang_l in ("mermaid", "mmd"):
        steps = _parse_mermaid_flowchart(body)
        if steps:
            return _build_flow_diagram(steps, caption="Flujo operativo")
        return _build_ascii_diagram_box(body)

    if lang_l in ("flow", "diagram", "ascii"):
        return _build_ascii_diagram_box(body)

    if not lang_l and _looks_like_flow_ascii(body):
        return _build_ascii_diagram_box(body)

    # Código genérico
    safe_lines = []
    for cl in body.splitlines() or [""]:
        if len(cl) > 95:
            while len(cl) > 95:
                safe_lines.append(cl[:95])
                cl = cl[95:]
            if cl:
                safe_lines.append(cl)
        else:
            safe_lines.append(cl)
    return [Preformatted("\n".join(safe_lines), styles["code"])]


def _inline_md(text: str) -> str:
    """Markdown inline → ReportLab rich text (escapado, sin romper tags)."""
    raw = text.strip()
    # Proteger spans de código antes de bold/italic
    code_parts: list[str] = []

    def _park_code(m: re.Match[str]) -> str:
        code_parts.append(m.group(1))
        return f"\x00CODE{len(code_parts) - 1}\x00"

    raw = re.sub(r"`([^`]+)`", _park_code, raw)
    raw = html.escape(raw)
    raw = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", raw)
    # Itálica solo con *palabra* (no globs tipo batch*)
    raw = re.sub(r"(?<![\w*])\*([^*\n]+?)\*(?![\w*])", r"<i>\1</i>", raw)
    for i, code in enumerate(code_parts):
        safe = html.escape(code)
        raw = raw.replace(
            f"\x00CODE{i}\x00",
            f"<font face='Courier' size='9'>{safe}</font>",
        )
    return raw


def _is_table_sep(line: str) -> bool:
    s = line.strip()
    if not s.startswith("|"):
        return False
    # |---|:---| or | --- | --- |
    cells = [c.strip() for c in s.strip("|").split("|")]
    if not cells:
        return False
    return all(re.fullmatch(r":?-{3,}:?", c.replace(" ", "")) for c in cells if c)


def _parse_table_row(line: str) -> list[str]:
    s = line.strip().strip("|")
    return [c.strip() for c in s.split("|")]


def _make_styles():
    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "ViziaBase",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        spaceAfter=6,
        textColor=colors.HexColor("#222222"),
        alignment=TA_LEFT,
    )
    h1 = ParagraphStyle(
        "ViziaH1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        spaceBefore=4,
        spaceAfter=10,
        textColor=HEADER_BG,
    )
    h2 = ParagraphStyle(
        "ViziaH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        spaceBefore=14,
        spaceAfter=8,
        textColor=ACCENT,
        borderPadding=2,
    )
    h3 = ParagraphStyle(
        "ViziaH3",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=15,
        spaceBefore=10,
        spaceAfter=5,
        textColor=colors.HexColor("#334155"),
    )
    code = ParagraphStyle(
        "ViziaCode",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=8.5,
        leading=11,
        backColor=colors.HexColor("#F8FAFC"),
        borderPadding=8,
        leftIndent=4,
        rightIndent=4,
        spaceBefore=6,
        spaceAfter=10,
        textColor=colors.HexColor("#1E293B"),
    )
    bullet = ParagraphStyle(
        "ViziaBullet",
        parent=base,
        leftIndent=14,
        firstLineIndent=0,
        spaceBefore=1,
        spaceAfter=3,
        bulletIndent=0,
        leading=13,
    )
    cell = ParagraphStyle(
        "ViziaCell",
        parent=base,
        fontSize=8.5,
        leading=11,
        spaceBefore=0,
        spaceAfter=0,
    )
    cell_header = ParagraphStyle(
        "ViziaCellHeader",
        parent=cell,
        fontName="Helvetica-Bold",
        textColor=HEADER_FG,
        fontSize=8.5,
        leading=11,
    )
    return {
        "base": base,
        "h1": h1,
        "h2": h2,
        "h3": h3,
        "code": code,
        "bullet": bullet,
        "cell": cell,
        "cell_header": cell_header,
    }


def _build_table(rows: list[list[str]], styles: dict) -> Table:
    """Construye Table ReportLab con celdas Paragraph (wrap) y estilo profesional."""
    if not rows:
        return Spacer(1, 1)

    n_cols = max(len(r) for r in rows)
    normalized: list[list[str]] = []
    for r in rows:
        padded = list(r) + [""] * (n_cols - len(r))
        normalized.append(padded[:n_cols])

    data: list[list] = []
    for i, row in enumerate(normalized):
        style = styles["cell_header"] if i == 0 else styles["cell"]
        data.append([Paragraph(_inline_md(c), style) for c in row])

    # Anchos proporcionales; primera columna un poco más estrecha si hay muchas
    col_w = CONTENT_WIDTH / n_cols
    if n_cols == 2:
        col_widths = [CONTENT_WIDTH * 0.38, CONTENT_WIDTH * 0.62]
    elif n_cols == 3:
        col_widths = [CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.36, CONTENT_WIDTH * 0.36]
    elif n_cols >= 4:
        # Primera columna un poco más ancha para nombres
        rest = (CONTENT_WIDTH - CONTENT_WIDTH * 0.22) / (n_cols - 1)
        col_widths = [CONTENT_WIDTH * 0.22] + [rest] * (n_cols - 1)
    else:
        col_widths = [col_w] * n_cols

    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), HEADER_FG),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.4, GRID),
        ("BOX", (0, 0), (-1, -1), 0.8, HEADER_BG),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
    ]
    table.setStyle(TableStyle(style_cmds))
    return table


def _md_to_flowables(md: str, *, skip_first_h1: bool = True):
    """
    Markdown → ReportLab flowables.
    Soporta: headings, párrafos, listas -, listas 1., tablas | |, code fences, ---.
    """
    styles = _make_styles()
    out: list = []
    lines = md.splitlines()
    in_code = False
    code_lang = ""
    code_buf: list[str] = []
    para_buf: list[str] = []
    bullet_buf: list[str] = []
    numbered_buf: list[str] = []
    table_buf: list[list[str]] = []
    saw_h1 = False
    i = 0

    def flush_paragraph():
        nonlocal para_buf
        if not para_buf:
            return
        text = " ".join(s.strip() for s in para_buf).strip()
        if text:
            out.append(Paragraph(_inline_md(text), styles["base"]))
        para_buf = []

    def flush_bullets():
        nonlocal bullet_buf
        if not bullet_buf:
            return
        for b in bullet_buf:
            out.append(Paragraph(f"• {_inline_md(b)}", styles["bullet"]))
        bullet_buf = []

    def flush_numbered():
        nonlocal numbered_buf
        if not numbered_buf:
            return
        for idx, b in enumerate(numbered_buf, start=1):
            out.append(Paragraph(f"<b>{idx}.</b> {_inline_md(b)}", styles["bullet"]))
        numbered_buf = []

    def flush_table():
        nonlocal table_buf
        if not table_buf:
            return
        # Quitar filas separadoras residuales
        clean = [r for r in table_buf if not all(re.fullmatch(r":?-{3,}:?", c.replace(" ", "") or "-") for c in r)]
        if clean:
            out.append(Spacer(1, 4))
            out.append(_build_table(clean, styles))
            out.append(Spacer(1, 10))
        table_buf = []

    def flush_all():
        flush_paragraph()
        flush_bullets()
        flush_numbered()
        flush_table()

    while i < len(lines):
        line = lines[i].rstrip("\n")

        fence = re.match(r"^```(\w*)\s*$", line.strip())
        if fence:
            if in_code:
                flush_all()
                block = "\n".join(code_buf)
                out.extend(_code_fence_to_flowables(code_lang, block, styles))
                code_buf = []
                code_lang = ""
                in_code = False
            else:
                flush_all()
                in_code = True
                code_lang = fence.group(1) or ""
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # Tabla markdown: fila | ... | (+ separador opcional)
        if line.strip().startswith("|") and "|" in line.strip()[1:]:
            flush_paragraph()
            flush_bullets()
            flush_numbered()
            if _is_table_sep(line):
                i += 1
                continue
            table_buf.append(_parse_table_row(line))
            # Acumular filas siguientes de la misma tabla
            j = i + 1
            while j < len(lines):
                nxt = lines[j].rstrip("\n")
                if nxt.strip().startswith("|") and "|" in nxt.strip()[1:]:
                    if _is_table_sep(nxt):
                        j += 1
                        continue
                    table_buf.append(_parse_table_row(nxt))
                    j += 1
                else:
                    break
            flush_table()
            i = j
            continue

        if line.strip() == "---":
            flush_all()
            out.append(Spacer(1, 8))
            i += 1
            continue

        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            flush_all()
            level = len(m.group(1))
            text = m.group(2).strip()
            if level == 1 and skip_first_h1 and not saw_h1:
                saw_h1 = True
                i += 1
                continue
            saw_h1 = True
            rich = _inline_md(text)
            if level == 1:
                out.append(Paragraph(rich, styles["h1"]))
            elif level == 2:
                out.append(Paragraph(rich, styles["h2"]))
            else:
                out.append(Paragraph(rich, styles["h3"]))
            i += 1
            continue

        m_num = re.match(r"^(\d+)\.\s+(.*)$", line.strip())
        if m_num:
            flush_paragraph()
            flush_bullets()
            flush_table()
            numbered_buf.append(m_num.group(2))
            i += 1
            continue

        if line.strip().startswith("- "):
            flush_paragraph()
            flush_numbered()
            flush_table()
            bullet_buf.append(line.strip()[2:])
            i += 1
            continue

        if line.strip() == "":
            flush_all()
            out.append(Spacer(1, 4))
            i += 1
            continue

        flush_bullets()
        flush_numbered()
        flush_table()
        para_buf.append(line)
        i += 1

    flush_all()
    if in_code and code_buf:
        out.extend(_code_fence_to_flowables(code_lang, "\n".join(code_buf), styles))

    return out


def _cover_flowables(*, title: str, subtitle: str | None = None):
    styles = getSampleStyleSheet()
    company = ParagraphStyle(
        "CoverCompany",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=28,
        alignment=TA_CENTER,
        textColor=HEADER_BG,
        spaceAfter=8,
    )
    product = ParagraphStyle(
        "CoverProduct",
        parent=styles["Heading2"],
        fontName="Helvetica",
        fontSize=14,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569"),
        spaceAfter=28,
    )
    doc_title = ParagraphStyle(
        "CoverTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=22,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=10,
    )
    doc_sub = ParagraphStyle(
        "CoverSub",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569"),
        spaceAfter=6,
    )
    year = ParagraphStyle(
        "CoverYear",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#64748B"),
    )

    # Barra decorativa vía tabla
    bar = Table([[""]], colWidths=[CONTENT_WIDTH * 0.35], rowHeights=[3])
    bar.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    bar.hAlign = "CENTER"

    blocks = [
        Spacer(1, 4.2 * cm),
        Paragraph(BRAND_COMPANY, company),
        Paragraph(BRAND_PRODUCT, product),
        bar,
        Spacer(1, 0.8 * cm),
        Paragraph(html.escape(title), doc_title),
    ]
    if subtitle:
        blocks.append(Paragraph(html.escape(subtitle), doc_sub))
    blocks.extend(
        [
            Spacer(1, 1.4 * cm),
            Paragraph(BRAND_YEAR, year),
            Spacer(1, 0.3 * cm),
            Paragraph(html.escape(BRAND_FOOTER), year),
            PageBreak(),
        ]
    )
    return blocks


def _header_footer(canvas, doc):
    canvas.saveState()
    page_w, page_h = A4
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.setLineWidth(0.6)
    canvas.line(2.0 * cm, page_h - 1.35 * cm, page_w - 2.0 * cm, page_h - 1.35 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(2.0 * cm, page_h - 1.15 * cm, f"{BRAND_COMPANY} · Web ERP · {BRAND_YEAR}")
    short_title = (doc.title or "").replace(f"{BRAND_COMPANY} — ", "")
    if len(short_title) > 42:
        short_title = short_title[:39] + "…"
    canvas.drawRightString(page_w - 2.0 * cm, page_h - 1.15 * cm, short_title)
    canvas.line(2.0 * cm, 1.4 * cm, page_w - 2.0 * cm, 1.4 * cm)
    canvas.drawString(2.0 * cm, 1.05 * cm, BRAND_COMPANY)
    canvas.drawCentredString(page_w / 2, 1.05 * cm, "Bodega Santa María")
    canvas.drawRightString(page_w - 2.0 * cm, 1.05 * cm, f"Pág. {doc.page}")
    canvas.restoreState()


def build_pdf(
    input_md: Path,
    output_pdf: Path,
    *,
    title: str,
    author: str,
    subtitle: str | None = None,
    with_cover: bool = True,
):
    md = input_md.read_text(encoding="utf-8")
    doc = SimpleDocTemplate(
        str(output_pdf),
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.0 * cm,
        title=f"{BRAND_COMPANY} — {title}",
        author=author,
    )
    story = []
    if with_cover:
        story.extend(_cover_flowables(title=title, subtitle=subtitle))
    story.extend(_md_to_flowables(md, skip_first_h1=True))
    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)


PDF_TARGETS = [
    {
        "input": "00_resumen_general_vizia_web.md",
        "output": "Resumen_General_WEB_VIZIA_Bodega_Santa_Maria.pdf",
        "title": "Resumen general — Web ERP",
        "subtitle": "Visión ejecutiva · Almacenes · SKU/botellas · Web 1.0.0",
    },
    {
        "input": "02_resumen_tecnico_vizia_web.md",
        "output": "Resumen_Tecnico_WEB_VIZIA_Bodega_Santa_Maria.pdf",
        "title": "Resumen técnico — Web ERP",
        "subtitle": "Arquitectura · Política almacén↔tipo · RPC · Web 1.0.0",
    },
    {
        "input": "01_manual_usuario_cliente_web.md",
        "output": "Manual_Usuario_WEB_VIZIA_Bodega_Santa_Maria.pdf",
        "title": "Manual de uso detallado — Web ERP",
        "subtitle": "Operación · Almacenes · SKU · Packs · Ajustes · Web 1.0.0",
    },
]


def main():
    parser = argparse.ArgumentParser(
        description="Genera PDFs cliente VIZIA S.A.C. (Web ERP) desde markdown de docs/"
    )
    parser.add_argument(
        "--only",
        choices=[t["output"] for t in PDF_TARGETS],
        help="Generar solo un PDF específico",
    )
    parser.add_argument(
        "--no-cover",
        action="store_true",
        help="Omitir portada VIZIA",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    out_dir = root / "pdf"
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = PDF_TARGETS
    if args.only:
        targets = [t for t in PDF_TARGETS if t["output"] == args.only]

    for spec in targets:
        input_md = root / spec["input"]
        output_pdf = out_dir / spec["output"]
        if not input_md.exists():
            raise SystemExit(f"Input markdown not found: {input_md}")
        build_pdf(
            input_md,
            output_pdf,
            title=spec["title"],
            author=BRAND_AUTHOR,
            subtitle=spec.get("subtitle"),
            with_cover=not args.no_cover,
        )
        size_kb = output_pdf.stat().st_size / 1024
        print(f"Wrote: {output_pdf} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
