"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeviceFilter } from "@/components/device-filter";
import { useWorkspace } from "@/components/workspace-provider";
import { ForgePreview } from "@/components/studio/forge-preview";
import { AureliaPreview } from "@/components/studio/aurelia-preview";
import { DeviceToolbar, type ViewportMode } from "@/components/studio/device-frame";
import { VARIANTS, type PreviewId } from "@/lib/studio/variants";
import { hashPii } from "@/lib/privacy/hash";
import { previewConfigByVariant } from "@/lib/recommendations/preview-map";
import { useApi } from "@/hooks/use-api";
import { formatDuration, formatPercent } from "@/lib/utils";
import { labelForEvent } from "@/lib/events/catalog";

type Person = {
  id: string;
  anonymousId: string | null;
  userId: string | null;
  displayName: string | null;
};

type Behavior = {
  device: string;
  totalEvents: number;
  topEvents: Array<{ name: string; count: number; share: number }>;
  topScreens: Array<{ name: string; count: number; share: number }>;
  environment: string;
  baselineLabel: string;
  stepStats: {
    usersReachedStep: number;
    stepCompletionRate: number;
    mostCommonNextEvent: string | null;
    mostCommonAbandonEvent: string | null;
    medianTimeToNextMs: number | null;
  };
};

const WEB_PREVIEWS: PreviewId[] = ["original", "earlier-wearable-help", "friend-invite-prompt", "error-recovery", "simplified-signup"];
const MOBILE_PREVIEWS: PreviewId[] = ["original", "delayed-paywall", "first-session-nudge", "permission-fallback"];

export default function StudioPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Experience Studio…</p>}>
      <StudioInner />
    </Suspense>
  );
}

function StudioInner() {
  const params = useSearchParams();
  const { workspaceId, workspace } = useWorkspace();
  const allowed = workspace.platform === "web" ? WEB_PREVIEWS : MOBILE_PREVIEWS;
  const initialPreview = (params.get("preview") as PreviewId) || "original";
  const [mode, setMode] = useState<"original" | "recommended">(
    initialPreview !== "original" ? "recommended" : "recommended",
  );
  const [preview, setPreview] = useState<PreviewId>(allowed.includes(initialPreview) ? initialPreview : "original");
  const [person, setPerson] = useState<Person | null>(null);
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [viewport, setViewport] = useState<ViewportMode>(workspace.platform === "mobile" ? "mobile" : "desktop");
  const [device, setDevice] = useState("");
  const [currentScreen, setCurrentScreen] = useState(workspace.platform === "web" ? "landing" : "welcome");
  const [status, setStatus] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const variant = VARIANTS[mode === "original" ? "original" : preview === "original" ? (workspace.platform === "web" ? "earlier-wearable-help" : "delayed-paywall") : preview] ?? VARIANTS.original;
  const mappingVariant =
    preview === "original"
      ? workspace.platform === "web"
        ? "earlier-wearable-help"
        : "delayed-paywall"
      : preview;
  const mapping = previewConfigByVariant(workspaceId, mappingVariant);

  const historicQs = [
    device ? `device=${device}` : "",
    `screen=${currentScreen}`,
    preview !== "original" ? `previewId=${preview}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const { data: historic } = useApi<Behavior>(
    `/api/analytics/behavior?${historicQs}`,
    `${workspaceId}-${historicQs}-${currentScreen}`,
  );

  useEffect(() => {
    if (!allowed.includes(preview)) setPreview("original");
  }, [workspaceId, allowed, preview]);

  useEffect(() => {
    setViewport(workspace.platform === "mobile" ? "mobile" : "desktop");
    setCurrentScreen(workspace.platform === "web" ? "landing" : "welcome");
    setDevice("");
  }, [workspace.platform]);

  useEffect(() => {
    const fromUrl = params.get("preview") as PreviewId | null;
    if (fromUrl && allowed.includes(fromUrl)) {
      setPreview(fromUrl);
      setMode(fromUrl === "original" ? "original" : "recommended");
    }
  }, [params, allowed]);

  useEffect(() => {
    const personId = params.get("personId");
    if (!personId) return;
    fetch(`/api/users/${personId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load user");
        setPerson(json.person);
      })
      .catch((error: Error) => setStatus(error.message));
  }, [params]);

  async function createTester() {
    setStatus(null);
    const response = await fetch(`/api/tester?workspace=${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "new",
        ecosystem: workspace.platform === "mobile" ? device || "ios" : undefined,
        device: workspace.platform === "web" ? device || "desktop" : undefined,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json.person) {
      setStatus(json.error || "Could not create tester. Check /api/health.");
      return;
    }
    setPerson(json.person);
    setSessionLabel(`${mode === "original" ? "Original" : "Recommended"} session`);
    setLog((current) => [`Started tester session · ${hashPii(json.person.anonymousId)}`, ...current]);
    setPreviewKey((k) => k + 1);
  }

  function switchMode(next: "original" | "recommended") {
    setMode(next);
    setLog((current) => [
      `Switched to ${next === "original" ? "Original" : "Recommended"} — new comparison session`,
      ...current,
    ]);
    setSessionLabel(`${next === "original" ? "Original" : "Recommended"} comparison session`);
    setPreviewKey((k) => k + 1);
  }

  const emittedEvents = useMemo(() => {
    return log.filter(
      (entry) =>
        !entry.includes("(failed)") &&
        !entry.includes("(preview only)") &&
        !entry.startsWith("Started") &&
        !entry.startsWith("Switched") &&
        !entry.startsWith("Cleared") &&
        !entry.includes(" "),
    );
  }, [log]);

  const targetHit = mapping ? emittedEvents.includes(mapping.targetEvent) : false;
  const guardrailHit = mapping ? emittedEvents.includes(mapping.guardrailEvent) : false;

  const previewShared = {
    person,
    recommended: mode === "recommended" && preview !== "original",
    previewId: mode === "original" ? ("original" as PreviewId) : preview,
    workspaceId,
    viewport,
    onEvent: (name: string) => setLog((c) => [name, ...c]),
    onHeatChange: () => undefined,
    onScreenChange: setCurrentScreen,
    recordClicks: true as const,
    heatmapEnabled: false,
    interactive: true as const,
  };

  return (
    <div>
      <PageHeader
        title="Experience Studio"
        description={`Compare original and recommended Aurelia ${workspace.platform === "web" ? "website" : "app"} experiences. Start a tester session when you want events tracked.`}
      />
      {status && (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{status}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-1">
          <Button size="sm" variant={mode === "original" ? "default" : "ghost"} onClick={() => switchMode("original")}>
            Original
          </Button>
          <Button
            size="sm"
            variant={mode === "recommended" ? "default" : "ghost"}
            onClick={() => switchMode("recommended")}
          >
            Recommended
          </Button>
        </div>
        <select
          className="h-9 rounded-md border px-2 text-sm"
          value={preview}
          onChange={(e) => {
            const id = e.target.value as PreviewId;
            setPreview(id);
            if (id !== "original") setMode("recommended");
          }}
        >
          {allowed.map((id) => (
            <option key={id} value={id}>
              {VARIANTS[id].label}
            </option>
          ))}
        </select>
        <DeviceFilter workspaceId={workspaceId} value={device} onChange={setDevice} />
        <Button onClick={createTester}>{person ? "New tester session" : "Start Tester Mode"}</Button>
        {person && (
          <>
            <Badge variant="secondary">{hashPii(person.userId || person.anonymousId)}</Badge>
            <Link className="text-sm text-primary hover:underline" href={`/users/${person.id}`}>
              Tester profile
            </Link>
            <Link className="text-sm text-primary hover:underline" href="/live">
              Live Activity
            </Link>
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{variant.label}</CardTitle>
            <Badge variant="outline">{mode === "original" ? "Original" : "Recommended"}</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Problem</div>
              <p className="mt-1">{variant.problem}</p>
            </section>
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</div>
              <p className="mt-1 text-muted-foreground">
                Linked to {mapping ? labelForEvent(workspaceId, mapping.targetEvent) : variant.targetMetric}. Estimate only —
                not a causal claim.
              </p>
            </section>
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Target segment</div>
              <p className="mt-1">{variant.segment}</p>
            </section>
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Hypothesis</div>
              <p className="mt-1">{variant.hypothesis}</p>
            </section>
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Primary metric</div>
              <p className="mt-1">{variant.targetMetric}</p>
            </section>
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Guardrail</div>
              <p className="mt-1">{variant.guardrail}</p>
            </section>
            {mode === "recommended" && variant.whatChanged.length > 0 && (
              <section className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-900">What changed</div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-emerald-950">
                  {variant.whatChanged.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Interactive preview</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Step: <span className="font-medium text-foreground">{currentScreen}</span>
                  {!person && " · Preview visible — start Tester Mode to track events"}
                </p>
              </div>
              {workspace.platform === "web" && (
                <DeviceToolbar viewport={viewport} onChange={setViewport} platformLabel="website" />
              )}
            </div>
          </CardHeader>
          <CardContent key={previewKey} className="min-w-0">
            {workspace.platform === "web" ? (
              <ForgePreview {...previewShared} />
            ) : (
              <AureliaPreview
                {...previewShared}
                platformDevice={device === "android" ? "android" : "ios"}
                viewport="mobile"
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Live analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Tester identity</div>
                <p className="mt-1">{person ? hashPii(person.userId || person.anonymousId) : "Not started"}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Current session</div>
                <p className="mt-1">{sessionLabel ?? (person ? "Active" : "Preview only")}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Events emitted</div>
                <ul className="mt-1 max-h-28 space-y-0.5 overflow-auto text-xs">
                  {emittedEvents.length === 0 ? (
                    <li className="text-muted-foreground">None yet</li>
                  ) : (
                    emittedEvents.slice(0, 12).map((item, i) => <li key={`${item}-${i}`}>{labelForEvent(workspaceId, item)}</li>)
                  )}
                </ul>
              </div>
              {mapping && person && (
                <div className="rounded-md bg-muted/50 p-2 text-xs">
                  <div>
                    Target ({labelForEvent(workspaceId, mapping.targetEvent)}):{" "}
                    <strong>{targetHit ? "Occurred" : "Not yet"}</strong>
                  </div>
                  <div>
                    Guardrail ({labelForEvent(workspaceId, mapping.guardrailEvent)}):{" "}
                    <strong>{guardrailHit ? "Preserved / seen" : "Not yet"}</strong>
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Expected next</div>
                <p className="mt-1 text-xs">
                  {historic?.stepStats?.mostCommonNextEvent
                    ? labelForEvent(workspaceId, historic.stepStats.mostCommonNextEvent)
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Historic benchmark</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                {historic?.baselineLabel ?? "Historic behavior"} · {historic?.totalEvents ?? 0} events
              </p>
              {historic?.stepStats && (
                <>
                  <p>
                    Users who reached this step: <strong>{historic.stepStats.usersReachedStep}</strong>
                  </p>
                  <p>
                    Step completion rate: <strong>{formatPercent(historic.stepStats.stepCompletionRate)}</strong>
                  </p>
                  <p>
                    Most common next:{" "}
                    <strong>
                      {historic.stepStats.mostCommonNextEvent
                        ? labelForEvent(workspaceId, historic.stepStats.mostCommonNextEvent)
                        : "—"}
                    </strong>
                  </p>
                  <p>
                    Most common abandonment:{" "}
                    <strong>
                      {historic.stepStats.mostCommonAbandonEvent
                        ? labelForEvent(workspaceId, historic.stepStats.mostCommonAbandonEvent)
                        : "—"}
                    </strong>
                  </p>
                  <p>
                    Median time to next:{" "}
                    <strong>
                      {historic.stepStats.medianTimeToNextMs != null
                        ? formatDuration(historic.stepStats.medianTimeToNextMs)
                        : "—"}
                    </strong>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Event trail</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="max-h-40 space-y-1 overflow-auto text-xs">
                {log.length === 0 ? (
                  <li className="text-muted-foreground">Interact with the preview to build a trail.</li>
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
