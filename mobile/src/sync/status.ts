import { eq, sql } from 'drizzle-orm';

import type { LocalDb } from '@/data/db';
import { balls, games, machineInstances, notes, sessions } from '@/db/schema';

/** How many local records are waiting to be pushed. */
export function pendingChanges(db: LocalDb): number {
  return [machineInstances, sessions, games, balls, notes].reduce(
    (total, t) => total + (db.select({ n: sql<number>`count(*)` }).from(t).where(eq(t.needsPush, true)).get()?.n ?? 0),
    0,
  );
}
