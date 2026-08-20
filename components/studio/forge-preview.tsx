"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WEB_EVENTS } from "@/lib/workspace";
import type { PreviewId } from "@/lib/studio/variants";
import type { ViewportMode } from "@/components/studio/device-frame";
import { DeviceFrame } from "@/components/studio/device-frame";

type Person = { id: string; anonymousId: string | null; userId: string | null };
const SCREENS = ["landing", "pricing", "signup", "onboarding", "integration", "project", "invite", "upgrade"] as const;
type Screen = (typeof SCREENS)[number];
type HeatPoint = { x: number; y: number; screen: string };

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
        context: { pageTitle: screen, pageUrl: `https://forge.example/${screen}`, deviceType: viewport },
      }),
    });
    if (!response.ok) {
      onEvent(`${eventName} (failed)`);
      return;
    }
    onEvent(eventName);
  }

  function onFrameClick(event: MouseEvent<HTMLDivElement>) {
    if (!heatmapEnabled || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const next = [...heat, { x, y, screen }];
    setHeat(next);
    void track("ui_click", { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), screen, heatmap: true, viewport });
  }

  const copy = useMemo(() => {
    if (recommended && previewId === "earlier-integration") {
      return { cta: "Connect GitHub first", note: "Integration before empty project" };
    }
    if (recommended && previewId === "invite-prompt") {
      return { cta: "Invite your teammate now", note: "Invite surfaced after project" };
    }
    if (recommended && previewId === "error-recovery") {
      return { cta: "Retry with sample data", note: "Recovery path enabled" };
    }
    if (recommended && previewId === "simplified-signup") {
      return { cta: "Start a guided trial", note: "Calmer pricing CTA" };
    }
    return { cta: "Continue", note: "Baseline Forge" };
  }, [previewId, recommended]);

  return (
    <DeviceFrame viewport={viewport} urlLabel={`forge.example/${screen} · ${copy.note}`}>
      <div ref={frameRef} className="relative min-h-[520px] bg-[#f6f4ef]" onClick={onFrameClick}>
        {heatmapEnabled &&
          heat
            .filter((point) => point.screen === screen)
            .map((point, index) => (
              <span
                key={index}
                className="pointer-events-none absolute z-30 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/30 ring-2 ring-rose-400/40"
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              />
            ))}

        <nav className={`relative z-10 flex items-center justify-between border-b border-[#e7e1d6] bg-[#faf8f4]/px-4 ${compact ? "px-4 py-3" : "px-8 py-4"}`}>
          <button
            className="font-[family-name:var(--font-geist-sans)] text-lg font-semibold tracking-tight text-[#1c1917]"
            onClick={(e) => {
              e.stopPropagation();
              setScreen("landing");
            }}
          >
            Forge
          </button>
          {!compact && (
            <div className="flex gap-6 text-sm text-[#57534e]">
              <button onClick={(e) => { e.stopPropagation(); setScreen("pricing"); void track(WEB_EVENTS.pricingViewed); }}>Pricing</button>
              <button onClick={(e) => { e.stopPropagation(); setScreen("onboarding"); }}>Product</button>
              <button onClick={(e) => { e.stopPropagation(); setScreen("upgrade"); }}>Team</button>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              void track(WEB_EVENTS.signupStarted);
              setScreen("signup");
            }}
          >
            Sign in
          </Button>
        </nav>

        <div className={`relative z-10 ${compact ? "p-4" : "p-8"}`}>
          {screen === "landing" && (
            <div className={compact ? "space-y-6" : "grid gap-10 lg:grid-cols-[1.2fr_0.8fr]"}>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#b45309]">Internal tools, shipped today</p>
                <h1 className={`mt-3 font-semibold tracking-tight text-[#1c1917] ${compact ? "text-3xl" : "text-5xl leading-[1.05]"}`}>
                  Build the admin apps your team already asks for
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#57534e]">
                  Forge connects your stack, scaffolds a first project, and gets a teammate in — that path is activation.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      void track(WEB_EVENTS.landingViewed);
                      setScreen("pricing");
                    }}
                  >
                    See pricing
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      void track(WEB_EVENTS.signupStarted);
                      setScreen("signup");
                    }}
                  >
                    Start free
                  </Button>
                </div>
              </div>
              {!compact && (
                <div className="rounded-2xl border border-[#e7e1d6] bg-white p-5 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-[#a8a29e]">Live workspace preview</div>
                  <div className="mt-4 space-y-3">
                    {["Connect GitHub", "Create project board", "Invite editor"].map((step) => (
                      <div key={step} className="rounded-lg bg-[#f6f4ef] px-3 py-3 text-sm text-[#44403c]">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {screen === "pricing" && (
            <div>
              <h2 className="text-2xl font-semibold text-[#1c1917]">Choose a plan</h2>
              <p className="mt-2 text-sm text-[#57534e]">
                {recommended ? "Try Forge with guided setup — card not required." : "Compare plans before you commit."}
              </p>
              <div className={`mt-6 grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-3"}`}>
                {[
                  { name: "Starter", price: "$0", detail: "1 editor" },
                  { name: "Team", price: "$24", detail: "per editor / mo" },
                  { name: "Business", price: "$49", detail: "SSO + audit" },
                ].map((plan) => (
                  <button
                    key={plan.name}
                    className="rounded-xl border border-[#e7e1d6] bg-white p-4 text-left hover:border-[#b45309]"
                    onClick={(e) => {
                      e.stopPropagation();
                      void track(WEB_EVENTS.pricingViewed, { plan: plan.name });
                      void track(WEB_EVENTS.signupStarted);
                      setScreen("signup");
                    }}
                  >
                    <div className="text-sm font-medium">{plan.name}</div>
                    <div className="mt-2 text-2xl font-semibold">{plan.price}</div>
                    <div className="mt-1 text-xs text-[#78716c]">{plan.detail}</div>
                    <div className="mt-4 text-sm text-[#b45309]">{copy.cta} →</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === "signup" && (
            <FormShell title="Create your Forge account" subtitle="Work email only. Passwords never reach Trailwise.">
              <label className="block text-xs text-[#78716c]">
                Work email
                <input
                  className="mt-1 w-full rounded-md border border-[#e7e1d6] bg-white px-3 py-2 text-sm"
                  value={email}
                  placeholder="you@company.com"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.accountCreated, { emailDomain: email.split("@")[1] ?? "unknown" });
                    setScreen(recommended && previewId === "earlier-integration" ? "integration" : "onboarding");
                  }}
                >
                  Create account
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.signupAbandoned);
                  }}
                >
                  Abandon form
                </Button>
              </div>
            </FormShell>
          )}

          {screen === "onboarding" && (
            <FormShell title="Welcome to Forge" subtitle="Three steps: connect → create → invite.">
              <ol className="mb-4 space-y-2 text-sm text-[#57534e]">
                <li>1. Connect an integration</li>
                <li>2. Name your first project</li>
                <li>3. Invite a teammate (activation)</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.onboardingStarted);
                    setScreen("integration");
                  }}
                >
                  Start onboarding
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.onboardingAbandoned);
                  }}
                >
                  Skip for now
                </Button>
              </div>
            </FormShell>
          )}

          {screen === "integration" && (
            <FormShell
              title={error && !recommended ? "GitHub connection failed" : "Connect your stack"}
              subtitle={
                recommended && error
                  ? "Retry with sample repositories, or skip to a demo project."
                  : "Sync issues and PRs into your first board."
              }
            >
              <div className={`mb-4 grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-3"}`}>
                {["GitHub", "Slack", "HubSpot"].map((provider) => (
                  <div key={provider} className="rounded-lg border border-[#e7e1d6] bg-white px-3 py-3 text-sm">
                    {provider}
                  </div>
                ))}
              </div>
              {error && !recommended ? (
                <Button
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.integrationError);
                    void track(WEB_EVENTS.onboardingAbandoned);
                  }}
                >
                  I give up
                </Button>
              ) : (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.integrationConnected, { provider: "github" });
                    setScreen("project");
                  }}
                >
                  {copy.cta}
                </Button>
              )}
              <Button
                className="ml-2"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setError(true);
                  void track(WEB_EVENTS.integrationError);
                }}
              >
                Simulate error
              </Button>
            </FormShell>
          )}

          {screen === "project" && (
            <FormShell
              title="Name your first project"
              subtitle={
                recommended && previewId === "invite-prompt"
                  ? "You will be asked to invite a teammate next — watch this conversion window."
                  : "An empty project is the most common drop-off."
              }
            >
              <input
                className="mb-4 w-full rounded-md border border-[#e7e1d6] bg-white px-3 py-2 text-sm"
                defaultValue="Customer ops board"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.projectCreated);
                    setScreen("invite");
                  }}
                >
                  Create project
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.projectAbandoned);
                  }}
                >
                  Leave empty
                </Button>
              </div>
            </FormShell>
          )}

          {screen === "invite" && (
            <FormShell
              title="Invite a teammate"
              subtitle={recommended ? "Activation = project + invite. This is the primary conversion window." : "You can do this later in settings."}
            >
              <input
                className="mb-4 w-full rounded-md border border-[#e7e1d6] bg-white px-3 py-2 text-sm"
                placeholder="teammate@company.com"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.teammateInvited);
                    setScreen("upgrade");
                  }}
                >
                  Send invite
                </Button>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScreen("upgrade");
                  }}
                >
                  Skip
                </Button>
              </div>
            </FormShell>
          )}

          {screen === "upgrade" && (
            <FormShell title="Upgrade to Team" subtitle="Paid conversion is the secondary goal — monetization window.">
              <div className="mb-4 rounded-lg bg-[#1c1917] p-4 text-white">
                <div className="text-sm text-white/70">Team plan</div>
                <div className="mt-1 text-3xl font-semibold">$24 / editor</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.upgradeViewed);
                    void track(WEB_EVENTS.subscriptionStarted);
                  }}
                >
                  Start subscription
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void track(WEB_EVENTS.upgradeViewed);
                  }}
                >
                  View upgrade only
                </Button>
              </div>
            </FormShell>
          )}
        </div>

        <div className="relative z-10 flex gap-1 overflow-x-auto border-t border-[#e7e1d6] bg-white/80 px-2 py-2 text-[11px] backdrop-blur">
          {SCREENS.map((item) => (
            <button
              key={item}
              className={`rounded px-2 py-1 ${screen === item ? "bg-[#1c1917] text-white" : "text-[#78716c]"}`}
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

function FormShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[#e7e1d6] bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-[#1c1917]">{title}</h2>
      <p className="mt-2 text-sm text-[#57534e]">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
