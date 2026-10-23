// Wire shapes for /sync/push and /sync/pull. Mirrors the API's SyncContracts.cs and docs/api/sync.md;
// keep all three in step.

export interface SyncRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MachineInstanceDto extends SyncRecord {
  opdbMachineId: string;
  opdbAliasId: string | null;
  locationName: string;
  ballsPerGame: number;
  ballSaveSeconds: number | null;
  tiltWarnings: number | null;
}

export interface SessionDto extends SyncRecord {
  machineInstanceId: string;
  codeVersion: string | null;
  ballsPerGame: number;
  ballSaveSeconds: number | null;
  tiltWarnings: number | null;
  startedAt: string;
  endedAt: string | null;
  source: 'manual' | 'photo' | 'voice';
}

export interface GameDto extends SyncRecord {
  sessionId: string;
  gameNumber: number;
  playerCount: number;
  finalScore: number | null;
}

export interface BallDto extends SyncRecord {
  gameId: string;
  sequence: number;
  ballNumber: number;
  cumulativeScore: number;
  drainReason: string | null;
  isExtraBall: boolean;
  tilted: boolean;
}

export interface NoteDto extends SyncRecord {
  gameId: string | null;
  ballId: string | null;
  body: string;
}

/** Tables in parent-first order: the order pushes are sent and pages are applied. */
export const TABLES = ['machineInstances', 'sessions', 'games', 'balls', 'notes'] as const;
export type TableName = (typeof TABLES)[number];

export interface SyncBatch {
  machineInstances: MachineInstanceDto[];
  sessions: SessionDto[];
  games: GameDto[];
  balls: BallDto[];
  notes: NoteDto[];
}

export interface PushRequest extends SyncBatch {
  deviceId: string;
}

export interface PushResult {
  table: TableName;
  id: string;
  status: 'applied' | 'stale' | 'rejected';
  reason?: string | null;
}

export interface PullResponse extends SyncBatch {
  cursor: string;
  hasMore: boolean;
}

export const MAX_PUSH_RECORDS = 500;

export function emptyBatch(): SyncBatch {
  return { machineInstances: [], sessions: [], games: [], balls: [], notes: [] };
}

/** The server for the sync engine; the real one is HTTP, tests use an in-memory fake. */
export interface SyncServer {
  push(request: PushRequest): Promise<{ results: PushResult[] }>;
  pull(cursor: string | null): Promise<PullResponse>;
}
