/**
 * @jest-environment node
 */
import type { Clock, LocalDb } from '@/data/db';
import { addMachineInstance, deleteBall, endGame, logBall, startGame, startSession } from '@/data/practice';
import { machineStats, machineSummaries, practiceTotals } from '@/data/stats';
import type { DrainReason } from '@/domain/drainReasons';
import { createTestClock, createTestDb } from '@/test/testDb';

type Ball = [score: number, drain: DrainReason | null, extra?: boolean, tilt?: boolean];

function playGame(db: LocalDb, clock: Clock, sessionId: string, ballsPlayed: Ball[], end = true) {
  const gameId = startGame(db, clock, sessionId);
  for (const [score, drain, extra, tilt] of ballsPlayed) {
    logBall(db, clock, { gameId, cumulativeScore: score, drainReason: drain, isExtraBall: extra, tilted: tilt });
  }
  if (end) endGame(db, clock, gameId);
  return gameId;
}

function setup() {
  const db = createTestDb();
  const clock = createTestClock();
  const machine = addMachineInstance(db, clock, { opdbMachineId: 'GweeP-MW95j', locationName: 'Blair Alley' });
  const session = startSession(db, clock, { machineInstanceId: machine });
  return { db, clock, machine, session };
}

describe('machineStats', () => {
  it('summarizes finished games with medians and percentiles', () => {
    const { db, clock, machine, session } = setup();
    for (const final of [100, 300, 200, 5_000]) playGame(db, clock, session, [[final, 'center_drain']]);
    playGame(db, clock, session, [[999_999, null]], false); // unfinished: ignored

    const s = machineStats(db, machine);

    expect(s).toMatchObject({ games: 4, median: 250, p25: 175, p75: 1475, best: 5_000 });
    expect(s.trend.map((t) => [t.index, t.score, t.rollingMedian])).toEqual([
      [1, 100, 100],
      [2, 300, 200],
      [3, 200, 200],
      [4, 5_000, 250],
    ]);
  });

  it('takes the median points per ball, folding extra balls into the ball they extended', () => {
    const { db, clock, machine, session } = setup();
    playGame(db, clock, session, [
      [100, 'left_outlane'],
      [150, null, true], // extra ball on ball 1: +50
      [400, 'center_drain'],
      [450, 'right_outlane'],
    ]);
    playGame(db, clock, session, [
      [300, 'left_outlane'],
      [500, 'left_outlane'],
      [900, null, false, true],
    ]);

    const s = machineStats(db, machine);

    expect(s.perBall).toEqual([
      { ballNumber: 1, median: 225, games: 2 }, // 150 and 300
      { ballNumber: 2, median: 225, games: 2 }, // 250 and 200
      { ballNumber: 3, median: 225, games: 2 }, // 50 and 400
    ]);
    expect(s.drains.map((d) => [d.key, d.count])).toEqual([
      ['left_outlane', 3],
      ['unknown', 1],
      ['center_drain', 1],
      ['right_outlane', 1],
      ['tilt', 1],
    ]);
  });

  it('ignores deleted balls and other machines', () => {
    const { db, clock, machine, session } = setup();
    const gameId = startGame(db, clock, session);
    const typo = logBall(db, clock, { gameId, cumulativeScore: 1_000_000, drainReason: 'other' });
    deleteBall(db, clock, typo);
    logBall(db, clock, { gameId, cumulativeScore: 100, drainReason: 'center_drain' });
    endGame(db, clock, gameId);

    const other = addMachineInstance(db, clock, { opdbMachineId: 'G4do5-MDlN7', locationName: 'Elsewhere' });
    playGame(db, clock, startSession(db, clock, { machineInstanceId: other }), [[9_999, 'other']]);

    const s = machineStats(db, machine);

    expect(s.games).toBe(1);
    expect(s.perBall).toEqual([{ ballNumber: 1, median: 100, games: 1 }]);
    expect(s.drains.map((d) => d.key)).toEqual(['center_drain']);
  });

  it('is empty before any game is finished', () => {
    const { db, machine } = setup();

    expect(machineStats(db, machine)).toEqual({
      games: 0,
      median: null,
      p25: null,
      p75: null,
      best: null,
      trend: [],
      perBall: [],
      drains: [],
    });
  });
});

describe('machineSummaries and practiceTotals', () => {
  it('summarizes each machine and counts practice overall', () => {
    const { db, clock, machine, session } = setup();
    playGame(db, clock, session, [[100, 'left_outlane'], [300, 'center_drain']]);
    playGame(db, clock, session, [[500, 'other']]);
    playGame(db, clock, session, [[1, null]], false); // unfinished
    const other = addMachineInstance(db, clock, { opdbMachineId: 'G4do5-MDlN7', locationName: 'Elsewhere' });
    playGame(db, clock, startSession(db, clock, { machineInstanceId: other }), [[9_000, 'other']]);

    const summaries = machineSummaries(db);
    const totals = practiceTotals(db, new Date('2026-10-23T00:00:00.000Z'));

    expect(summaries.get(machine)).toEqual({ machineInstanceId: machine, games: 2, median: 400, best: 500 });
    expect(summaries.get(other)).toMatchObject({ games: 1, best: 9_000 });
    expect(totals).toEqual({ sessions: 2, games: 3, balls: 5, machines: 2, gamesThisWeek: 3 });
    expect(practiceTotals(db, new Date('2026-11-30T00:00:00.000Z')).gamesThisWeek).toBe(0);
  });
});
