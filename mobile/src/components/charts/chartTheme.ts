import { matchFont } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Chart roles for the current scheme. Series and context colors are the validated dataviz palette's
 * slot 1 and de-emphasis gray, stepped separately for light and dark (see src/theme/tokens.ts).
 */
export function useChartColors() {
  const { colors } = useTheme();
  return {
    accent: colors.chartSeries,
    context: colors.chartContext,
    grid: colors.chartGrid,
    label: colors.textSecondary,
  };
}

/** The platform's sans-serif, so charts need no bundled font file. */
export const axisFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 11,
});
