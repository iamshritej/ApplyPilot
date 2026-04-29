from __future__ import annotations

from io import BytesIO
from pathlib import Path
from textwrap import wrap

from docx import Document
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


def extract_resume_text(content: bytes, filename: str, mime_type: str) -> str:
    lower_name = filename.lower()
    try:
        if "pdf" in mime_type or lower_name.endswith(".pdf"):
            reader = PdfReader(BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            return clean_text(text)

        if "word" in mime_type or lower_name.endswith(".docx"):
            document = Document(BytesIO(content))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
            return clean_text(text)
    except Exception:
        return fallback_text(content, filename)

    return fallback_text(content, filename)


def fallback_text(content: bytes, filename: str) -> str:
    decoded = content.decode("utf-8", errors="ignore")
    cleaned = clean_text(decoded)
    if len(cleaned) > 120:
        return cleaned
    return f"{filename}\n\nText extraction was limited. Upload a searchable PDF or DOCX for stronger matching."


def clean_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.replace("\r", "").splitlines()).strip()


def create_optimized_pdf(title: str, subtitle: str, body: str) -> bytes:
    buffer = BytesIO()
    page_width, page_height = letter
    margin = 0.55 * inch

    pdf = canvas.Canvas(buffer, pagesize=letter)
    pdf.setTitle(title)

    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(margin, page_height - margin, title[:90])
    pdf.setFont("Helvetica", 8)
    pdf.drawString(margin, page_height - margin - 16, subtitle[:120])
    pdf.line(margin, page_height - margin - 25, page_width - margin, page_height - margin - 25)

    clean_body = body.replace("\r", "").strip()
    font_size, lines = fit_one_page(clean_body, page_width - margin * 2, page_height - margin * 2 - 44)
    y = page_height - margin - 42
    line_height = font_size + 3

    for line in lines:
        is_heading = line and len(line) < 36 and line.upper() == line and not line.startswith("-")
        pdf.setFont("Helvetica-Bold" if is_heading else "Helvetica", font_size + 1 if is_heading else font_size)
        pdf.drawString(margin, y, line)
        y -= line_height

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def fit_one_page(text: str, max_width: float, max_height: float) -> tuple[float, list[str]]:
    for font_size in (9.8, 9.2, 8.6, 8.0):
        lines = wrap_resume_text(text, max_width, font_size)
        if len(lines) * (font_size + 3) <= max_height:
            return font_size, lines
    lines = wrap_resume_text(text, max_width, 8.0)
    max_lines = int(max_height / 11)
    return 8.0, lines[:max_lines]


def wrap_resume_text(text: str, max_width: float, font_size: float) -> list[str]:
    # Helvetica average character width is roughly half the font size.
    max_chars = max(48, int(max_width / (font_size * 0.52)))
    lines: list[str] = []
    for paragraph in text.splitlines():
        paragraph = paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        lines.extend(wrap(paragraph, width=max_chars, break_long_words=False) or [""])
    return lines
