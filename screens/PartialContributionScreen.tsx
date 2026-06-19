// ═══════════════════════════════════════════════════════════════════════════════
// PartialContributionScreen — Bucket A rewrite.
// ═══════════════════════════════════════════════════════════════════════════════
//
// Single-mode render: activation view when the user has no plan, tracking
// view when they do. The Activation/Tracking toggle is gone (the eligibility
// check blocks a second activation while one is active, so the toggle's
// "go back to activation" mode was meaningless).
//
// Data sources, all via hooks now (no direct supabase.rpc calls — those got
// retired with the engine rewrite):
//   * Preview     → usePreview                  → engine.preview()
//                                                → preview_partial_contribution RPC
//   * Activate    → usePartialContributionActions.activatePartialContribution
//                                                → engine.activate()
//                                                → activate_partial_contribution RPC
//   * Active plan → useActivePlan               (realtime via engine subscription)
//
// Cycle resolution: when navigator doesn't pass a cycleId, the first
// scheduled/collecting cycle is fetched on mount. The error message is now
// i18n'd (was a hardcoded English string).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  useActivePlan,
  usePreview,
  usePartialContributionActions,
} from "../hooks/usePartialContribution";

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

type RouteParams = { circleId: string; cycleId?: string };

// Bucket A: PreviewResult / PreviewEligibility / PreviewSummary /
// PreviewCoverage moved to PartialContributionEngine as
// PartialPreviewResult etc. The screen now reads them via usePreview().

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function PartialContributionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  // Defensive: route.params can be undefined if the caller navigates
  // without a circleId/cycleId. Fall back to empty so destructuring never throws.
  const { circleId, cycleId: paramCycleId } =
    route.params ?? ({} as RouteParams);
  const { user } = useAuth();

  // ── Cycle resolution ─────────────────────────────────────────────────────
  // If the navigator didn't pass a cycleId, look up the active cycle.
  const [resolvedCycleId, setResolvedCycleId] = useState<string | null>(
    paramCycleId ?? null,
  );
  const [cycleError, setCycleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (paramCycleId) {
      setResolvedCycleId(paramCycleId);
      setCycleError(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("circle_cycles")
        .select("id")
        .eq("circle_id", circleId)
        .in("cycle_status", ["collecting", "scheduled"])
        .order("cycle_number", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setCycleError(error.message);
      } else if (!data) {
        // Bucket A — was hardcoded English at this site.
        setCycleError(t("partial_contribution.error_no_active_cycle"));
      } else {
        setResolvedCycleId(data.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId, paramCycleId, t]);

  // ── Preview (eligibility + summary + coverage) via the engine wrapper ────
  const {
    preview,
    eligibility,
    summary,
    coverage,
    catchUpDates,
    loading: previewLoading,
    error: previewError,
    refetch: fetchPreview,
  } = usePreview(circleId, resolvedCycleId);
  void preview; // captured for future telemetry; lint-friendly placeholder.

  // ── Tracking (active plan + realtime via the existing hook) ──────────────
  const {
    plan,
    loading: planLoading,
    hasPlan,
    catchUpProgress,
    remainingAmount,
    refetch: refetchPlan,
  } = useActivePlan(user?.id, circleId);

  // ── Activate action via the engine wrapper ───────────────────────────────
  const { activatePartialContribution, activating } =
    usePartialContributionActions();
  const handleActivate = async () => {
    if (!resolvedCycleId) return;
    const result = await activatePartialContribution(circleId, resolvedCycleId);
    if (!result.success) {
      Alert.alert(
        t("partial_contribution.alert_could_not_activate"),
        result.error ?? t("partial_contribution.alert_unknown_error"),
      );
      return;
    }
    await Promise.all([fetchPreview(), refetchPlan()]);
  };

  // ── Cancel action (still uses the hook — engine cancelPlan is a clean
  // direct UPDATE on the table and works against prod) ─────────────────────
  const [cancelling, setCancelling] = useState(false);
  const handleCancel = () => {
    if (!plan?.id) return;
    Alert.alert(
      t("partial_contribution.cancel_alert_title"),
      t("partial_contribution.cancel_alert_body"),
      [
        { text: t("partial_contribution.no_button"), style: "cancel" },
        {
          text: t("partial_contribution.cancel_button"),
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              const { error } = await supabase
                .from("partial_contribution_plans")
                .update({
                  status: "cancelled",
                  completed_at: new Date().toISOString(),
                })
                .eq("id", plan.id);
              if (error) {
                Alert.alert(t("partial_contribution.alert_could_not_cancel"), error.message);
                return;
              }
              // Bucket A: viewMode dropped — the screen auto-flips back to
              // activation once hasPlan turns false from refetchPlan().
              await Promise.all([fetchPreview(), refetchPlan()]);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  // ── Refresh ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPreview(), refetchPlan()]);
    setRefreshing(false);
  }, [fetchPreview, refetchPlan]);

  // ── Derived UI state ─────────────────────────────────────────────────────
  const loading = previewLoading || planLoading;
  // Bucket A — drop showTracking + viewMode toggle. The two views are
  // mutually exclusive: render tracking when a plan exists, activation when
  // it doesn't. The previous toggle was always auto-flipped to tracking on
  // hasPlan anyway (eligibility blocks a second activation).
  const showTracking = hasPlan;

  // eligibility / summary / coverage / catchUpDates now come from usePreview.

  // ── Renderers ────────────────────────────────────────────────────────────

  if (cycleError) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("partial_contribution.header_title")}</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={28} color={COLORS.red} />
          <Text style={styles.errorText}>{cycleError}</Text>
        </View>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("partial_contribution.header_title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.teal}
          />
        }
      >
        {/* Bucket A: the Activation/Tracking toggle is gone. The page
            chooses based on hasPlan — see `showTracking` above. */}

        {previewError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
            <Text style={styles.errorBannerText}>{previewError}</Text>
          </View>
        )}

        {!showTracking ? (
          <>
            {/* Hero */}
            <View style={styles.card}>
              <View style={styles.heroContent}>
                <View style={styles.heroIcon}>
                  <Ionicons name="calendar-outline" size={32} color={COLORS.teal} />
                </View>
                <Text style={styles.heroTitle}>{t("partial_contribution.hero_title")}</Text>
                <Text style={styles.heroSubtitle}>
                  {t("partial_contribution.hero_subtitle")}
                </Text>
              </View>
            </View>

            {/* Eligibility */}
            {eligibility && (
              <View style={styles.card}>
                <View style={styles.eligibilityRow}>
                  <Ionicons
                    name={eligibility.eligible ? "checkmark-circle" : "close-circle"}
                    size={24}
                    color={eligibility.eligible ? COLORS.green : COLORS.red}
                  />
                  <View style={styles.eligibilityText}>
                    <Text style={styles.eligibilityTitle}>
                      {eligibility.eligible
                        ? t("partial_contribution.eligible")
                        : t("partial_contribution.not_available")}
                    </Text>
                    <Text style={styles.mutedText}>
                      {eligibility.uses_this_year === 0
                        ? t("partial_contribution.first_use_free")
                        : t("partial_contribution.fee_applies", {
                            count: eligibility.uses_this_year,
                          })}
                    </Text>
                    {!eligibility.eligible && eligibility.reason ? (
                      <Text style={[styles.mutedText, { color: COLORS.red }]}>
                        {eligibility.reason}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            )}

            {/* Payment Breakdown */}
            {summary && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t("partial_contribution.section_breakdown")}</Text>

                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.dot, { backgroundColor: COLORS.teal }]} />
                    <View>
                      <Text style={styles.breakdownLabel}>
                        {t("partial_contribution.pay_now")}
                      </Text>
                      <Text style={styles.mutedText}>{t("partial_contribution.due_today")}</Text>
                    </View>
                  </View>
                  <Text style={styles.breakdownAmount}>
                    {formatCents(summary.pay_now_cents)}
                  </Text>
                </View>

                {catchUpDates.map((catchUp, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: i === 0 ? COLORS.yellow : COLORS.orange },
                        ]}
                      />
                      <View>
                        <Text style={styles.breakdownLabel}>
                          {i === 0
                            ? t("partial_contribution.catch_up_1")
                            : t("partial_contribution.catch_up_2")}
                        </Text>
                        <Text style={styles.mutedText}>
                          {t("partial_contribution.catch_up_cycle_date", {
                            cycle: catchUp.cycleNumber,
                            date: catchUp.date,
                          })}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.breakdownAmount}>
                      {formatCents(catchUp.amountCents)}
                    </Text>
                  </View>
                ))}

                <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.mutedText}>{t("partial_contribution.original_amount")}</Text>
                  <Text
                    style={[
                      styles.breakdownAmount,
                      styles.strikethrough,
                      { color: COLORS.muted },
                    ]}
                  >
                    {formatCents(summary.original_amount_cents)}
                  </Text>
                </View>
              </View>
            )}

            {/* What happens */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t("partial_contribution.what_happens_title")}
              </Text>
              {[
                { icon: "shield-checkmark" as const, key: "bullet_1" },
                { icon: "star" as const, key: "bullet_2" },
                { icon: "eye-off" as const, key: "bullet_3" },
                { icon: "calendar" as const, key: "bullet_4" },
              ].map((item, i) => (
                <View key={i} style={styles.infoRow}>
                  <Ionicons name={item.icon} size={20} color={COLORS.green} />
                  <Text style={styles.infoText}>
                    {t(`partial_contribution.${item.key}`)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Coverage detail */}
            {coverage && coverage.coverage_status !== "no_pool" && summary && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t("partial_contribution.section_insurance")}</Text>
                <View style={styles.row}>
                  <Text style={styles.mutedText}>{t("partial_contribution.shortfall")}</Text>
                  <Text style={styles.value}>
                    {formatCents(coverage.shortfall_cents)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.mutedText}>{t("partial_contribution.pool_will_honor")}</Text>
                  <Text
                    style={[
                      styles.value,
                      coverage.coverage_status === "covered_full" && {
                        color: COLORS.green,
                      },
                      coverage.coverage_status === "covered_partial" && {
                        color: COLORS.yellow,
                      },
                      coverage.coverage_status === "no_balance" && {
                        color: COLORS.red,
                      },
                    ]}
                  >
                    {formatCents(coverage.approved_cents)}{" "}
                    ({t(`partial_contribution.coverage_status_${coverage.coverage_status}`)})
                  </Text>
                </View>
              </View>
            )}

            {/* Fee notice */}
            {eligibility?.fee_required && (
              <View style={styles.feeNotice}>
                <Ionicons name="pricetag" size={20} color={COLORS.orange} />
                <Text style={styles.feeText}>
                  {t("partial_contribution.fee_notice", {
                    amount: (eligibility.fee_cents / 100).toFixed(2),
                  })}
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!eligibility?.eligible || activating) && styles.disabledButton,
              ]}
              disabled={!eligibility?.eligible || activating || !summary}
              onPress={handleActivate}
            >
              {activating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {summary
                    ? t("partial_contribution.activate_button", {
                        amount: formatCents(summary.pay_now_cents),
                      })
                    : t("partial_contribution.activate_button_no_amount")}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryButtonText}>
                {t("partial_contribution.pay_full_button")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {plan && (
              <View style={styles.card}>
                <View style={styles.planStatusRow}>
                  <View style={styles.planStatusIcon}>
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.planStatusText, { color: COLORS.teal }]}>
                    {t("partial_contribution.badge_active")}
                  </Text>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${catchUpProgress.percentage}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text
                      style={[
                        styles.smallText,
                        { color: COLORS.teal, fontWeight: "600" },
                      ]}
                    >
                      {t("partial_contribution.progress_paid", {
                        paid: catchUpProgress.paid,
                        total: catchUpProgress.total,
                      })}
                    </Text>
                    <Text style={styles.mutedText}>
                      {t("partial_contribution.progress_remaining", {
                        amount: remainingAmount.toFixed(2),
                      })}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                  {t("partial_contribution.catch_up_schedule_title")}
                </Text>
                {plan.catchUpSchedule?.map((item: any, i: number) => (
                  <View key={i} style={styles.catchUpRow}>
                    <View
                      style={[
                        styles.catchUpIcon,
                        {
                          backgroundColor:
                            item.status === "paid"
                              ? `${COLORS.green}20`
                              : item.status === "defaulted"
                                ? `${COLORS.red}20`
                                : `${COLORS.yellow}20`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.status === "paid"
                            ? "checkmark"
                            : item.status === "defaulted"
                              ? "close"
                              : "time"
                        }
                        size={16}
                        color={
                          item.status === "paid"
                            ? COLORS.green
                            : item.status === "defaulted"
                              ? COLORS.red
                              : COLORS.yellow
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catchUpLabel}>
                        {t("partial_contribution.cycle_label", {
                          cycle: item.cycleNumber,
                        })}
                      </Text>
                      <Text style={styles.mutedText}>{item.dueDate}</Text>
                    </View>
                    <Text style={styles.catchUpAmount}>
                      {formatCents(item.amountCents)}
                    </Text>
                    <Text
                      style={[
                        styles.catchUpStatus,
                        {
                          color:
                            item.status === "paid"
                              ? COLORS.green
                              : item.status === "defaulted"
                                ? COLORS.red
                                : COLORS.yellow,
                        },
                      ]}
                    >
                      {t(`partial_contribution.item_status_${item.status}`)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <Text style={styles.cancelButtonText}>
                  {t("partial_contribution.cancel_plan_button")}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 8, borderRadius: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  toggleContainer: { alignItems: "center", marginBottom: 16 },
  toggleWrapper: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: COLORS.teal },
  toggleText: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  toggleTextActive: { color: "#FFF" },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },

  heroContent: { alignItems: "center", paddingVertical: 16 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.teal}15`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: "700", color: COLORS.navy, marginBottom: 8 },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    maxWidth: 300,
  },

  eligibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  eligibilityText: { flex: 1 },
  eligibilityTitle: { fontSize: 15, fontWeight: "600", color: COLORS.navy },

  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 12 },

  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  breakdownLabel: { fontSize: 14, fontWeight: "500", color: COLORS.navy },
  breakdownAmount: { fontSize: 17, fontWeight: "700", color: COLORS.navy },
  strikethrough: { textDecorationLine: "line-through" },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  value: { fontSize: 13, fontWeight: "600", color: COLORS.navy },
  mutedText: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  smallText: { fontSize: 13 },

  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  infoText: { flex: 1, fontSize: 13, color: COLORS.muted, lineHeight: 18 },

  feeNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: `${COLORS.orange}15`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  feeText: { fontSize: 13, fontWeight: "600", color: COLORS.orange },

  primaryButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  disabledButton: { backgroundColor: "#D1D5DB" },
  primaryButtonText: { fontSize: 15, fontWeight: "700", color: "#FFF" },

  secondaryButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "600", color: COLORS.navy },

  planStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  planStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.teal}15`,
    justifyContent: "center",
    alignItems: "center",
  },
  planStatusText: { fontSize: 15, fontWeight: "700" },

  progressContainer: { marginBottom: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: COLORS.teal, borderRadius: 4 },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  catchUpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  catchUpIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  catchUpLabel: { fontSize: 14, fontWeight: "500", color: COLORS.navy },
  catchUpAmount: { fontSize: 15, fontWeight: "700", color: COLORS.navy },
  catchUpStatus: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    width: 80,
    textAlign: "right",
  },

  cancelButton: {
    backgroundColor: `${COLORS.red}15`,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  cancelButtonText: { fontSize: 15, fontWeight: "600", color: COLORS.red },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorBannerText: { flex: 1, fontSize: 13, color: COLORS.red },
  errorBox: {
    alignItems: "center",
    margin: 16,
    padding: 24,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.navy,
    textAlign: "center",
    lineHeight: 20,
  },
});
