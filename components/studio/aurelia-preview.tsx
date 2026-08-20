"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MOBILE_EVENTS } from "@/lib/workspace";
import type { PreviewId } from "@/lib/studio/variants";
import type { ViewportMode } from "@/components/studio/device-frame";
import { DeviceFrame } from "@/components/studio/device-frame";
import { HeatmapOverlay } from "@/components/studio/heatmap-overlay";

type Person = { id: string; anonymousId: string | null; userId: string | null };
type Screen = "welcome" | "goal" | "permissions" | "home" | "session" | "result" | "reminder" | "paywall";
type HeatPoint = { x: number; y: number; screen: string };

const SCREENS: Screen[] = ["welcome", "goal", "permissions", "home", "session", "result", "reminder", "paywall"];

export function AureliaPreview({
  person,
  recommended,
  previewId,
  workspaceId,
  heatmapEnabled,
  viewport,
  onEvent,
  onHeatChange,
}: {
  person: Person;
  recommended: boolean;
  previewId: PreviewId;
  workspaceId: string;
  heatmapEnabled: boolean;
  viewport: ViewportMode;
  onEvent: (name: string) => void;
  onHeatChange?: (points: HeatPoint[]) => void;
}) {
  const [screen, setScreen] = useState<Screen>(previewId === "first-session-nudge" && recommended ? "session" : "welcome");
  const [heat, setHeat] = useState<HeatPoint[]>([]);
  const [breath, setBreath] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const wide = viewport === "desktop";

  useEffect(() => {
    onHeatChange?.(heat);
  }, [heat, onHeatChange]);

  async function track(eventName: string, extra?: Record<string, unknown>) {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        workspaceId,
        anonymousId: person.userId ? undefined : person.anonymousId,
        userId: person.userId,
        platform: "mobile",
        source: "tester",
        properties: { previewId, recommended, viewport, ...extra },
        context: { screenName: screen, appVersion: "3.4.1", deviceType: viewport === "desktop" ? "ios" : "ios" },
      }),
    });
    if (!response.ok) {
      onEvent(`${eventName} (failed)`);
      return;
    }
    onEvent(eventName);
  }

  function recordHeat(event: MouseEvent<HTMLDivElement>) {
    if (!heatmapEnabled || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const scatter: HeatPoint[] = [
      { x, y, screen },
      { x: Math.min(1, Math.max(0, x + (Math.random() - 0.5) * 0.04)), y: Math.min(1, Math.max(0, y + (Math.random() - 0.5) * 0.04)), screen },
      { x: Math.min(1, Math.max(0, x + (Math.random() - 0.5) * 0.06)), y: Math.min(1, Math.max(0, y + (Math.random() - 0.5) * 0.05)), screen },
    ];
    const next = [...heat, ...scatter];
    setHeat(next);
    void track("ui_click", { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), screen, heatmap: true, viewport });
  }

  const note = useMemo(() => {
    if (recommended && previewId === "delayed-paywall") return "Paywall after first value";
    if (recommended && previewId === "first-session-nudge") return "Immediate first practice";
    if (recommended && previewId === "permission-fallback") return "In-app reminder fallback";
    return "Baseline Aurelia";
  }, [previewId, recommended]);

  const showPaywallEarly = !recommended && previewId === "delayed-paywall";

  return (
    <DeviceFrame viewport={viewport} urlLabel={`aurelia.app · ${screen} · ${note}`}>
      <div
        ref={frameRef}
        className={`relative overflow-hidden ${wide ? "min-h-[560px] bg-gradient-to-br from-[#f5f0e8] via-[#efe8dc] to-[#e8dfd0]" : "min-h-[560px] bg-[#f7f3ec]"}`}
        onClickCapture={recordHeat}
      >
        {heatmapEnabled && (
          <HeatmapOverlay
            enabled={heatmapEnabled}
            points={heat.filter((point) => point.screen === screen).map(({ x, y }) => ({ x, y }))}
            radius={64}
          />
        )}

        <div className={`relative z-10 ${wide ? "mx-auto grid max-w-4xl gap-8 p-8 md:grid-cols-[1fr_1.1fr]" : "px-5 py-6"}`}>
          {wide && (
            <aside className="hidden rounded-3xl border border-[#ddd4c4] bg-white/70 p-6 md:block">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#a89f8f]">Tonight</div>
              <h3 className="mt-3 font-serif text-3xl text-[#2c2822]">Aurelia</h3>
              <p className="mt-3 text-sm leading-6 text-[#6b6358]">
                Desktop view of the same mobile journey — use it to compare where taps cluster vs phone layout.
              </p>
              <div className="mt-6 space-y-2 text-sm text-[#6b6358]">
                <div>Primary goal: day-1 return</div>
                <div>Core action: 60s session</div>
                <div>Monetization: trial after value</div>
              </div>
            </aside>
          )}

          <div className={wide ? "rounded-3xl border border-[#ddd4c4] bg-white/90 p-6 shadow-sm" : ""}>
            {screen === "welcome" && (
              <PhoneBlock title="Aurelia" body="A calmer ten-minute practice for sleep, focus, or stress.">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.appOpened);
                    void track(MOBILE_EVENTS.onboardingViewed);
                    setScreen("goal");
                  }}
                >
                  Begin
                </Button>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.onboardingSkipped);
                    setScreen("home");
                  }}
                >
                  Skip
                </Button>
              </PhoneBlock>
            )}

            {screen === "goal" && (
              <PhoneBlock title="What do you need tonight?" body="Pick one. You can change this later.">
                {["sleep", "focus", "stress"].map((goal) => (
                  <Button
                    key={goal}
                    variant="outline"
                    className="justify-start capitalize"
                    onClick={(e) => {
                      e.stopPropagation();
                      void track(MOBILE_EVENTS.goalSelected, { goal });
                      setScreen(recommended && previewId === "first-session-nudge" ? "session" : "permissions");
                    }}
                  >
                    {goal}
                  </Button>
                ))}
              </PhoneBlock>
            )}

            {screen === "permissions" && (
              <PhoneBlock
                title="Gentle reminders?"
                body={
                  recommended && previewId === "permission-fallback"
                    ? "If you decline, we keep an in-app reminder instead."
                    : "Aurelia can nudge you tomorrow. You can say no."
                }
              >
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.permissionRequested);
                    void track(MOBILE_EVENTS.permissionGranted);
                    setScreen(showPaywallEarly ? "paywall" : "home");
                  }}
                >
                  Allow
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.permissionRequested);
                    void track(MOBILE_EVENTS.permissionDenied);
                    setScreen(recommended && previewId === "permission-fallback" ? "reminder" : "home");
                  }}
                >
                  Not now
                </Button>
              </PhoneBlock>
            )}

            {screen === "home" && (
              <PhoneBlock title="Tonight’s practice" body="A 60-second breathing session. Completing this is the core engagement action.">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.coreActionStarted);
                    setScreen("session");
                  }}
                >
                  Start session
                </Button>
                {!recommended && (
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScreen("paywall");
                    }}
                  >
                    See Aurelia+
                  </Button>
                )}
              </PhoneBlock>
            )}

            {screen === "session" && (
              <PhoneBlock title="Breathe with the ring" body="In for four, out for six. Stay until the ring completes — this is the conversion window into habit.">
                <div className="mx-auto my-6 flex size-36 items-center justify-center rounded-full border-[6px] border-[#c4b7a0] bg-[#f7f3ec]">
                  <button
                    className="size-24 rounded-full bg-[#2c2822] text-sm text-white transition"
                    style={{ transform: `scale(${1 + breath * 0.08})` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBreath((v) => (v + 1) % 4);
                    }}
                  >
                    Breathe
                  </button>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.coreActionCompleted, { durationSec: 60 });
                    setScreen("result");
                  }}
                >
                  Complete session
                </Button>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.coreActionAbandoned);
                  }}
                >
                  Abandon
                </Button>
              </PhoneBlock>
            )}

            {screen === "result" && (
              <PhoneBlock title="You showed up" body="That is the habit. Tomorrow’s return is the primary goal.">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.featureDiscovered, { feature: "streak" });
                    setScreen("reminder");
                  }}
                >
                  See streak
                </Button>
                {recommended && previewId === "delayed-paywall" && (
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScreen("paywall");
                    }}
                  >
                    Continue
                  </Button>
                )}
              </PhoneBlock>
            )}

            {screen === "reminder" && (
              <PhoneBlock title="Same time tomorrow?" body="An in-app reminder does not need system permission — recovery path.">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.reminderConfigured);
                    void track(MOBILE_EVENTS.returnedNextDay);
                    setScreen("paywall");
                  }}
                >
                  Remind me
                </Button>
              </PhoneBlock>
            )}

            {screen === "paywall" && (
              <PhoneBlock
                title="Aurelia+"
                body={
                  recommended
                    ? "You already completed a session. A 7-day trial unlocks evening wind-downs."
                    : "Unlock the full library before your first session — early monetization window."
                }
              >
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.paywallViewed);
                    void track(MOBILE_EVENTS.trialStarted);
                  }}
                >
                  Start trial
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.paywallViewed);
                    void track(MOBILE_EVENTS.paywallDismissed);
                  }}
                >
                  Dismiss
                </Button>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(MOBILE_EVENTS.subscriptionPurchased);
                  }}
                >
                  Purchase
                </Button>
              </PhoneBlock>
            )}
          </div>
        </div>

        <div className="relative z-10 flex gap-1 overflow-x-auto border-t border-[#e6ddd0] bg-white/80 px-2 py-2 text-[11px]">
          {SCREENS.map((item) => (
            <button
              key={item}
              className={`rounded px-2 py-1 ${screen === item ? "bg-[#2c2822] text-white" : "text-[#8a8073]"}`}
              onClick={(e) => {
                e.stopPropagation();
                setScreen(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </DeviceFrame>
  );
}

function PhoneBlock({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-[#a89f8f]">Aurelia</div>
      <h2 className="mt-4 font-serif text-3xl text-[#2c2822]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#6b6358]">{body}</p>
      <div className="mt-8 flex flex-col gap-2">{children}</div>
    </div>
  );
}
