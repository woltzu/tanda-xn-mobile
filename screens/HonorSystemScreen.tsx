import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useTrust } from "../context/TrustContext";
import { useXnScore } from "../context/XnScoreContext";

type HonorSystemNavigationProp = StackNavigationProp<RootStackParamList>;

// Honor tier thresholds and info
const HONOR_TIERS = [
  {
    id: "newcomer",
    name: "Newcomer",
    minVouches: 0,
    minSuccessRate: 0,
    color: "#9CA3AF",
    icon: "person",
    description: "Just getting started on your honor journey",
  },
  {
    id: "guardian",
    name: "Guardian",
    minVouches: 3,
    minSuccessRate: 80,
    color: "#22C55E",
    icon: "shield",
    description: "Trusted member who guides newcomers",
  },
  {
    id: "mentor",
    name: "Mentor",
    minVouches: 10,
    minSuccessRate: 90,
    color: "#3B82F6",
    icon: "school",
    description: "Experienced guide with proven track record",
  },
  {
    id: "elder",
    name: "Elder",
    minVouches: 25,
    minSuccessRate: 95,
    color: "#8B5CF6",
    icon: "diamond",
    description: "Community pillar with exceptional honor",
  },
  {
    id: "sage",
    name: "Sage",
    minVouches: 50,
    minSuccessRate: 98,
    color: "#F59E0B",
    icon: "sunny",
    description: "Legendary status with near-perfect record",
  },
];

// Available badges
const ALL_BADGES = [
  {
    id: "first_vouch",
    name: "First Vouch",
    description: "Vouched for your first member",
    icon: "hand-right",
    tier: "bronze",
    requirement: "Give your first vouch",
  },
  {
    id: "perfect_5",
    name: "Perfect Five",
    description: "5 vouched members completed without default",
    icon: "star",
    tier: "silver",
    requirement: "5 successful vouches",
  },
  {
    id: "trusted_guardian",
    name: "Trusted Guardian",
    description: "Maintained 100% success rate with 10+ vouches",
    icon: "shield-checkmark",
    tier: "gold",
    requirement: "10+ vouches, 100% success",
  },
  {
    id: "community_pillar",
    name: "Community Pillar",
    description: "Helped 25+ members join the community",
    icon: "people",
    tier: "gold",
    requirement: "25+ total vouches",
  },
  {
    id: "legendary_mentor",
    name: "Legendary Mentor",
    description: "50+ successful vouches with 98%+ success rate",
    icon: "trophy",
    tier: "platinum",
    requirement: "50+ vouches, 98% success",
  },
];

const getBadgeTierColor = (tier: string) => {
  switch (tier) {
    case "bronze":
      return "#CD7F32";
    case "silver":
      return "#C0C0C0";
    case "gold":
      return "#FFD700";
    case "platinum":
      return "#E5E4E2";
    default:
      return "#9CA3AF";
  }
};

export default function HonorSystemScreen() {
  const navigation = useNavigation<HonorSystemNavigationProp>();
  const { score } = useXnScore();
  const {
    honorStats,
    vouchRecords,
    canVouchForOthers,
    hasSecurityDeposit,
    securityDepositAmount,
  } = useTrust();

  const canVouch = canVouchForOthers(score);
  const activeVouches = vouchRecords.filter((v) => v.status === "active");

  // Calculate current honor tier
  const getCurrentHonorTier = () => {
    for (let i = HONOR_TIERS.length - 1; i >= 0; i--) {
      const tier = HONOR_TIERS[i];
      if (
        honorStats.totalVouchesGiven >= tier.minVouches &&
        honorStats.vouchSuccessRate >= tier.minSuccessRate
      ) {
        return tier;
      }
    }
    return HONOR_TIERS[0];
  };

  const currentTier = getCurrentHonorTier();
  const nextTier = HONOR_TIERS[HONOR_TIERS.indexOf(currentTier) + 1];

  // Calculate progress to next tier
  const getProgressToNextTier = () => {
    if (!nextTier) return 100;
    const vouchProgress =
      ((honorStats.totalVouchesGiven - currentTier.minVouches) /
        (nextTier.minVouches - currentTier.minVouches)) *
      100;
    return Math.min(Math.max(vouchProgress, 0), 100);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Honor System</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Honor Tier Card */}
        <View style={styles.honorCard}>
          <View
            style={[
              styles.honorIconContainer,
              { backgroundColor: currentTier.color + "30" },
            ]}
          >
            <Ionicons
              name={currentTier.icon as any}
              size={40}
              color={currentTier.color}
            />
          </View>
          <Text style={styles.honorTierName}>{currentTier.name}</Text>
          <Text style={styles.honorTierDescription}>{currentTier.description}</Text>

          {/* Progress to next tier */}
          {nextTier && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progress to {nextTier.name}</Text>
                <Text style={styles.progressPercent}>
                  {Math.round(getProgressToNextTier())}%
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${getProgressToNextTier()}%`, backgroundColor: nextTier.color },
                  ]}
                />
              </View>
              <Text style={styles.progressRequirement}>
                Need {nextTier.minVouches} vouches with {nextTier.minSuccessRate}%+ success rate
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{honorStats.totalVouchesGiven}</Text>
            <Text style={styles.statLabel}>Total Vouches</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: "#00C6AE" }]}>
              {honorStats.successfulVouches}
            </Text>
            <Text style={styles.statLabel}>Successful</Text>
          </View>
          <View style={styles.statCard}>
            <Text
              style={[
                styles.statNumber,
                { color: honorStats.defaultedVouches > 0 ? "#DC2626" : "#00C6AE" },
              ]}
            >
              {honorStats.defaultedVouches}
            </Text>
            <Text style={styles.statLabel}>Defaulted</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: "#8B5CF6" }]}>
              {honorStats.vouchSuccessRate}%
            </Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vouching Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Vouching Status</Text>

          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Ionicons
                  name={canVouch ? "checkmark-circle" : "lock-closed"}
                  size={24}
                  color={canVouch ? "#00C6AE" : "#F59E0B"}
                />
                <Text style={styles.statusText}>
                  {canVouch ? "Can Vouch for Others" : "Cannot Vouch Yet"}
                </Text>
              </View>
              {!canVouch && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Score 75+ needed</Text>
                </View>
              )}
            </View>

            {canVouch && (
              <>
                <View style={styles.statusDivider} />
                <View style={styles.statusRow}>
                  <View style={styles.statusLeft}>
                    <Ionicons name="people" size={24} color="#8B5CF6" />
                    <Text style={styles.statusText}>Active Vouches</Text>
                  </View>
                  <Text style={styles.statusValue}>
                    {activeVouches.length} / {honorStats.vouchLimit}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.statusDivider} />
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Ionicons
                  name={hasSecurityDeposit ? "shield-checkmark" : "shield-outline"}
                  size={24}
                  color={hasSecurityDeposit ? "#059669" : "#9CA3AF"}
                />
                <Text style={styles.statusText}>Security Deposit</Text>
              </View>
              <Text
                style={[
                  styles.statusValue,
                  { color: hasSecurityDeposit ? "#059669" : "#9CA3AF" },
                ]}
              >
                {hasSecurityDeposit ? `$${securityDepositAmount}` : "None"}
              </Text>
            </View>
          </View>

          {canVouch && (
            <TouchableOpacity
              style={styles.vouchButton}
              onPress={() => navigation.navigate("VouchMember")}
            >
              <Ionicons name="hand-right" size={20} color="#FFFFFF" />
              <Text style={styles.vouchButtonText}>Vouch for Someone</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Honor Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Honor Badges</Text>
          <Text style={styles.sectionSubtitle}>
            Earn badges by helping others join the community
          </Text>

          <View style={styles.badgesGrid}>
            {ALL_BADGES.map((badge) => {
              const isEarned = honorStats.honorBadges.some(
                (b) => b.id === badge.id
              );
              return (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    !isEarned && styles.badgeCardLocked,
                  ]}
                >
                  <View
                    style={[
                      styles.badgeIconContainer,
                      {
                        backgroundColor: isEarned
                          ? getBadgeTierColor(badge.tier) + "30"
                          : "#F5F7FA",
                      },
                    ]}
                  >
                    <Ionicons
                      name={badge.icon as any}
                      size={24}
                      color={isEarned ? getBadgeTierColor(badge.tier) : "#D1D5DB"}
                    />
                    {!isEarned && (
                      <View style={styles.lockedOverlay}>
                        <Ionicons name="lock-closed" size={12} color="#9CA3AF" />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.badgeName,
                      !isEarned && styles.badgeNameLocked,
                    ]}
                  >
                    {badge.name}
                  </Text>
                  <Text style={styles.badgeRequirement}>{badge.requirement}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Honor Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Honor Tiers</Text>
          <Text style={styles.sectionSubtitle}>
            Progress through tiers by vouching for trustworthy members
          </Text>

          {HONOR_TIERS.map((tier, index) => {
            const isCurrentTier = tier.id === currentTier.id;
            const isAchieved = HONOR_TIERS.indexOf(tier) <= HONOR_TIERS.indexOf(currentTier);

            return (
              <View
                key={tier.id}
                style={[
                  styles.tierCard,
                  isCurrentTier && styles.tierCardCurrent,
                ]}
              >
                <View
                  style={[
                    styles.tierIcon,
                    { backgroundColor: isAchieved ? tier.color + "20" : "#F5F7FA" },
                  ]}
                >
                  <Ionicons
                    name={tier.icon as any}
                    size={24}
                    color={isAchieved ? tier.color : "#D1D5DB"}
                  />
                </View>
                <View style={styles.tierInfo}>
                  <View style={styles.tierNameRow}>
                    <Text
                      style={[
                        styles.tierName,
                        isAchieved && { color: tier.color },
                      ]}
                    >
                      {tier.name}
                    </Text>
                    {isCurrentTier && (
                      <View style={[styles.currentBadge, { backgroundColor: tier.color }]}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tierDescription}>{tier.description}</Text>
                  <Text style={styles.tierRequirements}>
                    {tier.minVouches}+ vouches • {tier.minSuccessRate}%+ success rate
                  </Text>
                </View>
                {isAchieved && (
                  <Ionicons name="checkmark-circle" size={24} color={tier.color} />
                )}
              </View>
            );
          })}
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How the Honor System Works</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: "#EEF2FF" }]}>
                <Ionicons name="ribbon" size={20} color="#6366F1" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Build Your Reputation</Text>
                <Text style={styles.infoText}>
                  Vouch for trustworthy people to build your honor standing
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Choose Wisely</Text>
                <Text style={styles.infoText}>
                  Defaults by vouched members affect your XnScore™ (-4 pts)
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="trending-up" size={20} color="#059669" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Earn Rewards</Text>
                <Text style={styles.infoText}>
                  Higher tiers unlock badges and community recognition
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  placeholder: {
    width: 40,
  },
  honorCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  honorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  honorTierName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  honorTierDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 16,
  },
  progressSection: {
    width: "100%",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressRequirement: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#0A2342",
  },
  statusBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  statusDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  vouchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  vouchButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  badgeCardLocked: {
    opacity: 0.7,
  },
  badgeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
  },
  lockedOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 2,
  },
  badgeName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    textAlign: "center",
    marginBottom: 4,
  },
  badgeNameLocked: {
    color: "#9CA3AF",
  },
  badgeRequirement: {
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
  },
  tierCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tierCardCurrent: {
    borderColor: "#8B5CF6",
    borderWidth: 2,
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tierInfo: {
    flex: 1,
  },
  tierNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  tierName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tierDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  tierRequirements: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
});
