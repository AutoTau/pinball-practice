import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '@/db/schema';
import type { Clock, LocalDb } from '@/data/db';

/** A fresh in-memory database with the app's real migrations applied. */
export function createTestDb(): LocalDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
  return db as unknown as LocalDb;
}

/** Deterministic clock: one second per call, sequential IDs. */
export function createTestClock(start = '2026-10-22T19:00:00.000Z'): Clock {
  let t = Date.parse(start);
  let n = 0;
  return {
    now: () => new Date((t += 1000)).toISOString(),
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
}
