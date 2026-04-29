import { NextResponse } from "next/server";
import { createApplication, listApplications } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const applications = await listApplications();
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    jobTitle?: string;
    companyName?: string;
    resumeId?: string;
    optimizedResumeId?: string;
  };

  if (!body.jobTitle?.trim() || !body.companyName?.trim() || !body.resumeId) {
    return NextResponse.json({ error: "Job title, company, and resume are required." }, { status: 400 });
  }

  const application = await createApplication({
    jobTitle: body.jobTitle.trim(),
    companyName: body.companyName.trim(),
    resumeId: body.resumeId,
    optimizedResumeId: body.optimizedResumeId
  });

  return NextResponse.json({ application });
}
