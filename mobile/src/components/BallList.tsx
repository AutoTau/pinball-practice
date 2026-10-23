import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import type { gameBalls, gameNotes } from '@/data/practice';
import { DRAIN_REASONS } from '@/domain/drainReasons';
import { formatScore, shortScore } from '@/domain/score';
import { makeStyles, space, type } from '@/theme';

type Ball = ReturnType<typeof gameBalls>[number];
type Note = ReturnType<typeof gameNotes>[number];

/** A game's balls, newest first, each with its points, drain reason and notes. Used live and in history. */
export function BallList(props: {
  balls: Ball[];
  notes: Note[];
  onPressBall?: (ball: Ball) => void;
  onLongPressBall?: (ball: Ball) => void;
  onLongPressNote?: (noteId: string) => void;
}) {
  const s = useStyles();
  return (
    <Card padded={false}>
      {[...props.balls].reverse().map((b, i) => (
        <Pressable
          key={b.id}
          onPress={props.onPressBall && (() => props.onPressBall!(b))}
          onLongPress={props.onLongPressBall && (() => props.onLongPressBall!(b))}
          accessibilityRole={props.onPressBall ? 'button' : undefined}
          accessibilityHint={props.onPressBall ? 'Tap to fix, long press to delete' : undefined}
          style={[s.row, i > 0 && s.divider]}>
          <Text style={s.number}>{b.isExtraBall ? 'EB' : `B${b.ballNumber}`}</Text>
          <View style={s.main}>
            <Text style={s.score}>{formatScore(b.cumulativeScore)}</Text>
            <Text style={s.drain} numberOfLines={1}>
              {b.tilted ? 'Tilt' : (DRAIN_REASONS.find((r) => r.code === b.drainReason)?.label ?? 'No reason')}
            </Text>
            {props.notes
              .filter((n) => n.ballId === b.id)
              .map((n) => (
                <Text key={n.id} style={s.note} onLongPress={props.onLongPressNote && (() => props.onLongPressNote!(n.id))}>
                  “{n.body}”
                </Text>
              ))}
          </View>
          <Text style={s.delta}>+{shortScore(b.delta)}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

/** Notes on the game itself rather than a ball. */
export function GameNotes(props: { notes: Note[]; onLongPressNote?: (noteId: string) => void }) {
  const s = useStyles();
  const gameLevel = props.notes.filter((n) => !n.ballId);
  if (gameLevel.length === 0) return null;
  return (
    <Card style={s.gameNotes}>
      {gameLevel.map((n) => (
        <Text key={n.id} style={s.note} onLongPress={props.onLongPressNote && (() => props.onLongPressNote!(n.id))}>
          “{n.body}”
        </Text>
      ))}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: c.border },
  number: { width: 32, ...type.label, color: c.textMuted },
  main: { flex: 1, gap: 2 },
  score: { ...type.bodyStrong, color: c.text, fontVariant: ['tabular-nums'] },
  drain: { ...type.caption, color: c.textSecondary },
  delta: { ...type.bodyStrong, color: c.success, fontVariant: ['tabular-nums'] },
  note: { ...type.caption, color: c.text, fontStyle: 'italic', marginTop: 2 },
  gameNotes: { gap: space.sm },
}));
