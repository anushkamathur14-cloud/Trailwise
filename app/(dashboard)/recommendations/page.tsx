"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { Input } from "@/components/ui/input";

type Recs = {
  product: Array<{
    id: string;
    title: string;
    change: string;
    evidence: string;
    impact?: string;
    expectedImpact?: string;
    segment: string;
    impactDirection: string;
    confidence: string;
    downside: string;
    successMetric: string;
    experiment: string;
    previewId: string;
    hotspotScreens?: string[];
    relatedEvents?: string[];
    heatmapHint?: string;
  }>;
  fromHeatmap?: {
    title: string;
    action: string;
    why: string;
    confidence: string;
    previewId: string;
    triggerEvents: string[];
    hotspotScreens: string[];
    nextEvents: string[];
  } | null;
  user?: {
    title: string;
    why: string;
    experience: string;
    previewId: string;
    signals: string[];
    suppression: string[];
    confidence: string;
  } | null;
};

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading recommendations…</p>}>
      <RecommendationsInner />
    </Suspense>
  );
}

function RecommendationsInner() {
  const params = useSearchParams();
  const initialPerson = params.get("personId") ?? "";
  const [personId, setPersonId] = useState(initialPerson);
  const { data, loading, error } = useApi<Recs>(
    `/api/recommendations${personId ? `?personId=${personId}` : ""}`,
    personId || "all",
  );
  const [userRec, setUserRec] = useState<Recs["user"]>(null);
  const [heatRec, setHeatRec] = useState<Recs["fromHeatmap"]>(null);
  const [enhanced, setEnhanced] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.user) setUserRec(data.user);
    if (data?.fromHeatmap !== undefined) setHeatRec(data.fromHeatmap);
  }, [data]);

  async function loadUser() {
    const response = await fetch(`/api/recommendations?personId=${personId}`);
    const json = await response.json();
    setUserRec(json.user);
    setHeatRec(json.fromHeatmap);
  }

  async function enhance(id: string, title: string, evidence: string, experiment: string) {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "product", title, evidence, experiment }),
    });
    const json = await response.json();
    setEnhanced((current) => ({ ...current, [id]: `${json.source}: ${json.text}` }));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading recommendations…</p>;
  if (error || !data) return <p className="text-sm text-rose-700">{error ?? "Could not load recommendations."}</p>;

  return (
    <div>
      <PageHeader
        title="Recommendations"
        description="Product changes linked to events and heatmap hotspots. Preview opens Tester Mode on the matching journey."
      />

      {heatRec && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>From heatmap + events</CardTitle>
              <Badge>{heatRec.confidence}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="font-medium">{heatRec.title}</div>
            <p>{heatRec.why}</p>
            <p className="font-medium">{heatRec.action}</p>
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <div>
                <div className="text-muted-foreground">Hotspot screens</div>
                <div>{heatRec.hotspotScreens.join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Trigger events</div>
                <div>{heatRec.triggerEvents.map((e) => e.replace(/_/g, " ")).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Next events</div>
                <div>{heatRec.nextEvents.map((e) => e.replace(/_/g, " ")).join(" → ")}</div>
              </div>
            </div>
            <Button asChild>
              <Link href={`/studio?${personId ? `personId=${personId}&` : ""}preview=${heatRec.previewId}`}>
                Preview recommended experience
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.product.map((rec) => (
          <Card key={rec.id} className="flex flex-col">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base leading-snug">{rec.title}</CardTitle>
                <Badge>{rec.confidence}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{rec.change}</p>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 text-sm">
              <div className="rounded-md bg-muted/60 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Impact</div>
                <p className="mt-1">{rec.impact ?? rec.evidence}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                <div className="text-xs font-medium uppercase tracking-wide">Expected impact</div>
                <p className="mt-1">{rec.expectedImpact ?? `Lift on ${rec.successMetric}`}</p>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</div>
                <p className="mt-1">{rec.evidence}</p>
              </div>
              {rec.heatmapHint && (
                <div className="rounded-md border border-rose-200/70 bg-rose-50/50 p-3 text-xs">
                  <div className="font-medium uppercase tracking-wide text-rose-800">Heatmap link</div>
                  <p className="mt-1 text-rose-950/80">{rec.heatmapHint}</p>
                  {rec.hotspotScreens && rec.hotspotScreens.length > 0 && (
                    <p className="mt-1 text-muted-foreground">Screens: {rec.hotspotScreens.join(", ")}</p>
                  )}
                  {rec.relatedEvents && rec.relatedEvents.length > 0 && (
                    <p className="text-muted-foreground">
                      Drive events: {rec.relatedEvents.map((e) => e.replace(/_/g, " ")).join(" → ")}
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Segment</div>
                  <div>{rec.segment}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Success metric</div>
                  <div>{rec.successMetric}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Experiment: {rec.experiment}</p>
              {enhanced[rec.id] && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{enhanced[rec.id]}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild>
                  <Link href={`/studio?preview=${rec.previewId}`}>Preview in Tester Mode</Link>
                </Button>
                <Button variant="outline" onClick={() => enhance(rec.id, rec.title, rec.evidence, rec.experiment)}>
                  Enhance copy
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>User-level next best action</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-xl gap-2">
            <Input placeholder="Person id from Users / Tester" value={personId} onChange={(e) => setPersonId(e.target.value)} />
            <Button onClick={loadUser}>Analyze user</Button>
          </div>
          {userRec && (
            <div className="mt-4 max-w-2xl space-y-2 rounded-lg border p-4 text-sm">
              <div className="font-medium">{userRec.title}</div>
              <p>{userRec.why}</p>
              <p>{userRec.experience}</p>
              <p className="text-xs text-muted-foreground">Signals: {userRec.signals.join(", ")}</p>
              <Button asChild className="mt-2">
                <Link href={`/studio?personId=${personId}&preview=${userRec.previewId}`}>
                  Preview in Tester Mode
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
