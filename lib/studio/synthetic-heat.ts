import type { HeatCoord } from "@/components/studio/heatmap-overlay";

/** Deterministic PRNG so synthetic heat is stable per screen. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cluster(rand: () => number, cx: number, cy: number, count: number, spread = 0.06): HeatCoord[] {
  const points: HeatCoord[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: Math.min(0.95, Math.max(0.05, cx + (rand() - 0.5) * spread * 2)),
      y: Math.min(0.95, Math.max(0.05, cy + (rand() - 0.5) * spread * 2)),
    });
  }
  return points;
}

/** Typical CTA / headline attention for Aurelia web screens */
const WEB_HOTSPOTS: Record<string, Array<{ x: number; y: number; n: number; spread?: number }>> = {
  landing: [
    { x: 0.28, y: 0.42, n: 28, spread: 0.08 },
    { x: 0.22, y: 0.58, n: 18, spread: 0.05 },
    { x: 0.72, y: 0.48, n: 12, spread: 0.07 },
  ],
  pricing: [
    { x: 0.5, y: 0.38, n: 22, spread: 0.1 },
    { x: 0.28, y: 0.55, n: 16, spread: 0.06 },
    { x: 0.5, y: 0.55, n: 20, spread: 0.06 },
    { x: 0.72, y: 0.55, n: 10, spread: 0.05 },
  ],
  signup: [
    { x: 0.5, y: 0.42, n: 14, spread: 0.05 },
    { x: 0.42, y: 0.62, n: 24, spread: 0.05 },
  ],
  onboarding: [
    { x: 0.5, y: 0.35, n: 12, spread: 0.06 },
    { x: 0.4, y: 0.62, n: 20, spread: 0.05 },
  ],
  wearable: [
    { x: 0.5, y: 0.4, n: 18, spread: 0.08 },
    { x: 0.38, y: 0.68, n: 22, spread: 0.05 },
  ],
  plan: [
    { x: 0.5, y: 0.45, n: 16, spread: 0.05 },
    { x: 0.4, y: 0.65, n: 20, spread: 0.05 },
  ],
  invite: [
    { x: 0.5, y: 0.42, n: 14, spread: 0.05 },
    { x: 0.42, y: 0.64, n: 26, spread: 0.05 },
  ],
  upgrade: [
    { x: 0.5, y: 0.4, n: 20, spread: 0.07 },
    { x: 0.4, y: 0.62, n: 18, spread: 0.05 },
  ],
};

/** Typical tap zones for Aurelia app screens */
const APP_HOTSPOTS: Record<string, Array<{ x: number; y: number; n: number; spread?: number }>> = {
  welcome: [
    { x: 0.5, y: 0.28, n: 10, spread: 0.06 },
    { x: 0.5, y: 0.72, n: 24, spread: 0.05 },
  ],
  goal: [
    { x: 0.5, y: 0.42, n: 14, spread: 0.08 },
    { x: 0.5, y: 0.55, n: 18, spread: 0.04 },
    { x: 0.5, y: 0.68, n: 16, spread: 0.04 },
  ],
  permissions: [
    { x: 0.5, y: 0.35, n: 10, spread: 0.05 },
    { x: 0.5, y: 0.62, n: 20, spread: 0.05 },
    { x: 0.5, y: 0.74, n: 12, spread: 0.04 },
  ],
  home: [
    { x: 0.5, y: 0.32, n: 12, spread: 0.06 },
    { x: 0.5, y: 0.7, n: 22, spread: 0.05 },
  ],
  session: [
    { x: 0.5, y: 0.45, n: 28, spread: 0.09 },
    { x: 0.5, y: 0.78, n: 14, spread: 0.04 },
  ],
  result: [
    { x: 0.5, y: 0.3, n: 12, spread: 0.06 },
    { x: 0.5, y: 0.7, n: 18, spread: 0.05 },
  ],
  reminder: [
    { x: 0.5, y: 0.35, n: 10, spread: 0.05 },
    { x: 0.5, y: 0.72, n: 20, spread: 0.05 },
  ],
  paywall: [
    { x: 0.5, y: 0.28, n: 16, spread: 0.07 },
    { x: 0.5, y: 0.62, n: 30, spread: 0.06 },
    { x: 0.5, y: 0.74, n: 14, spread: 0.04 },
    { x: 0.5, y: 0.84, n: 8, spread: 0.03 },
  ],
};

export function syntheticHeatForScreen(
  screen: string,
  platform: "web" | "mobile",
  seed = 42,
): HeatCoord[] {
  const table = platform === "web" ? WEB_HOTSPOTS : APP_HOTSPOTS;
  const zones = table[screen] ?? [{ x: 0.5, y: 0.5, n: 16, spread: 0.08 }];
  const rand = mulberry32(seed + screen.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  return zones.flatMap((zone) => cluster(rand, zone.x, zone.y, zone.n, zone.spread ?? 0.06));
}
