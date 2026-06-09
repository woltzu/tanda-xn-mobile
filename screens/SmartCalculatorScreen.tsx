// ══════════════════════════════════════════════════════════════════════════════
// screens/SmartCalculatorScreen.tsx — ADVANCE-003 advance calculator
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 105-ADVANCE-003-SmartCalculator.jsx.
//
// Live-updating cost calculator for an advance against an upcoming
// circle payout. Calculates rate dynamically from user.xnScore +
// countryRisk + tierBonus, then derives fee, total, monthly payment,
// affordability check, and local-lender savings comparison.
//
// SLIDER NOTE — the web version used <input type="range"> for the
// amount control. RN has no native slider; rather than pull in
// @react-native-community/slider as a new dependency in this batch,
// we replace the drag with two equivalent controls:
//   - 4 quick-amount buttons ($100, $200, $300, max) — preserved
//     from the web design
//   - 2 stepper buttons (−$10 / +$10) for fine-grained adjustment
// The progress bar above remains as a static visual indicator.
// A real draggable slider can be wired later if needed.
//
// Route params (all optional):
//   advanceType?: 'contribution' | 'quick' | 'flex'
//   user?: { xnScore; smc; countryRisk; tierBonus }
//   upcomingPayout?: { amount; date; circleName }
//
// Navigation:
//   - back chevron → goBack
//   - "Why this rate?" → RateBreakdown
//   - "Request $X Advance" → ApplicationFlow (with the calc params)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from "react";
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
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";

type AdvanceType = "contribution" | "quick" | "flex";

type CalculatorUser = {
  xnScore: number;
  smc: number;
  countryRisk: number;
  tierBonus: number;
};

type UpcomingPayout = {
  amount: number;
  date: string;
  circleName: string;
};

type SmartCalculatorParams = {
  advanceType?: AdvanceType;
  user?: CalculatorUser;
  upcomingPayout?: UpcomingPayout;
};
type SmartCalculatorRouteProp = RouteProp<
  { SmartCalculator: SmartCalculatorParams },
  "SmartCalculator"
>;

const DEFAULT_USER: CalculatorUser = {
  xnScore: 78,
  smc: 200,
  countryRisk: 2,
  tierBonus: 0.5,
};

const DEFAULT_PAYOUT: UpcomingPayout = {
  amount: 500,
  date: "Feb 15, 2025",
  circleName: "Family Circle",
};

const BASE_RATES: Record<AdvanceType, number> = {
  contribution: 0,
  quick: 8,
  flex: 7,
};

const MAX_ADVANCE_PERCENT = 80;
const LOCAL_LENDER_RATE = 15;

// i18n: type → translation key. Resolved per-render via t() at the
// call site so language flips re-paint without re-instantiating.
const TYPE_TITLE_KEYS: Record<AdvanceType, string> = {
  contribution: "smart_calculator.type_contribution",
  quick: "smart_calculator.type_quick",
  flex: "smart_calculator.type_flex",
};

export default function SmartCalculatorScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<SmartCalculatorRouteProp>();
  const { t } = useTranslation();

  const advanceType: AdvanceType = route.params?.advanceType ?? "quick";
  const user = route.params?.user ?? DEFAULT_USER;
  const upcomingPayout = route.params?.upcomingPayout ?? DEFAULT_PAYOUT;

  const maxAdvance = Math.floor(
    upcomingPayout.amount * (MAX_ADVANCE_PERCENT / 100),
  );
  const minAmount = 50;

  const [amount, setAmount] = useState<number>(
    Math.min(200, maxAdvance),
  );
  const [term, setTerm] = useState<number>(
    advanceType === "quick" ? 2 : advanceType === "flex" ? 3 : 0,
  );

  // ── Rate calculation (mirrors the web logic) ───────────────────────────
  const rateInfo = useMemo(() => {
    if (advanceType === "contribution") {
      return { rate: 0, fee: 5, type: "flat" as const };
    }
    const base = BASE_RATES[advanceType];
    const scoreAdjust =
      user.xnScore >= 80 ? -1 : user.xnScore >= 70 ? 0 : user.xnScore >= 60 ? 1 : 2;
    const tierAdjust = -user.tierBonus;
    const totalRate = Math.max(
      6,
      base + user.countryRisk + scoreAdjust + tierAdjust,
    );
    return { rate: totalRate, type: "percent" as const, fee: 0 };
  }, [advanceType, user.xnScore, user.countryRisk, user.tierBonus]);

  const advanceFee = useMemo(() => {
    if (rateInfo.type === "flat") return rateInfo.fee;
    if (advanceType === "quick") {
      const weeklyRate = rateInfo.rate / 100 / 52;
      return amount * weeklyRate * term;
    }
    const monthlyRate = rateInfo.rate / 100 / 12;
    return amount * monthlyRate * term;
  }, [rateInfo, advanceType, amount, term]);

  const totalRepayment = amount + advanceFee;
  const monthlyPayment =
    advanceType === "flex" && term > 0 ? totalRepayment / term : null;
  const affordabilityPercent = monthlyPayment
    ? (monthlyPayment / user.smc) * 100
    : null;
  const isAffordable = !monthlyPayment || (affordabilityPercent ?? 0) <= 30;

  const localLenderFee =
    amount *
    (LOCAL_LENDER_RATE / 100) *
    (advanceType === "quick" ? term / 52 : term / 12);
  const savings = localLenderFee - advanceFee;

  const termOptions =
    advanceType === "quick" ? [1, 2, 3, 4] : advanceType === "flex" ? [3, 6, 9, 12] : [];

  const progressPct =
    maxAdvance > minAmount
      ? Math.round(((amount - minAmount) / (maxAdvance - minAmount)) * 100)
      : 0;

  const quickAmounts = Array.from(
    new Set([100, 200, 300, maxAdvance].filter((a) => a >= minAmount && a <= maxAdvance)),
  );

  const stepAmount = (delta: number) => {
    setAmount((prev) =>
      Math.max(minAmount, Math.min(maxAdvance, prev + delta)),
    );
  };

  const continueDisabled = !isAffordable && !!monthlyPayment;

  const handleContinue = () => {
    if (continueDisabled) return;
    navigation.navigate(Routes.ApplicationFlow, {
      advanceType,
      amount,
      term,
      rate: rateInfo.rate,
      fee: advanceFee,
      total: totalRepayment,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t(TYPE_TITLE_KEYS[advanceType])}</Text>
              <Text style={styles.headerSubtitle}>{t("smart_calculator.header_subtitle")}</Text>
            </View>
          </View>

          {/* Rate Badge */}
          <View style={styles.rateBadge}>
            <View style={styles.rateLeft}>
              <View style={styles.rateIconBox}>
                <Ionicons name="star" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.rateScoreLabel}>
                  {t("smart_calculator.rate_score_arrow", { score: user.xnScore })}
                </Text>
                <Text style={styles.rateValue}>
                  {rateInfo.type === "flat"
                    ? t("smart_calculator.rate_flat_fee", { fee: rateInfo.fee })
                    : t("smart_calculator.rate_percent", { rate: rateInfo.rate.toFixed(1) })}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.whyButton}
              onPress={() => navigation.navigate(Routes.RateBreakdown)}
              accessibilityRole="button"
              accessibilityLabel="Why this rate?"
            >
              <Text style={styles.whyButtonText}>{t("smart_calculator.why_this_rate")}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Advancing against */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>{t("smart_calculator.field_advancing_against")}</Text>
            <View style={styles.payoutRow}>
              <View>
                <Text style={styles.payoutCircle}>
                  {upcomingPayout.circleName}
                </Text>
                <Text style={styles.payoutDate}>
                  {t("smart_calculator.payout_date_prefix", { date: upcomingPayout.date })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.payoutAmount}>
                  ${upcomingPayout.amount}
                </Text>
                <Text style={styles.payoutMax}>{t("smart_calculator.payout_max_prefix", { amount: maxAdvance })}</Text>
              </View>
            </View>
          </View>

          {/* Amount controls */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>{t("smart_calculator.field_how_much")}</Text>

            <View style={styles.amountDisplay}>
              <Text style={styles.amountText}>${amount}</Text>
            </View>

            {/* Stepper row */}
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  amount <= minAmount && styles.stepperButtonDisabled,
                ]}
                onPress={() => stepAmount(-10)}
                disabled={amount <= minAmount}
                accessibilityRole="button"
                accessibilityLabel="Decrease by 10"
              >
                <Ionicons name="remove" size={20} color={NAVY} />
              </TouchableOpacity>

              {/* Visual progress bar (read-only) */}
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  amount >= maxAdvance && styles.stepperButtonDisabled,
                ]}
                onPress={() => stepAmount(10)}
                disabled={amount >= maxAdvance}
                accessibilityRole="button"
                accessibilityLabel="Increase by 10"
              >
                <Ionicons name="add" size={20} color={NAVY} />
              </TouchableOpacity>
            </View>

            <View style={styles.rangeLabels}>
              <Text style={styles.rangeLabel}>${minAmount}</Text>
              <Text style={styles.rangeLabel}>{t("smart_calculator.range_max_suffix", { amount: maxAdvance })}</Text>
            </View>

            {/* Quick amount buttons */}
            <View style={styles.quickRow}>
              {quickAmounts.map((amt) => {
                const isActive = amount === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.quickButton,
                      isActive && styles.quickButtonActive,
                    ]}
                    onPress={() => setAmount(amt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={styles.quickButtonText}>${amt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Term selector — hidden for contribution */}
          {advanceType !== "contribution" && (
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>{t("smart_calculator.field_repayment_term")}</Text>
              <View style={styles.termRow}>
                {termOptions.map((termOpt) => {
                  const isActive = term === termOpt;
                  return (
                    <TouchableOpacity
                      key={termOpt}
                      style={[styles.termButton, isActive && styles.termButtonActive]}
                      onPress={() => setTerm(termOpt)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={styles.termValue}>{termOpt}</Text>
                      <Text style={styles.termUnit}>
                        {advanceType === "quick"
                          ? t("smart_calculator.term_unit_weeks")
                          : t("smart_calculator.term_unit_months")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Cost summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t("smart_calculator.summary_title")}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("smart_calculator.summary_advance_amount")}</Text>
              <Text style={styles.summaryValue}>${amount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {rateInfo.type === "flat"
                  ? t("smart_calculator.summary_advance_fee_flat")
                  : t("smart_calculator.summary_advance_fee_pct", { rate: rateInfo.rate.toFixed(1) })}
              </Text>
              <Text style={styles.summaryFee}>+${advanceFee.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelStrong}>
                {advanceType === "contribution"
                  ? t("smart_calculator.summary_total_withheld")
                  : t("smart_calculator.summary_total_to_repay")}
              </Text>
              <Text style={styles.summaryTotal}>
                ${totalRepayment.toFixed(2)}
              </Text>
            </View>
            {monthlyPayment != null && (
              <View style={[styles.summaryRow, { marginTop: 8 }]}>
                <Text style={styles.summaryLabel}>{t("smart_calculator.summary_monthly_payment")}</Text>
                <Text style={styles.summaryValue}>
                  {t("smart_calculator.summary_monthly_value", { amount: monthlyPayment.toFixed(2) })}
                </Text>
              </View>
            )}
          </View>

          {/* Affordability */}
          {monthlyPayment != null && affordabilityPercent != null && (
            <View
              style={[
                styles.affordabilityCard,
                isAffordable
                  ? styles.affordabilityOk
                  : styles.affordabilityWarn,
              ]}
            >
              <Ionicons
                name={isAffordable ? "checkmark-circle" : "alert-circle"}
                size={20}
                color={isAffordable ? "#00897B" : AMBER}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.affordabilityTitle,
                    { color: isAffordable ? "#065F46" : "#92400E" },
                  ]}
                >
                  {isAffordable ? t("smart_calculator.affordability_ok") : t("smart_calculator.affordability_warn")}
                </Text>
                <Text
                  style={[
                    styles.affordabilityBody,
                    { color: isAffordable ? "#047857" : "#B45309" },
                  ]}
                >
                  {t("smart_calculator.affordability_body", {
                    payment: monthlyPayment.toFixed(2),
                    percent: affordabilityPercent.toFixed(0),
                    smc: user.smc,
                  })}
                  {!isAffordable && t("smart_calculator.affordability_body_warn_suffix")}
                </Text>
              </View>
            </View>
          )}

          {/* Comparison */}
          <View style={styles.sectionCard}>
            <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>
              {t("smart_calculator.comparison_label")}
            </Text>
            <View style={styles.comparisonRow}>
              <View style={styles.compChip}>
                <Text style={styles.compLabel}>{t("smart_calculator.comp_local_label")}</Text>
                <Text style={styles.compRateStrike}>{LOCAL_LENDER_RATE}%</Text>
                <Text style={styles.compFee}>
                  {t("smart_calculator.comp_fee_prefix", { amount: localLenderFee.toFixed(2) })}
                </Text>
              </View>
              <View style={styles.compChipWin}>
                <Text style={styles.compLabelWin}>{t("smart_calculator.comp_tandaxn_label")}</Text>
                <Text style={styles.compRateWin}>
                  {rateInfo.type === "flat"
                    ? t("smart_calculator.comp_flat_fee")
                    : t("smart_calculator.comp_percent", { rate: rateInfo.rate.toFixed(1) })}
                </Text>
                <Text style={styles.compFeeWin}>
                  {t("smart_calculator.comp_fee_prefix", { amount: advanceFee.toFixed(2) })}
                </Text>
              </View>
            </View>
            {savings > 0 && (
              <View style={styles.savingsBanner}>
                <Text style={styles.savingsText}>
                  {t("smart_calculator.savings_text", { amount: savings.toFixed(2) })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            continueDisabled && styles.primaryButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={continueDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: continueDisabled }}
          accessibilityLabel={`Request $${amount} advance`}
        >
          <Text
            style={[
              styles.primaryButtonText,
              continueDisabled && styles.primaryButtonTextDisabled,
            ]}
          >
            {t("smart_calculator.btn_request_advance", { amount })}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  rateBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 12,
    padding: 14,
  },
  rateLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rateIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  rateScoreLabel: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  rateValue: {
    fontSize: 20,
    fontWeight: "700",
    color: TEAL,
    marginTop: 2,
  },
  whyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  whyButtonText: { fontSize: 11, color: "#FFFFFF", fontWeight: "500" },

  contentWrap: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payoutCircle: { fontSize: 16, fontWeight: "600", color: NAVY },
  payoutDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  payoutAmount: { fontSize: 18, fontWeight: "700", color: TEAL },
  payoutMax: { fontSize: 11, color: MUTED, marginTop: 2 },

  amountDisplay: { alignItems: "center", marginBottom: 16 },
  amountText: { fontSize: 42, fontWeight: "700", color: NAVY },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonDisabled: { opacity: 0.4 },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: TEAL, borderRadius: 4 },

  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rangeLabel: { fontSize: 12, color: MUTED },

  quickRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  quickButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  quickButtonActive: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  quickButtonText: { fontSize: 13, fontWeight: "600", color: NAVY },

  termRow: { flexDirection: "row", gap: 10 },
  termButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  termButtonActive: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  termValue: { fontSize: 18, fontWeight: "700", color: NAVY },
  termUnit: { fontSize: 11, color: MUTED, marginTop: 2 },

  summaryCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  summaryLabelStrong: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  summaryValue: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  summaryFee: { fontSize: 14, fontWeight: "600", color: AMBER },
  summaryTotal: { fontSize: 20, fontWeight: "700", color: TEAL },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 6,
  },

  affordabilityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  affordabilityOk: { backgroundColor: "#F0FDFB", borderColor: TEAL },
  affordabilityWarn: { backgroundColor: "#FEF3C7", borderColor: AMBER },
  affordabilityTitle: { fontSize: 13, fontWeight: "600" },
  affordabilityBody: { fontSize: 12, marginTop: 2 },

  comparisonRow: { flexDirection: "row", gap: 12 },
  compChip: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    alignItems: "center",
  },
  compChipWin: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TEAL,
    alignItems: "center",
  },
  compLabel: { fontSize: 11, color: MUTED, marginBottom: 4 },
  compLabelWin: { fontSize: 11, color: "#00897B", marginBottom: 4 },
  compRateStrike: {
    fontSize: 16,
    fontWeight: "700",
    color: MUTED,
    textDecorationLine: "line-through",
  },
  compRateWin: { fontSize: 16, fontWeight: "700", color: TEAL },
  compFee: { fontSize: 12, color: MUTED, marginTop: 2 },
  compFeeWin: { fontSize: 12, color: "#00897B", marginTop: 2 },
  savingsBanner: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
    alignItems: "center",
  },
  savingsText: { fontSize: 14, fontWeight: "700", color: "#065F46" },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: BORDER },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  primaryButtonTextDisabled: { color: "#9CA3AF" },
});
