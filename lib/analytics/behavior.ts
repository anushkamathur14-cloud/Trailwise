import type { PrismaClient } from "@prisma/client";
import type { WorkspaceId } from "@/lib/workspace";
import type { DateRange } from "@/lib/types";

export type Ecosystem = "all" | "ios" | "android";

/** Map UI filters to stored deviceType values (seed + live). */
export function deviceTypesForFilter(filter: string | undefined): string[] | undefined {
  if (!filter || filter === "all") return undefined;
  if (filter === "ios") return ["ios", "iphone"];
  if (filter === "android") return ["android"];
  if (filter === "desktop" || filter === "tablet" || filter === "mobile-web") return [filter];
  return [filter];
}

/** @deprecated use deviceTypesForFilter */
export function deviceTypesForEcosystem(ecosystem: Ecosystem | string | undefined): string[] | undefined {
  return deviceTypesForFilter(ecosystem === "all" ? undefined : ecosystem);
}

const EVENT_TO_SCREEN: Record<string, string> = {
  app_opened: "welcome",
  onboarding_viewed: "welcome",
  goal_selected: "goal",
  notification_permission_requested: "permissions",
  notification_permission_granted: "permissions",
  notification_permission_denied: "permissions",
  session_started: "session",
  session_completed: "session",
  session_abandoned: "session",
  paywall_viewed: "paywall",
  paywall_dismissed: "paywall",
  trial_started: "paywall",
  landing_viewed: "landing",
  pricing_viewed: "pricing",
  signup_started: "signup",
  signup_abandoned: "signup",
  account_created: "signup",
  onboarding_started: "onboarding",
  onboarding_abandoned: "onboarding",
  wearable_connection_started: "wearable",
  wearable_connected: "wearable",
  wearable_connection_error: "wearable",
  practice_plan_created: "plan",
  practice_plan_abandoned: "plan",
  friend_invited: "invite",
  upgrade_viewed: "upgrade",
  subscription_started: "upgrade",
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function behaviorCompare(
  db: PrismaClient,
  workspaceId: WorkspaceId,
  range: DateRange,
  options: { device?: string; screen?: string; previewId?: string } = {},
) {
  const deviceFilter = options.device && options.device !== "all" ? options.device : undefined;
  const devices = deviceTypesForFilter(deviceFilter);
  const people = devices
    ? await db.person.findMany({
        where: { workspaceId, deviceType: { in: devices } },
        select: { id: true },
      })
    : null;
  const personIds = people?.map((p) => p.id);

  const rows = await db.event.findMany({
    where: {
      workspaceId,
      timestamp: { gte: range.from, lte: range.to },
      ...(personIds ? { personId: { in: personIds } } : {}),
    },
    select: {
      eventName: true,
      propertiesJson: true,
      contextJson: true,
      source: true,
      personId: true,
      timestamp: true,
    },
    orderBy: { timestamp: "asc" },
    take: 50_000,
  });

  const filtered = rows.filter((event) => event.source !== "tester");
  const variantHits =
    options.previewId && options.previewId !== "original"
      ? filtered.filter((event) => {
          try {
            const props = JSON.parse(event.propertiesJson || "{}") as Record<string, unknown>;
            return props.previewId === options.previewId;
          } catch {
            return false;
          }
        })
      : [];
  const usedBaseline = Boolean(options.previewId && options.previewId !== "original" && variantHits.length === 0);

  // Prefer events that match the requested screen context when provided
  let screenScoped = filtered;
  if (options.screen) {
    const matched = filtered.filter((event) => {
      try {
        const context = JSON.parse(event.contextJson || "{}") as Record<string, unknown>;
        const props = JSON.parse(event.propertiesJson || "{}") as Record<string, unknown>;
        const screen =
          (typeof props.screen === "string" && props.screen) ||
          (typeof context.screenName === "string" && context.screenName) ||
          EVENT_TO_SCREEN[event.eventName] ||
          "";
        return screen === options.screen || String(context.pageTitle || "") === options.screen;
      } catch {
        return EVENT_TO_SCREEN[event.eventName] === options.screen;
      }
    });
    if (matched.length > 0) screenScoped = matched;
  }

  const byEvent = new Map<string, number>();
  const byScreen = new Map<string, number>();
  let heatSamples = 0;

  for (const event of screenScoped) {
    byEvent.set(event.eventName, (byEvent.get(event.eventName) ?? 0) + 1);
    try {
      const context = JSON.parse(event.contextJson || "{}") as Record<string, unknown>;
      const props = JSON.parse(event.propertiesJson || "{}") as Record<string, unknown>;
      const screen =
        (typeof props.screen === "string" && props.screen) ||
        (typeof context.screenName === "string" && context.screenName) ||
        EVENT_TO_SCREEN[event.eventName] ||
        (typeof context.pageTitle === "string" && String(context.pageTitle).replace(/\s+/g, "_")) ||
        event.eventName;
      byScreen.set(screen, (byScreen.get(screen) ?? 0) + 1);
      if (event.eventName === "ui_click" || props.heatmap) heatSamples += 1;
    } catch {
      byScreen.set(EVENT_TO_SCREEN[event.eventName] ?? event.eventName, (byScreen.get(event.eventName) ?? 0) + 1);
    }
  }

  const totalEvents = screenScoped.length || 1;
  const topEvents = [...byEvent.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, share: count / totalEvents }));
  const topScreens = [...byScreen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, share: count / totalEvents }));

  const stepStats = computeStepStats(filtered, options.screen);

  return {
    ecosystem: deviceFilter || "all",
    device: deviceFilter || "all",
    totalEvents: screenScoped.length,
    heatSamples,
    topEvents,
    topScreens,
    environment: workspaceId === "web-demo" ? "website" : "app",
    baselineLabel: usedBaseline ? "Baseline historic behavior" : "Historic behavior for this context",
    stepStats,
  };
}

function computeStepStats(
  events: Array<{ personId: string; eventName: string; timestamp: Date; contextJson: string; propertiesJson: string }>,
  screen?: string,
) {
  const screenEvents = screen
    ? events.filter((event) => {
        const mapped = EVENT_TO_SCREEN[event.eventName];
        try {
          const context = JSON.parse(event.contextJson || "{}") as Record<string, unknown>;
          const props = JSON.parse(event.propertiesJson || "{}") as Record<string, unknown>;
          return (
            mapped === screen ||
            props.screen === screen ||
            context.screenName === screen ||
            context.pageTitle === screen
          );
        } catch {
          return mapped === screen;
        }
      })
    : events;

  const usersReached = new Set(screenEvents.map((e) => e.personId));
  const byPerson = new Map<string, typeof events>();
  for (const event of events) {
    const list = byPerson.get(event.personId) ?? [];
    list.push(event);
    byPerson.set(event.personId, list);
  }

  const nextCounts = new Map<string, number>();
  const dropOffCounts = new Map<string, number>();
  const deltas: number[] = [];
  let progressed = 0;

  for (const personId of usersReached) {
    const timeline = [...(byPerson.get(personId) ?? [])].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const idx = screen
      ? timeline.findIndex((event) => {
          const mapped = EVENT_TO_SCREEN[event.eventName];
          try {
            const context = JSON.parse(event.contextJson || "{}") as Record<string, unknown>;
            return mapped === screen || context.screenName === screen || context.pageTitle === screen;
          } catch {
            return mapped === screen;
          }
        })
      : 0;
    if (idx < 0) continue;
    const current = timeline[idx];
    const next = timeline[idx + 1];
    if (!next) {
      // Drop-off: last meaningful event was current; expected next never happened
      dropOffCounts.set(current.eventName, (dropOffCounts.get(current.eventName) ?? 0) + 1);
      continue;
    }
    progressed += 1;
    nextCounts.set(next.eventName, (nextCounts.get(next.eventName) ?? 0) + 1);
    deltas.push(next.timestamp.getTime() - current.timestamp.getTime());
    if (
      next.eventName.includes("abandon") ||
      next.eventName.includes("error") ||
      next.eventName.includes("denied") ||
      next.eventName.includes("dismissed")
    ) {
      dropOffCounts.set(next.eventName, (dropOffCounts.get(next.eventName) ?? 0) + 1);
    }
  }

  const mostCommonNext = [...nextCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mostCommonDropOffEvent = [...dropOffCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const reached = usersReached.size;
  const dropOffRate = reached === 0 ? 0 : (reached - progressed) / reached;

  return {
    usersReachedStep: reached,
    stepCompletionRate: reached === 0 ? 0 : progressed / reached,
    dropOffRate,
    mostCommonNextEvent: mostCommonNext,
    mostCommonDropOffEvent,
    /** @deprecated use mostCommonDropOffEvent */
    mostCommonAbandonEvent: mostCommonDropOffEvent,
    medianTimeToNextMs: median(deltas),
  };
}
