import { NextResponse } from "next/server";
import { ensureDemoData } from "@/lib/prisma";
import { redactErrorMessage } from "@/lib/ingestion/redact";

export async function withDemoDb<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    await ensureDemoData();
    const data = await handler();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[trailwise] api error", redactErrorMessage(message));
    return NextResponse.json(
      {
        error: "Request failed",
        detail: redactErrorMessage(message),
        hint: "If this is a fresh Vercel deploy, wait for the build to finish seeding prisma/demo.db, then redeploy. Or set a Postgres DATABASE_URL.",
      },
      { status: 500 },
    );
  }
}
