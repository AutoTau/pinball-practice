import { Line as SkiaLine, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAnimatedReaction, useDerivedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CartesianChart, Line, Scatter, useChartPressState } from 'victory-native';

import type { MachineStats } from '@/data/stats';
import { formatScore, shortScore } from '@/domain/score';

import { axisFont, useChartColors } from './chartTheme';

/**
 * Every finished game as a gray dot, with the rolling median as the one accented line (emphasis form:
 * the trend is the point, single games are context). Press and hold to read a game.
 */
export function ScoreTrendChart(props: { trend: MachineStats['trend']; window: number }) {
  const { trend } = props;
  const chartColors = useChartColors();
  const { state, isActive } = useChartPressState({ x: 0, y: { score: 0, rollingMedian: 0 } });
  const [selected, setSelected] = useState<number | null>(null);

  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (index, previous) => {
      if (index !== previous) scheduleOnRN(setSelected, index >= 0 ? index : null);
    },
  );

  const cursorX = useDerivedValue(() => state.x.position.value);
  const top = useDerivedValue(() => vec(cursorX.value, 0));
  const bottom = useDerivedValue(() => vec(cursorX.value, 1000));

  const game = selected !== null ? trend[selected] : undefined;

  return (
    <View>
      <Text style={[styles.readout, { color: chartColors.label }]} accessibilityLiveRegion="polite">
        {game
          ? `Game ${game.index} · ${formatScore(game.score)} · median ${formatScore(Math.round(game.rollingMedian))}`
          : `Rolling median of the last ${props.window} games. Hold to inspect a game.`}
      </Text>
      <View style={styles.chart}>
        <CartesianChart
          data={trend}
          xKey="index"
          yKeys={['score', 'rollingMedian']}
          domainPadding={{ left: 12, right: 12, top: 12 }}
          chartPressState={state}
          xAxis={{
            font: axisFont,
            labelColor: chartColors.label,
            lineColor: chartColors.grid,
            tickCount: Math.min(trend.length, 6),
            formatXLabel: (v) => String(Math.round(v)),
          }}
          yAxis={[
            {
              font: axisFont,
              labelColor: chartColors.label,
              lineColor: chartColors.grid,
              tickCount: 4,
              formatYLabel: (v) => shortScore(Math.round(v)),
            },
          ]}>
          {({ points }) => (
            <>
              {isActive ? <SkiaLine p1={top} p2={bottom} color={chartColors.grid} strokeWidth={1} /> : null}
              <Scatter points={points.score} radius={4} color={chartColors.context} />
              <Line points={points.rollingMedian} color={chartColors.accent} strokeWidth={2} curveType="monotoneX" />
            </>
          )}
        </CartesianChart>
      </View>
      <View style={styles.legend} accessibilityElementsHidden>
        <View style={[styles.swatchDot, { backgroundColor: chartColors.context }]} />
        <Text style={[styles.legendText, { color: chartColors.label }]}>Game</Text>
        <View style={[styles.swatchLine, { backgroundColor: chartColors.accent }]} />
        <Text style={[styles.legendText, { color: chartColors.label }]}>Rolling median</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { fontSize: 13, minHeight: 18, marginBottom: 6, fontVariant: ['tabular-nums'] },
  chart: { height: 200 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  swatchDot: { width: 8, height: 8, borderRadius: 4 },
  swatchLine: { width: 16, height: 2, marginLeft: 10 },
  legendText: { fontSize: 12 },
});
