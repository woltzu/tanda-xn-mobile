// ══════════════════════════════════════════════════════════════════════════════
// screens/RepaymentConfirmScreen.tsx — ADVANCE-013 early-repayment success
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 115-ADVANCE-013-RepaymentConfirm.jsx.
//
// Terminal celebration after a successful early repayment. Reached
// from EarlyRepayment's confirm button. Surfaces:
//   - amount paid + paid-from card
//   - 2-tile savings + XnScore bonus row
//   - navy XnScore progress card with old→new score transition
//   - repayment details (advance ID, paid at, status)
//   - "What's next" green callout
//   - View History / New Advance side-by-side + Done CTA at bottom
//
// Route params (all optional, defaults match canonical mock):
//   repayment?: RepaymentDetails
//   advanceId?: string     ← forwarded; falls through to repayment.advanceId
//   amountPaid?: number    ← forwarded from EarlyRepayment
//   feeSaved?: number
//   paidFrom?: string
//
// Navigation:
//   - "View History" → AdvanceHistory
//   - "New Advance"  → AdvanceHubV2
//   - "Done"         → goBack
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
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

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const TEAL_DARK = "#00897B";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type RepaymentDetails = {
  advanceId: string;
  amountPaid: number;
  feeSaved: number;
  paidFrom: string;
  paidAt: string;
  xnScoreBonus: number;
  newXnScore: number;
  previousXnScore: number;
};

type RepaymentConfirmParams = {
  repayment?: RepaymentDetails;
  advanceId?: string;
  amountPaid?: number;
  feeSaved?: number;
  paidFrom?: string;
};
type RepaymentConfirmRouteProp = RouteProp<
  { RepaymentConfirm: RepaymentConfirmParams },
  "RepaymentConfirm"
>;

const DEFAULT_REPAYMENT: RepaymentDetails = {
  advanceId: "ADV-2025-0120-001",
  amountPaid: 310,
  feeSaved: 5,
  paidFrom: "TandaXn Wallet",
  paidAt: "Jan 25, 2025 at 3:42 PM",
  xnScoreBonus: 4,
  newXnScore: 82,
  previousXnScore: 78,
};

const WHATS_NEXT = [
  "Your advance is now closed",
  "Your full payout will be available on payout date",
  "You're eligible for new advances immediately",
  "Your improved XnScore may qualify you for better rates",
];

export default function RepaymentConfirmScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<RepaymentConfirmRouteProp>();

  // Merge: explicit repayment wins; otherwise build from forwarded
  // EarlyRepayment params; otherwise fall back to mock.
  const repayment: RepaymentDetails = route.params?.repayment ?? {
    ...DEFAULT_REPAYMENT,
    advanceId: route.params?.advanceId ?? DEFAULT_REPAYMENT.advanceId,
    amountPaid: route.params?.amountPaid ?? DEFAULT_REPAYMENT.amountPaid,
    feeSaved: route.params?.feeSaved ?? DEFAULT_REPAYMENT.feeSaved,
    paidFrom: route.params?.paidFrom ?? DEFAULT_REPAYMENT.paidFrom,
  };

  const progressPct = Math.min(100, Math.max(0, repayment.newXnScore));

  const handleViewHistory = () =>
    navigation.navigate(Routes.AdvanceHubV2);
  const handleNewAdvance = () => navigation.navigate(Routes.AdvanceHubV2);
  const handleDone = () => navigation.goBack();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL_DARK} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Teal-gradient hero */}
        <LinearGradient
          colors={[TEAL, TEAL_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.successRing}>
            <Ionicons name="checkmark" size={50} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{t("repayment_confirm.hero_title")}</Text>
          <Text style={styles.heroSubtitle}>{t("repayment_confirm.hero_subtitle")}</Text>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Amount card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>{t("repayment_confirm.label_amount_paid")}</Text>
            <Text style={styles.amountValue}>${repayment.amountPaid}</Text>
            <Text style={styles.amountSub}>From {repayment.paidFrom}</Text>
          </View>

          {/* Savings + XnScore tiles */}
          <View style={styles.tileRow}>
            <View style={styles.tileSavings}>
              <View style={styles.tileSavingsIcon}>
                <Ionicons name="cash" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.tileSavingsValue}>${repayment.feeSaved}</Text>
              <Text style={styles.tileSavingsLabel}>{t("repayment_confirm.tile_fees_saved")}</Text>
            </View>
            <View style={styles.tileBonus}>
              <View style={styles.tileBonusIcon}>
                <Ionicons name="star" size={20} color={TEAL} />
              </View>
              <Text style={styles.tileBonusValue}>+{repayment.xnScoreBonus}</Text>
              <Text style={styles.tileBonusLabel}>{t("repayment_confirm.tile_xnscore_bonus")}</Text>
            </View>
          </View>

          {/* XnScore progress (navy) */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreHeaderLabel}>{t("repayment_confirm.label_your_xnscore")}</Text>
              <Text style={styles.scoreHeaderValue}>
                {repayment.previousXnScore} → {repayment.newXnScore}
              </Text>
            </View>
            <View style={styles.scoreBody}>
              <View style={styles.scoreRing}>
                <Text style={styles.scoreRingValue}>{repayment.newXnScore}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.scoreProgressBg}>
                  <View
                    style={[
                      styles.scoreProgressFill,
                      { width: `${progressPct}%` },
                    ]}
                  />
                </View>
                <Text style={styles.scoreBodyText}>
                  Early repayment earned you{" "}
                  <Text style={styles.scoreBodyEmphasis}>
                    +{repayment.xnScoreBonus} points
                  </Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Repayment details */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("repayment_confirm.section_details")}</Text>
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("repayment_confirm.detail_advance_id")}</Text>
                <Text style={styles.detailValue}>{repayment.advanceId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("repayment_confirm.detail_paid_at")}</Text>
                <Text style={styles.detailValue}>{repayment.paidAt}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("repayment_confirm.detail_status")}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Closed ✓</Text>
                </View>
              </View>
            </View>
          </View>

          {/* What's next */}
          <View style={styles.nextCard}>
            <Text style={styles.nextTitle}>✅ What's next</Text>
            <View style={styles.nextList}>
              {WHATS_NEXT.map((item, idx) => (
                <View key={idx} style={styles.nextRow}>
                  <View style={styles.nextDot} />
                  <Text style={styles.nextText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Side-by-side action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={handleViewHistory}
              accessibilityRole="button"
              accessibilityLabel="View advance history"
            >
              <Text style={styles.outlineButtonText}>{t("repayment_confirm.btn_view_history")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navyButton}
              onPress={handleNewAdvance}
              accessibilityRole="button"
              accessibilityLabel="Request new advance"
            >
              <Text style={styles.navyButtonText}>{t("repayment_confirm.btn_new_advance")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneButtonText}>{t("repayment_confirm.btn_done")}</Text>
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
    paddingBottom: 100,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  successRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },

  contentWrap: { marginTop: -60, paddingHorizontal: 20 },

  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  amountLabel: { fontSize: 14, color: MUTED, marginBottom: 8 },
  amountValue: {
    fontSize: 42,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 8,
  },
  amountSub: { fontSize: 13, color: TEAL },

  tileRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  tileSavings: {
    flex: 1,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: TEAL,
  },
  tileSavingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileSavingsValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 4,
  },
  tileSavingsLabel: { fontSize: 11, color: "#047857" },

  tileBonus: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  tileBonusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileBonusValue: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 4,
  },
  tileBonusLabel: { fontSize: 11, color: MUTED },

  scoreCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  scoreHeaderLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  scoreHeaderValue: { fontSize: 13, color: TEAL },
  scoreBody: { flexDirection: "row", alignItems: "center", gap: 16 },
  scoreRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,198,174,0.2)",
    borderWidth: 3,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRingValue: { fontSize: 22, fontWeight: "700", color: TEAL },
  scoreProgressBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  scoreProgressFill: { height: 8, backgroundColor: TEAL, borderRadius: 4 },
  scoreBodyText: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  scoreBodyEmphasis: { color: TEAL, fontWeight: "600" },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },
  detailsList: { gap: 10 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: { fontSize: 13, color: MUTED },
  detailValue: { fontSize: 13, fontWeight: "600", color: NAVY },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F0FDF4",
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600", color: "#166534" },

  nextCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TEAL,
  },
  nextTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 10,
  },
  nextList: { gap: 6 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: TEAL,
  },
  nextText: { flex: 1, fontSize: 12, color: "#047857" },

  actionRow: { flexDirection: "row", gap: 10 },
  outlineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  outlineButtonText: { fontSize: 13, fontWeight: "600", color: NAVY },
  navyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: "center",
  },
  navyButtonText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  doneButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  doneButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
