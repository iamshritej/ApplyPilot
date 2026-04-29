export async function extractResumeText(buffer: Buffer, mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();

  try {
    if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      return cleanExtractedText(parsed.text);
    }

    if (
      mimeType.includes("word") ||
      mimeType.includes("officedocument") ||
      lowerName.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer });
      return cleanExtractedText(parsed.value);
    }
  } catch {
    return fallbackText(buffer, fileName);
  }

  return fallbackText(buffer, fileName);
}

function fallbackText(buffer: Buffer, fileName: string) {
  const text = buffer.toString("utf8");
  const printable = text.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ");
  const cleaned = cleanExtractedText(printable);

  if (cleaned.length > 120) {
    return cleaned;
  }

  return `${fileName}\n\nText extraction was limited for this file. Replace this with a DOCX or searchable PDF for stronger matching.`;
}

function cleanExtractedText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
