import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import { MachineArt } from '@/components/arcade';
import { Button, Card, EmptyState, ListRow, Pill, SectionHeader } from '@/components/ui';
import { sessionListQuery } from '@/data/practice';
import { db } from '@/db/client';
import { makeStyles, space } from '@/theme';

type SessionRow = ReturnType<ReturnType<typeof sessionListQuery>['all']>[number];

function describe(s: SessionRow) {
  const date = new Date(s.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return [s.locationName, date, `${s.games} ${s.games === 1 ? 'game' : 'games'}`].join(' · ');
}

export default function SessionsScreen() {
  const s = useStyles();
  // useLiveQuery is typed for the expo driver's queries; the data layer builds them against the
  // driver-neutral LocalDb, which is the same object at runtime, so re-assert the row type here.
  const { data } = useLiveQuery(sessionListQuery(db) as never) as { data: SessionRow[] };
  const start = () => router.push('/session/new');

  if (data.length === 0) {
    return (
      <View style={s.screen}>
        <EmptyState title="No practice sessions yet" message="Pick the machine you're on and log your first game.">
          <Button title="Start a session" onPress={start} style={s.emptyButton} />
        </EmptyState>
      </View>
    );
  }

  const live = data.filter((x) => !x.endedAt);
  const past = data.filter((x) => x.endedAt);

  return (
    <View style={s.screen}>
      <FlatList
        data={[{ key: 'live', rows: live }, { key: 'past', rows: past }].filter((g) => g.rows.length > 0)}
        keyExtractor={(g) => g.key}
        contentContainerStyle={s.list}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item: group }) => (
          <View style={s.group}>
            <SectionHeader title={group.key === 'live' ? 'In progress' : 'Recent'} />
            <Card padded={false}>
              {group.rows.map((row, i) => (
                <ListRow
                  key={row.id}
                  first={i === 0}
                  left={<MachineArt uri={row.imageSmallUrl} size={44} />}
                  title={row.machineName}
                  subtitle={describe(row)}
                  right={row.endedAt ? undefined : <Pill label="LIVE" tone="accent" />}
                  onPress={() => router.push({ pathname: '/session/[id]', params: { id: row.id } })}
                />
              ))}
            </Card>
          </View>
        )}
      />
      <View style={s.footer}>
        <Button title="Start a session" onPress={start} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  list: { padding: space.lg, gap: space.sm, paddingBottom: space.xl },
  group: { gap: space.sm },
  footer: { padding: space.lg, paddingTop: space.sm, backgroundColor: c.background },
  emptyButton: { marginTop: space.lg, alignSelf: 'stretch' },
}));
