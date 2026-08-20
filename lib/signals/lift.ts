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
  /** Absolute percentage-point difference (with − without), e.g. 0.406 = +40.6 pp */
  absoluteDifference: number;
  /** Relative lift; null when baseline is zero / too small */
  relativeLift: number | null;
  relativeLiftUnavailableReason: string | null;
  polarity: "positive" | "negative" | "neutral";
  confidence: "low" | "medium" | "high";
  evidenceStrength: "weak" | "moderate" | "strong";
  strongestSegment: string | null;
  belowSampleThreshold: boolean;
  ciWith: { low: number; high: number };
  ciWithout: { low: number; high: number };
};

export const MIN_SAMPLE = 30;
export const MIN_BASELINE_RATE = 0.02;

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
  const successWith = withSignal.filter((row) => row.converted).length;
  const successWithout = without.filter((row) => row.converted).length;
  const convWith = withSignal.length === 0 ? 0 : successWith / withSignal.length;
  const convWithout = without.length === 0 ? 0 : successWithout / without.length;
  const absoluteDifference = convWith - convWithout;

  let relativeLift: number | null = null;
  let relativeLiftUnavailableReason: string | null = null;
  if (without.length === 0) {
    relativeLiftUnavailableReason = "No users without this behavior in the sample.";
  } else if (convWithout < MIN_BASELINE_RATE) {
    relativeLiftUnavailableReason = "Relative lift unavailable — baseline rate is too small.";
  } else {
    relativeLift = (convWith - convWithout) / convWithout;
  }

  const below = withSignal.length < minSample || without.length < minSample;
  const withCI = proportionCI(successWith, withSignal.length);
  const withoutCI = proportionCI(successWithout, without.length);
  const separated = withCI.low > withoutCI.high || withoutCI.low > withCI.high;
  const confidence: SignalResult["confidence"] = below ? "low" : separated ? "high" : "medium";

  const absPp = Math.abs(absoluteDifference);
  const evidenceStrength: SignalResult["evidenceStrength"] = below
    ? "weak"
    : separated && absPp >= 0.1
      ? "strong"
      : absPp >= 0.05
        ? "moderate"
        : "weak";

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
    absoluteDifference,
    relativeLift,
    relativeLiftUnavailableReason,
    polarity: Math.abs(absoluteDifference) < 0.02 ? "neutral" : absoluteDifference > 0 ? "positive" : "negative",
    confidence,
    evidenceStrength,
    strongestSegment: strongest,
    belowSampleThreshold: below,
    ciWith: withCI,
    ciWithout: withoutCI,
  };
}
