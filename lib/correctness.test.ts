import { describe, expect, it } from "vitest";
import { buildJourneyGraph, collapsePathForDisplay, OTHER_STEPS_EVENT, normalizeJourneyEventName } from "@/lib/analytics/journeys";
import { calculateRetention } from "@/lib/analytics/retention";
import { describeDropOff } from "@/lib/analytics/drop-off";
import { calculateSignalLift, MAX_DISPLAY_LIFT } from "@/lib/signals/lift";
import {
  activePreviewId,
  resolveStudioState,
  setMode,
  setVariant,
  switchWorkspace,
} from "@/lib/studio/state";
import { WEB_EVENTS } from "@/lib/workspace";

const t = (iso: string) => new Date(iso);

describe("journey completion", () => {
  it("counts completion when end is at the final allowed step", () => {
    const success = [
      WEB_EVENTS.landingViewed,
      WEB_EVENTS.signupStarted,
      WEB_EVENTS.accountCreated,
      WEB_EVENTS.onboardingStarted,
      WEB_EVENTS.wearableConnected,
      WEB_EVENTS.practicePlanCreated,
      WEB_EVENTS.friendInvited,
    ];
    const events = success.map((eventName, step) => ({
      personId: "1",
      eventName,
      timestamp: t(`2026-08-01T10:${String(step).padStart(2, "0")}:00Z`),
    }));
    const graph = buildJourneyGraph(events, {
      start: WEB_EVENTS.landingViewed,
      end: WEB_EVENTS.friendInvited,
      maxSteps: 7,
    });
    expect(graph.entered).toBe(1);
    expect(graph.completed).toBe(1);
    expect(graph.successfulPath.at(-1)).toBe(WEB_EVENTS.friendInvited);
  });

  it("still counts completion when end is beyond maxSteps and collapses middle", () => {
    const names = [
      WEB_EVENTS.landingViewed,
      WEB_EVENTS.pricingViewed,
      WEB_EVENTS.signupStarted,
      WEB_EVENTS.accountCreated,
      WEB_EVENTS.onboardingStarted,
      WEB_EVENTS.wearableConnectionStarted,
      WEB_EVENTS.wearableConnected,
      WEB_EVENTS.practicePlanCreated,
      WEB_EVENTS.friendInvited,
    ];
    const events = names.map((eventName, step) => ({
      personId: "1",
      eventName,
      timestamp: t(`2026-08-01T10:${String(step).padStart(2, "0")}:00Z`),
    }));
    const graph = buildJourneyGraph(events, {
      start: WEB_EVENTS.landingViewed,
      end: WEB_EVENTS.friendInvited,
      maxSteps: 5,
    });
    expect(graph.completed).toBe(1);
    expect(graph.successfulPath[0]).toBe(WEB_EVENTS.landingViewed);
    expect(graph.successfulPath.at(-1)).toBe(WEB_EVENTS.friendInvited);
    expect(graph.successfulPath).toContain(OTHER_STEPS_EVENT);
    expect(graph.successfulPath.length).toBeLessThanOrEqual(5);
  });

  it("completes when end is in a later session within the window", () => {
    const events = [
      { personId: "1", eventName: WEB_EVENTS.landingViewed, timestamp: t("2026-08-01T10:00:00Z") },
      { personId: "1", eventName: WEB_EVENTS.accountCreated, timestamp: t("2026-08-01T10:05:00Z") },
      { personId: "1", eventName: WEB_EVENTS.practicePlanCreated, timestamp: t("2026-08-02T09:00:00Z") },
      { personId: "1", eventName: WEB_EVENTS.friendInvited, timestamp: t("2026-08-03T11:00:00Z") },
    ];
    const graph = buildJourneyGraph(events, {
      start: WEB_EVENTS.landingViewed,
      end: WEB_EVENTS.friendInvited,
      maxSteps: 7,
      windowDays: 7,
    });
    expect(graph.completed).toBe(1);
  });

  it("merges anonymous and identified activity via identityMap", () => {
    const events = [
      { personId: "anon", eventName: WEB_EVENTS.landingViewed, timestamp: t("2026-08-01T10:00:00Z") },
      { personId: "user", eventName: WEB_EVENTS.accountCreated, timestamp: t("2026-08-01T10:05:00Z") },
      { personId: "user", eventName: WEB_EVENTS.friendInvited, timestamp: t("2026-08-01T10:20:00Z") },
    ];
    const graph = buildJourneyGraph(events, {
      start: WEB_EVENTS.landingViewed,
      end: WEB_EVENTS.friendInvited,
      maxSteps: 7,
      identityMap: new Map([["anon", "user"]]),
    });
    expect(graph.entered).toBe(1);
    expect(graph.completed).toBe(1);
  });

  it("keeps completion counts when pruning rare branches", () => {
    const events = [
      ...Array.from({ length: 20 }, (_, i) => [
        { personId: `s${i}`, eventName: "start", timestamp: t("2026-08-01T10:00:00Z") },
        { personId: `s${i}`, eventName: "mid", timestamp: t("2026-08-01T10:01:00Z") },
        { personId: `s${i}`, eventName: "end", timestamp: t("2026-08-01T10:02:00Z") },
      ]).flat(),
      ...Array.from({ length: 2 }, (_, i) => [
        { personId: `r${i}`, eventName: "start", timestamp: t("2026-08-01T10:00:00Z") },
        { personId: `r${i}`, eventName: "rare_branch", timestamp: t("2026-08-01T10:01:00Z") },
        { personId: `r${i}`, eventName: "end", timestamp: t("2026-08-01T10:02:00Z") },
      ]).flat(),
    ];
    const graph = buildJourneyGraph(events, { start: "start", end: "end", maxSteps: 5 });
    expect(graph.entered).toBe(22);
    expect(graph.completed).toBe(22);
  });

  it("normalizes legacy teammate_invited to friend_invited", () => {
    expect(normalizeJourneyEventName("teammate_invited")).toBe("friend_invited");
    const graph = buildJourneyGraph(
      [
        { personId: "1", eventName: "landing_viewed", timestamp: t("2026-08-01T10:00:00Z") },
        { personId: "1", eventName: "teammate_invited", timestamp: t("2026-08-01T10:10:00Z") },
      ],
      { start: "landing_viewed", end: "friend_invited", maxSteps: 5 },
    );
    expect(graph.completed).toBe(1);
    expect(graph.successfulPath.at(-1)).toBe("friend_invited");
  });

  it("collapsePathForDisplay preserves start and end", () => {
    const path = collapsePathForDisplay(["a", "b", "c", "d", "e", "f", "g"], 4, "g");
    expect(path[0]).toBe("a");
    expect(path.at(-1)).toBe("g");
    expect(path).toContain(OTHER_STEPS_EVENT);
  });
});

describe("retention maturity", () => {
  it("counts exact next-day return", () => {
    const result = calculateRetention(
      [{ personId: "1", firstSeenAt: t("2026-08-01T15:00:00Z") }],
      [{ personId: "1", timestamp: t("2026-08-02T08:00:00Z") }],
      { asOf: t("2026-08-18T00:00:00Z"), retentionEvent: "practice_completed" },
    );
    expect(result.day1).toBe(1);
  });

  it("returns 0 when there is no next-day return among matured users", () => {
    const result = calculateRetention(
      [{ personId: "1", firstSeenAt: t("2026-08-01T15:00:00Z") }],
      [{ personId: "1", timestamp: t("2026-08-01T16:00:00Z") }],
      { asOf: t("2026-08-18T00:00:00Z") },
    );
    expect(result.day1).toBe(0);
  });

  it("handles timezone boundary with UTC calendar days", () => {
    const result = calculateRetention(
      [{ personId: "1", firstSeenAt: t("2026-08-01T23:30:00Z") }],
      [{ personId: "1", timestamp: t("2026-08-02T00:30:00Z") }],
      { asOf: t("2026-08-18T00:00:00Z") },
    );
    expect(result.day1).toBe(1);
  });

  it("marks unmatured cohorts as null", () => {
    const result = calculateRetention(
      [{ personId: "1", firstSeenAt: t("2026-08-17T12:00:00Z") }],
      [],
      { asOf: t("2026-08-18T00:00:00Z") },
    );
    expect(result.cohorts[0].days.find((d) => d.day === 7)?.matured).toBe(false);
    expect(result.cohorts[0].days.find((d) => d.day === 7)?.rate).toBeNull();
    expect(result.day7).toBeNull();
  });
});

describe("drop-off copy", () => {
  it("describes contextual outcomes instead of raw entry events", () => {
    expect(describeDropOff("landing_viewed")).toBe("Exited after Landing");
    expect(describeDropOff("paywall_dismissed")).toBe("Dismissed the paywall");
    expect(describeDropOff("app_opened")).toBe("Stopped after opening the app");
  });
});

describe("studio state sync", () => {
  it("resets web recommendation when switching to app", () => {
    const web = resolveStudioState({
      workspaceId: "web-demo",
      mode: "recommended",
      variantId: "earlier-wearable-help",
    });
    const app = switchWorkspace(web, "mobile-demo");
    expect(app.workspaceId).toBe("mobile-demo");
    expect(app.variantId).toBe("delayed-paywall");
    expect(activePreviewId(app)).toBe("delayed-paywall");
  });

  it("resets app recommendation when switching to web", () => {
    const app = resolveStudioState({
      workspaceId: "mobile-demo",
      mode: "recommended",
      variantId: "delayed-paywall",
    });
    const web = switchWorkspace(app, "web-demo");
    expect(web.variantId).toBe("earlier-wearable-help");
  });

  it("clears variant in original mode", () => {
    const state = resolveStudioState({
      workspaceId: "web-demo",
      mode: "recommended",
      variantId: "friend-invite-prompt",
    });
    const original = setMode(state, "original");
    expect(original.variantId).toBeNull();
    expect(activePreviewId(original)).toBe("original");
  });

  it("restores a valid variant when entering recommended", () => {
    const original = resolveStudioState({ workspaceId: "web-demo", mode: "original" });
    const recommended = setMode(original, "recommended");
    expect(recommended.variantId).toBe("earlier-wearable-help");
  });

  it("rejects invalid preview query params for the workspace", () => {
    const state = resolveStudioState({
      workspaceId: "web-demo",
      urlPreview: "delayed-paywall",
      mode: "recommended",
    });
    expect(state.variantId).toBe("earlier-wearable-help");
  });

  it("honors a direct valid recommendation URL", () => {
    const state = resolveStudioState({
      workspaceId: "web-demo",
      urlPreview: "error-recovery",
    });
    expect(state.mode).toBe("recommended");
    expect(state.variantId).toBe("error-recovery");
  });

  it("keeps original selected when selector chooses original", () => {
    const state = setVariant(
      resolveStudioState({ workspaceId: "mobile-demo", variantId: "delayed-paywall" }),
      "original",
    );
    expect(state.mode).toBe("original");
    expect(state.variantId).toBeNull();
  });
});

describe("relative lift ceiling", () => {
  it("suppresses extreme relative lift", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `a${i}`, hasSignal: true, converted: i < 30 })),
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `b${i}`, hasSignal: false, converted: i < 1 })),
    ];
    const result = calculateSignalLift(rows);
    expect(result.relativeLift).toBeNull();
    expect(result.relativeLiftUnavailableReason).toMatch(/not stable/i);
    expect(MAX_DISPLAY_LIFT).toBe(2);
  });
});
