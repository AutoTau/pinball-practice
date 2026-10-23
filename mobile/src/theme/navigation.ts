import { fonts, type } from './tokens';
import type { Palette } from './tokens';

/**
 * Header styling shared by the root stack and the tab navigator, so every screen's header looks the
 * same. Screens with a backglass header override it with a transparent one.
 */
export function headerOptions(colors: Palette) {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text, fontFamily: fonts.heading, fontSize: type.heading.fontSize },
    headerLargeTitleStyle: { color: colors.text, fontFamily: fonts.heading },
    headerShadowVisible: false,
  } as const;
}

/**
 * For screens whose backglass art fills the top: the header floats over it with white controls. The
 * background must be cleared explicitly, or the shared headerStyle paints a solid bar over the art.
 */
export const overArtHeader = {
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  title: '',
  headerTintColor: '#ffffff',
} as const;
