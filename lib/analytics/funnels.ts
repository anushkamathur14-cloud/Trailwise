export type FunnelStepInput = { eventName: string; label: string };

export type PersonEvent = {
  personId: string;
  eventName: string;
  timestamp: Date;
  channel?: string | null;
  device?: string | null;
};

export type FunnelResult = {
  steps: Array<{
    eventName: string;
    label: string;
    count: number;
    conversionFromStart: number;
    conversionFromPrevious: number;
    dropOff: number;
    medianTimeFromPreviousMs: number | null;
  }>;
  started: number;
  completed: number;
  overallConversion: number;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function calculateFunnel(events: PersonEvent[], steps: FunnelStepInput[]): FunnelResult {
  const byPerson = new Map<string, PersonEvent[]>();
  for (const event of events) {
    const list = byPerson.get(event.personId) ?? [];
    list.push(event);
    byPerson.set(event.personId, list);
  }

  const reached: string[][] = steps.map(() => []);
  const times: number[][] = steps.map(() => []);

  for (const [personId, personEvents] of byPerson) {
    const ordered = [...personEvents].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let cursor = 0;
    let previousTime: Date | null = null;
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const match = ordered.slice(cursor).find((event) => event.eventName === step.eventName);
      if (!match) break;
      reached[stepIndex].push(personId);
      if (previousTime) {
        times[stepIndex].push(match.timestamp.getTime() - previousTime.getTime());
      }
      previousTime = match.timestamp;
      cursor = ordered.indexOf(match) + 1;
    }
  }

  const started = reached[0]?.length ?? 0;
  const completed = reached[reached.length - 1]?.length ?? 0;

  return {
    started,
    completed,
    overallConversion: started === 0 ? 0 : completed / started,
    steps: steps.map((step, index) => {
      const count = reached[index]?.length ?? 0;
      const previous = index === 0 ? count : (reached[index - 1]?.length ?? 0);
      return {
        eventName: step.eventName,
        label: step.label,
        count,
        conversionFromStart: started === 0 ? 0 : count / started,
        conversionFromPrevious: previous === 0 ? 0 : count / previous,
        dropOff: previous === 0 ? 0 : 1 - count / previous,
        medianTimeFromPreviousMs: index === 0 ? null : median(times[index] ?? []),
      };
    }),
  };
}

export function abandonedAtStep(
  events: PersonEvent[],
  steps: FunnelStepInput[],
  stepIndex: number,
): string[] {
  const byPerson = new Map<string, PersonEvent[]>();
  for (const event of events) {
    const list = byPerson.get(event.personId) ?? [];
    list.push(event);
    byPerson.set(event.personId, list);
  }
  const abandoned: string[] = [];
  for (const [personId, personEvents] of byPerson) {
    const ordered = [...personEvents].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let cursor = 0;
    let reached = -1;
    for (let i = 0; i < steps.length; i++) {
      const match = ordered.slice(cursor).find((event) => event.eventName === steps[i].eventName);
      if (!match) break;
      reached = i;
      cursor = ordered.indexOf(match) + 1;
    }
    if (reached === stepIndex - 1 && stepIndex > 0) abandoned.push(personId);
    if (stepIndex === 0 && reached < 0) abandoned.push(personId);
  }
  return abandoned;
}
