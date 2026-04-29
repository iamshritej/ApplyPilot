import { NextResponse } from "next/server";
import { createDownloadLog, getResumeById, readResumeFile } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resume = await getResumeById(id);

  if (!resume) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  const buffer = await readResumeFile(resume);
  await createDownloadLog({
    resumeId: resume.id,
    fileName: resume.originalName
  });

  return new Response(buffer, {
    headers: {
      "Content-Type": resume.mimeType,
      "Content-Disposition": `attachment; filename="${sanitizeFileName(resume.originalName)}"`
    }
  });
}

function sanitizeFileName(value: string) {
  return value.replace(/"/g, "");
}
