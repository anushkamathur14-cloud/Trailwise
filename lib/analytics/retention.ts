export type RetentionEvent = {
  personId: string;
  timestamp: Date;
  isNew: boolean;
};

export type RetentionHeatmap = {
  cohorts: Array<{
    cohort: string;
    size: number;
    days: Array<{ day: number; retained: number; rate: number }>;
  }>;
  day1: number;
  day7: number;
  day30: number;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / 86_400_000);
}

export function calculateRetention(
  firstSeen: Array<{ personId: string; firstSeenAt: Date }>,
  activity: Array<{ personId: string; timestamp: Date }>,
  windows = [1, 7, 14, 30],
): RetentionHeatmap {
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
      const days = windows.map((day) => {
        const retained = people.filter((id) => activityByPerson.get(id)?.has(day)).length;
        return { day, retained, rate: size === 0 ? 0 : retained / size };
      });
      return { cohort, size, days };
    });

  const allPeople = firstSeen.map((row) => row.personId);
  const rateFor = (day: number) => {
    if (allPeople.length === 0) return 0;
    return allPeople.filter((id) => activityByPerson.get(id)?.has(day)).length / allPeople.length;
  };

  return {
    cohorts,
    day1: rateFor(1),
    day7: rateFor(7),
    day30: rateFor(30),
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
