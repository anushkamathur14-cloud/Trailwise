import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";
import { redactRecord } from "@/lib/ingestion/redact";
import type { ValidatedEvent } from "@/lib/ingestion/schema";
import { resolvePerson } from "@/lib/identity/resolve";
import { resolveSession } from "@/lib/identity/sessions";
import { refreshPersonStats } from "@/lib/identity/traits";
import { liveBus } from "@/lib/live/bus";
import { parseJson } from "@/lib/utils";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type IngestResult = {
  accepted: boolean;
  duplicate: boolean;
  eventId: string;
  personId?: string;
  sessionId?: string;
  reason?: string;
};

export async function ingestEvent(
  db: PrismaClient,
  workspaceId: string,
  input: ValidatedEvent,
  options?: { skipLive?: boolean },
): Promise<IngestResult> {
  const settings = await db.settings.findUnique({ where: { workspaceId } });
  if (settings && !settings.collectionEnabled && input.source !== "tester") {
    return { accepted: false, duplicate: false, eventId: input.eventId ?? "", reason: "collection_disabled" };
  }

  const eventId = input.eventId ?? nanoid();
  const existing = await db.event.findUnique({ where: { eventId } });
  if (existing) {
    return { accepted: false, duplicate: true, eventId, personId: existing.personId, sessionId: existing.sessionId ?? undefined };
  }

  const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
  const denylist = settings ? parseJson<string[]>(settings.denylistJson, []) : [];
  const properties = redactRecord(input.properties, denylist);
  const context = redactRecord((input.context ?? {}) as Record<string, unknown>, denylist);

  const person = await resolvePerson(db, {
    workspaceId,
    anonymousId: input.anonymousId,
    userId: input.userId,
    timestamp,
    context,
    properties,
    platform: input.platform,
  });

  const session = await resolveSession(db, {
    workspaceId,
    personId: person.id,
    sessionId: input.sessionId,
    timestamp,
    eventName: input.eventName,
    timeoutMs: SESSION_TIMEOUT_MS,
  });

  const event = await db.event.create({
    data: {
      id: nanoid(),
      eventId,
      workspaceId,
      personId: person.id,
      sessionId: session.id,
      eventName: input.eventName,
      timestamp,
      platform: input.platform,
      source: input.source,
      propertiesJson: JSON.stringify(properties),
      contextJson: JSON.stringify(context),
      anonymousId: input.anonymousId,
      userId: input.userId,
    },
  });

  await db.session.update({
    where: { id: session.id },
    data: {
      lastEventAt: timestamp,
      exitEvent: input.eventName,
      eventCount: { increment: 1 },
    },
  });

  await refreshPersonStats(db, person.id);

  if (!options?.skipLive) {
    liveBus.emit("event", {
      workspaceId,
      id: event.id,
      eventId: event.eventId,
      eventName: event.eventName,
      timestamp: event.timestamp.toISOString(),
      platform: event.platform,
      personId: person.id,
      anonymousId: person.anonymousId,
      userId: person.userId,
      sessionId: session.id,
      displayName: person.displayName,
      properties,
      context,
    });
  }

  return { accepted: true, duplicate: false, eventId, personId: person.id, sessionId: session.id };
}

export async function ingestBatch(
  db: PrismaClient,
  workspaceId: string,
  events: ValidatedEvent[],
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const event of events) {
    results.push(await ingestEvent(db, workspaceId, event));
  }
  return results;
}
