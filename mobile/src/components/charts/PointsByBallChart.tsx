import { StyleSheet, Text, View } from 'react-native';
import { Bar, CartesianChart } from 'victory-native';

import type { MachineStats } from '@/data/stats';
import { shortScore } from '@/domain/score';

import { axisFont, useChartColors } from './chartTheme';

/** Median points scored on each ball: one series, so one hue and no legend; values are labeled below. */
export function PointsByBallChart(props: { perBall: MachineStats['perBall'] }) {
  const c = useChartColors();
  const data = props.perBall.map((b) => ({ ball: b.ballNumber, median: b.median }));

  return (
    <View>
      <View style={styles.chart}>
        <CartesianChart
          data={data}
          xKey="ball"
          yKeys={['median']}
          domain={{ y: [0] }}
          domainPadding={{ left: 40, right: 40, top: 12 }}
          xAxis={{
            font: axisFont,
            labelColor: c.label,
            lineColor: c.grid,
            tickValues: data.map((d) => d.ball),
            formatXLabel: (v) => `Ball ${v}`,
          }}
          yAxis={[{ font: axisFont, labelColor: c.label, lineColor: c.grid, tickCount: 4, formatYLabel: (v) => shortScore(Math.round(v)) }]}>
          {({ points, chartBounds }) => (
            <Bar
              points={points.median}
              chartBounds={chartBounds}
              color={c.accent}
              innerPadding={0.45}
              roundedCorners={{ topLeft: 4, topRight: 4 }}
            />
          )}
        </CartesianChart>
      </View>
      <View style={styles.values}>
        {props.perBall.map((b) => (
          <Text key={b.ballNumber} style={[styles.value, { color: c.label }]}>
            Ball {b.ballNumber}: {shortScore(Math.round(b.median))}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: 170 },
  values: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 },
  value: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
