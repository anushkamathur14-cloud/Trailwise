"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/components/workspace-provider";
import { ForgePreview } from "@/components/studio/forge-preview";
import { AureliaPreview } from "@/components/studio/aurelia-preview";
import { DeviceToolbar, type ViewportMode } from "@/components/studio/device-frame";
import { VARIANTS, type PreviewId } from "@/lib/studio/variants";
import { hashPii } from "@/lib/privacy/hash";
import { recommendFromHeatmapSession, type HeatLinkedRecommendation } from "@/lib/recommendations/heatmap";
import { useApi } from "@/hooks/use-api";
import { formatPercent } from "@/lib/utils";

type Person = {
  id: string;
  anonymousId: string | null;
  userId: string | null;
  displayName: string | null;
};

type HeatPoint = { x: number; y: number; screen: string };
type Ecosystem = "all" | "ios" | "android";
type Behavior = {
  ecosystem: string;
  totalEvents: number;
  topEvents: Array<{ name: string; count: number; share: number }>;
  topScreens: Array<{ name: string; count: number; share: number }>;
  environment: string;
};

const WEB_PREVIEWS: PreviewId[] = ["original", "earlier-integration", "invite-prompt", "error-recovery", "simplified-signup"];
const MOBILE_PREVIEWS: PreviewId[] = ["original", "delayed-paywall", "first-session-nudge", "permission-fallback"];

const CONVERSION_WINDOWS: Record<string, string> = {
  teammate_invited: "Activation window — plan + invite",
  subscription_started: "Monetization window — paid upgrade",
  session_completed: "Core engagement window — first value",
  returned_next_day: "Retention window — day-1 return",
  trial_started: "Monetization window — trial start",
  account_created: "Acquisition → activation handoff",
  integration_connected: "Activation precursor — wearable connected",
  signup_abandoned: "Drop-off window — signup friction",
  paywall_dismissed: "Monetization rejection",
};

export default function StudioPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Tester Mode…</p>}>
      <StudioInner />
    </Suspense>
  );
}

function StudioInner() {
  const params = useSearchParams();
  const { workspaceId, workspace } = useWorkspace();
  const allowed = workspace.platform === "web" ? WEB_PREVIEWS : MOBILE_PREVIEWS;
  const initialPreview = (params.get("preview") as PreviewId) || "original";
  const [mode, setMode] = useState<"original" | "recommended">("recommended");
  const [preview, setPreview] = useState<PreviewId>(allowed.includes(initialPreview) ? initialPreview : "original");
  const [person, setPerson] = useState<Person | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);
  const [viewport, setViewport] = useState<ViewportMode>(workspace.platform === "mobile" ? "mobile" : "desktop");
  const [ecosystem, setEcosystem] = useState<Ecosystem>("all");
  const [heat, setHeat] = useState<HeatPoint[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const variant = VARIANTS[preview] ?? VARIANTS.original;

  const { data: historic } = useApi<Behavior>(
    `/api/analytics/behavior?ecosystem=${ecosystem}`,
    `${workspaceId}-${ecosystem}-${heatmapEnabled}`,
  );

  useEffect(() => {
    if (!allowed.includes(preview)) setPreview("original");
  }, [workspaceId, allowed, preview]);

  useEffect(() => {
    setViewport(workspace.platform === "mobile" ? "mobile" : "desktop");
  }, [workspace.platform]);

  useEffect(() => {
    const personId = params.get("personId");
    if (!personId) return;
    fetch(`/api/users/${personId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load person");
        setPerson(json.person);
      })
      .catch((error: Error) => setStatus(error.message));
  }, [params]);

  async function createTester() {
    setStatus(null);
    const response = await fetch(`/api/tester?workspace=${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "new", ecosystem }),
    });
    const json = await response.json();
    if (!response.ok || !json.person) {
      setStatus(json.error || "Could not create tester. Check /api/health.");
      return;
    }
    setPerson(json.person);
    setLog((current) => [`Created tester ${hashPii(json.person.anonymousId)}`, ...current]);
    setHeat([]);
  }

  async function identifyTester() {
    if (!person) return;
    const userId = person.userId || `tester_user_${person.id.slice(-6)}`;
    const response = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        userId,
        anonymousId: person.anonymousId,
        traits: { name: person.displayName, tester: true },
        platform: workspace.platform,
        context: { deviceType: ecosystem === "android" ? "android" : ecosystem === "ios" ? "ios" : undefined },
      }),
    });
    if (!response.ok) {
      setStatus("Identify failed");
      return;
    }
    setPerson({ ...person, userId });
    setLog((current) => [`Identified ${hashPii(person.anonymousId)} → ${hashPii(userId)}`, ...current]);
  }

  const onHeatChange = useCallback((points: HeatPoint[]) => setHeat(points), []);

  const testerBars = useMemo(() => {
    const byEvent = new Map<string, number>();
    for (const entry of log) {
      if (entry.includes("(failed)") || entry.startsWith("Created") || entry.startsWith("Identified") || entry.startsWith("Cleared")) continue;
      const name = entry.replace("Injected ", "").trim();
      if (!name || name.includes(" ")) continue;
      byEvent.set(name, (byEvent.get(name) ?? 0) + 1);
    }
    const byScreen = new Map<string, number>();
    for (const point of heat) byScreen.set(point.screen, (byScreen.get(point.screen) ?? 0) + 1);
    const eventTotal = [...byEvent.values()].reduce((a, b) => a + b, 0) || 1;
    const screenTotal = [...byScreen.values()].reduce((a, b) => a + b, 0) || 1;
    const events = [...byEvent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, share: count / eventTotal }));
    const screens = [...byScreen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, share: count / screenTotal }));
    return {
      events,
      screens,
      clicks: heat.length,
      windows: [
        ...new Set(
          log
            .map((entry) => {
              const key = Object.keys(CONVERSION_WINDOWS).find((name) => entry.includes(name));
              return key ? CONVERSION_WINDOWS[key] : null;
            })
            .filter(Boolean) as string[],
        ),
      ].slice(0, 4),
    };
  }, [heat, log]);

  const heatRec = useMemo((): HeatLinkedRecommendation | null => {
    if (!person || (testerBars.screens.length === 0 && testerBars.events.length === 0)) return null;
    return recommendFromHeatmapSession({
      workspaceId,
      screens: testerBars.screens.map(({ name, count }) => ({ name, count })),
      events: testerBars.events.map((item) => item.name),
    });
  }, [person, testerBars, workspaceId]);

  function applyHeatRecommendation(rec: HeatLinkedRecommendation) {
    setPreview(rec.previewId);
    setMode("recommended");
  }

  function renderPreview() {
    if (!person) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <div>
            <h3 className="text-lg font-semibold">Launch an interactive Aurelia session</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Click through the {workspace.platform === "web" ? "website" : "app"} like a real user. With heatmap on, compare your session to historic {workspace.platform === "web" ? "web" : "app"} behaviour.
            </p>
          </div>
          <Button onClick={createTester}>Start Tester Mode</Button>
        </div>
      );
    }
    const recommended = mode === "recommended" && preview !== "original";
    if (workspace.platform === "web") {
      return (
        <ForgePreview
          person={person}
          recommended={recommended}
          previewId={preview}
          workspaceId={workspaceId}
          heatmapEnabled={heatmapEnabled}
          viewport={viewport}
          onEvent={(name) => setLog((c) => [name, ...c])}
          onHeatChange={onHeatChange}
        />
      );
    }
    return (
      <AureliaPreview
        person={person}
        recommended={recommended}
        previewId={preview}
        workspaceId={workspaceId}
        heatmapEnabled={heatmapEnabled}
        viewport={viewport}
        onEvent={(name) => setLog((c) => [name, ...c])}
        onHeatChange={onHeatChange}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Tester Mode"
        description={`Interactive Aurelia ${workspace.platform === "web" ? "website" : "app"}. Observe engagement heat, conversion windows, and how this session compares to historic tracking.`}
      />
      {status && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{status}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={createTester}>{person ? "New tester" : "Start Tester Mode"}</Button>
        <Button variant="outline" onClick={identifyTester} disabled={!person}>Identify tester</Button>
        <Button
          variant="outline"
          disabled={!person}
          onClick={async () => {
            if (!person) return;
            await fetch(`/api/tester?workspace=${workspaceId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "clear", personId: person.id }),
            });
            setLog((current) => ["Cleared tester session", ...current]);
            setHeat([]);
          }}
        >
          Clear session
        </Button>
        <Button variant={mode === "original" ? "default" : "outline"} onClick={() => setMode("original")}>Original</Button>
        <Button variant={mode === "recommended" ? "default" : "outline"} onClick={() => setMode("recommended")}>Recommended</Button>
        <select className="h-9 rounded-md border px-2 text-sm" value={preview} onChange={(e) => setPreview(e.target.value as PreviewId)}>
          {allowed.map((id) => (
            <option key={id} value={id}>{VARIANTS[id].label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Switch checked={heatmapEnabled} onCheckedChange={setHeatmapEnabled} id="heatmap" />
          <Label htmlFor="heatmap">Heatmap</Label>
        </div>
        {person && <Badge variant="secondary">{hashPii(person.userId || person.anonymousId)}</Badge>}
        {person && (
          <Link className="text-sm text-primary hover:underline" href={`/users/${person.id}`}>Profile</Link>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ecosystem</span>
        {(["all", "ios", "android"] as Ecosystem[]).map((id) => (
          <Button key={id} size="sm" variant={ecosystem === id ? "default" : "outline"} onClick={() => setEcosystem(id)}>
            {id === "all" ? "All" : id === "ios" ? "iOS" : "Android"}
          </Button>
        ))}
      </div>

      <div className="mb-4">
        <DeviceToolbar
          viewport={viewport}
          onChange={setViewport}
          platformLabel={workspace.platform === "web" ? "website" : "app"}
        />
      </div>

      {heatmapEnabled && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tester session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Live behaviour from this Tester Mode run ({testerBars.clicks} heatmap clicks).
              </p>
              <CompareBars title="Screens tapped" rows={testerBars.screens} empty="Click the product preview to build a heatmap." />
              <CompareBars title="Events emitted" rows={testerBars.events} empty="Interact to emit events." />
              {testerBars.windows.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Conversion windows</div>
                  <ul className="mt-1 space-y-1">
                    {testerBars.windows.map((item) => (
                      <li key={item} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-900">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historic {historic?.environment ?? (workspace.platform === "web" ? "website" : "app")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Aggregated non-tester tracking
                {ecosystem !== "all" ? ` · ${ecosystem === "ios" ? "iOS" : "Android"}` : ""} · {historic?.totalEvents ?? 0} events.
              </p>
              <CompareBars title="Top screens / contexts" rows={historic?.topScreens ?? []} empty="No historic rows for this filter." />
              <CompareBars title="Top events" rows={historic?.topEvents ?? []} empty="No historic events for this filter." />
            </CardContent>
          </Card>
        </div>
      )}

      {heatRec && (
        <Card className="mb-4 border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-background">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Recommendation from this heatmap</CardTitle>
              <Badge>{heatRec.confidence} · linked to events</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto]">
            <div className="space-y-2 text-sm">
              <div className="font-medium">{heatRec.title}</div>
              <p>{heatRec.why}</p>
              <p className="font-medium text-emerald-900">{heatRec.action}</p>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <div className="uppercase tracking-wide text-muted-foreground">Hotspot screens</div>
                <p className="mt-1">{heatRec.hotspotScreens.join(" · ") || "—"}</p>
              </div>
              <div>
                <div className="uppercase tracking-wide text-muted-foreground">Trigger events</div>
                <p className="mt-1">{heatRec.triggerEvents.map((e) => e.replace(/_/g, " ")).join(" · ") || "ui clicks"}</p>
              </div>
              <div>
                <div className="uppercase tracking-wide text-muted-foreground">Next events to drive</div>
                <p className="mt-1">{heatRec.nextEvents.map((e) => e.replace(/_/g, " ")).join(" → ")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => applyHeatRecommendation(heatRec)}>Apply in preview</Button>
              <Button asChild variant="outline">
                <Link href={person ? `/recommendations?personId=${person.id}` : "/recommendations"}>
                  Open recommendations
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">{renderPreview()}</div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Variant under test</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-medium">{variant.label}</div>
              <p className="text-muted-foreground">{variant.hypothesis}</p>
              <p>Target: {variant.targetMetric}</p>
              <p>Guardrail: {variant.guardrail}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Event trail</CardTitle></CardHeader>
            <CardContent>
              <ul className="max-h-56 space-y-1 overflow-auto text-xs">
                {log.length === 0 ? (
                  <li className="text-muted-foreground">None yet — interact with Aurelia.</li>
                ) : (
                  log.map((item, index) => <li key={index}>{item}</li>)
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CompareBars({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ name: string; count: number; share: number }>;
  empty: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.name}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="truncate">{row.name.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{formatPercent(row.share)} · {row.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-rose-500/80" style={{ width: `${Math.max(4, row.share * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
