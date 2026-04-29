import { NextResponse } from "next/server";
import { listResumes } from "@/lib/store";
import { rankResumes } from "@/lib/matching";
import { extractKeywords, inferJobDetails } from "@/lib/keywords";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { jd?: string };
  const jd = body.jd?.trim();

  if (!jd) {
    return NextResponse.json({ error: "Job description is required." }, { status: 400 });
  }

  const resumes = await listResumes();
  if (resumes.length === 0) {
    return NextResponse.json({
      matches: [],
      jdKeywords: extractKeywords(jd, 30),
      jobDetails: inferJobDetails(jd)
    });
  }

  const matches = await rankResumes(jd, resumes);

  return NextResponse.json({
    matches,
    bestMatch: matches[0] ?? null,
    jdKeywords: extractKeywords(jd, 30),
    jobDetails: inferJobDetails(jd)
  });
}
