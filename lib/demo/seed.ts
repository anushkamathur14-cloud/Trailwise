import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";
import { chance, createRng, pick, randInt } from "@/lib/demo/rng";
import { MOBILE_EVENTS, WEB_EVENTS, WORKSPACES } from "@/lib/workspace";
import { computeTraits } from "@/lib/identity/traits";

export const DEMO_SEED = 20260818;
export const DEMO_NOW = new Date("2026-08-18T17:00:00.000Z");

const FIRST = ["Ava", "Noah", "Mia", "Liam", "Sofia", "Kai", "Elena", "Owen", "Priya", "Jonah", "Hana", "Marco", "Leila", "Theo", "Amara", "Felix"];
const LAST = ["Chen", "Patel", "Nguyen", "Brooks", "Okoye", "Silva", "Khan", "Walsh", "Ito", "Berg", "Diaz", "Hughes", "Shah", "Novak", "Park"];

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
    const device = pick(rng, workspace.devices);
    const country = pick(rng, workspace.countries);
    const firstSeen = addDays(DEMO_NOW, -randInt(rng, 1, 28));
    const anonymousId = `anon_web_${i.toString().padStart(4, "0")}`;
    const identified = segment !== "window-shopper" ? chance(rng, 0.82) : chance(rng, 0.18);
    const userId = identified ? `user_web_${i.toString().padStart(4, "0")}` : null;
    const personId = `person_web_${i.toString().padStart(4, "0")}`;
    const displayName = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    const sessionId = `sess_web_${i}_0`;
    let t = firstSeen;
    const personEvents: SeedEvent[] = [];

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
          browser: device === "desktop" ? "Chrome" : "Safari",
          pageTitle: eventName.replace(/_/g, " "),
          pageUrl: `https://aurelia.example/${eventName.replace(/_/g, "-")}`,
        }),
        anonymousId,
        userId,
      });
    };

    push(WEB_EVENTS.landingViewed, randInt(rng, 0, 8), { page: "home" });

    if (segment === "window-shopper") {
      push(WEB_EVENTS.pricingViewed, randInt(rng, 1, 4));
      push(WEB_EVENTS.pricingViewed, randInt(rng, 20, 90));
      push(WEB_EVENTS.pricingViewed, randInt(rng, 30, 120));
      if (chance(rng, 0.2)) push(WEB_EVENTS.signupStarted, 2);
      if (chance(rng, 0.08)) push(WEB_EVENTS.signupAbandoned, 3);
    } else {
      if (chance(rng, 0.7)) push(WEB_EVENTS.pricingViewed, randInt(rng, 1, 6));
      if (segment === "core" && chance(rng, 0.12)) {
        push(WEB_EVENTS.signupStarted, 2);
        push(WEB_EVENTS.signupAbandoned, randInt(rng, 2, 8));
      } else {
        push(WEB_EVENTS.signupStarted, randInt(rng, 1, 5));
        if (identified) {
          push(WEB_EVENTS.accountCreated, randInt(rng, 1, 4));
          push(WEB_EVENTS.onboardingStarted, randInt(rng, 1, 3));

          if (segment === "error-prone") {
            push(WEB_EVENTS.integrationError, randInt(rng, 1, 4), { provider: pick(rng, ["slack", "github", "hubspot"]) });
            if (chance(rng, 0.28)) {
              push(WEB_EVENTS.integrationConnected, randInt(rng, 2, 8));
              push(WEB_EVENTS.projectCreated, randInt(rng, 2, 6));
              if (chance(rng, 0.35)) push(WEB_EVENTS.teammateInvited, randInt(rng, 2, 20));
            } else {
              push(WEB_EVENTS.onboardingAbandoned, randInt(rng, 1, 6));
            }
          } else if (segment === "high-intent") {
            push(WEB_EVENTS.integrationConnected, randInt(rng, 1, 4), { provider: "github", firstSession: true });
            push(WEB_EVENTS.projectCreated, randInt(rng, 1, 5));
            if (chance(rng, 0.88)) push(WEB_EVENTS.teammateInvited, randInt(rng, 2, 30));
            if (chance(rng, 0.45)) {
              push(WEB_EVENTS.upgradeViewed, randInt(rng, 10, 80));
              push(WEB_EVENTS.subscriptionStarted, randInt(rng, 1, 8), { plan: "team" });
            }
          } else {
            if (chance(rng, 0.55)) {
              push(WEB_EVENTS.integrationConnected, randInt(rng, 2, 12));
              if (chance(rng, 0.7)) {
                push(WEB_EVENTS.projectCreated, randInt(rng, 2, 10));
                if (chance(rng, 0.48)) push(WEB_EVENTS.teammateInvited, randInt(rng, 5, 80));
              } else {
                push(WEB_EVENTS.projectAbandoned, randInt(rng, 2, 8));
              }
            } else {
              push(WEB_EVENTS.onboardingAbandoned, randInt(rng, 2, 10));
            }
            if (chance(rng, 0.22)) {
              push(WEB_EVENTS.upgradeViewed, randInt(rng, 20, 120));
              if (chance(rng, 0.3)) push(WEB_EVENTS.subscriptionStarted, 4, { plan: "starter" });
            }
          }
        }
      }
    }

    if (identified && chance(rng, 0.25) && personEvents.some((e) => e.eventName === WEB_EVENTS.accountCreated)) {
      const returnAt = addDays(t, randInt(rng, 1, 6));
      if (returnAt <= DEMO_NOW) {
        const sid = `sess_web_${i}_1`;
        t = returnAt;
        sessions.push({
          id: sid,
          workspaceId: "web-demo",
          personId,
          startedAt: t,
          lastEventAt: t,
          entryEvent: WEB_EVENTS.landingViewed,
          exitEvent: WEB_EVENTS.landingViewed,
          eventCount: 0,
        });
        push(WEB_EVENTS.landingViewed, 1, { returning: true }, sid);
        if (chance(rng, 0.4)) push(WEB_EVENTS.upgradeViewed, 3, {}, sid);
      }
    }

    const names = personEvents.map((e) => e.eventName);
    const activated = names.includes(WEB_EVENTS.projectCreated) && names.includes(WEB_EVENTS.teammateInvited);
    const converted = names.includes(WEB_EVENTS.subscriptionStarted);
    const last = personEvents[personEvents.length - 1]?.timestamp ?? firstSeen;
    const sessionIds = new Set(personEvents.map((e) => e.sessionId));

    sessions.push({
      id: sessionId,
      workspaceId: "web-demo",
      personId,
      startedAt: firstSeen,
      lastEventAt: last,
      entryEvent: WEB_EVENTS.landingViewed,
      exitEvent: personEvents[personEvents.length - 1]?.eventName,
      eventCount: personEvents.filter((e) => e.sessionId === sessionId).length,
    });

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
    const device = pick(rng, workspace.devices);
    const country = pick(rng, workspace.countries);
    const firstSeen = addDays(DEMO_NOW, -randInt(rng, 1, 28));
    const anonymousId = `anon_mob_${i.toString().padStart(4, "0")}`;
    const identified = chance(rng, 0.7);
    const userId = identified ? `user_mob_${i.toString().padStart(4, "0")}` : null;
    const personId = `person_mob_${i.toString().padStart(4, "0")}`;
    const displayName = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    const sessionId = `sess_mob_${i}_0`;
    let t = firstSeen;
    const personEvents: SeedEvent[] = [];

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
          operatingSystem: device === "iphone" || device === "ios" ? "iOS" : "Android",
          appVersion: "3.4.1",
          screenName: eventName.replace(/_/g, " "),
        }),
        anonymousId,
        userId,
      });
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
      const returnAt = addDays(firstSeen, 1);
      if (returnAt <= DEMO_NOW) {
        const sid = `sess_mob_${i}_1`;
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
        if (chance(rng, 0.82)) {
          push(MOBILE_EVENTS.appOpened, 0, { returning: true }, sid);
          push(MOBILE_EVENTS.returnedNextDay, 1, {}, sid);
          push(MOBILE_EVENTS.coreActionCompleted, 3, {}, sid);
          if (chance(rng, 0.4)) {
            push(MOBILE_EVENTS.paywallViewed, 2, { afterValue: true }, sid);
            if (chance(rng, 0.55)) push(MOBILE_EVENTS.trialStarted, 1, {}, sid);
            else if (chance(rng, 0.2)) push(MOBILE_EVENTS.subscriptionPurchased, 2, {}, sid);
          }
        }
      }
    } else {
      if (chance(rng, 0.62)) {
        push(MOBILE_EVENTS.coreActionStarted, randInt(rng, 2, 8));
        if (chance(rng, 0.7)) {
          push(MOBILE_EVENTS.coreActionCompleted, randInt(rng, 4, 18));
          if (chance(rng, 0.4)) push(MOBILE_EVENTS.featureDiscovered, 2);
          if (chance(rng, 0.35)) push(MOBILE_EVENTS.reminderConfigured, 2);
          if (chance(rng, segment === "permission-denied" ? 0.38 : 0.5)) {
            const returnAt = addDays(t, 1);
            if (returnAt <= DEMO_NOW) {
              const sid = `sess_mob_${i}_1`;
              t = returnAt;
              sessions.push({
                id: sid,
                workspaceId: "mobile-demo",
                personId,
                startedAt: t,
                lastEventAt: t,
                entryEvent: MOBILE_EVENTS.appOpened,
                exitEvent: MOBILE_EVENTS.appOpened,
                eventCount: 0,
              });
              push(MOBILE_EVENTS.appOpened, 0, { returning: true }, sid);
              push(MOBILE_EVENTS.returnedNextDay, 1, {}, sid);
            }
          }
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
      lastEventAt: last,
      entryEvent: MOBILE_EVENTS.appOpened,
      exitEvent: personEvents[personEvents.length - 1]?.eventName,
      eventCount: personEvents.filter((e) => e.sessionId === sessionId).length,
    });

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
