import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ArtHeader } from '@/components/arcade';
import { Button, Card, EmptyState, Field, Input, Screen } from '@/components/ui';
import { catalogMachine } from '@/data/catalog';
import { addMachineInstance, knownLocations, PracticeError, startSession, suggestLocations } from '@/data/practice';
import { clock, db } from '@/db/client';
import { makeStyles, radius, space, TAP_TARGET, type } from '@/theme';

const BALL_COUNTS = [1, 3, 5];

/** Describe a physical machine the first time it's played, then start a session on it. */
export default function NewMachineScreen() {
  const s = useStyles();
  const { opdbId } = useLocalSearchParams<{ opdbId: string }>();
  const entry = opdbId ? catalogMachine(db, opdbId) : undefined;

  const [location, setLocation] = useState('');
  const places = useMemo(() => knownLocations(db), []);
  const suggestions = suggestLocations(places, location);
  const [ballsPerGame, setBallsPerGame] = useState(3);
  const [ballSave, setBallSave] = useState('');
  const [tiltWarnings, setTiltWarnings] = useState('');
  const [codeVersion, setCodeVersion] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!entry) return <EmptyState title="Machine not found" message="It isn't in the downloaded machine list." />;

  function start() {
    try {
      const machineInstanceId = addMachineInstance(db, clock, {
        opdbMachineId: entry!.opdbMachineId,
        opdbAliasId: entry!.opdbAliasId,
        locationName: location,
        ballsPerGame,
        ballSaveSeconds: optionalWholeNumber(ballSave, 'Ball save'),
        tiltWarnings: optionalWholeNumber(tiltWarnings, 'Tilt warnings'),
      });
      const sessionId = startSession(db, clock, { machineInstanceId, codeVersion: codeVersion.trim() || null });
      router.dismissTo('/');
      router.push({ pathname: '/session/[id]', params: { id: sessionId } });
    } catch (e) {
      if (e instanceof PracticeError) setError(e.message);
      else throw e;
    }
  }

  return (
    <Screen contentInsetAdjustmentBehavior="never">
      <ArtHeader
        uri={entry.imageMediumUrl}
        eyebrow="New machine"
        title={entry.name}
        subtitle={[entry.manufacturer, entry.year, entry.display?.toUpperCase()].filter(Boolean).join(' · ')}
      />

      <Card style={s.form}>
        <Field label="Where is it?">
          <Input
            placeholder="e.g. Blair Alley"
            value={location}
            onChangeText={setLocation}
            autoFocus={places.length === 0}
            autoCapitalize="words"
          />
          {suggestions.length > 0 ? (
            <View style={s.suggestions} accessibilityLabel="Places you've played">
              {suggestions.map((place) => (
                <Pressable
                  key={place}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${place}`}
                  onPress={() => setLocation(place)}
                  style={({ pressed }) => [s.suggestion, pressed && s.suggestionPressed]}>
                  <Text style={s.suggestionText}>{place}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Field>

        <Field label="Balls per game">
          <View style={s.segments} accessibilityRole="radiogroup">
            {BALL_COUNTS.map((n) => {
              const on = n === ballsPerGame;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setBallsPerGame(n)}
                  style={[s.segment, on && s.segmentOn]}>
                  <Text style={[s.segmentText, on && s.segmentTextOn]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <View style={s.pair}>
          <Field label="Ball save (sec)" style={s.flex}>
            <Input keyboardType="number-pad" placeholder="Optional" value={ballSave} onChangeText={setBallSave} />
          </Field>
          <Field label="Tilt warnings" style={s.flex}>
            <Input keyboardType="number-pad" placeholder="Optional" value={tiltWarnings} onChangeText={setTiltWarnings} />
          </Field>
        </View>

        <Field label="Code version">
          <Input placeholder="Optional, e.g. 1.03" value={codeVersion} onChangeText={setCodeVersion} autoCapitalize="none" />
        </Field>
      </Card>

      <Text style={s.hint}>Settings are saved with each session, so scores stay comparable if the operator changes them.</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title="Start session" onPress={start} />
    </Screen>
  );
}

function optionalWholeNumber(text: string, label: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}$/.test(trimmed)) throw new PracticeError(`${label} must be a whole number.`);
  return Number(trimmed);
}

const useStyles = makeStyles((c) => ({
  form: { gap: space.lg },
  pair: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  suggestion: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceAlt,
    justifyContent: 'center',
  },
  suggestionPressed: { backgroundColor: c.primaryTint, borderColor: c.primary },
  suggestionText: { ...type.bodyStrong, color: c.text },
  segments: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.md, backgroundColor: c.surfaceAlt },
  segment: { flex: 1, minHeight: TAP_TARGET - 12, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: c.primary },
  segmentText: { ...type.bodyStrong, color: c.text },
  segmentTextOn: { color: c.onPrimary },
  hint: { ...type.caption, color: c.textMuted },
  error: { ...type.body, color: c.danger },
}));
