import { describe, expect, it } from "vitest";
import { abandonedAtStep, calculateFunnel } from "@/lib/analytics/funnels";
import { belongsToSession, groupEventsIntoSessions } from "@/lib/identity/sessions";
import { calculateSignalLift, MIN_SAMPLE } from "@/lib/signals/lift";
import { userRecommendation } from "@/lib/recommendations/engine";
import { WEB_EVENTS } from "@/lib/workspace";
import { buildJourneyGraph } from "@/lib/analytics/journeys";

const t = (iso: string) => new Date(iso);

describe("session grouping", () => {
  it("keeps events within 30 minutes in one session", () => {
    expect(belongsToSession(t("2026-08-18T10:00:00Z"), t("2026-08-18T10:20:00Z"))).toBe(true);
    expect(belongsToSession(t("2026-08-18T10:00:00Z"), t("2026-08-18T10:45:00Z"))).toBe(false);
  });

  it("splits a timeline into sessions", () => {
    const sessions = groupEventsIntoSessions([
      { eventName: "a", timestamp: t("2026-08-18T10:00:00Z") },
      { eventName: "b", timestamp: t("2026-08-18T10:10:00Z") },
      { eventName: "c", timestamp: t("2026-08-18T11:00:00Z") },
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].events).toHaveLength(2);
  });
});

describe("funnels", () => {
  const steps = [
    { eventName: "start", label: "Start" },
    { eventName: "middle", label: "Middle" },
    { eventName: "end", label: "End" },
  ];
  const events = [
    { personId: "1", eventName: "start", timestamp: t("2026-08-18T10:00:00Z") },
    { personId: "1", eventName: "middle", timestamp: t("2026-08-18T10:05:00Z") },
    { personId: "1", eventName: "end", timestamp: t("2026-08-18T10:09:00Z") },
    { personId: "2", eventName: "start", timestamp: t("2026-08-18T10:00:00Z") },
    { personId: "2", eventName: "middle", timestamp: t("2026-08-18T10:20:00Z") },
    { personId: "3", eventName: "start", timestamp: t("2026-08-18T10:00:00Z") },
  ];

  it("calculates conversion and drop-off", () => {
    const result = calculateFunnel(events, steps);
    expect(result.started).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.steps[1].count).toBe(2);
    expect(result.steps[2].dropOff).toBeCloseTo(0.5);
  });

  it("lists users who abandoned a selected step", () => {
    expect(abandonedAtStep(events, steps, 2)).toEqual(["2"]);
    expect(abandonedAtStep(events, steps, 1)).toEqual(["3"]);
  });
});

describe("signal lift", () => {
  it("computes relative lift and polarity", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `a${i}`, hasSignal: true, converted: i < 28 })),
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `b${i}`, hasSignal: false, converted: i < 10 })),
    ];
    const result = calculateSignalLift(rows);
    expect(result.usersWithSignal).toBe(40);
    expect(result.polarity).toBe("positive");
    expect(result.relativeLift).not.toBeNull();
    expect(result.relativeLift!).toBeGreaterThan(0.5);
    expect(result.belowSampleThreshold).toBe(false);
  });

  it("flags samples below the minimum threshold", () => {
    const rows = [
      { personId: "1", hasSignal: true, converted: true },
      { personId: "2", hasSignal: false, converted: false },
    ];
    const result = calculateSignalLift(rows, MIN_SAMPLE);
    expect(result.belowSampleThreshold).toBe(true);
    expect(result.evidenceStrength).toBe("exploratory");
  });

  it("returns null relativeLift when baseline conversion is zero", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `a${i}`, hasSignal: true, converted: i < 20 })),
      ...Array.from({ length: 40 }, (_, i) => ({ personId: `b${i}`, hasSignal: false, converted: false })),
    ];
    const result = calculateSignalLift(rows);
    expect(result.relativeLift).toBeNull();
    expect(result.relativeLiftUnavailableReason).toMatch(/not stable/i);
    expect(result.absoluteDifference).toBeGreaterThan(0);
  });
});

describe("journey paths", () => {
  it("collapses consecutive duplicates and stops at the end event", () => {
    const graph = buildJourneyGraph(
      [
        { personId: "1", eventName: "start", timestamp: t("2026-08-18T10:00:00Z") },
        { personId: "1", eventName: "mid", timestamp: t("2026-08-18T10:01:00Z") },
        { personId: "1", eventName: "mid", timestamp: t("2026-08-18T10:02:00Z") },
        { personId: "1", eventName: "end", timestamp: t("2026-08-18T10:03:00Z") },
        { personId: "2", eventName: "start", timestamp: t("2026-08-18T10:00:00Z") },
        { personId: "2", eventName: "fail_abandoned", timestamp: t("2026-08-18T10:01:00Z") },
      ],
      { start: "start", end: "end", maxSteps: 6 },
    );
    expect(graph.successfulPath).toEqual(["start", "mid", "end"]);
    expect(graph.failurePath[0]).toBe("start");
    expect(graph.nodes.some((node) => node.id === "1:mid")).toBe(true);
    expect(graph.links.every((link) => Number(link.source.split(":")[0]) < Number(link.target.split(":")[0]))).toBe(true);
  });
});

describe("recommendation rules", () => {
  it("recommends error recovery when a wearable connection fails", () => {
    const rec = userRecommendation({
      workspaceId: "web-demo",
      activated: false,
      converted: false,
      eventNames: [WEB_EVENTS.accountCreated, WEB_EVENTS.wearableConnectionError],
      traits: {},
    });
    expect(rec.previewId).toBe("error-recovery");
  });

  it("delays the paywall when it was dismissed before value", () => {
    const rec = userRecommendation({
      workspaceId: "mobile-demo",
      activated: false,
      converted: false,
      eventNames: ["app_opened", "paywall_dismissed"],
      traits: {},
    });
    expect(rec.previewId).toBe("delayed-paywall");
  });
});
