import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { balls, games, sessions } from '@/db/schema';
import { median, percentile, rollingMedian, shares, type Share } from '@/domain/stats';

import type { LocalDb } from './db';

/** Games in the trend's rolling median. */
export const TREND_WINDOW = 5;

export type DrainKey = string | 'tilt' | 'unknown';

export interface MachineStats {
  games: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  best: number | null;
  /** Each finished game in play order, with the rolling median up to it. */
  trend: { gameId: string; index: number; playedAt: string; score: number; rollingMedian: number }[];
  /** Median points scored on each ball number, extra balls counted toward the ball they extended. */
  perBall: { ballNumber: number; median: number; games: number }[];
  /** How balls ended, most common first. Tilts count as "tilt"; balls without a reason as "unknown". */
  drains: Share<DrainKey>[];
}

/**
 * Stats for one physical machine. Only finished games count, and only that machine's own sessions:
 * scores are comparable only on the same machine and settings (decision 8).
 */
export function machineStats(db: LocalDb, machineInstanceId: string): MachineStats {
  const finished = db
    .select({ id: games.id, finalScore: games.finalScore, playedAt: games.createdAt })
    .from(games)
    .innerJoin(sessions, eq(sessions.id, games.sessionId))
    .where(
      and(
        eq(sessions.machineInstanceId, machineInstanceId),
        isNull(sessions.deletedAt),
        isNull(games.deletedAt),
        isNotNull(games.finalScore),
      ),
    )
    .orderBy(asc(games.createdAt))
    .all();

  const scores = finished.map((g) => g.finalScore!);
  const rolling = rollingMedian(scores, TREND_WINDOW);

  const ballRows = finished.length
    ? db
        .select({
          gameId: balls.gameId,
          ballNumber: balls.ballNumber,
          cumulativeScore: balls.cumulativeScore,
          drainReason: balls.drainReason,
          tilted: balls.tilted,
        })
        .from(balls)
        .where(and(inArray(balls.gameId, finished.map((g) => g.id)), isNull(balls.deletedAt)))
        .orderBy(asc(balls.gameId), asc(balls.sequence))
        .all()
    : [];

  // Points per ball number per game: an extra ball's points belong to the ball it extended.
  const pointsByBall = new Map<number, number[]>();
  let currentGame: string | null = null;
  let previousScore = 0;
  let gamePoints = new Map<number, number>();
  const flush = () => {
    for (const [n, pts] of gamePoints) pointsByBall.set(n, [...(pointsByBall.get(n) ?? []), pts]);
    gamePoints = new Map();
  };
  for (const b of ballRows) {
    if (b.gameId !== currentGame) {
      flush();
      currentGame = b.gameId;
      previousScore = 0;
    }
    gamePoints.set(b.ballNumber, (gamePoints.get(b.ballNumber) ?? 0) + b.cumulativeScore - previousScore);
    previousScore = b.cumulativeScore;
  }
  flush();

  return {
    games: scores.length,
    median: median(scores),
    p25: percentile(scores, 25),
    p75: percentile(scores, 75),
    best: scores.length ? Math.max(...scores) : null,
    trend: finished.map((g, i) => ({ gameId: g.id, index: i + 1, playedAt: g.playedAt, score: g.finalScore!, rollingMedian: rolling[i] })),
    perBall: [...pointsByBall.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ballNumber, pts]) => ({ ballNumber, median: median(pts)!, games: pts.length })),
    drains: shares<DrainKey>(ballRows.map((b) => (b.tilted ? 'tilt' : (b.drainReason ?? 'unknown')))),
  };
}

export interface MachineSummary {
  machineInstanceId: string;
  games: number;
  median: number | null;
  best: number | null;
}

/** Finished-game counts and scores for every machine, keyed by machine instance ID. */
export function machineSummaries(db: LocalDb): Map<string, MachineSummary> {
  const rows = db
    .select({ machineInstanceId: sessions.machineInstanceId, finalScore: games.finalScore })
    .from(games)
    .innerJoin(sessions, eq(sessions.id, games.sessionId))
    .where(and(isNull(sessions.deletedAt), isNull(games.deletedAt), isNotNull(games.finalScore)))
    .all();

  const scoresByMachine = new Map<string, number[]>();
  for (const r of rows) {
    scoresByMachine.set(r.machineInstanceId, [...(scoresByMachine.get(r.machineInstanceId) ?? []), r.finalScore!]);
  }

  return new Map(
    [...scoresByMachine].map(([machineInstanceId, scores]) => [
      machineInstanceId,
      { machineInstanceId, games: scores.length, median: median(scores), best: Math.max(...scores) },
    ]),
  );
}

export interface PracticeTotals {
  sessions: number;
  games: number;
  balls: number;
  machines: number;
  /** Finished games in the last 7 days. */
  gamesThisWeek: number;
}

/** Headline counts across all practice. Deleted rows don't count; unfinished games don't count as games. */
export function practiceTotals(db: LocalDb, now: Date = new Date()): PracticeTotals {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const count = (q: { get(): { n: number } | undefined }) => q.get()?.n ?? 0;
  return {
    sessions: count(db.select({ n: sql<number>`count(*)` }).from(sessions).where(isNull(sessions.deletedAt))),
    games: count(db.select({ n: sql<number>`count(*)` }).from(games).where(and(isNull(games.deletedAt), isNotNull(games.finalScore)))),
    balls: count(db.select({ n: sql<number>`count(*)` }).from(balls).where(isNull(balls.deletedAt))),
    machines: count(db.select({ n: sql<number>`count(DISTINCT ${sessions.machineInstanceId})` }).from(sessions).where(isNull(sessions.deletedAt))),
    gamesThisWeek: count(
      db
        .select({ n: sql<number>`count(*)` })
        .from(games)
        .where(and(isNull(games.deletedAt), isNotNull(games.finalScore), sql`${games.createdAt} >= ${weekAgo}`)),
    ),
  };
}
