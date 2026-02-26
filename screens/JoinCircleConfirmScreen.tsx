import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";

type JoinCircleConfirmNavigationProp = StackNavigationProp<RootStackParamList>;
type JoinCircleConfirmRouteProp = RouteProp<RootStackParamList, "JoinCircleConfirm">;

const getCircleTypeLabel = (type: string): string => {
  switch (type) {
    case "traditional":
      return "Rotating Pot";
    case "family-support":
      return "Single Beneficiary";
    case "goal":
    case "goal-based":
      return "Shared Goal";
    case "emergency":
      return "Emergency Pool";
    case "beneficiary":
      return "Flexible Fundraise";
    default:
      return "Savings Circle";
  }
};

const getFrequencyLabel = (frequency: string): string => {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    case "one-time":
      return "One-time";
    default:
      return frequency;
  }
};

const getRotationMethodLabel = (method: string): string => {
  switch (method) {
    case "xnscore":
      return "By XnScore";
    case "random":
      return "Random Draw";
    case "manual":
      return "Manual Assignment";
    case "beneficiary":
      return "Fixed Beneficiary";
    default:
      return method;
  }
};

export default function JoinCircleConfirmScreen() {
  const navigation = useNavigation<JoinCircleConfirmNavigationProp>();
  const route = useRoute<JoinCircleConfirmRouteProp>();
  const { circleId } = route.params;
  const { circles, browseCircles, joinCircle } = useCircles();
  const { user } = useAuth();

  const [isJoining, setIsJoining] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Find the circle
  const circle = [...circles, ...browseCircles].find((c) => c.id === circleId);

  if (!circle) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circle Not Found</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.errorText}>This circle could not be found.</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const userXnScore = user?.xnScore || 0;
  const minScore = circle.minScore || 0;
  const canJoin = userXnScore >= minScore;
  const spotsLeft = circle.memberCount - circle.currentMembers;
  const isFull = spotsLeft <= 0;
  const totalPot = circle.amount * circle.memberCount;
  const yourPosition = circle.currentMembers + 1;
  const hasBeneficiary = circle.beneficiaryName;
  const isOneTime = circle.frequency === "one-time";

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getFirstContributionDate = () => {
    const startDate = new Date(circle.startDate);
    const now = new Date();
    if (startDate > now) {
      return startDate;
    }
    // If circle already started, next contribution depends on frequency
    let nextDate = new Date(startDate);
    while (nextDate <= now) {
      switch (circle.frequency) {
        case "daily":
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case "weekly":
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case "biweekly":
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case "monthly":
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        default:
          return startDate;
      }
    }
    return nextDate;
  };

  const handleJoinCircle = async () => {
    if (!canJoin || isFull || !agreedToTerms) return;

    setIsJoining(true);
    try {
      await joinCircle(circleId);
      navigation.navigate("JoinCircleSuccess", { circleId });
    } catch (error) {
      console.error("Error joining circle:", error);
      Alert.alert("Error", "Failed to join circle. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Join Circle</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Circle Info */}
          <View style={styles.circleInfo}>
            <View style={styles.circleIconContainer}>
              <Text style={styles.circleEmoji}>{circle.emoji}</Text>
            </View>
            <Text style={styles.circleName}>{circle.name}</Text>
            <View style={styles.circleTypeBadge}>
              <Text style={styles.circleTypeText}>{getCircleTypeLabel(circle.type)}</Text>
            </View>
            {circle.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#00C6AE" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* XnScore Check */}
          {!canJoin && (
            <View style={styles.scoreWarning}>
              <View style={styles.scoreWarningIcon}>
                <Ionicons name="lock-closed" size={24} color="#D97706" />
              </View>
              <View style={styles.scoreWarningContent}>
                <Text style={styles.scoreWarningTitle}>XnScore Required</Text>
                <Text style={styles.scoreWarningText}>
                  This circle requires a minimum XnScore of {minScore}. Your current score is {userXnScore}.
                </Text>
              </View>
            </View>
          )}

          {/* Full Warning */}
          {isFull && (
            <View style={styles.fullWarning}>
              <Ionicons name="people" size={20} color="#DC2626" />
              <Text style={styles.fullWarningText}>This circle is full</Text>
            </View>
          )}

          {/* Contribution Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Your Commitment</Text>

            <View style={styles.commitmentRow}>
              <View style={styles.commitmentItem}>
                <Text style={styles.commitmentLabel}>Contribution</Text>
                <Text style={styles.commitmentValue}>${circle.amount}</Text>
                <Text style={styles.commitmentSubtext}>
                  {isOneTime ? "one-time" : `per ${getFrequencyLabel(circle.frequency).toLowerCase()}`}
                </Text>
              </View>
              <View style={styles.commitmentDivider} />
              <View style={styles.commitmentItem}>
                <Text style={styles.commitmentLabel}>Total Pot</Text>
                <Text style={[styles.commitmentValue, { color: "#00C6AE" }]}>
                  ${totalPot.toLocaleString()}
                </Text>
                <Text style={styles.commitmentSubtext}>{circle.memberCount} members</Text>
              </View>
            </View>
          </View>

          {/* Position Info - For rotating circles */}
          {!hasBeneficiary && !isOneTime && (
            <View style={styles.positionCard}>
              <View style={styles.positionIcon}>
                <Ionicons name="trophy" size={24} color="#F59E0B" />
              </View>
              <View style={styles.positionContent}>
                <Text style={styles.positionLabel}>Your Payout Position</Text>
                <Text style={styles.positionNumber}>#{yourPosition}</Text>
                <Text style={styles.positionSubtext}>
                  Based on {getRotationMethodLabel(circle.rotationMethod).toLowerCase()}
                </Text>
              </View>
            </View>
          )}

          {/* Beneficiary Info - For family support circles */}
          {hasBeneficiary && (
            <View style={styles.beneficiaryCard}>
              <View style={styles.beneficiaryIcon}>
                <Ionicons name="person-circle" size={32} color="#00C6AE" />
              </View>
              <View style={styles.beneficiaryInfo}>
                <Text style={styles.beneficiaryLabel}>Funds Go To</Text>
                <Text style={styles.beneficiaryName}>{circle.beneficiaryName}</Text>
                {circle.beneficiaryReason && (
                  <Text style={styles.beneficiaryReason}>{circle.beneficiaryReason}</Text>
                )}
              </View>
            </View>
          )}

          {/* Circle Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Circle Details</Text>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.detailLabel}>Start Date</Text>
              <Text style={styles.detailValue}>{formatDate(circle.startDate)}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="repeat-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.detailLabel}>Frequency</Text>
              <Text style={styles.detailValue}>{getFrequencyLabel(circle.frequency)}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="people-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.detailLabel}>Members</Text>
              <Text style={styles.detailValue}>
                {circle.currentMembers}/{circle.memberCount}
                <Text style={{ color: spotsLeft <= 2 ? "#DC2626" : "#00C6AE" }}>
                  {" "}({spotsLeft} spots left)
                </Text>
              </Text>
            </View>

            {!isOneTime && !hasBeneficiary && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="shuffle-outline" size={18} color="#6B7280" />
                </View>
                <Text style={styles.detailLabel}>Payout Order</Text>
                <Text style={styles.detailValue}>{getRotationMethodLabel(circle.rotationMethod)}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.detailLabel}>Grace Period</Text>
              <Text style={styles.detailValue}>
                {circle.gracePeriodDays === 0 ? "None" : `${circle.gracePeriodDays} day${circle.gracePeriodDays > 1 ? "s" : ""}`}
              </Text>
            </View>

            {circle.location && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location-outline" size={18} color="#6B7280" />
                </View>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{circle.location}</Text>
              </View>
            )}
          </View>

          {/* First Contribution Info */}
          {!isOneTime && (
            <View style={styles.firstContributionCard}>
              <Ionicons name="information-circle" size={20} color="#00897B" />
              <View style={styles.firstContributionContent}>
                <Text style={styles.firstContributionTitle}>Your First Contribution</Text>
                <Text style={styles.firstContributionText}>
                  Due on <Text style={styles.boldText}>{formatDate(getFirstContributionDate().toISOString())}</Text>
                </Text>
                <Text style={styles.firstContributionAmount}>
                  Amount: <Text style={styles.boldText}>${circle.amount}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Terms Agreement */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the circle rules and understand that I commit to making{" "}
              {isOneTime ? "a one-time payment" : "regular contributions"} of ${circle.amount}
              {!isOneTime && ` ${getFrequencyLabel(circle.frequency).toLowerCase()}`}.
            </Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#6B7280" />
            <Text style={styles.disclaimerText}>
              By joining, you agree to honor your commitment to other members. Failure to contribute may affect your XnScore and standing in the community.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.joinButton,
            (!canJoin || isFull || !agreedToTerms || isJoining) && styles.joinButtonDisabled,
          ]}
          onPress={handleJoinCircle}
          disabled={!canJoin || isFull || !agreedToTerms || isJoining}
        >
          {isJoining ? (
            <Text style={styles.joinButtonText}>Joining...</Text>
          ) : (
            <>
              <Ionicons name="people" size={20} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>Join Circle</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  circleInfo: {
    alignItems: "center",
  },
  circleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  circleEmoji: {
    fontSize: 36,
  },
  circleName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  circleTypeBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  circleTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "600",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  scoreWarning: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
    gap: 12,
  },
  scoreWarningIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreWarningContent: {
    flex: 1,
  },
  scoreWarningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 4,
  },
  scoreWarningText: {
    fontSize: 13,
    color: "#B45309",
    lineHeight: 18,
  },
  fullWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  fullWarningText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 14,
  },
  commitmentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  commitmentItem: {
    flex: 1,
    alignItems: "center",
  },
  commitmentDivider: {
    width: 1,
    height: 50,
    backgroundColor: "#E5E7EB",
  },
  commitmentLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  commitmentValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
  },
  commitmentSubtext: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  positionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 14,
  },
  positionIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  positionContent: {
    flex: 1,
  },
  positionLabel: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
  },
  positionNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#B45309",
  },
  positionSubtext: {
    fontSize: 12,
    color: "#D97706",
  },
  beneficiaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#00C6AE",
    gap: 12,
  },
  beneficiaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  beneficiaryInfo: {
    flex: 1,
  },
  beneficiaryLabel: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginTop: 2,
  },
  beneficiaryReason: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  firstContributionCard: {
    flexDirection: "row",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  firstContributionContent: {
    flex: 1,
  },
  firstContributionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00897B",
    marginBottom: 4,
  },
  firstContributionText: {
    fontSize: 12,
    color: "#065F46",
  },
  firstContributionAmount: {
    fontSize: 12,
    color: "#065F46",
    marginTop: 2,
  },
  boldText: {
    fontWeight: "700",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    padding: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 16,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  joinButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  errorButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#0A2342",
    borderRadius: 10,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
