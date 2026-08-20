"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { DeviceFilter } from "@/components/device-filter";
import { useApi } from "@/hooks/use-api";
import { formatNumber, formatPercent, formatPeriodChange } from "@/lib/utils";
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
  activeUsersChange: number | null;
  activeUsersChangeUnavailable?: string | null;
  activeUsersPrior?: number;
  newUsers: number;
  newUsersChange: number | null;
  newUsersChangeUnavailable?: string | null;
  newUsersPrior?: number;
  sessions: number;
  sessionsChange: number | null;
  sessionsChangeUnavailable?: string | null;
  sessionsPrior?: number;
  activationRate: number;
  activationRateChange: number | null;
  activationRateChangeUnavailable?: string | null;
  activationRatePrior?: number;
  conversionRate: number;
  conversionRateChange: number | null;
  conversionRateChangeUnavailable?: string | null;
  conversionRatePrior?: number;
  retentionRate: number | null;
  retentionRateChange: number | null;
  retentionRateChangeUnavailable?: string | null;
  retentionRatePrior?: number | null;
  eventsOverTime: Array<{ date: string; count: number }>;
  channels: Array<{ name: string; count: number }>;
  features: Array<{ name: string; count: number }>;
  primaryGoalDescription?: string;
  secondaryGoalDescription?: string;
  retentionEventDescription?: string;
};

const DEMO_TO = "2026-08-18T23:59:59.000Z";

function rangeForPreset(preset: string): { from: string; to: string } {
  const to = new Date(DEMO_TO);
  const from = new Date(DEMO_TO);
  if (preset === "7") from.setUTCDate(from.getUTCDate() - 6);
  else if (preset === "14") from.setUTCDate(from.getUTCDate() - 13);
  else from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function Kpi({
  label,
  value,
  change,
  unavailable,
  prior,
  kind,
  hint,
}: {
  label: string;
  value: string;
  change: number | null | undefined;
  unavailable?: string | null;
  prior?: number;
  kind: "count" | "rate";
  hint: string;
}) {
  const changeLabel = formatPeriodChange(change, kind, unavailable);
  const up = (change ?? 0) >= 0 && !unavailable;
  return (
    <Card>
      <CardHeader>
        <Tooltip content={hint}>
          <CardTitle className="cursor-help text-muted-foreground">{label}</CardTitle>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <Tooltip
          content={
            prior === undefined || change === null || change === undefined
              ? changeLabel
              : `Current ${value} · Prior ${kind === "rate" ? formatPercent(prior) : formatNumber(prior)}`
          }
        >
          <div className={`cursor-help text-xs ${unavailable ? "text-muted-foreground" : up ? "text-emerald-700" : "text-rose-700"}`}>
            {!unavailable && (up ? "▲ " : "▼ ")}
            {changeLabel}
            {!unavailable ? " vs prior period" : ""}
          </div>
        </Tooltip>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = ["#4f46e5", "#0f766e", "#b45309", "#be123c", "#7c3aed", "#0284c7"];

export default function OverviewPage() {
  const { workspace, workspaceId } = useWorkspace();
  const [segment, setSegment] = useState("");
  const [channel, setChannel] = useState("");
  const [device, setDevice] = useState("");
  const [preset, setPreset] = useState("30");
  const [compareEvents, setCompareEvents] = useState<string[]>([]);
  const range = useMemo(() => rangeForPreset(preset), [preset]);
  const qs = [
    `from=${encodeURIComponent(range.from)}`,
    `to=${encodeURIComponent(range.to)}`,
    segment && `segment=${segment}`,
    channel && `channel=${channel}`,
    device && `device=${device}`,
  ]
    .filter(Boolean)
    .join("&");
  const { data, loading, error } = useApi<Overview>(`/api/analytics/overview?${qs}`, qs);

  const topEventNames = useMemo(() => (data?.features ?? []).slice(0, 6).map((f) => f.name), [data]);
  const recommendations = useMemo(() => productRecommendations(workspaceId), [workspaceId]);
  const hero = recommendations[0];
  const rest = recommendations.slice(1);

  function toggleCompare(name: string) {
    setCompareEvents((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name].slice(0, 4),
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Overview" description={workspace.productDescription} />
        <div className="mb-6 h-36 animate-pulse rounded-xl border bg-muted/40" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
        <div className="mt-6 h-72 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <p className="font-medium">Could not load overview.</p>
        <p className="mt-1">{error ?? "No data returned."}</p>
        <Button className="mt-3" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Overview" description={workspace.productDescription} />

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <label>
          Date range
          <select className="ml-2 h-9 rounded-md border px-2" value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>
        <DeviceFilter workspaceId={workspaceId} value={device} onChange={setDevice} />
        <label>
          Persona
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

      {hero && (
        <Card className="mb-6 border-primary/25 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {hero.impactDirection === "increase" ? "Priority: High" : "Priority: Medium"}
                </Badge>
                <Badge>
                  {hero.confidence === "high" ? "High confidence" : hero.confidence === "medium" ? "Medium confidence" : "Exploratory"}
                </Badge>
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Problem</div>
              <p className="font-medium leading-snug">{hero.impact}</p>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</div>
              <p>{hero.evidence}</p>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommended action</div>
              <p>{hero.change}</p>
            </div>
            <div className="flex flex-col justify-between gap-3 rounded-lg border bg-background/80 p-4 text-sm">
              <div className="space-y-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated impact</div>
                  <p className="mt-1 font-medium text-emerald-800">{hero.expectedImpact}</p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Target segment</div>
                  <p className="mt-1">{hero.segment}</p>
                </div>
              </div>
              <Button asChild>
                <Link href={`/studio?preview=${hero.previewId}`}>Preview change</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="Active users"
          value={formatNumber(data.activeUsers)}
          change={data.activeUsersChange}
          unavailable={data.activeUsersChangeUnavailable}
          prior={data.activeUsersPrior}
          kind="count"
          hint="Users with at least one event in the selected window."
        />
        <Kpi
          label="New users"
          value={formatNumber(data.newUsers)}
          change={data.newUsersChange}
          unavailable={data.newUsersChangeUnavailable}
          prior={data.newUsersPrior}
          kind="count"
          hint="Profiles whose firstSeen falls inside the window."
        />
        <Kpi
          label="Sessions"
          value={formatNumber(data.sessions)}
          change={data.sessionsChange}
          unavailable={data.sessionsChangeUnavailable}
          prior={data.sessionsPrior}
          kind="count"
          hint="Sessions expire after 30 minutes of inactivity."
        />
        <Kpi
          label="Activation rate"
          value={formatPercent(data.activationRate)}
          change={data.activationRateChange}
          unavailable={data.activationRateChangeUnavailable}
          prior={data.activationRatePrior}
          kind="rate"
          hint={data.primaryGoalDescription ?? workspace.primaryGoal.description}
        />
        <Kpi
          label="Conversion rate"
          value={formatPercent(data.conversionRate)}
          change={data.conversionRateChange}
          unavailable={data.conversionRateChangeUnavailable}
          prior={data.conversionRatePrior}
          kind="rate"
          hint={data.secondaryGoalDescription ?? workspace.secondaryGoal.description}
        />
        <Kpi
          label="Day-1 retention"
          value={data.retentionRate == null ? "—" : formatPercent(data.retentionRate)}
          change={data.retentionRateChange}
          unavailable={data.retentionRateChangeUnavailable}
          prior={data.retentionRatePrior ?? undefined}
          kind="rate"
          hint={data.retentionEventDescription ?? workspace.retentionEvent.description}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Event activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              {topEventNames.map((name) => (
                <button
                  key={name}
                  onClick={() => toggleCompare(name)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${compareEvents.includes(name) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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

      {rest.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>More recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rest.map((item, index) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">
                    #{index + 2} {item.title}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.impact}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/studio?preview=${item.previewId}`}>Preview change</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-4">
        <RetentionPanel />
      </div>
    </div>
  );
}

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
