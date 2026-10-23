import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { MachineArt } from '@/components/arcade';
import { Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { machineListQuery } from '@/data/practice';
import { machineSummaries } from '@/data/stats';
import { db } from '@/db/client';
import { shortScore } from '@/domain/score';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { fonts, makeStyles, type } from '@/theme';

/** Every physical machine the player has set up, most recently played first. Tap for its stats. */
export default function MachinesScreen() {
  const s = useStyles();
  useFocusRefresh();
  const machines = machineListQuery(db).all();
  const summaries = machineSummaries(db);

  if (machines.length === 0) {
    return (
      <Screen>
        <EmptyState title="No machines yet" message="Machines appear here after your first session on them.">
          <Button title="Start a session" onPress={() => router.push('/session/new')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card padded={false}>
        {machines.map((m, i) => {
          const summary = summaries.get(m.id);
          const played = m.lastPlayed ? new Date(m.lastPlayed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
          return (
            <ListRow
              key={m.id}
              first={i === 0}
              left={<MachineArt uri={m.imageSmallUrl} size={48} />}
              title={m.machineName}
              subtitle={[m.locationName, played && `played ${played}`].filter(Boolean).join(' · ')}
              right={
                summary ? (
                  <View style={s.metric}>
                    <Text style={s.metricValue}>{shortScore(Math.round(summary.median!))}</Text>
                    <Text style={s.metricLabel}>{summary.games} {summary.games === 1 ? 'game' : 'games'}</Text>
                  </View>
                ) : undefined
              }
              onPress={() => router.push({ pathname: '/machine/[id]', params: { id: m.id } })}
            />
          );
        })}
      </Card>
      <Button title="Play a machine" onPress={() => router.push('/session/new')} />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  metric: { alignItems: 'flex-end' },
  metricValue: { fontFamily: fonts.dmd, fontSize: 18, color: c.primary },
  metricLabel: { ...type.caption, color: c.textMuted },
}));
