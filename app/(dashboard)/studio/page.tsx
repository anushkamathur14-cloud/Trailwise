"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import {
  activePreviewId,
  defaultVariantFor,
  resolveStudioState,
  setMode as applyMode,
  setVariant as applyVariant,
  switchWorkspace,
  variantsForWorkspace,
  type StudioState,
} from "@/lib/studio/state";
import { hashPii } from "@/lib/privacy/hash";
import { previewConfigByVariant } from "@/lib/recommendations/preview-map";
import { useApi } from "@/hooks/use-api";
import { formatDuration, formatPercent } from "@/lib/utils";
import { labelForEvent } from "@/lib/events/catalog";
import { describeDropOff } from "@/lib/analytics/drop-off";

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
    dropOffRate?: number;
    mostCommonNextEvent: string | null;
    mostCommonDropOffEvent?: string | null;
    mostCommonAbandonEvent: string | null;
    medianTimeToNextMs: number | null;
  };
};

export default function StudioPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Experience Studio…</p>}>
      <StudioInner />
    </Suspense>
  );
}

function StudioInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { workspaceId, workspace } = useWorkspace();
  const urlPreview = params.get("preview");

  const [state, setState] = useState<StudioState>(() =>
    resolveStudioState({
      workspaceId,
      mode: urlPreview && urlPreview !== "original" ? "recommended" : "recommended",
      urlPreview,
      variantId: urlPreview,
    }),
  );
  const [person, setPerson] = useState<Person | null>(null);
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [viewport, setViewport] = useState<ViewportMode>(workspace.platform === "mobile" ? "mobile" : "desktop");
  const [currentScreen, setCurrentScreen] = useState(workspace.platform === "web" ? "landing" : "welcome");
  const [status, setStatus] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [focusPreview, setFocusPreview] = useState(false);
  const [mobileTab, setMobileTab] = useState<"recommendation" | "analysis">("recommendation");

  // Sync when workspace cookie/provider changes
  useEffect(() => {
    setState((prev) => {
      if (prev.workspaceId === workspaceId) {
        return resolveStudioState({
          ...prev,
          workspaceId,
          urlPreview: params.get("preview"),
          variantId: prev.variantId ?? params.get("preview"),
          mode: prev.mode,
        });
      }
      return switchWorkspace(prev, workspaceId);
    });
    setViewport(workspace.platform === "mobile" ? "mobile" : "desktop");
    setCurrentScreen(workspace.platform === "web" ? "landing" : "welcome");
    setPerson(null);
    setLog([]);
    setPreviewKey((k) => k + 1);
  }, [workspaceId, workspace.platform, params]);

  // Clean invalid preview from URL for current workspace
  useEffect(() => {
    const preview = params.get("preview");
    if (!preview) return;
    const allowed = new Set<string>(["original", ...variantsForWorkspace(workspaceId)]);
    if (!allowed.has(preview)) {
      const next = new URLSearchParams(params.toString());
      next.set("preview", defaultVariantFor(workspaceId));
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [params, workspaceId, pathname, router]);

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

  const previewId = activePreviewId(state);
  const variant = VARIANTS[previewId] ?? VARIANTS.original;
  const mapping = previewConfigByVariant(
    workspaceId,
    state.mode === "original" ? defaultVariantFor(workspaceId) : state.variantId ?? defaultVariantFor(workspaceId),
  );

  const historicQs = [
    state.deviceOrPlatform ? `device=${state.deviceOrPlatform}` : "",
    `screen=${currentScreen}`,
    state.variantId ? `previewId=${state.variantId}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const { data: historic } = useApi<Behavior>(
    `/api/analytics/behavior?${historicQs}`,
    `${workspaceId}-${historicQs}-${currentScreen}`,
  );

  async function createTester() {
    setStatus(null);
    const response = await fetch(`/api/tester?workspace=${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "new",
        ecosystem: workspace.platform === "mobile" ? state.deviceOrPlatform || "ios" : undefined,
        device: workspace.platform === "web" ? state.deviceOrPlatform || "desktop" : undefined,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json.person) {
      setStatus(json.error || "Could not create tester. Check /api/health.");
      return;
    }
    setPerson(json.person);
    setState((s) => ({ ...s, testerSessionId: json.person.id }));
    setSessionLabel(`${state.mode === "original" ? "Original" : "Recommended"} session`);
    setLog((current) => [`Started tester session · ${hashPii(json.person.anonymousId)}`, ...current]);
    setPreviewKey((k) => k + 1);
  }

  function changeMode(next: "original" | "recommended") {
    setState((s) => applyMode(s, next));
    setLog((current) => [
      `Switched to ${next === "original" ? "Original" : "Recommended"} — new comparison session`,
      ...current,
    ]);
    setSessionLabel(`${next === "original" ? "Original" : "Recommended"} comparison session`);
    setPreviewKey((k) => k + 1);
    const nextParams = new URLSearchParams(params.toString());
    if (next === "original") nextParams.delete("preview");
    else nextParams.set("preview", state.variantId ?? defaultVariantFor(workspaceId));
    router.replace(`${pathname}?${nextParams.toString()}`);
  }

  function changeVariant(id: PreviewId | "original") {
    setState((s) => applyVariant(s, id));
    setPreviewKey((k) => k + 1);
    const nextParams = new URLSearchParams(params.toString());
    if (id === "original") nextParams.delete("preview");
    else nextParams.set("preview", id);
    router.replace(`${pathname}?${nextParams.toString()}`);
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
    recommended: state.mode === "recommended",
    previewId,
    workspaceId,
    viewport,
    onEvent: (name: string) => setLog((c) => [name, ...c]),
    onHeatChange: () => undefined,
    onScreenChange: setCurrentScreen,
    recordClicks: true as const,
    heatmapEnabled: false,
    interactive: true as const,
  };

  const dropOffEvent = historic?.stepStats?.mostCommonDropOffEvent ?? historic?.stepStats?.mostCommonAbandonEvent;
  const dropOffLabel = describeDropOff(dropOffEvent, currentScreen);

  const gridClass = focusPreview
    ? "grid gap-4 xl:grid-cols-[0fr_minmax(0,1fr)_0fr]"
    : "grid gap-4 xl:grid-cols-[minmax(220px,0.24fr)_minmax(0,0.52fr)_minmax(220px,0.24fr)]";

  const recommendationPanel = (
    <Card className={`h-fit ${focusPreview ? "hidden xl:hidden" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{variant.label}</CardTitle>
        <Badge variant="outline">{state.mode === "original" ? "Original" : "Recommended"}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Problem</div>
          <p className="mt-1">{variant.problem}</p>
        </section>
        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</div>
          <p className="mt-1 text-muted-foreground">
            {mapping
              ? `Target behavior: ${labelForEvent(workspaceId, mapping.targetEvent)}. Estimate only — not a causal claim.`
              : variant.targetMetric}
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
        {state.mode === "recommended" && variant.whatChanged.length > 0 && (
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
  );

  const analysisPanel = (
    <div className={`space-y-4 ${focusPreview ? "hidden" : ""}`}>
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
                Target ({labelForEvent(workspaceId, mapping.targetEvent)}): <strong>{targetHit ? "Occurred" : "Not yet"}</strong>
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
                Drop-off rate: <strong>{formatPercent(historic.stepStats.dropOffRate ?? 1 - historic.stepStats.stepCompletionRate)}</strong>
              </p>
              <p>
                Most common next action:{" "}
                <strong>
                  {historic.stepStats.mostCommonNextEvent
                    ? labelForEvent(workspaceId, historic.stepStats.mostCommonNextEvent)
                    : "—"}
                </strong>
              </p>
              <p>
                Most common drop-off: <strong>{dropOffLabel}</strong>
              </p>
              <p>
                Median time to next action:{" "}
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
  );

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
          <Button size="sm" variant={state.mode === "original" ? "default" : "ghost"} onClick={() => changeMode("original")}>
            Original
          </Button>
          <Button
            size="sm"
            variant={state.mode === "recommended" ? "default" : "ghost"}
            onClick={() => changeMode("recommended")}
          >
            Recommended
          </Button>
        </div>
        <select
          className="h-9 rounded-md border px-2 text-sm"
          value={state.mode === "original" ? "original" : state.variantId ?? defaultVariantFor(workspaceId)}
          onChange={(e) => changeVariant(e.target.value as PreviewId | "original")}
        >
          <option value="original">Original journey</option>
          {variantsForWorkspace(workspaceId).map((id) => (
            <option key={id} value={id}>
              {VARIANTS[id].label}
            </option>
          ))}
        </select>
        <DeviceFilter
          workspaceId={workspaceId}
          value={state.deviceOrPlatform}
          onChange={(value) => setState((s) => ({ ...s, deviceOrPlatform: value }))}
        />
        <Button onClick={createTester}>{person ? "New tester session" : "Start Tester Mode"}</Button>
        <Button variant="outline" size="sm" onClick={() => setFocusPreview((v) => !v)}>
          {focusPreview ? "Show panels" : "Focus preview"}
        </Button>
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

      <div className="mb-3 flex gap-2 xl:hidden">
        <Button size="sm" variant={mobileTab === "recommendation" ? "default" : "outline"} onClick={() => setMobileTab("recommendation")}>
          Recommendation
        </Button>
        <Button size="sm" variant={mobileTab === "analysis" ? "default" : "outline"} onClick={() => setMobileTab("analysis")}>
          Live analysis
        </Button>
      </div>

      <div className={gridClass}>
        <div className={`hidden xl:block ${focusPreview ? "!hidden" : ""}`}>{recommendationPanel}</div>
        <div className="xl:hidden">{mobileTab === "recommendation" ? recommendationPanel : analysisPanel}</div>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Interactive preview</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Current step: <span className="font-medium text-foreground">{currentScreen}</span>
                  {!person && " · Preview visible — start Tester Mode to track events"}
                </p>
              </div>
              {workspace.platform === "web" && (
                <DeviceToolbar viewport={viewport} onChange={setViewport} platformLabel="website" />
              )}
            </div>
          </CardHeader>
          <CardContent key={previewKey} className="min-w-0 overflow-x-auto">
            <div className={workspace.platform === "web" ? "mx-auto min-w-[640px] max-w-5xl" : "mx-auto flex justify-center"}>
              {workspace.platform === "web" ? (
                <ForgePreview {...previewShared} />
              ) : (
                <AureliaPreview
                  {...previewShared}
                  platformDevice={state.deviceOrPlatform === "android" ? "android" : "ios"}
                  viewport="mobile"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className={`hidden xl:block ${focusPreview ? "!hidden" : ""}`}>{analysisPanel}</div>
      </div>
    </div>
  );
}
