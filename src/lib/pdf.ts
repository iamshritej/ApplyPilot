import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const MARGIN = 42;

export async function createOptimizedResumePdf(input: {
  title: string;
  subtitle: string;
  text: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(input.title.slice(0, 80), {
    x: MARGIN,
    y: LETTER_HEIGHT - MARGIN,
    size: 15,
    font: bold,
    color: rgb(0.08, 0.09, 0.09)
  });

  page.drawText(input.subtitle.slice(0, 110), {
    x: MARGIN,
    y: LETTER_HEIGHT - MARGIN - 18,
    size: 8,
    font: regular,
    color: rgb(0.32, 0.34, 0.34)
  });

  page.drawLine({
    start: { x: MARGIN, y: LETTER_HEIGHT - MARGIN - 28 },
    end: { x: LETTER_WIDTH - MARGIN, y: LETTER_HEIGHT - MARGIN - 28 },
    thickness: 0.7,
    color: rgb(0.72, 0.74, 0.72)
  });

  const bodyText = normalizeBullets(input.text);
  const fontSize = chooseFontSize(bodyText, regular);
  const lineHeight = fontSize + 3;
  const maxWidth = LETTER_WIDTH - MARGIN * 2;
  const maxLines = Math.floor((LETTER_HEIGHT - MARGIN * 2 - 48) / lineHeight);
  const lines = wrapResumeText(bodyText, regular, fontSize, maxWidth).slice(0, maxLines);

  let y = LETTER_HEIGHT - MARGIN - 45;
  for (const line of lines) {
    const isHeading = line.length < 34 && /^[A-Z0-9 &/.-]+$/.test(line) && !line.startsWith("-");
    page.drawText(line, {
      x: MARGIN,
      y,
      size: isHeading ? fontSize + 1 : fontSize,
      font: isHeading ? bold : regular,
      color: rgb(0.1, 0.11, 0.11)
    });
    y -= lineHeight;
  }

  return Buffer.from(await pdfDoc.save());
}

function normalizeBullets(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/^[\s•*]+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chooseFontSize(text: string, font: PDFFont) {
  const maxWidth = LETTER_WIDTH - MARGIN * 2;
  for (const size of [9.8, 9.2, 8.6, 8]) {
    const lines = wrapResumeText(text, font, size, maxWidth);
    const lineHeight = size + 3;
    const maxLines = Math.floor((LETTER_HEIGHT - MARGIN * 2 - 48) / lineHeight);
    if (lines.length <= maxLines) {
      return size;
    }
  }
  return 8;
}

function wrapResumeText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const output: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      output.push("");
      continue;
    }

    const words = trimmed.split(/\s+/);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) {
          output.push(line);
        }
        line = word;
      }
    }

    if (line) {
      output.push(line);
    }
  }

  return output;
}
