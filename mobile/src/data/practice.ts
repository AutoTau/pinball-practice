import { and, asc, desc, eq, isNull, max, sql } from 'drizzle-orm';

import { balls, catalogMachines, games, machineInstances, notes, sessions } from '@/db/schema';
import { isDrainReason, type DrainReason } from '@/domain/drainReasons';

import type { Clock, LocalDb } from './db';

// Every write stamps updatedAt and sets needsPush, which is all sync needs to find local changes.
// Screens call these functions and never touch tables directly (the plan's "thin boundary").

export class PracticeError extends Error {}

export type SessionSource = (typeof sessions.$inferSelect)['source'];

export interface NewMachineInstance {
  opdbMachineId: string;
  opdbAliasId?: string | null;
  locationName: string;
  ballsPerGame?: number;
  ballSaveSeconds?: number | null;
  tiltWarnings?: number | null;
}

export function addMachineInstance(db: LocalDb, clock: Clock, input: NewMachineInstance): string {
  const ballsPerGame = input.ballsPerGame ?? 3;
  if (!Number.isInteger(ballsPerGame) || ballsPerGame < 1 || ballsPerGame > 10) {
    throw new PracticeError('Balls per game must be between 1 and 10.');
  }
  if (!input.locationName.trim()) throw new PracticeError('Location is required.');

  const id = clock.newId();
  const now = clock.now();
  db.insert(machineInstances)
    .values({
      id,
      createdAt: now,
      updatedAt: now,
      opdbMachineId: input.opdbMachineId,
      opdbAliasId: input.opdbAliasId ?? null,
      locationName: input.locationName.trim(),
      ballsPerGame,
      ballSaveSeconds: input.ballSaveSeconds ?? null,
      tiltWarnings: input.tiltWarnings ?? null,
    })
    .run();
  return id;
}

/** Starts a session, copying the machine's current settings onto it (decision 19). */
export function startSession(
  db: LocalDb,
  clock: Clock,
  input: { machineInstanceId: string; codeVersion?: string | null; source?: SessionSource },
): string {
  const machine = db.select().from(machineInstances).where(eq(machineInstances.id, input.machineInstanceId)).get();
  if (!machine || machine.deletedAt) throw new PracticeError('Machine not found.');

  const id = clock.newId();
  const now = clock.now();
  db.insert(sessions)
    .values({
      id,
      createdAt: now,
      updatedAt: now,
      machineInstanceId: machine.id,
      codeVersion: input.codeVersion ?? null,
      ballsPerGame: machine.ballsPerGame,
      ballSaveSeconds: machine.ballSaveSeconds,
      tiltWarnings: machine.tiltWarnings,
      startedAt: now,
      source: input.source ?? 'manual',
    })
    .run();
  return id;
}

/** Ends a session. One with no games has nothing worth keeping, so it's discarded instead. */
export function endSession(db: LocalDb, clock: Clock, sessionId: string): void {
  if (sessionGames(db, sessionId).length === 0) {
    discardSession(db, clock, sessionId);
    return;
  }
  const now = clock.now();
  db.update(sessions)
    .set({ endedAt: now, updatedAt: now, needsPush: true })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.endedAt)))
    .run();
}

/** Soft-deletes a session that has no games, e.g. one started on the wrong machine (decision 17). */
export function discardSession(db: LocalDb, clock: Clock, sessionId: string): void {
  if (sessionGames(db, sessionId).length > 0) throw new PracticeError('Only a session without games can be discarded.');
  const now = clock.now();
  db.update(sessions)
    .set({ endedAt: now, deletedAt: now, updatedAt: now, needsPush: true })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)))
    .run();
}

/** Starts the next game in a session. */
export function startGame(db: LocalDb, clock: Clock, sessionId: string): string {
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session || session.deletedAt) throw new PracticeError('Session not found.');
  if (session.endedAt) throw new PracticeError('Session has ended.');
  if (activeGame(db, sessionId)) throw new PracticeError('Finish the current game first.');

  const last = db
    .select({ n: max(games.gameNumber) })
    .from(games)
    .where(eq(games.sessionId, sessionId))
    .get();

  const id = clock.newId();
  const now = clock.now();
  db.insert(games)
    .values({ id, createdAt: now, updatedAt: now, sessionId, gameNumber: (last?.n ?? 0) + 1 })
    .run();
  return id;
}

export interface BallInput {
  gameId: string;
  /** Score on the display after the ball drained. */
  cumulativeScore: number;
  drainReason?: DrainReason | null;
  isExtraBall?: boolean;
  tilted?: boolean;
}

/**
 * Logs the next ball of a game. The ball number advances unless this is an extra ball, which repeats
 * the current number; the score can never go down.
 */
export function logBall(db: LocalDb, clock: Clock, input: BallInput): string {
  const game = db
    .select({ id: games.id, finalScore: games.finalScore, ballsPerGame: sessions.ballsPerGame })
    .from(games)
    .innerJoin(sessions, eq(sessions.id, games.sessionId))
    .where(and(eq(games.id, input.gameId), isNull(games.deletedAt)))
    .get();
  if (!game) throw new PracticeError('Game not found.');
  if (game.finalScore !== null) throw new PracticeError('Game has ended.');

  if (!Number.isSafeInteger(input.cumulativeScore) || input.cumulativeScore < 0) {
    throw new PracticeError('Score must be a whole number of zero or more.');
  }
  if (input.drainReason != null && !isDrainReason(input.drainReason)) {
    throw new PracticeError(`Unknown drain reason "${input.drainReason}".`);
  }

  const previous = liveBalls(db, input.gameId).at(-1);
  if (previous && input.cumulativeScore < previous.cumulativeScore) {
    throw new PracticeError(`Score can't go down: the last ball ended at ${previous.cumulativeScore}.`);
  }

  const isExtraBall = input.isExtraBall ?? false;
  const ballNumber = nextBallNumber(previous, isExtraBall);
  if (ballNumber > game.ballsPerGame) {
    throw new PracticeError(`This game only has ${game.ballsPerGame} balls; mark it as an extra ball or end the game.`);
  }

  // Sequence counts deleted balls too, so it stays unique per game (the database enforces it).
  const seq = db
    .select({ n: max(balls.sequence) })
    .from(balls)
    .where(eq(balls.gameId, input.gameId))
    .get();

  const id = clock.newId();
  const now = clock.now();
  db.insert(balls)
    .values({
      id,
      createdAt: now,
      updatedAt: now,
      gameId: input.gameId,
      sequence: (seq?.n ?? 0) + 1,
      ballNumber,
      cumulativeScore: input.cumulativeScore,
      drainReason: input.drainReason ?? null,
      isExtraBall,
      tilted: input.tilted ?? false,
    })
    .run();
  return id;
}

/** Ends a game; the final score defaults to the last ball's score. */
export function endGame(db: LocalDb, clock: Clock, gameId: string, finalScore?: number): void {
  const score = finalScore ?? liveBalls(db, gameId).at(-1)?.cumulativeScore ?? 0;
  const now = clock.now();
  db.update(games).set({ finalScore: score, updatedAt: now, needsPush: true }).where(eq(games.id, gameId)).run();
}

/** Soft-deletes a ball (decision 17): the row stays so the delete can sync. */
export function deleteBall(db: LocalDb, clock: Clock, ballId: string): void {
  const now = clock.now();
  db.update(balls)
    .set({ deletedAt: now, updatedAt: now, needsPush: true })
    .where(and(eq(balls.id, ballId), isNull(balls.deletedAt)))
    .run();
}

/** A game's balls in play order, without deleted ones, each with the points it scored. */
export function gameBalls(db: LocalDb, gameId: string) {
  let previousScore = 0;
  return liveBalls(db, gameId).map((b) => {
    const delta = b.cumulativeScore - previousScore;
    previousScore = b.cumulativeScore;
    return { ...b, delta };
  });
}

/** A session's games in order, with how many balls each has. */
export function sessionGames(db: LocalDb, sessionId: string) {
  return db
    .select({
      id: games.id,
      gameNumber: games.gameNumber,
      finalScore: games.finalScore,
      // Table-qualified on purpose: this select has one table, so Drizzle would render ${games.id} as a bare
      // "id", which inside the subquery means balls.id and makes every count zero.
      balls: sql<number>`(SELECT count(*) FROM balls b WHERE b.game_id = games.id AND b.deleted_at IS NULL)`,
    })
    .from(games)
    .where(and(eq(games.sessionId, sessionId), isNull(games.deletedAt)))
    .orderBy(asc(games.gameNumber))
    .all();
}

/** The session's game still being played, if any. A session plays one game at a time. */
export function activeGame(db: LocalDb, sessionId: string) {
  return db
    .select({ id: games.id, gameNumber: games.gameNumber })
    .from(games)
    .where(and(eq(games.sessionId, sessionId), isNull(games.deletedAt), isNull(games.finalScore)))
    .orderBy(desc(games.gameNumber))
    .get();
}

/** What the logging screen needs to show before the next ball. */
export function gameProgress(db: LocalDb, gameId: string) {
  const game = db
    .select({ ballsPerGame: sessions.ballsPerGame })
    .from(games)
    .innerJoin(sessions, eq(sessions.id, games.sessionId))
    .where(eq(games.id, gameId))
    .get();
  if (!game) throw new PracticeError('Game not found.');

  const last = liveBalls(db, gameId).at(-1);
  const nextBall = nextBallNumber(last, false);
  return {
    ballsPerGame: game.ballsPerGame,
    /** Ball number the next regular (non-extra) ball would get. */
    nextBall,
    lastScore: last?.cumulativeScore ?? 0,
    /** Every regular ball is logged; only an extra ball or ending the game remains. */
    regularBallsDone: nextBall > game.ballsPerGame,
  };
}

function nextBallNumber(previous: { ballNumber: number } | undefined, isExtraBall: boolean): number {
  if (!previous) return 1;
  return isExtraBall ? previous.ballNumber : previous.ballNumber + 1;
}

// Correlated subqueries below spell out table-qualified SQL rather than interpolating Drizzle columns: in a
// single-table select Drizzle renders bare column names, which inside a subquery bind to the inner table.

// A machine instance's display name comes from the offline catalog: its alias if it has one, else its machine.
const catalogEntryOf = eq(
  catalogMachines.opdbId,
  sql`coalesce(${machineInstances.opdbAliasId}, ${machineInstances.opdbMachineId})`,
);

/** Query for the home screen's session list, newest first. Returned unexecuted so screens can make it live. */
export function sessionListQuery(db: LocalDb) {
  return db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      locationName: machineInstances.locationName,
      machineName: sql<string>`coalesce(${catalogMachines.name}, ${machineInstances.opdbMachineId})`,
      imageSmallUrl: catalogMachines.imageSmallUrl,
      imageMediumUrl: catalogMachines.imageMediumUrl,
      games: sql<number>`(SELECT count(*) FROM games g WHERE g.session_id = sessions.id AND g.deleted_at IS NULL)`,
    })
    .from(sessions)
    .innerJoin(machineInstances, eq(machineInstances.id, sessions.machineInstanceId))
    .leftJoin(catalogMachines, catalogEntryOf)
    // Ended sessions without games carry no practice; older ones predate discarding, so hide them here.
    .where(
      and(
        isNull(sessions.deletedAt),
        sql`(${sessions.endedAt} IS NULL OR EXISTS (SELECT 1 FROM ${games} WHERE ${games.sessionId} = ${sessions.id} AND ${games.deletedAt} IS NULL))`,
      ),
    )
    .orderBy(desc(sessions.startedAt));
}

/** The player's machines, most recently played first, for one-tap session starts. */
export function machineListQuery(db: LocalDb) {
  const lastPlayed = sql<string | null>`(SELECT max(s.started_at) FROM sessions s WHERE s.machine_instance_id = machine_instances.id)`;
  return db
    .select({
      id: machineInstances.id,
      locationName: machineInstances.locationName,
      ballsPerGame: machineInstances.ballsPerGame,
      machineName: sql<string>`coalesce(${catalogMachines.name}, ${machineInstances.opdbMachineId})`,
      imageSmallUrl: catalogMachines.imageSmallUrl,
      imageMediumUrl: catalogMachines.imageMediumUrl,
      lastPlayed,
    })
    .from(machineInstances)
    .leftJoin(catalogMachines, catalogEntryOf)
    .where(isNull(machineInstances.deletedAt))
    .orderBy(desc(sql`coalesce(${lastPlayed}, ${machineInstances.createdAt})`));
}

/** One machine with its catalog name, for the stats screen. */
export function machineDetail(db: LocalDb, machineInstanceId: string) {
  return db
    .select({
      id: machineInstances.id,
      locationName: machineInstances.locationName,
      ballsPerGame: machineInstances.ballsPerGame,
      machineName: sql<string>`coalesce(${catalogMachines.name}, ${machineInstances.opdbMachineId})`,
      imageSmallUrl: catalogMachines.imageSmallUrl,
      imageMediumUrl: catalogMachines.imageMediumUrl,
    })
    .from(machineInstances)
    .leftJoin(catalogMachines, catalogEntryOf)
    .where(eq(machineInstances.id, machineInstanceId))
    .get();
}

/** One session with its machine, for the session screen. */
export function sessionDetail(db: LocalDb, sessionId: string) {
  return db
    .select({
      id: sessions.id,
      machineInstanceId: sessions.machineInstanceId,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      ballsPerGame: sessions.ballsPerGame,
      locationName: machineInstances.locationName,
      machineName: sql<string>`coalesce(${catalogMachines.name}, ${machineInstances.opdbMachineId})`,
      imageSmallUrl: catalogMachines.imageSmallUrl,
      imageMediumUrl: catalogMachines.imageMediumUrl,
    })
    .from(sessions)
    .innerJoin(machineInstances, eq(machineInstances.id, sessions.machineInstanceId))
    .leftJoin(catalogMachines, catalogEntryOf)
    .where(eq(sessions.id, sessionId))
    .get();
}

function liveBalls(db: LocalDb, gameId: string) {
  return db
    .select()
    .from(balls)
    .where(and(eq(balls.gameId, gameId), isNull(balls.deletedAt)))
    .orderBy(asc(balls.sequence))
    .all();
}

export const MAX_NOTE_LENGTH = 4000;

/** Adds a note to a ball or, without one, to the game (e.g. "late on left ramp"). */
export function addNote(db: LocalDb, clock: Clock, input: { gameId?: string; ballId?: string; body: string }): string {
  const body = input.body.trim();
  if (!body) throw new PracticeError('A note needs some text.');
  if (body.length > MAX_NOTE_LENGTH) throw new PracticeError(`Notes are limited to ${MAX_NOTE_LENGTH} characters.`);
  if (!input.gameId === !input.ballId) throw new PracticeError('A note belongs to exactly one game or ball.');

  const id = clock.newId();
  const now = clock.now();
  db.insert(notes)
    .values({ id, createdAt: now, updatedAt: now, gameId: input.gameId ?? null, ballId: input.ballId ?? null, body })
    .run();
  return id;
}

export function deleteNote(db: LocalDb, clock: Clock, noteId: string): void {
  const now = clock.now();
  db.update(notes)
    .set({ deletedAt: now, updatedAt: now, needsPush: true })
    .where(and(eq(notes.id, noteId), isNull(notes.deletedAt)))
    .run();
}

/** A game's notes, on the game itself or on any of its balls, oldest first. */
export function gameNotes(db: LocalDb, gameId: string) {
  return db
    .select({ id: notes.id, body: notes.body, ballId: notes.ballId, createdAt: notes.createdAt })
    .from(notes)
    .leftJoin(balls, eq(balls.id, notes.ballId))
    .where(and(isNull(notes.deletedAt), sql`(${notes.gameId} = ${gameId} OR ${balls.gameId} = ${gameId})`))
    .orderBy(asc(notes.createdAt))
    .all();
}

/** The most recent notes on one machine, newest first, for its stats screen. */
export function machineNotes(db: LocalDb, machineInstanceId: string, limit = 10) {
  return db
    .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt, ballNumber: balls.ballNumber })
    .from(notes)
    .leftJoin(balls, eq(balls.id, notes.ballId))
    .innerJoin(games, sql`${games.id} = coalesce(${notes.gameId}, ${balls.gameId})`)
    .innerJoin(sessions, eq(sessions.id, games.sessionId))
    .where(and(isNull(notes.deletedAt), isNull(games.deletedAt), isNull(sessions.deletedAt), eq(sessions.machineInstanceId, machineInstanceId)))
    .orderBy(desc(notes.createdAt))
    .limit(limit)
    .all();
}

/** One game with its session and machine, for the game detail screen. */
export function gameSummary(db: LocalDb, gameId: string) {
  return db
    .select({
      id: games.id,
      gameNumber: games.gameNumber,
      finalScore: games.finalScore,
      createdAt: games.createdAt,
      sessionId: sessions.id,
      machineInstanceId: machineInstances.id,
      locationName: machineInstances.locationName,
      ballsPerGame: sessions.ballsPerGame,
      machineName: sql<string>`coalesce(${catalogMachines.name}, ${machineInstances.opdbMachineId})`,
      imageMediumUrl: catalogMachines.imageMediumUrl,
    })
    .from(games)
    .innerJoin(sessions, eq(sessions.id, games.sessionId))
    .innerJoin(machineInstances, eq(machineInstances.id, sessions.machineInstanceId))
    .leftJoin(catalogMachines, catalogEntryOf)
    .where(and(eq(games.id, gameId), isNull(games.deletedAt)))
    .get();
}

/**
 * Corrects a logged ball's score or drain. The score must stay between its neighbours: no lower than the
 * ball before it and no higher than the ball after it, since the display only counts up.
 */
export function updateBall(
  db: LocalDb,
  clock: Clock,
  ballId: string,
  changes: { cumulativeScore?: number; drainReason?: DrainReason | null; tilted?: boolean },
): void {
  const ball = db.select().from(balls).where(and(eq(balls.id, ballId), isNull(balls.deletedAt))).get();
  if (!ball) throw new PracticeError('Ball not found.');

  if (changes.cumulativeScore !== undefined) {
    const score = changes.cumulativeScore;
    if (!Number.isSafeInteger(score) || score < 0) throw new PracticeError('Score must be a whole number of zero or more.');
    const siblings = liveBalls(db, ball.gameId);
    const at = siblings.findIndex((b) => b.id === ballId);
    const before = siblings[at - 1];
    const after = siblings[at + 1];
    if (before && score < before.cumulativeScore) {
      throw new PracticeError(`Score can't be lower than the ball before it (${before.cumulativeScore}).`);
    }
    if (after && score > after.cumulativeScore) {
      throw new PracticeError(`Score can't be higher than the ball after it (${after.cumulativeScore}).`);
    }
  }
  if (changes.drainReason != null && !isDrainReason(changes.drainReason)) {
    throw new PracticeError(`Unknown drain reason "${changes.drainReason}".`);
  }

  db.update(balls)
    .set({ ...changes, updatedAt: clock.now(), needsPush: true })
    .where(eq(balls.id, ballId))
    .run();
}

/**
 * Places the player has set machines up at, most recently used first, for autofill. Names that differ
 * only in case or spacing count as one place; the most recently used spelling is kept.
 */
export function knownLocations(db: LocalDb): string[] {
  const rows = db
    .select({
      name: machineInstances.locationName,
      // Table-qualified on purpose: in a single-table select Drizzle leaves column names bare, and a bare
      // "id" inside the subquery would mean sessions.id.
      lastUsed: sql<string>`coalesce((SELECT max(s.started_at) FROM sessions s WHERE s.machine_instance_id = machine_instances.id), machine_instances.created_at)`,
    })
    .from(machineInstances)
    .where(isNull(machineInstances.deletedAt))
    .all()
    .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));

  const seen = new Set<string>();
  const names: string[] = [];
  for (const { name } of rows) {
    const key = locationKey(name);
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name.trim().replace(/\s+/g, ' '));
    }
  }
  return names;
}

/** Locations matching what's typed so far: words starting with it first, then anywhere in the name. */
export function suggestLocations(known: readonly string[], typed: string, limit = 5): string[] {
  const q = locationKey(typed);
  if (!q) return known.slice(0, limit);
  const startsWord = (name: string) => ` ${locationKey(name)}`.includes(` ${q}`);
  return [
    ...known.filter((n) => startsWord(n)),
    ...known.filter((n) => !startsWord(n) && locationKey(n).includes(q)),
  ]
    .filter((n) => locationKey(n) !== q) // already typed in full
    .slice(0, limit);
}

function locationKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
