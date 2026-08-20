import { prisma } from "@/lib/prisma";
import { identifySchema } from "@/lib/ingestion/schema";
import { identifyPerson } from "@/lib/identity/merge";
import { json, workspaceFrom } from "@/lib/http";
import { refreshPersonStats } from "@/lib/identity/traits";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = identifySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid identify payload", details: parsed.error.flatten() }, 400);
  }
  const workspaceId = parsed.data.workspaceId ?? workspaceFrom(request);
  const result = await identifyPerson(prisma, {
    workspaceId,
    userId: parsed.data.userId,
    anonymousId: parsed.data.anonymousId,
    traits: parsed.data.traits,
    timestamp: parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date(),
    platform: parsed.data.platform,
  });
  await refreshPersonStats(prisma, result.personId);
  return json(result);
}
