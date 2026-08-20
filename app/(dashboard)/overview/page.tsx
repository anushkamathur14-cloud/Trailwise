"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useApi } from "@/hooks/use-api";
import { formatNumber, formatPercent } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";
import { RetentionPanel } from "@/components/retention-panel";
import { productRecommendations } from "@/lib/recommendations/engine";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

type Overview = {
  activeUsers: number;
  activeUsersChange: number;
  newUsers: number;
  newUsersChange: number;
  sessions: number;
  sessionsChange: number;
  activationRate: number;
  activationRateChange: number;
  conversionRate: number;
  conversionRateChange: number;
  retentionRate: number;
  eventsOverTime: Array<{ date: string; count: number }>;
  eventsOverTimeByName?: Array<{ date: string; [eventName: string]: string | number }>;
  channels: Array<{ name: string; count: number }>;
  features: Array<{ name: string; count: number }>;
};

function Kpi({
  label,
  value,
  change,
  hint,
}: {
  label: string;
  value: string;
  change: number;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader>
        <Tooltip content={hint}>
          <CardTitle className="cursor-help text-muted-foreground">{label}</CardTitle>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <div className={change >= 0 ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>
          {change >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(change))} vs prior period
        </div>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = ["#4f46e5", "#0f766e", "#b45309", "#be123c", "#7c3aed", "#0284c7"];

export default function OverviewPage() {
  const { workspace, workspaceId } = useWorkspace();
  const [segment, setSegment] = useState("");
  const [channel, setChannel] = useState("");
  const [compareEvents, setCompareEvents] = useState<string[]>([]);
  const qs = [segment && `segment=${segment}`, channel && `channel=${channel}`].filter(Boolean).join("&");
  const { data, loading, error } = useApi<Overview>(`/api/analytics/overview${qs ? `?${qs}` : ""}`, qs);

  const topEventNames = useMemo(() => (data?.features ?? []).slice(0, 6).map((f) => f.name), [data]);
  const tldr = useMemo(() => productRecommendations(workspaceId).slice(0, 3), [workspaceId]);

  function toggleCompare(name: string) {
    setCompareEvents((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name].slice(0, 4),
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading metrics from stored events…</p>;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <p className="font-medium">Could not load overview.</p>
        <p className="mt-1 text-rose-700">{error ?? "No data returned from /api/analytics/overview."}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`${workspace.productName} product analytics — engagement, activation, and monetization from first-party events (not only install attribution).`}
      />

      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>TLDR summary</CardTitle>
            <Badge variant="secondary">
              Activation {formatPercent(data.activationRate)} · Conversion {formatPercent(data.conversionRate)} · D1{" "}
              {formatPercent(data.retentionRate)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            What matters now for {workspace.productName}: the opportunity (impact), what to change (action), and the expected lift if you ship it.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          {tldr.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Impact</div>
                <Badge>{item.confidence}</Badge>
              </div>
              <p className="mt-2 text-sm leading-5">{item.impact}</p>
              <div className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended action</div>
              <p className="mt-1 text-sm font-medium leading-5">{item.change}</p>
              <div className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected impact</div>
              <p className="mt-1 text-sm text-emerald-800">{item.expectedImpact}</p>
              <Button asChild size="sm" variant="outline" className="mt-4 w-full">
                <Link href={`/studio?preview=${item.previewId}`}>Preview in Tester Mode</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <label>
          Persona / segment
          <select className="ml-2 h-9 rounded-md border px-2" value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">All personas</option>
            {workspace.segments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Channel
          <select className="ml-2 h-9 rounded-md border px-2" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">All</option>
            {workspace.acquisitionChannels.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      {segment && (
        <p className="mb-4 text-sm text-muted-foreground">
          {workspace.segments.find((s) => s.id === segment)?.description}
        </p>
      )}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {workspace.segments.map((item) => (
          <button
            key={item.id}
            onClick={() => setSegment(segment === item.id ? "" : item.id)}
            className={`rounded-lg border p-3 text-left text-sm ${segment === item.id ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <div className="font-medium">{item.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Active users" value={formatNumber(data.activeUsers)} change={data.activeUsersChange} hint="People with at least one event in the selected window." />
        <Kpi label="New users" value={formatNumber(data.newUsers)} change={data.newUsersChange} hint="Profiles whose firstSeen falls inside the window." />
        <Kpi label="Sessions" value={formatNumber(data.sessions)} change={data.sessionsChange} hint="Sessions expire after 30 minutes of inactivity." />
        <Kpi label="Activation rate" value={formatPercent(data.activationRate)} change={data.activationRateChange} hint={workspace.primaryGoal.description} />
        <Kpi label="Conversion rate" value={formatPercent(data.conversionRate)} change={data.conversionRateChange} hint={workspace.secondaryGoal.description} />
        <Kpi label="Day-1 retention" value={formatPercent(data.retentionRate)} change={0} hint="Share of new users with activity on the calendar day after first seen (UTC)." />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All events over time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Total event volume across every event name. Use compare chips below to overlay specific events.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {topEventNames.map((name) => (
                <button
                  key={name}
                  onClick={() => toggleCompare(name)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${compareEvents.includes(name) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {name.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {compareEvents.length === 0 ? (
                  <AreaChart data={data.eventsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Area type="monotone" dataKey="count" name="All events" stroke="#4f46e5" fill="#c7d2fe" />
                  </AreaChart>
                ) : (
                  <LineChart data={buildCompareSeries(data.eventsOverTime, data.features, compareEvents)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Legend />
                    {compareEvents.map((name, index) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[index % CHART_COLORS.length]} dot={false} strokeWidth={2} />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acquisition channels</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.channels} layout="vertical" margin={{ left: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <RTooltip />
                <Bar dataKey="count" fill="#0f766e" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Top events (all tracked)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.features.map((item) => (
            <div key={item.name} className="rounded-lg border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{item.name.replace(/_/g, " ")}</div>
              <div className="text-lg font-semibold">{formatNumber(item.count)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <RetentionPanel />
    </div>
  );
}

/** Demo compare series: distribute daily totals across selected events by their overall share. */
function buildCompareSeries(
  daily: Array<{ date: string; count: number }>,
  features: Array<{ name: string; count: number }>,
  selected: string[],
) {
  const total = features.reduce((sum, item) => sum + item.count, 0) || 1;
  const shares = Object.fromEntries(
    selected.map((name) => {
      const feature = features.find((item) => item.name === name);
      return [name, (feature?.count ?? 0) / total];
    }),
  );
  return daily.map((row) => {
    const point: Record<string, string | number> = { date: row.date };
    for (const name of selected) {
      point[name] = Math.round(row.count * (shares[name] ?? 0));
    }
    return point;
  });
}
