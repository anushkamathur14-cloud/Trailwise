import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateFunnel } from "@/lib/analytics/funnels";
import { buildJourneyGraph } from "@/lib/analytics/journeys";
import { calculateRetention } from "@/lib/analytics/retention";
import { calculateSignalLift } from "@/lib/signals/lift";
import { signalsFor } from "@/lib/signals/definitions";
import { getWorkspace, MOBILE_EVENTS, WEB_EVENTS, type WorkspaceId } from "@/lib/workspace";
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
  let devices: string[] | undefined;
  if (filters.device === "ios") devices = ["ios", "iphone"];
  else if (filters.device === "android") devices = ["android"];
  else if (filters.device === "mobile-web") devices = ["mobile-web"];
  else if (filters.device === "desktop") devices = ["desktop"];
  else if (filters.device === "tablet") devices = ["tablet"];
  else if (filters.device) devices = [filters.device];

  return {
    workspaceId,
    lastSeenAt: { gte: range.from, lte: range.to },
    ...(filters.channel ? { acquisitionChannel: filters.channel } : {}),
    ...(devices ? { deviceType: { in: devices } } : {}),
    ...(filters.segment ? { segment: filters.segment } : {}),
    ...(filters.country ? { country: filters.country } : {}),
  };
}

/** Count metrics: relative % change. Rates: percentage-point change. Null prior → unavailable. */
export function periodChange(
  now: number,
  before: number,
  kind: "count" | "rate",
): { value: number | null; unavailableReason: string | null } {
  if (kind === "count" && before === 0) {
    return { value: null, unavailableReason: now > 0 ? "No prior-period data" : "No data" };
  }
  if (kind === "rate" && before === 0 && now === 0) {
    return { value: null, unavailableReason: "No prior-period data" };
  }
  if (kind === "count") return { value: (now - before) / before, unavailableReason: null };
  return { value: now - before, unavailableReason: null };
}

function dayOffset(first: Date, activity: Date): number {
  const a = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
  const b = Date.UTC(activity.getUTCFullYear(), activity.getUTCMonth(), activity.getUTCDate());
  return Math.round((b - a) / 86_400_000);
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

  const workspace = getWorkspace(workspaceId);
  const retentionEventName = workspace.retentionEvent.name;
  const asOf = range.to;

  const retentionPeople = await db.person.findMany({
    where: {
      workspaceId,
      firstSeenAt: { lte: range.to },
      ...("segment" in filters && filters.segment ? { segment: filters.segment } : {}),
      ...("device" in filters && filters.device
        ? {
            deviceType: {
              in:
                filters.device === "ios"
                  ? ["ios", "iphone"]
                  : filters.device === "android"
                    ? ["android"]
                    : [filters.device],
            },
          }
        : {}),
    },
    select: { id: true, firstSeenAt: true },
  });

  const retentionActivityWhere =
    workspaceId === "web-demo"
      ? { eventName: WEB_EVENTS.practiceCompleted }
      : {
          OR: [
            { eventName: MOBILE_EVENTS.appOpened },
            { eventName: MOBILE_EVENTS.returnedNextDay },
          ],
        };

  const retentionActivity = await db.event.findMany({
    where: {
      workspaceId,
      personId: { in: retentionPeople.map((p) => p.id) },
      ...retentionActivityWhere,
    },
    select: { personId: true, timestamp: true },
  });

  const retention = calculateRetention(
    retentionPeople.map((person) => ({ personId: person.id, firstSeenAt: person.firstSeenAt })),
    retentionActivity,
    {
      asOf,
      retentionEvent: retentionEventName,
      definition: workspace.retentionEvent.description,
    },
  );

  const changeCount = (now: number, before: number) => periodChange(now, before, "count");
  const changeRate = (now: number, before: number) => periodChange(now, before, "rate");

  const activeCh = changeCount(people.length, prevPeople.length);
  const newCh = changeCount(newUsers, prevNew);
  const sessCh = changeCount(sessions, prevSessions);
  const actCh = changeRate(activationRate, prevActivation);
  const convCh = changeRate(conversionRate, prevConversion);

  const prevRetentionPeople = await db.person.findMany({
    where: {
      workspaceId,
      firstSeenAt: { gte: prev.from, lte: prev.to },
      ...("segment" in filters && filters.segment ? { segment: filters.segment } : {}),
    },
    select: { id: true, firstSeenAt: true },
  });
  const prevRetentionActivity = await db.event.findMany({
    where: {
      workspaceId,
      personId: { in: prevRetentionPeople.map((p) => p.id) },
      ...retentionActivityWhere,
    },
    select: { personId: true, timestamp: true },
  });
  const prevRetention = calculateRetention(
    prevRetentionPeople.map((person) => ({ personId: person.id, firstSeenAt: person.firstSeenAt })),
    prevRetentionActivity,
    {
      asOf: prev.to,
      retentionEvent: retentionEventName,
      definition: workspace.retentionEvent.description,
    },
  );
  const retCh = changeRate(retention.day1 ?? 0, prevRetention.day1 ?? 0);

  return {
    activeUsers: people.length,
    activeUsersChange: activeCh.value,
    activeUsersChangeUnavailable: activeCh.unavailableReason,
    activeUsersPrior: prevPeople.length,
    newUsers,
    newUsersChange: newCh.value,
    newUsersChangeUnavailable: newCh.unavailableReason,
    newUsersPrior: prevNew,
    sessions,
    sessionsChange: sessCh.value,
    sessionsChangeUnavailable: sessCh.unavailableReason,
    sessionsPrior: prevSessions,
    activationRate,
    activationRateChange: actCh.value,
    activationRateChangeUnavailable: actCh.unavailableReason,
    activationRatePrior: prevActivation,
    conversionRate,
    conversionRateChange: convCh.value,
    conversionRateChangeUnavailable: convCh.unavailableReason,
    conversionRatePrior: prevConversion,
    retentionRate: retention.day1,
    retentionRateChange: retention.day1 == null || prevRetention.day1 == null ? null : retCh.value,
    retentionRateChangeUnavailable:
      retention.day1 == null || prevRetention.day1 == null ? "No prior-period data" : retCh.unavailableReason,
    retentionRatePrior: prevRetention.day1,
    eventsOverTime: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    channels: [...channels.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    features: [...features.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    retention,
    primaryGoalDescription: workspace.primaryGoal.description,
    secondaryGoalDescription: workspace.secondaryGoal.description,
    retentionEventDescription: workspace.retentionEvent.description,
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
  windowDays = 7,
) {
  const people = await db.person.findMany({
    where: personWhere(workspaceId, range, filters),
    select: { id: true },
  });
  const personIds = people.map((p) => p.id);
  const aliases = await db.personAlias.findMany({
    where: { personId: { in: personIds } },
    select: { personId: true, previousId: true },
  });
  const identityMap = new Map<string, string>();
  for (const alias of aliases) {
    identityMap.set(alias.previousId, alias.personId);
  }

  // Include events for people in range and any aliased prior ids that still have rows
  const priorIds = aliases.map((a) => a.previousId);
  const events = await db.event.findMany({
    where: {
      workspaceId,
      OR: [
        { personId: { in: personIds } },
        ...(priorIds.length ? [{ personId: { in: priorIds } }] : []),
      ],
      timestamp: { gte: range.from, lte: range.to },
    },
    select: { personId: true, eventName: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  return buildJourneyGraph(events, { start, end, maxSteps, windowDays, identityMap });
}

export async function signalQuery(
  db: PrismaClient,
  workspaceId: WorkspaceId,
  range: DateRange,
  goal: "activation" | "conversion" | "retention" = "activation",
) {
  const people = await db.person.findMany({
    where: { workspaceId, lastSeenAt: { gte: range.from, lte: range.to } },
    include: { events: { select: { eventName: true, timestamp: true } } },
  });
  const defs = signalsFor(workspaceId, goal);
  return defs.map((def) => {
    const rows = people.map((person) => {
      const names = person.events.map((e) => e.eventName);
      const times = person.events.map((e) => e.timestamp);
      let converted = false;
      if (goal === "activation") converted = person.activated;
      else if (goal === "conversion") converted = person.converted;
      else {
        converted = person.events.some((event) => dayOffset(person.firstSeenAt, event.timestamp) >= 1);
      }
      return {
        personId: person.id,
        hasSignal: def.hasSignal(names, times),
        converted,
        segment: person.segment,
      };
    });
    const stats = calculateSignalLift(rows);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      interpretation: def.interpretation(stats.absoluteDifference, stats.polarity),
      goal,
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
