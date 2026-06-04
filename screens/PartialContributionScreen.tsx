// ═══════════════════════════════════════════════════════════════════════════════
// PartialContributionScreen — Phase D2 of feat(partial)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Activation flow + tracking flow for the 50/25/25 partial-contribution plan.
//
// Data sources after D2:
//   * Preview     → preview_partial_contribution RPC      (migration 102)
//   * Activate    → activate_partial_contribution RPC     (migration 102)
//   * Active plan → useActivePlan hook (direct table read works against prod)
//
// The hook layer that wraps the broken TS engine (useActivationSummary,
// usePartialContributionActions.activatePartialContribution) is bypassed —
// those go through methods that hit the column-name and schema bugs flagged
// in the migration 102 header. The hook surface for the tracking view
// (useActivePlan) stays as-is because it's a clean direct query on
// partial_contribution_plans.
//
// Route param `cycleId` is optional: when not provided (e.g. when the user
// arrives from MakeContributionScreen which doesn't know real cycle UUIDs)
// the screen resolves the active cycle from circle_cycles on mount.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useActivePlan } from "../hooks/usePartialContribution";

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

interface PreviewSummary {
  current_contribution_id: string;
  original_amount_cents: number;
  pay_now_cents: number;
  catch_up_1_cents: number;
  catch_up_1_due: string;
  catch_up_1_cycle_number: number;
  catch_up_2_cents: number;
  catch_up_2_due: string;
  catch_up_2_cycle_number: number;
  regular_contribution_cents: number;
  total_next_cycle_cents: number;
  total_cycle_after_cents: number;
}

interface PreviewEligibility {
  eligible: boolean;
  reason: string | null;
  uses_this_year: number;
  fee_required: boolean;
  fee_cents: number;
}

interface PreviewCoverage {
  pool_id: string | null;
  pool_balance_cents: number;
  shortfall_cents: number;
  approved_cents: number;
  coverage_status: "covered_full" | "covered_partial" | "no_balance" | "no_pool";
}

interface PreviewResult {
  success: boolean;
  eligibility: PreviewEligibility;
  summary?: PreviewSummary;
  coverage_preview?: PreviewCoverage;
  error?: string;
}

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function PartialContributionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { circleId, cycleId: paramCycleId } = route.params;
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<"activation" | "tracking">("activation");

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
        setCycleError("This circle has no active cycle to activate flexible payment for.");
      } else {
        setResolvedCycleId(data.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId, paramCycleId]);

  // ── Preview (eligibility + summary + coverage) ───────────────────────────
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!user?.id || !resolvedCycleId) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { data, error } = await supabase.rpc("preview_partial_contribution", {
        p_circle_id: circleId,
        p_cycle_id: resolvedCycleId,
      });
      if (error) {
        setPreviewError(error.message);
        return;
      }
      setPreview(data as PreviewResult);
    } catch (err: any) {
      setPreviewError(err?.message ?? "Could not load preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [circleId, resolvedCycleId, user?.id]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // ── Tracking (active plan from hook — direct table read works) ───────────
  const {
    plan,
    loading: planLoading,
    hasPlan,
    catchUpProgress,
    remainingAmount,
    refetch: refetchPlan,
  } = useActivePlan(user?.id, circleId);

  // Auto-flip to tracking when we detect an active plan (e.g. after activate)
  useEffect(() => {
    if (hasPlan && viewMode === "activation") {
      setViewMode("tracking");
    }
  }, [hasPlan, viewMode]);

  // ── Activate action ──────────────────────────────────────────────────────
  const [activating, setActivating] = useState(false);
  const handleActivate = async () => {
    if (!resolvedCycleId) return;
    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("activate_partial_contribution", {
        p_circle_id: circleId,
        p_cycle_id: resolvedCycleId,
      });
      if (error) {
        Alert.alert("Could not activate", error.message);
        return;
      }
      const result = data as { success: boolean; error?: string; plan_id?: string };
      if (!result.success) {
        Alert.alert("Could not activate", result.error ?? "Unknown error");
        return;
      }
      // Refresh both preview (eligibility now blocks) and the active plan
      await Promise.all([fetchPreview(), refetchPlan()]);
      setViewMode("tracking");
    } catch (err: any) {
      Alert.alert("Could not activate", err?.message ?? "Unknown error");
    } finally {
      setActivating(false);
    }
  };

  // ── Cancel action (still uses the hook — engine cancelPlan is a clean
  // direct UPDATE on the table and works against prod) ─────────────────────
  const [cancelling, setCancelling] = useState(false);
  const handleCancel = () => {
    if (!plan?.id) return;
    Alert.alert(
      "Cancel Plan",
      "Are you sure you want to cancel and pay the remaining amount now?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
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
                Alert.alert("Could not cancel", error.message);
                return;
              }
              await Promise.all([fetchPreview(), refetchPlan()]);
              setViewMode("activation");
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
  const showTracking = viewMode === "tracking" && hasPlan;

  const eligibility = preview?.eligibility;
  const summary = preview?.summary;
  const coverage = preview?.coverage_preview;

  const catchUpDates = useMemo(() => {
    if (!summary) return [];
    return [
      {
        cycleNumber: summary.catch_up_1_cycle_number,
        date: summary.catch_up_1_due,
        amountCents: summary.catch_up_1_cents,
      },
      {
        cycleNumber: summary.catch_up_2_cycle_number,
        date: summary.catch_up_2_due,
        amountCents: summary.catch_up_2_cents,
      },
    ];
  }, [summary]);

  // ── Renderers ────────────────────────────────────────────────────────────

  if (cycleError) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Flexible Payment</Text>
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
        <Text style={styles.headerTitle}>Flexible Payment</Text>
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
        {/* View toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleWrapper}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === "activation" && styles.toggleBtnActive,
              ]}
              onPress={() => setViewMode("activation")}
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === "activation" && styles.toggleTextActive,
                ]}
              >
                Activation
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === "tracking" && styles.toggleBtnActive,
              ]}
              onPress={() => setViewMode("tracking")}
              disabled={!hasPlan}
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === "tracking" && styles.toggleTextActive,
                  !hasPlan && { opacity: 0.4 },
                ]}
              >
                Tracking
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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
                <Text style={styles.heroTitle}>Need More Time?</Text>
                <Text style={styles.heroSubtitle}>
                  Pay 50% now and split the rest over the next 2 cycles. No
                  penalty to your XnScore.
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
                      {eligibility.eligible ? "You're Eligible" : "Not Available"}
                    </Text>
                    <Text style={styles.mutedText}>
                      {eligibility.uses_this_year === 0
                        ? "First use this year — no fee"
                        : `Used ${eligibility.uses_this_year}× in the last 12 months — $10 fee applies`}
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
                <Text style={styles.sectionTitle}>Payment Breakdown</Text>

                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.dot, { backgroundColor: COLORS.teal }]} />
                    <View>
                      <Text style={styles.breakdownLabel}>Pay Now (50%)</Text>
                      <Text style={styles.mutedText}>Due today</Text>
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
                          Catch-Up {i + 1} (25%)
                        </Text>
                        <Text style={styles.mutedText}>
                          Cycle {catchUp.cycleNumber} — {catchUp.date}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.breakdownAmount}>
                      {formatCents(catchUp.amountCents)}
                    </Text>
                  </View>
                ))}

                <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.mutedText}>Original Amount</Text>
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
              <Text style={styles.sectionTitle}>What Happens</Text>
              {[
                {
                  icon: "shield-checkmark" as const,
                  text: "Insurance pool covers the 50% shortfall — circle stays on track",
                },
                {
                  icon: "star" as const,
                  text: "No XnScore penalty if catch-up payments made on time",
                },
                {
                  icon: "eye-off" as const,
                  text: "Circle admin notified anonymously — your identity stays private",
                },
                {
                  icon: "calendar" as const,
                  text: "Catch-up amounts due in the next 2 cycles",
                },
              ].map((item, i) => (
                <View key={i} style={styles.infoRow}>
                  <Ionicons name={item.icon} size={20} color={COLORS.green} />
                  <Text style={styles.infoText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* Coverage detail */}
            {coverage && coverage.coverage_status !== "no_pool" && summary && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Insurance Coverage</Text>
                <View style={styles.row}>
                  <Text style={styles.mutedText}>Shortfall</Text>
                  <Text style={styles.value}>
                    {formatCents(coverage.shortfall_cents)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.mutedText}>Pool will honor</Text>
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
                    ({coverage.coverage_status.replace(/_/g, " ")})
                  </Text>
                </View>
              </View>
            )}

            {/* Fee notice */}
            {eligibility?.fee_required && (
              <View style={styles.feeNotice}>
                <Ionicons name="pricetag" size={20} color={COLORS.orange} />
                <Text style={styles.feeText}>
                  A ${(eligibility.fee_cents / 100).toFixed(2)} fee applies (2nd use this year)
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
                    ? `Activate Flexible Payment — Pay ${formatCents(summary.pay_now_cents)} Now`
                    : "Activate Flexible Payment"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryButtonText}>Pay Full Amount Instead</Text>
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
                    Flexible Payment Active
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
                      Paid: {catchUpProgress.paid}/{catchUpProgress.total}
                    </Text>
                    <Text style={styles.mutedText}>
                      Remaining: ${remainingAmount.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                  Catch-Up Schedule
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
                        Cycle {item.cycleNumber}
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
                      {item.status}
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
                  Cancel Plan & Pay Remaining Now
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
