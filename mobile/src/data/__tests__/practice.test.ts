/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';

import { balls, games, sessions } from '@/db/schema';
import {
  activeGame,
  addMachineInstance,
  addNote,
  deleteBall,
  deleteNote,
  discardSession,
  endSession,
  gameNotes,
  gameSummary,
  knownLocations,
  machineNotes,
  endGame,
  gameBalls,
  gameProgress,
  sessionGames,
  logBall,
  PracticeError,
  sessionListQuery,
  startGame,
  startSession,
  suggestLocations,
  updateBall,
} from '@/data/practice';

import { createTestClock, createTestDb } from '@/test/testDb';

function setup(ballsPerGame = 3) {
  const db = createTestDb();
  const clock = createTestClock();
  const machineId = addMachineInstance(db, clock, {
    opdbMachineId: 'GweeP-MW95j',
    locationName: 'Ground Kontrol',
    ballsPerGame,
    ballSaveSeconds: 10,
  });
  const sessionId = startSession(db, clock, { machineInstanceId: machineId, codeVersion: '1.03' });
  const gameId = startGame(db, clock, sessionId);
  return { db, clock, machineId, sessionId, gameId };
}

describe('practice data layer', () => {
  it('snapshots the machine settings onto a new session', () => {
    const { db, sessionId } = setup(5);

    const s = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()!;

    expect(s).toMatchObject({ ballsPerGame: 5, ballSaveSeconds: 10, codeVersion: '1.03', source: 'manual' });
  });

  it('numbers games within a session, one game at a time', () => {
    const { db, clock, sessionId, gameId } = setup();

    expect(() => startGame(db, clock, sessionId)).toThrow(/Finish the current game/);
    endGame(db, clock, gameId);
    const second = startGame(db, clock, sessionId);

    expect(db.select().from(games).where(eq(games.id, second)).get()!.gameNumber).toBe(2);
    expect(activeGame(db, sessionId)?.id).toBe(second);
    expect(sessionGames(db, sessionId).map((g) => [g.gameNumber, g.finalScore, g.balls])).toEqual([
      [1, 0, 0],
      [2, null, 0],
    ]);
    logBall(db, clock, { gameId: second, cumulativeScore: 10 });
    logBall(db, clock, { gameId: second, cumulativeScore: 20 });
    expect(sessionGames(db, sessionId).map((g) => g.balls)).toEqual([0, 2]);
  });

  it('reports progress toward the end of the game', () => {
    const { db, clock, gameId } = setup(2);

    expect(gameProgress(db, gameId)).toEqual({ ballsPerGame: 2, nextBall: 1, lastScore: 0, regularBallsDone: false });
    logBall(db, clock, { gameId, cumulativeScore: 50 });
    logBall(db, clock, { gameId, cumulativeScore: 80, isExtraBall: true });
    expect(gameProgress(db, gameId)).toMatchObject({ nextBall: 2, lastScore: 80, regularBallsDone: false });
    logBall(db, clock, { gameId, cumulativeScore: 120 });
    expect(gameProgress(db, gameId)).toMatchObject({ nextBall: 3, regularBallsDone: true });
  });

  it('logs balls with deltas, and an extra ball repeats the ball number', () => {
    const { db, clock, gameId } = setup();

    logBall(db, clock, { gameId, cumulativeScore: 100_000_000, drainReason: 'left_outlane' });
    logBall(db, clock, { gameId, cumulativeScore: 340_000_000, drainReason: 'center_drain' });
    logBall(db, clock, { gameId, cumulativeScore: 410_000_000, isExtraBall: true });
    logBall(db, clock, { gameId, cumulativeScore: 600_000_000, tilted: true });

    expect(gameBalls(db, gameId).map((b) => [b.sequence, b.ballNumber, b.delta])).toEqual([
      [1, 1, 100_000_000],
      [2, 2, 240_000_000],
      [3, 2, 70_000_000],
      [4, 3, 190_000_000],
    ]);
  });

  it('rejects a score lower than the previous ball', () => {
    const { db, clock, gameId } = setup();
    logBall(db, clock, { gameId, cumulativeScore: 500 });

    expect(() => logBall(db, clock, { gameId, cumulativeScore: 400 })).toThrow(PracticeError);
  });

  it('rejects a ball past the game length unless it is an extra ball', () => {
    const { db, clock, gameId } = setup(1);
    logBall(db, clock, { gameId, cumulativeScore: 10 });

    expect(() => logBall(db, clock, { gameId, cumulativeScore: 20 })).toThrow(/only has 1 balls/);
    expect(() => logBall(db, clock, { gameId, cumulativeScore: 20, isExtraBall: true })).not.toThrow();
  });

  it('rejects unknown drain reasons and logging into an ended game', () => {
    const { db, clock, gameId } = setup();

    expect(() => logBall(db, clock, { gameId, cumulativeScore: 1, drainReason: 'trapdoor' as never })).toThrow(
      /Unknown drain reason/,
    );

    endGame(db, clock, gameId);
    expect(() => logBall(db, clock, { gameId, cumulativeScore: 1 })).toThrow(/Game has ended/);
  });

  it('ends a game with the last ball as the final score by default', () => {
    const { db, clock, gameId } = setup();
    logBall(db, clock, { gameId, cumulativeScore: 1_234 });

    endGame(db, clock, gameId);

    expect(db.select().from(games).where(eq(games.id, gameId)).get()!.finalScore).toBe(1_234);
  });

  it('soft-deletes a ball, keeps sequence unique, and recomputes deltas', () => {
    const { db, clock, gameId } = setup();
    logBall(db, clock, { gameId, cumulativeScore: 100 });
    const mistake = logBall(db, clock, { gameId, cumulativeScore: 9_999 });

    deleteBall(db, clock, mistake);
    logBall(db, clock, { gameId, cumulativeScore: 300 });

    const row = db.select().from(balls).where(eq(balls.id, mistake)).get()!;
    expect(row.deletedAt).not.toBeNull();
    expect(row.needsPush).toBe(true);
    expect(gameBalls(db, gameId).map((b) => [b.sequence, b.ballNumber, b.delta])).toEqual([
      [1, 1, 100],
      [3, 2, 200],
    ]);
  });

  it('marks every write as needing a push and stamps updatedAt', () => {
    const { db, clock, gameId } = setup();
    const before = db.select().from(games).where(eq(games.id, gameId)).get()!;
    db.update(games).set({ needsPush: false }).where(eq(games.id, gameId)).run();

    endGame(db, clock, gameId, 42);

    const after = db.select().from(games).where(eq(games.id, gameId)).get()!;
    expect(after.needsPush).toBe(true);
    expect(after.updatedAt > before.updatedAt).toBe(true);
  });

  it('lists sessions newest first with their game counts', () => {
    const { db, clock, machineId, sessionId } = setup();
    const later = startSession(db, clock, { machineInstanceId: machineId });
    endGame(db, clock, startGame(db, clock, later));
    startGame(db, clock, later);

    const list = sessionListQuery(db).all();

    expect(list.map((s) => [s.id, s.games])).toEqual([
      [later, 2],
      [sessionId, 1],
    ]);
  });
});

describe('empty sessions', () => {
  it('discards a session ended without games, and hides it from the list', () => {
    const { db, clock, machineId } = setup();
    const empty = startSession(db, clock, { machineInstanceId: machineId });

    endSession(db, clock, empty);

    const row = db.select().from(sessions).where(eq(sessions.id, empty)).get()!;
    expect(row.deletedAt).not.toBeNull();
    expect(row.needsPush).toBe(true);
    expect(sessionListQuery(db).all().map((s) => s.id)).not.toContain(empty);
  });

  it('only discards sessions that have no games', () => {
    const { db, clock, sessionId } = setup();

    expect(() => discardSession(db, clock, sessionId)).toThrow(/without games/);
  });

  it('hides older ended sessions that never had a game', () => {
    const { db, clock, machineId } = setup();
    const legacy = startSession(db, clock, { machineInstanceId: machineId });
    db.update(sessions).set({ endedAt: clock.now() }).where(eq(sessions.id, legacy)).run();

    expect(sessionListQuery(db).all().map((s) => s.id)).not.toContain(legacy);
  });
});

describe('notes', () => {
  it('attaches notes to balls and games and lists them per game and per machine', () => {
    const { db, clock, machineId, gameId } = setup();
    const ball = logBall(db, clock, { gameId, cumulativeScore: 100, drainReason: 'left_outlane' });

    addNote(db, clock, { ballId: ball, body: '  late on left ramp  ' });
    const gameNote = addNote(db, clock, { gameId, body: 'mode start too slow' });

    expect(gameNotes(db, gameId).map((n) => [n.body, n.ballId])).toEqual([
      ['late on left ramp', ball],
      ['mode start too slow', null],
    ]);
    expect(machineNotes(db, machineId).map((n) => [n.body, n.ballNumber])).toEqual([
      ['mode start too slow', null],
      ['late on left ramp', 1],
    ]);

    deleteNote(db, clock, gameNote);
    expect(gameNotes(db, gameId)).toHaveLength(1);
  });

  it('rejects empty notes and notes with no or two parents', () => {
    const { db, clock, gameId } = setup();
    const ball = logBall(db, clock, { gameId, cumulativeScore: 1 });

    expect(() => addNote(db, clock, { gameId, body: '   ' })).toThrow(/some text/);
    expect(() => addNote(db, clock, { body: 'x' })).toThrow(/exactly one/);
    expect(() => addNote(db, clock, { gameId, ballId: ball, body: 'x' })).toThrow(/exactly one/);
  });
});

describe('gameSummary', () => {
  it('returns a game with its machine and session, and nothing for a deleted game', () => {
    const { db, clock, sessionId, gameId } = setup();
    logBall(db, clock, { gameId, cumulativeScore: 2_000 });
    endGame(db, clock, gameId);

    expect(gameSummary(db, gameId)).toMatchObject({
      gameNumber: 1,
      finalScore: 2_000,
      sessionId,
      locationName: 'Ground Kontrol',
      machineName: 'GweeP-MW95j', // no catalog entry in this test, so the OPDB ID stands in
    });

    db.update(games).set({ deletedAt: clock.now() }).where(eq(games.id, gameId)).run();
    expect(gameSummary(db, gameId)).toBeUndefined();
  });
});

describe('updateBall', () => {
  it('corrects a score within its neighbours and changes the drain', () => {
    const { db, clock, gameId } = setup();
    logBall(db, clock, { gameId, cumulativeScore: 100 });
    const middle = logBall(db, clock, { gameId, cumulativeScore: 900, drainReason: 'left_outlane' });
    logBall(db, clock, { gameId, cumulativeScore: 1_000 });
    db.update(balls).set({ needsPush: false }).where(eq(balls.id, middle)).run();

    updateBall(db, clock, middle, { cumulativeScore: 250, drainReason: 'center_drain' });

    expect(db.select().from(balls).where(eq(balls.id, middle)).get()).toMatchObject({
      cumulativeScore: 250,
      drainReason: 'center_drain',
      needsPush: true,
    });
    expect(gameBalls(db, gameId).map((b) => b.delta)).toEqual([100, 150, 750]);
  });

  it('keeps scores in order and rejects unknown drains', () => {
    const { db, clock, gameId } = setup();
    logBall(db, clock, { gameId, cumulativeScore: 100 });
    const middle = logBall(db, clock, { gameId, cumulativeScore: 200 });
    logBall(db, clock, { gameId, cumulativeScore: 300 });

    expect(() => updateBall(db, clock, middle, { cumulativeScore: 50 })).toThrow(/lower than the ball before/);
    expect(() => updateBall(db, clock, middle, { cumulativeScore: 301 })).toThrow(/higher than the ball after/);
    expect(() => updateBall(db, clock, middle, { drainReason: 'trapdoor' as never })).toThrow(/Unknown drain/);
  });

  it('can switch a ball between tilt and a drain reason', () => {
    const { db, clock, gameId } = setup();
    const ball = logBall(db, clock, { gameId, cumulativeScore: 100, drainReason: 'other' });

    updateBall(db, clock, ball, { tilted: true, drainReason: null });

    expect(db.select().from(balls).where(eq(balls.id, ball)).get()).toMatchObject({ tilted: true, drainReason: null });
  });
});

describe('location autofill', () => {
  it('lists places most recently used first, merging case and spacing variants', () => {
    const db = createTestDb();
    const clock = createTestClock();
    const add = (place: string) => addMachineInstance(db, clock, { opdbMachineId: 'GweeP-MW95j', locationName: place });
    const ground = add('Ground Kontrol');
    add('Blair alley');
    add('  blair   ALLEY ');
    startSession(db, clock, { machineInstanceId: ground }); // played most recently

    expect(knownLocations(db)).toEqual(['Ground Kontrol', 'blair ALLEY']);
  });

  it('suggests word-start matches before matches elsewhere, and recent places when empty', () => {
    const known = ['Blair Alley', 'Ground Kontrol', 'Quarterworld', 'Wunderland Alberta'];

    expect(suggestLocations(known, '')).toEqual(known);
    expect(suggestLocations(known, 'al')).toEqual(['Blair Alley', 'Wunderland Alberta']);
    expect(suggestLocations(known, 'world')).toEqual(['Quarterworld']);
    expect(suggestLocations(known, 'blair alley')).toEqual([]);
    expect(suggestLocations(known, 'xyz')).toEqual([]);
  });
});
