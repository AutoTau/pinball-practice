import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { MachineArt } from '@/components/arcade';
import { Button, Card, EmptyState, ListRow, SectionHeader, Screen } from '@/components/ui';
import { machineListQuery } from '@/data/practice';
import { machineSummaries, practiceTotals } from '@/data/stats';
import { db } from '@/db/client';
import { shortScore } from '@/domain/score';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { fonts, makeStyles, space, type } from '@/theme';

/** Practice across every machine: headline totals, then each machine's median, busiest first. */
export default function StatsScreen() {
  const s = useStyles();
  useFocusRefresh();
  const totals = practiceTotals(db);
  const summaries = machineSummaries(db);
  const machines = machineListQuery(db)
    .all()
    .filter((m) => summaries.has(m.id))
    .sort((a, b) => summaries.get(b.id)!.games - summaries.get(a.id)!.games);

  if (totals.games === 0) {
    return (
      <Screen>
        <EmptyState title="No finished games yet" message="Finish a game and your practice totals show up here.">
          <Button title="Start a session" onPress={() => router.push('/session/new')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={s.tiles}>
        <Tile label="Games" value={totals.games} />
        <Tile label="This week" value={totals.gamesThisWeek} />
        <Tile label="Balls" value={totals.balls} />
        <Tile label="Machines" value={totals.machines} />
      </View>

      <SectionHeader title="Median by machine" />
      <Card padded={false}>
        {machines.map((m, i) => {
          const summary = summaries.get(m.id)!;
          return (
            <ListRow
              key={m.id}
              first={i === 0}
              left={<MachineArt uri={m.imageSmallUrl} size={44} />}
              title={m.machineName}
              subtitle={`${m.locationName} · ${summary.games} ${summary.games === 1 ? 'game' : 'games'} · best ${shortScore(summary.best!)}`}
              right={<Text style={s.median}>{shortScore(Math.round(summary.median!))}</Text>}
              onPress={() => router.push({ pathname: '/machine/[id]', params: { id: m.id } })}
            />
          );
        })}
      </Card>
      <Text style={s.footnote}>Medians, not averages: one monster game shouldn’t hide how you usually play.</Text>
    </Screen>
  );
}

function Tile(props: { label: string; value: number }) {
  const s = useStyles();
  return (
    <Card style={s.tile}>
      <View accessible accessibilityLabel={`${props.label}: ${props.value}`}>
        <Text style={s.tileValue}>{props.value.toLocaleString()}</Text>
        <Text style={s.tileLabel}>{props.label}</Text>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, padding: space.md },
  tileValue: { fontFamily: fonts.dmd, fontSize: 30, color: c.primary },
  tileLabel: { ...type.label, color: c.textMuted, marginTop: 2 },
  median: { fontFamily: fonts.dmd, fontSize: 20, color: c.primary },
  footnote: { ...type.caption, color: c.textMuted },
}));
