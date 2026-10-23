// Offline, typo-tolerant machine search. It mirrors the server's trigram search (decision 28) closely
// enough for picking a machine: SQLite has no trigram index, but ~2,500 names fit easily in memory.

export interface SearchableMachine {
  opdbId: string;
  name: string;
  shortName: string | null;
  year: number | null;
  retired: boolean;
}

export const MIN_QUERY_LENGTH = 2;
const MIN_SCORE = 0.35;

/** Lowercase, strip accents and punctuation, collapse spaces: "Attack From Mars!" → "attack from mars". */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Word trigrams padded like Postgres pg_trgm: "gz" → "  g", " gz", "gz ". */
function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const word of text.split(' ')) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

function similarity(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Best similarity between the query and any run of consecutive words in the name, like word_similarity. */
function bestSpanSimilarity(query: Set<string>, words: string[]): number {
  let best = 0;
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) {
      best = Math.max(best, similarity(query, trigrams(words.slice(start, end).join(' '))));
    }
  }
  return best;
}

export function scoreMachine(machine: SearchableMachine, normalizedQuery: string): number {
  const name = normalize(machine.name);
  if (machine.shortName && normalize(machine.shortName) === normalizedQuery) return 1;
  if (name.startsWith(normalizedQuery)) return 0.95;
  if (` ${name}`.includes(` ${normalizedQuery}`)) return 0.92;
  if (name.includes(normalizedQuery)) return 0.9;
  return bestSpanSimilarity(trigrams(normalizedQuery), name.split(' '));
}

/** Active machines matching the query, best first, then newest, then by name. */
export function searchMachines<T extends SearchableMachine>(machines: readonly T[], query: string, limit = 30): T[] {
  const q = normalize(query);
  if (q.length < MIN_QUERY_LENGTH) return [];

  return machines
    .filter((m) => !m.retired)
    .map((m) => ({ m, score: scoreMachine(m, q) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || (b.m.year ?? 0) - (a.m.year ?? 0) || a.m.name.localeCompare(b.m.name))
    .slice(0, limit)
    .map((r) => r.m);
}
