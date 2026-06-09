// ══════════════════════════════════════════════════════════════════════════════
// screens/InterestUnlockedSuccessScreen.tsx — Verification celebration screen
// ══════════════════════════════════════════════════════════════════════════════
//
// Built per KYC_FLOW_GUIDE.md section 08 (Phase KYC-2.1).
//
// Route params:
//   {
//     unlockedAmount: number;   // dollars of interest now claimable
//     isFullAccess: boolean;    // true once Tier 3 reached (tax ID
//                               // verified); false for Tier 2 (ID
//                               // only — interest still available
//                               // but capped per yearly limits).
//   }
//
// This is the *terminal* screen of the Interest-First KYC flow —
// reached from:
//   - TaxIDEntry (SSN / ITIN paths)
//   - DocumentUpload's back-side capture (international path,
//     replacing the old Tier2Success exit)
//
// Actions:
//   - "Transfer to my bank" → Withdraw (existing wallet flow)
//   - "Keep it growing"     → Dashboard
//   - "Go to Dashboard"     → Dashboard (secondary text button)
//
// Design: green-themed celebration. Mirrors Tier2Success's
// ring-in-ring success icon but with a money-green palette since the
// reward is interest. A before/after comparison is shown so the user
// sees concretely what changed.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { kycDraft } from "../lib/kycDraft";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const GREEN = "#059669";
const GREEN_DARK = "#047857";

type InterestUnlockedSuccessParams = {
  unlockedAmount: number;
  isFullAccess: boolean;
};
type InterestUnlockedSuccessRouteProp = RouteProp<
  { InterestUnlockedSuccess: InterestUnlockedSuccessParams },
  "InterestUnlockedSuccess"
>;

const CONFETTI = ["🎊", "✨", "🎉", "💚", "🎉", "✨", "🎊"];

function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type ChangeRow = {
  label: string;
  before: string;
  after: string;
  beforeMuted?: boolean;
};

function buildChanges(isFullAccess: boolean): ChangeRow[] {
  return [
    {
      label: "Interest withdrawals",
      before: "Locked",
      after: "Unlocked",
      beforeMuted: true,
    },
    {
      label: "Payouts per year",
      before: "$600 max",
      after: isFullAccess ? "Unlimited" : "$600 max",
      beforeMuted: !isFullAccess ? false : true,
    },
    {
      label: "International transfers",
      before: "Locked",
      after: isFullAccess ? "Enabled" : "Locked",
      beforeMuted: true,
    },
    {
      label: "TandaXn Credit",
      before: "Locked",
      after: isFullAccess ? "Eligible" : "Locked",
      beforeMuted: true,
    },
  ];
}

export default function InterestUnlockedSuccessScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<InterestUnlockedSuccessRouteProp>();
  const unlockedAmount = route.params?.unlockedAmount ?? 0;
  const isFullAccess = route.params?.isFullAccess ?? false;
  const amountLabel = formatMoney(unlockedAmount);
  const changes = buildChanges(isFullAccess);

  // Terminal screen for the SSN/ITIN KYC path. Wipe the resume draft so a
  // future re-entry to the KYC flow (e.g. a second account, or a returning
  // user testing) starts clean. (The international path's terminal —
  // Tier2SuccessScreen — performs the same wipe for its branch.)
  useEffect(() => {
    kycDraft.clear();
  }, []);

  const goToDashboard = () => navigation.navigate(Routes.Dashboard);
  const goToTransfer = () => navigation.navigate(Routes.Withdraw);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Green celebration hero */}
        <LinearGradient
          colors={[GREEN_DARK, GREEN]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.confettiRow}>
            {CONFETTI.map((c, i) => (
              <Text key={i} style={styles.confettiText}>
                {c}
              </Text>
            ))}
          </View>

          {/* Ring-in-ring success icon */}
          <View style={styles.successOuterRing}>
            <View style={styles.successInnerRing}>
              <Ionicons name="checkmark" size={42} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.heroTitle}>Interest Unlocked!</Text>
          <Text style={styles.heroSubtitle}>
            Your verification is complete
          </Text>

          {/* Amount card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Now claimable</Text>
            <Text style={styles.amountValue}>{amountLabel}</Text>
          </View>

          {/* Tier badge */}
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeEmoji}>
              {isFullAccess ? "🏆" : "✨"}
            </Text>
            <Text style={styles.tierBadgeText}>
              {isFullAccess ? "Tier 3: Full Access" : "Tier 2: Verified"}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* What's changed */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What's changed</Text>
            <View style={styles.changesList}>
              {/* Column header row */}
              <View style={styles.changesHeader}>
                <Text style={styles.changesHeaderCell}> </Text>
                <Text style={[styles.changesHeaderCell, styles.changesCol]}>
                  Before
                </Text>
                <Text style={[styles.changesHeaderCell, styles.changesCol]}>
                  Now
                </Text>
              </View>
              {changes.map((row, idx) => {
                const afterIsImprovement = row.before !== row.after;
                return (
                  <View
                    key={row.label}
                    style={[
                      styles.changesRow,
                      idx < changes.length - 1 && styles.changesRowBorder,
                    ]}
                  >
                    <Text style={styles.changesLabel}>{row.label}</Text>
                    <Text
                      style={[
                        styles.changesValue,
                        row.beforeMuted && styles.changesValueMuted,
                      ]}
                    >
                      {row.before}
                    </Text>
                    <Text
                      style={[
                        styles.changesValue,
                        afterIsImprovement && styles.changesValueGreen,
                      ]}
                    >
                      {row.after}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Optional next-step hint when only Tier 2 */}
          {!isFullAccess && (
            <View style={styles.upgradeHint}>
              <Text style={styles.upgradeEmoji}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.upgradeTitle}>Want even more?</Text>
                <Text style={styles.upgradeBody}>
                  Add your tax ID (SSN or ITIN) to unlock unlimited payouts
                  and international transfers.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={goToTransfer}
          accessibilityRole="button"
          accessibilityLabel="Transfer to my bank"
        >
          <Ionicons name="arrow-down" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Transfer to my bank</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={goToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Keep it growing"
        >
          <Text style={styles.outlineButtonText}>Keep it growing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textButton}
          onPress={goToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Go to dashboard"
        >
          <Text style={styles.textButtonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  confettiRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  confettiText: { fontSize: 22 },

  successOuterRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successInnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF20",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 20,
  },

  amountCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    minWidth: 220,
  },
  amountLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  amountValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 6,
    letterSpacing: -0.5,
  },

  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 14,
  },
  tierBadgeEmoji: { fontSize: 15 },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  contentWrap: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  changesList: {},
  changesHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  changesHeaderCell: {
    flex: 1.5,
    fontSize: 11,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "600",
  },
  changesCol: {
    flex: 1,
    textAlign: "right",
  },
  changesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  changesRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  changesLabel: {
    flex: 1.5,
    fontSize: 13,
    color: NAVY,
    fontWeight: "500",
  },
  changesValue: {
    flex: 1,
    fontSize: 13,
    color: NAVY,
    textAlign: "right",
  },
  changesValueMuted: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  changesValueGreen: {
    color: GREEN,
    fontWeight: "700",
  },

  upgradeHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
  },
  upgradeEmoji: { fontSize: 18 },
  upgradeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  upgradeBody: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 18,
    marginTop: 4,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: GREEN,
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  outlineButton: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    marginBottom: 6,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  textButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  textButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
  },
});
