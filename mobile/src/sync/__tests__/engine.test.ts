/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';

import { addMachineInstance, endGame, logBall, startGame, startSession } from '@/data/practice';
import { balls, games, machineInstances, sessions, syncState } from '@/db/schema';
import type { BallDto, GameDto } from '@/sync/contract';
import { pullChanges, pushChanges, syncNow } from '@/sync/engine';
import { pendingChanges } from '@/sync/status';
import { FakeSyncServer } from '@/test/fakeSyncServer';
import { createTestClock, createTestDb } from '@/test/testDb';

function playOneGame() {
  const db = createTestDb();
  const clock = createTestClock();
  const machine = addMachineInstance(db, clock, { opdbMachineId: 'GweeP-MW95j', locationName: 'Blair Alley' });
  const session = startSession(db, clock, { machineInstanceId: machine });
  const game = startGame(db, clock, session);
  const ball = logBall(db, clock, { gameId: game, cumulativeScore: 340_000_000, drainReason: 'left_outlane' });
  return { db, clock, machine, session, game, ball };
}

const pending = (db: ReturnType<typeof createTestDb>) =>
  [machineInstances, sessions, games, balls].reduce(
    (n, t) => n + db.select().from(t).where(eq(t.needsPush, true)).all().length,
    0,
  );

describe('sync engine', () => {
  it('pushes local changes parent first and clears their flags', async () => {
    const { db, clock } = playOneGame();
    const server = new FakeSyncServer();

    const summary = await syncNow(db, server, clock);

    expect(summary.pushed).toBe(4);
    expect(pending(db)).toBe(0);
    const sent = server.pushes[0];
    expect([sent.machineInstances.length, sent.sessions.length, sent.games.length, sent.balls.length]).toEqual([1, 1, 1, 1]);
    expect(sent.balls[0]).not.toHaveProperty('needsPush');
    expect(sent.deviceId).toBe(db.select().from(syncState).where(eq(syncState.key, 'device_id')).get()!.value);
  });

  it('counts changes waiting to sync', async () => {
    const { db, clock } = playOneGame();

    expect(pendingChanges(db)).toBe(4);
    await syncNow(db, new FakeSyncServer(), clock);
    expect(pendingChanges(db)).toBe(0);
  });

  it('only pushes what changed since the last sync', async () => {
    const { db, clock, game } = playOneGame();
    const server = new FakeSyncServer();
    await syncNow(db, server, clock);

    endGame(db, clock, game);
    await syncNow(db, server, clock);

    expect(server.pushes[1].games).toHaveLength(1);
    expect(server.pushes[1].balls).toHaveLength(0);
  });

  it('keeps a record flagged when it was edited while its push was in flight', async () => {
    const { db, clock, game } = playOneGame();
    const server = new FakeSyncServer();
    server.duringPush = () => endGame(db, clock, game);

    await pushChanges(db, server, 'device');

    expect(db.select().from(games).where(eq(games.id, game)).get()!.needsPush).toBe(true);
    expect(pending(db)).toBe(1);
  });

  it('keeps rejected records flagged and reports why', async () => {
    const { db, clock, ball } = playOneGame();
    const server = new FakeSyncServer();
    server.rejectIds.add(ball);

    const summary = await syncNow(db, server, clock);

    expect(summary.rejected).toEqual([{ table: 'balls', id: ball, reason: 'test rejection' }]);
    expect(db.select().from(balls).where(eq(balls.id, ball)).get()!.needsPush).toBe(true);
  });

  it('splits large backlogs into pushes of at most 500, parents first', async () => {
    const { db, clock, game } = playOneGame();
    for (let i = 0; i < 520; i++) logBall(db, clock, { gameId: game, cumulativeScore: 340_000_000 + i, isExtraBall: true });
    const server = new FakeSyncServer();

    await pushChanges(db, server, 'device');

    expect(server.pushes.map((p) => p.machineInstances.length + p.sessions.length + p.games.length + p.balls.length)).toEqual([500, 24]);
    expect(server.pushes[0].games).toHaveLength(1);
    expect(pending(db)).toBe(0);
  });

  it("pulls another device's records across pages, even when children arrive before parents", async () => {
    const source = playOneGame();
    const server = new FakeSyncServer(2);
    await syncNow(source.db, server, source.clock);
    // Another device edits the game later, so it moves behind its ball in the server's change log.
    const edited = server.rows.get(source.game)!.record as GameDto;
    server.write('games', { ...edited, finalScore: 340_000_000, updatedAt: '2026-10-22T20:00:00.000Z' } as GameDto);

    const phone = createTestDb();
    const pulled = await pullChanges(phone, server);

    expect(pulled).toBe(4);
    expect(phone.select().from(games).get()).toMatchObject({ finalScore: 340_000_000, needsPush: false });
    expect(phone.select().from(balls).get()!.cumulativeScore).toBe(340_000_000);
    expect(phone.select().from(syncState).where(eq(syncState.key, 'pull_cursor')).get()!.value).toBe('5');
    // Times are stored in the phone's own format, not the server's "+00:00".
    expect(phone.select().from(games).get()!.updatedAt).toBe('2026-10-22T20:00:00.000Z');
  });

  it('keeps a newer local edit over an older server copy, and takes a newer server copy', async () => {
    const { db, clock, ball } = playOneGame();
    const server = new FakeSyncServer();
    await syncNow(db, server, clock);
    const serverBall = server.rows.get(ball)!.record as BallDto;

    // Local edit at 19:30 beats an older server write at 19:10...
    db.update(balls).set({ drainReason: 'center_drain', updatedAt: '2026-10-22T19:30:00.000Z', needsPush: true }).where(eq(balls.id, ball)).run();
    server.write('balls', { ...serverBall, drainReason: 'right_outlane', updatedAt: '2026-10-22T19:10:00.000Z' } as BallDto);
    await pullChanges(db, server);
    expect(db.select().from(balls).where(eq(balls.id, ball)).get()).toMatchObject({ drainReason: 'center_drain', needsPush: true });

    // ...but a server write at 19:45 beats it.
    server.write('balls', { ...serverBall, drainReason: 'right_outlane', updatedAt: '2026-10-22T19:45:00.000Z' } as BallDto);
    await pullChanges(db, server);
    expect(db.select().from(balls).where(eq(balls.id, ball)).get()).toMatchObject({ drainReason: 'right_outlane', needsPush: false });
  });

  it('turns foreign keys back on after a pull', async () => {
    const db = createTestDb();
    await pullChanges(db, new FakeSyncServer());

    expect(() =>
      db.insert(games).values({ id: 'g', createdAt: 'x', updatedAt: 'x', sessionId: 'missing', gameNumber: 1 }).run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
