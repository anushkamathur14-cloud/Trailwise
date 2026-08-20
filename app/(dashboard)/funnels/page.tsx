"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDuration, formatPercent } from "@/lib/utils";

type FunnelResponse = {
  funnel: { id: string; name: string; description: string; steps: Array<{ eventName: string; label: string }> };
  result: {
    overallConversion: number;
    steps: Array<{
      label: string;
      count: number;
      conversionFromStart: number;
      dropOff: number;
      medianTimeFromPreviousMs: number | null;
    }>;
  };
  abandoned: string[];
};

export default function FunnelsPage() {
  const { workspace } = useWorkspace();
  const [funnelId, setFunnelId] = useState(workspace.funnels[0].id);
  const [abandonedStep, setAbandonedStep] = useState<number | null>(null);
  const { data, loading } = useApi<FunnelResponse>(
    `/api/analytics/funnels?funnel=${funnelId}${abandonedStep !== null ? `&abandonedStep=${abandonedStep}` : ""}`,
    `${funnelId}-${abandonedStep}`,
  );

  return (
    <div>
      <PageHeader
        title="Funnels"
        description="Ordered conversion with drop-off and median time between steps. Click a step to list users who stalled there."
      />
      <div className="mb-4 flex gap-2">
        {workspace.funnels.map((funnel) => (
          <Button key={funnel.id} variant={funnel.id === funnelId ? "default" : "outline"} onClick={() => setFunnelId(funnel.id)}>
            {funnel.name}
          </Button>
        ))}
      </div>
      {loading || !data ? (
        <p className="text-sm text-muted-foreground">Calculating funnel…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {data.funnel.name} · {formatPercent(data.result.overallConversion)} completed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.result.steps.map((step, index) => (
                <button
                  key={step.label}
                  className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/50"
                  onClick={() => setAbandonedStep(index)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {index + 1}. {step.label}
                    </span>
                    <span>
                      {step.count} · {formatPercent(step.conversionFromStart)} from start
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.max(4, step.conversionFromStart * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Drop-off {formatPercent(step.dropOff)}
                    {step.medianTimeFromPreviousMs ? ` · median ${formatDuration(step.medianTimeFromPreviousMs)} from previous` : ""}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Abandoned users</CardTitle>
            </CardHeader>
            <CardContent>
              {abandonedStep === null ? (
                <p className="text-sm text-muted-foreground">Select a step to list people who did not continue.</p>
              ) : data.abandoned.length === 0 ? (
                <p className="text-sm text-muted-foreground">No abandoners at this step in the current window.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.abandoned.map((id) => (
                    <li key={id}>
                      <a className="text-primary hover:underline" href={`/users/${id}`}>
                        {id}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
