"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { useApi } from "@/hooks/use-api";
import { formatNumber, formatPercent } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";
import { RetentionPanel } from "@/components/retention-panel";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

export default function OverviewPage() {
  const { workspace } = useWorkspace();
  const [segment, setSegment] = useState("");
  const [channel, setChannel] = useState("");
  const qs = [segment && `segment=${segment}`, channel && `channel=${channel}`].filter(Boolean).join("&");
  const { data, loading, error } = useApi<Overview>(`/api/analytics/overview${qs ? `?${qs}` : ""}`, qs);

  if (loading) return <p className="text-sm text-muted-foreground">Loading metrics from stored events…</p>;
  if (error || !data) return <p className="text-sm text-rose-700">Could not load overview.</p>;

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`${workspace.productName} performance for the seeded ${workspace.platform} workspace. Metrics are computed from stored events, not hardcoded.`}
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <label>
          Segment
          <select className="ml-2 h-9 rounded-md border px-2" value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">All</option>
            {workspace.segments.map((item) => (
              <option key={item} value={item}>
                {item}
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
            <CardTitle>Events over time</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.eventsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip />
                <Area type="monotone" dataKey="count" stroke="#4f46e5" fill="#c7d2fe" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acquisition channels</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
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
          <CardTitle>Top events</CardTitle>
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
