import React, { useState, useCallback, useEffect } from "react";
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
import {
  useCircleMembersForSwap,
  useCoolingOffStatus,
  useMySwapRequests,
  usePendingSwapRequests,
  useSwapActions,
  useSwapHistory,
} from "../hooks/usePositionSwap";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

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

type RouteParams = { circleId: string };

// ─── Pending-confirmation card ──────────────────────────────────────────────
// Rendered for outgoing swap requests where the target has accepted and we
// (the requester) are now in the cooling-off window before being able to
// confirm. The chip is driven by `useCoolingOffStatus` which ticks every
// 60s; when the period ends, the chip turns green ("Ready to confirm").
function PendingConfirmationCard({ request }: { request: any }) {
  const { t } = useTranslation();
  const { isComplete, timeRemaining } = useCoolingOffStatus(
    request.cooling_off_ends_at ?? null
  );
  const targetName: string = request.target_name ?? t("position_swap.fallback_member");
  return (
    <View style={styles.card}>
      <View style={styles.requestHeader}>
        <Ionicons name="hourglass-outline" size={20} color={COLORS.teal} />
        <Text style={styles.requestTitle}>
          {t("position_swap.pending_confirmation_title", { name: targetName })}
        </Text>
      </View>
      <Text style={styles.requestDetail}>
        Position #{request.requester_position} ↔ Position #{request.target_position}
      </Text>
      <View
        style={[
          styles.coolingChip,
          isComplete ? styles.coolingChipReady : styles.coolingChipWaiting,
        ]}
      >
        <Ionicons
          name={isComplete ? "checkmark-circle" : "time-outline"}
          size={14}
          color={isComplete ? "#065F46" : "#92400E"}
        />
        <Text
          style={[
            styles.coolingChipText,
            { color: isComplete ? "#065F46" : "#92400E" },
          ]}
        >
          {isComplete
            ? t("position_swap.ready_to_confirm")
            : t("position_swap.ready_in", { time: timeRemaining ?? "--" })}
        </Text>
      </View>
    </View>
  );
}

export default function PositionSwapScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const { user } = useAuth();
  // Defensive: route.params can be undefined if the caller navigates
  // without a circleId. Fall back to empty so destructuring never throws.
  const { circleId } = route.params ?? ({} as RouteParams);

  const [activeTab, setActiveTab] = useState<"positions" | "requests" | "history">("positions");

  const {
    members,
    currentPosition,
    loading: membersLoading,
    refetch: refetchMembers,
  } = useCircleMembersForSwap(circleId);

  const {
    requests: myRequests,
    loading: myReqLoading,
    refetch: refetchMyRequests,
  } = useMySwapRequests();

  const {
    requests: pendingRequests,
    loading: pendingLoading,
    refetch: refetchPending,
  } = usePendingSwapRequests();

  const {
    history,
    loading: historyLoading,
    refetch: refetchHistory,
  } = useSwapHistory();

  const {
    createSwapRequest,
    respondToSwapRequest,
    loading: actionLoading,
    error: actionError,
  } = useSwapActions();

  const loading = membersLoading || pendingLoading || historyLoading;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMembers(), refetchMyRequests(), refetchPending(), refetchHistory()]);
    setRefreshing(false);
  }, [refetchMembers, refetchMyRequests, refetchPending, refetchHistory]);

  // Realtime — refetch all swap state when ANY row I'm part of changes
  // (as requester OR as target). The existing usePendingSwapRequests
  // hook subscribes to target-side INSERTs, but a swap I created moves
  // through `pending_target → pending_confirmation → completed` without
  // me being the target — so without these two channels, my own outgoing
  // requests would only update on pull-to-refresh.
  useEffect(() => {
    if (!user?.id) return;
    const onChange = () => {
      void refetchMembers();
      void refetchMyRequests();
      void refetchPending();
      void refetchHistory();
    };
    const requesterChannel = supabase
      .channel(`swap-requester:${user.id}`)
      .on(
        // supabase-js v2 narrows postgres_changes via a string-literal
        // overload the channel-builder type doesn't expose; cast matches
        // the PayoutListener pattern.
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "position_swap_requests",
          filter: `requester_user_id=eq.${user.id}`,
        },
        onChange
      )
      .subscribe();
    const targetChannel = supabase
      .channel(`swap-target:${user.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "position_swap_requests",
          filter: `target_user_id=eq.${user.id}`,
        },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(requesterChannel);
      supabase.removeChannel(targetChannel);
    };
  }, [user?.id, refetchMembers, refetchMyRequests, refetchPending, refetchHistory]);

  const handleRequestSwap = (targetUserId: string, targetName: string) => {
    Alert.alert(
      "Request Swap",
      `Request a position swap with ${targetName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request",
          onPress: async () => {
            const result = await createSwapRequest(circleId, targetUserId);
            if (result) {
              Alert.alert(t("position_swap.alert_success_title"), t("position_swap.alert_swap_sent"));
              refetchMyRequests();
            } else if (actionError) {
              Alert.alert(t("position_swap.alert_error_title"), actionError);
            }
          },
        },
      ]
    );
  };

  const handleRespondToSwap = async (requestId: string, accept: boolean) => {
    const success = await respondToSwapRequest(requestId, accept);
    if (success) {
      Alert.alert(t("position_swap.alert_success_title"), accept ? t("position_swap.alert_swap_accepted") : t("position_swap.alert_swap_declined"));
      refetchPending();
      refetchMembers();
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  const totalPositions = members.length;
  const myMember = members.find((m: any) => m.is_current_user);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("position_swap.header_title")}</Text>
        <TouchableOpacity>
          <Ionicons name="information-circle-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {/* My Position Card */}
        <View style={styles.card}>
          <View style={styles.positionCardContent}>
            <Text style={styles.mutedText}>{t("position_swap.label_your_position")}</Text>
            <Text style={styles.positionNumber}>#{currentPosition ?? "?"}</Text>
            <Text style={styles.positionSubtext}>of {totalPositions}</Text>
            {/* Payout-date block removed in PositionSwap D2 — the
                CircleMemberForSwap type from PositionSwapEngine doesn't
                model a per-member payout_date. If we add it later
                (e.g., from circle_cycles.expected_payout_date filtered by
                recipient_user_id) it can be restored here. */}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(["positions", "requests", "history"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "positions"
                  ? "Positions"
                  : tab === "requests"
                  ? `Requests (${pendingRequests.length})`
                  : "History"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* POSITIONS TAB */}
        {activeTab === "positions" && (
          <>
            <Text style={styles.sectionTitle}>{t("position_swap.section_positions")}</Text>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>{t("position_swap.tap_to_swap")}</Text>

            {members.map((member: any) => {
              const isMe = member.is_current_user;
              const canSwap = member.can_swap_with;
              return (
                <TouchableOpacity
                  key={member.user_id}
                  style={[styles.memberRow, isMe && styles.memberRowMe]}
                  disabled={isMe || !canSwap}
                  onPress={() => handleRequestSwap(member.user_id, member.full_name)}
                >
                  <View
                    style={[
                      styles.positionBadge,
                      { backgroundColor: isMe ? COLORS.teal : "#F3F4F6" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.positionBadgeText,
                        { color: isMe ? "#FFF" : COLORS.navy },
                      ]}
                    >
                      #{member.position}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.memberName,
                        isMe && { fontWeight: "800" },
                      ]}
                    >
                      {isMe ? "You" : member.full_name}
                    </Text>
                    <Text style={styles.memberSub}>
                      Payout: {member.payout_date ?? "TBD"}
                    </Text>
                  </View>

                  <View style={styles.scoreColumn}>
                    <Text style={styles.scoreLabel}>{t("position_swap.label_xnscore")}</Text>
                    <Text style={styles.scoreValue}>{member.xn_score ?? "--"}</Text>
                  </View>

                  {!isMe && canSwap && (
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.teal} />
                  )}
                  {!isMe && !canSwap && (
                    <Ionicons name="lock-closed" size={16} color="#D1D5DB" />
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* REQUESTS TAB */}
        {activeTab === "requests" && (
          <>
            {/* Outgoing requests in pending_confirmation — cooling-off chip
                ticks every 60s and turns green when the wait is over. */}
            {myRequests
              .filter((r: any) => r.swap_status === "pending_confirmation")
              .map((r: any) => (
                <PendingConfirmationCard key={r.id} request={r} />
              ))}

            <Text style={styles.sectionTitle}>{t("position_swap.section_requests")}</Text>

            {pendingRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="swap-horizontal" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>{t("position_swap.empty_pending")}</Text>
              </View>
            ) : (
              pendingRequests.map((req: any) => (
                <View key={req.id} style={styles.card}>
                  <View style={styles.requestHeader}>
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.teal} />
                    <Text style={styles.requestTitle}>
                      {req.requester_name ?? "Someone"} wants to swap
                    </Text>
                  </View>
                  <Text style={styles.requestDetail}>
                    Position #{req.requester_position} ↔ Position #{req.target_position}
                  </Text>
                  <Text style={[styles.mutedText, { marginBottom: 12 }]}>
                    Requested {req.created_at}
                  </Text>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleRespondToSwap(req.id, true)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.acceptBtnText}>{t("position_swap.btn_accept")}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleRespondToSwap(req.id, false)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.declineBtnText}>{t("position_swap.btn_decline")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <>
            <Text style={styles.sectionTitle}>{t("position_swap.section_history")}</Text>

            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>{t("position_swap.empty_history")}</Text>
              </View>
            ) : (
              history.map((item: any, i: number) => (
                <View key={i} style={styles.historyRow}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>
                      {item.requester_name ?? "You"} ↔ {item.target_name ?? "Member"}
                    </Text>
                    <Text style={styles.mutedText}>
                      Position #{item.from_position} ↔ #{item.to_position}
                    </Text>
                  </View>
                  <Text style={styles.mutedText}>{item.completed_at ?? item.created_at}</Text>
                </View>
              ))
            )}
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

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

  positionCardContent: { alignItems: "center", paddingVertical: 12 },
  positionNumber: { fontSize: 48, fontWeight: "800", color: COLORS.navy },
  positionSubtext: { fontSize: 14, color: COLORS.muted },
  payoutDate: { fontSize: 15, fontWeight: "600", color: COLORS.teal, marginTop: 8 },

  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabItemActive: { backgroundColor: COLORS.navy },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  tabTextActive: { color: "#FFF" },

  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 4 },
  mutedText: { fontSize: 13, color: COLORS.muted },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  memberRowMe: { borderWidth: 2, borderColor: COLORS.teal },
  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  positionBadgeText: { fontSize: 13, fontWeight: "700" },
  memberName: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  memberSub: { fontSize: 12, color: COLORS.muted },
  scoreColumn: { alignItems: "center", marginRight: 8 },
  scoreLabel: { fontSize: 10, color: COLORS.muted },
  scoreValue: { fontSize: 16, fontWeight: "700", color: COLORS.navy },

  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: "600", color: COLORS.muted, marginTop: 12 },

  requestHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  requestTitle: { fontSize: 15, fontWeight: "600", color: COLORS.navy },
  requestDetail: { fontSize: 14, color: "#374151", marginBottom: 4 },
  requestActions: { flexDirection: "row", gap: 12 },
  acceptBtn: {
    flex: 1,
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  acceptBtnText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  declineBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  declineBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.navy },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  historyTitle: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  coolingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  coolingChipWaiting: { backgroundColor: "#FEF3C7" },
  coolingChipReady: { backgroundColor: "#D1FAE5" },
  coolingChipText: { fontSize: 12, fontWeight: "700" },
});
