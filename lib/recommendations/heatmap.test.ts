import { describe, expect, it } from "vitest";
import { recommendFromHeatmapSession } from "@/lib/recommendations/heatmap";

describe("heatmap → recommendation linkage", () => {
  it("maps wearable heat + connection error to error recovery", () => {
    const rec = recommendFromHeatmapSession({
      workspaceId: "web-demo",
      screens: [
        { name: "wearable", count: 12 },
        { name: "onboarding", count: 4 },
      ],
      events: ["account_created", "wearable_connection_error", "ui_click"],
    });
    expect(rec?.previewId).toBe("error-recovery");
    expect(rec?.nextEvents).toContain("wearable_connected");
  });

  it("maps paywall heat before value to delayed paywall", () => {
    const rec = recommendFromHeatmapSession({
      workspaceId: "mobile-demo",
      screens: [
        { name: "paywall", count: 10 },
        { name: "home", count: 3 },
      ],
      events: ["paywall_dismissed", "app_opened"],
    });
    expect(rec?.previewId).toBe("delayed-paywall");
  });

  it("maps plan heat without friend invite to friend invite prompt", () => {
    const rec = recommendFromHeatmapSession({
      workspaceId: "web-demo",
      screens: [
        { name: "plan", count: 9 },
        { name: "invite", count: 3 },
      ],
      events: ["practice_plan_created", "ui_click"],
    });
    expect(rec?.previewId).toBe("friend-invite-prompt");
  });
});
