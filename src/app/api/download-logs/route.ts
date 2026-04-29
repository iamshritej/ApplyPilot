import { NextResponse } from "next/server";
import { listDownloadLogs } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const downloadLogs = await listDownloadLogs();
  return NextResponse.json({ downloadLogs });
}
