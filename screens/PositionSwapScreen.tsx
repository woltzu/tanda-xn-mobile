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
import {
  useCircleMembersForSwap,
  useMySwapRequests,
  usePendingSwapRequests,
  useSwapActions,
  useSwapHistory,
} from "../hooks/usePositionSwap";

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

export default function PositionSwapScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { circleId } = route.params;

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
              Alert.alert("Success", "Swap request sent!");
              refetchMyRequests();
            } else if (actionError) {
              Alert.alert("Error", actionError);
            }
          },
        },
      ]
    );
  };

  const handleRespondToSwap = async (requestId: string, accept: boolean) => {
    const success = await respondToSwapRequest(requestId, accept);
    if (success) {
      Alert.alert("Success", accept ? "Swap accepted!" : "Swap declined.");
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
        <Text style={styles.headerTitle}>Payout Position</Text>
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
            <Text style={styles.mutedText}>Your Position</Text>
            <Text style={styles.positionNumber}>#{currentPosition ?? "?"}</Text>
            <Text style={styles.positionSubtext}>of {totalPositions}</Text>
            {myMember?.payout_date && (
              <Text style={styles.payoutDate}>
                Payout: {myMember.payout_date}
              </Text>
            )}
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
            <Text style={styles.sectionTitle}>Circle Positions</Text>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>Tap a member to request a swap</Text>

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
                    <Text style={styles.scoreLabel}>XnScore</Text>
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
            <Text style={styles.sectionTitle}>Swap Requests</Text>

            {pendingRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="swap-horizontal" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No Pending Requests</Text>
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
                        <Text style={styles.acceptBtnText}>Accept Swap</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleRespondToSwap(req.id, false)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.declineBtnText}>Decline</Text>
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
            <Text style={styles.sectionTitle}>Swap History</Text>

            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No Swap History</Text>
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
});
