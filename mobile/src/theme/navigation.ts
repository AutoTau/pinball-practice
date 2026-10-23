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

/** For screens whose backglass art fills the top: the header floats over it with white controls. */
export const overArtHeader = { headerTransparent: true, title: '', headerTintColor: '#ffffff' } as const;
