import { NextResponse } from "next/server";
import { readLatestReport } from "@/lib/reportFiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await readLatestReport();
  if (!report) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
