// Pinball scores run to billions, so they're shown grouped (340,000,000) and typed as bare digits.

/** 340000000 → "340,000,000". Formatting is done by hand so it doesn't depend on the device locale. */
export function formatScore(score: number): string {
  return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Keeps only digits from typed text: "340,000,0" → "3400000". */
export function scoreDigits(text: string): string {
  return text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
}

/** Parses typed digits into a score, or null when nothing usable was typed. */
export function parseScore(text: string): number | null {
  const digits = scoreDigits(text);
  return digits ? Number(digits) : null;
}

/** Short form for tight spaces: 1_234_567_890 → "1.23B", 340_000_000 → "340M". */
export function shortScore(score: number): string {
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, unit] of units) {
    if (score >= size) return `${Number((score / size).toPrecision(3))}${unit}`;
  }
  return String(score);
}
