export const WORKSPACE_IDS = ["web-demo", "mobile-demo"] as const;
export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export const WEB_EVENTS = {
  landingViewed: "landing_viewed",
  pricingViewed: "pricing_viewed",
  signupStarted: "signup_started",
  signupAbandoned: "signup_abandoned",
  accountCreated: "account_created",
  onboardingStarted: "onboarding_started",
  onboardingAbandoned: "onboarding_abandoned",
  integrationConnected: "integration_connected",
  integrationError: "integration_error",
  projectCreated: "project_created",
  projectAbandoned: "project_abandoned",
  teammateInvited: "teammate_invited",
  upgradeViewed: "upgrade_viewed",
  subscriptionStarted: "subscription_started",
  identityMerged: "identity_merged",
} as const;

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

export type WorkspaceConfig = {
  id: WorkspaceId;
  name: string;
  productName: string;
  productTagline: string;
  platform: "web" | "mobile";
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
    description: string;
    steps: Array<{ eventName: string; label: string }>;
  }>;
  defaultJourney: { start: string; end: string };
  acquisitionChannels: string[];
  devices: string[];
  countries: string[];
  segments: string[];
};

export const WORKSPACES: Record<WorkspaceId, WorkspaceConfig> = {
  "web-demo": {
    id: "web-demo",
    name: "Web Demo",
    productName: "Forge",
    productTagline: "Ship internal tools without the waiting list",
    platform: "web",
    primaryGoal: {
      id: "activation",
      name: "Activation",
      description: "Created a first project and invited a teammate",
      requiredEvents: [WEB_EVENTS.projectCreated, WEB_EVENTS.teammateInvited],
    },
    secondaryGoal: {
      id: "paid",
      name: "Paid subscription",
      description: "Started a paid Forge subscription",
      requiredEvents: [WEB_EVENTS.subscriptionStarted],
    },
    funnels: [
      {
        id: "activation",
        name: "Activation funnel",
        description: "Landing to first project and teammate invite",
        steps: [
          { eventName: WEB_EVENTS.landingViewed, label: "Landing viewed" },
          { eventName: WEB_EVENTS.signupStarted, label: "Sign-up started" },
          { eventName: WEB_EVENTS.accountCreated, label: "Account created" },
          { eventName: WEB_EVENTS.onboardingStarted, label: "Onboarding started" },
          { eventName: WEB_EVENTS.integrationConnected, label: "Integration connected" },
          { eventName: WEB_EVENTS.projectCreated, label: "Project created" },
          { eventName: WEB_EVENTS.teammateInvited, label: "Teammate invited" },
        ],
      },
      {
        id: "revenue",
        name: "Revenue funnel",
        description: "Account created to paid subscription",
        steps: [
          { eventName: WEB_EVENTS.accountCreated, label: "Account created" },
          { eventName: WEB_EVENTS.upgradeViewed, label: "Upgrade viewed" },
          { eventName: WEB_EVENTS.subscriptionStarted, label: "Subscription started" },
        ],
      },
    ],
    defaultJourney: { start: WEB_EVENTS.landingViewed, end: WEB_EVENTS.teammateInvited },
    acquisitionChannels: ["google", "linkedin", "direct", "producthunt", "referral"],
    devices: ["desktop", "mobile-web", "tablet"],
    countries: ["US", "GB", "DE", "IN", "CA", "AU"],
    segments: ["high-intent", "error-prone", "window-shopper", "core"],
  },
  "mobile-demo": {
    id: "mobile-demo",
    name: "Mobile App Demo",
    productName: "Aurelia",
    productTagline: "A calmer daily wellness practice",
    platform: "mobile",
    primaryGoal: {
      id: "activation",
      name: "Activated return",
      description: "Completed a first session and returned the next day",
      requiredEvents: [MOBILE_EVENTS.coreActionCompleted, MOBILE_EVENTS.returnedNextDay],
    },
    secondaryGoal: {
      id: "paid",
      name: "Subscription",
      description: "Started a trial or purchased Aurelia+",
      requiredEvents: [MOBILE_EVENTS.trialStarted, MOBILE_EVENTS.subscriptionPurchased],
    },
    funnels: [
      {
        id: "activation",
        name: "Activation funnel",
        description: "App open through first session and next-day return",
        steps: [
          { eventName: MOBILE_EVENTS.appOpened, label: "App opened" },
          { eventName: MOBILE_EVENTS.onboardingViewed, label: "Onboarding viewed" },
          { eventName: MOBILE_EVENTS.goalSelected, label: "Goal selected" },
          { eventName: MOBILE_EVENTS.accountCreated, label: "Account created" },
          { eventName: MOBILE_EVENTS.coreActionCompleted, label: "Session completed" },
          { eventName: MOBILE_EVENTS.returnedNextDay, label: "Returned next day" },
        ],
      },
      {
        id: "revenue",
        name: "Monetization funnel",
        description: "First session to trial or purchase",
        steps: [
          { eventName: MOBILE_EVENTS.coreActionCompleted, label: "Session completed" },
          { eventName: MOBILE_EVENTS.paywallViewed, label: "Paywall viewed" },
          { eventName: MOBILE_EVENTS.trialStarted, label: "Trial started" },
        ],
      },
    ],
    defaultJourney: {
      start: MOBILE_EVENTS.appOpened,
      end: MOBILE_EVENTS.returnedNextDay,
    },
    acquisitionChannels: ["app-store", "tiktok", "instagram", "referral", "organic"],
    devices: ["iphone", "android"],
    countries: ["US", "GB", "BR", "JP", "DE", "IN"],
    segments: ["fast-starter", "early-paywall", "permission-denied", "core"],
  },
};

export function isWorkspaceId(value: string | null | undefined): value is WorkspaceId {
  return value === "web-demo" || value === "mobile-demo";
}

export function getWorkspace(id: string): WorkspaceConfig {
  if (!isWorkspaceId(id)) return WORKSPACES["web-demo"];
  return WORKSPACES[id];
}
