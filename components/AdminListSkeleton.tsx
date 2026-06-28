// ═══════════════════════════════════════════════════════════════════════════
// components/AdminListSkeleton.tsx — shimmer placeholders for admin lists
// ═══════════════════════════════════════════════════════════════════════════
//
// Used by AdminUsersScreen / AdminCirclesScreen / AdminTripsScreen and the
// metric grid on AdminOverviewScreen during the initial fetch. A single
// shared Animated.Value drives every placeholder bar so the whole stack
// pulses in sync — cheap (one timer, N transforms) and looks deliberate.
//
// The component renders rows that match the production row shape: a
// chunky title bar with a smaller meta bar underneath, optional right-
// side chip. Sizing intentionally mirrors the real rows so the layout
// doesn't visibly jump when data lands.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";

interface AdminListSkeletonProps {
  rowCount?: number;
  showChip?: boolean;
}

export default function AdminListSkeleton({
  rowCount = 4,
  showChip = true,
}: AdminListSkeletonProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const rows = Array.from({ length: rowCount }, (_, i) => i);

  return (
    <View style={styles.container}>
      {rows.map((i) => (
        <View key={i} style={styles.row}>
          <View style={{ flex: 1, gap: 6 }}>
            <Animated.View style={[styles.barTitle, { opacity: pulse }]} />
            <Animated.View style={[styles.barMeta, { opacity: pulse }]} />
          </View>
          {showChip ? (
            <Animated.View style={[styles.chip, { opacity: pulse }]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const BAR_COLOR = "#E5E7EB";

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  barTitle: { height: 14, width: "60%", backgroundColor: BAR_COLOR, borderRadius: 4 },
  barMeta: { height: 10, width: "80%", backgroundColor: BAR_COLOR, borderRadius: 4 },
  chip: { width: 60, height: 18, backgroundColor: BAR_COLOR, borderRadius: 9 },
});
