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
  /** Qualifying population that reached the start event (raw, pre-prune) */
  entered: number;
  /** Users with end after start inside the journey window (raw, pre-prune) */
  completed: number;
  /** Entered but not completed inside the window */
  abandoned: number;
  windowDays: number;
};

export const OTHER_STEPS_EVENT = "__other_steps__";

const FAILURE_HINTS = ["abandoned", "error", "denied", "dismissed", "canceled", "skipped"];
const LEGACY_EVENT_ALIASES: Record<string, string> = {
  teammate_invited: "friend_invited",
  project_created: "practice_plan_created",
  project_abandoned: "practice_plan_abandoned",
  integration_connected: "wearable_connected",
  integration_error: "wearable_connection_error",
};

export function normalizeJourneyEventName(eventName: string): string {
  return LEGACY_EVENT_ALIASES[eventName] ?? eventName;
}

function isFailure(eventName: string): boolean {
  return FAILURE_HINTS.some((hint) => eventName.includes(hint));
}

function startOfWindowMs(start: Date, windowDays: number): number {
  return start.getTime() + windowDays * 86_400_000;
}

/** Collapse a long path while preserving start and end when present. */
export function collapsePathForDisplay(names: string[], maxSteps: number, end?: string): string[] {
  if (names.length === 0) return [];
  if (names.length <= maxSteps) return names;

  const endIdx = end ? names.indexOf(end) : -1;
  if (end && endIdx > 0) {
    const start = names[0];
    const middle = names.slice(1, endIdx);
    const slots = Math.max(0, maxSteps - 2);
    if (slots === 0) return [start, end];
    if (middle.length <= slots) return [start, ...middle, end];
    if (slots === 1) return [start, OTHER_STEPS_EVENT, end];
    return [start, ...middle.slice(0, slots - 1), OTHER_STEPS_EVENT, end];
  }

  return names.slice(0, maxSteps);
}

function buildOrderedNames(slice: PathEvent[], end?: string): string[] {
  const names: string[] = [];
  for (const event of slice) {
    const name = normalizeJourneyEventName(event.eventName);
    if (names[names.length - 1] === name) continue;
    names.push(name);
    if (end && name === end) break;
  }
  return names;
}

/**
 * Build a layered journey graph.
 * Completion is classified from raw events first; visualization pruning never changes counts.
 */
export function buildJourneyGraph(
  events: PathEvent[],
  options: {
    start: string;
    end?: string;
    maxSteps: number;
    windowDays?: number;
    minLinkShare?: number;
    maxBranchesPerStep?: number;
    /** Map any prior anonymous/source id → canonical person id */
    identityMap?: Map<string, string>;
  },
): JourneyGraph {
  const minLinkShare = options.minLinkShare ?? 0.04;
  const maxBranches = options.maxBranchesPerStep ?? 3;
  const windowDays = options.windowDays ?? 7;
  const startEvent = normalizeJourneyEventName(options.start);
  const endEvent = options.end ? normalizeJourneyEventName(options.end) : undefined;

  const resolveId = (id: string) => options.identityMap?.get(id) ?? id;

  const byPerson = new Map<string, PathEvent[]>();
  for (const event of events) {
    const personId = resolveId(event.personId);
    const list = byPerson.get(personId) ?? [];
    list.push({
      ...event,
      personId,
      eventName: normalizeJourneyEventName(event.eventName),
    });
    byPerson.set(personId, list);
  }

  let entered = 0;
  let completed = 0;
  const personVizPaths: Array<{ path: string[]; completed: boolean }> = [];

  for (const personEvents of byPerson.values()) {
    const ordered = [...personEvents].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const startIndex = ordered.findIndex((event) => event.eventName === startEvent);
    if (startIndex < 0) continue;

    const startAt = ordered[startIndex].timestamp;
    const windowEndMs = startOfWindowMs(startAt, windowDays);
    const inWindow = ordered.slice(startIndex).filter((event) => event.timestamp.getTime() <= windowEndMs);
    entered += 1;

    const endIndex = endEvent
      ? inWindow.findIndex((event, idx) => idx > 0 && event.eventName === endEvent)
      : -1;
    const didComplete = endEvent ? endIndex >= 0 : !inWindow.some((e) => isFailure(e.eventName));
    if (didComplete) completed += 1;

    const pathSlice = didComplete && endIndex >= 0 ? inWindow.slice(0, endIndex + 1) : inWindow;
    const fullNames = buildOrderedNames(pathSlice, endEvent);
    const vizPath = collapsePathForDisplay(fullNames, options.maxSteps, endEvent);
    if (vizPath.length === 0) continue;
    personVizPaths.push({ path: vizPath, completed: didComplete });
  }

  const abandoned = Math.max(0, entered - completed);

  const nodeCounts = new Map<string, { count: number; step: number; eventName: string }>();
  const linkCounts = new Map<string, number>();
  const pathCounts = new Map<string, { path: string[]; count: number; converted: number }>();

  for (const { path, completed: didComplete } of personVizPaths) {
    for (let step = 0; step < path.length; step++) {
      const id = `${step}:${path[step]}`;
      const current = nodeCounts.get(id) ?? { count: 0, step, eventName: path[step] };
      current.count += 1;
      nodeCounts.set(id, current);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${i}:${path[i]}→${i + 1}:${path[i + 1]}`;
      linkCounts.set(key, (linkCounts.get(key) ?? 0) + 1);
    }
    const pathKey = path.join("→");
    const current = pathCounts.get(pathKey) ?? { path, count: 0, converted: 0 };
    current.count += 1;
    if (didComplete) current.converted += 1;
    pathCounts.set(pathKey, current);
  }

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

  for (const [id, meta] of nodeCounts.entries()) {
    if (meta.step === 0) keptNodes.add(id);
  }

  const sources = [...linksBySource.keys()].sort((a, b) => Number(a.split(":")[0]) - Number(b.split(":")[0]));
  for (const source of sources) {
    if (!keptNodes.has(source) && Number(source.split(":")[0]) > 0) continue;
    const step = Number(source.split(":")[0]);
    const volume = stepVolume.get(step) ?? 1;
    let candidates = [...(linksBySource.get(source) ?? [])].sort((a, b) => b.value - a.value);
    const branchCap = step >= 3 ? Math.min(2, maxBranches) : maxBranches;
    const shareFloor = step >= 3 ? Math.max(minLinkShare, 0.08) : minLinkShare;
    candidates = candidates.filter((link) => link.value / volume >= shareFloor || step < 2).slice(0, branchCap);
    for (const link of candidates) {
      keptLinks.set(link.key, link.value);
      keptNodes.add(source);
      keptNodes.add(link.target);
    }
  }

  // Always keep end-event nodes so the successful path remains visible after prune.
  if (endEvent) {
    for (const [id, meta] of nodeCounts.entries()) {
      if (meta.eventName === endEvent || meta.eventName === OTHER_STEPS_EVENT) keptNodes.add(id);
    }
  }

  // Re-attach pruned end links from the strongest completed path if needed
  const paths = [...pathCounts.values()];
  const successful = paths
    .filter((path) => (endEvent ? path.path.includes(endEvent) : path.converted > 0))
    .sort((a, b) => b.converted - a.converted || b.count - a.count)[0];
  const failure = paths
    .filter((path) => path.path.some(isFailure) || (endEvent && !path.path.includes(endEvent)))
    .sort((a, b) => b.count - a.count)[0];

  if (successful) {
    for (let step = 0; step < successful.path.length; step++) {
      keptNodes.add(`${step}:${successful.path[step]}`);
    }
    for (let i = 0; i < successful.path.length - 1; i++) {
      const key = `${i}:${successful.path[i]}→${i + 1}:${successful.path[i + 1]}`;
      if (linkCounts.has(key)) keptLinks.set(key, linkCounts.get(key)!);
    }
  }

  return {
    nodes: [...nodeCounts.entries()]
      .filter(([id]) => keptNodes.has(id))
      .map(([id, meta]) => ({
        id,
        label:
          meta.eventName === OTHER_STEPS_EVENT
            ? `${meta.step + 1}. Other steps`
            : `${meta.step + 1}. ${meta.eventName.replace(/_/g, " ")}`,
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
    explanation: `Completion is counted when the end event occurs within ${windowDays} days of the start. Path pruning only affects the chart.`,
    entered,
    completed,
    abandoned,
    windowDays,
  };
}
