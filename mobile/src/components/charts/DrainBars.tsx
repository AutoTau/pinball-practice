import { StyleSheet, Text, View } from 'react-native';

import type { MachineStats } from '@/data/stats';
import { DRAIN_REASONS } from '@/domain/drainReasons';

import { useChartColors } from './chartTheme';

const LABELS: Record<string, string> = {
  ...Object.fromEntries(DRAIN_REASONS.map((r) => [r.code, r.label])),
  tilt: 'Tilt',
  unknown: 'Not recorded',
};

/**
 * How balls end, most common first. Plain views rather than a canvas: each row carries its own text
 * label and percentage, so it reads without color and works with screen readers.
 */
export function DrainBars(props: { drains: MachineStats['drains'] }) {
  const c = useChartColors();
  const top = props.drains[0]?.share ?? 1;
  return (
    <View>
      {props.drains.map((d) => {
        const label = LABELS[d.key] ?? d.key;
        const percent = Math.round(d.share * 100);
        return (
          <View key={d.key} style={styles.row} accessible accessibilityLabel={`${label}: ${percent}%, ${d.count} balls`}>
            <Text style={[styles.label, { color: c.label }]} numberOfLines={1}>
              {label}
            </Text>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${(d.share / top) * 100}%`, backgroundColor: c.accent }]} />
            </View>
            <Text style={[styles.value, { color: c.label }]}>{percent}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  label: { width: 108, fontSize: 13 },
  track: { flex: 1, height: 14 },
  bar: { height: 14, borderTopRightRadius: 4, borderBottomRightRadius: 4, minWidth: 2 },
  value: { width: 40, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
});
