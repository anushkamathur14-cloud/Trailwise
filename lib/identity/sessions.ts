import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";

export const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function belongsToSession(
  lastEventAt: Date,
  nextTimestamp: Date,
  timeoutMs = DEFAULT_SESSION_TIMEOUT_MS,
): boolean {
  return nextTimestamp.getTime() - lastEventAt.getTime() <= timeoutMs;
}

export async function resolveSession(
  db: PrismaClient,
  input: {
    workspaceId: string;
    personId: string;
    sessionId?: string;
    timestamp: Date;
    eventName: string;
    timeoutMs?: number;
  },
) {
  if (input.sessionId) {
    const existing = await db.session.findUnique({ where: { id: input.sessionId } });
    if (existing) return existing;
    return db.session.create({
      data: {
        id: input.sessionId,
        workspaceId: input.workspaceId,
        personId: input.personId,
        startedAt: input.timestamp,
        lastEventAt: input.timestamp,
        entryEvent: input.eventName,
        exitEvent: input.eventName,
        eventCount: 0,
      },
    });
  }

  const latest = await db.session.findFirst({
    where: { personId: input.personId },
    orderBy: { lastEventAt: "desc" },
  });
  if (latest && belongsToSession(latest.lastEventAt, input.timestamp, input.timeoutMs)) {
    return latest;
  }

  return db.session.create({
    data: {
      id: nanoid(),
      workspaceId: input.workspaceId,
      personId: input.personId,
      startedAt: input.timestamp,
      lastEventAt: input.timestamp,
      entryEvent: input.eventName,
      exitEvent: input.eventName,
      eventCount: 0,
    },
  });
}

export function groupEventsIntoSessions<T extends { timestamp: Date | string; eventName: string }>(
  events: T[],
  timeoutMs = DEFAULT_SESSION_TIMEOUT_MS,
): Array<{ startedAt: Date; events: T[] }> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const sessions: Array<{ startedAt: Date; events: T[] }> = [];
  for (const event of sorted) {
    const ts = new Date(event.timestamp);
    const current = sessions[sessions.length - 1];
    if (!current) {
      sessions.push({ startedAt: ts, events: [event] });
      continue;
    }
    const last = current.events[current.events.length - 1];
    if (belongsToSession(new Date(last.timestamp), ts, timeoutMs)) {
      current.events.push(event);
    } else {
      sessions.push({ startedAt: ts, events: [event] });
    }
  }
  return sessions;
}
