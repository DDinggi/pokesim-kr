export type RNG = () => number;

export function makePick(rng: RNG) {
  return <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
}

export function makeWeightedPick(rng: RNG) {
  return (weights: Record<string, number>): string => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = rng() * total;

    for (const [key, weight] of Object.entries(weights)) {
      r -= weight;
      if (r <= 0) return key;
    }

    return Object.keys(weights).at(-1)!;
  };
}

export function shuffle<T>(arr: T[], rng: RNG): T[] {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}
