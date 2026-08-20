import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateFunnel } from "@/lib/analytics/funnels";
import { buildJourneyGraph } from "@/lib/analytics/journeys";
import { calculateRetention } from "@/lib/analytics/retention";
import { calculateSignalLift } from "@/lib/signals/lift";
import { signalsFor } from "@/lib/signals/definitions";
import { getWorkspace, type WorkspaceId } from "@/lib/workspace";
import { parseJson } from "@/lib/utils";
import type { DateRange, SegmentFilter } from "@/lib/types";

export function defaultRange(): DateRange {
  const to = new Date("2026-08-18T23:59:59.000Z");
  const from = new Date("2026-07-21T00:00:00.000Z");
  return { from, to };
}

export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime() - 1) };
}

function personWhere(workspaceId: string, range: DateRange, filters: SegmentFilter): Prisma.PersonWhereInput {
  const devices =
    filters.device === "ios"
      ? ["ios", "iphone", "mobile-web"]
      : filters.device === "android"
        ? ["android"]
        : filters.device
          ? [filters.device]
          : undefined;
  return {
    workspaceId,
    lastSeenAt: { gte: range.from, lte: range.to },
    ...(filters.channel ? { acquisitionChannel: filters.channel } : {}),
    ...(devices ? { deviceType: { in: devices } } : {}),
    ...(filters.segment ? { segment: filters.segment } : {}),
    ...(filters.country ? { country: filters.country } : {}),
  };
}

export async function overviewMetrics(
  db: PrismaClient,
  workspaceId: WorkspaceId,
  range: DateRange,
  filters: SegmentFilter,
) {
  const where = personWhere(workspaceId, range, filters);
  const prev = previousRange(range);
  const prevWhere = personWhere(workspaceId, prev, filters);

  const [people, prevPeople, sessions, prevSessions] = await Promise.all([
    db.person.findMany({ where, select: { id: true, firstSeenAt: true, activated: true, converted: true, acquisitionChannel: true } }),
    db.person.findMany({ where: prevWhere, select: { id: true, firstSeenAt: true, activated: true, converted: true } }),
    db.session.count({ where: { workspaceId, startedAt: { gte: range.from, lte: range.to } } }),
    db.session.count({ where: { workspaceId, startedAt: { gte: prev.from, lte: prev.to } } }),
  ]);

  const eventRows = await db.event.findMany({
    where: { workspaceId, timestamp: { gte: range.from, lte: range.to } },
    select: { timestamp: true, eventName: true, contextJson: true, propertiesJson: true, personId: true },
  });

  const newUsers = people.filter((p) => p.firstSeenAt >= range.from && p.firstSeenAt <= range.to).length;
  const prevNew = prevPeople.filter((p) => p.firstSeenAt >= prev.from && p.firstSeenAt <= prev.to).length;
  const activationRate = people.length ? people.filter((p) => p.activated).length / people.length : 0;
  const prevActivation = prevPeople.length ? prevPeople.filter((p) => p.activated).length / prevPeople.length : 0;
  const conversionRate = people.length ? people.filter((p) => p.converted).length / people.length : 0;
  const prevConversion = prevPeople.length ? prevPeople.filter((p) => p.converted).length / prevPeople.length : 0;

  const byDay = new Map<string, number>();
  const channels = new Map<string, number>();
  const features = new Map<string, number>();
  for (const event of eventRows) {
    const day = event.timestamp.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    features.set(event.eventName, (features.get(event.eventName) ?? 0) + 1);
  }
  for (const person of people) {
    const ch = person.acquisitionChannel ?? "unknown";
    channels.set(ch, (channels.get(ch) ?? 0) + 1);
  }

  const retentionPeople = await db.person.findMany({
    where: { workspaceId, ...("segment" in filters && filters.segment ? { segment: filters.segment } : {}) },
    select: { id: true, firstSeenAt: true },
  });
  const activity = eventRows.map((event) => ({ personId: event.personId, timestamp: event.timestamp }));
  const retention = calculateRetention(
    retentionPeople.map((person) => ({ personId: person.id, firstSeenAt: person.firstSeenAt })),
    activity,
  );

  const change = (now: number, before: number) => (before === 0 ? (now > 0 ? 1 : 0) : (now - before) / before);

  return {
    activeUsers: people.length,
    activeUsersChange: change(people.length, prevPeople.length),
    newUsers,
    newUsersChange: change(newUsers, prevNew),
    sessions,
    sessionsChange: change(sessions, prevSessions),
    activationRate,
    activationRateChange: change(activationRate, prevActivation),
    conversionRate,
    conversionRateChange: change(conversionRate, prevConversion),
    retentionRate: retention.day1,
    retentionRateChange: 0,
    eventsOverTime: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    channels: [...channels.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    features: [...features.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    retention,
  };
}

export async function funnelQuery(
  db: PrismaClient,
  workspaceId: WorkspaceId,
  funnelId: string,
  range: DateRange,
  filters: SegmentFilter,
) {
  const workspace = getWorkspace(workspaceId);
  const funnel = workspace.funnels.find((item) => item.id === funnelId) ?? workspace.funnels[0];
  const people = await db.person.findMany({
    where: personWhere(workspaceId, range, filters),
    select: { id: true, acquisitionChannel: true, deviceType: true },
  });
  const ids = people.map((p) => p.id);
  const events = await db.event.findMany({
    where: { workspaceId, personId: { in: ids }, timestamp: { gte: range.from, lte: range.to } },
    select: { personId: true, eventName: true, timestamp: true },
  });
  const personMeta = new Map(people.map((p) => [p.id, p]));
  const result = calculateFunnel(
    events.map((event) => ({
      ...event,
      channel: personMeta.get(event.personId)?.acquisitionChannel,
      device: personMeta.get(event.personId)?.deviceType,
    })),
    funnel.steps,
  );
  return { funnel, result };
}

export async function journeyQuery(
  db: PrismaClient,
  workspaceId: WorkspaceId,
  range: DateRange,
  start: string,
  end: string | undefined,
  maxSteps: number,
  filters: SegmentFilter,
) {
  const people = await db.person.findMany({
    where: personWhere(workspaceId, range, filters),
    select: { id: true },
  });
  const events = await db.event.findMany({
    where: {
      workspaceId,
      personId: { in: people.map((p) => p.id) },
      timestamp: { gte: range.from, lte: range.to },
    },
    select: { personId: true, eventName: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  return buildJourneyGraph(events, { start, end, maxSteps });
}

export async function signalQuery(db: PrismaClient, workspaceId: WorkspaceId, range: DateRange) {
  const people = await db.person.findMany({
    where: { workspaceId, lastSeenAt: { gte: range.from, lte: range.to } },
    include: { events: { select: { eventName: true, timestamp: true } } },
  });
  const defs = signalsFor(workspaceId);
  return defs.map((def) => {
    const rows = people.map((person) => {
      const names = person.events.map((e) => e.eventName);
      const times = person.events.map((e) => e.timestamp);
      return {
        personId: person.id,
        hasSignal: def.hasSignal(names, times),
        converted: person.activated,
        segment: person.segment,
      };
    });
    const stats = calculateSignalLift(rows);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      interpretation: def.interpretation(stats.lift, stats.polarity),
      stats,
    };
  });
}

export async function liveEvents(db: PrismaClient, workspaceId: string, limit = 50, cursor?: string) {
  const rows = await db.event.findMany({
    where: { workspaceId, ...(cursor ? { timestamp: { lt: new Date(cursor) } } : {}) },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { person: { select: { displayName: true, anonymousId: true, userId: true, isTester: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    eventName: row.eventName,
    timestamp: row.timestamp.toISOString(),
    platform: row.platform,
    personId: row.personId,
    sessionId: row.sessionId,
    anonymousId: row.anonymousId ?? row.person.anonymousId,
    userId: row.userId ?? row.person.userId,
    displayName: row.person.displayName,
    isTester: row.person.isTester,
    properties: parseJson(row.propertiesJson, {}),
    context: parseJson(row.contextJson, {}),
  }));
}
