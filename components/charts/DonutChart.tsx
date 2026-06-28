// ═══════════════════════════════════════════════════════════════════════════
// components/charts/DonutChart.tsx — categorical breakdown
// ═══════════════════════════════════════════════════════════════════════════
//
// Used for active-vs-total circles + dispute status. Renders a donut
// (ring) with proportional arcs + a centre label (total or %) + a
// legend on the right.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { G, Path, Circle, Text as SvgText } from "react-native-svg";
import { colors, typography } from "../../theme/tokens";

const NAVY = colors.primaryNavy;
const MUTED = "#6B7280";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  if (endAngle - startAngle >= 360) {
    return "";
  }
  const start = polarToCartesian(cx, cy, rOuter, endAngle);
  const end = polarToCartesian(cx, cy, rOuter, startAngle);
  const start2 = polarToCartesian(cx, cy, rInner, startAngle);
  const end2 = polarToCartesian(cx, cy, rInner, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${start.x} ${start.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    `L ${start2.x} ${start2.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${end2.x} ${end2.y}`,
    "Z",
  ].join(" ");
}

export default function DonutChart({
  slices,
  centerLabel,
  centerValue,
  size = 140,
}: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter * 0.62;

  let cursor = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * 360;
      const arc = (
        <Path
          key={s.key}
          d={arcPath(cx, cy, rOuter, rInner, cursor, cursor + sweep)}
          fill={s.color}
        />
      );
      cursor += sweep;
      return arc;
    });

  return (
    <View style={styles.row}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>{arcs}</G>
        <Circle cx={cx} cy={cy} r={rInner - 0.5} fill={colors.cardBg} />
        {centerValue ? (
          <SvgText
            x={cx}
            y={cy - 2}
            fontSize={18}
            fontWeight="bold"
            fill={NAVY}
            textAnchor="middle"
          >
            {centerValue}
          </SvgText>
        ) : null}
        {centerLabel ? (
          <SvgText
            x={cx}
            y={cy + 14}
            fontSize={9}
            fill={MUTED}
            textAnchor="middle"
          >
            {centerLabel}
          </SvgText>
        ) : null}
      </Svg>
      <View style={styles.legend}>
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <View key={s.key} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.legendValue}>
                {s.value} · {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: {
    flex: 1,
    fontSize: typography.label,
    color: NAVY,
    fontWeight: typography.medium,
  },
  legendValue: { fontSize: 11, color: MUTED, fontWeight: typography.bold },
});
