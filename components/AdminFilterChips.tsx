// ═══════════════════════════════════════════════════════════════════════════
// components/AdminFilterChips.tsx — horizontal chip row for one filter axis
// ═══════════════════════════════════════════════════════════════════════════
//
// Used by AdminUsers / AdminCircles / AdminTrips. Each screen renders one
// row per filter axis (status, kyc, role, community, date range). The
// "All" chip is always present and selected when `value === null`.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { colors, typography, spacing } from "../theme/tokens";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  allLabel: string;
  options: FilterOption[];
  value: string | null;
  onChange: (next: string | null) => void;
}

export default function AdminFilterChips({
  label,
  allLabel,
  options,
  value,
  onChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Chip
          label={allLabel}
          active={value === null}
          onPress={() => onChange(null)}
        />
        {options.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            active={value === opt.value}
            onPress={() => onChange(value === opt.value ? null : opt.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  chipText: { fontSize: 12, color: NAVY, fontWeight: typography.medium },
  chipTextActive: { color: "#FFFFFF", fontWeight: typography.bold },
});
