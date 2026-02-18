import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

interface OversightDashboardParams {
  circleName?: string;
  circleId?: string;
}

const screenWidth = Dimensions.get("window").width;

export default function OversightDashboardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as OversightDashboardParams) || {};
  const circleName = params.circleName || "Family Savings Circle";

  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "all">("month");

  // Mock data for analytics
  const stats = {
    totalMembers: 6,
    activeMembers: 5,
    pausedMembers: 1,
    completedCycles: 8,
    totalCycles: 12,
    totalContributed: 4800,
    totalPaidOut: 3200,
    onTimePayments: 42,
    latePayments: 4,
    missedPayments: 2,
    openDisputes: 1,
    resolvedDisputes: 3,
    healthScore: 92,
  };

  const recentActivity = [
    {
      id: "1",
      type: "payment",
      description: "Marie K. made payment for Cycle 8",
      timestamp: "2 hours ago",
      icon: "checkmark-circle",
      color: "#10B981",
    },
    {
      id: "2",
      type: "dispute",
      description: "New dispute reported by Jean P.",
      timestamp: "5 hours ago",
      icon: "alert-circle",
      color: "#F59E0B",
    },
    {
      id: "3",
      type: "payment",
      description: "Sarah L. made payment for Cycle 8",
      timestamp: "1 day ago",
      icon: "checkmark-circle",
      color: "#10B981",
    },
    {
      id: "4",
      type: "member",
      description: "Paul M. membership paused",
      timestamp: "2 days ago",
      icon: "pause-circle",
      color: "#6B7280",
    },
    {
      id: "5",
      type: "payout",
      description: "Payout processed for David N.",
      timestamp: "1 week ago",
      icon: "cash",
      color: "#2563EB",
    },
  ];

  const membersAtRisk = [
    {
      id: "1",
      name: "Jean Pierre",
      issue: "1 late payment",
      risk: "medium",
    },
    {
      id: "2",
      name: "Paul Mbarga",
      issue: "Membership paused",
      risk: "low",
    },
  ];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "#10B981";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  };

  const paymentRate =
    ((stats.onTimePayments) /
      (stats.onTimePayments + stats.latePayments + stats.missedPayments)) *
    100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Oversight Dashboard</Text>
          <Text style={styles.headerSubtitle}>{circleName}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Period Filter */}
      <View style={styles.filterContainer}>
        {[
          { key: "week", label: "This Week" },
          { key: "month", label: "This Month" },
          { key: "all", label: "All Time" },
        ].map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.filterButton,
              selectedPeriod === period.key && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.key as any)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedPeriod === period.key && styles.filterButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Health Score Card */}
        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <Text style={styles.healthTitle}>Circle Health Score</Text>
            <View
              style={[
                styles.healthBadge,
                { backgroundColor: `${getHealthColor(stats.healthScore)}20` },
              ]}
            >
              <Text
                style={[
                  styles.healthBadgeText,
                  { color: getHealthColor(stats.healthScore) },
                ]}
              >
                {stats.healthScore >= 80
                  ? "Excellent"
                  : stats.healthScore >= 60
                  ? "Good"
                  : "Needs Attention"}
              </Text>
            </View>
          </View>
          <View style={styles.healthScoreContainer}>
            <Text
              style={[
                styles.healthScore,
                { color: getHealthColor(stats.healthScore) },
              ]}
            >
              {stats.healthScore}
            </Text>
            <Text style={styles.healthScoreUnit}>/100</Text>
          </View>
          <View style={styles.healthBar}>
            <View
              style={[
                styles.healthBarFill,
                {
                  width: `${stats.healthScore}%`,
                  backgroundColor: getHealthColor(stats.healthScore),
                },
              ]}
            />
          </View>
          <Text style={styles.healthNote}>
            Based on payment rates, dispute resolution, and member activity
          </Text>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="people" size={22} color="#2563EB" />
            </View>
            <Text style={styles.statValue}>{stats.activeMembers}/{stats.totalMembers}</Text>
            <Text style={styles.statLabel}>Active Members</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{paymentRate.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>On-Time Rate</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#FFFBEB" }]}>
              <Ionicons name="alert-circle" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.openDisputes}</Text>
            <Text style={styles.statLabel}>Open Disputes</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#F3F4F6" }]}>
              <Ionicons name="sync-circle" size={22} color="#6B7280" />
            </View>
            <Text style={styles.statValue}>{stats.completedCycles}/{stats.totalCycles}</Text>
            <Text style={styles.statLabel}>Cycles Done</Text>
          </View>
        </View>

        {/* Financial Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          <View style={styles.financialCard}>
            <View style={styles.financialRow}>
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Total Contributed</Text>
                <Text style={styles.financialValue}>${stats.totalContributed.toLocaleString()}</Text>
              </View>
              <View style={styles.financialDivider} />
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Total Paid Out</Text>
                <Text style={styles.financialValue}>${stats.totalPaidOut.toLocaleString()}</Text>
              </View>
            </View>
            <View style={styles.financialBar}>
              <View
                style={[
                  styles.financialBarContributed,
                  { width: "60%" },
                ]}
              />
              <View
                style={[
                  styles.financialBarPaidOut,
                  { width: "40%" },
                ]}
              />
            </View>
            <View style={styles.financialLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#2563EB" }]} />
                <Text style={styles.legendText}>Contributed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                <Text style={styles.legendText}>Paid Out</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>
          <View style={styles.paymentBreakdown}>
            <View style={styles.paymentItem}>
              <View style={[styles.paymentDot, { backgroundColor: "#10B981" }]} />
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentCount}>{stats.onTimePayments}</Text>
                <Text style={styles.paymentType}>On Time</Text>
              </View>
            </View>
            <View style={styles.paymentItem}>
              <View style={[styles.paymentDot, { backgroundColor: "#F59E0B" }]} />
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentCount}>{stats.latePayments}</Text>
                <Text style={styles.paymentType}>Late</Text>
              </View>
            </View>
            <View style={styles.paymentItem}>
              <View style={[styles.paymentDot, { backgroundColor: "#EF4444" }]} />
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentCount}>{stats.missedPayments}</Text>
                <Text style={styles.paymentType}>Missed</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Members at Risk */}
        {membersAtRisk.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Members Needing Attention</Text>
            {membersAtRisk.map((member) => (
              <View key={member.id} style={styles.riskCard}>
                <View style={styles.riskAvatar}>
                  <Text style={styles.riskAvatarText}>
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </Text>
                </View>
                <View style={styles.riskContent}>
                  <Text style={styles.riskName}>{member.name}</Text>
                  <Text style={styles.riskIssue}>{member.issue}</Text>
                </View>
                <View
                  style={[
                    styles.riskBadge,
                    { backgroundColor: `${getRiskColor(member.risk)}20` },
                  ]}
                >
                  <Text
                    style={[styles.riskBadgeText, { color: getRiskColor(member.risk) }]}
                  >
                    {member.risk.charAt(0).toUpperCase() + member.risk.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View
                style={[
                  styles.activityIcon,
                  { backgroundColor: `${activity.color}20` },
                ]}
              >
                <Ionicons
                  name={activity.icon as any}
                  size={18}
                  color={activity.color}
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityDescription}>{activity.description}</Text>
                <Text style={styles.activityTimestamp}>{activity.timestamp}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="document-text-outline" size={24} color="#2563EB" />
              <Text style={styles.quickActionText}>Generate Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="people-outline" size={24} color="#2563EB" />
              <Text style={styles.quickActionText}>Review Members</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="chatbubbles-outline" size={24} color="#2563EB" />
              <Text style={styles.quickActionText}>Send Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#2563EB",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  healthCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  healthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  healthBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  healthScoreContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  healthScore: {
    fontSize: 48,
    fontWeight: "700",
  },
  healthScoreUnit: {
    fontSize: 20,
    color: "#9CA3AF",
    marginLeft: 4,
  },
  healthBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  healthBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  healthNote: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    paddingBottom: 0,
    gap: 12,
  },
  statCard: {
    width: (screenWidth - 44) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: "#2563EB",
    fontWeight: "500",
  },
  financialCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  financialItem: {
    alignItems: "center",
  },
  financialLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },
  financialDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  financialBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  financialBarContributed: {
    height: "100%",
    backgroundColor: "#2563EB",
  },
  financialBarPaidOut: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  financialLegend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
    gap: 24,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: "#6B7280",
  },
  paymentBreakdown: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  paymentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paymentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  paymentInfo: {
    alignItems: "center",
  },
  paymentCount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  paymentType: {
    fontSize: 12,
    color: "#6B7280",
  },
  riskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    marginBottom: 8,
  },
  riskAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  riskAvatarText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  riskContent: {
    flex: 1,
  },
  riskName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  riskIssue: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 20,
  },
  activityTimestamp: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#2563EB",
    textAlign: "center",
  },
  bottomPadding: {
    height: 40,
  },
});
