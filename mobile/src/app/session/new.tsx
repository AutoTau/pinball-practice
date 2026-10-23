import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MachineArt } from '@/components/arcade';
import { Card, EmptyState, Input, ListRow, SectionHeader, Screen } from '@/components/ui';
import { machineListQuery, startSession } from '@/data/practice';
import { clock, db } from '@/db/client';
import { searchMachines } from '@/domain/catalogSearch';
import { useCatalog, type CatalogStatus } from '@/hooks/useCatalog';
import { makeStyles, space, type, useTheme } from '@/theme';

type MyMachine = ReturnType<ReturnType<typeof machineListQuery>['all']>[number];

export default function PickMachineScreen() {
  const [query, setQuery] = useState('');
  const catalog = useCatalog();
  // See index.tsx for why the live query result is re-typed.
  const { data: mine } = useLiveQuery(machineListQuery(db) as never) as { data: MyMachine[] };

  const results = useMemo(() => searchMachines(catalog.machines, query), [catalog.machines, query]);
  const searching = query.trim().length > 0;

  function playExisting(machineInstanceId: string) {
    const sessionId = startSession(db, clock, { machineInstanceId });
    router.replace({ pathname: '/session/[id]', params: { id: sessionId } });
  }

  return (
    <Screen>
      <Input
        placeholder="Search machines — Godzilla, GZ, Mars…"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel="Search machines"
      />
      <CatalogBanner status={catalog.status} error={catalog.error} empty={catalog.machines.length === 0} onRetry={catalog.refresh} />

      {searching ? (
        results.length > 0 ? (
          <Card padded={false}>
            {results.map((m, i) => (
              <ListRow
                key={m.opdbId}
                first={i === 0}
                left={<MachineArt uri={m.imageSmallUrl} size={44} />}
                title={m.name}
                subtitle={[m.manufacturer, m.year].filter(Boolean).join(' · ')}
                onPress={() => router.push({ pathname: '/machine/new', params: { opdbId: m.opdbId } })}
              />
            ))}
          </Card>
        ) : query.trim().length >= 2 && catalog.machines.length > 0 ? (
          <EmptyState title="No machines match" message="Try the title's main word or its short name, like GZ." />
        ) : null
      ) : mine.length > 0 ? (
        <>
          <SectionHeader title="Your machines" />
          <Card padded={false}>
            {mine.map((m, i) => (
              <ListRow
                key={m.id}
                first={i === 0}
                left={<MachineArt uri={m.imageSmallUrl} size={44} />}
                title={m.machineName}
                subtitle={m.locationName}
                onPress={() => playExisting(m.id)}
              />
            ))}
          </Card>
        </>
      ) : (
        <EmptyState title="Find your machine" message="Search by name. Typos are fine." />
      )}
      <Credit />
    </Screen>
  );
}

/** Attribution for the catalog and its art (decision 40). */
function Credit() {
  const s = useStyles();
  return <Text style={s.credit}>Machine data and images from the Open Pinball Database (opdb.org)</Text>;
}

function CatalogBanner(props: { status: CatalogStatus; error: string | null; empty: boolean; onRetry: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  if (!props.empty) return null;
  if (props.status === 'loading') {
    return (
      <View style={s.banner}>
        <ActivityIndicator color={colors.primary} />
        <Text style={s.bannerText}>Downloading the machine list…</Text>
      </View>
    );
  }
  if (props.status === 'offline') {
    return (
      <Pressable style={s.banner} onPress={props.onRetry} accessibilityRole="button">
        <Text style={[s.bannerText, { color: colors.danger }]}>Couldn’t download the machine list ({props.error}). Tap to retry.</Text>
      </Pressable>
    );
  }
  return null;
}

const useStyles = makeStyles((c) => ({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bannerText: { ...type.caption, color: c.textSecondary, flexShrink: 1 },
  credit: { ...type.caption, color: c.textMuted, textAlign: 'center', marginTop: space.lg },
}));
