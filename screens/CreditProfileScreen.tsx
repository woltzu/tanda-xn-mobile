// ══════════════════════════════════════════════════════════════════════════════
// screens/CreditProfileScreen.tsx — User's credit history + loan eligibility
// ══════════════════════════════════════════════════════════════════════════════
//
// Bucket A of the Credit Profile review (2026-06-20). The legacy screen was
// titled "Credit Profile" but functionally rendered only eligibility data
// (assessments + eligible products). The user's actual loan history (real
// `loans` / `loan_applications` / `loan_payments` rows) was unreachable.
//
// This version is the canonical loan-history surface and keeps the eligibility
// card intact at the top as the action surface for applying for new loans.
//
// Sections, top to bottom:
//   1. Eligibility card        — score, max loan, max advance, approval %
//   2. Default recovery row    — conditional (defaults / late contributions)
//   3. Summary card            — Borrowed / Repaid / Outstanding / Defaults
//   4. My loans                — list from public.loans, tap → LoanDetails
//   5. Upcoming payments       — next 3 from loan_payment_schedule
//   6. Eligible products       — apply-for-new-loan section
//   7. Footer links            — full credit report, XnScore explainer
//
// Removed (duplicated elsewhere in XnScore Dashboard):
//   - Assessment Breakdown dimensions
//   - "How to Improve" tip list
//
// Header (?) is wired to a localized Alert placeholder; Bucket B will replace
// with a HelpSheet (5 topics).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  useLatestValidAssessment,
  useEligibleLoanProducts,
  useCreditScore,
  useCanApplyForLoans,
} from "../hooks/useCreditworthiness";
import { useUserDefaults } from "../hooks/useDefaultCascade";
import { useLateContributions } from "../hooks/useLateContributions";
import {
  useLoanProfile,
  LoanProfileLoan,
  LoanStatus,
  UpcomingPayment,
} from "../hooks/useLoanProfile";
import { Routes } from "../lib/routes";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  bg: "#F5F7FA",
  white: "#FFFFFF",
  muted: "#6B7280",
  border: "#E5E7EB",
};

const getTierColor = (tier: string) => {
  switch (tier) {
    case "excellent": return COLORS.green;
    case "good": return COLORS.teal;
    case "fair": return COLORS.yellow;
    default: return COLORS.red;
  }
};

const PRODUCT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  salary_advance: "flash",
  circle_loan: "cash",
  emergency_fund: "medkit",
  business_micro_loan: "briefcase",
};

const STATUS_PILL_COLOR: Record<LoanStatus, { fg: string; bg: string }> = {
  active:         { fg: "#065F46", bg: "#D1FAE5" },
  paid_off:       { fg: "#374151", bg: "#F3F4F6" },
  defaulted:      { fg: "#991B1B", bg: "#FEE2E2" },
  in_collections: { fg: "#991B1B", bg: "#FEE2E2" },
  written_off:    { fg: "#6B7280", bg: "#E5E7EB" },
};

const formatCents = (c: number) => `$${(c / 100).toLocaleString()}`;

function formatShortDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

export default function CreditProfileScreen() {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const {
    data: assessment,
    isLoading: assessmentLoading,
    refetch: refetchAssessment,
  } = useLatestValidAssessment(user?.id);

  const {
    data: eligibleProducts,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useEligibleLoanProducts(user?.id);

  const creditScore = useCreditScore(assessment?.xn_score);
  const { hasActiveDefaults } = useUserDefaults();
  const { lateContributions } = useLateContributions();
  const hasRecoveryItems = hasActiveDefaults || lateContributions.length > 0;
  const { canApply, reason: applyReason } = useCanApplyForLoans(user?.id);

  const {
    summary,
    loans,
    upcomingPayments,
    hasLoans,
    hasUpcoming,
    loading: loanProfileLoading,
    refresh: refreshLoanProfile,
  } = useLoanProfile(user?.id);

  const loading = assessmentLoading || productsLoading || loanProfileLoading;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAssessment(), refetchProducts(), refreshLoanProfile()]);
    setRefreshing(false);
  }, [refetchAssessment, refetchProducts, refreshLoanProfile]);

  const handleHelpPress = useCallback(() => {
    Alert.alert(
      t("credit_profile.help_placeholder_title"),
      t("credit_profile.help_placeholder_body"),
    );
  }, [t]);

  const handleStatHelp = useCallback(
    (kind: "borrowed" | "repaid" | "outstanding" | "defaults") => {
      Alert.alert(
        t(`credit_profile.summary_${kind}`),
        t("credit_profile.help_placeholder_body"),
      );
    },
    [t],
  );

  const handleLoanPress = useCallback(
    (loan: LoanProfileLoan) => {
      navigation.navigate(Routes.LoanDetails, { loanId: loan.id });
    },
    [navigation],
  );

  const handlePayNow = useCallback(
    (payment: UpcomingPayment) => {
      // Pay-now screen lands in Bucket B; for Bucket A surface a localized
      // placeholder so the affordance is discoverable today.
      Alert.alert(
        t("credit_profile.pay_now"),
        t("credit_profile.help_placeholder_body"),
      );
    },
    [t],
  );

  if (loading && !refreshing && !hasLoans) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  const score = creditScore?.score ?? assessment?.credit_score ?? 0;
  const tier = creditScore?.tier ?? assessment?.risk_grade ?? "fair";
  const tierColor = getTierColor(tier);
  const maxLoan = assessment?.approved_amount_cents ?? 0;
  const maxAdvance = assessment?.max_advance_cents ?? 0;
  const approvalPct = assessment?.approval_likelihood ?? 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("credit_profile.header_title")}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleHelpPress}
          accessibilityRole="button"
          accessibilityLabel={t("credit_profile.help_button_a11y")}
        >
          <Ionicons name="help-circle-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {/* ── 1. Eligibility Card ──────────────────────────────────── */}
        <View style={[styles.card, styles.scoreCard]}>
          <Text style={styles.scoreNumber}>{score}</Text>
          <Text style={[styles.tierLabel, { color: tierColor }]}>
            {String(tier).toUpperCase()}
          </Text>
          <Text style={styles.mutedText}>{t("credit_profile.muted_text")}</Text>

          <View style={styles.limitsRow}>
            <View style={styles.limitCol}>
              <Text style={styles.limitValue}>{formatCents(maxLoan)}</Text>
              <Text style={styles.limitLabel}>{t("credit_profile.limit_max_loan")}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.limitCol}>
              <Text style={styles.limitValue}>{formatCents(maxAdvance)}</Text>
              <Text style={styles.limitLabel}>{t("credit_profile.limit_max_advance")}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.limitCol}>
              <Text style={[styles.limitValue, { color: COLORS.green }]}>{approvalPct}%</Text>
              <Text style={styles.limitLabel}>{t("credit_profile.limit_approval")}</Text>
            </View>
          </View>
        </View>

        {/* ── 2. Default Recovery (conditional) ────────────────────── */}
        {hasRecoveryItems && (
          <TouchableOpacity
            style={styles.recoveryRow}
            onPress={() => navigation.navigate(Routes.DefaultRecovery)}
            accessibilityRole="button"
            accessibilityLabel={t("credit_profile.recovery_title")}
          >
            <View style={styles.recoveryRowIcon}>
              <Ionicons name="warning" size={18} color={COLORS.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recoveryRowTitle}>{t("credit_profile.recovery_title")}</Text>
              <Text style={styles.recoveryRowSubtitle}>
                {hasActiveDefaults
                  ? t("credit_profile.recovery_subtitle_defaults")
                  : t("credit_profile.recovery_subtitle_late")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        {/* ── 3. Summary Card ──────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t("credit_profile.section_summary")}</Text>
        <View style={styles.card}>
          <View style={styles.summaryGrid}>
            <SummaryStat
              label={t("credit_profile.summary_borrowed")}
              value={formatCents(summary.totalBorrowedCents)}
              color={COLORS.navy}
              onHelp={() => handleStatHelp("borrowed")}
              tHelpA11y={t("credit_profile.stat_help_a11y")}
            />
            <SummaryStat
              label={t("credit_profile.summary_repaid")}
              value={formatCents(summary.totalRepaidCents)}
              color={COLORS.green}
              onHelp={() => handleStatHelp("repaid")}
              tHelpA11y={t("credit_profile.stat_help_a11y")}
            />
            <SummaryStat
              label={t("credit_profile.summary_outstanding")}
              value={formatCents(summary.totalOutstandingCents)}
              color={COLORS.orange}
              onHelp={() => handleStatHelp("outstanding")}
              tHelpA11y={t("credit_profile.stat_help_a11y")}
            />
            <SummaryStat
              label={t("credit_profile.summary_defaults")}
              value={String(summary.defaultCount)}
              color={summary.defaultCount > 0 ? COLORS.red : COLORS.muted}
              onHelp={() => handleStatHelp("defaults")}
              tHelpA11y={t("credit_profile.stat_help_a11y")}
            />
          </View>
        </View>

        {/* ── 4. My Loans ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t("credit_profile.section_my_loans")}</Text>
        {hasLoans ? (
          loans.map((loan) => {
            const pill = STATUS_PILL_COLOR[loan.status] ?? STATUS_PILL_COLOR.active;
            const progressPct =
              loan.paymentsTotal > 0
                ? Math.round((loan.paymentsMade / loan.paymentsTotal) * 100)
                : 0;
            return (
              <TouchableOpacity
                key={loan.id}
                style={styles.card}
                onPress={() => handleLoanPress(loan)}
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <View style={styles.loanHeaderRow}>
                  <Text style={styles.loanPrincipal}>{formatCents(loan.principalCents)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusPillText, { color: pill.fg }]}>
                      {t(`credit_profile.loan_status_${loan.status}`)}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPct}%`, backgroundColor: loan.isDelinquent ? COLORS.red : COLORS.teal },
                    ]}
                  />
                </View>
                <View style={styles.loanMetaRow}>
                  <Text style={styles.mutedText}>
                    {loan.paymentsMade} / {loan.paymentsTotal}
                    {loan.paymentsTotal > 0 ? ` (${progressPct}%)` : ""}
                  </Text>
                  {loan.nextPaymentDate && loan.status === "active" ? (
                    <Text style={styles.mutedText}>
                      {t("credit_profile.payment_due")} {formatShortDate(loan.nextPaymentDate, i18n.language)}
                    </Text>
                  ) : loan.closedAt ? (
                    <Text style={styles.mutedText}>
                      {t("credit_profile.closed_at")} {formatShortDate(loan.closedAt, i18n.language)}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="cash-outline" size={28} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>{t("credit_profile.empty_loans_title")}</Text>
            <Text style={styles.emptyBody}>{t("credit_profile.empty_loans_body")}</Text>
          </View>
        )}

        {/* ── 5. Upcoming Payments ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t("credit_profile.section_upcoming_payments")}</Text>
        {hasUpcoming ? (
          upcomingPayments.map((p) => (
            <View key={p.scheduleId ?? `${p.loanId}-${p.dueDate}`} style={styles.card}>
              <View style={styles.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentAmount}>{formatCents(p.amountCents)}</Text>
                  <Text style={styles.mutedText}>
                    {t("credit_profile.payment_due")} {formatShortDate(p.dueDate, i18n.language)}
                    {p.paymentNumber ? ` · #${p.paymentNumber}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.payNowBtn}
                  onPress={() => handlePayNow(p)}
                  accessibilityRole="button"
                >
                  <Text style={styles.payNowText}>{t("credit_profile.pay_now")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCardCompact}>
            <Text style={styles.emptyBody}>{t("credit_profile.empty_payments_title")}</Text>
          </View>
        )}

        {/* ── 6. Eligible Products ─────────────────────────────────── */}
        {eligibleProducts && eligibleProducts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t("credit_profile.section_products")}</Text>
            {eligibleProducts.map((product: any, i: number) => {
              const isEligible = product.is_eligible !== false;
              const iconName = PRODUCT_ICONS[product.code] ?? "cash";
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.productRow}>
                    <View
                      style={[
                        styles.productIcon,
                        { backgroundColor: isEligible ? `${COLORS.teal}15` : COLORS.bg },
                      ]}
                    >
                      <Ionicons
                        name={iconName}
                        size={20}
                        color={isEligible ? COLORS.teal : COLORS.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.mutedText}>
                        {isEligible
                          ? `Up to ${formatCents(product.max_amount_cents ?? 0)}`
                          : product.ineligibility_reason ?? t("credit_profile.alert_not_eligible")}
                      </Text>
                    </View>
                    {isEligible ? (
                      <TouchableOpacity
                        style={styles.applyBtn}
                        onPress={() => {
                          if (canApply) {
                            navigation.navigate("LoanApplication", { productId: product.id });
                          } else {
                            Alert.alert(
                              t("credit_profile.alert_cannot_apply_title"),
                              applyReason ?? t("credit_profile.alert_not_eligible"),
                            );
                          }
                        }}
                      >
                        <Text style={styles.applyBtnText}>{t("credit_profile.btn_apply")}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.lockedRow}>
                        <Ionicons name="lock-closed" size={12} color={COLORS.muted} />
                        <Text style={styles.lockedText}>{t("credit_profile.tag_locked")}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── 7. Footer links ──────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => navigation.navigate(Routes.CreditReport)}
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={16} color={COLORS.teal} />
          <Text style={styles.footerLinkText}>{t("credit_profile.section_view_full_report")}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.teal} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => navigation.navigate(Routes.XnScoreDashboard)}
          accessibilityRole="button"
        >
          <Ionicons name="trending-up-outline" size={16} color={COLORS.teal} />
          <Text style={styles.footerLinkText}>{t("credit_profile.section_how_score_uses")}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.teal} />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SummaryStat({
  label,
  value,
  color,
  onHelp,
  tHelpA11y,
}: {
  label: string;
  value: string;
  color: string;
  onHelp: () => void;
  tHelpA11y: string;
}) {
  return (
    <View style={styles.summaryStat}>
      <View style={styles.summaryStatLabelRow}>
        <Text style={styles.summaryStatLabel}>{label}</Text>
        <TouchableOpacity
          onPress={onHelp}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={tHelpA11y}
        >
          <Ionicons name="information-circle-outline" size={14} color={COLORS.muted} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.summaryStatValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  scoreCard: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    marginTop: -8,
    shadowOpacity: 0.1,
    elevation: 4,
  },

  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 12, marginTop: 12 },
  mutedText: { fontSize: 13, color: COLORS.muted },

  // Score
  scoreNumber: { fontSize: 56, fontWeight: "800", color: COLORS.navy },
  tierLabel: { fontSize: 14, fontWeight: "700", letterSpacing: 2, marginTop: 2 },

  // Limits
  limitsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 20,
    paddingTop: 16,
  },
  limitCol: { alignItems: "center" },
  limitValue: { fontSize: 17, fontWeight: "700", color: COLORS.navy },
  limitLabel: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: COLORS.border },

  // Recovery row
  recoveryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.red + "33",
    gap: 12,
    marginBottom: 12,
  },
  recoveryRowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.red + "15",
    alignItems: "center", justifyContent: "center",
  },
  recoveryRowTitle: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  recoveryRowSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  // Summary
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  summaryStat: {
    width: "50%",
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  summaryStatLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryStatLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 0.4, textTransform: "uppercase" },
  summaryStatValue: { fontSize: 20, fontWeight: "800", marginTop: 4 },

  // Loan rows
  loanHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  loanPrincipal: { fontSize: 16, fontWeight: "700", color: COLORS.navy },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  loanMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  emptyCardCompact: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: COLORS.navy, marginTop: 4 },
  emptyBody: { fontSize: 12, color: COLORS.muted, textAlign: "center", lineHeight: 17 },

  // Upcoming payments
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  paymentAmount: { fontSize: 16, fontWeight: "700", color: COLORS.navy },
  payNowBtn: {
    backgroundColor: COLORS.teal,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  payNowText: { fontSize: 13, fontWeight: "700", color: "#FFF" },

  // Products
  productRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  productIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  productName: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  applyBtn: { backgroundColor: COLORS.teal, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  applyBtnText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  lockedText: { fontSize: 12, color: COLORS.muted },

  // Footer
  footerLink: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footerLinkText: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.teal },
});
