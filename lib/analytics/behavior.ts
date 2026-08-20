import type { PrismaClient } from "@prisma/client";
import type { WorkspaceId } from "@/lib/workspace";
import type { DateRange } from "@/lib/types";

export type Ecosystem = "all" | "ios" | "android";

/** Map UI ecosystem filters to stored deviceType values (seed + live). */
export function deviceTypesForEcosystem(ecosystem: Ecosystem | string | undefined): string[] | undefined {
  if (!ecosystem || ecosystem === "all") return undefined;
  if (ecosystem === "ios") return ["ios", "iphone", "mobile-web"];
  if (ecosystem === "android") return ["android"];
  return [ecosystem];
}

export async function behaviorCompare(
  db: PrismaClient,
  workspaceId: WorkspaceId,
  range: DateRange,
  ecosystem: Ecosystem = "all",
) {
  const devices = deviceTypesForEcosystem(ecosystem);
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
    select: { eventName: true, propertiesJson: true, contextJson: true, source: true },
    take: 50_000,
  });

  const filtered = rows.filter((event) => event.source !== "tester");

  const byEvent = new Map<string, number>();
  const byScreen = new Map<string, number>();
  let heatSamples = 0;

  const eventToScreen: Record<string, string> = {
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
    account_created: "signup",
    project_created: "plan",
    teammate_invited: "invite",
    integration_connected: "wearable",
    integration_error: "wearable",
  };

  for (const event of filtered) {
    byEvent.set(event.eventName, (byEvent.get(event.eventName) ?? 0) + 1);
    try {
      const context = JSON.parse(event.contextJson || "{}") as Record<string, unknown>;
      const props = JSON.parse(event.propertiesJson || "{}") as Record<string, unknown>;
      const screen =
        (typeof props.screen === "string" && props.screen) ||
        (typeof context.screenName === "string" && context.screenName) ||
        eventToScreen[event.eventName] ||
        (typeof context.pageTitle === "string" && String(context.pageTitle).replace(/\s+/g, "_")) ||
        event.eventName;
      byScreen.set(screen, (byScreen.get(screen) ?? 0) + 1);
      if (event.eventName === "ui_click" || props.heatmap) heatSamples += 1;
    } catch {
      byScreen.set(eventToScreen[event.eventName] ?? event.eventName, (byScreen.get(event.eventName) ?? 0) + 1);
    }
  }

  const totalEvents = filtered.length || 1;
  const topEvents = [...byEvent.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, share: count / totalEvents }));
  const topScreens = [...byScreen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, share: count / totalEvents }));

  return {
    ecosystem,
    totalEvents: filtered.length,
    heatSamples,
    topEvents,
    topScreens,
    environment: workspaceId === "web-demo" ? "website" : "app",
  };
}
