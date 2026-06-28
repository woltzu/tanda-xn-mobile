// ═══════════════════════════════════════════════════════════════════════════
// components/charts/LineChart.tsx — hand-rolled SVG line chart
// ═══════════════════════════════════════════════════════════════════════════
//
// Used by user-growth (cumulative) and platform-fee-revenue. Renders a
// teal polyline + a faint fill under it + dot markers + 3 baseline
// labels (start / middle / end). Designed for 6–30 data points; no
// gestures, no tooltips — admin-tier glance UI.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Polyline,
  Polygon,
  Circle,
  Line,
  Text as SvgText,
} from "react-native-svg";
import { colors, typography } from "../../theme/tokens";

const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

export interface LinePoint {
  label: string;
  value: number;
}

interface Props {
  points: LinePoint[];
  height?: number;
  formatValue?: (v: number) => string;
  yAxisMax?: number;
}

export default function LineChart({
  points,
  height = 140,
  formatValue,
  yAxisMax,
}: Props) {
  if (!points.length) return null;

  const padX = 18;
  const padTop = 14;
  const padBottom = 24;
  const w = 320;
  const h = height;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;

  const max = Math.max(yAxisMax ?? 0, ...points.map((p) => p.value));
  const effectiveMax = max > 0 ? max : 1;
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padX + i * xStep;
    const y = padTop + innerH - (p.value / effectiveMax) * innerH;
    return { x, y };
  });

  const polylinePts = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const polygonPts = `${padX},${padTop + innerH} ${polylinePts} ${
    padX + innerW
  },${padTop + innerH}`;

  // Three x-axis labels: first, middle, last — avoids overlap on dense series.
  const axisIndices = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const seen = new Set<number>();
  const axisLabels = axisIndices.filter((i) => {
    if (seen.has(i)) return false;
    seen.add(i);
    return true;
  });

  const latestValue = points[points.length - 1].value;
  const formatted = formatValue
    ? formatValue(latestValue)
    : latestValue.toLocaleString();

  return (
    <View style={styles.wrap}>
      <Text style={styles.latest}>{formatted}</Text>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Polygon points={polygonPts} fill={TEAL} opacity={0.12} />
        <Polyline
          points={polylinePts}
          fill="none"
          stroke={TEAL}
          strokeWidth={2}
        />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={2.5} fill={TEAL} />
        ))}
        <Line
          x1={padX}
          y1={padTop + innerH}
          x2={padX + innerW}
          y2={padTop + innerH}
          stroke="#E5E7EB"
          strokeWidth={1}
        />
        {axisLabels.map((i) => (
          <SvgText
            key={i}
            x={coords[i].x}
            y={h - 6}
            fontSize={9}
            fill={MUTED}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          >
            {points[i].label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  latest: {
    fontSize: typography.userName,
    color: colors.primaryNavy,
    fontWeight: typography.bold,
  },
});
