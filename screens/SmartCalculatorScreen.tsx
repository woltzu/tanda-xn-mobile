// ══════════════════════════════════════════════════════════════════════════════
// screens/SmartCalculatorScreen.tsx — Advance calculator + apply (P1)
// ══════════════════════════════════════════════════════════════════════════════
//
// P1 update (2026-06-12):
//   - Slider initial value pre-filled from `product.recommended_amount_cents`
//     (server-computed in migration 148: 60% of max, clamped to min). Note
//     line shown above the control: "We suggest $X based on your eligibility."
//   - Quick-amount preset buttons removed; only the stepper + progress bar
//     remain as the amount control (one surface, not three).
//   - Inline expandable Terms & Conditions section replaces the standalone
//     AdvanceAgreement screen.
//   - Help icons on APR / Fee / Amount / Term that open Alert.alert with a
//     plain-language explanation.
//   - Progress chip "Step 2 of 3 — Confirm amount & terms" above the
//     content.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import {
  useAdvanceDashboard,
  requestAdvance,
  AdvanceProductCard,
  AdvanceUiCode,
} from "../hooks/useAdvanceDashboard";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";
const RED = "#EF4444";

const LOCAL_LENDER_RATE = 15;

const TYPE_TITLE_KEYS: Record<AdvanceUiCode, string> = {
  contribution: "smart_calculator.type_contribution",
  quick: "smart_calculator.type_quick",
  flex: "smart_calculator.type_flex",
  premium: "smart_calculator.type_premium",
};

type SmartCalculatorParams = {
  advanceType?: AdvanceUiCode;
  product?: AdvanceProductCard;
  xnscore?: number;
};
type SmartCalculatorRouteProp = RouteProp<
  { SmartCalculator: SmartCalculatorParams },
  "SmartCalculator"
>;

function amortizationMonthlyCents(
  principalCents: number,
  aprPct: number,
  termMonths: number,
): number {
  if (termMonths <= 0) return principalCents;
  if (aprPct <= 0) return Math.ceil(principalCents / termMonths);
  const r = aprPct / 100 / 12;
  const cf = Math.pow(1 + r, termMonths);
  return Math.round((principalCents * r * cf) / (cf - 1));
}

// Help-icon trigger with a stable shape (used by APR / Fee / Amount / Term).
function HelpDot({
  onPress,
  a11yLabel,
}: {
  onPress: () => void;
  a11yLabel: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={{ marginLeft: 4 }}
    >
      <Ionicons name="help-circle-outline" size={14} color={MUTED} />
    </TouchableOpacity>
  );
}

export default function SmartCalculatorScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<SmartCalculatorRouteProp>();
  const { t, i18n } = useTranslation();
  const dashboard = useAdvanceDashboard();

  const advanceType: AdvanceUiCode = route.params?.advanceType ?? "quick";
  const productFromParams = route.params?.product ?? null;
  const productFromHook =
    dashboard.data?.products.find((p) => p.ui_code === advanceType) ?? null;
  const product = productFromParams ?? productFromHook;
  const xnscore = route.params?.xnscore ?? dashboard.data?.xnscore ?? 0;

  const [submitting, setSubmitting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Loading / missing-product
  if (dashboard.loading && !product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.fullCenter}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.fullCenterLabel}>
            {t("smart_calculator.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.fullCenter}>
          <Ionicons name="alert-circle-outline" size={36} color={RED} />
          <Text style={styles.fullCenterLabel}>
            {t("smart_calculator.product_not_found")}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>
              {t("smart_calculator.go_back")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Bounds from live product
  const minAmountCents = product.min_amount_cents ?? 5000;
  const maxAmountCents = product.max_amount_cents ?? 100000;
  const minTerm = product.min_term_months ?? 1;
  const maxTerm = product.max_term_months ?? 12;
  const apr = product.estimated_apr ?? 0;

  // P1: use server-suggested amount (60% of max, clamped to min).
  const recommendedCents = Math.max(
    minAmountCents,
    Math.min(
      maxAmountCents,
      product.recommended_amount_cents ?? Math.floor(maxAmountCents * 0.6),
    ),
  );
  const [amountCents, setAmountCents] = useState<number>(recommendedCents);
  const [term, setTerm] = useState<number>(minTerm);

  // Derived
  const monthlyCents = useMemo(
    () => amortizationMonthlyCents(amountCents, apr, term),
    [amountCents, apr, term],
  );
  const totalRepayCents = monthlyCents * term;
  const feeCents = totalRepayCents - amountCents;
  const originationFeeCents = Math.round(
    amountCents * (product.origination_fee_percent ?? 0) / 100,
  );
  const monthlyPayment = monthlyCents / 100;

  const termOptions = useMemo(() => {
    if (maxTerm <= minTerm) return [minTerm];
    const span = maxTerm - minTerm;
    if (span <= 3) return Array.from({ length: span + 1 }, (_, i) => minTerm + i);
    return [
      minTerm,
      minTerm + Math.round(span / 3),
      minTerm + Math.round((2 * span) / 3),
      maxTerm,
    ];
  }, [minTerm, maxTerm]);

  const progressPct =
    maxAmountCents > minAmountCents
      ? Math.round(
          ((amountCents - minAmountCents) / (maxAmountCents - minAmountCents)) *
            100,
        )
      : 0;

  const stepAmount = (deltaCents: number) =>
    setAmountCents((prev) =>
      Math.max(minAmountCents, Math.min(maxAmountCents, prev + deltaCents)),
    );

  const localLenderFeeCents = Math.round(
    amountCents *
      (LOCAL_LENDER_RATE / 100) *
      (term <= 3 ? term / 12 : term / 12),
  );
  const savingsCents = localLenderFeeCents - feeCents;

  // Repayment schedule preview — first 3 payments, computed client-side from
  // the same amortization that drives the monthly figure. Dates are estimates
  // (first payment ~1 month from approval); the RPC stamps the final dates
  // server-side after submission, so the card carries a "Final dates set
  // after approval" caveat.
  const PREVIEW_LIMIT = 3;
  const schedulePreview = useMemo(() => {
    const previewCount = Math.min(PREVIEW_LIMIT, term);
    const locale = i18n.language || undefined;
    const fmtDate = (d: Date) => {
      try {
        return d.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return d.toDateString();
      }
    };
    const today = new Date();
    const rows: Array<{ n: number; date: string; amount: string }> = [];
    for (let n = 1; n <= previewCount; n++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() + n);
      rows.push({
        n,
        date: fmtDate(d),
        amount: (monthlyCents / 100).toFixed(2),
      });
    }
    return rows;
  }, [term, monthlyCents, i18n.language]);
  const extraPayments = Math.max(0, term - PREVIEW_LIMIT);

  // ── Help-icon callbacks ───────────────────────────────────────────────
  const helpApr = () =>
    Alert.alert(
      t("smart_calculator.help_apr_title"),
      t("smart_calculator.help_apr_body"),
    );
  const helpFee = () =>
    Alert.alert(
      t("smart_calculator.help_fee_title"),
      t("smart_calculator.help_fee_body"),
    );
  const helpAmount = () =>
    Alert.alert(
      t("smart_calculator.help_amount_title"),
      t("smart_calculator.help_amount_body"),
    );
  const helpTerm = () =>
    Alert.alert(
      t("smart_calculator.help_term_title"),
      t("smart_calculator.help_term_body"),
    );

  // ── Submit ────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await requestAdvance({
        ui_code: advanceType,
        requested_amount_cents: amountCents,
        term_months: term,
        repayment_preference: "payout_withholding",
      });
      navigation.navigate(Routes.AdvanceDetailsV2 as never, {
        advanceId: result.loan_id,
        justCreated: true,
      } as never);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const blockedMatch = raw.match(/eligibility_blocked:(\w+)/);
      const key = blockedMatch ? blockedMatch[1] : null;
      const localizedReason = key
        ? t(`smart_calculator.error_${key}`, {
            defaultValue: t("smart_calculator.error_generic"),
          })
        : t("smart_calculator.error_generic");
      Alert.alert(t("smart_calculator.error_title"), localizedReason);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={styles.headerTitle}>
                {t(TYPE_TITLE_KEYS[advanceType])}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("smart_calculator.header_subtitle")}
              </Text>
            </View>
          </View>

          <View style={styles.rateBadge}>
            <View style={styles.rateLeft}>
              <View style={styles.rateIconBox}>
                <Ionicons name="star" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.rateScoreLabel}>
                  {t("smart_calculator.rate_score_arrow", { score: xnscore })}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.rateValue}>
                    {t("smart_calculator.rate_percent", {
                      rate: apr.toFixed(1),
                    })}
                  </Text>
                  <HelpDot
                    onPress={helpApr}
                    a11yLabel={t("smart_calculator.help_apr_title")}
                  />
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.whyButton}
              onPress={() => navigation.navigate(Routes.RateBreakdown)}
              accessibilityRole="button"
              accessibilityLabel="Why this rate?"
            >
              <Text style={styles.whyButtonText}>
                {t("smart_calculator.why_this_rate")}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Progress chip */}
          <View style={styles.progressChip}>
            <Ionicons name="ellipse" size={8} color={TEAL} />
            <Text style={styles.progressChipText}>
              {t("smart_calculator.progress_step_2")}
            </Text>
          </View>

          {/* About this product */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>
              {t("smart_calculator.about_product_label")}
            </Text>
            <Text style={styles.aboutBody}>
              {product.description ??
                t(`advance_hub_v2.product_${advanceType}_desc`)}
            </Text>
            <View style={styles.aboutStatRow}>
              <Text style={styles.aboutStatLabel}>
                {t("smart_calculator.about_max")}
              </Text>
              <Text style={styles.aboutStatValue}>
                ${(maxAmountCents / 100).toLocaleString()}
              </Text>
            </View>
            <View style={styles.aboutStatRow}>
              <Text style={styles.aboutStatLabel}>
                {t("smart_calculator.about_term_range")}
              </Text>
              <Text style={styles.aboutStatValue}>
                {minTerm === maxTerm
                  ? t("advance_hub_v2.term_n_months", { n: minTerm })
                  : t("advance_hub_v2.term_range_months", {
                      min: minTerm,
                      max: maxTerm,
                    })}
              </Text>
            </View>
          </View>

          {/* Amount control */}
          <View style={styles.sectionCard}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>
                {t("smart_calculator.field_how_much")}
              </Text>
              <HelpDot
                onPress={helpAmount}
                a11yLabel={t("smart_calculator.help_amount_title")}
              />
            </View>

            {/* Recommended amount note */}
            <Text style={styles.recommendedNote}>
              {t("smart_calculator.recommended_note", {
                amount: (recommendedCents / 100).toLocaleString(),
              })}
            </Text>

            <View style={styles.amountDisplay}>
              <Text style={styles.amountText}>
                ${Math.round(amountCents / 100).toLocaleString()}
              </Text>
            </View>

            {/* P2 — Recommended-amount tooltip that updates live with the
                slider. (i) icon opens an Alert explaining the calc. The
                tooltip's color flips green when the user is close to the
                recommendation and amber when they're far above it. */}
            {(() => {
              const recommendedDollars = Math.round(recommendedCents / 100);
              const currentDollars = Math.round(amountCents / 100);
              const distance = Math.abs(currentDollars - recommendedDollars);
              const closeEnough = distance <= Math.max(20, recommendedDollars * 0.1);
              const overTop = currentDollars > recommendedDollars;
              const tone = closeEnough
                ? "#10B981"
                : overTop
                ? "#F59E0B"
                : "#0A2342";
              return (
                <View style={styles.recommendBlock}>
                  <View style={[styles.recommendChip, { borderColor: tone }]}>
                    <Ionicons
                      name="flash-outline"
                      size={12}
                      color={tone}
                    />
                    <Text style={[styles.recommendChipText, { color: tone }]}>
                      {closeEnough
                        ? t("smart_calculator.recommend_chip_match", {
                            amount: `$${recommendedDollars.toLocaleString()}`,
                          })
                        : t("smart_calculator.recommend_chip", {
                            amount: `$${recommendedDollars.toLocaleString()}`,
                          })}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          t("smart_calculator.recommend_info_title"),
                          t("smart_calculator.recommend_info_body", {
                            amount: `$${recommendedDollars.toLocaleString()}`,
                            max: `$${(maxAmountCents / 100).toLocaleString()}`,
                          }),
                        )
                      }
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={t("smart_calculator.recommend_info_title")}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color={tone}
                      />
                    </TouchableOpacity>
                  </View>
                  {!closeEnough ? (
                    <TouchableOpacity
                      onPress={() => setAmountCents(recommendedCents)}
                      style={styles.recommendUseBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.recommendUseBtnText}>
                        {t("smart_calculator.recommend_use_cta")}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })()}

            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  amountCents <= minAmountCents && styles.stepperButtonDisabled,
                ]}
                onPress={() => stepAmount(-1000)}
                disabled={amountCents <= minAmountCents}
                accessibilityRole="button"
                accessibilityLabel="Decrease by $10"
              >
                <Ionicons name="remove" size={20} color={NAVY} />
              </TouchableOpacity>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  amountCents >= maxAmountCents && styles.stepperButtonDisabled,
                ]}
                onPress={() => stepAmount(1000)}
                disabled={amountCents >= maxAmountCents}
                accessibilityRole="button"
                accessibilityLabel="Increase by $10"
              >
                <Ionicons name="add" size={20} color={NAVY} />
              </TouchableOpacity>
            </View>

            <View style={styles.rangeLabels}>
              <Text style={styles.rangeLabel}>
                ${(minAmountCents / 100).toLocaleString()}
              </Text>
              <Text style={styles.rangeLabel}>
                {t("smart_calculator.range_max_only", {
                  amount: (maxAmountCents / 100).toLocaleString(),
                })}
              </Text>
            </View>
          </View>

          {/* Term selector */}
          {termOptions.length > 1 ? (
            <View style={styles.sectionCard}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  {t("smart_calculator.field_repayment_term")}
                </Text>
                <HelpDot
                  onPress={helpTerm}
                  a11yLabel={t("smart_calculator.help_term_title")}
                />
              </View>
              <View style={styles.termRow}>
                {termOptions.map((termOpt) => {
                  const isActive = term === termOpt;
                  return (
                    <TouchableOpacity
                      key={termOpt}
                      style={[
                        styles.termButton,
                        isActive && styles.termButtonActive,
                      ]}
                      onPress={() => setTerm(termOpt)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={styles.termValue}>{termOpt}</Text>
                      <Text style={styles.termUnit}>
                        {t("smart_calculator.term_unit_months")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Cost summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTitleRow}>
              <Text style={styles.summaryTitle}>
                {t("smart_calculator.summary_title")}
              </Text>
              <TouchableOpacity
                onPress={helpFee}
                accessibilityRole="button"
                accessibilityLabel={t("smart_calculator.help_fee_title")}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={14}
                  color="rgba(255,255,255,0.7)"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {t("smart_calculator.summary_advance_amount")}
              </Text>
              <Text style={styles.summaryValue}>
                ${(amountCents / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {t("smart_calculator.summary_advance_fee_pct", {
                  rate: apr.toFixed(1),
                })}
              </Text>
              <Text style={styles.summaryFee}>
                +${(feeCents / 100).toFixed(2)}
              </Text>
            </View>
            {originationFeeCents > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {t("smart_calculator.summary_origination_fee", {
                    rate: (product.origination_fee_percent ?? 0).toFixed(2),
                  })}
                </Text>
                <Text style={styles.summaryFee}>
                  +${(originationFeeCents / 100).toFixed(2)}
                </Text>
              </View>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelStrong}>
                {t("smart_calculator.summary_total_to_repay")}
              </Text>
              <Text style={styles.summaryTotal}>
                ${(totalRepayCents / 100).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 8 }]}>
              <Text style={styles.summaryLabel}>
                {t("smart_calculator.summary_monthly_payment")}
              </Text>
              <Text style={styles.summaryValue}>
                {t("smart_calculator.summary_monthly_value", {
                  amount: monthlyPayment.toFixed(2),
                })}
              </Text>
            </View>
          </View>

          {/* Repayment schedule preview */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>
              {t("smart_calculator.schedule_title")}
            </Text>
            <Text style={styles.scheduleNote}>
              {t("smart_calculator.schedule_estimate_note")}
            </Text>
            {schedulePreview.map((row) => (
              <View key={row.n} style={styles.scheduleRow}>
                <Text style={styles.scheduleN}>
                  {t("smart_calculator.schedule_payment_n", { n: row.n })}
                </Text>
                <Text style={styles.scheduleDate}>{row.date}</Text>
                <Text style={styles.scheduleAmount}>${row.amount}</Text>
              </View>
            ))}
            {extraPayments > 0 ? (
              <Text style={styles.scheduleMore}>
                {t("smart_calculator.schedule_more", { count: extraPayments })}
              </Text>
            ) : null}
          </View>

          {/* Comparison */}
          <View style={styles.sectionCard}>
            <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>
              {t("smart_calculator.comparison_label")}
            </Text>
            <View style={styles.comparisonRow}>
              <View style={styles.compChip}>
                <Text style={styles.compLabel}>
                  {t("smart_calculator.comp_local_label")}
                </Text>
                <Text style={styles.compRateStrike}>{LOCAL_LENDER_RATE}%</Text>
                <Text style={styles.compFee}>
                  {t("smart_calculator.comp_fee_prefix", {
                    amount: (localLenderFeeCents / 100).toFixed(2),
                  })}
                </Text>
              </View>
              <View style={styles.compChipWin}>
                <Text style={styles.compLabelWin}>
                  {t("smart_calculator.comp_tandaxn_label")}
                </Text>
                <Text style={styles.compRateWin}>
                  {t("smart_calculator.comp_percent", {
                    rate: apr.toFixed(1),
                  })}
                </Text>
                <Text style={styles.compFeeWin}>
                  {t("smart_calculator.comp_fee_prefix", {
                    amount: (feeCents / 100).toFixed(2),
                  })}
                </Text>
              </View>
            </View>
            {savingsCents > 0 && (
              <View style={styles.savingsBanner}>
                <Text style={styles.savingsText}>
                  {t("smart_calculator.savings_text", {
                    amount: (savingsCents / 100).toFixed(2),
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Inline Terms & Conditions (replaces AdvanceAgreement screen) */}
          <TouchableOpacity
            style={styles.termsHeader}
            onPress={() => setTermsOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: termsOpen }}
            accessibilityLabel={t("smart_calculator.terms_title")}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={NAVY}
            />
            <Text style={styles.termsHeaderText}>
              {t("smart_calculator.terms_title")}
            </Text>
            <Ionicons
              name={termsOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={MUTED}
            />
          </TouchableOpacity>
          {termsOpen ? (
            <View style={styles.termsBody}>
              <Text style={styles.termsParagraph}>
                {t("smart_calculator.terms_p1", {
                  amount: (amountCents / 100).toFixed(2),
                  total: (totalRepayCents / 100).toFixed(2),
                  apr: apr.toFixed(1),
                  term,
                })}
              </Text>
              <Text style={styles.termsParagraph}>
                {t("smart_calculator.terms_p2")}
              </Text>
              <Text style={styles.termsParagraph}>
                {t("smart_calculator.terms_p3")}
              </Text>
              <Text style={styles.termsParagraph}>
                {t("smart_calculator.terms_p4")}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            submitting && styles.primaryButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          accessibilityLabel={`Request $${Math.round(amountCents / 100)} advance`}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {t("smart_calculator.btn_request_advance", {
                amount: Math.round(amountCents / 100),
              })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  fullCenterLabel: { fontSize: 14, color: MUTED, textAlign: "center" },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: 10,
  },
  retryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

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

  progressChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  progressChipText: { fontSize: 11, fontWeight: "700", color: NAVY },

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
  labelRow: { flexDirection: "row", alignItems: "center" },

  aboutBody: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
    marginBottom: 12,
  },
  aboutStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  aboutStatLabel: { fontSize: 12, color: MUTED },
  aboutStatValue: { fontSize: 14, color: NAVY, fontWeight: "600" },

  recommendedNote: {
    fontSize: 12,
    color: TEAL,
    fontStyle: "italic",
    marginBottom: 12,
  },

  amountDisplay: { alignItems: "center", marginBottom: 16 },
  amountText: { fontSize: 42, fontWeight: "700", color: NAVY },
  // P2 — recommended-amount chip
  recommendBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  recommendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  recommendChipText: { fontSize: 11, fontWeight: "700" },
  recommendUseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  recommendUseBtnText: { fontSize: 11, fontWeight: "700", color: "#0A2342" },

  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
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

  scheduleNote: { fontSize: 12, color: MUTED, marginBottom: 10 },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  scheduleN: { flex: 0, width: 80, fontSize: 13, color: NAVY, fontWeight: "600" },
  scheduleDate: { flex: 1, fontSize: 13, color: MUTED, textAlign: "center" },
  scheduleAmount: { fontSize: 14, color: NAVY, fontWeight: "700" },
  scheduleMore: {
    marginTop: 8,
    fontSize: 12,
    color: MUTED,
    fontStyle: "italic",
    textAlign: "center",
  },

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

  termsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  termsHeaderText: { flex: 1, fontSize: 14, fontWeight: "600", color: NAVY },
  termsBody: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginTop: -1,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  termsParagraph: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 18,
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
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: BORDER },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
