import { MOBILE_EVENTS, WEB_EVENTS, type WorkspaceId } from "@/lib/workspace";

export type SignalGoal = "activation" | "conversion" | "retention";

export type SignalDefinition = {
  id: string;
  name: string;
  description: string;
  /** Goals this signal may be analyzed against (excludes target leakage) */
  allowedGoals: SignalGoal[];
  interpretation: (absolutePp: number, polarity: string) => string;
  hasSignal: (eventNames: string[], timestamps: Date[]) => boolean;
};

function minutesBetween(a: Date | undefined, b: Date | undefined): number | null {
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 60000;
}

function firstIndex(names: string[], eventName: string): number {
  return names.indexOf(eventName);
}

export const WEB_SIGNALS: SignalDefinition[] = [
  {
    id: "wearable-first-session",
    name: "Wearable connected during first session",
    description: "Connected a wearable before leaving the first session.",
    allowedGoals: ["activation", "conversion", "retention"],
    interpretation: (pp, polarity) =>
      polarity === "positive"
        ? `Users who connect a wearable early activate ${Math.abs(pp * 100).toFixed(1)} percentage points more often. Association only — not proof of cause.`
        : "Connecting a wearable early is not associated with higher activation here.",
    hasSignal: (names) => names.includes(WEB_EVENTS.wearableConnected),
  },
  {
    id: "onboarding-no-error",
    name: "Onboarding completed without an error",
    description: "Started onboarding and connected without a wearable connection error.",
    allowedGoals: ["activation", "conversion"],
    interpretation: () =>
      "Clean onboarding paths are associated with higher activation. Recovery after errors remains a separate opportunity.",
    hasSignal: (names) =>
      names.includes(WEB_EVENTS.onboardingStarted) &&
      names.includes(WEB_EVENTS.wearableConnected) &&
      !names.includes(WEB_EVENTS.wearableConnectionError),
  },
  {
    id: "wearable-within-ten",
    name: "Wearable connection started within ten minutes",
    description: "Began wearable setup within ten minutes of landing or account create.",
    allowedGoals: ["activation", "retention"],
    interpretation: () =>
      "Faster time-to-wearable-setup is associated with stronger activation. Treat as a hypothesis to test.",
    hasSignal: (names, times) => {
      const startIdx = Math.max(firstIndex(names, WEB_EVENTS.landingViewed), firstIndex(names, WEB_EVENTS.accountCreated));
      const start = startIdx >= 0 ? times[startIdx] : undefined;
      const wearIdx = Math.max(
        firstIndex(names, WEB_EVENTS.wearableConnectionStarted),
        firstIndex(names, WEB_EVENTS.wearableConnected),
      );
      if (wearIdx < 0 || !start) return false;
      const minutes = minutesBetween(start, times[wearIdx]);
      return minutes !== null && minutes <= 10;
    },
  },
  {
    id: "pricing-repeat",
    name: "Pricing viewed repeatedly before signup",
    description: "Three or more pricing views without completing account creation.",
    allowedGoals: ["activation", "conversion"],
    interpretation: () =>
      "Repeat pricing visits without signup often mark comparison shopping — not necessarily intent to buy.",
    hasSignal: (names) =>
      names.filter((n) => n === WEB_EVENTS.pricingViewed).length >= 3 && !names.includes(WEB_EVENTS.accountCreated),
  },
  {
    id: "wearable-error",
    name: "Wearable connection error encountered",
    description: "Hit a wearable connection failure during setup.",
    allowedGoals: ["activation", "conversion", "retention"],
    interpretation: (pp) =>
      `Wearable errors are associated with a ${Math.abs(pp * 100).toFixed(1)} pp change in the selected goal. Treat as a recovery opportunity.`,
    hasSignal: (names) => names.includes(WEB_EVENTS.wearableConnectionError),
  },
  {
    id: "plan-created",
    name: "Practice plan created",
    description: "Created a first practice plan (predictor of paid conversion / retention, not activation).",
    allowedGoals: ["conversion", "retention"],
    interpretation: () =>
      "Creating a practice plan is associated with later subscription and return — it is part of activation, so it is excluded from activation analysis.",
    hasSignal: (names) => names.includes(WEB_EVENTS.practicePlanCreated),
  },
  {
    id: "friend-invited-signal",
    name: "Friend invited",
    description: "Sent a friend invite (predictor of paid / retention; excluded from activation analysis).",
    allowedGoals: ["conversion", "retention"],
    interpretation: () =>
      "Inviting a friend is associated with monetization and return. It completes activation, so it is not used to predict activation.",
    hasSignal: (names) => names.includes(WEB_EVENTS.friendInvited),
  },
  {
    id: "upgrade-after-practice",
    name: "Viewed upgrade after completing a practice",
    description: "Opened Aurelia+ after creating a practice plan.",
    allowedGoals: ["conversion"],
    interpretation: () =>
      "Upgrade views after value are associated with higher subscription starts than early pricing loops.",
    hasSignal: (names) =>
      names.includes(WEB_EVENTS.practicePlanCreated) && names.includes(WEB_EVENTS.upgradeViewed),
  },
];

export const MOBILE_SIGNALS: SignalDefinition[] = [
  {
    id: "session-started-within-five",
    name: "Started first practice within five minutes",
    description: "Began a session within five minutes of app open (not completion — avoids activation leakage).",
    allowedGoals: ["activation", "conversion", "retention"],
    interpretation: (pp, polarity) =>
      polarity === "positive"
        ? `Starting a session quickly is associated with a ${Math.abs(pp * 100).toFixed(1)} pp lift on the selected goal.`
        : "Starting a session quickly is not associated with a higher goal rate here.",
    hasSignal: (names, times) => {
      const open = times[firstIndex(names, MOBILE_EVENTS.appOpened)];
      return names.some((name, i) => {
        if (name !== MOBILE_EVENTS.coreActionStarted) return false;
        const minutes = minutesBetween(open, times[i]);
        return minutes !== null && minutes <= 5;
      });
    },
  },
  {
    id: "session-completed-signal",
    name: "Completed a first practice",
    description: "Finished at least one session (predictor of conversion / retention).",
    allowedGoals: ["conversion", "retention"],
    interpretation: () =>
      "Completing a practice is associated with trials and later return. It is part of activation, so excluded from activation analysis.",
    hasSignal: (names) => names.includes(MOBILE_EVENTS.coreActionCompleted),
  },
  {
    id: "paywall-first-session",
    name: "Dismissed paywall during first session",
    description: "Saw and dismissed a paywall before experiencing core value.",
    allowedGoals: ["activation", "conversion"],
    interpretation: () =>
      "Early paywall dismissals are associated with fewer trials. Delay the paywall until after a successful session.",
    hasSignal: (names) => names.includes(MOBILE_EVENTS.paywallDismissed) && !names.includes(MOBILE_EVENTS.coreActionCompleted),
  },
  {
    id: "permission-denied",
    name: "Denied notification permission",
    description: "Declined notification access.",
    allowedGoals: ["activation", "conversion", "retention"],
    interpretation: () =>
      "Permission denials shift users onto a quieter path with fewer return prompts.",
    hasSignal: (names) => names.includes(MOBILE_EVENTS.permissionDenied),
  },
  {
    id: "reminder-configured",
    name: "Set a reminder",
    description: "Configured an in-app or push reminder.",
    allowedGoals: ["activation", "conversion", "retention"],
    interpretation: () =>
      "Reminders are associated with stronger day-1 return when notifications were denied.",
    hasSignal: (names) => names.includes(MOBILE_EVENTS.reminderConfigured),
  },
  {
    id: "onboarding-error-proxy",
    name: "Encountered friction during onboarding",
    description: "Abandoned a session or skipped onboarding early.",
    allowedGoals: ["activation", "retention"],
    interpretation: () =>
      "Early friction is associated with weaker return. Recovery paths matter more than blaming the user.",
    hasSignal: (names) =>
      names.includes(MOBILE_EVENTS.coreActionAbandoned) || names.includes(MOBILE_EVENTS.onboardingSkipped),
  },
];

export function signalsFor(workspaceId: WorkspaceId, goal: SignalGoal = "activation"): SignalDefinition[] {
  const all = workspaceId === "web-demo" ? WEB_SIGNALS : MOBILE_SIGNALS;
  return all.filter((signal) => signal.allowedGoals.includes(goal));
}
