import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// The phone's copy of practice data: the source of truth (decision 4). Tables and fields mirror the
// server's practice schema and the sync contract (docs/api/sync.md). There is no user_id: one device,
// one signed-in player. Times are ISO 8601 UTC strings, the same text the sync API sends.

/** Columns every synced table has. */
const syncColumns = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  /** Set on every local write; cleared when a push returns applied or stale. */
  needsPush: integer('needs_push', { mode: 'boolean' }).notNull().default(true),
};

export const machineInstances = sqliteTable(
  'machine_instances',
  {
    ...syncColumns,
    opdbMachineId: text('opdb_machine_id').notNull(),
    opdbAliasId: text('opdb_alias_id'),
    locationName: text('location_name').notNull(),
    ballsPerGame: integer('balls_per_game').notNull().default(3),
    ballSaveSeconds: integer('ball_save_seconds'),
    tiltWarnings: integer('tilt_warnings'),
  },
  (t) => [index('ix_machine_instances_needs_push').on(t.needsPush)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    ...syncColumns,
    machineInstanceId: text('machine_instance_id').notNull().references(() => machineInstances.id),
    codeVersion: text('code_version'),
    // Snapshot of the machine's settings when the session started (decision 19).
    ballsPerGame: integer('balls_per_game').notNull(),
    ballSaveSeconds: integer('ball_save_seconds'),
    tiltWarnings: integer('tilt_warnings'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    source: text('source', { enum: ['manual', 'photo', 'voice'] }).notNull(),
  },
  (t) => [
    index('ix_sessions_needs_push').on(t.needsPush),
    index('ix_sessions_started_at').on(t.startedAt),
  ],
);

export const games = sqliteTable(
  'games',
  {
    ...syncColumns,
    sessionId: text('session_id').notNull().references(() => sessions.id),
    gameNumber: integer('game_number').notNull(),
    playerCount: integer('player_count').notNull().default(1),
    finalScore: integer('final_score'),
  },
  (t) => [
    index('ix_games_needs_push').on(t.needsPush),
    index('ix_games_session_id').on(t.sessionId),
  ],
);

export const balls = sqliteTable(
  'balls',
  {
    ...syncColumns,
    gameId: text('game_id').notNull().references(() => games.id),
    /** Order within the game; unlike ballNumber it never repeats on an extra ball. */
    sequence: integer('sequence').notNull(),
    ballNumber: integer('ball_number').notNull(),
    cumulativeScore: integer('cumulative_score').notNull(),
    drainReason: text('drain_reason'),
    isExtraBall: integer('is_extra_ball', { mode: 'boolean' }).notNull().default(false),
    tilted: integer('tilted', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('ix_balls_needs_push').on(t.needsPush),
    uniqueIndex('ux_balls_game_sequence').on(t.gameId, t.sequence),
  ],
);

export const notes = sqliteTable(
  'notes',
  {
    ...syncColumns,
    gameId: text('game_id').references(() => games.id),
    ballId: text('ball_id').references(() => balls.id),
    body: text('body').notNull(),
  },
  (t) => [
    index('ix_notes_needs_push').on(t.needsPush),
    check('ck_notes_one_parent', sql`(${t.gameId} IS NULL) <> (${t.ballId} IS NULL)`),
  ],
);

/** Device-level settings: the device ID sent with pushes, the last pull cursor, the catalog's ETag. */
export const syncState = sqliteTable('sync_state', {
  key: text('key', { enum: ['device_id', 'pull_cursor', 'catalog_etag'] }).primaryKey(),
  value: text('value').notNull(),
});

/**
 * Offline copy of the pickable OPDB catalog, replaced wholesale whenever the API's version changes
 * (decisions 29 and 37). Not synced back: the server owns it.
 */
export const catalogMachines = sqliteTable('catalog_machines', {
  opdbId: text('opdb_id').primaryKey(),
  opdbMachineId: text('opdb_machine_id').notNull(),
  opdbAliasId: text('opdb_alias_id'),
  name: text('name').notNull(),
  shortName: text('short_name'),
  titleGroupName: text('title_group_name').notNull(),
  manufacturer: text('manufacturer'),
  year: integer('year'),
  display: text('display'),
  retired: integer('retired', { mode: 'boolean' }).notNull().default(false),
  pinballPrimerUrl: text('pinball_primer_url'),
  pinballRulesUrl: text('pinball_rules_url'),
  bobsGuideUrl: text('bobs_guide_url'),
  /** Backglass art hosted by OPDB (decision 40): ~250 px for lists, ~640 px for headers. */
  imageSmallUrl: text('image_small_url'),
  imageMediumUrl: text('image_medium_url'),
});
