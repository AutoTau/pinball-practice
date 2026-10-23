import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Linking, Text, View } from 'react-native';

import { Button, Card, SectionHeader, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { pendingChanges } from '@/sync/status';
import { makeStyles, space, type, useTheme } from '@/theme';

/** Account and sync. Sign-in arrives with Cognito (decision 39); until then everything stays on this phone. */
export default function ProfileScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  useFocusRefresh();
  const pending = pendingChanges(db);

  return (
    <Screen>
      <Card style={s.account}>
        <Ionicons name="person-circle" size={56} color={colors.textMuted} />
        <View style={s.accountText}>
          <Text style={s.accountTitle}>Not signed in</Text>
          <Text style={s.accountBody}>Your practice is saved on this phone. Sign in to back it up and use it on other devices.</Text>
        </View>
      </Card>
      <Button title="Sign in (coming soon)" onPress={() => undefined} disabled />

      <SectionHeader title="Sync" />
      <Card>
        <View style={s.syncRow}>
          <Ionicons name={pending ? 'cloud-upload-outline' : 'cloud-done-outline'} size={24} color={pending ? colors.accent : colors.success} />
          <Text style={s.syncText}>
            {pending === 0 ? 'Nothing waiting to sync.' : `${pending.toLocaleString()} ${pending === 1 ? 'change' : 'changes'} waiting to sync.`}
          </Text>
        </View>
      </Card>

      <SectionHeader title="About" />
      <Card style={s.about}>
        <Text style={s.aboutText}>Pinball Practice {Constants.expoConfig?.version ?? ''}</Text>
        <Text style={s.aboutMuted} onPress={() => Linking.openURL('https://opdb.org')} accessibilityRole="link">
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
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  syncText: { ...type.body, color: c.text, flex: 1 },
  about: { gap: space.xs },
  aboutText: { ...type.bodyStrong, color: c.text },
  aboutMuted: { ...type.caption, color: c.textMuted },
}));
