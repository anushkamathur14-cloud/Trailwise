"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeviceFilter } from "@/components/device-filter";
import { useApi } from "@/hooks/use-api";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDuration, formatPercent } from "@/lib/utils";

type FunnelResponse = {
  funnel: {
    id: string;
    name: string;
    kind?: string;
    description: string;
    steps: Array<{ eventName: string; label: string; conversionValue?: number }>;
  };
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
  const { workspace, workspaceId } = useWorkspace();
  const [funnelId, setFunnelId] = useState(workspace.funnels[0]?.id ?? "marketing");
  const [abandonedStep, setAbandonedStep] = useState<number | null>(null);
  const [device, setDevice] = useState("");
  const active = workspace.funnels.find((f) => f.id === funnelId) ?? workspace.funnels[0];
  const { data, loading, error } = useApi<FunnelResponse>(
    `/api/analytics/funnels?funnel=${funnelId}${abandonedStep !== null ? `&abandonedStep=${abandonedStep}` : ""}${device ? `&device=${device}` : ""}`,
    `${funnelId}-${abandonedStep}-${device}`,
  );

  return (
    <div>
      <PageHeader
        title="Funnels"
        description="Marketing funnel (acquisition) and monetization funnel (value → revenue). Each step carries a conversion value used for SKAN-style attribution scoring."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {workspace.funnels.map((funnel) => (
          <Button
            key={funnel.id}
            variant={funnel.id === funnelId ? "default" : "outline"}
            onClick={() => {
              setFunnelId(funnel.id);
              setAbandonedStep(null);
            }}
          >
            {funnel.name}
          </Button>
        ))}
        <DeviceFilter workspaceId={workspaceId} value={device} onChange={setDevice} />
      </div>
      {active && (
        <p className="mb-4 text-sm text-muted-foreground">
          {active.description} · kind: {active.kind}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Calculating funnel…</p>
      ) : error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : !data ? null : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {data.funnel.name} · {formatPercent(data.result.overallConversion)} completed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.result.steps.map((step, index) => {
                const cv = data.funnel.steps[index]?.conversionValue;
                return (
                  <button
                    key={step.label}
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/50"
                    onClick={() => setAbandonedStep(index)}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {index + 1}. {step.label}
                        {cv !== undefined && (
                          <Badge className="ml-2" variant="secondary">
                            CV {cv}
                          </Badge>
                        )}
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
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Abandoned users</CardTitle></CardHeader>
            <CardContent>
              {abandonedStep === null ? (
                <p className="text-sm text-muted-foreground">Select a step to list people who did not continue.</p>
              ) : data.abandoned.length === 0 ? (
                <p className="text-sm text-muted-foreground">No abandoners at this step in the current window.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.abandoned.map((id) => (
                    <li key={id}>
                      <a className="text-primary hover:underline" href={`/users/${id}`}>{id}</a>
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
