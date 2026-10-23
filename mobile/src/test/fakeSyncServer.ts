import { emptyBatch, TABLES, type PullResponse, type PushRequest, type PushResult, type SyncRecord, type SyncServer, type TableName } from '@/sync/contract';

/**
 * An in-memory stand-in for the API's sync endpoints with the same rules: newer updatedAt applies,
 * otherwise stale; pulls page through a change log in write order; the server answers with times in its
 * own "+00:00" format, like the real one.
 */
export class FakeSyncServer implements SyncServer {
  readonly rows = new Map<string, { table: TableName; record: SyncRecord }>();
  // Append-only, like transaction IDs: a re-written row is appended again and its older entry skipped.
  private readonly log: string[] = [];
  pushes: PushRequest[] = [];
  /** Optional hook to run while a push is "in flight", e.g. to edit the local row meanwhile. */
  duringPush?: () => void;
  rejectIds = new Set<string>();

  constructor(private readonly pageSize = 3) {}

  async push(request: PushRequest): Promise<{ results: PushResult[] }> {
    this.pushes.push(request);
    this.duringPush?.();
    const results: PushResult[] = [];
    for (const table of TABLES) {
      for (const record of request[table] as SyncRecord[]) {
        if (this.rejectIds.has(record.id)) {
          results.push({ table, id: record.id, status: 'rejected', reason: 'test rejection' });
          continue;
        }
        const existing = this.rows.get(record.id);
        if (existing && Date.parse(record.updatedAt) <= Date.parse(existing.record.updatedAt)) {
          results.push({ table, id: record.id, status: 'stale' });
          continue;
        }
        this.write(table, record);
        results.push({ table, id: record.id, status: 'applied' });
      }
    }
    return { results };
  }

  async pull(cursor: string | null): Promise<PullResponse> {
    const start = cursor ? Number(cursor) : 0;
    const end = Math.min(start + this.pageSize, this.log.length);
    const page: PullResponse = { ...emptyBatch(), cursor: String(end), hasMore: end < this.log.length };
    for (let i = start; i < end; i++) {
      const id = this.log[i];
      if (this.log.lastIndexOf(id) !== i) continue; // superseded by a later write
      const { table, record } = this.rows.get(id)!;
      (page[table] as SyncRecord[]).push(serverTimes(record));
    }
    return page;
  }

  /** A change made on another device. */
  write(table: TableName, record: SyncRecord) {
    this.rows.set(record.id, { table, record });
    this.log.push(record.id);
  }
}

function serverTimes(record: SyncRecord): SyncRecord {
  const out: Record<string, unknown> = { ...record };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT.*Z$/.test(v)) out[k] = v.replace('Z', '+00:00');
  }
  return out as unknown as SyncRecord;
}
