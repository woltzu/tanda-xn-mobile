// ═══════════════════════════════════════════════════════════════════════════
// components/charts/FunnelChart.tsx — horizontal funnel bars
// ═══════════════════════════════════════════════════════════════════════════
//
// Used for the KYC verification funnel. Bars shrink left-to-right by
// stage; each row shows label + count + conversion % vs the previous
// stage.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography } from "../../theme/tokens";

const NAVY = colors.primaryNavy;
const MUTED = "#6B7280";
const TEAL = colors.accentTeal;

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
}

interface Props {
  stages: FunnelStage[];
}

export default function FunnelChart({ stages }: Props) {
  if (!stages.length) return null;
  const top = stages[0]?.value ?? 0;
  const max = Math.max(1, top);

  return (
    <View style={styles.wrap}>
      {stages.map((s, i) => {
        const pctOfTop = Math.round((s.value / max) * 100);
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv =
          prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <View key={s.key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.count}>
                {s.value.toLocaleString()}
                {conv !== null ? `  ·  ${conv}%` : ""}
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[styles.barFill, { width: `${Math.max(pctOfTop, 4)}%` }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 10, paddingHorizontal: 4 },
  row: { gap: 4 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: typography.label,
    color: NAVY,
    fontWeight: typography.bold,
    flex: 1,
  },
  count: { fontSize: 11, color: MUTED, fontWeight: typography.medium },
  barBg: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: TEAL, borderRadius: 6 },
});
