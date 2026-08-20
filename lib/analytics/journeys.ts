export type PathEvent = {
  personId: string;
  eventName: string;
  timestamp: Date;
};

export type JourneyGraph = {
  nodes: Array<{ id: string; label: string; count: number }>;
  links: Array<{ source: string; target: string; value: number }>;
  successfulPath: string[];
  failurePath: string[];
};

const FAILURE_HINTS = [
  "abandoned",
  "error",
  "denied",
  "dismissed",
  "canceled",
  "skipped",
];

function isFailure(eventName: string): boolean {
  return FAILURE_HINTS.some((hint) => eventName.includes(hint));
}

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

  const nodeCounts = new Map<string, number>();
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
    for (const name of names) nodeCounts.set(name, (nodeCounts.get(name) ?? 0) + 1);
    for (let i = 0; i < names.length - 1; i++) {
      const key = `${names[i]}→${names[i + 1]}`;
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
    nodes: [...nodeCounts.entries()].map(([id, count]) => ({
      id,
      label: id.replace(/_/g, " "),
      count,
    })),
    links: [...linkCounts.entries()].map(([key, value]) => {
      const [source, target] = key.split("→");
      return { source, target, value };
    }),
    successfulPath: successful?.path ?? [],
    failurePath: failure?.path ?? [],
  };
}
