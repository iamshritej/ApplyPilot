import { NextResponse } from "next/server";
import { createOptimizedResumePdf } from "@/lib/pdf";
import { extractKeywords } from "@/lib/keywords";
import { rankResumes } from "@/lib/matching";
import { optimizeResume } from "@/lib/optimizer";
import { getNextVersion, getResumeById, saveResumeFile, toPublicResume } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    resumeId?: string;
    jd?: string;
    jobTitle?: string;
    companyName?: string;
  };

  if (!body.resumeId || !body.jd?.trim()) {
    return NextResponse.json({ error: "Resume and job description are required." }, { status: 400 });
  }

  const resume = await getResumeById(body.resumeId);
  if (!resume) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  const [match] = await rankResumes(body.jd, [resume]);
  const optimization = await optimizeResume({
    resume,
    jd: body.jd,
    match,
    jobTitle: body.jobTitle,
    companyName: body.companyName
  });

  const version = await getNextVersion(resume.id);
  const baseName = resume.originalName.replace(/\.[^.]+$/, "");
  const optimizedName = `${baseName}-optimized-v${version}.pdf`;
  const pdf = await createOptimizedResumePdf({
    title: baseName,
    subtitle: `${optimization.jobTitle ?? "Optimized Role"} | ${optimization.companyName ?? "Target Company"}`,
    text: optimization.optimizedText
  });

  const optimizedResume = await saveResumeFile({
    kind: "optimized",
    parentId: resume.id,
    version,
    originalName: optimizedName,
    mimeType: "application/pdf",
    text: optimization.optimizedText,
    keywords: extractKeywords(optimization.optimizedText, 45),
    metadata: {
      sourceResumeId: resume.id,
      jobTitle: optimization.jobTitle,
      companyName: optimization.companyName,
      summary: optimization.summary
    },
    data: pdf
  });

  return NextResponse.json({
    optimizedResume: toPublicResume(optimizedResume),
    optimization,
    match
  });
}
