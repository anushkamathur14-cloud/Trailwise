"use client";

import Link from "next/link";
import { useState } from "react";
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
  }>;
};

export default function RecommendationsPage() {
  const { data, loading, error } = useApi<Recs>("/api/recommendations");
  const [personId, setPersonId] = useState("");
  const [userRec, setUserRec] = useState<{
    title: string;
    why: string;
    experience: string;
    previewId: string;
    signals: string[];
    suppression: string[];
    confidence: string;
  } | null>(null);
  const [enhanced, setEnhanced] = useState<Record<string, string>>({});

  async function loadUser() {
    const response = await fetch(`/api/recommendations?personId=${personId}`);
    const json = await response.json();
    setUserRec(json.user);
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
        description="Evidence-linked product changes and next-best actions. Preview opens Experience Studio with the matching journey variant."
      />
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
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Segment</div>
                  <div>{rec.segment}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Impact</div>
                  <div>{rec.impactDirection}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Success metric</div>
                  <div>{rec.successMetric}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Downside</div>
                  <div>{rec.downside}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Experiment: {rec.experiment}</p>
              {enhanced[rec.id] && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{enhanced[rec.id]}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild>
                  <Link href={`/studio?preview=${rec.previewId}`}>Preview in Experience Studio</Link>
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
            <Input placeholder="Person id from Users" value={personId} onChange={(e) => setPersonId(e.target.value)} />
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
                  Preview in Experience Studio
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
