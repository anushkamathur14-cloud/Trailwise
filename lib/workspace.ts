export const WORKSPACE_IDS = ["web-demo", "mobile-demo"] as const;
export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

/** Aurelia Web — marketing site + account experience event keys */
export const WEB_EVENTS = {
  landingViewed: "landing_viewed",
  pricingViewed: "pricing_viewed",
  signupStarted: "signup_started",
  signupAbandoned: "signup_abandoned",
  accountCreated: "account_created",
  onboardingStarted: "onboarding_started",
  onboardingAbandoned: "onboarding_abandoned",
  wearableConnectionStarted: "wearable_connection_started",
  wearableConnected: "wearable_connected",
  wearableConnectionError: "wearable_connection_error",
  practicePlanCreated: "practice_plan_created",
  practicePlanAbandoned: "practice_plan_abandoned",
  friendInvited: "friend_invited",
  upgradeViewed: "upgrade_viewed",
  subscriptionStarted: "subscription_started",
  identityMerged: "identity_merged",
} as const;

/** Aurelia App — mobile journey event keys (distinct from web) */
export const MOBILE_EVENTS = {
  appOpened: "app_opened",
  onboardingViewed: "onboarding_viewed",
  onboardingSkipped: "onboarding_skipped",
  goalSelected: "goal_selected",
  permissionRequested: "notification_permission_requested",
  permissionDenied: "notification_permission_denied",
  permissionGranted: "notification_permission_granted",
  accountCreated: "account_created",
  coreActionStarted: "session_started",
  coreActionAbandoned: "session_abandoned",
  coreActionCompleted: "session_completed",
  featureDiscovered: "feature_discovered",
  reminderConfigured: "reminder_configured",
  returnedNextDay: "returned_next_day",
  paywallViewed: "paywall_viewed",
  paywallDismissed: "paywall_dismissed",
  trialStarted: "trial_started",
  trialCanceled: "trial_canceled",
  subscriptionPurchased: "subscription_purchased",
  identityMerged: "identity_merged",
} as const;

export type FunnelStep = {
  eventName: string;
  label: string;
  conversionValue: number;
};

export type SegmentDefinition = {
  id: string;
  name: string;
  description: string;
};

export type WorkspaceConfig = {
  id: WorkspaceId;
  name: string;
  productName: string;
  productTagline: string;
  productDescription: string;
  platform: "web" | "mobile";
  /** Retention event shown in tooltips */
  retentionEvent: { name: string; description: string };
  primaryGoal: {
    id: string;
    name: string;
    description: string;
    requiredEvents: string[];
  };
  secondaryGoal: {
    id: string;
    name: string;
    description: string;
    requiredEvents: string[];
  };
  funnels: Array<{
    id: string;
    name: string;
    kind: "marketing" | "monetization";
    description: string;
    steps: FunnelStep[];
  }>;
  defaultJourney: { start: string; end: string };
  acquisitionChannels: string[];
  /** Web: desktop/tablet/mobile-web · App: ios/android */
  devices: string[];
  countries: string[];
  segments: SegmentDefinition[];
};

export const WORKSPACES: Record<WorkspaceId, WorkspaceConfig> = {
  "web-demo": {
    id: "web-demo",
    name: "Aurelia Web",
    productName: "Aurelia",
    productTagline: "A calmer daily wellness practice — on the web",
    productDescription: "Aurelia wellness — web site, practice plans, friend invites, and Aurelia+.",
    platform: "web",
    retentionEvent: {
      name: "Any return visit after first seen",
      description: "Any subsequent web session after the user’s firstSeen day counts toward retention.",
    },
    primaryGoal: {
      id: "activation",
      name: "Activation",
      description: "A user creates their first practice plan and invites a friend within the activation window.",
      requiredEvents: [WEB_EVENTS.practicePlanCreated, WEB_EVENTS.friendInvited],
    },
    secondaryGoal: {
      id: "paid",
      name: "Paid subscription",
      description: "A user starts an Aurelia+ subscription.",
      requiredEvents: [WEB_EVENTS.subscriptionStarted],
    },
    funnels: [
      {
        id: "marketing",
        name: "Marketing funnel",
        kind: "marketing",
        description: "Acquisition from landing through account creation",
        steps: [
          { eventName: WEB_EVENTS.landingViewed, label: "Landing viewed", conversionValue: 0 },
          { eventName: WEB_EVENTS.pricingViewed, label: "Pricing viewed", conversionValue: 1 },
          { eventName: WEB_EVENTS.signupStarted, label: "Sign-up started", conversionValue: 2 },
          { eventName: WEB_EVENTS.accountCreated, label: "Account created", conversionValue: 3 },
        ],
      },
      {
        id: "monetization",
        name: "Monetization funnel",
        kind: "monetization",
        description: "From account to Aurelia+, with SKAN-style conversion values",
        steps: [
          { eventName: WEB_EVENTS.accountCreated, label: "Account created", conversionValue: 3 },
          { eventName: WEB_EVENTS.wearableConnected, label: "Wearable connected", conversionValue: 8 },
          { eventName: WEB_EVENTS.practicePlanCreated, label: "Practice plan created", conversionValue: 16 },
          { eventName: WEB_EVENTS.friendInvited, label: "Friend invited", conversionValue: 32 },
          { eventName: WEB_EVENTS.upgradeViewed, label: "Aurelia+ viewed", conversionValue: 40 },
          { eventName: WEB_EVENTS.subscriptionStarted, label: "Subscription started", conversionValue: 63 },
        ],
      },
    ],
    defaultJourney: { start: WEB_EVENTS.landingViewed, end: WEB_EVENTS.friendInvited },
    acquisitionChannels: ["google", "instagram", "direct", "referral", "newsletter"],
    devices: ["desktop", "tablet", "mobile-web"],
    countries: ["US", "GB", "DE", "IN", "CA", "AU"],
    segments: [
      { id: "high-intent", name: "High intent", description: "Connects a wearable early and often activates." },
      { id: "error-prone", name: "Error-prone", description: "Hits wearable connection errors; higher onboarding abandon." },
      { id: "window-shopper", name: "Window shopper", description: "Repeats pricing views without signing up." },
      { id: "core", name: "Core", description: "Typical mixed journey without a dominant failure pattern." },
      { id: "tester", name: "Tester", description: "Created in Experience Studio." },
    ],
  },
  "mobile-demo": {
    id: "mobile-demo",
    name: "Aurelia App",
    productName: "Aurelia",
    productTagline: "A calmer daily wellness practice — on iOS & Android",
    productDescription: "Aurelia wellness app — sessions, day-1 return, and Aurelia+ on iOS & Android.",
    platform: "mobile",
    retentionEvent: {
      name: "returned_next_day or any later app open",
      description: "Day-N retention counts users with activity N calendar days after firstSeen (UTC).",
    },
    primaryGoal: {
      id: "activation",
      name: "Activated return",
      description: "Completed a first session and returned the next day.",
      requiredEvents: [MOBILE_EVENTS.coreActionCompleted, MOBILE_EVENTS.returnedNextDay],
    },
    secondaryGoal: {
      id: "paid",
      name: "Subscription",
      description: "Started a trial or purchased Aurelia+.",
      requiredEvents: [MOBILE_EVENTS.trialStarted, MOBILE_EVENTS.subscriptionPurchased],
    },
    funnels: [
      {
        id: "marketing",
        name: "Marketing funnel",
        kind: "marketing",
        description: "Install → onboarding → account",
        steps: [
          { eventName: MOBILE_EVENTS.appOpened, label: "App opened", conversionValue: 0 },
          { eventName: MOBILE_EVENTS.onboardingViewed, label: "Onboarding viewed", conversionValue: 1 },
          { eventName: MOBILE_EVENTS.goalSelected, label: "Goal selected", conversionValue: 2 },
          { eventName: MOBILE_EVENTS.accountCreated, label: "Account created", conversionValue: 3 },
        ],
      },
      {
        id: "monetization",
        name: "Monetization funnel",
        kind: "monetization",
        description: "Value → return → trial",
        steps: [
          { eventName: MOBILE_EVENTS.coreActionCompleted, label: "Session completed", conversionValue: 10 },
          { eventName: MOBILE_EVENTS.returnedNextDay, label: "Returned next day", conversionValue: 20 },
          { eventName: MOBILE_EVENTS.paywallViewed, label: "Paywall viewed", conversionValue: 30 },
          { eventName: MOBILE_EVENTS.trialStarted, label: "Trial started", conversionValue: 40 },
          { eventName: MOBILE_EVENTS.subscriptionPurchased, label: "Subscription purchased", conversionValue: 63 },
        ],
      },
    ],
    defaultJourney: {
      start: MOBILE_EVENTS.appOpened,
      end: MOBILE_EVENTS.returnedNextDay,
    },
    acquisitionChannels: ["app-store", "tiktok", "instagram", "referral", "organic"],
    devices: ["ios", "android"],
    countries: ["US", "GB", "BR", "JP", "DE", "IN"],
    segments: [
      { id: "fast-starter", name: "Fast starter", description: "Completes a session quickly and often returns next day." },
      { id: "early-paywall", name: "Early paywall", description: "Sees/dismisses paywall before first value." },
      { id: "permission-denied", name: "Permission denied", description: "Declines notifications; quieter return path." },
      { id: "core", name: "Core", description: "Typical mixed journey." },
      { id: "tester", name: "Tester", description: "Created in Experience Studio." },
    ],
  },
};

export function isWorkspaceId(value: string | null | undefined): value is WorkspaceId {
  return value === "web-demo" || value === "mobile-demo";
}

export function getWorkspace(id: string): WorkspaceConfig {
  if (!isWorkspaceId(id)) return WORKSPACES["web-demo"];
  return WORKSPACES[id];
}

/** Device/platform filter options for UI */
export function filterOptionsFor(workspaceId: WorkspaceId) {
  if (workspaceId === "web-demo") {
    return {
      label: "Device type",
      options: [
        { id: "", label: "All devices" },
        { id: "desktop", label: "Desktop" },
        { id: "tablet", label: "Tablet" },
        { id: "mobile-web", label: "Mobile web" },
      ],
    };
  }
  return {
    label: "Platform",
    options: [
      { id: "", label: "All platforms" },
      { id: "ios", label: "iOS" },
      { id: "android", label: "Android" },
    ],
  };
}
