import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from '@/db/schema';

/**
 * Any synchronous Drizzle SQLite database with our schema: expo-sqlite in the app, better-sqlite3 in
 * Node tests. The data layer only depends on this, so it runs the same in both.
 */
export type LocalDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** Supplied by the caller so the data layer is deterministic in tests. */
export interface Clock {
  /** Current time as an ISO 8601 UTC string. */
  now(): string;
  /** A new random UUID for a client-generated record ID. */
  newId(): string;
}
