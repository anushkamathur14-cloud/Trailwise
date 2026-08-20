import { prisma } from "@/lib/prisma";
import { batchEventSchema } from "@/lib/ingestion/schema";
import { ingestBatch } from "@/lib/ingestion/ingest";
import { json, workspaceFrom } from "@/lib/http";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = batchEventSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid batch", details: parsed.error.flatten() }, 400);
  }
  const workspaceId = parsed.data.workspaceId ?? workspaceFrom(request);
  const results = await ingestBatch(prisma, workspaceId, parsed.data.events);
  return json({ results });
}
