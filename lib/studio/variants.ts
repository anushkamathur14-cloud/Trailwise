export type PreviewId =
  | "original"
  | "earlier-wearable-help"
  | "friend-invite-prompt"
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
  /** Exact UX differences vs original for the “What changed” panel */
  whatChanged: string[];
  problem: string;
  segment: string;
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
    whatChanged: [],
    problem: "No change applied — baseline Aurelia experience.",
    segment: "All users",
  },
  "earlier-wearable-help": {
    id: "earlier-wearable-help",
    label: "Earlier wearable help",
    hypothesis: "Connecting a wearable before the empty practice plan increases activation.",
    targetMetric: "Activation rate",
    guardrail: "Sign-up completion",
    originalEvents: ["landing_viewed", "signup_started", "account_created", "onboarding_started"],
    recommendedEvents: ["landing_viewed", "signup_started", "account_created", "wearable_connected"],
    whatChanged: [
      "Wearable assistance moved before plan creation",
      "Empty plan state removed from the critical path",
      "Progress indicator added through wearable setup",
    ],
    problem: "New users hit an empty practice plan before connecting a wearable and abandon onboarding.",
    segment: "First-session web users",
  },
  "friend-invite-prompt": {
    id: "friend-invite-prompt",
    label: "Friend invite prompt",
    hypothesis: "A contextual invite after practice plan creation completes activation.",
    targetMetric: "Friend invite rate",
    guardrail: "Practice plan creation",
    originalEvents: ["practice_plan_created"],
    recommendedEvents: ["practice_plan_created", "friend_invited"],
    whatChanged: [
      "Invite prompt shown immediately after plan creation",
      "One-tap share sheet for a friend invite",
      "Activation checklist marks plan + invite",
    ],
    problem: "Users create a practice plan then leave without inviting a friend, so activation never closes.",
    segment: "Users who created a practice plan",
  },
  "error-recovery": {
    id: "error-recovery",
    label: "Wearable error recovery",
    hypothesis: "A retry and skip path after errors reduces onboarding abandonment.",
    targetMetric: "Onboarding completion after error",
    guardrail: "Support contacts",
    originalEvents: ["wearable_connection_error", "onboarding_abandoned"],
    recommendedEvents: ["wearable_connection_error", "wearable_connected"],
    whatChanged: [
      "Demo-data option added after connection failure",
      "Retry and skip paths after wearable errors",
      "Clearer error copy without a dead end",
    ],
    problem: "Wearable connection errors dump users into a dead end and spike onboarding abandonment.",
    segment: "Error-prone wearable setup",
  },
  "simplified-signup": {
    id: "simplified-signup",
    label: "Simplified sign-up",
    hypothesis: "A calmer CTA from pricing reduces window-shopping without conversion.",
    targetMetric: "Sign-up start rate",
    guardrail: "Paid conversion",
    originalEvents: ["pricing_viewed"],
    recommendedEvents: ["pricing_viewed", "signup_started"],
    whatChanged: [
      "Single primary CTA from pricing",
      "Reduced plan comparison noise",
      "Shorter sign-up form fields",
    ],
    problem: "Window shoppers loop on pricing without starting sign-up.",
    segment: "Pricing visitors without an account",
  },
  "delayed-paywall": {
    id: "delayed-paywall",
    label: "Delayed paywall",
    hypothesis: "Showing Aurelia+ after the first session increases trial starts.",
    targetMetric: "Trial start rate",
    guardrail: "Day-1 retention",
    originalEvents: ["paywall_viewed", "paywall_dismissed"],
    recommendedEvents: ["session_completed", "paywall_viewed", "trial_started"],
    whatChanged: [
      "Paywall moved after first completed practice",
      "Trial CTA reframed around value just experienced",
      "Dismiss still available without blocking home",
    ],
    problem: "Early paywall interrupts first value and suppresses trial starts and day-1 return.",
    segment: "New app installs",
  },
  "first-session-nudge": {
    id: "first-session-nudge",
    label: "Immediate first session",
    hypothesis: "A 60-second practice after goal selection increases next-day return.",
    targetMetric: "Session completed within 5 minutes",
    guardrail: "Permission grant rate",
    originalEvents: ["onboarding_viewed"],
    recommendedEvents: ["session_started", "session_completed"],
    whatChanged: [
      "60-second practice starts immediately after goal selection",
      "Home shortcut to resume unfinished practice",
      "Celebration state after first completion",
    ],
    problem: "New installs browse goals but never complete a session in the first five minutes.",
    segment: "Fast-starter candidates",
  },
  "permission-fallback": {
    id: "permission-fallback",
    label: "Notification fallback",
    hypothesis: "In-app reminders recover users who deny the system prompt.",
    targetMetric: "Next-day return among denials",
    guardrail: "Uninstall proxy",
    originalEvents: ["notification_permission_denied"],
    recommendedEvents: ["notification_permission_denied", "reminder_configured"],
    whatChanged: [
      "In-app reminder fallback after permission denial",
      "Optional quiet hours for reminders",
      "No blocked path when notifications are denied",
    ],
    problem: "Permission denials lose the reminder loop with no recovery path.",
    segment: "Permission-denied users",
  },
};
