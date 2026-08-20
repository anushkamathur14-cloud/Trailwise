"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WEB_EVENTS } from "@/lib/workspace";
import type { PreviewId } from "@/lib/studio/variants";
import type { ViewportMode } from "@/components/studio/device-frame";
import { DeviceFrame } from "@/components/studio/device-frame";
import { HeatmapOverlay } from "@/components/studio/heatmap-overlay";

type Person = { id: string; anonymousId: string | null; userId: string | null };
const SCREENS = ["landing", "pricing", "signup", "onboarding", "wearable", "plan", "invite", "upgrade"] as const;
type Screen = (typeof SCREENS)[number];
export type HeatPoint = { x: number; y: number; screen: string };

export function ForgePreview({
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
  const [screen, setScreen] = useState<Screen>(previewId === "simplified-signup" ? "pricing" : "landing");
  const [error, setError] = useState(previewId === "error-recovery");
  const [heat, setHeat] = useState<HeatPoint[]>([]);
  const [email, setEmail] = useState("");
  const frameRef = useRef<HTMLDivElement>(null);
  const compact = viewport !== "desktop";

  useEffect(() => {
    void track(WEB_EVENTS.landingViewed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        platform: "web",
        source: "tester",
        properties: { previewId, recommended, viewport, ...extra },
        context: { pageTitle: screen, pageUrl: `https://aurelia.example/${screen}`, deviceType: viewport === "mobile" ? "ios" : "desktop" },
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
    // Slight scatter so overlapping attention forms organic blobs (classic heatmap look)
    const scatter: HeatPoint[] = [
      { x, y, screen },
      { x: clamp01(x + (Math.random() - 0.5) * 0.04), y: clamp01(y + (Math.random() - 0.5) * 0.04), screen },
      { x: clamp01(x + (Math.random() - 0.5) * 0.06), y: clamp01(y + (Math.random() - 0.5) * 0.05), screen },
    ];
    const next = [...heat, ...scatter];
    setHeat(next);
    void track("ui_click", { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), screen, heatmap: true, viewport });
  }

  const copy = useMemo(() => {
    if (recommended && previewId === "earlier-integration") {
      return { cta: "Connect Apple Watch first", note: "Wearable before empty plan" };
    }
    if (recommended && previewId === "invite-prompt") {
      return { cta: "Invite a friend now", note: "Invite after plan created" };
    }
    if (recommended && previewId === "error-recovery") {
      return { cta: "Retry with demo data", note: "Recovery path enabled" };
    }
    if (recommended && previewId === "simplified-signup") {
      return { cta: "Start a guided trial", note: "Calmer pricing CTA" };
    }
    return { cta: "Continue", note: "Baseline Aurelia web" };
  }, [previewId, recommended]);

  return (
    <DeviceFrame viewport={viewport} urlLabel={`aurelia.example/${screen} · ${copy.note}`}>
      <div
        ref={frameRef}
        className="relative min-h-[520px] bg-gradient-to-br from-[#f7f3ec] via-[#f3eee4] to-[#ebe3d6]"
        onClickCapture={recordHeat}
      >
        {heatmapEnabled && (
          <HeatmapOverlay
            enabled={heatmapEnabled}
            points={heat.filter((point) => point.screen === screen).map(({ x, y }) => ({ x, y }))}
          />
        )}

        <nav className={`relative z-10 flex items-center justify-between border-b border-[#e0d6c6] bg-[#faf7f1]/px-4 ${compact ? "px-4 py-3" : "px-8 py-4"}`}>
          <button
            className="font-serif text-xl text-[#2c2822]"
            onClick={() => setScreen("landing")}
          >
            Aurelia
          </button>
          {!compact && (
            <div className="flex gap-6 text-sm text-[#6b6358]">
              <button onClick={() => { setScreen("pricing"); void track(WEB_EVENTS.pricingViewed); }}>Pricing</button>
              <button onClick={() => setScreen("onboarding")}>Practice</button>
              <button onClick={() => setScreen("upgrade")}>Aurelia+</button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => { void track(WEB_EVENTS.signupStarted); setScreen("signup"); }}>
            Sign in
          </Button>
        </nav>

        <div className={`relative z-10 ${compact ? "p-4" : "p-8"}`}>
          {screen === "landing" && (
            <div className={compact ? "space-y-6" : "grid gap-10 lg:grid-cols-[1.2fr_0.8fr]"}>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9a7b4f]">Sleep · Focus · Stress</p>
                <h1 className={`mt-3 font-serif tracking-tight text-[#2c2822] ${compact ? "text-3xl" : "text-5xl leading-[1.05]"}`}>
                  A calmer practice for tonight
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#6b6358]">
                  Aurelia on the web: land, choose a plan, create your practice, invite a friend — that path is activation.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => { void track(WEB_EVENTS.landingViewed); setScreen("pricing"); }}>See pricing</Button>
                  <Button variant="outline" onClick={() => { void track(WEB_EVENTS.signupStarted); setScreen("signup"); }}>Start free</Button>
                </div>
              </div>
              {!compact && (
                <div className="rounded-2xl border border-[#e0d6c6] bg-white/80 p-5 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-[#a89f8f]">Tonight’s path</div>
                  <div className="mt-4 space-y-3">
                    {["Connect wearable", "Create practice plan", "Invite a friend"].map((step) => (
                      <div key={step} className="rounded-lg bg-[#f7f3ec] px-3 py-3 text-sm text-[#44403c]">{step}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {screen === "pricing" && (
            <div>
              <h2 className="font-serif text-3xl text-[#2c2822]">Choose Aurelia+</h2>
              <p className="mt-2 text-sm text-[#6b6358]">
                {recommended ? "Try with guided setup — card not required." : "Compare plans before you commit."}
              </p>
              <div className={`mt-6 grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-3"}`}>
                {[
                  { name: "Starter", price: "$0", detail: "Core practices" },
                  { name: "Plus", price: "$12", detail: "per month" },
                  { name: "Family", price: "$18", detail: "up to 4 people" },
                ].map((plan) => (
                  <button
                    key={plan.name}
                    className="rounded-xl border border-[#e0d6c6] bg-white p-4 text-left hover:border-[#9a7b4f]"
                    onClick={() => {
                      void track(WEB_EVENTS.pricingViewed, { plan: plan.name });
                      void track(WEB_EVENTS.signupStarted);
                      setScreen("signup");
                    }}
                  >
                    <div className="text-sm font-medium">{plan.name}</div>
                    <div className="mt-2 text-2xl font-semibold">{plan.price}</div>
                    <div className="mt-1 text-xs text-[#78716c]">{plan.detail}</div>
                    <div className="mt-4 text-sm text-[#9a7b4f]">{copy.cta} →</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === "signup" && (
            <FormShell title="Create your Aurelia account" subtitle="Email only. Passwords never reach Trailwise.">
              <label className="block text-xs text-[#78716c]">
                Email
                <input
                  className="mt-1 w-full rounded-md border border-[#e0d6c6] bg-white px-3 py-2 text-sm"
                  value={email}
                  placeholder="you@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    void track(WEB_EVENTS.accountCreated, { emailDomain: email.split("@")[1] ?? "unknown" });
                    setScreen(recommended && previewId === "earlier-integration" ? "wearable" : "onboarding");
                  }}
                >
                  Create account
                </Button>
                <Button variant="outline" onClick={() => void track(WEB_EVENTS.signupAbandoned)}>Abandon form</Button>
              </div>
            </FormShell>
          )}

          {screen === "onboarding" && (
            <FormShell title="Welcome to Aurelia" subtitle="Three steps: connect → plan → invite.">
              <ol className="mb-4 space-y-2 text-sm text-[#6b6358]">
                <li>1. Connect a wearable or calendar</li>
                <li>2. Name your first practice plan</li>
                <li>3. Invite a friend (activation)</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { void track(WEB_EVENTS.onboardingStarted); setScreen("wearable"); }}>Start onboarding</Button>
                <Button variant="outline" onClick={() => void track(WEB_EVENTS.onboardingAbandoned)}>Skip for now</Button>
              </div>
            </FormShell>
          )}

          {screen === "wearable" && (
            <FormShell
              title={error && !recommended ? "Wearable connection failed" : "Connect your stack"}
              subtitle={recommended && error ? "Retry with demo data, or skip to a sample plan." : "Sync sleep and heart-rate into your practice."}
            >
              <div className={`mb-4 grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-3"}`}>
                {["Apple Watch", "Oura", "Google Fit"].map((provider) => (
                  <div key={provider} className="rounded-lg border border-[#e0d6c6] bg-white px-3 py-3 text-sm">{provider}</div>
                ))}
              </div>
              {error && !recommended ? (
                <Button variant="destructive" onClick={() => { void track(WEB_EVENTS.integrationError); void track(WEB_EVENTS.onboardingAbandoned); }}>
                  I give up
                </Button>
              ) : (
                <Button onClick={() => { void track(WEB_EVENTS.integrationConnected, { provider: "apple_watch" }); setScreen("plan"); }}>
                  {copy.cta}
                </Button>
              )}
              <Button className="ml-2" variant="outline" onClick={() => { setError(true); void track(WEB_EVENTS.integrationError); }}>
                Simulate error
              </Button>
            </FormShell>
          )}

          {screen === "plan" && (
            <FormShell
              title="Name your practice plan"
              subtitle={recommended && previewId === "invite-prompt" ? "You’ll be asked to invite a friend next — watch this conversion window." : "An empty plan is the most common drop-off."}
            >
              <input className="mb-4 w-full rounded-md border border-[#e0d6c6] bg-white px-3 py-2 text-sm" defaultValue="Evening wind-down" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { void track(WEB_EVENTS.projectCreated); setScreen("invite"); }}>Create plan</Button>
                <Button variant="outline" onClick={() => void track(WEB_EVENTS.projectAbandoned)}>Leave empty</Button>
              </div>
            </FormShell>
          )}

          {screen === "invite" && (
            <FormShell
              title="Invite a friend"
              subtitle={recommended ? "Activation = plan + invite. This is the primary conversion window." : "You can do this later in settings."}
            >
              <input className="mb-4 w-full rounded-md border border-[#e0d6c6] bg-white px-3 py-2 text-sm" placeholder="friend@email.com" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { void track(WEB_EVENTS.teammateInvited); setScreen("upgrade"); }}>Send invite</Button>
                <Button variant="ghost" onClick={() => setScreen("upgrade")}>Skip</Button>
              </div>
            </FormShell>
          )}

          {screen === "upgrade" && (
            <FormShell title="Upgrade to Aurelia+" subtitle="Paid conversion is the secondary goal — monetization window.">
              <div className="mb-4 rounded-lg bg-[#2c2822] p-4 text-white">
                <div className="text-sm text-white/70">Aurelia+</div>
                <div className="mt-1 text-3xl font-semibold">$12 / month</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { void track(WEB_EVENTS.upgradeViewed); void track(WEB_EVENTS.subscriptionStarted); }}>Start subscription</Button>
                <Button variant="outline" onClick={() => void track(WEB_EVENTS.upgradeViewed)}>View upgrade only</Button>
              </div>
            </FormShell>
          )}
        </div>

        <div className="relative z-10 flex gap-1 overflow-x-auto border-t border-[#e0d6c6] bg-white/80 px-2 py-2 text-[11px]">
          {SCREENS.map((item) => (
            <button
              key={item}
              className={`rounded px-2 py-1 ${screen === item ? "bg-[#2c2822] text-white" : "text-[#8a8073]"}`}
              onClick={() => setScreen(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </DeviceFrame>
  );
}

function FormShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[#e0d6c6] bg-white/90 p-6 shadow-sm">
      <h2 className="font-serif text-2xl text-[#2c2822]">{title}</h2>
      <p className="mt-2 text-sm text-[#6b6358]">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
