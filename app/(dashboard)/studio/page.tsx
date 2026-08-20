"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace-provider";
import { ForgePreview } from "@/components/studio/forge-preview";
import { AureliaPreview } from "@/components/studio/aurelia-preview";
import { VARIANTS, type PreviewId } from "@/lib/studio/variants";
import { RetentionPanel } from "@/components/retention-panel";

type Person = {
  id: string;
  anonymousId: string | null;
  userId: string | null;
  displayName: string | null;
};

export default function StudioPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading studio…</p>}>
      <StudioInner />
    </Suspense>
  );
}

function StudioInner() {
  const params = useSearchParams();
  const { workspaceId, workspace } = useWorkspace();
  const [mode, setMode] = useState<"original" | "recommended">("recommended");
  const [preview, setPreview] = useState<PreviewId>((params.get("preview") as PreviewId) || "original");
  const [person, setPerson] = useState<Person | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const variant = VARIANTS[preview] ?? VARIANTS.original;

  useEffect(() => {
    const personId = params.get("personId");
    if (personId) {
      fetch(`/api/users/${personId}`)
        .then((r) => r.json())
        .then((json) => setPerson(json.person));
    }
  }, [params]);

  async function createTester() {
    const response = await fetch(`/api/tester?workspace=${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "new" }),
    });
    const json = await response.json();
    setPerson(json.person);
    setLog((current) => [`Created tester ${json.person.anonymousId}`, ...current]);
  }

  async function identifyTester() {
    if (!person) return;
    const userId = person.userId || `tester_user_${person.id.slice(-6)}`;
    await fetch("/api/identify", {
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
    setPerson({ ...person, userId });
    setLog((current) => [`Identified ${person.anonymousId} as ${userId}`, ...current]);
  }

  async function inject(eventName: string, timestamp?: string) {
    if (!person) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        workspaceId,
        anonymousId: person.userId ? undefined : person.anonymousId,
        userId: person.userId,
        platform: workspace.platform,
        source: "tester",
        timestamp,
        properties: { injected: true },
      }),
    });
    setLog((current) => [`Injected ${eventName}${timestamp ? " (future)" : ""}`, ...current]);
  }

  const failureEvent = workspace.platform === "web" ? "integration_error" : "session_abandoned";
  const conversionEvent = workspace.platform === "web" ? "teammate_invited" : "returned_next_day";

  const previewNode = useMemo(() => {
    if (!person) return <p className="p-6 text-sm text-muted-foreground">Create a tester to launch the preview.</p>;
    const recommended = mode === "recommended" && preview !== "original";
    if (workspace.platform === "web") {
      return <ForgePreview person={person} recommended={recommended} previewId={preview} onEvent={(name) => setLog((c) => [name, ...c])} />;
    }
    return <AureliaPreview person={person} recommended={recommended} previewId={preview} onEvent={(name) => setLog((c) => [name, ...c])} />;
  }, [person, mode, preview, workspace.platform]);

  return (
    <div>
      <PageHeader
        title="Experience Studio"
        description="Tester Mode plus an interactive preview. Events from this panel write into the same database as seeded users, so Live Activity, profiles, and recommendations update immediately."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={createTester}>New anonymous tester</Button>
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
          }}
        >
          Clear tester session
        </Button>
        <Button variant="outline" onClick={() => inject(failureEvent)} disabled={!person}>
          Introduce failure
        </Button>
        <Button variant="outline" onClick={() => inject(conversionEvent)} disabled={!person}>
          Complete conversion
        </Button>
        <Button variant="outline" onClick={() => inject(workspace.platform === "web" ? "landing_viewed" : "app_opened")} disabled={!person}>
          Simulate returning user
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            inject(
              workspace.platform === "web" ? "landing_viewed" : "returned_next_day",
              new Date(Date.now() + 3 * 86_400_000).toISOString(),
            )
          }
          disabled={!person}
        >
          Simulate several days passing
        </Button>
        <Button variant="outline" onClick={() => setCompare((value) => !value)}>
          {compare ? "Hide A/B" : "A/B comparison"}
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant={mode === "original" ? "default" : "outline"} onClick={() => setMode("original")}>
          Original
        </Button>
        <Button variant={mode === "recommended" ? "default" : "outline"} onClick={() => setMode("recommended")}>
          Recommended
        </Button>
        <select className="h-9 rounded-md border px-2 text-sm" value={preview} onChange={(e) => setPreview(e.target.value as PreviewId)}>
          {Object.values(VARIANTS).map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {person && <Badge>{person.displayName} · {person.userId || person.anonymousId}</Badge>}
      </div>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle>Recommendation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">{variant.label}</div>
            <p>{variant.hypothesis}</p>
            <p>Target: {variant.targetMetric}</p>
            <p>Guardrail: {variant.guardrail}</p>
            {person && (
              <a className="text-primary hover:underline" href={`/users/${person.id}`}>
                Open tester profile
              </a>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{workspace.productName} preview</CardTitle>
          </CardHeader>
          <CardContent>{previewNode}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preview state</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Generated events</div>
            <ul className="mt-2 max-h-80 space-y-1 overflow-auto text-xs">
              {log.length === 0 ? <li>None yet</li> : log.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
      {compare && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Original would emit</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{variant.originalEvents.join(" → ") || "Baseline screens, no intervention."}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recommended would emit</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{variant.recommendedEvents.join(" → ") || "Same as original."}</CardContent>
          </Card>
        </div>
      )}
      <RetentionPanel />
    </div>
  );
}
