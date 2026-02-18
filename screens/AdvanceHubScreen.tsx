import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAdvance, ADVANCE_TIERS, FuturePayout, AdvanceTierKey } from "../context/AdvanceContext";
import { useXnScore } from "../context/XnScoreContext";

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Helper to get advance tier info with fee and percent
const getAdvanceTierConfig = (tier: AdvanceTierKey) => {
  const tierConfig: Record<AdvanceTierKey, { maxAdvancePercent: number; advanceFee: number }> = {
    locked: { maxAdvancePercent: 0, advanceFee: 0 },
    preview: { maxAdvancePercent: 0, advanceFee: 0 },
    basic: { maxAdvancePercent: 50, advanceFee: 3.5 },
    standard: { maxAdvancePercent: 65, advanceFee: 2.5 },
    premium: { maxAdvancePercent: 80, advanceFee: 1.5 },
    elite: { maxAdvancePercent: 90, advanceFee: 1.0 },
  };
  return tierConfig[tier] || { maxAdvancePercent: 0, advanceFee: 0 };
};

/**
 * ADVANCE HUB SCREEN
 *
 * Main dashboard for "Advance on Future Payout" feature
 * Shows 3 states for each advance option:
 * - LOCKED (grey): XnScore too low
 * - PREVIEW (blue): Can see but not request
 * - ACTIVE (green): Can request advances
 */

export default function AdvanceHubScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { score, level } = useXnScore();
  const {
    getAdvanceTier,
    getTierInfo,
    canApplyForLoan,
    futurePayouts,
    getAdvanceablePayouts,
    activeLoans,
    getTotalOutstanding,
  } = useAdvance();

  const tier = getAdvanceTier(score);
  const tierInfo = getTierInfo(tier);
  const tierConfig = getAdvanceTierConfig(tier);
  const canRequest = canApplyForLoan(score);
  const advanceablePayouts = getAdvanceablePayouts();
  const totalOutstanding = getTotalOutstanding();

  // Calculate max advance capacity
  const totalMaxAdvance = useMemo(() => {
    const maxPercent = tierConfig.maxAdvancePercent || 0;
    return advanceablePayouts.reduce((sum, p) => {
      const amount = p.expectedAmount || 0;
      return sum + (amount * maxPercent / 100);
    }, 0);
  }, [advanceablePayouts, tierConfig]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getDaysUntil = (dateString: string) => {
    const diff = new Date(dateString).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Advance on Payout</Text>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => navigation.navigate("AdvanceExplanation")}
          >
            <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* XnScore Display */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreLabel}>XnScore</Text>
          </View>
          <View style={styles.tierBadge}>
            <View style={[styles.tierDot, { backgroundColor: tierInfo.color }]} />
            <Text style={styles.tierText}>{tierInfo.label} Tier</Text>
          </View>
        </View>

        {/* Advance Capacity */}
        {canRequest && (
          <View style={styles.capacityCard}>
            <View style={styles.capacityHeader}>
              <Ionicons name="flash" size={18} color="#00C6AE" />
              <Text style={styles.capacityLabel}>ADVANCE CAPACITY</Text>
            </View>
            <Text style={styles.capacityAmount}>
              Up to ${totalMaxAdvance.toLocaleString()}
            </Text>
            <Text style={styles.capacityNote}>
              Based on {advanceablePayouts.length} upcoming payout{advanceablePayouts.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        {!canRequest && (
          <View style={[styles.statusBanner, { backgroundColor: tierInfo.bgColor }]}>
            <Ionicons
              name={tier === "locked" ? "lock-closed" : "eye"}
              size={20}
              color={tierInfo.color}
            />
            <View style={styles.statusBannerText}>
              <Text style={[styles.statusBannerTitle, { color: tierInfo.color }]}>
                {tier === "locked" ? "Advances Locked" : "Preview Mode"}
              </Text>
              <Text style={styles.statusBannerDesc}>
                {tier === "locked"
                  ? `Reach XnScore 25 to preview advance options (${25 - score} more points needed)`
                  : `Reach XnScore 45 to start requesting advances (${45 - score} more points needed)`}
              </Text>
            </View>
          </View>
        )}

        {/* Active Advances Section */}
        {activeLoans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE ADVANCES</Text>
            {activeLoans.map((advance) => (
              <TouchableOpacity
                key={advance.id}
                style={styles.activeAdvanceCard}
                onPress={() => navigation.navigate("AdvanceDetails", { advanceId: advance.id })}
              >
                <View style={styles.activeAdvanceHeader}>
                  <Text style={styles.activeAdvanceCircle}>{advance.circleName}</Text>
                  <View style={[
                    styles.statusChip,
                    advance.status === "pending" && { backgroundColor: "#FEF3C7" },
                    advance.status === "approved" && { backgroundColor: "#D1FAE5" },
                    advance.status === "disbursed" && { backgroundColor: "#DBEAFE" },
                    advance.status === "repaying" && { backgroundColor: "#EDE9FE" },
                  ]}>
                    <Text style={[
                      styles.statusChipText,
                      advance.status === "pending" && { color: "#92400E" },
                      advance.status === "approved" && { color: "#065F46" },
                      advance.status === "disbursed" && { color: "#1E40AF" },
                      advance.status === "repaying" && { color: "#5B21B6" },
                    ]}>
                      {advance.status.charAt(0).toUpperCase() + advance.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.activeAdvanceBody}>
                  <View>
                    <Text style={styles.activeAdvanceAmountLabel}>Amount</Text>
                    <Text style={styles.activeAdvanceAmount}>
                      ${(advance.approvedAmount || advance.requestedAmount).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.activeAdvanceRepay}>
                    <Text style={styles.activeAdvanceAmountLabel}>Due</Text>
                    <Text style={styles.activeAdvanceDue}>
                      {formatDate(advance.expectedPayoutDate)}
                    </Text>
                  </View>
                </View>
                {["disbursed", "repaying"].includes(advance.status) && (
                  <View style={styles.repaymentProgress}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${(advance.repaidAmount / advance.totalRepayment) * 100}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {((advance.repaidAmount / advance.totalRepayment) * 100).toFixed(0)}% repaid
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Upcoming Payouts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>UPCOMING PAYOUTS</Text>
            <Text style={styles.sectionSubtitle}>
              {advanceablePayouts.length} available to advance
            </Text>
          </View>

          {futurePayouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Upcoming Payouts</Text>
              <Text style={styles.emptyStateDesc}>
                Join a savings circle to receive future payouts that you can advance
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => navigation.navigate("Circles" as any)}
              >
                <Text style={styles.emptyStateButtonText}>Browse Circles</Text>
              </TouchableOpacity>
            </View>
          ) : (
            futurePayouts.map((payout) => (
              <PayoutCard
                key={payout.id}
                payout={payout}
                tier={tier}
                tierInfo={tierInfo}
                canRequest={canRequest}
                onPress={() => {
                  if (canRequest && !payout.existingAdvanceId) {
                    navigation.navigate("RequestAdvance", { payoutId: payout.id });
                  }
                }}
              />
            ))
          )}
        </View>

        {/* How It Works Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HOW IT WORKS</Text>
          <TouchableOpacity
            style={styles.howItWorksCard}
            onPress={() => navigation.navigate("AdvanceExplanation")}
          >
            <View style={styles.howItWorksContent}>
              <View style={styles.howItWorksIcon}>
                <Ionicons name="play-circle" size={32} color="#00C6AE" />
              </View>
              <View style={styles.howItWorksText}>
                <Text style={styles.howItWorksTitle}>
                  Understand Advance on Future Payout
                </Text>
                <Text style={styles.howItWorksDesc}>
                  Learn how it works, fees, and automatic repayment
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Quick Facts */}
          <View style={styles.quickFacts}>
            <View style={styles.factItem}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <Text style={styles.factText}>Not a loan - it's YOUR future money</Text>
            </View>
            <View style={styles.factItem}>
              <Ionicons name="sync" size={20} color="#3B82F6" />
              <Text style={styles.factText}>Auto-repaid from your payout</Text>
            </View>
            <View style={styles.factItem}>
              <Ionicons name="trending-up" size={20} color="#8B5CF6" />
              <Text style={styles.factText}>On-time repayment boosts XnScore</Text>
            </View>
          </View>
        </View>

        {/* Tier Progress Section */}
        {!canRequest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>UNLOCK BETTER RATES</Text>
            <View style={styles.tierProgressCard}>
              {(Object.entries(ADVANCE_TIERS) as [AdvanceTierKey, typeof ADVANCE_TIERS.locked][])
                .filter(([key]) => key !== "locked")
                .map(([key, info], index) => {
                  const isCurrentTier = key === tier;
                  const isPastTier = score >= info.minScore;
                  const isLockedTier = score < info.minScore;
                  const keyTierConfig = getAdvanceTierConfig(key);

                  return (
                    <View key={key} style={styles.tierRow}>
                      <View style={[
                        styles.tierCircle,
                        isPastTier && { backgroundColor: info.color },
                        isLockedTier && { backgroundColor: "#E5E7EB" },
                      ]}>
                        {isPastTier ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.tierCircleText}>{info.minScore}</Text>
                        )}
                      </View>
                      <View style={styles.tierRowContent}>
                        <Text style={[
                          styles.tierRowTitle,
                          isCurrentTier && { color: info.color, fontWeight: "700" },
                        ]}>
                          {info.label}
                        </Text>
                        <Text style={styles.tierRowDesc}>
                          Up to {keyTierConfig.maxAdvancePercent}% advance • {keyTierConfig.advanceFee}% fee
                        </Text>
                      </View>
                      {isCurrentTier && (
                        <View style={[styles.currentBadge, { backgroundColor: info.bgColor }]}>
                          <Text style={[styles.currentBadgeText, { color: info.color }]}>Current</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
            </View>
          </View>
        )}

        {/* Outstanding Balance Warning */}
        {totalOutstanding > 0 && (
          <View style={styles.outstandingBanner}>
            <Ionicons name="information-circle" size={20} color="#92400E" />
            <Text style={styles.outstandingText}>
              Total outstanding: ${totalOutstanding.toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Payout Card Component with 3 states
function PayoutCard({
  payout,
  tier,
  tierInfo,
  canRequest,
  onPress,
}: {
  payout: FuturePayout;
  tier: AdvanceTierKey;
  tierInfo: typeof ADVANCE_TIERS.locked;
  canRequest: boolean;
  onPress: () => void;
}) {
  const hasAdvance = !!payout.existingAdvanceId;
  const tierConfig = getAdvanceTierConfig(tier);
  const maxAdvancePercent = tierConfig.maxAdvancePercent || 0;
  const advanceFee = tierConfig.advanceFee || 0;
  const expectedAmount = payout.expectedAmount || 0;
  const maxAdvance = (expectedAmount * maxAdvancePercent) / 100;
  const daysUntil = Math.ceil(
    (new Date(payout.expectedDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Determine card state
  const isLocked = tier === "locked";
  const isPreview = tier === "preview";
  const isActive = canRequest && !hasAdvance;

  return (
    <TouchableOpacity
      style={[
        styles.payoutCard,
        isLocked && styles.payoutCardLocked,
        isPreview && styles.payoutCardPreview,
        isActive && styles.payoutCardActive,
        hasAdvance && styles.payoutCardDisabled,
      ]}
      onPress={onPress}
      disabled={!isActive}
    >
      {/* State Badge */}
      <View style={styles.payoutCardHeader}>
        <Text style={styles.payoutCircleName}>{payout.circleName}</Text>
        {isLocked && (
          <View style={styles.stateBadgeLocked}>
            <Ionicons name="lock-closed" size={12} color="#6B7280" />
            <Text style={styles.stateBadgeText}>Locked</Text>
          </View>
        )}
        {isPreview && (
          <View style={styles.stateBadgePreview}>
            <Ionicons name="eye" size={12} color="#F59E0B" />
            <Text style={[styles.stateBadgeText, { color: "#F59E0B" }]}>Preview</Text>
          </View>
        )}
        {isActive && (
          <View style={styles.stateBadgeActive}>
            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
            <Text style={[styles.stateBadgeText, { color: "#10B981" }]}>Available</Text>
          </View>
        )}
        {hasAdvance && (
          <View style={styles.stateBadgeUsed}>
            <Ionicons name="checkmark-done" size={12} color="#3B82F6" />
            <Text style={[styles.stateBadgeText, { color: "#3B82F6" }]}>Advanced</Text>
          </View>
        )}
      </View>

      {/* Payout Details */}
      <View style={styles.payoutDetails}>
        <View style={styles.payoutDetailItem}>
          <Text style={styles.payoutDetailLabel}>Expected Payout</Text>
          <Text style={[styles.payoutDetailValue, isLocked && styles.payoutValueLocked]}>
            ${expectedAmount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.payoutDetailItem}>
          <Text style={styles.payoutDetailLabel}>Payout Date</Text>
          <Text style={[styles.payoutDetailValue, isLocked && styles.payoutValueLocked]}>
            {formatDate(payout.expectedDate)}
          </Text>
        </View>
      </View>

      {/* Advance Info */}
      {!isLocked && (
        <View style={styles.advanceInfoRow}>
          <View style={styles.advanceInfoItem}>
            <Text style={styles.advanceInfoLabel}>Max Advance</Text>
            <Text style={styles.advanceInfoValue}>
              ${maxAdvance.toLocaleString()} ({maxAdvancePercent}%)
            </Text>
          </View>
          <View style={styles.advanceInfoItem}>
            <Text style={styles.advanceInfoLabel}>Fee</Text>
            <Text style={styles.advanceInfoValue}>{advanceFee}%</Text>
          </View>
        </View>
      )}

      {/* Action Area */}
      {isActive && (
        <View style={styles.payoutAction}>
          <Text style={styles.payoutActionText}>Request Advance</Text>
          <Ionicons name="arrow-forward" size={16} color="#00C6AE" />
        </View>
      )}

      {isPreview && (
        <View style={styles.payoutPreviewNote}>
          <Ionicons name="information-circle" size={14} color="#F59E0B" />
          <Text style={styles.payoutPreviewNoteText}>
            Reach XnScore 45 to request this advance
          </Text>
        </View>
      )}

      {isLocked && (
        <View style={styles.payoutLockedNote}>
          <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
          <Text style={styles.payoutLockedNoteText}>
            Reach XnScore 25 to unlock
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 198, 174, 0.2)",
    borderWidth: 3,
    borderColor: "#00C6AE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scoreLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: -2,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tierText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  capacityCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  capacityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  capacityLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  capacityAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  capacityNote: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusBannerText: {
    flex: 1,
    marginLeft: 12,
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  statusBannerDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  activeAdvanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  activeAdvanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  activeAdvanceCircle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  activeAdvanceBody: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  activeAdvanceAmountLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 2,
  },
  activeAdvanceAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  activeAdvanceRepay: {
    alignItems: "flex-end",
  },
  activeAdvanceDue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  repaymentProgress: {
    marginTop: 12,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 12,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    marginTop: 16,
    backgroundColor: "#00C6AE",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  payoutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  payoutCardLocked: {
    opacity: 0.7,
    backgroundColor: "#F9FAFB",
  },
  payoutCardPreview: {
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
  },
  payoutCardActive: {
    borderColor: "#00C6AE",
  },
  payoutCardDisabled: {
    opacity: 0.6,
  },
  payoutCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  payoutCircleName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  stateBadgeLocked: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stateBadgePreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stateBadgeActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stateBadgeUsed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 4,
  },
  payoutDetails: {
    flexDirection: "row",
    marginBottom: 12,
  },
  payoutDetailItem: {
    flex: 1,
  },
  payoutDetailLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 2,
  },
  payoutDetailValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  payoutValueLocked: {
    color: "#9CA3AF",
  },
  advanceInfoRow: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  advanceInfoItem: {
    flex: 1,
  },
  advanceInfoLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 2,
  },
  advanceInfoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  payoutAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
    paddingVertical: 10,
  },
  payoutActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
    marginRight: 6,
  },
  payoutPreviewNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  payoutPreviewNoteText: {
    fontSize: 12,
    color: "#F59E0B",
    marginLeft: 6,
  },
  payoutLockedNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  payoutLockedNoteText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 6,
  },
  howItWorksCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  howItWorksContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  howItWorksIcon: {
    marginRight: 12,
  },
  howItWorksText: {
    flex: 1,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  howItWorksDesc: {
    fontSize: 12,
    color: "#6B7280",
  },
  quickFacts: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
  },
  factItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  factText: {
    fontSize: 13,
    color: "#374151",
    marginLeft: 10,
  },
  tierProgressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  tierCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tierCircleText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  tierRowContent: {
    flex: 1,
  },
  tierRowTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  tierRowDesc: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  outstandingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  outstandingText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#92400E",
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
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
