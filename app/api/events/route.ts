import { prisma, ensureDemoData } from "@/lib/prisma";
import { analyticsEventSchema } from "@/lib/ingestion/schema";
import { ingestEvent } from "@/lib/ingestion/ingest";
import { json, workspaceFrom } from "@/lib/http";
import { withDemoDb } from "@/lib/api";

export async function POST(request: Request) {
  try {
    await ensureDemoData();
    const body = await request.json().catch(() => null);
    const parsed = analyticsEventSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid event", details: parsed.error.flatten() }, 400);
    }
    const workspaceId = parsed.data.workspaceId ?? workspaceFrom(request);
    const result = await ingestEvent(prisma, workspaceId, parsed.data);
    return json(result, result.accepted ? 201 : result.duplicate ? 200 : 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    return json({ error: message }, 500);
  }
}

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const events = await prisma.event.findMany({
      where: {
        workspaceId,
        ...(cursor ? { timestamp: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: { person: { select: { displayName: true, anonymousId: true, userId: true, isTester: true } } },
    });
    return {
      events: events.map((event) => ({
        id: event.id,
        eventId: event.eventId,
        eventName: event.eventName,
        timestamp: event.timestamp.toISOString(),
        platform: event.platform,
        source: event.source,
        personId: event.personId,
        sessionId: event.sessionId,
        anonymousId: event.anonymousId ?? event.person.anonymousId,
        userId: event.userId ?? event.person.userId,
        displayName: event.person.displayName,
        isTester: event.person.isTester,
        properties: JSON.parse(event.propertiesJson),
        context: JSON.parse(event.contextJson),
      })),
      nextCursor: events.at(-1)?.timestamp.toISOString() ?? null,
    };
  });
}
