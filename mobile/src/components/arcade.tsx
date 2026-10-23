import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, makeStyles, radius, space, type, useTheme } from '@/theme';

// The pieces that make the app look like pinball: the machines' own art and a DMD-style score panel.

/** Backglass art (decision 40), cached on disk so it shows offline. Falls back to a dark tile with a ball. */
export function MachineArt(props: { uri?: string | null; style?: StyleProp<ViewStyle>; size?: number }) {
  const s = useStyles();
  const size = props.size ?? 56;
  const box = [s.art, { width: size * 1.4, height: size }, props.style];
  if (!props.uri) {
    return (
      <View style={[box, s.artFallback]} accessibilityElementsHidden>
        <View style={[s.fallbackBall, { width: size * 0.42, height: size * 0.42, borderRadius: size }]} />
      </View>
    );
  }
  return (
    <View style={[box, s.artClip]}>
      <Image
        source={{ uri: props.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="disk"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/**
 * Full-bleed backglass header: the art fades into the screen background behind the title, and the
 * navigation bar floats over it (the screen sets headerTransparent).
 */
export function ArtHeader(props: { uri?: string | null; eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Tall enough to show a whole backglass (about 1.56:1) across the screen, and never shorter than the text needs.
  const artHeight = Math.max(240, width / BACKGLASS_ASPECT);
  return (
    <View style={[s.header, { paddingTop: insets.top + 56, minHeight: artHeight }]}>
      {props.uri ? (
        <Image
          source={{ uri: props.uri }}
          style={s.headerArt}
          contentFit="cover"
          // Backglass titles and key art sit near the top, so crop from the bottom if anything has to go.
          contentPosition="top"
          cachePolicy="disk"
          transition={200}
        />
      ) : (
        <View style={[s.headerArt, { backgroundColor: colors.surfaceAlt }]} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', colors.background]}
        locations={[0, 0.25, 0.55, 1]}
        style={s.headerArt}
      />
      <View style={s.headerText}>
        {props.eyebrow ? <Text style={s.headerEyebrow}>{props.eyebrow}</Text> : null}
        <Text style={s.headerTitle} numberOfLines={2}>
          {props.title}
        </Text>
        {props.subtitle ? <Text style={s.headerSubtitle}>{props.subtitle}</Text> : null}
        {props.children}
      </View>
    </View>
  );
}

/** Score entry styled as a dot-matrix display: orange dots on black, whatever the app theme. */
export const DmdScoreInput = forwardRef<ComponentRef<typeof TextInput>, TextInputProps & { caption: string; warn?: boolean }>(
  function DmdScoreInput({ caption, warn, style, ...input }, ref) {
    const s = useStyles();
    return (
      <View style={s.dmd}>
        <TextInput
          ref={ref}
          {...input}
          placeholderTextColor={DMD.dim}
          selectionColor={DMD.lit}
          style={[s.dmdText, style]}
        />
        <Text style={[s.dmdCaption, warn && { color: DMD.warn }]}>{caption}</Text>
      </View>
    );
  },
);

/** OPDB backglass images are roughly 640 x 409. */
const BACKGLASS_ASPECT = 1.56;

/** DMD colors stay fixed across themes: the panel imitates hardware, not the app chrome. */
const DMD = { panel: '#050505', lit: '#ff8a1f', dim: '#4a2208', glow: 'rgba(255,110,10,0.65)', warn: '#ff4d4d', caption: '#c46a1c' };

const useStyles = makeStyles((c) => ({
  art: { borderRadius: radius.sm, backgroundColor: c.surfaceAlt },
  artClip: { overflow: 'hidden' },
  artFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1b33' },
  fallbackBall: { backgroundColor: '#aeb5c0', borderWidth: 2, borderColor: '#5c6370' },
  header: { marginHorizontal: -space.lg, marginTop: -space.lg, paddingHorizontal: space.lg, paddingBottom: space.lg, justifyContent: 'flex-end' },
  headerArt: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerText: { gap: 2 },
  headerEyebrow: { ...type.label, color: '#ffffffcc', textShadowColor: '#000', textShadowRadius: 6 },
  headerTitle: { ...type.hero, color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 10 },
  headerSubtitle: { ...type.bodyStrong, color: '#ffffffdd', textShadowColor: '#000', textShadowRadius: 6 },
  dmd: {
    backgroundColor: DMD.panel,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#1d1209',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  dmdText: {
    fontFamily: fonts.dmd,
    fontSize: 44,
    color: DMD.lit,
    textShadowColor: DMD.glow,
    textShadowRadius: 12,
    textAlign: 'right',
    paddingVertical: 0,
    letterSpacing: 2,
  },
  dmdCaption: { fontFamily: fonts.headingSemi, fontSize: 14, letterSpacing: 1, color: DMD.caption, textAlign: 'right', textTransform: 'uppercase' },
}));
