export type PathEvent = {
  personId: string;
  eventName: string;
  timestamp: Date;
};

export type JourneyGraph = {
  nodes: Array<{ id: string; label: string; count: number; step: number; eventName: string }>;
  links: Array<{ source: string; target: string; value: number }>;
  successfulPath: string[];
  failurePath: string[];
  explanation: string;
};

const FAILURE_HINTS = ["abandoned", "error", "denied", "dismissed", "canceled", "skipped"];

function isFailure(eventName: string): boolean {
  return FAILURE_HINTS.some((hint) => eventName.includes(hint));
}

/**
 * Build a layered (acyclic) journey graph.
 * Nodes are step-indexed (`0:landing_viewed`) so revisits cannot create cycles for Sankey.
 * Later steps are pruned so the right side of the chart stays readable.
 */
export function buildJourneyGraph(
  events: PathEvent[],
  options: { start: string; end?: string; maxSteps: number; minLinkShare?: number; maxBranchesPerStep?: number },
): JourneyGraph {
  const minLinkShare = options.minLinkShare ?? 0.04;
  const maxBranches = options.maxBranchesPerStep ?? 3;
  const byPerson = new Map<string, PathEvent[]>();
  for (const event of events) {
    const list = byPerson.get(event.personId) ?? [];
    list.push(event);
    byPerson.set(event.personId, list);
  }

  const nodeCounts = new Map<string, { count: number; step: number; eventName: string }>();
  const linkCounts = new Map<string, number>();
  const pathCounts = new Map<string, { path: string[]; count: number; converted: number }>();

  for (const personEvents of byPerson.values()) {
    const ordered = [...personEvents].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const startIndex = ordered.findIndex((event) => event.eventName === options.start);
    if (startIndex < 0) continue;
    const slice = ordered.slice(startIndex);
    const names: string[] = [];
    for (const event of slice) {
      if (names[names.length - 1] === event.eventName) continue;
      names.push(event.eventName);
      if (options.end && event.eventName === options.end) break;
      if (names.length >= options.maxSteps) break;
    }
    if (names.length === 0) continue;

    for (let step = 0; step < names.length; step++) {
      const id = `${step}:${names[step]}`;
      const current = nodeCounts.get(id) ?? { count: 0, step, eventName: names[step] };
      current.count += 1;
      nodeCounts.set(id, current);
    }
    for (let i = 0; i < names.length - 1; i++) {
      const key = `${i}:${names[i]}→${i + 1}:${names[i + 1]}`;
      linkCounts.set(key, (linkCounts.get(key) ?? 0) + 1);
    }
    const pathKey = names.join("→");
    const current = pathCounts.get(pathKey) ?? { path: names, count: 0, converted: 0 };
    current.count += 1;
    if (options.end && names.includes(options.end)) current.converted += 1;
    pathCounts.set(pathKey, current);
  }

  // Prune rare late-stage branches so the Sankey does not fan out into noise.
  const stepVolume = new Map<number, number>();
  for (const meta of nodeCounts.values()) {
    stepVolume.set(meta.step, (stepVolume.get(meta.step) ?? 0) + meta.count);
  }

  const linksBySource = new Map<string, Array<{ key: string; value: number; target: string }>>();
  for (const [key, value] of linkCounts.entries()) {
    const [source, target] = key.split("→");
    const list = linksBySource.get(source) ?? [];
    list.push({ key, value, target });
    linksBySource.set(source, list);
  }

  const keptLinks = new Map<string, number>();
  const keptNodes = new Set<string>();

  // Always keep step-0 nodes that appeared
  for (const [id, meta] of nodeCounts.entries()) {
    if (meta.step === 0) keptNodes.add(id);
  }

  const sources = [...linksBySource.keys()].sort((a, b) => Number(a.split(":")[0]) - Number(b.split(":")[0]));
  for (const source of sources) {
    if (!keptNodes.has(source) && Number(source.split(":")[0]) > 0) continue;
    const step = Number(source.split(":")[0]);
    const volume = stepVolume.get(step) ?? 1;
    let candidates = [...(linksBySource.get(source) ?? [])].sort((a, b) => b.value - a.value);
    // Stricter pruning after the first few steps
    const branchCap = step >= 3 ? Math.min(2, maxBranches) : maxBranches;
    const shareFloor = step >= 3 ? Math.max(minLinkShare, 0.08) : minLinkShare;
    candidates = candidates.filter((link) => link.value / volume >= shareFloor || step < 2).slice(0, branchCap);
    for (const link of candidates) {
      keptLinks.set(link.key, link.value);
      keptNodes.add(source);
      keptNodes.add(link.target);
    }
  }

  // Ensure end-event nodes on successful paths remain if present
  if (options.end) {
    for (const [id, meta] of nodeCounts.entries()) {
      if (meta.eventName === options.end) keptNodes.add(id);
    }
  }

  const paths = [...pathCounts.values()];
  const successful = paths
    .filter((path) => (options.end ? path.path.includes(options.end) : !path.path.some(isFailure)))
    .sort((a, b) => b.converted - a.converted || b.count - a.count)[0];
  const failure = paths
    .filter((path) => path.path.some(isFailure) || (options.end && !path.path.includes(options.end)))
    .sort((a, b) => b.count - a.count)[0];

  return {
    nodes: [...nodeCounts.entries()]
      .filter(([id]) => keptNodes.has(id))
      .map(([id, meta]) => ({
        id,
        label: `${meta.step + 1}. ${meta.eventName.replace(/_/g, " ")}`,
        count: meta.count,
        step: meta.step,
        eventName: meta.eventName,
      })),
    links: [...keptLinks.entries()].map(([key, value]) => {
      const [source, target] = key.split("→");
      return { source, target, value };
    }),
    successfulPath: successful?.path ?? [],
    failurePath: failure?.path ?? [],
    explanation:
      "Each column is a step from your start event. Rare late-stage branches are hidden so the end of the path stays readable — toggle max steps down for an even sharper view.",
  };
}
