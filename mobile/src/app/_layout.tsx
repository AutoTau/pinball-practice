import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { Doto_900Black } from '@expo-google-fonts/doto';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { apiUrl } from '@/config';
import { refreshCatalog } from '@/data/catalog';
import { db, expoDb } from '@/db/client';
import { headerOptions, overArtHeader, useTheme } from '@/theme';

import migrations from '../../drizzle/migrations';

export default function RootLayout() {
  const { success, error } = useMigrations(expoDb, migrations);
  const [fontsLoaded] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, Doto_900Black });
  const { colors, scheme } = useTheme();

  // Keep the offline catalog (names, art) current. Offline or failing is fine: the stored copy is used.
  useEffect(() => {
    if (success) refreshCatalog(db, fetch, apiUrl).catch(() => undefined);
  }, [success]);

  if (error || !success || !fontsLoaded) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {error ? (
          <Text style={{ color: colors.danger }}>Couldn’t prepare the database: {error.message}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  // GestureHandlerRootView lets charts respond to press-and-hold.
  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ ...headerOptions(colors), contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="session/new" options={{ title: 'Pick a machine', presentation: 'modal' }} />
        <Stack.Screen name="machine/new" options={overArtHeader} />
        <Stack.Screen name="machine/[id]" options={overArtHeader} />
        <Stack.Screen name="session/[id]" options={overArtHeader} />
        <Stack.Screen name="game/[id]" options={overArtHeader} />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
