import type { WorkspaceId } from "@/lib/workspace";
import { productRecommendations, type ProductRecommendation } from "@/lib/recommendations/engine";
import type { PreviewId } from "@/lib/studio/variants";

export type HeatSessionInput = {
  workspaceId: WorkspaceId;
  /** Screen tap densities from the tester heatmap */
  screens: Array<{ name: string; count: number }>;
  /** Event names emitted in this session (newest first ok) */
  events: string[];
};

export type HeatLinkedRecommendation = {
  previewId: PreviewId;
  title: string;
  action: string;
  why: string;
  confidence: "low" | "medium" | "high";
  /** Events that triggered this recommendation */
  triggerEvents: string[];
  /** Hotspot screens that support the recommendation */
  hotspotScreens: string[];
  /** Events the recommended experience should drive next */
  nextEvents: string[];
  /** Matching product recommendation id when available */
  productId?: string;
  source: "heatmap+events";
};

const WEB_RULES: Array<{
  id: string;
  previewId: PreviewId;
  screens: string[];
  requireAny?: string[];
  requireNone?: string[];
  title: string;
  action: string;
  why: (hottest: string) => string;
  nextEvents: string[];
}> = [
  {
    id: "web-error-recovery",
    previewId: "error-recovery",
    screens: ["wearable", "onboarding"],
    requireAny: ["wearable_connection_error"],
    title: "Recover from wearable friction",
    action: "Switch to the error-recovery experience: retry + demo data instead of a dead end.",
    why: (hottest) =>
      `Heat concentrated on “${hottest}” and a wearable_connection_error fired — users are engaging the connect step but failing.`,
    nextEvents: ["wearable_connected", "practice_plan_created"],
  },
  {
    id: "web-friend-invite",
    previewId: "friend-invite-prompt",
    screens: ["plan", "invite"],
    requireAny: ["practice_plan_created"],
    requireNone: ["friend_invited"],
    title: "Close activation with a friend invite",
    action: "Surface the invite prompt right after plan creation — the primary conversion window.",
    why: (hottest) =>
      `Heat on “${hottest}” after practice_plan_created without friend_invited — attention is here but activation is incomplete.`,
    nextEvents: ["friend_invited"],
  },
  {
    id: "web-earlier-wearable",
    previewId: "earlier-wearable-help",
    screens: ["onboarding", "wearable", "plan", "landing"],
    requireAny: ["account_created", "onboarding_started"],
    requireNone: ["wearable_connected"],
    title: "Move wearable help earlier",
    action: "Prompt wearable connect before the empty practice plan.",
    why: (hottest) =>
      `Users are engaging “${hottest}” after account create without connecting a wearable — classic empty-plan stall.`,
    nextEvents: ["wearable_connected", "practice_plan_created"],
  },
  {
    id: "web-simplified-signup",
    previewId: "simplified-signup",
    screens: ["pricing", "landing"],
    requireAny: ["pricing_viewed", "signup_abandoned", "landing_viewed"],
    requireNone: ["account_created"],
    title: "Simplify the path off pricing",
    action: "Replace hard pricing CTAs with a guided trial sign-up.",
    why: (hottest) =>
      `Heat is stuck on “${hottest}” without account_created — window-shopping without conversion.`,
    nextEvents: ["signup_started", "account_created"],
  },
];

const MOBILE_RULES: Array<{
  id: string;
  previewId: PreviewId;
  screens: string[];
  requireAny?: string[];
  requireNone?: string[];
  title: string;
  action: string;
  why: (hottest: string) => string;
  nextEvents: string[];
}> = [
  {
    id: "mobile-delay-paywall",
    previewId: "delayed-paywall",
    screens: ["paywall", "home"],
    requireAny: ["paywall_viewed", "paywall_dismissed"],
    requireNone: ["session_completed"],
    title: "Delay the paywall until after value",
    action: "Hide Aurelia+ until a session is completed.",
    why: (hottest) =>
      `Heat on “${hottest}” with paywall interaction before session_completed — monetization is interrupting first value.`,
    nextEvents: ["session_started", "session_completed", "trial_started"],
  },
  {
    id: "mobile-core-nudge",
    previewId: "first-session-nudge",
    screens: ["welcome", "goal", "home", "session"],
    requireNone: ["session_completed"],
    title: "Start the first practice immediately",
    action: "Route straight into a 60-second session after goal selection.",
    why: (hottest) =>
      `Engagement heat on “${hottest}” without session_completed — the core action window never opened.`,
    nextEvents: ["session_started", "session_completed"],
  },
  {
    id: "mobile-permission-alt",
    previewId: "permission-fallback",
    screens: ["permissions", "reminder"],
    requireAny: ["notification_permission_denied"],
    requireNone: ["reminder_configured"],
    title: "Offer an in-app reminder fallback",
    action: "After a denial, configure an in-app reminder instead of re-prompting the system dialog.",
    why: (hottest) =>
      `Heat around “${hottest}” with permission denied and no reminder — the return loop is broken.`,
    nextEvents: ["reminder_configured", "returned_next_day"],
  },
];

export function recommendFromHeatmapSession(input: HeatSessionInput): HeatLinkedRecommendation | null {
  const eventSet = new Set(input.events.filter((name) => name && !name.includes(" ")));
  const rankedScreens = [...input.screens].sort((a, b) => b.count - a.count);
  const hottest = rankedScreens[0]?.name ?? "the preview";
  const hotNames = new Set(rankedScreens.slice(0, 3).map((s) => s.name));
  const products = productRecommendations(input.workspaceId);
  const rules = input.workspaceId === "web-demo" ? WEB_RULES : MOBILE_RULES;

  for (const rule of rules) {
    const screenHit = rule.screens.some((screen) => hotNames.has(screen) || rankedScreens.some((s) => s.name === screen && s.count > 0));
    const heatEnough = rankedScreens.some((s) => rule.screens.includes(s.name) && s.count >= 2) || eventSet.size >= 2;
    if (!screenHit && !heatEnough) continue;

    if (rule.requireAny && !rule.requireAny.some((name) => eventSet.has(name))) continue;
    if (rule.requireNone && rule.requireNone.some((name) => eventSet.has(name))) continue;

    // Prefer rules whose screens actually appear in the heat map
    const hotspotScreens = rankedScreens.filter((s) => rule.screens.includes(s.name)).map((s) => s.name);
    if (hotspotScreens.length === 0 && rule.requireAny && !rule.requireAny.some((name) => eventSet.has(name))) {
      continue;
    }

    const product = products.find((item) => item.previewId === rule.previewId);
    const triggerEvents = [...eventSet].filter(
      (name) => rule.requireAny?.includes(name) || name === "ui_click" || name.includes("abandon") || name.includes("error") || name.includes("dismiss"),
    );

    return {
      previewId: rule.previewId,
      title: rule.title,
      action: rule.action,
      why: rule.why(hottest),
      confidence: hotspotScreens.length >= 1 && (rule.requireAny?.some((n) => eventSet.has(n)) ?? true) ? "high" : "medium",
      triggerEvents: triggerEvents.length ? triggerEvents : [...eventSet].slice(0, 4),
      hotspotScreens: hotspotScreens.length ? hotspotScreens : [hottest],
      nextEvents: rule.nextEvents,
      productId: product?.id,
      source: "heatmap+events",
    };
  }

  if (rankedScreens.length === 0 && eventSet.size === 0) return null;

  const fallback = products[0];
  return {
    previewId: (fallback?.previewId as PreviewId) ?? "original",
    title: fallback?.title ?? "Keep observing",
    action: fallback?.change ?? "Continue interacting to surface a stronger recommendation.",
    why: `Session heat is lightest on “${hottest}”. Keep clicking through conversion windows to strengthen the signal.`,
    confidence: "low",
    triggerEvents: [...eventSet].slice(0, 4),
    hotspotScreens: rankedScreens.slice(0, 2).map((s) => s.name),
    nextEvents: fallback ? ["account_created", "session_completed"] : [],
    productId: fallback?.id,
    source: "heatmap+events",
  };
}

/** Attach heatmap linkage metadata onto static product recommendations. */
export function withHeatmapLinkage(recs: ProductRecommendation[], workspaceId: WorkspaceId) {
  const rules = workspaceId === "web-demo" ? WEB_RULES : MOBILE_RULES;
  return recs.map((rec) => {
    const rule = rules.find((item) => item.previewId === rec.previewId);
    return {
      ...rec,
      hotspotScreens: rule?.screens ?? [],
      relatedEvents: rule?.nextEvents ?? [],
      heatmapHint: rule
        ? humanHeatHint(rule.screens, rule.requireAny, rule.nextEvents)
        : "Open Experience Studio to validate this recommendation against engagement density.",
    };
  });
}

function humanHeatHint(screens: string[], requireAny: string[] | undefined, nextEvents: string[]) {
  const screenPhrase = screens.join(", ");
  if (screens.includes("wearable") || screens.includes("onboarding") || screens.includes("plan")) {
    return `New users repeatedly interact with wearable setup on ${screenPhrase}, then abandon when they encounter friction before activation completes.`;
  }
  if (screens.includes("pricing") || screens.includes("signup")) {
    return `Visitors loop on pricing and signup without converting — attention clusters on ${screenPhrase}.`;
  }
  if (screens.includes("paywall") || screens.includes("session")) {
    return `App users show dense interaction on ${screenPhrase} around first value and paywall timing.`;
  }
  if (screens.includes("permissions") || screens.includes("reminder")) {
    return `Users who deny notifications stall without an in-app reminder path (${screenPhrase}).`;
  }
  const triggers = (requireAny ?? []).map((e) => e.replace(/_/g, " ")).join(", ");
  const next = nextEvents.map((e) => e.replace(/_/g, " ")).join(" → ");
  return `Behavioral density on ${screenPhrase}${triggers ? ` after ${triggers}` : ""} points to driving ${next || "the next activation step"}.`;
}
