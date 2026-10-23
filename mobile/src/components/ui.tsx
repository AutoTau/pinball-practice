import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { makeStyles, radius, space, TAP_TARGET, type, useTheme } from '@/theme';

// Shared building blocks. Screens compose these instead of styling raw views, so the look stays
// consistent and follows light/dark mode.

export function Screen(props: ScrollViewProps & { children: ReactNode; scroll?: boolean }) {
  const s = useStyles();
  const { scroll = true, children, contentContainerStyle, ...rest } = props;
  if (!scroll) return <View style={s.screen}>{children}</View>;
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.screenContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}>
      {children}
    </ScrollView>
  );
}

export function Card(props: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const s = useStyles();
  return <View style={[s.card, props.padded !== false && s.cardPadded, props.style]}>{props.children}</View>;
}

export function SectionHeader(props: { title: string; right?: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.sectionRow}>
      <Text style={s.section} accessibilityRole="header">
        {props.title}
      </Text>
      {props.right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const variant = props.variant ?? 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        s.button,
        variant === 'primary' && s.buttonPrimary,
        variant === 'secondary' && s.buttonSecondary,
        variant === 'danger' && s.buttonDanger,
        pressed && s.pressed,
        props.disabled && s.disabled,
        props.style,
      ]}>
      <Text
        style={[
          s.buttonText,
          variant === 'primary' && s.buttonTextPrimary,
          variant === 'secondary' && s.buttonTextSecondary,
          variant === 'danger' && s.buttonTextDanger,
        ]}>
        {props.title}
      </Text>
    </Pressable>
  );
}

export function ListRow(props: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  right?: ReactNode;
  /** Leading visual, e.g. machine art. */
  left?: ReactNode;
  first?: boolean;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={props.onPress ? 'button' : undefined}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => [s.row, !props.first && s.rowDivider, pressed && props.onPress && s.rowPressed]}>
      {props.left}
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text style={s.rowSubtitle} numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {props.right}
      {props.onPress ? <Text style={[s.chevron, { color: colors.textMuted }]}>›</Text> : null}
    </Pressable>
  );
}

export function Pill(props: { label: string; tone?: 'accent' | 'neutral' }) {
  const s = useStyles();
  return (
    <View style={[s.pill, props.tone === 'accent' ? s.pillAccent : s.pillNeutral]}>
      <Text style={[s.pillText, props.tone === 'accent' ? s.pillTextAccent : s.pillTextNeutral]}>{props.label}</Text>
    </View>
  );
}

export function Field(props: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <View style={[s.field, props.style]}>
      <Text style={s.fieldLabel}>{props.label}</Text>
      {props.children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const s = useStyles();
  const { colors } = useTheme();
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[s.input, props.style]} />;
}

export function EmptyState(props: { title: string; message?: string; children?: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{props.title}</Text>
      {props.message ? <Text style={s.emptyMessage}>{props.message}</Text> : null}
      {props.children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  screenContent: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  cardPadded: { padding: space.lg },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  section: { ...type.label, color: c.textMuted },
  button: {
    minHeight: TAP_TARGET,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: c.primary },
  buttonSecondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  buttonDanger: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.danger },
  buttonText: { ...type.bodyStrong },
  buttonTextPrimary: { color: c.onPrimary },
  buttonTextSecondary: { color: c.text },
  buttonTextDanger: { color: c.danger },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: TAP_TARGET + 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: c.surface,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
  rowPressed: { backgroundColor: c.surfaceAlt },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.bodyStrong, color: c.text },
  rowSubtitle: { ...type.caption, color: c.textSecondary },
  chevron: { fontSize: 24, marginTop: -2 },
  pill: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  pillAccent: { backgroundColor: c.accent },
  pillNeutral: { backgroundColor: c.surfaceAlt },
  pillText: { fontSize: 12, fontWeight: '700' },
  pillTextAccent: { color: c.onAccent },
  pillTextNeutral: { color: c.textSecondary },
  field: { gap: space.xs + 2 },
  fieldLabel: { ...type.label, color: c.textMuted },
  input: {
    minHeight: TAP_TARGET - 8,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    ...type.body,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyTitle: { ...type.heading, color: c.text, textAlign: 'center' },
  emptyMessage: { ...type.body, color: c.textSecondary, textAlign: 'center' },
}));
