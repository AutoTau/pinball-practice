import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';

import { useAuth, type SignInMethod } from '@/auth/AuthProvider';
import { Button, Card, SectionHeader, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { pendingChanges } from '@/sync/status';
import { useSync } from '@/sync/SyncProvider';
import { makeStyles, space, type, useTheme } from '@/theme';

/** Account and sync (decision 39). Signed out, everything still works and stays on this phone. */
export default function ProfileScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const auth = useAuth();
  const sync = useSync();
  const [busy, setBusy] = useState(false);
  useFocusRefresh();
  const pending = pendingChanges(db);

  async function signIn(method: SignInMethod) {
    setBusy(true);
    try {
      await auth.signIn(method);
    } catch (e) {
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmSignOut() {
    const warning =
      pending > 0
        ? `${pending} ${pending === 1 ? 'change hasn’t' : 'changes haven’t'} synced yet. They stay on this phone and sync when you sign in again.`
        : 'Your practice stays on this phone.';
    Alert.alert('Sign out?', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void auth.signOut() },
    ]);
  }

  const signedIn = auth.session !== null;

  return (
    <Screen>
      <Card style={s.account}>
        <Ionicons name="person-circle" size={56} color={signedIn ? colors.primary : colors.textMuted} />
        <View style={s.accountText}>
          <Text style={s.accountTitle} numberOfLines={1}>
            {signedIn ? (auth.session?.email ?? 'Signed in') : 'Not signed in'}
          </Text>
          <Text style={s.accountBody}>
            {signedIn
              ? 'Your practice is backed up and syncs across your devices.'
              : 'Your practice is saved on this phone. Sign in to back it up and use it on other devices.'}
          </Text>
        </View>
      </Card>

      {!auth.configured ? (
        <Text style={s.muted}>Sign-in isn’t configured in this build.</Text>
      ) : signedIn ? null : (
        <View style={s.buttons}>
          <Button title="Continue with Google" onPress={() => void signIn('google')} disabled={busy || !auth.ready} />
          <Button title="Continue with email" variant="secondary" onPress={() => void signIn('email')} disabled={busy || !auth.ready} />
        </View>
      )}

      <SectionHeader title="Sync" />
      <Card style={s.syncCard}>
        <View style={s.syncRow}>
          <Ionicons
            name={sync.status === 'error' ? 'cloud-offline-outline' : pending ? 'cloud-upload-outline' : 'cloud-done-outline'}
            size={24}
            color={sync.status === 'error' ? colors.danger : pending ? colors.accent : colors.success}
          />
          <View style={s.syncText}>
            <Text style={s.syncTitle}>
              {sync.status === 'syncing'
                ? 'Syncing…'
                : pending === 0
                  ? 'Everything is synced.'
                  : `${pending.toLocaleString()} ${pending === 1 ? 'change' : 'changes'} waiting to sync.`}
            </Text>
            <Text style={s.muted}>
              {!signedIn
                ? 'Sign in to sync.'
                : sync.status === 'error'
                  ? `Last attempt failed: ${sync.error}`
                  : sync.lastSyncedAt
                    ? `Last synced ${sync.lastSyncedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                    : 'Not synced yet on this launch.'}
            </Text>
            {sync.lastSummary && sync.lastSummary.rejected.length > 0 ? (
              <Text style={[s.muted, { color: colors.danger }]}>
                {sync.lastSummary.rejected.length} {sync.lastSummary.rejected.length === 1 ? 'change was' : 'changes were'} refused by the server:{' '}
                {sync.lastSummary.rejected[0].reason}
              </Text>
            ) : null}
          </View>
        </View>
        {signedIn ? (
          <Button title="Sync now" variant="secondary" onPress={sync.requestSync} disabled={sync.status === 'syncing'} />
        ) : null}
      </Card>

      {signedIn ? <Button title="Sign out" variant="danger" onPress={confirmSignOut} /> : null}

      <SectionHeader title="About" />
      <Card style={s.about}>
        <Text style={s.aboutText}>Pinball Practice {Constants.expoConfig?.version ?? ''}</Text>
        <Text style={s.muted} onPress={() => Linking.openURL('https://opdb.org')} accessibilityRole="link">
          Machine data and images from the Open Pinball Database (opdb.org)
        </Text>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accountText: { flex: 1, gap: 2 },
  accountTitle: { ...type.heading, color: c.text },
  accountBody: { ...type.caption, color: c.textSecondary },
  buttons: { gap: space.sm },
  syncCard: { gap: space.md },
  syncRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  syncText: { flex: 1, gap: 2 },
  syncTitle: { ...type.body, color: c.text },
  muted: { ...type.caption, color: c.textMuted },
  about: { gap: space.xs },
  aboutText: { ...type.bodyStrong, color: c.text },
}));
