import { and, eq, sql } from 'drizzle-orm';

import type { Clock, LocalDb } from '@/data/db';
import { balls, games, machineInstances, notes, sessions, syncState } from '@/db/schema';

import {
  emptyBatch,
  MAX_PUSH_RECORDS,
  TABLES,
  type PushResult,
  type SyncBatch,
  type SyncRecord,
  type SyncServer,
  type TableName,
} from './contract';

// The phone's half of docs/api/sync.md: push local changes, then pull everything newer than the cursor.

const tables = { machineInstances, sessions, games, balls, notes } as const;

// Drizzle types each table separately; the engine treats them uniformly through this one cast.
type AnyTable = typeof machineInstances;
const table = (name: TableName) => tables[name] as unknown as AnyTable;

const TIME_FIELDS = ['createdAt', 'updatedAt', 'deletedAt', 'startedAt', 'endedAt'] as const;

/** Server times come back as e.g. "…:02.123+00:00"; local times are toISOString(). Store one form. */
function normalizeTimes<T extends Record<string, unknown>>(record: T): T {
  const out: Record<string, unknown> = { ...record };
  for (const f of TIME_FIELDS) {
    if (typeof out[f] === 'string') out[f] = new Date(out[f] as string).toISOString();
  }
  return out as T;
}

function toDto(row: Record<string, unknown>): SyncRecord {
  const { needsPush: _local, ...dto } = row;
  return dto as unknown as SyncRecord;
}

export interface SyncSummary {
  pushed: number;
  rejected: { table: TableName; id: string; reason: string }[];
  pulled: number;
}

export function deviceId(db: LocalDb, clock: Clock): string {
  const existing = db.select().from(syncState).where(eq(syncState.key, 'device_id')).get();
  if (existing) return existing.value;
  const id = clock.newId();
  db.insert(syncState).values({ key: 'device_id', value: id }).run();
  return id;
}

/** Push, then pull. Push first, so this device's edits reach the server before newer copies come back. */
export async function syncNow(db: LocalDb, server: SyncServer, clock: Clock): Promise<SyncSummary> {
  const push = await pushChanges(db, server, deviceId(db, clock));
  const pulled = await pullChanges(db, server);
  return { ...push, pulled };
}

/**
 * Sends every record marked needsPush, parent tables first, at most 500 per request. A record's flag is
 * cleared only on applied/stale, and only if it wasn't edited again while the push was in flight.
 */
export async function pushChanges(db: LocalDb, server: SyncServer, device: string) {
  const dirty = TABLES.flatMap((name) =>
    (db.select().from(table(name)).where(eq(table(name).needsPush, true)).all() as Record<string, unknown>[]).map(
      (row) => ({ name, row }),
    ),
  );

  let pushed = 0;
  const rejected: SyncSummary['rejected'] = [];

  for (let i = 0; i < dirty.length; i += MAX_PUSH_RECORDS) {
    const chunk = dirty.slice(i, i + MAX_PUSH_RECORDS);
    const batch: SyncBatch = emptyBatch();
    const sentUpdatedAt = new Map<string, string>();
    for (const { name, row } of chunk) {
      (batch[name] as SyncRecord[]).push(toDto(row));
      sentUpdatedAt.set(row.id as string, row.updatedAt as string);
    }

    const { results } = await server.push({ deviceId: device, ...batch });

    db.transaction((tx) => {
      for (const r of results as PushResult[]) {
        if (r.status === 'rejected') {
          rejected.push({ table: r.table, id: r.id, reason: r.reason ?? 'rejected' });
          continue;
        }
        const t = table(r.table);
        tx.update(t)
          .set({ needsPush: false })
          .where(and(eq(t.id, r.id), eq(t.updatedAt, sentUpdatedAt.get(r.id) ?? '')))
          .run();
        pushed++;
      }
    });
  }

  return { pushed, rejected };
}

/**
 * Pulls pages until the server has nothing newer. Each page and its cursor are saved in one transaction,
 * so a crash resumes cleanly. Pages aren't parent-complete (sync.md), so foreign keys are off while applying.
 */
export async function pullChanges(db: LocalDb, server: SyncServer): Promise<number> {
  let applied = 0;
  for (;;) {
    const cursor = db.select().from(syncState).where(eq(syncState.key, 'pull_cursor')).get()?.value ?? null;
    const page = await server.pull(cursor);

    db.run(sql`PRAGMA foreign_keys = OFF`);
    try {
      db.transaction((tx) => {
        for (const name of TABLES) {
          for (const incoming of page[name] as SyncRecord[]) {
            if (applyIncoming(tx as unknown as LocalDb, name, normalizeTimes(incoming as unknown as Record<string, unknown>))) applied++;
          }
        }
        tx.insert(syncState)
          .values({ key: 'pull_cursor', value: page.cursor })
          .onConflictDoUpdate({ target: syncState.key, set: { value: page.cursor } })
          .run();
      });
    } finally {
      db.run(sql`PRAGMA foreign_keys = ON`);
    }

    if (!page.hasMore) return applied;
  }
}

/** Newer updatedAt wins (decision 5). A local copy that's as new or newer is kept, pushed or not. */
function applyIncoming(db: LocalDb, name: TableName, incoming: Record<string, unknown>): boolean {
  const t = table(name);
  const id = incoming.id as string;
  const local = db.select({ updatedAt: t.updatedAt }).from(t).where(eq(t.id, id)).get();

  const values = { ...incoming, needsPush: false } as typeof t.$inferInsert;
  if (!local) {
    db.insert(t).values(values).run();
    return true;
  }
  if (Date.parse(incoming.updatedAt as string) > Date.parse(local.updatedAt)) {
    db.update(t).set(values).where(eq(t.id, id)).run();
    return true;
  }
  return false;
}
