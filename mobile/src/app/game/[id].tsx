import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { ArtHeader } from '@/components/arcade';
import { BallList, GameNotes } from '@/components/BallList';
import { EmptyState, SectionHeader, Screen } from '@/components/ui';
import { gameBalls, gameNotes, gameSummary } from '@/data/practice';
import { db } from '@/db/client';
import { formatScore } from '@/domain/score';
import { fonts, makeStyles, type } from '@/theme';

/** A finished (or in-progress) game, ball by ball, read-only. */
export default function GameScreen() {
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = id ? gameSummary(db, id) : undefined;
  if (!game) return <EmptyState title="Game not found" />;

  const balls = gameBalls(db, game.id);
  const notes = gameNotes(db, game.id);
  const playedOn = new Date(game.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Screen contentInsetAdjustmentBehavior="never">
      <ArtHeader
        uri={game.imageMediumUrl}
        eyebrow={`Game ${game.gameNumber} · ${playedOn}`}
        title={game.machineName}
        subtitle={`${game.locationName} · ${game.ballsPerGame}-ball game`}
      />

      <View style={s.hero} accessible accessibilityLabel={`Final score ${formatScore(game.finalScore ?? 0)}`}>
        <Text style={s.heroLabel}>{game.finalScore === null ? 'IN PROGRESS' : 'FINAL SCORE'}</Text>
        <Text style={s.heroValue}>{formatScore(game.finalScore ?? balls.at(-1)?.cumulativeScore ?? 0)}</Text>
      </View>

      {balls.length > 0 ? (
        <>
          <SectionHeader title="Ball by ball" />
          <BallList balls={balls} notes={notes} />
        </>
      ) : (
        <EmptyState title="No balls logged" />
      )}

      {notes.some((n) => !n.ballId) ? (
        <>
          <SectionHeader title="Game notes" />
          <GameNotes notes={notes} />
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { gap: 2 },
  heroLabel: { ...type.label, color: c.textMuted },
  heroValue: { fontFamily: fonts.dmd, fontSize: 40, color: c.primary, letterSpacing: 1 },
}));
