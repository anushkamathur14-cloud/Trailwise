import type { PrismaClient } from "@prisma/client";
import { getWorkspace, MOBILE_EVENTS, WEB_EVENTS } from "@/lib/workspace";
import { parseJson } from "@/lib/utils";

export async function refreshPersonStats(db: PrismaClient, personId: string) {
  const person = await db.person.findUnique({
    where: { id: personId },
    include: { events: { select: { eventName: true, timestamp: true, sessionId: true, propertiesJson: true } } },
  });
  if (!person) return;

  const workspace = getWorkspace(person.workspaceId);
  const eventNames = new Set(person.events.map((event) => event.eventName));
  const activated = workspace.primaryGoal.requiredEvents.every((name) => eventNames.has(name));
  const converted = workspace.secondaryGoal.requiredEvents.some((name) => eventNames.has(name));
  const sessionIds = new Set(person.events.map((event) => event.sessionId).filter(Boolean));
  const first = person.events.reduce(
    (min, event) => (event.timestamp < min ? event.timestamp : min),
    person.firstSeenAt,
  );
  const last = person.events.reduce(
    (max, event) => (event.timestamp > max ? event.timestamp : max),
    person.lastSeenAt,
  );

  const traits = computeTraits(person.workspaceId, person.events);

  await db.person.update({
    where: { id: personId },
    data: {
      eventCount: person.events.length,
      sessionCount: sessionIds.size,
      activated,
      converted,
      firstSeenAt: first,
      lastSeenAt: last,
      traitsJson: JSON.stringify(traits),
    },
  });
}

export function computeTraits(
  workspaceId: string,
  events: Array<{ eventName: string; timestamp: Date; sessionId: string | null; propertiesJson?: string }>,
): Record<string, unknown> {
  const names = events.map((event) => event.eventName);
  const firstSessionId = events[0]?.sessionId;
  const firstSessionEvents = events.filter((event) => event.sessionId === firstSessionId);

  if (workspaceId === "web-demo") {
    const pricingViews = names.filter((name) => name === WEB_EVENTS.pricingViewed).length;
    const connectedInFirstSession = firstSessionEvents.some(
      (event) => event.eventName === WEB_EVENTS.wearableConnected,
    );
    const hadWearableError = names.includes(WEB_EVENTS.wearableConnectionError);
    return {
      pricingViews,
      connectedWearableFirstSession: connectedInFirstSession,
      encounteredWearableError: hadWearableError,
      invitedFriend: names.includes(WEB_EVENTS.friendInvited),
      createdPracticePlan: names.includes(WEB_EVENTS.practicePlanCreated),
    };
  }

  const open = events.find((event) => event.eventName === MOBILE_EVENTS.appOpened);
  const core = events.find((event) => event.eventName === MOBILE_EVENTS.coreActionCompleted);
  const minutesToCore =
    open && core ? (core.timestamp.getTime() - open.timestamp.getTime()) / 60000 : null;
  return {
    completedCoreAction: Boolean(core),
    coreActionWithinFiveMinutes: minutesToCore !== null && minutesToCore <= 5,
    deniedNotifications: names.includes(MOBILE_EVENTS.permissionDenied),
    dismissedPaywall: names.includes(MOBILE_EVENTS.paywallDismissed),
    returnedNextDay: names.includes(MOBILE_EVENTS.returnedNextDay),
  };
}

export function parseTraits(raw: string): Record<string, unknown> {
  return parseJson(raw, {});
}
