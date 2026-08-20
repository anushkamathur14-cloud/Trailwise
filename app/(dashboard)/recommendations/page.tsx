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
  const { data, loading } = useApi<Recs>("/api/recommendations");
  const [personId, setPersonId] = useState("");
  const [userRec, setUserRec] = useState<{ title: string; why: string; experience: string; previewId: string; signals: string[]; suppression: string[]; confidence: string } | null>(null);
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

  if (loading || !data) return <p className="text-sm text-muted-foreground">Loading recommendations…</p>;

  return (
    <div>
      <PageHeader
        title="Recommendations"
        description="Product-level changes and user-level next-best-actions from a deterministic rules engine. Optional AI only rewrites the explanation."
      />
      <div className="grid gap-4">
        {data.product.map((rec) => (
          <Card key={rec.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{rec.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{rec.change}</p>
              </div>
              <Badge>{rec.confidence} · {rec.impactDirection}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div><span className="font-medium">Evidence:</span> {rec.evidence}</div>
              <div><span className="font-medium">Segment:</span> {rec.segment}</div>
              <div><span className="font-medium">Downside:</span> {rec.downside}</div>
              <div><span className="font-medium">Success metric:</span> {rec.successMetric}</div>
              <div><span className="font-medium">Experiment:</span> {rec.experiment}</div>
              {enhanced[rec.id] && <p className="rounded-md bg-muted p-3 text-muted-foreground">{enhanced[rec.id]}</p>}
              <div className="flex gap-2 pt-2">
                <Button asChild>
                  <Link href={`/studio?preview=${rec.previewId}`}>Preview recommended journey</Link>
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
            <div className="mt-4 space-y-2 text-sm">
              <div className="font-medium">{userRec.title}</div>
              <p>{userRec.why}</p>
              <p>{userRec.experience}</p>
              <p>Signals: {userRec.signals.join(", ")}</p>
              <p>Suppression: {userRec.suppression.join(", ") || "none"}</p>
              <Button asChild>
                <Link href={`/studio?personId=${personId}&preview=${userRec.previewId}`}>Launch preview</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
