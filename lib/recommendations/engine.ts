import { MOBILE_EVENTS, WEB_EVENTS, type WorkspaceId } from "@/lib/workspace";

export type ProductRecommendation = {
  id: string;
  kind: "product";
  title: string;
  change: string;
  evidence: string;
  segment: string;
  impactDirection: "increase" | "decrease" | "mixed";
  confidence: "low" | "medium" | "high";
  downside: string;
  successMetric: string;
  experiment: string;
  previewId: string;
  /** Short opportunity statement for Overview TLDR */
  impact: string;
  /** Quantified expectation for Overview TLDR */
  expectedImpact: string;
};

export type UserRecommendation = {
  id: string;
  kind: "user";
  title: string;
  experience: string;
  why: string;
  signals: string[];
  suppression: string[];
  confidence: "low" | "medium" | "high";
  previewId: string;
};

export type UserSignals = {
  workspaceId: WorkspaceId;
  activated: boolean;
  converted: boolean;
  eventNames: string[];
  traits: Record<string, unknown>;
  segment?: string | null;
};

export function productRecommendations(workspaceId: WorkspaceId): ProductRecommendation[] {
  if (workspaceId === "web-demo") {
    return [
      {
        id: "web-earlier-integration",
        kind: "product",
        title: "Move integration assistance earlier",
        change: "Prompt new Forge users to connect Slack or GitHub before they reach an empty project screen.",
        evidence: "Users who connect an integration in the first session activate more often than those who skip it. Integration errors also cluster with onboarding abandonment.",
        segment: "New sign-ups, first session",
        impactDirection: "increase",
        confidence: "high",
        downside: "A longer first session may raise bounce for users who only wanted to browse.",
        successMetric: "Activation rate (project created + teammate invited)",
        experiment: "Holdout 20% of new accounts on the current onboarding. Primary: activation. Guardrail: sign-up completion.",
        previewId: "earlier-integration",
        impact: "First-session users stall on empty projects before connecting an integration — a major activation leak.",
        expectedImpact: "+8–14% activation among new sign-ups (high confidence)",
      },
      {
        id: "web-invite-prompt",
        kind: "product",
        title: "Prompt high-intent users to invite a teammate",
        change: "After the first project is created, show a contextual invite instead of burying it in settings.",
        evidence: "Activation requires an invite. Users who stop after project creation never complete the primary goal.",
        segment: "Users with a project and no invite",
        impactDirection: "increase",
        confidence: "medium",
        downside: "Premature invites can annoy solo evaluators.",
        successMetric: "Teammate invite rate within 24 hours",
        experiment: "Show invite modal vs settings-only. Guardrail: project creation rate.",
        previewId: "invite-prompt",
        impact: "High-intent users create a project then leave without inviting — activation never closes.",
        expectedImpact: "+10–18% invite rate within 24h for project creators (medium confidence)",
      },
      {
        id: "web-error-recovery",
        kind: "product",
        title: "Offer recovery guidance after an integration error",
        change: "Replace the generic failure state with a retry path, sample data, and a human handoff.",
        evidence: "Integration errors are associated with onboarding abandonment. Recovery copy can keep the session alive.",
        segment: "Users who hit integration_error",
        impactDirection: "increase",
        confidence: "high",
        downside: "Retry loops without a skip option may increase frustration.",
        successMetric: "Onboarding completion after an error",
        experiment: "Error-recovery screen vs current dead-end. Guardrail: support tickets.",
        previewId: "error-recovery",
        impact: "Integration errors dump users into a dead end and spike onboarding abandonment.",
        expectedImpact: "+20–30% onboarding completion after error (high confidence)",
      },
    ];
  }

  return [
    {
      id: "mobile-delay-paywall",
      kind: "product",
      title: "Delay the paywall until after first value",
      change: "Do not show Aurelia+ until the user completes one session.",
      evidence: "Users who dismiss a paywall in the first session start fewer trials. Completing a session within five minutes is associated with next-day return.",
      segment: "First-session users",
      impactDirection: "increase",
      confidence: "high",
      downside: "Fewer paywall impressions may reduce same-day purchases from high-intent users.",
      successMetric: "Trial start rate",
      experiment: "Paywall after first session vs current first-session paywall. Guardrail: day-1 retention.",
      previewId: "delayed-paywall",
      impact: "Early paywall interrupts first value and suppresses both trial starts and day-1 return.",
      expectedImpact: "+12–20% trial starts; day-1 retention guardrail flat-to-up (high confidence)",
    },
    {
      id: "mobile-core-nudge",
      kind: "product",
      title: "Guide users through the first session immediately",
      change: "Replace optional onboarding with a 60-second first practice after goal selection.",
      evidence: "Core action within five minutes is associated with higher return. Abandoned sessions never reach the primary goal.",
      segment: "New installs",
      impactDirection: "increase",
      confidence: "high",
      downside: "Skipping education may confuse users who wanted to browse goals.",
      successMetric: "Session completion within 5 minutes",
      experiment: "Immediate session vs current multi-step onboarding. Guardrail: permission grant rate.",
      previewId: "first-session-nudge",
      impact: "New installs browse goals but never complete a session in the first five minutes.",
      expectedImpact: "+15–25% session completion in 5 minutes (high confidence)",
    },
    {
      id: "mobile-permission-alt",
      kind: "product",
      title: "Offer an in-app reminder path when notifications are denied",
      change: "If permission is denied, configure an in-app reminder instead of retrying the system prompt.",
      evidence: "Denied notifications still convert, but through a quieter path. A fallback reminder keeps the habit loop intact.",
      segment: "Permission-denied users",
      impactDirection: "increase",
      confidence: "medium",
      downside: "In-app reminders only work if the user reopens the app.",
      successMetric: "Next-day return among permission-denied users",
      experiment: "Fallback reminder vs no fallback. Guardrail: uninstall proxy (session volume).",
      previewId: "permission-fallback",
      impact: "Permission denials lose the reminder loop with no recovery path.",
      expectedImpact: "+6–12% day-1 return among denials (medium confidence)",
    },
  ];
}

export function userRecommendation(profile: UserSignals): UserRecommendation {
  const names = new Set(profile.eventNames);

  if (profile.workspaceId === "web-demo") {
    if (names.has(WEB_EVENTS.integrationError) && !names.has(WEB_EVENTS.projectCreated)) {
      return {
        id: "user-error-recovery",
        kind: "user",
        title: "Show error-recovery onboarding",
        experience: "Open the integration retry screen with sample data and a skip-to-project path.",
        why: "This user hit an integration error and has not created a project.",
        signals: ["Encountered integration error", "No project created"],
        suppression: ["Already activated", "Converted to paid"],
        confidence: "high",
        previewId: "error-recovery",
      };
    }
    if (!names.has(WEB_EVENTS.integrationConnected) && names.has(WEB_EVENTS.accountCreated)) {
      return {
        id: "user-connect-integration",
        kind: "user",
        title: "Encourage connecting an integration",
        experience: "Launch onboarding with integration assistance first.",
        why: "Identified users who skip the integration activate less often in the seeded population.",
        signals: ["Account created", "No integration connected"],
        suppression: ["Already connected an integration"],
        confidence: "medium",
        previewId: "earlier-integration",
      };
    }
    if (names.has(WEB_EVENTS.projectCreated) && !names.has(WEB_EVENTS.teammateInvited)) {
      return {
        id: "user-invite",
        kind: "user",
        title: "Prompt this user to invite a teammate",
        experience: "Show the team invite immediately after the project canvas.",
        why: "Activation requires a teammate invite. This user created a project and stopped.",
        signals: ["Project created", "No teammate invited"],
        suppression: ["Already invited a teammate"],
        confidence: "high",
        previewId: "invite-prompt",
      };
    }
    if ((profile.traits.pricingViews as number | undefined) && (profile.traits.pricingViews as number) >= 3 && !names.has(WEB_EVENTS.accountCreated)) {
      return {
        id: "user-pricing",
        kind: "user",
        title: "Offer a simpler path off pricing",
        experience: "Replace a hard paywall CTA with a guided trial sign-up.",
        why: "This visitor viewed pricing at least three times without starting sign-up.",
        signals: ["Viewed pricing 3+ times", "No account"],
        suppression: ["Already signed up"],
        confidence: "medium",
        previewId: "simplified-signup",
      };
    }
    return {
      id: "user-default-web",
      kind: "user",
      title: "Continue the standard Forge onboarding",
      experience: "Keep the original journey; this user does not match a high-priority intervention.",
      why: "No strong suppression or trigger fired. The baseline journey remains appropriate.",
      signals: ["No blocking failure"],
      suppression: [],
      confidence: "low",
      previewId: "original",
    };
  }

  if (names.has(MOBILE_EVENTS.paywallDismissed) && !names.has(MOBILE_EVENTS.coreActionCompleted)) {
    return {
      id: "user-delay-paywall",
      kind: "user",
      title: "Avoid showing the paywall yet",
      experience: "Route this user into a first session before any upgrade prompt.",
      why: "The paywall appeared before the user completed a session, which is associated with fewer trials.",
      signals: ["Paywall dismissed", "No session completed"],
      suppression: ["Already completed a session", "Already in trial"],
      confidence: "high",
      previewId: "delayed-paywall",
    };
  }
  if (!names.has(MOBILE_EVENTS.coreActionCompleted)) {
    return {
      id: "user-core-action",
      kind: "user",
      title: "Prompt the first wellness session",
      experience: "Start a 60-second guided practice immediately.",
      why: "This user has not completed the core action that is associated with next-day return.",
      signals: ["No session completed"],
      suppression: ["Already completed a session"],
      confidence: "high",
      previewId: "first-session-nudge",
    };
  }
  if (names.has(MOBILE_EVENTS.permissionDenied) && !names.has(MOBILE_EVENTS.reminderConfigured)) {
    return {
      id: "user-permission-fallback",
      kind: "user",
      title: "Offer an in-app reminder",
      experience: "Configure a quiet reminder without re-prompting system notifications.",
      why: "Notification permission was denied, so the default return loop is weaker.",
      signals: ["Permission denied", "No reminder configured"],
      suppression: ["Permission granted", "Reminder already set"],
      confidence: "medium",
      previewId: "permission-fallback",
    };
  }
  if (names.has(MOBILE_EVENTS.coreActionCompleted) && !names.has(MOBILE_EVENTS.trialStarted) && !names.has(MOBILE_EVENTS.subscriptionPurchased)) {
    return {
      id: "user-trial-after-value",
      kind: "user",
      title: "Offer a trial after value",
      experience: "Show Aurelia+ once the first session result is on screen.",
      why: "The user has experienced the product. A trial offer now is more aligned with the recommended sequence.",
      signals: ["Session completed", "No trial"],
      suppression: ["Already in trial or paid"],
      confidence: "medium",
      previewId: "delayed-paywall",
    };
  }
  return {
    id: "user-default-mobile",
    kind: "user",
    title: "Continue the standard Aurelia journey",
    experience: "Keep the original app flow.",
    why: "No high-priority next-best-action matched this profile.",
    signals: ["No blocking failure"],
    suppression: [],
    confidence: "low",
    previewId: "original",
  };
}
