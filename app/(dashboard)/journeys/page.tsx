"use client";

import { useEffect, useMemo, useState } from "react";
import { sankey as d3sankey, sankeyLinkHorizontal } from "d3-sankey";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useWorkspace } from "@/components/workspace-provider";
import { eventDefinitionsFor } from "@/lib/events/catalog";

type Graph = {
  nodes: Array<{ id: string; label: string; count: number; step: number; eventName: string }>;
  links: Array<{ source: string; target: string; value: number }>;
  successfulPath: string[];
  failurePath: string[];
  explanation: string;
};

export default function JourneysPage() {
  const { workspaceId, workspace } = useWorkspace();
  const eventNames = useMemo(() => eventDefinitionsFor(workspaceId).map((e) => e.name), [workspaceId]);
  const [start, setStart] = useState(workspace.defaultJourney.start);
  const [end, setEnd] = useState(workspace.defaultJourney.end);
  const [maxSteps, setMaxSteps] = useState(8);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setStart(workspace.defaultJourney.start);
    setEnd(workspace.defaultJourney.end);
  }, [workspaceId, workspace.defaultJourney.start, workspace.defaultJourney.end]);

  const { data, loading, error } = useApi<Graph>(
    `/api/analytics/journeys?start=${start}&end=${end}&maxSteps=${maxSteps}`,
    `${start}-${end}-${maxSteps}-${workspaceId}`,
  );

  return (
    <div>
      <PageHeader
        title="Journeys"
        description="How people move from a start event to an outcome. Each column is a step depth — the same event name in two columns means it happened at different points in the path. This layered layout prevents circular Sankey links."
      />
      <Card className="mb-4">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">How to read this:</strong> Pick a start (e.g. landing / app open) and an end (activation or monetization). Trailwise builds each user’s ordered path, collapses consecutive duplicates, then stacks those paths into a flow diagram.
          </p>
          <p>
            Wider ribbons = more people took that transition. Indigo nodes sit on the most successful path; rose nodes sit on the most common failure path.
          </p>
        </CardContent>
      </Card>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">
          Start
          <select className="ml-2 h-9 rounded-md border px-2" value={start} onChange={(e) => setStart(e.target.value)}>
            {eventNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          End
          <select className="ml-2 h-9 rounded-md border px-2" value={end} onChange={(e) => setEnd(e.target.value)}>
            {eventNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Max steps
          <input type="number" min={3} max={12} className="ml-2 h-9 w-16 rounded-md border px-2" value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))} />
        </label>
      </div>
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Building path graph…</p>
          ) : error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : !data || data.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No journeys for this selection.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">{data.explanation}</p>
              <SankeyChart graph={data} onSelect={setSelected} />
            </>
          )}
        </CardContent>
      </Card>
      {data && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Most successful path</CardTitle></CardHeader>
            <CardContent className="text-sm">{data.successfulPath.join(" → ") || "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Most common failure path</CardTitle></CardHeader>
            <CardContent className="text-sm">{data.failurePath.join(" → ") || "—"}</CardContent>
          </Card>
        </div>
      )}
      {selected && (
        <div className="mt-4">
          <Button variant="outline" onClick={() => setSelected(null)}>Clear selection</Button>
          <p className="mt-2 text-sm text-muted-foreground">Selected node: {selected}</p>
        </div>
      )}
    </div>
  );
}

function SankeyChart({ graph, onSelect }: { graph: Graph; onSelect: (id: string) => void }) {
  const width = 960;
  const height = 440;
  try {
    const layout = d3sankey<{ id: string; label: string; count: number }, { value: number }>()
      .nodeId((node) => node.id)
      .nodeWidth(14)
      .nodePadding(16)
      .extent([[16, 16], [width - 16, height - 16]]);
    const { nodes, links } = layout({
      nodes: graph.nodes.map((node) => ({ ...node })),
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
          />
        ))}
        {nodes.map((node) => {
          const eventName = String(node.id).split(":")[1] || node.id;
          const fill = successEvents.has(eventName) ? "#4f46e5" : failEvents.has(eventName) ? "#e11d48" : "#334155";
          return (
            <g key={node.id} transform={`translate(${node.x0},${node.y0})`} onClick={() => onSelect(String(node.id))} className="cursor-pointer">
              <rect width={(node.x1 ?? 0) - (node.x0 ?? 0)} height={Math.max(2, (node.y1 ?? 0) - (node.y0 ?? 0))} fill={fill} rx={3} />
              <text x={20} y={Math.max(10, ((node.y1 ?? 0) - (node.y0 ?? 0)) / 2 + 4)} fontSize={11} fill="#0f172a">
                {node.label} ({node.count})
              </text>
            </g>
          );
        })}
      </svg>
    );
  } catch (error) {
    return <p className="text-sm text-rose-700">Could not render journey graph: {error instanceof Error ? error.message : "layout error"}</p>;
  }
}
