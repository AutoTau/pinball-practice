import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DrainBars } from '@/components/charts/DrainBars';
import { PointsByBallChart } from '@/components/charts/PointsByBallChart';
import { ScoreTrendChart } from '@/components/charts/ScoreTrendChart';
import { ArtHeader } from '@/components/arcade';
import { Card, EmptyState, SectionHeader, Screen } from '@/components/ui';
import { machineDetail, machineNotes } from '@/data/practice';
import { machineStats, TREND_WINDOW } from '@/data/stats';
import { db } from '@/db/client';
import { formatScore, shortScore } from '@/domain/score';
import { fonts, makeStyles, space, type } from '@/theme';

/** Practice stats for one physical machine, all from the phone's own data. */
export default function MachineStatsScreen() {
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const machine = id ? machineDetail(db, id) : undefined;
  const stats = useMemo(() => (id ? machineStats(db, id) : undefined), [id]);
  const notes = useMemo(() => (id ? machineNotes(db, id) : []), [id]);

  if (!machine || !stats) return <EmptyState title="Machine not found" />;

  return (
    <Screen contentInsetAdjustmentBehavior="never">
      <ArtHeader uri={machine.imageMediumUrl} eyebrow="Machine stats" title={machine.machineName} subtitle={machine.locationName} />

      {stats.games === 0 ? (
        <EmptyState title="No finished games yet" message="Finish a game on this machine and your stats appear here." />
      ) : (
        <>
          <View style={s.hero}>
            <Text style={s.heroLabel}>MEDIAN GAME</Text>
            <Text style={s.heroValue} accessibilityLabel={`Median game ${formatScore(Math.round(stats.median!))}`}>
              {formatScore(Math.round(stats.median!))}
            </Text>
          </View>
          <View style={s.tiles}>
            <Tile label="Typical range" value={`${shortScore(Math.round(stats.p25!))}–${shortScore(Math.round(stats.p75!))}`} />
            <Tile label="Best" value={shortScore(stats.best!)} />
            <Tile label="Games" value={String(stats.games)} />
          </View>
          <Text style={s.footnote}>Typical range is your middle half of games (25th to 75th percentile).</Text>

          <SectionHeader title="Score trend" />
          <Card>
            {stats.trend.length >= 2 ? (
              <ScoreTrendChart trend={stats.trend} window={TREND_WINDOW} />
            ) : (
              <Text style={s.context}>Play another game to see a trend.</Text>
            )}
          </Card>

          {stats.perBall.length > 0 ? (
            <>
              <SectionHeader title="Median points by ball" />
              <Card>
                <PointsByBallChart perBall={stats.perBall} />
              </Card>
            </>
          ) : null}

          {stats.drains.length > 0 ? (
            <>
              <SectionHeader title="How your balls drain" />
              <Card>
                <DrainBars drains={stats.drains} />
              </Card>
            </>
          ) : null}

          {notes.length > 0 ? (
            <>
              <SectionHeader title="Recent notes" />
              <Card style={s.notes}>
                {notes.map((n) => (
                  <View key={n.id}>
                    <Text style={s.noteBody}>“{n.body}”</Text>
                    <Text style={s.noteMeta}>
                      {[n.ballNumber ? `Ball ${n.ballNumber}` : 'Game', new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })].join(' · ')}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title="All games" />
          <Card padded={false}>
            {[...stats.trend].reverse().map((g, i) => (
              <Pressable
                key={g.gameId}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: g.gameId } })}
                style={({ pressed }) => [s.gameRow, i > 0 && s.gameDivider, pressed && s.gamePressed]}>
                <Text style={s.gameNo}>#{g.index}</Text>
                <Text style={s.gameDate}>{new Date(g.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                <Text style={s.gameScore}>{formatScore(g.score)}</Text>
                <Text style={s.chevron}>›</Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Tile(props: { label: string; value: string }) {
  const s = useStyles();
  return (
    <Card style={s.tile}>
      <View accessible accessibilityLabel={`${props.label}: ${props.value}`}>
        <Text style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit>
          {props.value}
        </Text>
        <Text style={s.tileLabel}>{props.label}</Text>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  context: { ...type.caption, color: c.textSecondary },
  hero: { gap: 2 },
  heroLabel: { ...type.label, color: c.textMuted },
  heroValue: { fontFamily: fonts.dmd, fontSize: 40, color: c.primary, letterSpacing: 1 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.md },
  tileValue: { ...type.heading, color: c.text, fontVariant: ['tabular-nums'] },
  tileLabel: { ...type.caption, color: c.textSecondary, marginTop: 2 },
  footnote: { ...type.caption, color: c.textMuted },
  notes: { gap: space.md },
  noteBody: { ...type.body, color: c.text, fontStyle: 'italic' },
  noteMeta: { ...type.caption, color: c.textMuted },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  gameDivider: { borderTopWidth: 1, borderTopColor: c.border },
  gamePressed: { backgroundColor: c.surfaceAlt },
  chevron: { fontSize: 20, color: c.textMuted, marginTop: -2 },
  gameNo: { width: 36, ...type.caption, color: c.textMuted, fontVariant: ['tabular-nums'] },
  gameDate: { flex: 1, ...type.caption, color: c.textSecondary },
  gameScore: { ...type.bodyStrong, color: c.text, fontVariant: ['tabular-nums'] },
}));
