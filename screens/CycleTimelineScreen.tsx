import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
  useCurrentCycle,
  useCircleCycles,
  useCycleContributions,
  useCycleStats,
} from "../hooks/useCycleProgression";

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

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function CycleTimelineScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { circleId } = route.params;

  const {
    cycle: currentCycle,
    loading: cycleLoading,
    error: cycleError,
  } = useCurrentCycle(circleId);

  const {
    cycles: allCycles,
    loading: cyclesLoading,
  } = useCircleCycles(circleId);

  const {
    contributions,
    loading: contribLoading,
  } = useCycleContributions(currentCycle?.id);

  const {
    stats,
    loading: statsLoading,
  } = useCycleStats(circleId);

  const loading = cycleLoading || cyclesLoading || contribLoading || statsLoading;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Hooks auto-refetch on dependency change; we just wait briefly
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  const paidContributions = contributions?.filter((c: any) => c.status === "paid") ?? [];
  const totalMembers = contributions?.length ?? 0;
  const paidCount = paidContributions.length;
  const progressPct = totalMembers > 0 ? (paidCount / totalMembers) * 100 : 0;

  const currentCycleNumber = currentCycle?.cycle_number ?? stats?.current_cycle_number ?? 0;
  const totalCyclesCount = stats?.total_cycles ?? allCycles?.length ?? 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circle Timeline</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {/* Current Cycle Card */}
        <View style={styles.card}>
          <Text style={styles.mutedText}>
            {currentCycle?.circle?.name ?? "Circle"}
          </Text>
          <View style={styles.cycleHeader}>
            <Text style={styles.cycleNumber}>Cycle {currentCycleNumber}</Text>
            <Text style={styles.cycleTotal}>of {totalCyclesCount}</Text>
          </View>

          {/* Contribution Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Contributions</Text>
              <Text style={[styles.progressLabel, { color: COLORS.teal }]}>
                {paidCount}/{totalMembers} paid
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>

          {/* Deadline & Payout Info */}
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={20} color={COLORS.orange} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.infoLabel}>Deadline</Text>
                <Text style={styles.infoValue}>
                  {currentCycle?.contribution_deadline
                    ? new Date(currentCycle.contribution_deadline).toLocaleDateString()
                    : "TBD"}
                </Text>
              </View>
            </View>
            <View style={styles.infoBox}>
              <Ionicons name="card-outline" size={20} color={COLORS.green} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.infoLabel}>Payout</Text>
                <Text style={styles.infoValue}>
                  {currentCycle?.payout_date
                    ? new Date(currentCycle.payout_date).toLocaleDateString()
                    : "TBD"}
                </Text>
                {currentCycle?.recipient?.full_name && (
                  <Text style={styles.mutedText}>To {currentCycle.recipient.full_name}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Member Contribution Status */}
        <Text style={styles.sectionTitle}>Member Status</Text>
        {contributions?.map((member: any, i: number) => (
          <View key={i} style={styles.card}>
            <View style={styles.memberRow}>
              <View
                style={[
                  styles.statusIcon,
                  {
                    backgroundColor:
                      member.status === "paid" ? `${COLORS.green}20` : `${COLORS.yellow}20`,
                  },
                ]}
              >
                <Ionicons
                  name={member.status === "paid" ? "checkmark" : "time"}
                  size={16}
                  color={member.status === "paid" ? COLORS.green : COLORS.yellow}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {member.member?.full_name ?? member.user_id}
                </Text>
                <Text style={styles.mutedText}>
                  {member.status === "paid"
                    ? `Paid ${member.paid_at ? new Date(member.paid_at).toLocaleDateString() : ""}`
                    : "Pending"}
                </Text>
              </View>
              <Text style={styles.memberAmount}>
                {formatCents(member.amount_cents ?? currentCycle?.circle?.contribution_amount ?? 0)}
              </Text>
            </View>
          </View>
        ))}

        {/* Full Timeline */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Full Timeline</Text>
        <View style={styles.timeline}>
          {allCycles?.map((cycle: any, i: number) => {
            const isActive = cycle.id === currentCycle?.id;
            const isCompleted = cycle.status === "closed" || cycle.status === "completed";
            const isUpcoming = !isActive && !isCompleted;

            const dotColor = isCompleted
              ? COLORS.green
              : isActive
              ? COLORS.teal
              : "#D1D5DB";

            return (
              <View key={i} style={styles.timelineItem}>
                {/* Connector line */}
                {i < (allCycles?.length ?? 0) - 1 && (
                  <View style={styles.timelineConnector} />
                )}

                {/* Dot */}
                <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                  {isCompleted && (
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  )}
                  {isActive && (
                    <Ionicons name="pulse" size={12} color="#FFF" />
                  )}
                </View>

                {/* Content */}
                <View
                  style={[
                    styles.timelineCard,
                    isActive && { borderWidth: 2, borderColor: COLORS.teal },
                  ]}
                >
                  <View style={styles.timelineCardHeader}>
                    <Text
                      style={[
                        styles.timelineCycleLabel,
                        { color: isActive ? COLORS.teal : COLORS.navy },
                      ]}
                    >
                      Cycle {cycle.cycle_number}
                    </Text>
                    <Text style={styles.mutedText}>
                      {cycle.payout_date
                        ? new Date(cycle.payout_date).toLocaleDateString()
                        : "TBD"}
                    </Text>
                  </View>
                  <Text style={styles.mutedText}>
                    Payout to {cycle.recipient?.full_name ?? "TBD"}
                  </Text>
                  <Text style={[styles.timelineAmount, { color: COLORS.teal }]}>
                    {formatCents(cycle.payout_amount_cents ?? 0)}
                  </Text>
                  {isActive && (
                    <View style={styles.currentCycleBadge}>
                      <Text style={styles.currentCycleBadgeText}>Current Cycle</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Pay Now Button */}
        <TouchableOpacity
          style={styles.payButton}
          onPress={() =>
            navigation.navigate("Payment", {
              circleId,
              cycleId: currentCycle?.id,
            })
          }
        >
          <Ionicons name="card" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.payButtonText}>
            Pay {formatCents(currentCycle?.circle?.contribution_amount ?? 0)} Now
          </Text>
        </TouchableOpacity>
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
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },

  mutedText: { fontSize: 13, color: COLORS.muted },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 12 },

  cycleHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4, marginBottom: 16 },
  cycleNumber: { fontSize: 28, fontWeight: "800", color: COLORS.navy },
  cycleTotal: { fontSize: 17, color: COLORS.muted },

  progressSection: { marginBottom: 16 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: "600", color: COLORS.navy },
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

  infoGrid: { flexDirection: "row", gap: 12 },
  infoBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: `${COLORS.bg}`,
    borderRadius: 12,
    padding: 12,
  },
  infoLabel: { fontSize: 11, color: COLORS.muted },
  infoValue: { fontSize: 13, fontWeight: "700", color: COLORS.navy },

  memberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  memberName: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  memberAmount: { fontSize: 14, fontWeight: "700", color: COLORS.navy },

  timeline: { position: "relative" },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", position: "relative" },
  timelineConnector: {
    position: "absolute",
    left: 11,
    top: 24,
    width: 2,
    height: "100%",
    backgroundColor: COLORS.border,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginLeft: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  timelineCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  timelineCycleLabel: { fontSize: 14, fontWeight: "700" },
  timelineAmount: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  currentCycleBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${COLORS.teal}15`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  currentCycleBadgeText: { fontSize: 11, fontWeight: "600", color: COLORS.teal },

  payButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  payButtonText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
});
