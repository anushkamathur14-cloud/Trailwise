import { MOBILE_EVENTS, WEB_EVENTS, type WorkspaceId } from "@/lib/workspace";

export type EventDefinition = {
  name: string;
  label: string;
  category: "acquisition" | "activation" | "engagement" | "monetization" | "system" | "failure";
  description: string;
  properties: string[];
  skanConversionValue?: number;
};

export const WEB_EVENT_DEFINITIONS: EventDefinition[] = [
  { name: WEB_EVENTS.landingViewed, label: "Landing viewed", category: "acquisition", description: "Visitor landed on the Aurelia marketing site.", properties: ["channel", "page"] },
  { name: WEB_EVENTS.pricingViewed, label: "Pricing viewed", category: "acquisition", description: "Visitor opened Aurelia+ pricing.", properties: ["plan_interest"] },
  { name: WEB_EVENTS.signupStarted, label: "Sign-up started", category: "acquisition", description: "Visitor began creating an account.", properties: ["method"], skanConversionValue: 1 },
  { name: WEB_EVENTS.signupAbandoned, label: "Sign-up abandoned", category: "failure", description: "Sign-up form left incomplete.", properties: ["last_field"] },
  { name: WEB_EVENTS.accountCreated, label: "Account created", category: "activation", description: "An Aurelia web account was created.", properties: ["plan"], skanConversionValue: 3 },
  { name: WEB_EVENTS.onboardingStarted, label: "Onboarding started", category: "activation", description: "User entered guided practice setup.", properties: [] },
  { name: WEB_EVENTS.onboardingAbandoned, label: "Onboarding abandoned", category: "failure", description: "User left onboarding before completing setup.", properties: ["last_step"] },
  { name: WEB_EVENTS.wearableConnectionStarted, label: "Wearable connection started", category: "activation", description: "User began connecting Apple Watch, Oura, or Google Fit.", properties: ["provider"] },
  { name: WEB_EVENTS.wearableConnected, label: "Wearable connected", category: "activation", description: "User successfully connected a wearable.", properties: ["provider"], skanConversionValue: 8 },
  { name: WEB_EVENTS.wearableConnectionError, label: "Wearable connection error", category: "failure", description: "A wearable connection failed.", properties: ["provider", "error_code"] },
  { name: WEB_EVENTS.practicePlanCreated, label: "Practice plan created", category: "activation", description: "User created their first practice plan.", properties: ["template"], skanConversionValue: 16 },
  { name: WEB_EVENTS.practicePlanAbandoned, label: "Practice plan abandoned", category: "failure", description: "Plan creation was started but not finished.", properties: [] },
  { name: WEB_EVENTS.friendInvited, label: "Friend invited", category: "activation", description: "User invited a friend — completes activation with a practice plan.", properties: ["role"], skanConversionValue: 32 },
  { name: WEB_EVENTS.upgradeViewed, label: "Aurelia+ viewed", category: "monetization", description: "User opened the paid plan page.", properties: ["plan"] },
  { name: WEB_EVENTS.subscriptionStarted, label: "Subscription started", category: "monetization", description: "User started Aurelia+ on the web.", properties: ["plan", "mrr"], skanConversionValue: 63 },
  { name: WEB_EVENTS.identityMerged, label: "Identity merged", category: "system", description: "Anonymous visitor linked to a known user.", properties: ["fromAnonymousId"] },
];

export const MOBILE_EVENT_DEFINITIONS: EventDefinition[] = [
  { name: MOBILE_EVENTS.appOpened, label: "App opened", category: "acquisition", description: "Aurelia app process launched.", properties: ["appVersion"], skanConversionValue: 0 },
  { name: MOBILE_EVENTS.onboardingViewed, label: "Onboarding viewed", category: "acquisition", description: "Welcome / onboarding screens shown.", properties: [] },
  { name: MOBILE_EVENTS.onboardingSkipped, label: "Onboarding skipped", category: "failure", description: "User skipped onboarding.", properties: [] },
  { name: MOBILE_EVENTS.goalSelected, label: "Goal selected", category: "activation", description: "User chose sleep, focus, or stress.", properties: ["goal"], skanConversionValue: 1 },
  { name: MOBILE_EVENTS.permissionRequested, label: "Notification permission requested", category: "activation", description: "System permission prompt shown.", properties: [] },
  { name: MOBILE_EVENTS.permissionGranted, label: "Notification permission granted", category: "activation", description: "User allowed notifications.", properties: [], skanConversionValue: 2 },
  { name: MOBILE_EVENTS.permissionDenied, label: "Notification permission denied", category: "failure", description: "User denied notifications.", properties: [] },
  { name: MOBILE_EVENTS.accountCreated, label: "Account created", category: "activation", description: "Mobile account created.", properties: [], skanConversionValue: 3 },
  { name: MOBILE_EVENTS.coreActionStarted, label: "Session started", category: "engagement", description: "Core wellness practice began.", properties: [] },
  { name: MOBILE_EVENTS.coreActionAbandoned, label: "Session abandoned", category: "failure", description: "Practice left incomplete.", properties: [] },
  { name: MOBILE_EVENTS.coreActionCompleted, label: "Session completed", category: "engagement", description: "First successful core action.", properties: ["durationSec"], skanConversionValue: 10 },
  { name: MOBILE_EVENTS.featureDiscovered, label: "Feature discovered", category: "engagement", description: "User opened streaks or another feature.", properties: ["feature"] },
  { name: MOBILE_EVENTS.reminderConfigured, label: "Reminder configured", category: "engagement", description: "In-app or push reminder set.", properties: ["time"] },
  { name: MOBILE_EVENTS.returnedNextDay, label: "Returned next day", category: "engagement", description: "Day-1 return — primary activation with session completed.", properties: [], skanConversionValue: 20 },
  { name: MOBILE_EVENTS.paywallViewed, label: "Paywall viewed", category: "monetization", description: "Aurelia+ paywall shown.", properties: ["placement"] },
  { name: MOBILE_EVENTS.paywallDismissed, label: "Paywall dismissed", category: "failure", description: "User closed the paywall without converting.", properties: [] },
  { name: MOBILE_EVENTS.trialStarted, label: "Trial started", category: "monetization", description: "User started an Aurelia+ trial.", properties: ["plan"], skanConversionValue: 40 },
  { name: MOBILE_EVENTS.trialCanceled, label: "Trial canceled", category: "failure", description: "Trial canceled before purchase.", properties: [] },
  { name: MOBILE_EVENTS.subscriptionPurchased, label: "Subscription purchased", category: "monetization", description: "Paid Aurelia+ purchase.", properties: ["plan"], skanConversionValue: 63 },
  { name: MOBILE_EVENTS.identityMerged, label: "Identity merged", category: "system", description: "Anonymous install linked to an account.", properties: ["fromAnonymousId"] },
];

export function eventDefinitionsFor(workspaceId: WorkspaceId): EventDefinition[] {
  return workspaceId === "web-demo" ? WEB_EVENT_DEFINITIONS : MOBILE_EVENT_DEFINITIONS;
}

export function labelForEvent(workspaceId: WorkspaceId, eventName: string): string {
  return eventDefinitionsFor(workspaceId).find((e) => e.name === eventName)?.label ?? eventName.replace(/_/g, " ");
}

export const SKAN_POLICY = {
  title: "Apple SKAdNetwork (SKAN) conversion policy",
  summary:
    "SKAN returns coarse, privacy-preserving postbacks after an install. Trailwise maps product milestones to conversion values 0–63. Apple may lock and post back the highest value reached in the measurement window — not a full user-level path.",
  rules: [
    "Values are coarse: many users share the same bucket.",
    "Postbacks are delayed and may be null when traffic is sparse.",
    "Do not treat SKAN CV as a substitute for first-party event analytics.",
    "Web Aurelia uses analogous conversion values for demo parity; SKAN applies to iOS installs.",
  ],
};

export function skanRows(workspaceId: WorkspaceId) {
  return eventDefinitionsFor(workspaceId)
    .filter((event) => event.skanConversionValue !== undefined)
    .sort((a, b) => (a.skanConversionValue ?? 0) - (b.skanConversionValue ?? 0));
}
