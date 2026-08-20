export type SignalPresence = {
  personId: string;
  hasSignal: boolean;
  converted: boolean;
  segment?: string | null;
};

export type SignalResult = {
  usersWithSignal: number;
  usersWithoutSignal: number;
  conversionWithSignal: number;
  conversionWithoutSignal: number;
  lift: number;
  polarity: "positive" | "negative" | "neutral";
  confidence: "low" | "medium" | "high";
  strongestSegment: string | null;
  belowSampleThreshold: boolean;
};

export const MIN_SAMPLE = 30;

export function proportionCI(successes: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const p = successes / n;
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return {
    low: Math.max(0, (center - margin) / denom),
    high: Math.min(1, (center + margin) / denom),
  };
}

export function calculateSignalLift(rows: SignalPresence[], minSample = MIN_SAMPLE): SignalResult {
  const withSignal = rows.filter((row) => row.hasSignal);
  const without = rows.filter((row) => !row.hasSignal);
  const convWith = withSignal.length === 0 ? 0 : withSignal.filter((row) => row.converted).length / withSignal.length;
  const convWithout = without.length === 0 ? 0 : without.filter((row) => row.converted).length / without.length;
  const lift = convWithout === 0 ? (convWith > 0 ? 1 : 0) : (convWith - convWithout) / convWithout;
  const below = withSignal.length < minSample || without.length < minSample;

  const withCI = proportionCI(
    withSignal.filter((row) => row.converted).length,
    withSignal.length,
  );
  const withoutCI = proportionCI(
    without.filter((row) => row.converted).length,
    without.length,
  );
  const separated = withCI.low > withoutCI.high || withoutCI.low > withCI.high;
  const confidence: SignalResult["confidence"] = below ? "low" : separated ? "high" : "medium";

  const bySegment = new Map<string, SignalPresence[]>();
  for (const row of withSignal) {
    const key = row.segment || "unspecified";
    const list = bySegment.get(key) ?? [];
    list.push(row);
    bySegment.set(key, list);
  }
  let strongest: string | null = null;
  let best = -Infinity;
  for (const [segment, list] of bySegment) {
    if (list.length < Math.min(20, minSample)) continue;
    const rate = list.filter((row) => row.converted).length / list.length;
    if (rate > best) {
      best = rate;
      strongest = segment;
    }
  }

  return {
    usersWithSignal: withSignal.length,
    usersWithoutSignal: without.length,
    conversionWithSignal: convWith,
    conversionWithoutSignal: convWithout,
    lift,
    polarity: Math.abs(lift) < 0.02 ? "neutral" : lift > 0 ? "positive" : "negative",
    confidence,
    strongestSegment: strongest,
    belowSampleThreshold: below,
  };
}
