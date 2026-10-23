import { useMemo } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { dark, fonts, light, radius, space, type, type Palette, TAP_TARGET } from './tokens';

export { fonts, radius, space, TAP_TARGET, type };
export { headerOptions, overArtHeader } from './navigation';
export type { Palette };

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
}

/** The current theme, following the phone's light/dark setting. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useMemo(() => ({ scheme, colors: scheme === 'dark' ? dark : light }), [scheme]);
}

type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Defines a component's styles against the theme; the hook rebuilds them only when the scheme changes.
 * Typed like StyleSheet.create, so literal values such as flexDirection: 'row' keep their types.
 *
 *   const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.surface } }));
 */
export function makeStyles<S extends Styles>(factory: (colors: Palette) => S & Styles) {
  const cache = new Map<Palette, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors)) as Readonly<S>;
      cache.set(colors, styles);
    }
    return styles;
  };
}
