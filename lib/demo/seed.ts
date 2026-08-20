import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";
import { chance, createRng, pick, randInt } from "@/lib/demo/rng";
import { MOBILE_EVENTS, WEB_EVENTS, WORKSPACES } from "@/lib/workspace";
import { computeTraits } from "@/lib/identity/traits";

export const DEMO_SEED = 20260818;
export const DEMO_NOW = new Date("2026-08-18T17:00:00.000Z");

const FIRST = ["Ava", "Noah", "Mia", "Liam", "Sofia", "Kai", "Elena", "Owen", "Priya", "Jonah", "Hana", "Marco", "Leila", "Theo", "Amara", "Felix"];
const LAST = ["Chen", "Patel", "Nguyen", "Brooks", "Okoye", "Silva", "Khan", "Walsh", "Ito", "Berg", "Diaz", "Hughes", "Shah", "Novak", "Park"];
const WEARABLE_PROVIDERS = ["apple_watch", "oura", "google_fit"] as const;
const WEB_DEVICES = ["desktop", "tablet", "mobile-web"] as const;
const MOBILE_DEVICES = ["ios", "android"] as const;

type SeedEvent = {
  id: string;
  eventId: string;
  workspaceId: string;
  personId: string;
  sessionId: string;
  eventName: string;
  timestamp: Date;
  platform: string;
  source: string;
  propertiesJson: string;
  contextJson: string;
  anonymousId: string | null;
  userId: string | null;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function browserForDevice(rng: () => number, device: string): string {
  if (device === "desktop") return pick(rng, ["Chrome", "Chrome", "Chrome", "Firefox", "Edge", "Safari"]);
  if (device === "tablet") return pick(rng, ["Safari", "Chrome", "Safari"]);
  return pick(rng, ["Safari", "Chrome", "Safari", "Chrome"]);
}

export async function seedDatabase(db: PrismaClient, seed = DEMO_SEED) {
  await db.event.deleteMany();
  await db.session.deleteMany();
  await db.personAlias.deleteMany();
  await db.person.deleteMany();
  await db.settings.deleteMany();
  await db.workspace.deleteMany();

  for (const workspace of Object.values(WORKSPACES)) {
    await db.workspace.create({
      data: {
        id: workspace.id,
        name: workspace.name,
        platform: workspace.platform,
        productName: workspace.productName,
      },
    });
    await db.settings.create({
      data: {
        id: `${workspace.id}-settings`,
        workspaceId: workspace.id,
        retentionDays: 90,
        collectionEnabled: true,
      },
    });
  }

  await seedWeb(db, seed);
  await seedMobile(db, seed + 99);
}

async function flush(
  db: PrismaClient,
  people: Parameters<PrismaClient["person"]["createMany"]>[0] extends { data: infer D } ? D : never,
  sessions: Parameters<PrismaClient["session"]["createMany"]>[0] extends { data: infer D } ? D : never,
  events: SeedEvent[],
  aliases: Array<{ id: string; personId: string; previousId: string; kind: string; mergedAt: Date }>,
) {
  await db.person.createMany({ data: people as never });
  await db.session.createMany({ data: sessions as never });
  const chunk = 500;
  for (let i = 0; i < events.length; i += chunk) {
    await db.event.createMany({ data: events.slice(i, i + chunk) });
  }
  if (aliases.length) await db.personAlias.createMany({ data: aliases });
}

async function seedWeb(db: PrismaClient, seed: number) {
  const rng = createRng(seed);
  const people: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  const events: SeedEvent[] = [];
  const aliases: Array<{ id: string; personId: string; previousId: string; kind: string; mergedAt: Date }> = [];
  const workspace = WORKSPACES["web-demo"];

  for (let i = 0; i < 520; i++) {
    const segment = i < 104 ? "high-intent" : i < 182 ? "error-prone" : i < 260 ? "window-shopper" : "core";
    const channel = pick(rng, workspace.acquisitionChannels);
    const device = pick(rng, [...WEB_DEVICES]);
    const country = pick(rng, workspace.countries);
    const browser = browserForDevice(rng, device);
    const firstSeen = addDays(DEMO_NOW, -randInt(rng, 1, 55));
    const anonymousId = `anon_web_${i.toString().padStart(4, "0")}`;
    const identified = segment !== "window-shopper" ? chance(rng, 0.82) : chance(rng, 0.18);
    const userId = identified ? `user_web_${i.toString().padStart(4, "0")}` : null;
    const personId = `person_web_${i.toString().padStart(4, "0")}`;
    const displayName = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    const sessionId = `sess_web_${i}_0`;
    let t = firstSeen;
    const personEvents: SeedEvent[] = [];
    let returnSessionIndex = 1;

    const push = (eventName: string, minutes: number, extra?: Record<string, unknown>, sid = sessionId) => {
      t = addMinutes(t, minutes);
      personEvents.push({
        id: nanoid(),
        eventId: `${personId}_${eventName}_${personEvents.length}`,
        workspaceId: "web-demo",
        personId,
        sessionId: sid,
        eventName,
        timestamp: t,
        platform: "web",
        source: "seed",
        propertiesJson: JSON.stringify({ channel, segment, ...(extra ?? {}) }),
        contextJson: JSON.stringify({
          deviceType: device,
          country,
          browser,
          pageTitle: eventName.replace(/_/g, " "),
          pageUrl: `https://aurelia.example/${eventName.replace(/_/g, "-")}`,
        }),
        anonymousId,
        userId,
      });
    };

    const addReturnSession = (daysAfterFirst: number, eventName: string, extra?: Record<string, unknown>) => {
      const returnAt = addDays(firstSeen, daysAfterFirst);
      if (returnAt > DEMO_NOW) return false;
      const sid = `sess_web_${i}_${returnSessionIndex++}`;
      t = returnAt;
      sessions.push({
        id: sid,
        workspaceId: "web-demo",
        personId,
        startedAt: t,
        lastEventAt: t,
        entryEvent: eventName,
        exitEvent: eventName,
        eventCount: 0,
      });
      push(eventName, 1, { returning: true, retentionDay: daysAfterFirst, ...(extra ?? {}) }, sid);
      return true;
    };

    push(WEB_EVENTS.landingViewed, randInt(rng, 0, 8), { page: "home" });

    if (segment === "window-shopper") {
      push(WEB_EVENTS.pricingViewed, randInt(rng, 1, 4));
      push(WEB_EVENTS.pricingViewed, randInt(rng, 20, 90));
      push(WEB_EVENTS.pricingViewed, randInt(rng, 30, 120));
      // Some repeat pricing viewers eventually convert (~18%)
      if (chance(rng, 0.18)) {
        push(WEB_EVENTS.signupStarted, 3);
        push(WEB_EVENTS.accountCreated, 2);
        push(WEB_EVENTS.onboardingStarted, 2);
        if (chance(rng, 0.55)) {
          push(WEB_EVENTS.wearableConnected, 4, { provider: pick(rng, [...WEARABLE_PROVIDERS]) });
        }
        push(WEB_EVENTS.practicePlanCreated, 3);
        if (chance(rng, 0.6)) push(WEB_EVENTS.friendInvited, 5);
      } else {
        if (chance(rng, 0.4)) push(WEB_EVENTS.signupStarted, 2);
        if (chance(rng, 0.28)) push(WEB_EVENTS.signupAbandoned, 3);
      }
    } else {
      if (chance(rng, 0.65)) push(WEB_EVENTS.pricingViewed, randInt(rng, 1, 6));
      if (segment === "core" && chance(rng, 0.14)) {
        push(WEB_EVENTS.signupStarted, 2);
        push(WEB_EVENTS.signupAbandoned, randInt(rng, 2, 8));
      } else {
        push(WEB_EVENTS.signupStarted, randInt(rng, 1, 5));
        if (identified) {
          push(WEB_EVENTS.accountCreated, randInt(rng, 1, 4));
          push(WEB_EVENTS.onboardingStarted, randInt(rng, 1, 3));
          const provider = pick(rng, [...WEARABLE_PROVIDERS]);

          if (segment === "error-prone") {
            push(WEB_EVENTS.wearableConnectionStarted, randInt(rng, 1, 3), { provider });
            push(WEB_EVENTS.wearableConnectionError, randInt(rng, 1, 4), {
              provider,
              error_code: pick(rng, ["oauth_denied", "timeout", "provider_down"]),
            });
            // Recover and activate ~42%; abandon ~58%
            if (chance(rng, 0.42)) {
              push(WEB_EVENTS.wearableConnected, randInt(rng, 2, 8), { provider, recovered: true });
              push(WEB_EVENTS.practicePlanCreated, randInt(rng, 2, 6));
              if (chance(rng, 0.55)) push(WEB_EVENTS.friendInvited, randInt(rng, 2, 20));
            } else if (chance(rng, 0.2)) {
              // Recover wearable but stall on invite
              push(WEB_EVENTS.wearableConnected, randInt(rng, 2, 6), { provider, recovered: true });
              push(WEB_EVENTS.practicePlanCreated, 3);
            } else {
              push(WEB_EVENTS.onboardingAbandoned, randInt(rng, 1, 6), { last_step: "wearable" });
            }
          } else if (segment === "high-intent") {
            // ~22% activate without wearable; ~15% connect but skip invite; rest classic path
            const pathRoll = rng();
            if (pathRoll < 0.22) {
              push(WEB_EVENTS.practicePlanCreated, randInt(rng, 2, 8));
              push(WEB_EVENTS.friendInvited, randInt(rng, 2, 20));
            } else {
              push(WEB_EVENTS.wearableConnectionStarted, randInt(rng, 1, 3), { provider });
              push(WEB_EVENTS.wearableConnected, randInt(rng, 1, 4), { provider, firstSession: true });
              push(WEB_EVENTS.practicePlanCreated, randInt(rng, 1, 5));
              if (pathRoll < 0.85) {
                push(WEB_EVENTS.friendInvited, randInt(rng, 2, 30));
              }
            }
            // Some clean onboarding users still abandon (~12%)
            if (chance(rng, 0.12) && !personEvents.some((e) => e.eventName === WEB_EVENTS.friendInvited)) {
              push(WEB_EVENTS.onboardingAbandoned, 2);
            }
            if (chance(rng, 0.38)) {
              push(WEB_EVENTS.upgradeViewed, randInt(rng, 10, 80));
              push(WEB_EVENTS.subscriptionStarted, randInt(rng, 1, 8), { plan: "aurelia_plus" });
            }
          } else {
            // core: mixed outcomes — wearable optional, slower users sometimes activate
            const slow = chance(rng, 0.35);
            if (chance(rng, 0.62)) {
              push(WEB_EVENTS.wearableConnectionStarted, randInt(rng, slow ? 12 : 2, slow ? 25 : 8), { provider });
              if (chance(rng, 0.7)) {
                push(WEB_EVENTS.wearableConnected, randInt(rng, 2, 10), { provider });
              } else {
                push(WEB_EVENTS.wearableConnectionError, 2, { provider });
                if (chance(rng, 0.35)) {
                  push(WEB_EVENTS.wearableConnected, 5, { provider, recovered: true });
                }
              }
            }
            if (chance(rng, 0.55)) {
              push(WEB_EVENTS.practicePlanCreated, randInt(rng, slow ? 15 : 2, slow ? 40 : 10));
              if (chance(rng, 0.45)) push(WEB_EVENTS.friendInvited, randInt(rng, 5, 80));
              else if (chance(rng, 0.25)) push(WEB_EVENTS.practicePlanAbandoned, 3);
            } else if (chance(rng, 0.35)) {
              push(WEB_EVENTS.onboardingAbandoned, randInt(rng, 2, 10));
            }
            // Fast users who still fail
            if (chance(rng, 0.08)) {
              push(WEB_EVENTS.practicePlanAbandoned, 1);
            }
            if (chance(rng, 0.16)) {
              push(WEB_EVENTS.upgradeViewed, randInt(rng, 20, 120));
              if (chance(rng, 0.32)) push(WEB_EVENTS.subscriptionStarted, 4, { plan: "aurelia_plus" });
            }
          }
        }
      }
    }

    // Retention returns use practice_completed (~24% D1, ~14% D7)
    if (chance(rng, 0.24)) {
      addReturnSession(1, WEB_EVENTS.practiceCompleted, { durationSec: randInt(rng, 60, 600) });
    }
    if (chance(rng, 0.14)) {
      addReturnSession(7, WEB_EVENTS.practiceCompleted, { durationSec: randInt(rng, 60, 600) });
    }
    if (chance(rng, 0.09)) {
      addReturnSession(14, WEB_EVENTS.practiceCompleted);
    }
    if (chance(rng, 0.06)) {
      addReturnSession(30, WEB_EVENTS.practiceCompleted);
    }

    const names = personEvents.map((e) => e.eventName);
    const activated = names.includes(WEB_EVENTS.practicePlanCreated) && names.includes(WEB_EVENTS.friendInvited);
    const converted = names.includes(WEB_EVENTS.subscriptionStarted);
    const last = personEvents[personEvents.length - 1]?.timestamp ?? firstSeen;
    const sessionIds = new Set(personEvents.map((e) => e.sessionId));

    sessions.push({
      id: sessionId,
      workspaceId: "web-demo",
      personId,
      startedAt: firstSeen,
      lastEventAt: personEvents.filter((e) => e.sessionId === sessionId).at(-1)?.timestamp ?? firstSeen,
      entryEvent: WEB_EVENTS.landingViewed,
      exitEvent: personEvents.filter((e) => e.sessionId === sessionId).at(-1)?.eventName,
      eventCount: personEvents.filter((e) => e.sessionId === sessionId).length,
    });

    for (const sid of sessionIds) {
      if (sid === sessionId) continue;
      const sessEvents = personEvents.filter((e) => e.sessionId === sid);
      const existing = sessions.find((s) => s.id === sid);
      if (existing) {
        existing.lastEventAt = sessEvents.at(-1)?.timestamp ?? existing.startedAt;
        existing.exitEvent = sessEvents.at(-1)?.eventName;
        existing.eventCount = sessEvents.length;
      }
    }

    people.push({
      id: personId,
      workspaceId: "web-demo",
      anonymousId,
      userId,
      displayName: identified ? displayName : null,
      email: identified ? `${displayName.toLowerCase().replace(" ", ".")}@example.com` : null,
      propertiesJson: JSON.stringify({ channel, plan: converted ? "paid" : "free" }),
      traitsJson: JSON.stringify(
        computeTraits(
          "web-demo",
          personEvents.map((e) => ({ eventName: e.eventName, timestamp: e.timestamp, sessionId: e.sessionId })),
        ),
      ),
      acquisitionChannel: channel,
      deviceType: device,
      country,
      segment,
      firstSeenAt: firstSeen,
      lastSeenAt: last,
      eventCount: personEvents.length,
      sessionCount: sessionIds.size,
      activated,
      converted,
      consentState: chance(rng, 0.92) ? "granted" : "denied",
      isTester: false,
    });

    if (identified) {
      aliases.push({
        id: nanoid(),
        personId,
        previousId: anonymousId,
        kind: "anonymous_to_identified",
        mergedAt: personEvents.find((e) => e.eventName === WEB_EVENTS.accountCreated)?.timestamp ?? firstSeen,
      });
    }

    events.push(...personEvents);
  }

  await flush(db, people as never, sessions as never, events, aliases);
}

async function seedMobile(db: PrismaClient, seed: number) {
  const rng = createRng(seed);
  const people: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  const events: SeedEvent[] = [];
  const aliases: Array<{ id: string; personId: string; previousId: string; kind: string; mergedAt: Date }> = [];
  const workspace = WORKSPACES["mobile-demo"];

  for (let i = 0; i < 520; i++) {
    const segment = i < 104 ? "fast-starter" : i < 208 ? "early-paywall" : i < 286 ? "permission-denied" : "core";
    const channel = pick(rng, workspace.acquisitionChannels);
    const device = pick(rng, [...MOBILE_DEVICES]);
    const country = pick(rng, workspace.countries);
    const firstSeen = addDays(DEMO_NOW, -randInt(rng, 1, 55));
    const anonymousId = `anon_mob_${i.toString().padStart(4, "0")}`;
    const identified = chance(rng, 0.7);
    const userId = identified ? `user_mob_${i.toString().padStart(4, "0")}` : null;
    const personId = `person_mob_${i.toString().padStart(4, "0")}`;
    const displayName = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    const sessionId = `sess_mob_${i}_0`;
    let t = firstSeen;
    const personEvents: SeedEvent[] = [];
    let returnSessionIndex = 1;
    let gotDay1Return = false;

    const push = (eventName: string, minutes: number, extra?: Record<string, unknown>, sid = sessionId) => {
      t = addMinutes(t, minutes);
      personEvents.push({
        id: nanoid(),
        eventId: `${personId}_${eventName}_${personEvents.length}`,
        workspaceId: "mobile-demo",
        personId,
        sessionId: sid,
        eventName,
        timestamp: t,
        platform: "mobile",
        source: "seed",
        propertiesJson: JSON.stringify({ channel, segment, ...(extra ?? {}) }),
        contextJson: JSON.stringify({
          deviceType: device,
          country,
          operatingSystem: device === "ios" ? "iOS" : "Android",
          appVersion: "3.4.1",
          screenName: eventName.replace(/_/g, " "),
        }),
        anonymousId,
        userId,
      });
    };

    const addReturnSession = (daysAfterFirst: number, withReturnedNextDay: boolean) => {
      const returnAt = addDays(firstSeen, daysAfterFirst);
      if (returnAt > DEMO_NOW) return false;
      const sid = `sess_mob_${i}_${returnSessionIndex++}`;
      t = returnAt;
      sessions.push({
        id: sid,
        workspaceId: "mobile-demo",
        personId,
        startedAt: returnAt,
        lastEventAt: returnAt,
        entryEvent: MOBILE_EVENTS.appOpened,
        exitEvent: MOBILE_EVENTS.appOpened,
        eventCount: 0,
      });
      push(MOBILE_EVENTS.appOpened, 0, { returning: true, retentionDay: daysAfterFirst }, sid);
      if (withReturnedNextDay && daysAfterFirst === 1) {
        push(MOBILE_EVENTS.returnedNextDay, 1, {}, sid);
        gotDay1Return = true;
      }
      return true;
    };

    push(MOBILE_EVENTS.appOpened, 0);
    if (segment !== "fast-starter" && chance(rng, 0.12)) {
      push(MOBILE_EVENTS.onboardingSkipped, 1);
    } else {
      push(MOBILE_EVENTS.onboardingViewed, 1);
      push(MOBILE_EVENTS.goalSelected, randInt(rng, 1, 3), { goal: pick(rng, ["sleep", "focus", "stress"]) });
    }

    push(MOBILE_EVENTS.permissionRequested, 1);
    if (segment === "permission-denied") {
      push(MOBILE_EVENTS.permissionDenied, 1);
    } else {
      push(chance(rng, 0.75) ? MOBILE_EVENTS.permissionGranted : MOBILE_EVENTS.permissionDenied, 1);
    }

    if (identified) push(MOBILE_EVENTS.accountCreated, 1);

    if (segment === "early-paywall") {
      push(MOBILE_EVENTS.paywallViewed, 1, { tooEarly: true });
      if (chance(rng, 0.78)) {
        push(MOBILE_EVENTS.paywallDismissed, 1);
        if (chance(rng, 0.25)) {
          push(MOBILE_EVENTS.coreActionStarted, 2);
          if (chance(rng, 0.4)) push(MOBILE_EVENTS.coreActionCompleted, randInt(rng, 2, 8));
          else push(MOBILE_EVENTS.coreActionAbandoned, 3);
        }
      } else {
        push(MOBILE_EVENTS.trialStarted, 1);
      }
    } else if (segment === "fast-starter") {
      push(MOBILE_EVENTS.coreActionStarted, 1);
      push(MOBILE_EVENTS.coreActionCompleted, randInt(rng, 1, 4), { durationSec: randInt(rng, 45, 90) });
      if (chance(rng, 0.7)) push(MOBILE_EVENTS.featureDiscovered, 2, { feature: "streaks" });
      if (chance(rng, 0.65)) push(MOBILE_EVENTS.reminderConfigured, 2);
      if (chance(rng, 0.55)) {
        if (addReturnSession(1, true)) {
          if (chance(rng, 0.4)) {
            push(MOBILE_EVENTS.coreActionCompleted, 3, {}, `sess_mob_${i}_${returnSessionIndex - 1}`);
            if (chance(rng, 0.45)) {
              push(MOBILE_EVENTS.paywallViewed, 2, { afterValue: true }, `sess_mob_${i}_${returnSessionIndex - 1}`);
              if (chance(rng, 0.55)) push(MOBILE_EVENTS.trialStarted, 1, {}, `sess_mob_${i}_${returnSessionIndex - 1}`);
              else if (chance(rng, 0.2)) push(MOBILE_EVENTS.subscriptionPurchased, 2, {}, `sess_mob_${i}_${returnSessionIndex - 1}`);
            }
          }
        }
      }
    } else {
      if (chance(rng, 0.62)) {
        push(MOBILE_EVENTS.coreActionStarted, randInt(rng, 2, 8));
        if (chance(rng, 0.7)) {
          push(MOBILE_EVENTS.coreActionCompleted, randInt(rng, 4, 18));
          if (chance(rng, 0.4)) push(MOBILE_EVENTS.featureDiscovered, 2);
          if (chance(rng, segment === "permission-denied" ? 0.55 : 0.35)) push(MOBILE_EVENTS.reminderConfigured, 2);
          if (chance(rng, 0.28)) {
            push(MOBILE_EVENTS.paywallViewed, 2);
            if (chance(rng, 0.45)) push(MOBILE_EVENTS.trialStarted, 1);
            else if (chance(rng, 0.3)) push(MOBILE_EVENTS.paywallDismissed, 1);
            else if (chance(rng, 0.15)) push(MOBILE_EVENTS.trialCanceled, 2);
          }
        } else {
          push(MOBILE_EVENTS.coreActionAbandoned, 4);
        }
      }
    }

    // Population-level day-1 (~32%) and day-7 (~18%) retention
    if (!gotDay1Return && chance(rng, 0.32)) {
      addReturnSession(1, true);
    }
    if (chance(rng, 0.18)) {
      addReturnSession(7, false);
    }
    if (chance(rng, 0.1)) {
      addReturnSession(14, false);
    }
    if (chance(rng, 0.06)) {
      addReturnSession(30, false);
    }

    const names = personEvents.map((e) => e.eventName);
    const activated = names.includes(MOBILE_EVENTS.coreActionCompleted) && names.includes(MOBILE_EVENTS.returnedNextDay);
    const converted = names.includes(MOBILE_EVENTS.trialStarted) || names.includes(MOBILE_EVENTS.subscriptionPurchased);
    const last = personEvents[personEvents.length - 1]?.timestamp ?? firstSeen;
    const sessionIds = new Set(personEvents.map((e) => e.sessionId));

    sessions.push({
      id: sessionId,
      workspaceId: "mobile-demo",
      personId,
      startedAt: firstSeen,
      lastEventAt: personEvents.filter((e) => e.sessionId === sessionId).at(-1)?.timestamp ?? firstSeen,
      entryEvent: MOBILE_EVENTS.appOpened,
      exitEvent: personEvents.filter((e) => e.sessionId === sessionId).at(-1)?.eventName,
      eventCount: personEvents.filter((e) => e.sessionId === sessionId).length,
    });

    for (const sid of sessionIds) {
      if (sid === sessionId) continue;
      const sessEvents = personEvents.filter((e) => e.sessionId === sid);
      const existing = sessions.find((s) => s.id === sid);
      if (existing) {
        existing.lastEventAt = sessEvents.at(-1)?.timestamp ?? existing.startedAt;
        existing.exitEvent = sessEvents.at(-1)?.eventName;
        existing.eventCount = sessEvents.length;
      }
    }

    people.push({
      id: personId,
      workspaceId: "mobile-demo",
      anonymousId,
      userId,
      displayName: identified ? displayName : null,
      email: identified ? `${displayName.toLowerCase().replace(" ", ".")}@example.com` : null,
      propertiesJson: JSON.stringify({ channel, goal: pick(rng, ["sleep", "focus", "stress"]) }),
      traitsJson: JSON.stringify(
        computeTraits(
          "mobile-demo",
          personEvents.map((e) => ({ eventName: e.eventName, timestamp: e.timestamp, sessionId: e.sessionId })),
        ),
      ),
      acquisitionChannel: channel,
      deviceType: device,
      country,
      segment,
      firstSeenAt: firstSeen,
      lastSeenAt: last,
      eventCount: personEvents.length,
      sessionCount: sessionIds.size,
      activated,
      converted,
      consentState: chance(rng, 0.88) ? "granted" : "denied",
      isTester: false,
    });

    if (identified) {
      aliases.push({
        id: nanoid(),
        personId,
        previousId: anonymousId,
        kind: "anonymous_to_identified",
        mergedAt: firstSeen,
      });
    }
    events.push(...personEvents);
  }

  await flush(db, people as never, sessions as never, events, aliases);
}
