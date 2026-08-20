export type RetentionDayCell = {
  day: number;
  retained: number;
  /** null when the cohort has not matured into this window */
  rate: number | null;
  matured: boolean;
};

export type RetentionHeatmap = {
  cohorts: Array<{
    cohort: string;
    size: number;
    days: RetentionDayCell[];
  }>;
  /** Aggregate rates among matured cohorts only */
  day1: number | null;
  day7: number | null;
  day30: number | null;
  asOf: string;
  retentionEvent: string;
  definition: string;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / 86_400_000);
}

/**
 * Retention = share of new users who perform the retention event on day N
 * (calendar day offset from firstSeen, UTC). Unmatured windows are null.
 */
export function calculateRetention(
  firstSeen: Array<{ personId: string; firstSeenAt: Date }>,
  activity: Array<{ personId: string; timestamp: Date }>,
  options: {
    windows?: number[];
    asOf?: Date;
    retentionEvent?: string;
    definition?: string;
  } = {},
): RetentionHeatmap {
  const windows = options.windows ?? [1, 7, 14, 30];
  const asOf = startOfUtcDay(options.asOf ?? new Date());
  const firstByPerson = new Map(firstSeen.map((row) => [row.personId, startOfUtcDay(row.firstSeenAt)]));
  const activityByPerson = new Map<string, Set<number>>();
  for (const row of activity) {
    const first = firstByPerson.get(row.personId);
    if (!first) continue;
    const offset = dayDiff(first, row.timestamp);
    if (offset < 0) continue;
    const set = activityByPerson.get(row.personId) ?? new Set<number>();
    set.add(offset);
    activityByPerson.set(row.personId, set);
  }

  const cohortMap = new Map<string, string[]>();
  for (const row of firstSeen) {
    const key = startOfUtcDay(row.firstSeenAt).toISOString().slice(0, 10);
    const list = cohortMap.get(key) ?? [];
    list.push(row.personId);
    cohortMap.set(key, list);
  }

  const cohorts = [...cohortMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, people]) => {
      const size = people.length;
      const cohortDay = startOfUtcDay(new Date(`${cohort}T00:00:00.000Z`));
      const days = windows.map((day) => {
        const matured = dayDiff(cohortDay, asOf) >= day;
        if (!matured) {
          return { day, retained: 0, rate: null as number | null, matured: false };
        }
        const retained = people.filter((id) => activityByPerson.get(id)?.has(day)).length;
        return { day, retained, rate: size === 0 ? 0 : retained / size, matured: true };
      });
      return { cohort, size, days };
    });

  const rateFor = (day: number): number | null => {
    let eligible = 0;
    let retained = 0;
    for (const row of firstSeen) {
      const first = startOfUtcDay(row.firstSeenAt);
      if (dayDiff(first, asOf) < day) continue;
      eligible += 1;
      if (activityByPerson.get(row.personId)?.has(day)) retained += 1;
    }
    if (eligible === 0) return null;
    return retained / eligible;
  };

  return {
    cohorts,
    day1: rateFor(1),
    day7: rateFor(7),
    day30: rateFor(30),
    asOf: asOf.toISOString().slice(0, 10),
    retentionEvent: options.retentionEvent ?? "activity",
    definition:
      options.definition ??
      "Percentage of new users who perform the workspace retention event on the next eligible calendar day.",
  };
}

export function newVsReturning(
  firstSeen: Array<{ personId: string; firstSeenAt: Date }>,
  range: { from: Date; to: Date },
): { newUsers: number; returningUsers: number } {
  let newUsers = 0;
  let returningUsers = 0;
  for (const row of firstSeen) {
    if (row.firstSeenAt >= range.from && row.firstSeenAt <= range.to) newUsers += 1;
    else returningUsers += 1;
  }
  return { newUsers, returningUsers };
}
