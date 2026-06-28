// ═══════════════════════════════════════════════════════════════════════════
// components/charts/BarChart.tsx — hand-rolled SVG bar chart
// ═══════════════════════════════════════════════════════════════════════════
//
// Used by DAU, circles created, transaction volume, trip revenue. Renders
// teal bars with rounded tops. Same axis treatment as LineChart (3
// labels: first / middle / last).
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import { colors, typography } from "../../theme/tokens";

const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

export interface BarPoint {
  label: string;
  value: number;
}

interface Props {
  points: BarPoint[];
  height?: number;
  summaryLabel?: string;
  summaryValue?: string;
}

export default function BarChart({
  points,
  height = 140,
  summaryLabel,
  summaryValue,
}: Props) {
  if (!points.length) return null;

  const padX = 18;
  const padTop = 14;
  const padBottom = 24;
  const w = 320;
  const h = height;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;

  const max = Math.max(0, ...points.map((p) => p.value));
  const effectiveMax = max > 0 ? max : 1;

  const gap = 3;
  const barW = Math.max(
    2,
    (innerW - gap * (points.length - 1)) / Math.max(points.length, 1),
  );

  const axisIndices = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const seen = new Set<number>();
  const axisLabels = axisIndices.filter((i) => {
    if (seen.has(i)) return false;
    seen.add(i);
    return true;
  });

  return (
    <View style={styles.wrap}>
      {summaryValue ? (
        <Text style={styles.latest}>{summaryValue}</Text>
      ) : null}
      {summaryLabel ? <Text style={styles.summaryLabel}>{summaryLabel}</Text> : null}
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {points.map((p, i) => {
          const x = padX + i * (barW + gap);
          const barH = (p.value / effectiveMax) * innerH;
          const y = padTop + innerH - barH;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(barH, 0)}
              fill={TEAL}
              opacity={0.85}
              rx={2}
              ry={2}
            />
          );
        })}
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
            x={padX + i * (barW + gap) + barW / 2}
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
  summaryLabel: { fontSize: 11, color: MUTED, fontWeight: typography.medium },
});
