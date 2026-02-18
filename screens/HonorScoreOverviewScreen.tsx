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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useElder } from "../context/ElderContext";

type RootStackParamList = {
  HonorScoreOverview: undefined;
  BecomeElder: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");

export default function HonorScoreOverviewScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    elderProfile,
    honorScoreHistory,
    getHonorScoreTier,
    getHonorTier,
  } = useElder();

  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">("month");

  const honorScore = elderProfile?.honorScore || 72;
  const tierInfo = getHonorScoreTier(honorScore);
  const honorTier = getHonorTier(honorScore);

  // Mock chart data for trend
  const trendData = {
    week: [68, 69, 70, 71, 70, 72, 72],
    month: [62, 64, 66, 65, 68, 70, 69, 71, 72, 71, 72, 72],
    year: [45, 48, 52, 55, 58, 62, 65, 68, 70, 71, 72, 72],
  };

  const periods: { key: "week" | "month" | "year"; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
  ];

  const scoreTiers = [
    { tier: "Platinum", range: "85-100", color: "#00C6AE", minScore: 85 },
    { tier: "Gold", range: "70-84", color: "#D97706", minScore: 70 },
    { tier: "Silver", range: "55-69", color: "#6B7280", minScore: 55 },
    { tier: "Bronze", range: "40-54", color: "#92400E", minScore: 40 },
    { tier: "Provisional", range: "0-39", color: "#DC2626", minScore: 0 },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "vouch":
        return "hand-right";
      case "mediation":
        return "shield-checkmark";
      case "training":
        return "school";
      case "penalty":
        return "warning";
      default:
        return "star";
    }
  };

  const getActivityColor = (type: string, points: number) => {
    if (points < 0) return "#DC2626";
    switch (type) {
      case "vouch":
        return "#7C3AED";
      case "mediation":
        return "#00C6AE";
      case "training":
        return "#3B82F6";
      default:
        return "#6B7280";
    }
  };

  // Simple line chart rendering
  const renderTrendChart = () => {
    const data = trendData[selectedPeriod];
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;
    const chartHeight = 120;
    const chartWidth = width - 80;
    const pointSpacing = chartWidth / (data.length - 1);

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartYAxis}>
          <Text style={styles.chartLabel}>{maxValue}</Text>
          <Text style={styles.chartLabel}>{Math.round((maxValue + minValue) / 2)}</Text>
          <Text style={styles.chartLabel}>{minValue}</Text>
        </View>
        <View style={styles.chart}>
          <View style={styles.chartLine}>
            {data.map((value, index) => {
              const x = index * pointSpacing;
              const y = chartHeight - ((value - minValue) / range) * chartHeight;
              return (
                <View
                  key={index}
                  style={[
                    styles.chartPoint,
                    {
                      left: x - 4,
                      top: y - 4,
                      backgroundColor: tierInfo.color,
                    },
                  ]}
                />
              );
            })}
          </View>
          {/* Tier threshold lines */}
          {[85, 70, 55, 40].map((threshold) => {
            if (threshold >= minValue && threshold <= maxValue) {
              const y = chartHeight - ((threshold - minValue) / range) * chartHeight;
              return (
                <View
                  key={threshold}
                  style={[styles.thresholdLine, { top: y }]}
                />
              );
            }
            return null;
          })}
        </View>
      </View>
    );
  };

  const nextTierScore = honorScore < 40 ? 40 : honorScore < 55 ? 55 : honorScore < 70 ? 70 : honorScore < 85 ? 85 : 100;
  const progressToNextTier = honorScore >= 85 ? 100 : ((honorScore - (nextTierScore - 15)) / 15) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Honor Score</Text>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <View style={[styles.scoreCard, { backgroundColor: tierInfo.bg }]}>
          <View style={styles.scoreHeader}>
            <View>
              <Text style={styles.scoreLabel}>Your Honor Score</Text>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreValue, { color: tierInfo.color }]}>
                  {honorScore}
                </Text>
                <View
                  style={[
                    styles.tierBadge,
                    { backgroundColor: tierInfo.color },
                  ]}
                >
                  <Text style={styles.tierBadgeText}>{tierInfo.tier}</Text>
                </View>
              </View>
            </View>
            <View style={styles.honorTierContainer}>
              <Text style={styles.honorTierLabel}>Community Status</Text>
              <Text style={[styles.honorTierValue, { color: tierInfo.color }]}>
                {honorTier}
              </Text>
            </View>
          </View>

          {/* Progress to Next Tier */}
          {honorScore < 85 && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progress to {scoreTiers.find(t => t.minScore === nextTierScore)?.tier}</Text>
                <Text style={styles.progressValue}>{nextTierScore - honorScore} pts needed</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(0, Math.min(100, progressToNextTier))}%`, backgroundColor: tierInfo.color },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {/* Trend Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Score Trend</Text>
            <View style={styles.periodToggle}>
              {periods.map((period) => (
                <TouchableOpacity
                  key={period.key}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period.key && styles.periodButtonActive,
                  ]}
                  onPress={() => setSelectedPeriod(period.key)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      selectedPeriod === period.key && styles.periodButtonTextActive,
                    ]}
                  >
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.trendCard}>
            {renderTrendChart()}
            <View style={styles.trendStats}>
              <View style={styles.trendStatItem}>
                <Ionicons name="trending-up" size={16} color="#00C6AE" />
                <Text style={styles.trendStatLabel}>+7 pts this {selectedPeriod}</Text>
              </View>
              <View style={styles.trendStatItem}>
                <Ionicons name="analytics" size={16} color="#3B82F6" />
                <Text style={styles.trendStatLabel}>Avg: 69 pts</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tier Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score Tiers</Text>
          <View style={styles.tiersCard}>
            {scoreTiers.map((tier, index) => {
              const isCurrentTier = tierInfo.tier === tier.tier;
              return (
                <View
                  key={tier.tier}
                  style={[
                    styles.tierRow,
                    isCurrentTier && styles.currentTierRow,
                    index < scoreTiers.length - 1 && styles.tierRowBorder,
                  ]}
                >
                  <View
                    style={[styles.tierDot, { backgroundColor: tier.color }]}
                  />
                  <Text
                    style={[
                      styles.tierName,
                      isCurrentTier && { color: tier.color, fontWeight: "700" },
                    ]}
                  >
                    {tier.tier}
                  </Text>
                  <Text style={styles.tierRange}>{tier.range}</Text>
                  {isCurrentTier && (
                    <View style={[styles.currentIndicator, { backgroundColor: tier.color }]}>
                      <Text style={styles.currentIndicatorText}>You</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityCard}>
            {honorScoreHistory.slice(0, 6).map((activity, index) => (
              <View
                key={activity.id}
                style={[
                  styles.activityRow,
                  index < honorScoreHistory.length - 1 && styles.activityRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.activityIcon,
                    {
                      backgroundColor: `${getActivityColor(activity.type, activity.points)}15`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getActivityIcon(activity.type) as any}
                    size={18}
                    color={getActivityColor(activity.type, activity.points)}
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityDescription}>
                    {activity.description}
                  </Text>
                  <Text style={styles.activityDate}>{activity.date}</Text>
                </View>
                <Text
                  style={[
                    styles.activityPoints,
                    { color: activity.points >= 0 ? "#00C6AE" : "#DC2626" },
                  ]}
                >
                  {activity.points >= 0 ? "+" : ""}
                  {activity.points}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* How to Improve */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Improve</Text>
          <View style={styles.tipsCard}>
            <View style={styles.tipItem}>
              <View style={[styles.tipIcon, { backgroundColor: "#F0FDFB" }]}>
                <Ionicons name="shield-checkmark" size={20} color="#00C6AE" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Resolve Mediation Cases</Text>
                <Text style={styles.tipDescription}>
                  Earn 15-40 pts per successful case resolution
                </Text>
              </View>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="hand-right" size={20} color="#7C3AED" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Successful Vouches</Text>
                <Text style={styles.tipDescription}>
                  Earn 3-8 pts when vouched members complete circles
                </Text>
              </View>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="school" size={20} color="#3B82F6" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Complete Training</Text>
                <Text style={styles.tipDescription}>
                  Earn 5-10 pts per completed course
                </Text>
              </View>
            </View>
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
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  infoButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scoreCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  scoreLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "700",
    marginRight: 12,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  honorTierContainer: {
    alignItems: "flex-end",
  },
  honorTierLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  honorTierValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  progressSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  progressValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  periodToggle: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    padding: 2,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: "#FFFFFF",
  },
  periodButtonText: {
    fontSize: 12,
    color: "#6B7280",
  },
  periodButtonTextActive: {
    color: "#1a1a2e",
    fontWeight: "600",
  },
  trendCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
  },
  chartContainer: {
    flexDirection: "row",
    height: 140,
  },
  chartYAxis: {
    width: 30,
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  chartLabel: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  chart: {
    flex: 1,
    position: "relative",
    marginLeft: 10,
  },
  chartLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chartPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  thresholdLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  trendStats: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  trendStatItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  trendStatLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
  },
  tiersCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  currentTierRow: {
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
  },
  tierRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tierDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  tierName: {
    fontSize: 14,
    color: "#1a1a2e",
    flex: 1,
  },
  tierRange: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 8,
  },
  currentIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentIndicatorText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: "#1a1a2e",
  },
  activityDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  activityPoints: {
    fontSize: 16,
    fontWeight: "700",
  },
  tipsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  tipDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
});
