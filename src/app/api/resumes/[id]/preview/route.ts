import { NextResponse } from "next/server";
import { getResumeById, readResumeFile } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resume = await getResumeById(id);

  if (!resume) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  if (resume.mimeType.includes("pdf")) {
    const buffer = await readResumeFile(resume);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${sanitizeFileName(resume.originalName)}"`
      }
    });
  }

  return new Response(renderTextPreview(resume.originalName, resume.text), {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

function renderTextPreview(title: string, text: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 28px; font-family: Arial, sans-serif; color: #161616; background: #ffffff; }
  h1 { margin: 0 0 18px; font-size: 18px; }
  pre { white-space: pre-wrap; line-height: 1.45; font-size: 13px; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<pre>${escapeHtml(text)}</pre>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char];
  });
}

function sanitizeFileName(value: string) {
  return value.replace(/"/g, "");
}
