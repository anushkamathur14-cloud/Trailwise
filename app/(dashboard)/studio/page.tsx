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

type Person = {
  id: string;
  anonymousId: string | null;
  userId: string | null;
  displayName: string | null;
};

type HeatPoint = { x: number; y: number; screen: string };

const WEB_PREVIEWS: PreviewId[] = ["original", "earlier-integration", "invite-prompt", "error-recovery", "simplified-signup"];
const MOBILE_PREVIEWS: PreviewId[] = ["original", "delayed-paywall", "first-session-nudge", "permission-fallback"];

const CONVERSION_WINDOWS: Record<string, string> = {
  teammate_invited: "Activation window — project + invite",
  subscription_started: "Monetization window — paid upgrade",
  session_completed: "Core engagement window — first value",
  returned_next_day: "Retention window — day-1 return",
  trial_started: "Monetization window — trial start",
  account_created: "Acquisition → activation handoff",
  integration_connected: "Activation precursor — stack connected",
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
  const [heat, setHeat] = useState<HeatPoint[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const variant = VARIANTS[preview] ?? VARIANTS.original;

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
      body: JSON.stringify({ action: "new" }),
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

  const engagement = useMemo(() => {
    const byScreen = new Map<string, number>();
    for (const point of heat) byScreen.set(point.screen, (byScreen.get(point.screen) ?? 0) + 1);
    const ranked = [...byScreen.entries()].sort((a, b) => b[1] - a[1]);
    const windows = log
      .map((entry) => {
        const key = Object.keys(CONVERSION_WINDOWS).find((name) => entry.includes(name));
        return key ? CONVERSION_WINDOWS[key] : null;
      })
      .filter(Boolean)
      .slice(0, 4) as string[];
    return {
      clicks: heat.length,
      hottest: ranked[0]?.[0] ?? null,
      hottestCount: ranked[0]?.[1] ?? 0,
      windows: [...new Set(windows)],
      eventCount: log.filter((item) => !item.startsWith("Created") && !item.startsWith("Identified") && !item.startsWith("Cleared")).length,
    };
  }, [heat, log]);

  function renderPreview() {
    if (!person) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <div>
            <h3 className="text-lg font-semibold">Launch an interactive session</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Click through {workspace.productName} like a real user. Heatmap shows where attention lands; conversion windows light up as you complete key steps.
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
        description={`Interactive look & feel of ${workspace.productName}. Observe where users engage, which screens get attention, and when conversion windows open — then preview recommended changes.`}
      />
      {status && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{status}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={createTester}>{person ? "New tester" : "Start Tester Mode"}</Button>
        <Button variant="outline" onClick={identifyTester} disabled={!person}>
          Identify tester
        </Button>
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
        <Button variant={mode === "original" ? "default" : "outline"} onClick={() => setMode("original")}>
          Original
        </Button>
        <Button variant={mode === "recommended" ? "default" : "outline"} onClick={() => setMode("recommended")}>
          Recommended
        </Button>
        <select
          className="h-9 rounded-md border px-2 text-sm"
          value={preview}
          onChange={(e) => setPreview(e.target.value as PreviewId)}
        >
          {allowed.map((id) => (
            <option key={id} value={id}>
              {VARIANTS[id].label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Switch checked={heatmapEnabled} onCheckedChange={setHeatmapEnabled} id="heatmap" />
          <Label htmlFor="heatmap">Heatmap</Label>
        </div>
        {person && <Badge variant="secondary">{hashPii(person.userId || person.anonymousId)}</Badge>}
        {person && (
          <Link className="text-sm text-primary hover:underline" href={`/users/${person.id}`}>
            Profile
          </Link>
        )}
      </div>

      <div className="mb-4">
        <DeviceToolbar
          viewport={viewport}
          onChange={setViewport}
          platformLabel={workspace.platform === "web" ? "website" : "app"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">{renderPreview()}</div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Observation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Purpose: see where people tap/click, which screens hold attention, and which steps open a conversion window.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="UI clicks" value={String(engagement.clicks)} />
                <Stat label="Events" value={String(engagement.eventCount)} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Hottest screen</div>
                <div className="mt-1 font-medium">
                  {engagement.hottest ? `${engagement.hottest} (${engagement.hottestCount} taps)` : "Click the preview to start"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Conversion windows hit</div>
                {engagement.windows.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">Complete invite, session, trial, or subscribe steps to open a window.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {engagement.windows.map((item) => (
                      <li key={item} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variant under test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-medium">{variant.label}</div>
              <p className="text-muted-foreground">{variant.hypothesis}</p>
              <p>Target: {variant.targetMetric}</p>
              <p>Guardrail: {variant.guardrail}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event trail</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="max-h-56 space-y-1 overflow-auto text-xs">
                {log.length === 0 ? (
                  <li className="text-muted-foreground">None yet — interact with the product.</li>
                ) : (
                  log.map((item, index) => <li key={index}>{item}</li>)
                )}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Heatmap clicks emit <code>ui_click</code> with x/y + viewport. Watch Live activity for the stream.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
