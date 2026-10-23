import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useReducer, useRef, useState, type ComponentRef } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { ArtHeader, DmdScoreInput } from '@/components/arcade';
import { BallList, GameNotes } from '@/components/BallList';
import { Button, Card, EmptyState, Input, ListRow, SectionHeader, Screen } from '@/components/ui';
import {
  activeGame,
  addNote,
  deleteBall,
  deleteNote,
  discardSession,
  endGame,
  endSession,
  gameNotes,
  gameBalls,
  gameProgress,
  logBall,
  MAX_NOTE_LENGTH,
  PracticeError,
  sessionDetail,
  sessionGames,
  startGame,
  updateBall,
} from '@/data/practice';
import { clock, db } from '@/db/client';
import { useSync } from '@/sync/SyncProvider';
import { DRAIN_REASONS, type DrainReason } from '@/domain/drainReasons';
import { formatScore, parseScore, scoreDigits } from '@/domain/score';
import { makeStyles, radius, space, TAP_TARGET, type, useTheme } from '@/theme';

/** Logging a ball: type the score on the display, tap why it drained. */
export default function SessionScreen() {
  const s = useStyles();
  const { requestSync } = useSync();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The data layer is synchronous; bumping this re-reads it after every write.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [error, setError] = useState<string | null>(null);

  const session = id ? sessionDetail(db, id) : undefined;
  if (!session) return <EmptyState title="Session not found" />;

  const game = activeGame(db, session.id);
  const games = sessionGames(db, session.id);

  function run(action: () => void) {
    try {
      action();
      setError(null);
      refresh();
    } catch (e) {
      if (e instanceof PracticeError) setError(e.message);
      else throw e;
    }
  }

  return (
    <Screen contentInsetAdjustmentBehavior="never">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="link"
              hitSlop={12}
              onPress={() => router.push({ pathname: '/machine/[id]', params: { id: session.machineInstanceId } })}>
              <Text style={s.headerLink}>STATS</Text>
            </Pressable>
          ),
        }}
      />
      <ArtHeader
        uri={session.imageMediumUrl}
        eyebrow={session.endedAt ? 'Session ended' : 'Practice session'}
        title={session.machineName}
        subtitle={`${session.locationName} · ${session.ballsPerGame}-ball games`}
      />

      {game ? (
        <GameLogger key={game.id} gameId={game.id} gameNumber={game.gameNumber} run={run} error={error} onGameEnded={requestSync} />
      ) : (
        <>
          {games.length > 0 ? (
            <>
              <SectionHeader title="Games" />
              <Card padded={false}>
                {games.map((g, i) => (
                  <ListRow
                    key={g.id}
                    first={i === 0}
                    title={formatScore(g.finalScore ?? 0)}
                    subtitle={`Game ${g.gameNumber} · ${g.balls} balls`}
                    onPress={() => router.push({ pathname: '/game/[id]', params: { id: g.id } })}
                  />
                ))}
              </Card>
            </>
          ) : (
            <EmptyState title="Ready when you are" message="Start a game, then log each ball as it drains." />
          )}
          {error ? <Text style={s.error}>{error}</Text> : null}
          {session.endedAt ? (
            <Text style={s.context}>This session has ended.</Text>
          ) : (
            <>
              <Button title={games.length ? 'Start next game' : 'Start game'} onPress={() => run(() => startGame(db, clock, session.id))} />
              {games.length > 0 ? (
                <Button
                  title="End session"
                  variant="secondary"
                  onPress={() => {
                    endSession(db, clock, session.id);
                    requestSync();
                    router.back();
                  }}
                />
              ) : (
                <Button
                  title="Discard session"
                  variant="danger"
                  onPress={() => {
                    discardSession(db, clock, session.id);
                    router.back();
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function GameLogger(props: {
  gameId: string;
  gameNumber: number;
  run: (action: () => void) => void;
  error: string | null;
  /** Called after the game ends, e.g. to sync it. */
  onGameEnded: () => void;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const { gameId, run } = props;
  const [digits, setDigits] = useState('');
  const [extraBall, setExtraBall] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  /** The ball being corrected; while set, the score panel and drain buttons edit it instead of logging. */
  const [editing, setEditing] = useState<{ id: string; ballNumber: number; previousScore: number } | null>(null);

  const progress = gameProgress(db, gameId);
  const balls = gameBalls(db, gameId);
  const notes = gameNotes(db, gameId);
  const lastBall = balls.at(-1);
  const noteTarget = lastBall ? `ball ${lastBall.ballNumber}` : 'this game';
  const score = parseScore(digits);
  const baseline = editing ? editing.previousScore : progress.lastScore;
  const delta = score !== null ? score - baseline : null;
  const waitingToEnd = progress.regularBallsDone && !extraBall && !editing;
  const ballLabel = editing
    ? `Fix ball ${editing.ballNumber}`
    : extraBall
      ? 'Extra ball'
      : waitingToEnd
        ? 'All balls played'
        : `Ball ${progress.nextBall} of ${progress.ballsPerGame}`;

  function log(drainReason: DrainReason | null, tilted = false) {
    if (score === null) {
      input.current?.focus();
      return;
    }
    run(() => {
      if (editing) {
        updateBall(db, clock, editing.id, { cumulativeScore: score, drainReason, tilted });
        setEditing(null);
      } else {
        logBall(db, clock, { gameId, cumulativeScore: score, drainReason, isExtraBall: extraBall, tilted });
      }
      setDigits('');
      setExtraBall(false);
    });
  }

  function startEditing(ballId: string) {
    const at = balls.findIndex((b) => b.id === ballId);
    const ball = balls[at];
    setEditing({ id: ball.id, ballNumber: ball.ballNumber, previousScore: balls[at - 1]?.cumulativeScore ?? 0 });
    setDigits(String(ball.cumulativeScore));
    setExtraBall(false);
    input.current?.focus();
  }

  function stopEditing() {
    setEditing(null);
    setDigits('');
  }

  function saveNote() {
    run(() => {
      addNote(db, clock, lastBall ? { ballId: lastBall.id, body: noteDraft ?? '' } : { gameId, body: noteDraft ?? '' });
      setNoteDraft(null);
    });
  }

  function confirmDeleteNote(noteId: string) {
    Alert.alert('Delete this note?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(() => deleteNote(db, clock, noteId)) },
    ]);
  }

  function confirmDelete(ballId: string, ballNumber: number) {
    Alert.alert(`Delete ball ${ballNumber}?`, 'Use this to fix a mistyped score.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(() => deleteBall(db, clock, ballId)) },
    ]);
  }

  return (
    <>
      <View style={s.progressRow}>
        <Text style={s.gameLabel}>GAME {props.gameNumber}</Text>
        <Text style={[s.ballLabel, (extraBall || editing) && { color: colors.accent }]}>{ballLabel}</Text>
      </View>
      {editing ? (
        <Pressable onPress={stopEditing} accessibilityRole="button" style={s.editBanner}>
          <Text style={s.editBannerText}>Correct the score, then tap how it drained. Tap here to cancel.</Text>
        </Pressable>
      ) : null}

      {!waitingToEnd ? (
        <>
          <DmdScoreInput
            ref={input}
            value={digits ? formatScore(Number(digits)) : ''}
            onChangeText={(t) => setDigits(scoreDigits(t))}
            placeholder="0"
            keyboardType="number-pad"
            autoFocus
            accessibilityLabel="Score on the display after this ball"
            warn={delta !== null && delta < 0}
            caption={
              delta === null
                ? 'Score on the display'
                : delta < 0
                  ? `Lower than ${editing ? 'the ball before' : 'last ball'} (${formatScore(baseline)})`
                  : `+${formatScore(delta)} this ball`
            }
          />

          <SectionHeader title="How did it drain?" />
          <View style={s.grid}>
            {DRAIN_REASONS.map((r) => (
              <DrainButton key={r.code} label={r.label} onPress={() => log(r.code)} disabled={score === null} />
            ))}
            <DrainButton label="Tilt" onPress={() => log(null, true)} disabled={score === null} />
            {editing ? null : <Toggle label="Extra ball" on={extraBall} onPress={() => setExtraBall(!extraBall)} />}
          </View>
        </>
      ) : (
        <Card>
          <Text style={s.doneText}>
            All {progress.ballsPerGame} balls logged. End the game, or add an extra ball.
          </Text>
          <Toggle label="Extra ball" on={extraBall} onPress={() => setExtraBall(!extraBall)} style={s.doneToggle} />
        </Card>
      )}

      {noteDraft === null ? (
        <Pressable style={s.noteLink} onPress={() => setNoteDraft('')} accessibilityRole="button" hitSlop={8}>
          <Text style={s.noteLinkText}>+ Note on {noteTarget}</Text>
        </Pressable>
      ) : (
        <Card style={s.noteCard}>
          <Input
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder="What happened? e.g. late on the left ramp"
            autoFocus
            multiline
            maxLength={MAX_NOTE_LENGTH}
            accessibilityLabel={`Note on ${noteTarget}`}
          />
          <View style={s.noteActions}>
            <Button title="Cancel" variant="secondary" onPress={() => setNoteDraft(null)} style={s.flex} />
            <Button title="Save note" onPress={saveNote} disabled={!noteDraft.trim()} style={s.flex} />
          </View>
        </Card>
      )}

      {props.error ? <Text style={s.error}>{props.error}</Text> : null}

      <Button
        title={`End game · ${formatScore(progress.lastScore)}`}
        variant={waitingToEnd ? 'primary' : 'secondary'}
        onPress={() => {
          run(() => endGame(db, clock, gameId));
          props.onGameEnded();
        }}
      />

      {balls.length > 0 ? (
        <>
          <SectionHeader title="This game" right={<Text style={s.hintSmall}>Tap to fix · hold to delete</Text>} />
          <BallList
            balls={balls}
            notes={notes}
            onPressBall={(b) => startEditing(b.id)}
            onLongPressBall={(b) => confirmDelete(b.id, b.ballNumber)}
            onLongPressNote={confirmDeleteNote}
          />
        </>
      ) : null}

      {notes.some((n) => !n.ballId) ? (
        <>
          <SectionHeader title="Game notes" />
          <GameNotes notes={notes} onLongPressNote={confirmDeleteNote} />
        </>
      ) : null}
    </>
  );
}

function DrainButton(props: { label: string; onPress: () => void; disabled?: boolean }) {
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [s.drain, props.disabled && s.drainDisabled, pressed && s.drainPressed]}>
      <Text style={s.drainText}>{props.label}</Text>
    </Pressable>
  );
}

function Toggle(props: { label: string; on: boolean; onPress: () => void; style?: object }) {
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: props.on }}
      onPress={props.onPress}
      style={[s.drain, s.toggle, props.on && s.toggleOn, props.style]}>
      <Text style={[s.drainText, s.toggleText, props.on && s.toggleTextOn]}>
        {props.on ? `✓ ${props.label}` : `+ ${props.label}`}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  editBanner: { backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.md, borderLeftWidth: 3, borderLeftColor: c.accent },
  editBannerText: { ...type.caption, color: c.text },
  noteLink: { alignSelf: 'flex-start', paddingVertical: space.xs },
  noteLinkText: { ...type.bodyStrong, color: c.primary },
  noteCard: { gap: space.md },
  noteActions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  headerLink: { ...type.label, color: '#ffffff', textShadowColor: '#000', textShadowRadius: 6 },
  context: { ...type.caption, color: c.textSecondary },
  error: { ...type.body, color: c.danger },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.sm },
  gameLabel: { ...type.label, color: c.textMuted },
  ballLabel: { ...type.title, color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  drain: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: TAP_TARGET + 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drainPressed: { backgroundColor: c.primaryTint },
  drainDisabled: { opacity: 0.4 },
  drainText: { ...type.bodyStrong, color: c.primary },
  toggle: { borderStyle: 'dashed', borderColor: c.accent },
  toggleOn: { backgroundColor: c.accent, borderStyle: 'solid' },
  toggleText: { color: c.accent },
  toggleTextOn: { color: c.onAccent },
  doneText: { ...type.body, color: c.text },
  doneToggle: { marginTop: space.md },
  hintSmall: { ...type.caption, color: c.textMuted },
}));
