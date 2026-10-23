// Pinball scores are heavily right-skewed: one monster game drags an average far from a typical game.
// Everything here is median and percentile based (decision 9).

/** Linear-interpolated percentile (the "R-7" method spreadsheets use). p is 0–100. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(Math.max(p, 0), 100) / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

export function median(values: readonly number[]): number | null {
  return percentile(values, 50);
}

/** Median of each value and the window-1 values before it; early points use what they have. */
export function rollingMedian(values: readonly number[], window: number): number[] {
  return values.map((_, i) => median(values.slice(Math.max(0, i - window + 1), i + 1))!);
}

export interface Share<K> {
  key: K;
  count: number;
  /** 0–1 of the total. */
  share: number;
}

/** Counts keys and sorts by frequency, most common first. */
export function shares<K>(keys: readonly K[]): Share<K>[] {
  const counts = new Map<K, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, share: count / keys.length }))
    .sort((a, b) => b.count - a.count);
}
