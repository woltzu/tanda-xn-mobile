import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GuaranteeStatus, TrustTier } from "../context/TrustContext";

type MemberTrustBadgeProps = {
  name: string;
  score: number;
  trustTier: TrustTier;
  guaranteeStatus: GuaranteeStatus;
  vouchedByName?: string;
  onTimeRate: number;
  circlesCompleted: number;
  onPress?: () => void;
  compact?: boolean;
};

const getTierInfo = (tier: TrustTier) => {
  switch (tier) {
    case "restricted":
      return { label: "New", color: "#DC2626", icon: "alert-circle" };
    case "building":
      return { label: "Building", color: "#F59E0B", icon: "trending-up" };
    case "standard":
      return { label: "Standard", color: "#EAB308", icon: "star-half-outline" };
    case "trusted":
      return { label: "Trusted", color: "#22C55E", icon: "star" };
    case "preferred":
      return { label: "Preferred", color: "#3B82F6", icon: "star" };
    case "elder":
      return { label: "Elder", color: "#8B5CF6", icon: "diamond" };
    default:
      return { label: "Unknown", color: "#6B7280", icon: "help-circle" };
  }
};

const getGuaranteeInfo = (status: GuaranteeStatus) => {
  switch (status) {
    case "guaranteed":
      return { label: "Guaranteed", color: "#059669", icon: "shield-checkmark", bg: "#D1FAE5" };
    case "unguaranteed":
      return { label: "No Deposit", color: "#F59E0B", icon: "warning", bg: "#FEF3C7" };
    case "vouched":
      return { label: "Vouched", color: "#6366F1", icon: "people", bg: "#EEF2FF" };
    default:
      return { label: "Unknown", color: "#6B7280", icon: "help-circle", bg: "#F5F7FA" };
  }
};

export default function MemberTrustBadge({
  name,
  score,
  trustTier,
  guaranteeStatus,
  vouchedByName,
  onTimeRate,
  circlesCompleted,
  onPress,
  compact = false,
}: MemberTrustBadgeProps) {
  const tierInfo = getTierInfo(trustTier);
  const guaranteeInfo = getGuaranteeInfo(guaranteeStatus);

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        disabled={!onPress}
      >
        {/* Avatar */}
        <View style={[styles.compactAvatar, { backgroundColor: tierInfo.color + "20" }]}>
          <Text style={[styles.compactAvatarText, { color: tierInfo.color }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Name & Score */}
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>{name}</Text>
          <View style={styles.compactScoreRow}>
            <Ionicons name={tierInfo.icon as any} size={12} color={tierInfo.color} />
            <Text style={[styles.compactScore, { color: tierInfo.color }]}>{score}</Text>
          </View>
        </View>

        {/* Guarantee Badge */}
        <View style={[styles.compactGuarantee, { backgroundColor: guaranteeInfo.bg }]}>
          <Ionicons name={guaranteeInfo.icon as any} size={14} color={guaranteeInfo.color} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Left: Avatar & Basic Info */}
      <View style={styles.leftSection}>
        <View style={[styles.avatar, { backgroundColor: tierInfo.color + "20" }]}>
          <Text style={[styles.avatarText, { color: tierInfo.color }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
          {/* Trust tier indicator */}
          <View style={[styles.tierIndicator, { backgroundColor: tierInfo.color }]}>
            <Ionicons name={tierInfo.icon as any} size={10} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>XnScore™</Text>
            <Text style={[styles.scoreValue, { color: tierInfo.color }]}>{score}</Text>
            <View style={[styles.tierBadge, { backgroundColor: tierInfo.color + "20" }]}>
              <Text style={[styles.tierText, { color: tierInfo.color }]}>{tierInfo.label}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Right: Guarantee & Stats */}
      <View style={styles.rightSection}>
        {/* Guarantee Status */}
        <View style={[styles.guaranteeBadge, { backgroundColor: guaranteeInfo.bg }]}>
          <Ionicons name={guaranteeInfo.icon as any} size={16} color={guaranteeInfo.color} />
          <Text style={[styles.guaranteeText, { color: guaranteeInfo.color }]}>
            {guaranteeInfo.label}
          </Text>
        </View>

        {/* Vouched by info */}
        {guaranteeStatus === "vouched" && vouchedByName && (
          <Text style={styles.vouchedBy}>by {vouchedByName}</Text>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{onTimeRate}%</Text>
            <Text style={styles.statLabel}>On-time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{circlesCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Smaller inline badge for lists
export function MemberGuaranteeBadge({
  guaranteeStatus,
  vouchedByName,
  size = "small",
}: {
  guaranteeStatus: GuaranteeStatus;
  vouchedByName?: string;
  size?: "small" | "medium";
}) {
  const info = getGuaranteeInfo(guaranteeStatus);
  const iconSize = size === "small" ? 12 : 16;
  const fontSize = size === "small" ? 10 : 12;

  return (
    <View style={[styles.inlineBadge, { backgroundColor: info.bg }]}>
      <Ionicons name={info.icon as any} size={iconSize} color={info.color} />
      <Text style={[styles.inlineBadgeText, { color: info.color, fontSize }]}>
        {guaranteeStatus === "vouched" && vouchedByName
          ? `Vouched by ${vouchedByName}`
          : info.label}
      </Text>
    </View>
  );
}

// Trust tier badge only
export function TrustTierBadge({ tier, score }: { tier: TrustTier; score: number }) {
  const info = getTierInfo(tier);

  return (
    <View style={[styles.tierOnlyBadge, { backgroundColor: info.color + "20" }]}>
      <Ionicons name={info.icon as any} size={14} color={info.color} />
      <Text style={[styles.tierOnlyScore, { color: info.color }]}>{score}</Text>
      <Text style={[styles.tierOnlyLabel, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    position: "relative",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  tierIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  nameSection: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierText: {
    fontSize: 10,
    fontWeight: "600",
  },
  rightSection: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  guaranteeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  guaranteeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  vouchedBy: {
    fontSize: 10,
    color: "#6366F1",
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
  },
  statLabel: {
    fontSize: 9,
    color: "#9CA3AF",
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#E5E7EB",
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  compactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  compactAvatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  compactScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactScore: {
    fontSize: 12,
    fontWeight: "600",
  },
  compactGuarantee: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  // Inline badge styles
  inlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inlineBadgeText: {
    fontWeight: "500",
  },
  // Tier only badge
  tierOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tierOnlyScore: {
    fontSize: 14,
    fontWeight: "700",
  },
  tierOnlyLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
