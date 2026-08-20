"use client";

import { useEffect, useMemo, useState } from "react";
import { sankey as d3sankey, sankeyLinkHorizontal } from "d3-sankey";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeviceFilter } from "@/components/device-filter";
import { useApi } from "@/hooks/use-api";
import { useWorkspace } from "@/components/workspace-provider";
import { eventDefinitionsFor, labelForEvent } from "@/lib/events/catalog";
import { formatNumber, formatPercent } from "@/lib/utils";

type Graph = {
  nodes: Array<{ id: string; label: string; count: number; step: number; eventName: string }>;
  links: Array<{ source: string; target: string; value: number }>;
  successfulPath: string[];
  failurePath: string[];
  explanation: string;
  entered?: number;
  completed?: number;
  abandoned?: number;
};

export default function JourneysPage() {
  const { workspaceId, workspace } = useWorkspace();
  const defs = useMemo(() => eventDefinitionsFor(workspaceId), [workspaceId]);
  const [start, setStart] = useState(workspace.defaultJourney.start);
  const [end, setEnd] = useState(workspace.defaultJourney.end);
  const [maxSteps, setMaxSteps] = useState(7);
  const [device, setDevice] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setStart(workspace.defaultJourney.start);
    setEnd(workspace.defaultJourney.end);
    setMaxSteps(7);
    setDevice("");
  }, [workspaceId, workspace.defaultJourney.start, workspace.defaultJourney.end]);

  const { data, loading, error } = useApi<Graph>(
    `/api/analytics/journeys?start=${start}&end=${end}&maxSteps=${maxSteps}${device ? `&device=${device}` : ""}`,
    `${start}-${end}-${maxSteps}-${workspaceId}-${device}`,
  );

  const totals = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;
    const startNodes = data.nodes.filter((n) => n.step === 0);
    const entered = startNodes.reduce((sum, n) => sum + n.count, 0);
    const endCount = data.nodes.filter((n) => n.eventName === end).reduce((sum, n) => sum + n.count, 0);
    return { entered, completed: endCount, abandoned: Math.max(0, entered - endCount) };
  }, [data, end]);

  return (
    <div>
      <PageHeader
        title="Journeys"
        description={
          <span>
            Path from start to outcome for {workspace.name}.{" "}
            <button type="button" className="text-primary underline" onClick={() => setShowHelp((v) => !v)}>
              How to read this
            </button>
          </span>
        }
      />
      {showHelp && (
        <Card className="mb-4">
          <CardContent className="space-y-1 p-4 text-sm text-muted-foreground">
            <p>Wider ribbons = more users. Indigo nodes sit on the most successful path; rose on the most common failure path.</p>
            <p>Rare late-stage branches are pruned so the right side stays readable. Click a node to inspect it.</p>
          </CardContent>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">
          Start
          <select className="ml-2 h-9 rounded-md border px-2" value={start} onChange={(e) => setStart(e.target.value)}>
            {defs.map((item) => (
              <option key={item.name} value={item.name}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          End
          <select className="ml-2 h-9 rounded-md border px-2" value={end} onChange={(e) => setEnd(e.target.value)}>
            {defs.map((item) => (
              <option key={item.name} value={item.name}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Max steps
          <input
            type="number"
            min={3}
            max={8}
            className="ml-2 h-9 w-16 rounded-md border px-2"
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
          />
        </label>
        <DeviceFilter workspaceId={workspaceId} value={device} onChange={setDevice} />
      </div>

      {totals && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span>
            Entered: <strong>{formatNumber(totals.entered)}</strong>
          </span>
          <span>
            Completed: <strong>{formatNumber(totals.completed)}</strong> (
            {formatPercent(totals.entered ? totals.completed / totals.entered : 0)})
          </span>
          <span>
            Abandoned / incomplete: <strong>{formatNumber(totals.abandoned)}</strong>
          </span>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-indigo-600" /> Successful
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-slate-700" /> Neutral
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-600" /> Failure
            </span>
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-[440px] animate-pulse rounded-lg bg-muted/40" />
          ) : error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : !data || data.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No journeys for this selection. Try clearing the device filter or choosing a broader start/end pair.
            </p>
          ) : (
            <SankeyChart
              graph={data}
              workspaceId={workspaceId}
              onSelect={setSelected}
              entered={totals?.entered ?? 0}
            />
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Most successful path</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {data.successfulPath.length
                ? data.successfulPath.map((name) => labelForEvent(workspaceId, name)).join(" → ")
                : "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Most common failure path</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {data.failurePath.length
                ? data.failurePath.map((name) => labelForEvent(workspaceId, name)).join(" → ")
                : "—"}
            </CardContent>
          </Card>
        </div>
      )}

      {selected && (
        <div className="mt-4">
          <Button variant="outline" onClick={() => setSelected(null)}>
            Clear selection
          </Button>
          <p className="mt-2 text-sm text-muted-foreground">Selected: {selected}</p>
        </div>
      )}
    </div>
  );
}

function SankeyChart({
  graph,
  workspaceId,
  onSelect,
  entered,
}: {
  graph: Graph;
  workspaceId: Parameters<typeof labelForEvent>[0];
  onSelect: (id: string) => void;
  entered: number;
}) {
  const width = 960;
  const height = 440;
  try {
    const layout = d3sankey<{ id: string; label: string; count: number; eventName: string }, { value: number }>()
      .nodeId((node) => node.id)
      .nodeWidth(14)
      .nodePadding(18)
      .extent([
        [16, 16],
        [width - 16, height - 16],
      ]);
    const { nodes, links } = layout({
      nodes: graph.nodes.map((node) => ({
        ...node,
        label: `${node.step + 1}. ${labelForEvent(workspaceId, node.eventName)}`,
      })),
      links: graph.links.map((link) => ({ source: link.source, target: link.target, value: link.value })),
    });
    const successEvents = new Set(graph.successfulPath);
    const failEvents = new Set(graph.failurePath);
    const path = sankeyLinkHorizontal();
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[440px] w-full">
        {links.map((link, index) => (
          <path
            key={index}
            d={path(link) ?? undefined}
            fill="none"
            stroke="#94a3b8"
            strokeOpacity={0.35}
            strokeWidth={Math.max(1, Number(link.width))}
          >
            <title>
              {formatNumber(link.value)} users ({formatPercent(entered ? link.value / entered : 0)} of entrants)
            </title>
          </path>
        ))}
        {nodes.map((node) => {
          const fill = successEvents.has(node.eventName)
            ? "#4f46e5"
            : failEvents.has(node.eventName)
              ? "#e11d48"
              : "#334155";
          return (
            <g
              key={node.id}
              transform={`translate(${node.x0},${node.y0})`}
              onClick={() => onSelect(`${node.label} · ${formatNumber(node.count)} users`)}
              className="cursor-pointer"
            >
              <title>
                {node.label}: {formatNumber(node.count)} users (
                {formatPercent(entered ? node.count / entered : 0)} of entrants)
              </title>
              <rect
                width={(node.x1 ?? 0) - (node.x0 ?? 0)}
                height={Math.max(2, (node.y1 ?? 0) - (node.y0 ?? 0))}
                fill={fill}
                rx={3}
              />
              <text x={20} y={Math.max(10, ((node.y1 ?? 0) - (node.y0 ?? 0)) / 2 + 4)} fontSize={11} fill="#0f172a">
                {node.label} ({node.count})
              </text>
            </g>
          );
        })}
      </svg>
    );
  } catch (error) {
    return (
      <p className="text-sm text-rose-700">
        Could not render journey graph: {error instanceof Error ? error.message : "layout error"}
      </p>
    );
  }
}
