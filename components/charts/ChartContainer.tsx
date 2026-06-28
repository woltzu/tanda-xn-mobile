// ═══════════════════════════════════════════════════════════════════════════
// components/charts/ChartContainer.tsx — admin chart card shell
// ═══════════════════════════════════════════════════════════════════════════
//
// Common card chrome for the 9 charts on AdminOverviewScreen: title +
// optional subtitle, loading/error/empty states, fixed inner height so
// the grid doesn't reflow as data arrives.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { colors, radius, typography, spacing } from "../../theme/tokens";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface Props {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  height?: number;
  children?: React.ReactNode;
}

export default function ChartContainer({
  title,
  subtitle,
  loading,
  error,
  empty,
  emptyLabel,
  onRetry,
  height = 180,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.body, { height }]}>
        {loading ? (
          <ActivityIndicator size="small" color={TEAL} />
        ) : error ? (
          <View style={styles.stateBlock}>
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            {onRetry ? (
              <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : empty ? (
          <Text style={styles.emptyText}>{emptyLabel ?? "No data"}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 10,
  },
  header: { gap: 2 },
  title: {
    fontSize: typography.label,
    color: NAVY,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  subtitle: { fontSize: 11, color: MUTED, fontWeight: typography.medium },
  body: { alignItems: "center", justifyContent: "center" },
  stateBlock: { alignItems: "center", gap: 8, paddingHorizontal: 16 },
  errorText: {
    fontSize: typography.label,
    color: "#991B1B",
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  retryText: { fontSize: 11, color: "#991B1B", fontWeight: typography.bold },
  emptyText: { fontSize: typography.label, color: MUTED },
});
