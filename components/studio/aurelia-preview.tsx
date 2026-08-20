"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MOBILE_EVENTS } from "@/lib/workspace";
import type { PreviewId } from "@/lib/studio/variants";

type Person = { id: string; anonymousId: string | null; userId: string | null };
type Screen = "welcome" | "goal" | "permissions" | "home" | "session" | "result" | "reminder" | "paywall";

export function AureliaPreview({
  person,
  recommended,
  previewId,
  onEvent,
}: {
  person: Person;
  recommended: boolean;
  previewId: PreviewId;
  onEvent: (name: string) => void;
}) {
  const [screen, setScreen] = useState<Screen>(previewId === "first-session-nudge" && recommended ? "session" : "welcome");

  async function track(eventName: string, extra?: Record<string, unknown>) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        workspaceId: "mobile-demo",
        anonymousId: person.userId ? undefined : person.anonymousId,
        userId: person.userId,
        platform: "mobile",
        source: "tester",
        properties: { previewId, recommended, ...extra },
        context: { screenName: screen, appVersion: "3.4.1", deviceType: "iphone" },
      }),
    });
    onEvent(eventName);
  }

  const note = useMemo(() => {
    if (recommended && previewId === "delayed-paywall") return "Paywall waits until after a completed session.";
    if (recommended && previewId === "first-session-nudge") return "First practice starts immediately.";
    if (recommended && previewId === "permission-fallback") return "Denied notifications still get an in-app reminder.";
    return "Original Aurelia journey";
  }, [previewId, recommended]);

  const showPaywallEarly = !recommended && previewId === "delayed-paywall";

  return (
    <div className="flex justify-center">
      <div className="w-[320px] rounded-[2.4rem] border-8 border-slate-900 bg-slate-900 p-2 shadow-xl">
        <div className="overflow-hidden rounded-[1.8rem] bg-stone-50">
          <div className="bg-stone-900 py-2 text-center text-[10px] text-stone-300">{note}</div>
          <div className="min-h-[520px] px-5 py-6">
            {screen === "welcome" && (
              <PhoneBlock title="Aurelia" body="A calmer ten-minute practice for sleep, focus, or stress.">
                <Button onClick={() => { void track(MOBILE_EVENTS.appOpened); void track(MOBILE_EVENTS.onboardingViewed); setScreen("goal"); }}>Begin</Button>
                <Button variant="ghost" onClick={() => { void track(MOBILE_EVENTS.onboardingSkipped); setScreen("home"); }}>Skip</Button>
              </PhoneBlock>
            )}
            {screen === "goal" && (
              <PhoneBlock title="What do you need tonight?" body="Pick one. You can change this later.">
                {["sleep", "focus", "stress"].map((goal) => (
                  <Button key={goal} variant="outline" onClick={() => { void track(MOBILE_EVENTS.goalSelected, { goal }); setScreen(recommended && previewId === "first-session-nudge" ? "session" : "permissions"); }}>
                    {goal}
                  </Button>
                ))}
              </PhoneBlock>
            )}
            {screen === "permissions" && (
              <PhoneBlock title="Gentle reminders?" body={recommended && previewId === "permission-fallback" ? "If you decline, we will keep an in-app reminder instead." : "Aurelia can nudge you tomorrow. You can say no."}>
                <Button onClick={() => { void track(MOBILE_EVENTS.permissionRequested); void track(MOBILE_EVENTS.permissionGranted); setScreen(showPaywallEarly ? "paywall" : "home"); }}>Allow</Button>
                <Button variant="outline" onClick={() => { void track(MOBILE_EVENTS.permissionRequested); void track(MOBILE_EVENTS.permissionDenied); setScreen(recommended && previewId === "permission-fallback" ? "reminder" : "home"); }}>Not now</Button>
              </PhoneBlock>
            )}
            {screen === "home" && (
              <PhoneBlock title="Tonight’s practice" body="A 60-second breathing session. Completing this is the core action.">
                <Button onClick={() => { void track(MOBILE_EVENTS.coreActionStarted); setScreen("session"); }}>Start session</Button>
                {!recommended && <Button variant="outline" onClick={() => setScreen("paywall")}>See Aurelia+</Button>}
              </PhoneBlock>
            )}
            {screen === "session" && (
              <PhoneBlock title="Breathe with the ring" body="In for four, out for six. Stay until the ring completes.">
                <Button onClick={() => { void track(MOBILE_EVENTS.coreActionCompleted, { durationSec: 60 }); setScreen("result"); }}>Complete session</Button>
                <Button variant="ghost" onClick={() => { void track(MOBILE_EVENTS.coreActionAbandoned); }}>Abandon</Button>
              </PhoneBlock>
            )}
            {screen === "result" && (
              <PhoneBlock title="You showed up" body="That is the habit. Tomorrow’s return is the primary goal.">
                <Button onClick={() => { void track(MOBILE_EVENTS.featureDiscovered, { feature: "streak" }); setScreen("reminder"); }}>See streak</Button>
                {recommended && previewId === "delayed-paywall" && (
                  <Button variant="outline" onClick={() => setScreen("paywall")}>Continue</Button>
                )}
              </PhoneBlock>
            )}
            {screen === "reminder" && (
              <PhoneBlock title="Same time tomorrow?" body="An in-app reminder does not need system permission.">
                <Button onClick={() => { void track(MOBILE_EVENTS.reminderConfigured); void track(MOBILE_EVENTS.returnedNextDay); setScreen("paywall"); }}>Remind me</Button>
              </PhoneBlock>
            )}
            {screen === "paywall" && (
              <PhoneBlock title="Aurelia+" body={recommended ? "You already completed a session. A 7-day trial unlocks evening wind-downs." : "Unlock the full library before your first session."}>
                <Button onClick={() => { void track(MOBILE_EVENTS.paywallViewed); void track(MOBILE_EVENTS.trialStarted); }}>Start trial</Button>
                <Button variant="outline" onClick={() => { void track(MOBILE_EVENTS.paywallViewed); void track(MOBILE_EVENTS.paywallDismissed); }}>Dismiss</Button>
                <Button variant="ghost" onClick={() => { void track(MOBILE_EVENTS.subscriptionPurchased); }}>Purchase</Button>
              </PhoneBlock>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneBlock({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">Aurelia</div>
      <h2 className="mt-4 font-serif text-3xl text-stone-900">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">{body}</p>
      <div className="mt-8 flex flex-col gap-2">{children}</div>
    </div>
  );
}
