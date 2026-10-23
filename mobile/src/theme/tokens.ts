// Design tokens. Screens use roles ("surface", "textSecondary"), never raw hex, so light and dark
// swap in one place. Dark is its own set of steps, not an inverted light theme.

export interface Palette {
  /** Screen background behind cards. */
  background: string;
  /** Cards, list rows, inputs. */
  surface: string;
  /** Pressed rows, input wells, segmented tracks. */
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** Actions: buttons, links, selected states. Flipper orange. */
  primary: string;
  onPrimary: string;
  /** Pressed/tinted background for primary-outlined controls. */
  primaryTint: string;
  /** Live states: "in progress", the extra-ball toggle. Electric cyan, distinct from orange actions. */
  accent: string;
  onAccent: string;
  danger: string;
  success: string;
  /** Data colors, from the validated dataviz palette (slot 1 and its context gray). */
  chartSeries: string;
  chartContext: string;
  chartGrid: string;
}

export const light: Palette = {
  background: '#f4f3f0',
  surface: '#ffffff',
  surfaceAlt: '#ebeae6',
  border: '#dedcd6',
  text: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#6b6963',
  primary: '#c2410c',
  onPrimary: '#ffffff',
  primaryTint: '#fdeadf',
  accent: '#0e7490',
  onAccent: '#ffffff',
  danger: '#b42318',
  success: '#1a7f4b',
  chartSeries: '#2a78d6',
  chartContext: '#b4b2ab',
  chartGrid: '#e7e6e2',
};

export const dark: Palette = {
  background: '#08090c',
  surface: '#12141a',
  surfaceAlt: '#1b1e26',
  border: '#262a34',
  text: '#f2f3f5',
  textSecondary: '#b9bec8',
  textMuted: '#8a909c',
  primary: '#ff7a2f',
  onPrimary: '#0b0b0b',
  primaryTint: '#2a160b',
  accent: '#22d3ee',
  onAccent: '#062a31',
  danger: '#f07272',
  success: '#4cc38a',
  chartSeries: '#3987e5',
  chartContext: '#555a64',
  chartGrid: '#23262e',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Custom faces, loaded in the root layout. Weight lives in the family name, so never pair them with fontWeight. */
export const fonts = {
  /** Condensed scoreboard face for titles and headings. */
  heading: 'BarlowCondensed_700Bold',
  headingSemi: 'BarlowCondensed_600SemiBold',
  /** Dot-matrix face for the score panel, after a pinball DMD. */
  dmd: 'Doto_900Black',
} as const;

/** Type scale. Scores use tabular figures so digits line up as they change. */
export const type = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  hero: { fontFamily: fonts.heading, fontSize: 34, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { fontFamily: fonts.heading, fontSize: 28, letterSpacing: 0.3, textTransform: 'uppercase' },
  heading: { fontFamily: fonts.heading, fontSize: 20, letterSpacing: 0.3 },
  body: { fontSize: 16, fontWeight: '400' },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontFamily: fonts.headingSemi, fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
} as const;

/** Minimum tap target, larger than the platform 44pt: players tap between balls, in a hurry. */
export const TAP_TARGET = 56;
