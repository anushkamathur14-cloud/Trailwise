"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { formatPercent, formatLift } from "@/lib/utils";

type SignalsResponse = {
  warning: string;
  signals: Array<{
    id: string;
    name: string;
    description: string;
    interpretation: string;
    stats: {
      usersWithSignal: number;
      conversionWithSignal: number;
      conversionWithoutSignal: number;
      lift: number;
      polarity: string;
      confidence: string;
      strongestSegment: string | null;
      belowSampleThreshold: boolean;
    };
  }>;
};

export default function SignalsPage() {
  const { data, loading } = useApi<SignalsResponse>("/api/analytics/signals");
  if (loading || !data) return <p className="text-sm text-muted-foreground">Calculating signal lift…</p>;

  return (
    <div>
      <PageHeader
        title="Signals"
        description="Behaviors associated with the primary goal. Lift is conversion-rate difference versus users without the signal. This is correlation, with a minimum sample threshold and a simple confidence interval."
      />
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{data.warning}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.signals.map((signal) => (
          <Card key={signal.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{signal.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{signal.description}</p>
              </div>
              <Badge variant={signal.stats.polarity === "positive" ? "success" : signal.stats.polarity === "negative" ? "danger" : "secondary"}>
                {signal.stats.polarity} {formatLift(signal.stats.lift)}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div>Affected users: {signal.stats.usersWithSignal}</div>
              <div>Conversion when present: {formatPercent(signal.stats.conversionWithSignal)}</div>
              <div>Baseline conversion: {formatPercent(signal.stats.conversionWithoutSignal)}</div>
              <div>Evidence: {signal.stats.confidence}{signal.stats.belowSampleThreshold ? " · below sample threshold" : ""}</div>
              <div>Strongest segment: {signal.stats.strongestSegment ?? "—"}</div>
              <p className="text-muted-foreground">{signal.interpretation}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
