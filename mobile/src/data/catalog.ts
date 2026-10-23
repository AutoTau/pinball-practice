import { eq } from 'drizzle-orm';

import { catalogMachines, syncState } from '@/db/schema';

import type { LocalDb } from './db';

export type CatalogMachine = typeof catalogMachines.$inferSelect;

/** Shape of GET /catalog/machines (the API's CatalogMachinesResponse). */
interface CatalogMachinesResponse {
  version: number;
  machines: (Omit<CatalogMachine, 'retired'> & { retired: boolean })[];
}

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

// SQLite caps bound variables per statement; 13 columns × 200 rows stays well under it.
const INSERT_CHUNK = 200;

/**
 * Brings the offline catalog up to date (decision 37). Sends the stored ETag, so an unchanged catalog
 * costs one empty 304; a new one replaces the table in a single transaction.
 */
export async function refreshCatalog(
  db: LocalDb,
  fetchFn: FetchLike,
  apiUrl: string,
): Promise<'updated' | 'unchanged'> {
  const stored = db.select().from(syncState).where(eq(syncState.key, 'catalog_etag')).get();
  const response = await fetchFn(`${apiUrl}/catalog/machines`, {
    headers: stored ? { 'If-None-Match': stored.value } : {},
  });

  if (response.status === 304) return 'unchanged';
  if (response.status !== 200) throw new Error(`Machine list download failed (HTTP ${response.status}).`);

  const body = (await response.json()) as CatalogMachinesResponse;
  if (!Array.isArray(body?.machines) || body.machines.length === 0) {
    throw new Error('Machine list download was empty.');
  }

  const etag = response.headers.get('etag');
  db.transaction((tx) => {
    tx.delete(catalogMachines).run();
    for (let i = 0; i < body.machines.length; i += INSERT_CHUNK) {
      tx.insert(catalogMachines).values(body.machines.slice(i, i + INSERT_CHUNK)).run();
    }
    if (etag) {
      tx.insert(syncState)
        .values({ key: 'catalog_etag', value: etag })
        .onConflictDoUpdate({ target: syncState.key, set: { value: etag } })
        .run();
    }
  });

  return 'updated';
}

export function loadCatalog(db: LocalDb): CatalogMachine[] {
  return db.select().from(catalogMachines).all();
}

export function catalogMachine(db: LocalDb, opdbId: string): CatalogMachine | undefined {
  return db.select().from(catalogMachines).where(eq(catalogMachines.opdbId, opdbId)).get();
}
