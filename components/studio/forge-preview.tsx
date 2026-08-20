"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WEB_EVENTS } from "@/lib/workspace";
import type { PreviewId } from "@/lib/studio/variants";

type Person = { id: string; anonymousId: string | null; userId: string | null };

const SCREENS = ["landing", "pricing", "signup", "onboarding", "integration", "project", "invite", "upgrade"] as const;
type Screen = (typeof SCREENS)[number];

export function ForgePreview({
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
  const [screen, setScreen] = useState<Screen>(previewId === "simplified-signup" ? "pricing" : "landing");
  const [error, setError] = useState(previewId === "error-recovery");

  async function track(eventName: string, extra?: Record<string, unknown>) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        workspaceId: "web-demo",
        anonymousId: person.userId ? undefined : person.anonymousId,
        userId: person.userId,
        platform: "web",
        source: "tester",
        properties: { previewId, recommended, ...extra },
        context: { pageTitle: screen, pageUrl: `https://forge.example/${screen}` },
      }),
    });
    onEvent(eventName);
  }

  const copy = useMemo(() => {
    if (recommended && previewId === "earlier-integration") {
      return { cta: "Connect GitHub first", note: "Recommended: integration help moved before the empty project." };
    }
    if (recommended && previewId === "invite-prompt") {
      return { cta: "Invite your teammate now", note: "Recommended: invite is no longer buried in settings." };
    }
    if (recommended && previewId === "error-recovery") {
      return { cta: "Retry with sample data", note: "Recommended: recovery instead of a dead end." };
    }
    if (recommended && previewId === "simplified-signup") {
      return { cta: "Start a guided trial", note: "Recommended: calmer path off pricing." };
    }
    return { cta: "Continue", note: "Original Forge journey" };
  }, [previewId, recommended]);

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-inner">
      <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-slate-500">
        <span>forge.example</span>
        <span>{copy.note}</span>
      </div>
      <div className="min-h-[420px] bg-slate-50 p-6">
        {screen === "landing" && (
          <ScreenBlock title="Forge" subtitle="Ship internal tools this afternoon.">
            <Button onClick={() => { void track(WEB_EVENTS.landingViewed); setScreen("pricing"); }}>See pricing</Button>
            <Button variant="outline" onClick={() => { void track(WEB_EVENTS.signupStarted); setScreen("signup"); }}>Start free</Button>
          </ScreenBlock>
        )}
        {screen === "pricing" && (
          <ScreenBlock title="Team plan · $24 / editor" subtitle={recommended ? "Try Forge with a guided setup — no card yet." : "Compare plans before you commit."}>
            <Button onClick={() => { void track(WEB_EVENTS.pricingViewed); void track(WEB_EVENTS.signupStarted); setScreen("signup"); }}>{copy.cta}</Button>
            <Button variant="ghost" onClick={() => { void track(WEB_EVENTS.pricingViewed); }}>View pricing again</Button>
          </ScreenBlock>
        )}
        {screen === "signup" && (
          <ScreenBlock title="Create your Forge account" subtitle="Work email only. Passwords are never sent to Trailwise.">
            <Button onClick={() => { void track(WEB_EVENTS.accountCreated); setScreen(recommended && previewId === "earlier-integration" ? "integration" : "onboarding"); }}>Create account</Button>
            <Button variant="outline" onClick={() => { void track(WEB_EVENTS.signupAbandoned); }}>Abandon form</Button>
          </ScreenBlock>
        )}
        {screen === "onboarding" && (
          <ScreenBlock title="Welcome to Forge" subtitle="Three steps: connect, create, invite.">
            <Button onClick={() => { void track(WEB_EVENTS.onboardingStarted); setScreen("integration"); }}>Start onboarding</Button>
            <Button variant="outline" onClick={() => { void track(WEB_EVENTS.onboardingAbandoned); }}>Skip for now</Button>
          </ScreenBlock>
        )}
        {screen === "integration" && (
          <ScreenBlock
            title={error && !recommended ? "GitHub connection failed" : "Connect GitHub"}
            subtitle={recommended && error ? "Retry with sample repositories, or skip to a demo project." : "Sync issues and pull requests into your first board."}
          >
            {error && !recommended ? (
              <Button variant="destructive" onClick={() => { void track(WEB_EVENTS.integrationError); void track(WEB_EVENTS.onboardingAbandoned); }}>
                I give up
              </Button>
            ) : (
              <Button onClick={() => { void track(WEB_EVENTS.integrationConnected, { provider: "github" }); setScreen("project"); }}>
                {copy.cta}
              </Button>
            )}
            <Button variant="outline" onClick={() => { setError(true); void track(WEB_EVENTS.integrationError); }}>Simulate error</Button>
          </ScreenBlock>
        )}
        {screen === "project" && (
          <ScreenBlock title="Name your first project" subtitle={recommended && previewId === "invite-prompt" ? "You will be asked to invite a teammate next." : "An empty project is the most common drop-off."}>
            <Button onClick={() => { void track(WEB_EVENTS.projectCreated); setScreen("invite"); }}>Create project</Button>
            <Button variant="outline" onClick={() => { void track(WEB_EVENTS.projectAbandoned); }}>Leave empty</Button>
          </ScreenBlock>
        )}
        {screen === "invite" && (
          <ScreenBlock title="Invite a teammate" subtitle={recommended ? "Activation is defined as project + invite." : "You can do this later in settings."}>
            <Button onClick={() => { void track(WEB_EVENTS.teammateInvited); setScreen("upgrade"); }}>Send invite</Button>
            <Button variant="ghost" onClick={() => setScreen("upgrade")}>Skip</Button>
          </ScreenBlock>
        )}
        {screen === "upgrade" && (
          <ScreenBlock title="Upgrade to Team" subtitle="Paid conversion is the secondary goal.">
            <Button onClick={() => { void track(WEB_EVENTS.upgradeViewed); void track(WEB_EVENTS.subscriptionStarted); }}>Start subscription</Button>
            <Button variant="outline" onClick={() => { void track(WEB_EVENTS.upgradeViewed); }}>View upgrade only</Button>
          </ScreenBlock>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto border-t bg-white px-2 py-2 text-[11px]">
        {SCREENS.map((item) => (
          <button key={item} className={`rounded px-2 py-1 ${screen === item ? "bg-slate-900 text-white" : "text-slate-500"}`} onClick={() => setScreen(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScreenBlock({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-indigo-600">Forge</div>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
