import { drizzle } from 'drizzle-orm/expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';

import type { Clock, LocalDb } from '@/data/db';

import * as schema from './schema';

// enableChangeListener lets useLiveQuery re-render screens when data changes.
const sqlite = openDatabaseSync('pinball.db', { enableChangeListener: true });
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const expoDb = drizzle(sqlite, { schema });

/** The app's database, typed as the driver-neutral LocalDb the data layer takes. */
export const db = expoDb as unknown as LocalDb;

export const clock: Clock = {
  now: () => new Date().toISOString(),
  newId: () => randomUUID(),
};
