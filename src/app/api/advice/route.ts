import { NextResponse } from "next/server";
import { rankResumes } from "@/lib/matching";
import { generateCareerAdvice } from "@/lib/optimizer";
import { getResumeById, listResumes } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    jd?: string;
    resumeId?: string;
  };
  const jd = body.jd?.trim();

  if (!jd) {
    return NextResponse.json({ error: "Job description is required." }, { status: 400 });
  }

  const resume = body.resumeId ? await getResumeById(body.resumeId) : (await listResumes())[0] ?? null;
  const [match] = resume ? await rankResumes(jd, [resume]) : [];
  const advice = await generateCareerAdvice({
    jd,
    resume,
    match: match ?? null
  });

  return NextResponse.json({ advice });
}
