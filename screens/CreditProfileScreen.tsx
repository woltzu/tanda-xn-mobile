// ══════════════════════════════════════════════════════════════════════════════
// screens/CreditProfileScreen.tsx — User's credit history + loan eligibility
// ══════════════════════════════════════════════════════════════════════════════
//
// Bucket A (2026-06-20) replaced the legacy eligibility-only render with the
// canonical loan-history surface: summary stats, my loans list, upcoming
// payments, plus the eligibility/apply card kept on top as the action surface.
//
// Bucket B (2026-06-20) adds:
//   - HelpSheet (5 topics) replacing the header-(?) Alert placeholder
//   - First-visit coach mark gated by @tandaxn_credit_profile_coach_seen_v1
//   - StatExplainerSheet — per-stat (?) on Borrowed / Repaid / Outstanding / Defaults
//   - StatusExplainerSheet — tappable loan-row status pill explainers
//   - Rich empty-state CTA on "My loans" — surfaces max loan amount and jumps
//     to the eligible-products section
//
// All explainer sheets reuse the bottom-sheet shared styles (sheetStyles)
// established by the Mood / AI Insights buckets.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// Bucket B — AsyncStorage gate for the first-visit coach mark.
// Versioned so we can re-prompt every user if the copy ever shifts.
const COACH_KEY = "@tandaxn_credit_profile_coach_seen_v1";

// Bucket B — HelpSheet topics. Five anchors: what / outstanding / default
// definition / payment-schedule rules / dispute path.
type HelpTopic =
  | "what_is_credit_profile"
  | "how_outstanding"
  | "what_is_default"
  | "payment_schedule"
  | "dispute_payment";
const HELP_TOPICS: HelpTopic[] = [
  "what_is_credit_profile",
  "how_outstanding",
  "what_is_default",
  "payment_schedule",
  "dispute_payment",
];

type StatKey = "borrowed" | "repaid" | "outstanding" | "defaults";

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

  const scrollRef = useRef<ScrollView | null>(null);
  const productsAnchorY = useRef(0);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAssessment(), refetchProducts(), refreshLoanProfile()]);
    setRefreshing(false);
  }, [refetchAssessment, refetchProducts, refreshLoanProfile]);

  // ── Bucket B — modal + coach state ──────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const [statExplainer, setStatExplainer] = useState<StatKey | null>(null);
  const [statusExplainer, setStatusExplainer] = useState<LoanStatus | null>(null);

  // First-visit coach mark. Same Animated.Value + useRef gate pattern as
  // prior buckets. Auto-dismiss after 4 s or on tap.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_KEY);
        if (seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      } catch {
        // AsyncStorage unavailable — silently skip.
      }
    })();
  }, [coachOpacity]);
  const dismissCoach = useCallback(() => {
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(COACH_KEY, "1").catch(() => undefined);
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleHelpPress = useCallback(() => {
    setHelpOpen(true);
  }, []);

  const handleStatHelp = useCallback((kind: StatKey) => {
    setStatExplainer(kind);
  }, []);

  const handleStatusPress = useCallback((status: LoanStatus) => {
    setStatusExplainer(status);
  }, []);

  const handleLoanPress = useCallback(
    (loan: LoanProfileLoan) => {
      navigation.navigate(Routes.LoanDetails, { loanId: loan.id });
    },
    [navigation],
  );

  const handlePayNow = useCallback(
    (_payment: UpcomingPayment) => {
      // Pay-now screen lands in a later bucket; for now surface a localized
      // placeholder so the affordance is discoverable today.
      Alert.alert(
        t("credit_profile.pay_now"),
        t("credit_profile.help_placeholder_body"),
      );
    },
    [t],
  );

  // Empty-state CTA — either jump straight into LoanApplication with the
  // first eligible product, or scroll to the products section so the user
  // can pick one.
  const firstEligibleProduct = (eligibleProducts ?? []).find(
    (p: any) => p.is_eligible !== false,
  );
  const handleEmptyApply = useCallback(() => {
    if (firstEligibleProduct && canApply) {
      navigation.navigate("LoanApplication", { productId: firstEligibleProduct.id });
      return;
    }
    if (scrollRef.current && productsAnchorY.current > 0) {
      scrollRef.current.scrollTo({ y: productsAnchorY.current - 12, animated: true });
      return;
    }
    Alert.alert(
      t("credit_profile.alert_cannot_apply_title"),
      applyReason ?? t("credit_profile.alert_not_eligible"),
    );
  }, [firstEligibleProduct, canApply, navigation, t, applyReason]);

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
        ref={scrollRef}
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
                  {/* Status pill — tappable in Bucket B. stopPropagation
                      avoids triggering the parent row navigation. */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleStatusPress(loan.status);
                    }}
                    style={[styles.statusPill, { backgroundColor: pill.bg }]}
                    accessibilityRole="button"
                    accessibilityLabel={t(`credit_profile.loan_status_${loan.status}`)}
                  >
                    <Text style={[styles.statusPillText, { color: pill.fg }]}>
                      {t(`credit_profile.loan_status_${loan.status}`)}
                    </Text>
                    <Ionicons
                      name="information-circle-outline"
                      size={11}
                      color={pill.fg}
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
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
          <View style={styles.emptyCtaCard}>
            <Ionicons name="cash-outline" size={32} color={COLORS.teal} />
            <Text style={styles.emptyCtaTitle}>
              {t("credit_profile.empty_loans_with_cta_title")}
            </Text>
            <Text style={styles.emptyCtaBody}>
              {t("credit_profile.empty_loans_with_cta_body", {
                amount: formatCents(maxLoan),
              })}
            </Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={handleEmptyApply}
              accessibilityRole="button"
            >
              <Text style={styles.emptyCtaBtnText}>
                {t("credit_profile.empty_loans_with_cta_button")}
              </Text>
            </TouchableOpacity>
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
          <View
            onLayout={(e) => {
              // Capture absolute Y so the empty-state CTA can scroll here.
              productsAnchorY.current = e.nativeEvent.layout.y;
            }}
          >
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
          </View>
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

      {/* Bucket B — modals + coach mark. Sibling to ScrollView so they sit
          above content but inside the screen's root View. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />
      <StatExplainerSheet
        statKey={statExplainer}
        onClose={() => setStatExplainer(null)}
        t={t}
      />
      <StatusExplainerSheet
        status={statusExplainer}
        onClose={() => setStatusExplainer(null)}
        t={t}
      />
      {coachVisible ? (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.coachBackdrop} onPress={dismissCoach}>
            <View style={styles.coachCard}>
              <Ionicons name="bulb-outline" size={20} color="#FBBF24" />
              <Text style={styles.coachText}>
                {t("credit_profile.coach_tip")}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

type TFn = (key: string, opts?: any) => string;

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

// Bucket B — HelpSheet. Five topics, each a localized title + body block.
// Modal slides from bottom; backdrop tap dismisses.
function HelpSheet({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: TFn;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <Text style={sheetStyles.title}>{t("credit_profile.help_sheet_title")}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("credit_profile.help_close")}
            >
              <Ionicons name="close" size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={sheetStyles.scroll}>
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={sheetStyles.helpItem}>
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`credit_profile.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.helpItemBody}>
                  {t(`credit_profile.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Bucket B — per-summary-stat explainer. One sheet per stat key.
function StatExplainerSheet({
  statKey,
  onClose,
  t,
}: {
  statKey: StatKey | null;
  onClose: () => void;
  t: TFn;
}) {
  if (!statKey) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <Text style={sheetStyles.title}>
              {t(`credit_profile.summary_${statKey}`)}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("credit_profile.help_close")}
            >
              <Ionicons name="close" size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
          <Text style={sheetStyles.explainerBody}>
            {t(`credit_profile.tooltip_${statKey}`)}
          </Text>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>{t("credit_profile.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Bucket B — per-loan-status explainer. Title resolves from existing
// loan_status_<status> key; body from status_explainer_<status>_body.
function StatusExplainerSheet({
  status,
  onClose,
  t,
}: {
  status: LoanStatus | null;
  onClose: () => void;
  t: TFn;
}) {
  if (!status) return null;
  const pill = STATUS_PILL_COLOR[status] ?? STATUS_PILL_COLOR.active;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[sheetStyles.headerPill, { backgroundColor: pill.bg }]}>
                <Text style={[sheetStyles.headerPillText, { color: pill.fg }]}>
                  {t(`credit_profile.loan_status_${status}`)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("credit_profile.help_close")}
            >
              <Ionicons name="close" size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
          <Text style={sheetStyles.explainerBody}>
            {t(`credit_profile.status_explainer_${status}_body`)}
          </Text>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>{t("credit_profile.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  statusPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  loanMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },

  // Empty states (unchanged compact card for upcoming-payments empty)
  emptyCardCompact: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  emptyBody: { fontSize: 12, color: COLORS.muted, textAlign: "center", lineHeight: 17 },

  // Bucket B — rich empty-state CTA card for "My loans"
  emptyCtaCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.teal + "55",
  },
  emptyCtaTitle: { fontSize: 16, fontWeight: "700", color: COLORS.navy, marginTop: 4, textAlign: "center" },
  emptyCtaBody: { fontSize: 13, color: COLORS.muted, textAlign: "center", lineHeight: 19, paddingHorizontal: 8 },
  emptyCtaBtn: {
    marginTop: 12,
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyCtaBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },

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

  // Coach mark
  coachOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
  },
  coachBackdrop: {
    flex: 1,
    alignItems: "center",
    paddingTop: 160,
    paddingHorizontal: 24,
  },
  coachCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15,23,42,0.96)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    maxWidth: 320,
  },
  coachText: { flex: 1, fontSize: 13, color: "#FFF", lineHeight: 18 },
});

// Bucket B — bottom-sheet shared styles (HelpSheet + StatExplainer + StatusExplainer).
const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
    maxHeight: "86%",
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  headerPillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  title: { fontSize: 17, fontWeight: "700", color: COLORS.navy },
  scroll: { maxHeight: 500 },
  helpItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  helpItemTitle: { fontSize: 14, fontWeight: "700", color: COLORS.navy, marginBottom: 4 },
  helpItemBody: { fontSize: 13, color: "#4B5563", lineHeight: 19 },
  explainerBody: { fontSize: 13, color: "#4B5563", lineHeight: 19, marginBottom: 14 },
  closeBtn: { borderRadius: 12, alignItems: "center", paddingVertical: 14, backgroundColor: "#F1F5F9" },
  closeBtnText: { color: COLORS.navy, fontSize: 14, fontWeight: "600" },
});
