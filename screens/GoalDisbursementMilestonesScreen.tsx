// ══════════════════════════════════════════════════════════════════════════════
// GoalDisbursementMilestonesScreen — staged-disbursement timeline
// ══════════════════════════════════════════════════════════════════════════════
// Phase 2A. Renders every goal_disbursement_milestones row for a goal.
// Role-aware actions:
//   - Goal owner: accept/reject pending verification requests (for
//     verification_method='owner' milestones), refund any pending /
//     in-flight milestone.
//   - Provider:   accept a pending milestone (lock escrow),
//                 request verification when in_progress.
//   - Elder/admin: respond to verification requests with method in
//                 ('elder', 'admin').
//
// All transitions flow through the SECURITY DEFINER RPCs in migration
// 196 — the screen only fires the right verb based on context.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useProviderDashboard } from "../hooks/useProviders";
import {
  DisbursementMilestone,
  DisbursementMilestoneStatus,
  useDisbursementActions,
  useGoalDisbursementMilestones,
} from "../hooks/useGoalDisbursementMilestones";

type RouteParams = { goalId: string };

type GoalRow = {
  id: string;
  name: string | null;
  user_id: string;
  target_amount_cents: number;
  current_balance_cents: number;
};

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusColor(status: DisbursementMilestoneStatus): string {
  switch (status) {
    case "released":
      return "#059669";
    case "verified":
      return "#059669";
    case "verification_requested":
      return "#F59E0B";
    case "in_progress":
      return "#0A2342";
    case "failed":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

export default function GoalDisbursementMilestonesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { provider: myProvider } = useProviderDashboard();
  const { goalId } = route.params ?? ({} as RouteParams);

  const [goal, setGoal] = useState<GoalRow | null>(null);
  const { milestones, loading, refetch } = useGoalDisbursementMilestones(goalId);
  const {
    submitting,
    acceptMilestone,
    requestVerification,
    respondVerification,
    cancelMilestone,
  } = useDisbursementActions();
  // Verification request lookup per milestone id — needed so the elder/
  // owner approve/reject buttons can hit respondVerification(request_id).
  const [pendingReqs, setPendingReqs] = useState<Record<string, string>>({});

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    await loadGoal();
    await loadPendingReqs();
    setRefreshing(false);
  };

  const loadGoal = async () => {
    if (!goalId) return;
    const { data } = await supabase
      .from("user_savings_goals")
      .select("id, name, user_id, target_amount_cents, current_balance_cents")
      .eq("id", goalId)
      .maybeSingle();
    setGoal((data as GoalRow) ?? null);
  };

  const loadPendingReqs = async () => {
    if (!goalId) return;
    const ids = milestones.map((m) => m.id);
    if (ids.length === 0) {
      setPendingReqs({});
      return;
    }
    const { data } = await supabase
      .from("goal_disbursement_milestone_verifications")
      .select("id, milestone_id")
      .in("milestone_id", ids)
      .eq("status", "pending");
    const map: Record<string, string> = {};
    for (const row of (data ?? []) as any[]) {
      map[row.milestone_id] = row.id;
    }
    setPendingReqs(map);
  };

  useEffect(() => {
    void loadGoal();
  }, [goalId]);

  useEffect(() => {
    void loadPendingReqs();
  }, [milestones.length]);

  const completedCount = useMemo(
    () => milestones.filter((m) => m.status === "released").length,
    [milestones],
  );

  const isGoalOwner = goal !== null && user?.id === goal.user_id;
  const isProviderOfThisGoal =
    myProvider !== null &&
    milestones.length > 0 &&
    myProvider.id === milestones[0].provider_id;

  const handleAccept = async (milestoneId: string) => {
    const res = await acceptMilestone(milestoneId);
    if (!res.ok) Alert.alert(t("goal_disbursement.error_title"), res.message ?? "");
    await refetch();
  };

  const handleRequestVerification = async (milestoneId: string) => {
    const res = await requestVerification(milestoneId);
    if (!res.ok) Alert.alert(t("goal_disbursement.error_title"), res.message ?? "");
    await refetch();
    await loadPendingReqs();
  };

  const handleRespond = async (milestoneId: string, approved: boolean) => {
    const reqId = pendingReqs[milestoneId];
    if (!reqId) return;
    const res = await respondVerification(reqId, approved);
    if (!res.ok) Alert.alert(t("goal_disbursement.error_title"), res.message ?? "");
    await refetch();
    await loadPendingReqs();
    await loadGoal();
  };

  const handleCancel = (milestoneId: string) => {
    Alert.alert(
      t("goal_disbursement.cancel_confirm_title"),
      t("goal_disbursement.cancel_confirm_body"),
      [
        { text: t("goal_disbursement.dismiss"), style: "cancel" },
        {
          text: t("goal_disbursement.cancel_milestone"),
          style: "destructive",
          onPress: async () => {
            const res = await cancelMilestone(milestoneId);
            if (!res.ok) Alert.alert(t("goal_disbursement.error_title"), res.message ?? "");
            await refetch();
            await loadPendingReqs();
          },
        },
      ],
    );
  };

  if (loading && milestones.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("goal_disbursement.title")}</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />}
      >
        <View style={styles.progressCard}>
          <Text style={styles.progressKicker}>
            {t("goal_disbursement.progress_summary", {
              done: completedCount,
              total: milestones.length,
            })}
          </Text>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width:
                    milestones.length === 0
                      ? "0%"
                      : `${Math.round((completedCount / milestones.length) * 100)}%`,
                },
              ]}
            />
          </View>
          {goal ? (
            <Text style={styles.progressSub}>
              {t("goal_disbursement.goal_balance", {
                balance: fmt(goal.current_balance_cents),
              })}
            </Text>
          ) : null}
        </View>

        {milestones.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="flag-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>{t("goal_disbursement.empty")}</Text>
          </View>
        ) : (
          milestones.map((m) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              isGoalOwner={isGoalOwner}
              isProvider={isProviderOfThisGoal}
              hasPendingRequest={!!pendingReqs[m.id]}
              submitting={submitting}
              onAccept={() => handleAccept(m.id)}
              onRequestVerification={() => handleRequestVerification(m.id)}
              onRespond={(approved) => handleRespond(m.id, approved)}
              onCancel={() => handleCancel(m.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function MilestoneCard({
  milestone,
  isGoalOwner,
  isProvider,
  hasPendingRequest,
  submitting,
  onAccept,
  onRequestVerification,
  onRespond,
  onCancel,
}: {
  milestone: DisbursementMilestone;
  isGoalOwner: boolean;
  isProvider: boolean;
  hasPendingRequest: boolean;
  submitting: boolean;
  onAccept: () => void;
  onRequestVerification: () => void;
  onRespond: (approved: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const color = statusColor(milestone.status);
  const escrowLocked =
    milestone.escrow_status === "funds_locked" ||
    milestone.escrow_status === "funds_reserved";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{milestone.order_index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={2}>
            {milestone.name}
          </Text>
          {milestone.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {milestone.description}
            </Text>
          ) : null}
        </View>
        <Text style={styles.cardAmount}>{fmt(milestone.amount_cents)}</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.statusBadgeText, { color }]}>
            {t(`goal_disbursement.status_${milestone.status}`)}
          </Text>
        </View>
        {escrowLocked ? (
          <View style={styles.escrowBadge}>
            <Ionicons name="lock-closed" size={10} color="#92400E" />
            <Text style={styles.escrowBadgeText}>
              {t("goal_disbursement.escrow_locked")}
            </Text>
          </View>
        ) : null}
        {milestone.escrow_status === "released" ? (
          <View style={[styles.escrowBadge, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="checkmark-circle" size={10} color="#065F46" />
            <Text style={[styles.escrowBadgeText, { color: "#065F46" }]}>
              {t("goal_disbursement.escrow_released")}
            </Text>
          </View>
        ) : null}
        {milestone.retention_percent > 0 &&
        milestone.status !== "released" &&
        milestone.status !== "failed" ? (
          <Text style={styles.retentionText}>
            {t("goal_disbursement.retention_hint", {
              percent: milestone.retention_percent,
            })}
          </Text>
        ) : null}
      </View>

      {milestone.status === "released" && milestone.released_at ? (
        <Text style={styles.releasedText}>
          {t("goal_disbursement.released_on", {
            date: new Date(milestone.released_at).toLocaleDateString(),
          })}
          {milestone.released_amount_cents != null
            ? ` · ${fmt(milestone.released_amount_cents)}`
            : ""}
        </Text>
      ) : null}

      {/* Action row — role-aware. */}
      <View style={styles.actionRow}>
        {isProvider && milestone.status === "pending" ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={onAccept}
            disabled={submitting}
          >
            <Text style={styles.btnPrimaryText}>
              {t("goal_disbursement.accept_milestone")}
            </Text>
          </TouchableOpacity>
        ) : null}

        {isProvider && milestone.status === "in_progress" ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={onRequestVerification}
            disabled={submitting}
          >
            <Text style={styles.btnPrimaryText}>
              {t("goal_disbursement.request_verification")}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Verification responses — owner-method milestones are owner-only;
            elder/admin-method are gated by the RPC, so we render the button
            and let the server reject if unauthorized. */}
        {milestone.status === "verification_requested" && hasPendingRequest ? (
          <>
            {(isGoalOwner && milestone.verification_method === "owner") ||
            milestone.verification_method === "elder" ||
            milestone.verification_method === "admin" ? (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => onRespond(true)}
                  disabled={submitting}
                >
                  <Text style={styles.btnPrimaryText}>
                    {t("goal_disbursement.approve")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => onRespond(false)}
                  disabled={submitting}
                >
                  <Text style={styles.btnSecondaryText}>
                    {t("goal_disbursement.reject")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.pendingText}>
                {t("goal_disbursement.pending_review")}
              </Text>
            )}
          </>
        ) : null}

        {isGoalOwner &&
        (milestone.status === "pending" ||
          milestone.status === "in_progress" ||
          milestone.status === "verification_requested") ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger]}
            onPress={onCancel}
            disabled={submitting}
          >
            <Text style={styles.btnDangerText}>{t("goal_disbursement.cancel_milestone")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },

  scrollContent: { padding: 16, paddingBottom: 32 },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  progressKicker: { fontSize: 13, color: "#6B7280", fontWeight: "700" },
  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    marginTop: 8,
    overflow: "hidden",
  },
  progressBarFill: { height: 8, backgroundColor: "#00C6AE", borderRadius: 999 },
  progressSub: { fontSize: 12, color: "#6B7280", marginTop: 8 },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyText: { fontSize: 14, color: "#6B7280" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeText: { fontSize: 13, fontWeight: "800", color: "#0A2342" },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0A2342" },
  cardDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: "800", color: "#0A2342" },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  escrowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  escrowBadgeText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  retentionText: { fontSize: 11, color: "#6B7280", marginLeft: 4 },
  releasedText: { fontSize: 12, color: "#059669", marginTop: 8, fontWeight: "600" },
  pendingText: { fontSize: 12, color: "#92400E", fontWeight: "600" },

  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  btnSecondary: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  btnSecondaryText: { color: "#0A2342", fontSize: 13, fontWeight: "700" },
  btnDanger: { backgroundColor: "#FEE2E2" },
  btnDangerText: { color: "#B91C1C", fontSize: 13, fontWeight: "700" },
});
