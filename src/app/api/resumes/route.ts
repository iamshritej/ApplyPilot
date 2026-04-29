import { NextResponse } from "next/server";
import { extractKeywords } from "@/lib/keywords";
import { extractResumeText } from "@/lib/text-extract";
import { listResumes, saveResumeFile, toPublicResume } from "@/lib/store";

export const runtime = "nodejs";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword"
]);

export async function GET() {
  const resumes = await listResumes();
  return NextResponse.json({
    resumes: resumes.map(toPublicResume)
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
  }

  const isAllowed =
    allowedMimeTypes.has(file.type) ||
    file.name.toLowerCase().endsWith(".pdf") ||
    file.name.toLowerCase().endsWith(".docx");

  if (!isAllowed) {
    return NextResponse.json({ error: "Only PDF and DOCX resumes are supported." }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractResumeText(buffer, file.type, file.name);
  const keywords = extractKeywords(text, 45);
  const resume = await saveResumeFile({
    kind: "original",
    originalName: file.name,
    mimeType: file.type || inferMimeType(file.name),
    text,
    keywords,
    data: buffer
  });

  return NextResponse.json({
    resume: toPublicResume(resume)
  });
}

function inferMimeType(fileName: string) {
  if (fileName.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
