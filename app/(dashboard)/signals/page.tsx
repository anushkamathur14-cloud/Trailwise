"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useApi } from "@/hooks/use-api";
import { formatPercent, formatPp } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";

type Goal = "activation" | "conversion" | "retention";

type SignalsResponse = {
  warning: string;
  goal: Goal;
  signals: Array<{
    id: string;
    name: string;
    description: string;
    interpretation: string;
    stats: {
      usersWithSignal: number;
      usersWithoutSignal: number;
      conversionWithSignal: number;
      conversionWithoutSignal: number;
      absoluteDifference: number;
      relativeLift: number | null;
      relativeLiftUnavailableReason: string | null;
      polarity: string;
      confidence: string;
      evidenceStrength: string;
      strongestSegment: string | null;
      belowSampleThreshold: boolean;
      ciWith: { low: number; high: number };
      ciWithout: { low: number; high: number };
    };
  }>;
};

type SortKey = "positive" | "negative" | "population" | "evidence" | "actionable";

export default function SignalsPage() {
  const { workspace } = useWorkspace();
  const [goal, setGoal] = useState<Goal>("activation");
  const [sort, setSort] = useState<SortKey>("positive");
  const { data, loading, error } = useApi<SignalsResponse>(`/api/analytics/signals?goal=${goal}`, goal);

  const sorted = useMemo(() => {
    const list = [...(data?.signals ?? [])];
    list.sort((a, b) => {
      if (sort === "positive") return b.stats.absoluteDifference - a.stats.absoluteDifference;
      if (sort === "negative") return a.stats.absoluteDifference - b.stats.absoluteDifference;
      if (sort === "population") return b.stats.usersWithSignal - a.stats.usersWithSignal;
      if (sort === "evidence") {
        const rank = { strong: 3, moderate: 2, weak: 1 } as const;
        return (rank[b.stats.evidenceStrength as keyof typeof rank] ?? 0) - (rank[a.stats.evidenceStrength as keyof typeof rank] ?? 0);
      }
      return Math.abs(b.stats.absoluteDifference) - Math.abs(a.stats.absoluteDifference);
    });
    return list;
  }, [data, sort]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Signals" description="Loading behavioral associations…" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-rose-700">{error ?? "Could not load signals."}</p>;
  }

  const goalLabel =
    goal === "activation" ? workspace.primaryGoal.name : goal === "conversion" ? workspace.secondaryGoal.name : "Retention";

  return (
    <div>
      <PageHeader
        title="Signals"
        description={`Behaviors associated with ${goalLabel.toLowerCase()}. Rates compare users with versus without each behavior.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Analyze signals for
          <select className="ml-2 h-9 rounded-md border px-2" value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
            <option value="activation">Activation</option>
            <option value="conversion">Subscription conversion</option>
            <option value="retention">Retention</option>
          </select>
        </label>
        <label className="text-sm">
          Sort by
          <select className="ml-2 h-9 rounded-md border px-2" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="positive">Strongest positive</option>
            <option value="negative">Strongest negative</option>
            <option value="population">Largest affected population</option>
            <option value="evidence">Highest evidence</option>
            <option value="actionable">Most actionable</option>
          </select>
        </label>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">{data.warning}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {sorted.map((signal) => {
          const withRate = signal.stats.conversionWithSignal;
          const withoutRate = signal.stats.conversionWithoutSignal;
          const pp = signal.stats.absoluteDifference;
          return (
            <Card key={signal.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">{signal.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{signal.description}</p>
                </div>
                <Badge variant={signal.stats.polarity === "positive" ? "success" : signal.stats.polarity === "negative" ? "danger" : "secondary"}>
                  {signal.stats.polarity}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <Tooltip content="Share of users with this behavior who reached the selected goal.">
                      <div className="cursor-help text-xs text-muted-foreground">Goal rate with behavior</div>
                    </Tooltip>
                    <div className="mt-1 text-xl font-semibold">{formatPercent(withRate)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      n={signal.stats.usersWithSignal} · CI {formatPercent(signal.stats.ciWith.low)}–{formatPercent(signal.stats.ciWith.high)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <Tooltip content="Share of users without this behavior who reached the selected goal.">
                      <div className="cursor-help text-xs text-muted-foreground">Goal rate without</div>
                    </Tooltip>
                    <div className="mt-1 text-xl font-semibold">{formatPercent(withoutRate)}</div>
                    <div className="text-[11px] text-muted-foreground">n={signal.stats.usersWithoutSignal}</div>
                  </div>
                </div>

                <p>
                  <strong>{formatPercent(withRate)}</strong> reached the goal with this behavior versus{" "}
                  <strong>{formatPercent(withoutRate)}</strong> without it, a difference of{" "}
                  <Tooltip content="Absolute difference in goal rates (percentage points), not a relative percent change.">
                    <strong className="cursor-help">{formatPp(pp)}</strong>
                  </Tooltip>
                  .
                </p>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <Tooltip content="Relative lift is (with − without) / without. Shown only when the baseline rate is large enough.">
                    <span className="cursor-help">
                      Relative lift:{" "}
                      {signal.stats.relativeLift === null
                        ? "Relative lift unavailable"
                        : `${signal.stats.relativeLift > 0 ? "+" : ""}${(signal.stats.relativeLift * 100).toFixed(0)}%`}
                    </span>
                  </Tooltip>
                  <Tooltip content="Based on sample size and whether confidence intervals separate.">
                    <span className="cursor-help">Evidence: {signal.stats.evidenceStrength}</span>
                  </Tooltip>
                  <span>
                    Confidence:{" "}
                    {signal.stats.confidence === "high"
                      ? "High confidence"
                      : signal.stats.confidence === "medium"
                        ? "Medium confidence"
                        : "Exploratory"}
                  </span>
                  {signal.stats.strongestSegment && <span>Strongest segment: {signal.stats.strongestSegment}</span>}
                </div>

                <p className="text-xs text-muted-foreground">{signal.interpretation}</p>

                <Button asChild size="sm" variant="outline">
                  <Link href="/recommendations">Create recommendation</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
