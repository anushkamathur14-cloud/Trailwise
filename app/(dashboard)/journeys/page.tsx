"use client";

import { useMemo, useState } from "react";
import { sankey as d3sankey, sankeyLinkHorizontal } from "d3-sankey";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useWorkspace } from "@/components/workspace-provider";
import { getWorkspace } from "@/lib/workspace";

type Graph = {
  nodes: Array<{ id: string; label: string; count: number }>;
  links: Array<{ source: string; target: string; value: number }>;
  successfulPath: string[];
  failurePath: string[];
};

export default function JourneysPage() {
  const { workspaceId, workspace } = useWorkspace();
  const config = getWorkspace(workspaceId);
  const [start, setStart] = useState(config.defaultJourney.start);
  const [end, setEnd] = useState(config.defaultJourney.end);
  const [maxSteps, setMaxSteps] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading } = useApi<Graph>(
    `/api/analytics/journeys?start=${start}&end=${end}&maxSteps=${maxSteps}`,
    `${start}-${end}-${maxSteps}-${workspaceId}`,
  );

  const events = useMemo(() => {
    const names = new Set<string>();
    workspace.funnels.forEach((funnel) => funnel.steps.forEach((step) => names.add(step.eventName)));
    return [...names];
  }, [workspace]);

  return (
    <div>
      <PageHeader
        title="Journeys"
        description="Common routes from an entry event to an outcome. Node size is unique users. Highlighted paths are the most successful and the most common failure route."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">
          Start
          <select className="ml-2 h-9 rounded-md border px-2" value={start} onChange={(e) => setStart(e.target.value)}>
            {events.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          End
          <select className="ml-2 h-9 rounded-md border px-2" value={end} onChange={(e) => setEnd(e.target.value)}>
            {events.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Max steps
          <input
            type="number"
            min={3}
            max={12}
            className="ml-2 h-9 w-16 rounded-md border px-2"
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
          />
        </label>
      </div>
      <Card>
        <CardContent className="p-4">
          {loading || !data ? (
            <p className="text-sm text-muted-foreground">Building path graph…</p>
          ) : data.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No journeys for this selection.</p>
          ) : (
            <SankeyChart graph={data} onSelect={setSelected} />
          )}
        </CardContent>
      </Card>
      {data && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Most successful path</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{data.successfulPath.join(" → ") || "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Most common failure path</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{data.failurePath.join(" → ") || "—"}</CardContent>
          </Card>
        </div>
      )}
      {selected && (
        <div className="mt-4">
          <Button variant="outline" onClick={() => setSelected(null)}>
            Clear {selected}
          </Button>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect this node in Users by searching for people who fired {selected.replace(/_/g, " ")}.
          </p>
        </div>
      )}
    </div>
  );
}

function SankeyChart({ graph, onSelect }: { graph: Graph; onSelect: (id: string) => void }) {
  const width = 920;
  const height = 420;
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const layout = d3sankey<{ id: string; label: string; count: number }, { value: number }>()
    .nodeId((node) => node.id)
    .nodeWidth(16)
    .nodePadding(18)
    .extent([
      [12, 12],
      [width - 12, height - 12],
    ]);
  const { nodes, links } = layout({
    nodes: graph.nodes.map((node) => ({ ...node })),
    links: graph.links
      .filter((link) => nodeMap.has(link.source) && nodeMap.has(link.target))
      .map((link) => ({ source: link.source, target: link.target, value: link.value })),
  });
  const success = new Set(graph.successfulPath);
  const fail = new Set(graph.failurePath);
  const path = sankeyLinkHorizontal();

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[420px] w-full">
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
      {nodes.map((node) => (
        <g key={node.id} transform={`translate(${node.x0},${node.y0})`} onClick={() => onSelect(node.id)} className="cursor-pointer">
          <rect
            width={(node.x1 ?? 0) - (node.x0 ?? 0)}
            height={(node.y1 ?? 0) - (node.y0 ?? 0)}
            fill={success.has(node.id) ? "#4f46e5" : fail.has(node.id) ? "#e11d48" : "#334155"}
            rx={3}
          />
          <text x={20} y={((node.y1 ?? 0) - (node.y0 ?? 0)) / 2 + 4} fontSize={11} fill="#0f172a">
            {node.label} ({node.count})
          </text>
        </g>
      ))}
    </svg>
  );
}
