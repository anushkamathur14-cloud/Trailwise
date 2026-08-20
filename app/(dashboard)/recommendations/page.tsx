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

function confidenceLabel(value: string) {
  if (value === "high") return "High confidence";
  if (value === "medium") return "Medium confidence";
  return "Exploratory";
}

function priorityLabel(direction: string) {
  if (direction === "increase") return "Priority: High";
  if (direction === "decrease") return "Priority: Medium";
  return "Priority: Exploratory";
}

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  if (loading) return <p className="text-sm text-muted-foreground">Loading recommendations…</p>;
  if (error || !data) return <p className="text-sm text-rose-700">{error ?? "Could not load recommendations."}</p>;

  return (
    <div>
      <PageHeader
        title="Recommendations"
        description="Ranked product changes with behavioral evidence. Preview opens Experience Studio on the matching variant."
      />

      {heatRec && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>From recent session heat</CardTitle>
              <Badge>{confidenceLabel(heatRec.confidence)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="font-medium">{heatRec.title}</div>
            <p>{heatRec.why}</p>
            <p className="font-medium">{heatRec.action}</p>
            <Button asChild>
              <Link href={`/studio?${personId ? `personId=${personId}&` : ""}preview=${heatRec.previewId}`}>
                Preview change
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.product.map((rec) => {
          const open = expanded[rec.id];
          return (
            <Card key={rec.id} className="flex flex-col">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-snug">{rec.title}</CardTitle>
                  <Badge variant="secondary">{confidenceLabel(rec.confidence)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{rec.evidence}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{priorityLabel(rec.impactDirection)}</Badge>
                  <span className="text-muted-foreground">
                    Est. impact: {rec.expectedImpact ?? rec.successMetric} (estimate)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Segment: {rec.segment}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/studio?preview=${rec.previewId}`}>Preview change</Link>
                  </Button>
                  <Button variant="outline" onClick={() => setExpanded((c) => ({ ...c, [rec.id]: !open }))}>
                    {open ? "Hide analysis" : "View analysis"}
                  </Button>
                </div>
                {open && (
                  <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-xs">
                    <div>
                      <div className="font-medium uppercase tracking-wide text-muted-foreground">Full evidence</div>
                      <p className="mt-1 text-sm">{rec.impact ?? rec.evidence}</p>
                      <p className="mt-1 text-muted-foreground">{rec.evidence}</p>
                    </div>
                    {rec.heatmapHint && (
                      <div>
                        <div className="font-medium uppercase tracking-wide text-muted-foreground">Behavioral evidence</div>
                        <p className="mt-1">{rec.heatmapHint}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-muted-foreground">Target behavior</div>
                        <div>{rec.relatedEvents?.map((e) => e.replace(/_/g, " ")).join(" → ") || rec.successMetric}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Guardrail</div>
                        <div>{rec.downside}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Experiment design</div>
                      <p className="mt-1">{rec.experiment}</p>
                    </div>
                    {rec.hotspotScreens && rec.hotspotScreens.length > 0 && (
                      <div>
                        <div className="text-muted-foreground">Relevant screens</div>
                        <p className="mt-1">{rec.hotspotScreens.join(", ")}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recommend next action</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-xl gap-2">
            <Input
              placeholder="User ID from Users / Experience Studio"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            />
            <Button onClick={loadUser}>Recommend next action</Button>
          </div>
          {userRec && (
            <div className="mt-4 max-w-2xl space-y-2 rounded-lg border p-4 text-sm">
              <div className="font-medium">{userRec.title}</div>
              <p>{userRec.why}</p>
              <p>{userRec.experience}</p>
              <p className="text-xs text-muted-foreground">Signals: {userRec.signals.join(", ")}</p>
              <Button asChild className="mt-2">
                <Link href={`/studio?personId=${personId}&preview=${userRec.previewId}`}>Preview change</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
