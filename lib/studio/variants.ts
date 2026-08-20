export type PreviewId =
  | "original"
  | "earlier-integration"
  | "invite-prompt"
  | "error-recovery"
  | "simplified-signup"
  | "delayed-paywall"
  | "first-session-nudge"
  | "permission-fallback";

export type StudioVariant = {
  id: PreviewId;
  label: string;
  hypothesis: string;
  targetMetric: string;
  guardrail: string;
  originalEvents: string[];
  recommendedEvents: string[];
};

export const VARIANTS: Record<PreviewId, StudioVariant> = {
  original: {
    id: "original",
    label: "Original journey",
    hypothesis: "Baseline product experience",
    targetMetric: "Activation",
    guardrail: "Bounce on first screen",
    originalEvents: [],
    recommendedEvents: [],
  },
  "earlier-integration": {
    id: "earlier-integration",
    label: "Earlier integration help",
    hypothesis: "Connecting an integration before the empty project state increases activation.",
    targetMetric: "Activation rate",
    guardrail: "Sign-up completion",
    originalEvents: ["landing_viewed", "signup_started", "account_created", "onboarding_started"],
    recommendedEvents: ["landing_viewed", "signup_started", "account_created", "integration_connected"],
  },
  "invite-prompt": {
    id: "invite-prompt",
    label: "Teammate invite prompt",
    hypothesis: "A contextual invite after project creation completes activation.",
    targetMetric: "Teammate invite rate",
    guardrail: "Project creation",
    originalEvents: ["project_created"],
    recommendedEvents: ["project_created", "teammate_invited"],
  },
  "error-recovery": {
    id: "error-recovery",
    label: "Integration error recovery",
    hypothesis: "A retry and skip path after errors reduces onboarding abandonment.",
    targetMetric: "Onboarding completion after error",
    guardrail: "Support contacts",
    originalEvents: ["integration_error", "onboarding_abandoned"],
    recommendedEvents: ["integration_error", "integration_connected"],
  },
  "simplified-signup": {
    id: "simplified-signup",
    label: "Simplified sign-up",
    hypothesis: "A calmer CTA from pricing reduces window-shopping without conversion.",
    targetMetric: "Sign-up start rate",
    guardrail: "Paid conversion",
    originalEvents: ["pricing_viewed"],
    recommendedEvents: ["pricing_viewed", "signup_started"],
  },
  "delayed-paywall": {
    id: "delayed-paywall",
    label: "Delayed paywall",
    hypothesis: "Showing Aurelia+ after the first session increases trial starts.",
    targetMetric: "Trial start rate",
    guardrail: "Day-1 retention",
    originalEvents: ["paywall_viewed", "paywall_dismissed"],
    recommendedEvents: ["session_completed", "paywall_viewed", "trial_started"],
  },
  "first-session-nudge": {
    id: "first-session-nudge",
    label: "Immediate first session",
    hypothesis: "A 60-second practice after goal selection increases next-day return.",
    targetMetric: "Session completed within 5 minutes",
    guardrail: "Permission grant rate",
    originalEvents: ["onboarding_viewed"],
    recommendedEvents: ["session_started", "session_completed"],
  },
  "permission-fallback": {
    id: "permission-fallback",
    label: "Notification fallback",
    hypothesis: "In-app reminders recover users who deny the system prompt.",
    targetMetric: "Next-day return among denials",
    guardrail: "Uninstall proxy",
    originalEvents: ["notification_permission_denied"],
    recommendedEvents: ["notification_permission_denied", "reminder_configured"],
  },
};
