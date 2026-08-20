export function createRng(seed: number) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

export function chance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

export function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
