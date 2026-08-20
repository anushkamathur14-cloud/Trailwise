import { describe, expect, it } from "vitest";
import { WEB_EVENTS, MOBILE_EVENTS, filterOptionsFor, WORKSPACES } from "@/lib/workspace";
import { WEB_EVENT_DEFINITIONS, MOBILE_EVENT_DEFINITIONS } from "@/lib/events/catalog";
import { signalsFor } from "@/lib/signals/definitions";
import { calculateSignalLift } from "@/lib/signals/lift";
import { periodChange } from "@/lib/analytics/queries";
import { buildJourneyGraph } from "@/lib/analytics/journeys";
import { assertRecommendationPreviewIntegrity, RECOMMENDATION_PREVIEWS } from "@/lib/recommendations/preview-map";
import { VARIANTS } from "@/lib/studio/variants";
import { deviceTypesForFilter } from "@/lib/analytics/behavior";

const t = (iso: string) => new Date(iso);

describe("web event vocabulary", () => {
  const expected = [
    "landing_viewed",
    "pricing_viewed",
    "signup_started",
    "signup_abandoned",
    "account_created",
    "onboarding_started",
    "onboarding_abandoned",
    "wearable_connection_started",
    "wearable_connected",
    "wearable_connection_error",
    "practice_plan_created",
    "practice_plan_abandoned",
    "practice_completed",
    "friend_invited",
    "upgrade_viewed",
    "subscription_started",
    "identity_merged",
  ];

  it("exposes the Aurelia Web event keys", () => {
    expect(Object.values(WEB_EVENTS).sort()).toEqual([...expected].sort());
  });

  it("catalog matches web keys without project/teammate language", () => {
    const names = WEB_EVENT_DEFINITIONS.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(expected));
    const blob = WEB_EVENT_DEFINITIONS.map((e) => `${e.name} ${e.label} ${e.description}`).join(" ").toLowerCase();
    expect(blob).not.toMatch(/project_|teammate_|integration_/);
    expect(blob).not.toMatch(/\bteammate\b/);
    expect(blob).not.toMatch(/\bworkspace\b/);
  });

  it("defines activation and conversion consistently", () => {
    const web = WORKSPACES["web-demo"];
    expect(web.primaryGoal.description).toBe(
      "A user creates their first practice plan and invites a friend within the activation window.",
    );
    expect(web.secondaryGoal.description).toBe("A user starts an Aurelia+ subscription.");
    expect(web.primaryGoal.requiredEvents).toEqual([WEB_EVENTS.practicePlanCreated, WEB_EVENTS.friendInvited]);
    expect(web.secondaryGoal.requiredEvents).toEqual([WEB_EVENTS.subscriptionStarted]);
  });
});

describe("app event vocabulary", () => {
  it("uses a distinct mobile journey (not web events)", () => {
    const mobile = Object.values(MOBILE_EVENTS);
    const web = new Set(Object.values(WEB_EVENTS));
    expect(mobile).toContain("app_opened");
    expect(mobile).toContain("session_completed");
    expect(mobile).toContain("returned_next_day");
    expect(mobile.some((name) => web.has(name) && name !== "account_created" && name !== "identity_merged")).toBe(false);
    expect(MOBILE_EVENT_DEFINITIONS.map((e) => e.name)).toEqual(expect.arrayContaining(mobile));
  });
});

describe("workspace filters", () => {
  it("web uses device types, not iOS/Android ecosystem", () => {
    const web = filterOptionsFor("web-demo");
    expect(web.label).toBe("Device type");
    expect(web.options.map((o) => o.id)).toEqual(["", "desktop", "tablet", "mobile-web"]);
    expect(web.options.some((o) => o.id === "ios" || o.id === "android")).toBe(false);
  });

  it("app uses platforms", () => {
    const app = filterOptionsFor("mobile-demo");
    expect(app.label).toBe("Platform");
    expect(app.options.map((o) => o.id)).toEqual(["", "ios", "android"]);
  });

  it("maps device filters to stored types", () => {
    expect(deviceTypesForFilter("desktop")).toEqual(["desktop"]);
    expect(deviceTypesForFilter("ios")).toEqual(["ios", "iphone"]);
    expect(deviceTypesForFilter(undefined)).toBeUndefined();
  });
});

describe("signal target leakage", () => {
  it("excludes activation constituents from activation analysis", () => {
    const ids = signalsFor("web-demo", "activation").map((s) => s.id);
    expect(ids).not.toContain("plan-created");
    expect(ids).not.toContain("friend-invited-signal");
  });

  it("allows plan/invite signals for conversion", () => {
    const ids = signalsFor("web-demo", "conversion").map((s) => s.id);
    expect(ids).toContain("plan-created");
    expect(ids).toContain("friend-invited-signal");
  });
});

describe("relative lift and period change", () => {
  it("withholds relative lift when baseline is zero", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `a${i}`, hasSignal: true, converted: i < 20 })),
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `b${i}`, hasSignal: false, converted: false })),
    ];
    const result = calculateSignalLift(rows);
    expect(result.relativeLift).toBeNull();
    expect(result.relativeLiftUnavailableReason).toMatch(/not stable|unavailable|baseline/i);
    expect(result.absoluteDifference).toBeCloseTo(0.5);
  });

  it("uses percentage-point change for rates and relative for counts", () => {
    expect(periodChange(0.22, 0.2, "rate").value).toBeCloseTo(0.02);
    expect(periodChange(108, 100, "count").value).toBeCloseTo(0.08);
    expect(periodChange(10, 0, "count").unavailableReason).toMatch(/prior/i);
  });
});

describe("journey successful path", () => {
  it("renders a successful path when seeded-style completed journeys exist", () => {
    const success = [
      WEB_EVENTS.landingViewed,
      WEB_EVENTS.signupStarted,
      WEB_EVENTS.accountCreated,
      WEB_EVENTS.onboardingStarted,
      WEB_EVENTS.wearableConnected,
      WEB_EVENTS.practicePlanCreated,
      WEB_EVENTS.friendInvited,
    ];
    const events = [
      ...Array.from({ length: 12 }, (_, i) =>
        success.map((eventName, step) => ({
          personId: `s${i}`,
          eventName,
          timestamp: t(`2026-08-01T10:${String(step).padStart(2, "0")}:00Z`),
        })),
      ).flat(),
      ...Array.from({ length: 5 }, (_, i) => [
        { personId: `f${i}`, eventName: WEB_EVENTS.landingViewed, timestamp: t("2026-08-01T10:00:00Z") },
        { personId: `f${i}`, eventName: WEB_EVENTS.pricingViewed, timestamp: t("2026-08-01T10:01:00Z") },
        { personId: `f${i}`, eventName: WEB_EVENTS.signupStarted, timestamp: t("2026-08-01T10:02:00Z") },
        { personId: `f${i}`, eventName: WEB_EVENTS.signupAbandoned, timestamp: t("2026-08-01T10:03:00Z") },
      ]).flat(),
    ];
    const graph = buildJourneyGraph(events, {
      start: WEB_EVENTS.landingViewed,
      end: WEB_EVENTS.friendInvited,
      maxSteps: 7,
    });
    expect(graph.successfulPath).toEqual(success);
    expect(graph.nodes.some((n) => n.eventName === WEB_EVENTS.friendInvited)).toBe(true);
  });
});

describe("recommendation preview mapping", () => {
  it("validates typed recommendation-to-preview configs", () => {
    expect(() => assertRecommendationPreviewIntegrity()).not.toThrow();
    for (const row of RECOMMENDATION_PREVIEWS) {
      expect(VARIANTS[row.variantId]).toBeTruthy();
      expect(row.relevantScreens.length).toBeGreaterThan(0);
    }
  });
});
