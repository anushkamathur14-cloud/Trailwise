"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { useApi } from "@/hooks/use-api";
import { formatPercent } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";

type RetentionResponse = {
  definition?: string;
  split: { newUsers: number; returningUsers: number };
  retention: {
    day1: number | null;
    day7: number | null;
    day30: number | null;
    cohorts: Array<{
      cohort: string;
      size: number;
      days: Array<{ day: number; rate: number | null; matured: boolean }>;
    }>;
  };
  cohorts: Array<{ id: string; name: string; description: string }>;
};

function rateLabel(rate: number | null | undefined) {
  if (rate == null) return "—";
  return formatPercent(rate);
}

export function RetentionPanel() {
  const { workspace } = useWorkspace();
  const { data } = useApi<RetentionResponse>("/api/analytics/retention");
  if (!data) return null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <Tooltip content={data.definition ?? workspace.retentionEvent.description}>
          <CardTitle className="cursor-help">Retention</CardTitle>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-sm text-muted-foreground">
          D1 {rateLabel(data.retention.day1)} · D7 {rateLabel(data.retention.day7)} · D30 {rateLabel(data.retention.day30)} · New{" "}
          {data.split.newUsers} / returning {data.split.returningUsers}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{data.definition ?? workspace.retentionEvent.description}</p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left">Cohort</th>
                {data.retention.cohorts[0]?.days.map((day) => (
                  <th key={day.day} className="px-2 py-1">
                    D{day.day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.retention.cohorts.slice(-10).map((cohort) => (
                <tr key={cohort.cohort}>
                  <td className="px-2 py-1">{cohort.cohort}</td>
                  {cohort.days.map((day) => (
                    <td
                      key={day.day}
                      className="px-2 py-1"
                      style={day.matured && day.rate != null ? { background: `rgba(79,70,229,${day.rate})` } : undefined}
                      title={!day.matured ? "Not matured" : undefined}
                    >
                      {!day.matured || day.rate == null ? "—" : `${Math.round(day.rate * 100)}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {data.cohorts.map((cohort) => (
            <div key={cohort.id} className="rounded-md border p-3">
              <div className="font-medium">{cohort.name}</div>
              <div className="text-muted-foreground">{cohort.description}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
