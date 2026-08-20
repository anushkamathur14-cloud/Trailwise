import type { WorkspaceId } from "@/lib/workspace";
import { MOBILE_EVENTS, WEB_EVENTS } from "@/lib/workspace";
import type { PreviewId } from "@/lib/studio/variants";

export type RecommendationPreviewConfig = {
  recommendationId: string;
  workspaceId: WorkspaceId;
  variantId: PreviewId;
  relevantScreens: string[];
  targetEvent: string;
  guardrailEvent: string;
  title: string;
};

export const RECOMMENDATION_PREVIEWS: RecommendationPreviewConfig[] = [
  {
    recommendationId: "web-earlier-wearable",
    workspaceId: "web-demo",
    variantId: "earlier-wearable-help",
    relevantScreens: ["onboarding", "wearable", "plan"],
    targetEvent: WEB_EVENTS.wearableConnected,
    guardrailEvent: WEB_EVENTS.accountCreated,
    title: "Move wearable assistance earlier",
  },
  {
    recommendationId: "web-friend-invite",
    workspaceId: "web-demo",
    variantId: "friend-invite-prompt",
    relevantScreens: ["plan", "invite"],
    targetEvent: WEB_EVENTS.friendInvited,
    guardrailEvent: WEB_EVENTS.practicePlanCreated,
    title: "Prompt friend invite after plan creation",
  },
  {
    recommendationId: "web-error-recovery",
    workspaceId: "web-demo",
    variantId: "error-recovery",
    relevantScreens: ["wearable", "onboarding"],
    targetEvent: WEB_EVENTS.wearableConnected,
    guardrailEvent: WEB_EVENTS.onboardingStarted,
    title: "Recover from wearable connection errors",
  },
  {
    recommendationId: "web-simplified-signup",
    workspaceId: "web-demo",
    variantId: "simplified-signup",
    relevantScreens: ["pricing", "signup"],
    targetEvent: WEB_EVENTS.signupStarted,
    guardrailEvent: WEB_EVENTS.pricingViewed,
    title: "Simplify the path off pricing",
  },
  {
    recommendationId: "mobile-delay-paywall",
    workspaceId: "mobile-demo",
    variantId: "delayed-paywall",
    relevantScreens: ["paywall", "session", "home"],
    targetEvent: MOBILE_EVENTS.trialStarted,
    guardrailEvent: MOBILE_EVENTS.returnedNextDay,
    title: "Delay the paywall until after first value",
  },
  {
    recommendationId: "mobile-core-nudge",
    workspaceId: "mobile-demo",
    variantId: "first-session-nudge",
    relevantScreens: ["goal", "session"],
    targetEvent: MOBILE_EVENTS.coreActionCompleted,
    guardrailEvent: MOBILE_EVENTS.permissionGranted,
    title: "Start the first practice immediately",
  },
  {
    recommendationId: "mobile-permission-alt",
    workspaceId: "mobile-demo",
    variantId: "permission-fallback",
    relevantScreens: ["permissions", "reminder"],
    targetEvent: MOBILE_EVENTS.reminderConfigured,
    guardrailEvent: MOBILE_EVENTS.appOpened,
    title: "Offer an in-app reminder fallback",
  },
];

export function previewConfigFor(recommendationId: string): RecommendationPreviewConfig | undefined {
  return RECOMMENDATION_PREVIEWS.find((item) => item.recommendationId === recommendationId);
}

export function previewConfigByVariant(workspaceId: WorkspaceId, variantId: string): RecommendationPreviewConfig | undefined {
  return RECOMMENDATION_PREVIEWS.find((item) => item.workspaceId === workspaceId && item.variantId === variantId);
}

export function assertRecommendationPreviewIntegrity(): void {
  const ids = new Set<string>();
  for (const row of RECOMMENDATION_PREVIEWS) {
    if (ids.has(row.recommendationId)) throw new Error(`Duplicate recommendationId ${row.recommendationId}`);
    ids.add(row.recommendationId);
    if (!row.variantId || !row.targetEvent || !row.guardrailEvent) {
      throw new Error(`Incomplete mapping for ${row.recommendationId}`);
    }
  }
}
