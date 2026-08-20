import { MOBILE_EVENTS, WEB_EVENTS, type WorkspaceId } from "@/lib/workspace";

export type SignalDefinition = {
  id: string;
  name: string;
  description: string;
  interpretation: (lift: number, polarity: string) => string;
  hasSignal: (eventNames: string[], timestamps: Date[]) => boolean;
};

function minutesBetween(a: Date | undefined, b: Date | undefined): number | null {
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 60000;
}

export const WEB_SIGNALS: SignalDefinition[] = [
  {
    id: "integration-first-session",
    name: "Connected integration in first session",
    description: "Users who connected an integration before leaving their first session.",
    interpretation: (lift, polarity) =>
      polarity === "positive"
        ? `Users who connect an integration early convert ${Math.round(Math.abs(lift) * 100)}% more often than those who do not. This is an association, not proof that the integration caused activation.`
        : "Connecting an integration in the first session is not associated with higher activation in this window.",
    hasSignal: (names) => names.includes(WEB_EVENTS.integrationConnected),
  },
  {
    id: "invite-24h",
    name: "Invited teammate within 24 hours",
    description: "Users who sent a teammate invite on the first day.",
    interpretation: (lift, polarity) =>
      polarity === "positive"
        ? "Inviting a teammate quickly is associated with paid conversion. Teams that share the product may be further along in evaluation."
        : "Early teammate invites are not associated with higher conversion here.",
    hasSignal: (names, times) => {
      const created = times[names.indexOf(WEB_EVENTS.accountCreated)];
      const invitedAtIndexes = names
        .map((name, i) => (name === WEB_EVENTS.teammateInvited ? times[i] : null))
        .filter((value): value is Date => Boolean(value));
      if (!created || invitedAtIndexes.length === 0) return false;
      return invitedAtIndexes.some((time) => time.getTime() - created.getTime() <= 86_400_000);
    },
  },
  {
    id: "integration-error",
    name: "Encountered integration error",
    description: "Users who hit an integration error during setup.",
    interpretation: (lift) =>
      `Integration errors are associated with a ${Math.round(Math.abs(lift) * 100)}% change in activation. Treat this as a recovery opportunity, not a causal claim.`,
    hasSignal: (names) => names.includes(WEB_EVENTS.integrationError),
  },
  {
    id: "pricing-repeat",
    name: "Viewed pricing three or more times",
    description: "Users with three or more pricing page views.",
    interpretation: () =>
      "Repeat pricing visits without sign-up often mark comparison shopping or sticker shock — not necessarily intent to buy.",
    hasSignal: (names) => names.filter((name) => name === WEB_EVENTS.pricingViewed).length >= 3,
  },
];

export const MOBILE_SIGNALS: SignalDefinition[] = [
  {
    id: "core-within-five",
    name: "Completed core action within five minutes",
    description: "Users who finished their first Aurelia session within five minutes of opening the app.",
    interpretation: (lift, polarity) =>
      polarity === "positive"
        ? `Fast first-session completion is associated with a ${Math.round(Math.abs(lift) * 100)}% lift in next-day return. Time-to-value is a useful hypothesis, not a proven cause.`
        : "Completing a session quickly is not associated with higher return in this window.",
    hasSignal: (names, times) => {
      const open = times[names.indexOf(MOBILE_EVENTS.appOpened)];
      const doneIndexes = names
        .map((name, i) => (name === MOBILE_EVENTS.coreActionCompleted ? times[i] : null))
        .filter((value): value is Date => Boolean(value));
      return doneIndexes.some((time) => {
        const minutes = minutesBetween(open, time);
        return minutes !== null && minutes <= 5;
      });
    },
  },
  {
    id: "paywall-first-session",
    name: "Dismissed paywall during first session",
    description: "Users who saw and dismissed a paywall before experiencing core value.",
    interpretation: () =>
      "Early paywall dismissals are associated with fewer trial starts. Delay the paywall until after a successful session and measure the change.",
    hasSignal: (names) => names.includes(MOBILE_EVENTS.paywallDismissed),
  },
  {
    id: "permission-denied",
    name: "Denied notification permission",
    description: "Users who declined notification access.",
    interpretation: () =>
      "Permission denials do not block conversion, but they often shift users onto a quieter path with fewer return prompts.",
    hasSignal: (names) => names.includes(MOBILE_EVENTS.permissionDenied),
  },
  {
    id: "returned-next-day",
    name: "Returned the following day",
    description: "Users with a next-day session after first open.",
    interpretation: () =>
      "Next-day return is both a goal and a leading indicator of subscription. It is not independent of the other signals above.",
    hasSignal: (names) => names.includes(MOBILE_EVENTS.returnedNextDay),
  },
];

export function signalsFor(workspaceId: WorkspaceId): SignalDefinition[] {
  return workspaceId === "web-demo" ? WEB_SIGNALS : MOBILE_SIGNALS;
}
