/** Human-readable drop-off label for a last event or failure transition. */
export function describeDropOff(eventName: string | null | undefined, currentScreen?: string): string {
  if (!eventName) return "—";
  const map: Record<string, string> = {
    landing_viewed: "Exited after Landing",
    pricing_viewed: "Left during Pricing",
    signup_started: "Left during Sign-up",
    signup_abandoned: "Abandoned sign-up",
    account_created: "Stopped after Account created",
    onboarding_started: "Left during Onboarding",
    onboarding_abandoned: "Abandoned onboarding",
    wearable_connection_started: "Abandoned wearable setup",
    wearable_connected: "Stopped after Wearable connected",
    wearable_connection_error: "Abandoned wearable setup",
    practice_plan_created: "Stopped after Practice plan created",
    practice_plan_abandoned: "Abandoned practice plan",
    friend_invited: "Stopped after Friend invited",
    upgrade_viewed: "Left during Upgrade",
    app_opened: "Stopped after opening the app",
    onboarding_viewed: "Left during app onboarding",
    goal_selected: "Stopped after Goal selected",
    notification_permission_denied: "Denied notifications",
    session_started: "Left during practice",
    session_abandoned: "Abandoned practice",
    session_completed: "Stopped after Practice completed",
    paywall_viewed: "Left at the paywall",
    paywall_dismissed: "Dismissed the paywall",
  };
  if (map[eventName]) return map[eventName];
  if (eventName.includes("abandon")) return `Abandoned ${eventName.replace(/_/g, " ").replace(" abandoned", "")}`;
  if (currentScreen && eventName === currentScreen) return `Exited after ${currentScreen}`;
  return `Dropped off at ${eventName.replace(/_/g, " ")}`;
}
