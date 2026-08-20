"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { formatPercent } from "@/lib/utils";

type RetentionResponse = {
  split: { newUsers: number; returningUsers: number };
  retention: {
    day1: number;
    day7: number;
    day30: number;
    cohorts: Array<{ cohort: string; size: number; days: Array<{ day: number; rate: number }> }>;
  };
  cohorts: Array<{ id: string; name: string; description: string }>;
};

export function RetentionPanel() {
  const { data } = useApi<RetentionResponse>("/api/analytics/retention");
  if (!data) return null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Retention</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-sm text-muted-foreground">
          D1 {formatPercent(data.retention.day1)} · D7 {formatPercent(data.retention.day7)} · D30 {formatPercent(data.retention.day30)} · New {data.split.newUsers} / returning {data.split.returningUsers}
        </div>
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
                    <td key={day.day} className="px-2 py-1" style={{ background: `rgba(79,70,229,${day.rate})` }}>
                      {Math.round(day.rate * 100)}%
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
