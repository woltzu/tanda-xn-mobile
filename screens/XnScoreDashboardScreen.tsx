import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useXnScore, ScoreLevel } from "../context/XnScoreContext";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

type XnScoreDashboardNavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");
const SCORE_RING_SIZE = width * 0.55;

export default function XnScoreDashboardScreen() {
  const navigation = useNavigation<XnScoreDashboardNavigationProp>();
  const {
    score,
    level,
    history,
    tips,
    contributionStreak,
    getScoreBreakdown,
  } = useXnScore();

  const scoreBreakdown = getScoreBreakdown();

  // XnScore™ V3.0 Tiers (0-100 scale)
  const getNextLevel = (): ScoreLevel | null => {
    const levels = [
      { name: "Critical", minScore: 0, maxScore: 24, color: "#DC2626", icon: "alert-circle", benefits: [] },
      { name: "Poor", minScore: 25, maxScore: 44, color: "#F59E0B", icon: "warning", benefits: [] },
      { name: "Fair", minScore: 45, maxScore: 59, color: "#EAB308", icon: "star-half-outline", benefits: [] },
      { name: "Good", minScore: 60, maxScore: 74, color: "#22C55E", icon: "star", benefits: [] },
      { name: "Excellent", minScore: 75, maxScore: 89, color: "#3B82F6", icon: "star", benefits: [] },
      { name: "Elite", minScore: 90, maxScore: 100, color: "#8B5CF6", icon: "diamond", benefits: [] },
    ];
    const currentIndex = levels.findIndex((l) => l.name === level.name);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  };

  const nextLevel = getNextLevel();
  const pointsToNextLevel = nextLevel ? nextLevel.minScore - score : 0;
  const levelProgress = nextLevel
    ? ((score - level.minScore) / (level.maxScore - level.minScore + 1)) * 100
    : 100;

  // SVG Score Ring calculations
  const strokeWidth = 12;
  const radius = (SCORE_RING_SIZE - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = score; // Score is already 0-100
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  const recentHistory = history.slice(0, 5);

  const incompleteTips = tips.filter((tip) => !tip.completed).slice(0, 3);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "contribution_made":
      case "contribution_on_time":
      case "contribution_early":
        return { icon: "checkmark-circle", color: "#00C6AE" };
      case "contribution_late":
        return { icon: "alert-circle", color: "#DC2626" };
      case "circle_joined":
      case "circle_completed":
        return { icon: "people", color: "#1565C0" };
      case "funds_added":
        return { icon: "add-circle", color: "#00C6AE" };
      case "withdrawal":
        return { icon: "arrow-up-circle", color: "#F59E0B" };
      case "send_money":
        return { icon: "send", color: "#6366F1" };
      case "streak_bonus":
      case "referral_bonus":
        return { icon: "gift", color: "#EC4899" };
      case "account_verified":
      case "profile_completed":
        return { icon: "shield-checkmark", color: "#10B981" };
      default:
        return { icon: "star", color: "#6B7280" };
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>XnScore™</Text>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => navigation.navigate("XnScoreHistory")}
            >
              <Ionicons name="time-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Score Ring */}
          <View style={styles.scoreRingContainer}>
            <Svg width={SCORE_RING_SIZE} height={SCORE_RING_SIZE}>
              <Defs>
                <SvgLinearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#00C6AE" />
                  <Stop offset="100%" stopColor="#1565C0" />
                </SvgLinearGradient>
              </Defs>
              {/* Background Circle */}
              <Circle
                cx={SCORE_RING_SIZE / 2}
                cy={SCORE_RING_SIZE / 2}
                r={radius}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Progress Circle */}
              <Circle
                cx={SCORE_RING_SIZE / 2}
                cy={SCORE_RING_SIZE / 2}
                r={radius}
                stroke="url(#scoreGradient)"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${SCORE_RING_SIZE / 2} ${SCORE_RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.scoreTextContainer}>
              <Text style={styles.scoreNumber}>{score}</Text>
              <Text style={styles.scoreLabel}>/ 100</Text>
            </View>
          </View>

          {/* Level Badge */}
          <View style={styles.levelBadge}>
            <View style={[styles.levelIcon, { backgroundColor: level.color + "30" }]}>
              <Ionicons
                name={level.icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color={level.color}
              />
            </View>
            <Text style={styles.levelName}>{level.name}</Text>
          </View>

          {/* Progress to Next Level */}
          {nextLevel && (
            <View style={styles.nextLevelSection}>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${levelProgress}%` }]} />
              </View>
              <Text style={styles.nextLevelText}>
                {Number(pointsToNextLevel.toFixed(1))} points to {nextLevel.name}
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Streak Card */}
          {contributionStreak > 0 && (
            <View style={styles.streakCard}>
              <View style={styles.streakLeft}>
                <View style={styles.streakIcon}>
                  <Ionicons name="flame" size={24} color="#F59E0B" />
                </View>
                <View>
                  <Text style={styles.streakTitle}>{contributionStreak} Contribution Streak!</Text>
                  <Text style={styles.streakSubtitle}>
                    Keep it up! {5 - (contributionStreak % 5)} more for bonus points
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Score Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Score Breakdown</Text>
            <View style={styles.breakdownCard}>
              {scoreBreakdown.map((item, index) => (
                <View key={item.category} style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <Text style={styles.breakdownCategory}>{item.category}</Text>
                    <View style={styles.breakdownBarContainer}>
                      <View
                        style={[
                          styles.breakdownBar,
                          {
                            width: `${Math.max(item.percentage, 5)}%`,
                            backgroundColor:
                              index === 0 ? "#00C6AE" :
                              index === 1 ? "#1565C0" :
                              index === 2 ? "#6366F1" :
                              index === 3 ? "#10B981" : "#EC4899",
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.breakdownPoints,
                      { color: item.points >= 0 ? "#0A2342" : "#DC2626" },
                    ]}
                  >
                    {item.points >= 0 ? "+" : ""}{item.points}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Level Benefits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your {level.name} Benefits</Text>
            <View style={styles.benefitsCard}>
              {level.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#00C6AE" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Tips to Improve */}
          {incompleteTips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tips to Improve Your Score</Text>
              {incompleteTips.map((tip) => (
                <View key={tip.id} style={styles.tipCard}>
                  <View style={styles.tipLeft}>
                    <View style={styles.tipIcon}>
                      <Ionicons name="bulb" size={20} color="#F59E0B" />
                    </View>
                    <View style={styles.tipContent}>
                      <Text style={styles.tipTitle}>{tip.title}</Text>
                      <Text style={styles.tipDescription}>{tip.description}</Text>
                    </View>
                  </View>
                  <View style={styles.tipPoints}>
                    <Text style={styles.tipPointsText}>+{tip.potentialPoints}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Recent Activity */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Score Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate("XnScoreHistory")}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentHistory.length > 0 ? (
              recentHistory.map((event) => {
                const eventStyle = getEventIcon(event.type);
                return (
                  <View key={event.id} style={styles.activityCard}>
                    <View style={styles.activityLeft}>
                      <View style={[styles.activityIcon, { backgroundColor: eventStyle.color + "20" }]}>
                        <Ionicons
                          name={eventStyle.icon as keyof typeof Ionicons.glyphMap}
                          size={18}
                          color={eventStyle.color}
                        />
                      </View>
                      <View>
                        <Text style={styles.activityDescription}>{event.description}</Text>
                        <Text style={styles.activityDate}>{event.date}</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.activityPoints,
                        { color: event.points >= 0 ? "#00C6AE" : "#DC2626" },
                      ]}
                    >
                      {event.points >= 0 ? "+" : ""}{event.points}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyActivity}>
                <Ionicons name="star-outline" size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>No activity yet</Text>
                <Text style={styles.emptySubtext}>Start using TandaXn to build your score!</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  scoreTextContainer: {
    position: "absolute",
    alignItems: "center",
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scoreLabel: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  levelIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  levelName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  nextLevelSection: {
    width: "100%",
    alignItems: "center",
  },
  progressBarContainer: {
    width: "80%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 3,
  },
  nextLevelText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  content: {
    padding: 20,
  },
  streakCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  streakLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  streakIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  streakSubtitle: {
    fontSize: 13,
    color: "#B45309",
  },
  section: {
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
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  breakdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  breakdownLeft: {
    flex: 1,
    marginRight: 16,
  },
  breakdownCategory: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 6,
  },
  breakdownBarContainer: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  breakdownBar: {
    height: "100%",
    borderRadius: 3,
  },
  breakdownPoints: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 50,
    textAlign: "right",
  },
  benefitsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  tipCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  tipLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  tipDescription: {
    fontSize: 12,
    color: "#6B7280",
  },
  tipPoints: {
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tipPointsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  activityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  activityDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  activityPoints: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyActivity: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  floatingHelp: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
