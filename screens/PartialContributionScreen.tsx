import React, { useState, useCallback } from "react";
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
import { useAuth } from "../context/AuthContext";
import {
  usePartialEligibility,
  useActivationSummary,
  useActivePlan,
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

type RouteParams = { circleId: string; cycleId: string };

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function PartialContributionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { circleId, cycleId } = route.params;
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<"activation" | "tracking">("activation");

  const {
    loading: eligLoading,
    eligible,
    reason,
    usesThisYear,
    feeRequired,
    feeCents,
    refetch: refetchEligibility,
  } = usePartialEligibility(user?.id, circleId, cycleId);

  const {
    summary,
    loading: summaryLoading,
    payNowAmount,
    catchUpDates,
    refetch: refetchSummary,
  } = useActivationSummary(user?.id, circleId, cycleId);

  const {
    plan,
    loading: planLoading,
    hasPlan,
    catchUpProgress,
    remainingAmount,
    refetch: refetchPlan,
  } = useActivePlan(user?.id, circleId);

  const {
    activatePartialContribution,
    cancelPlan,
    activating,
    cancelling,
    error: actionError,
  } = usePartialContributionActions();

  const loading = eligLoading || summaryLoading || planLoading;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchEligibility(), refetchSummary(), refetchPlan()]);
    setRefreshing(false);
  }, [refetchEligibility, refetchSummary, refetchPlan]);

  const handleActivate = async () => {
    if (!user?.id) return;
    const result = await activatePartialContribution(user.id, circleId, cycleId);
    if (result) {
      setViewMode("tracking");
      refetchPlan();
    } else if (actionError) {
      Alert.alert("Error", actionError);
    }
  };

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
            await cancelPlan(plan.id);
            setViewMode("activation");
            refetchPlan();
          },
        },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  const showTracking = viewMode === "tracking" && hasPlan;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flexible Payment</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {/* View Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleWrapper}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "activation" && styles.toggleBtnActive]}
              onPress={() => setViewMode("activation")}
            >
              <Text style={[styles.toggleText, viewMode === "activation" && styles.toggleTextActive]}>
                Activation View
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "tracking" && styles.toggleBtnActive]}
              onPress={() => setViewMode("tracking")}
            >
              <Text style={[styles.toggleText, viewMode === "tracking" && styles.toggleTextActive]}>
                Tracking View
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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
                  Pay 50% now and split the rest over the next 2 cycles. No penalty to your XnScore.
                </Text>
              </View>
            </View>

            {/* Eligibility */}
            <View style={styles.card}>
              <View style={styles.eligibilityRow}>
                <Ionicons
                  name={eligible ? "checkmark-circle" : "close-circle"}
                  size={24}
                  color={eligible ? COLORS.green : COLORS.red}
                />
                <View style={styles.eligibilityText}>
                  <Text style={styles.eligibilityTitle}>
                    {eligible ? "You're Eligible" : "Not Available"}
                  </Text>
                  <Text style={styles.mutedText}>
                    {usesThisYear === 0
                      ? "First use this year -- no fee"
                      : `Used ${usesThisYear}x this year -- $10 fee applies`}
                  </Text>
                  {!eligible && reason ? (
                    <Text style={[styles.mutedText, { color: COLORS.red }]}>{reason}</Text>
                  ) : null}
                </View>
              </View>
            </View>

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
                  <Text style={styles.breakdownAmount}>{formatCents(payNowAmount * 100)}</Text>
                </View>

                {catchUpDates.map((catchUp, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View
                        style={[styles.dot, { backgroundColor: i === 0 ? COLORS.yellow : COLORS.orange }]}
                      />
                      <View>
                        <Text style={styles.breakdownLabel}>Catch-Up {i + 1} (25%)</Text>
                        <Text style={styles.mutedText}>
                          Cycle {catchUp.cycleNumber} -- {catchUp.date}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.breakdownAmount}>{formatCents(catchUp.amount * 100)}</Text>
                  </View>
                ))}

                <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.mutedText}>Original Amount</Text>
                  <Text style={[styles.breakdownAmount, styles.strikethrough, { color: COLORS.muted }]}>
                    {formatCents(summary.originalAmountCents ?? 0)}
                  </Text>
                </View>
              </View>
            )}

            {/* What Happens */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>What Happens</Text>
              {[
                { icon: "shield-checkmark" as const, text: "Insurance pool covers the 50% shortfall -- circle stays on track" },
                { icon: "star" as const, text: "No XnScore penalty if catch-up payments made on time" },
                { icon: "eye-off" as const, text: "Circle admin notified anonymously -- your identity stays private" },
                { icon: "calendar" as const, text: "Catch-up amounts added to your regular contribution in next 2 cycles" },
              ].map((item, i) => (
                <View key={i} style={styles.infoRow}>
                  <Ionicons name={item.icon} size={20} color={COLORS.green} />
                  <Text style={styles.infoText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* Fee Notice */}
            {feeRequired && (
              <View style={styles.feeNotice}>
                <Ionicons name="pricetag" size={20} color={COLORS.orange} />
                <Text style={styles.feeText}>
                  A ${((feeCents ?? 0) / 100).toFixed(2)} fee applies (2nd use this year)
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.primaryButton, !eligible && styles.disabledButton]}
              disabled={!eligible || activating}
              onPress={handleActivate}
            >
              {activating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Activate Flexible Payment -- Pay {formatCents(payNowAmount * 100)} Now
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryButtonText}>Pay Full Amount Instead</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Active Plan Card */}
            {plan && (
              <View style={styles.card}>
                {/* Status */}
                <View style={styles.planStatusRow}>
                  <View style={styles.planStatusIcon}>
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.planStatusText, { color: COLORS.teal }]}>
                    Flexible Payment Active
                  </Text>
                </View>

                {/* Progress Bar */}
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
                    <Text style={[styles.smallText, { color: COLORS.teal, fontWeight: "600" }]}>
                      Paid: {catchUpProgress.paid}/{catchUpProgress.total}
                    </Text>
                    <Text style={styles.mutedText}>
                      Remaining: ${remainingAmount.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Catch-Up Schedule */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Catch-Up Schedule</Text>
                {plan.catchUpSchedule?.map((item: any, i: number) => (
                  <View key={i} style={styles.catchUpRow}>
                    <View
                      style={[
                        styles.catchUpIcon,
                        {
                          backgroundColor:
                            item.status === "paid" ? `${COLORS.green}20` : `${COLORS.yellow}20`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.status === "paid" ? "checkmark" : "time"}
                        size={16}
                        color={item.status === "paid" ? COLORS.green : COLORS.yellow}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catchUpLabel}>Cycle {item.cycleNumber}</Text>
                      <Text style={styles.mutedText}>{item.dueDate}</Text>
                    </View>
                    <Text style={styles.catchUpAmount}>
                      {formatCents(item.amountCents)}
                    </Text>
                    <Text
                      style={[
                        styles.catchUpStatus,
                        { color: item.status === "paid" ? COLORS.green : COLORS.yellow },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Cancel Button */}
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={cancelling}>
              {cancelling ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Plan & Pay Remaining Now</Text>
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
  headerBtn: { padding: 8, borderRadius: 8 },
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
  heroSubtitle: { fontSize: 14, color: COLORS.muted, textAlign: "center", maxWidth: 300 },

  eligibilityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
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

  planStatusRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
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
  progressFill: {
    height: 8,
    backgroundColor: COLORS.teal,
    borderRadius: 4,
  },
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
  catchUpStatus: { fontSize: 12, fontWeight: "600", textTransform: "capitalize", width: 60, textAlign: "right" },

  cancelButton: {
    backgroundColor: `${COLORS.red}15`,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  cancelButtonText: { fontSize: 15, fontWeight: "600", color: COLORS.red },
});
