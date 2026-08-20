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
 */
export function buildJourneyGraph(
  events: PathEvent[],
  options: { start: string; end?: string; maxSteps: number },
): JourneyGraph {
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

  const paths = [...pathCounts.values()];
  const successful = paths
    .filter((path) => (options.end ? path.path.includes(options.end) : !path.path.some(isFailure)))
    .sort((a, b) => b.converted - a.converted || b.count - a.count)[0];
  const failure = paths
    .filter((path) => path.path.some(isFailure) || (options.end && !path.path.includes(options.end)))
    .sort((a, b) => b.count - a.count)[0];

  return {
    nodes: [...nodeCounts.entries()].map(([id, meta]) => ({
      id,
      label: `${meta.step + 1}. ${meta.eventName.replace(/_/g, " ")}`,
      count: meta.count,
      step: meta.step,
      eventName: meta.eventName,
    })),
    links: [...linkCounts.entries()].map(([key, value]) => {
      const [source, target] = key.split("→");
      return { source, target, value };
    }),
    successfulPath: successful?.path ?? [],
    failurePath: failure?.path ?? [],
    explanation:
      "Each column is a step from your start event. The same event name can appear in multiple columns if it occurs at different depths. Flows never loop, so the Sankey stays readable.",
  };
}
