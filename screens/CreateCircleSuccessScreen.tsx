import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";

type CreateCircleSuccessNavigationProp = StackNavigationProp<RootStackParamList>;
type CreateCircleSuccessRouteProp = RouteProp<RootStackParamList, "CreateCircleSuccess">;

const getCircleEmoji = (type: string): string => {
  switch (type) {
    case "traditional":
      return "🔄";
    case "goal-based":
    case "goal":
      return "🎯";
    case "emergency":
      return "🛡️";
    case "family-support":
      return "👨‍👩‍👧‍👦";
    case "beneficiary":
      return "🆘"; // Disaster Relief
    default:
      return "💰";
  }
};

export default function CreateCircleSuccessScreen() {
  const navigation = useNavigation<CreateCircleSuccessNavigationProp>();
  const route = useRoute<CreateCircleSuccessRouteProp>();
  const { createCircle } = useCircles();
  const { user } = useAuth();
  const circleSavedRef = useRef(false);
  const [createdCircleId, setCreatedCircleId] = useState<string | null>(null);

  const {
    circleType,
    name,
    amount,
    frequency,
    memberCount,
    startDate,
    rotationMethod,
    gracePeriodDays,
    invitedMembers,
    beneficiaryName,
    beneficiaryReason,
    beneficiaryPhone,
    beneficiaryCountry,
    isRecurring,
    totalCycles,
  } = route.params;

  // Check if this is a family support or disaster relief circle
  const isFamilySupport = circleType === "family-support";
  const isDisasterRelief = circleType === "beneficiary";
  const monthlyPayout = amount * memberCount;
  const totalPayoutAllCycles = monthlyPayout * (totalCycles || 1);

  // Save the circle when the screen mounts
  useEffect(() => {
    if (!circleSavedRef.current) {
      circleSavedRef.current = true;
      saveCircle();
    }
  }, []);

  const saveCircle = async () => {
    try {
      const newCircle = await createCircle({
        name,
        type: circleType as "traditional" | "goal-based" | "emergency" | "family-support" | "goal" | "beneficiary",
        amount,
        frequency: frequency as "daily" | "weekly" | "biweekly" | "monthly" | "one-time",
        memberCount,
        startDate,
        rotationMethod,
        gracePeriodDays,
        invitedMembers,
        createdBy: user?.id || "unknown",
        emoji: getCircleEmoji(circleType),
        description: beneficiaryName
          ? isRecurring && totalCycles && totalCycles > 1
            ? `Supporting ${beneficiaryName} — ${totalCycles} contributions`
            : `Supporting ${beneficiaryName}`
          : `${name} savings circle`,
        beneficiaryName,
        beneficiaryReason,
        isOneTime: frequency === "one-time",
        // Beneficiary circle specific fields
        beneficiaryPhone,
        beneficiaryCountry,
        isRecurring: isRecurring || false,
        totalCycles: totalCycles || 1,
        currentCycle: 1,
        payoutPerCycle: monthlyPayout,
        cyclesCompleted: 0,
        totalPayoutToDate: 0,
      });
      // Store the created circle ID for navigation
      setCreatedCircleId(newCircle.id);
    } catch (error) {
      console.error("Error saving circle:", error);
    }
  };

  const circleEmoji = getCircleEmoji(circleType);

  // Generate a mock invite code
  const inviteCode = name.replace(/\s+/g, "").toUpperCase().slice(0, 6) + "2025";

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleViewCircle = () => {
    // Navigate to the circle detail screen with the created circle ID
    if (createdCircleId) {
      navigation.replace("CircleDetail", { circleId: createdCircleId });
    } else {
      // Fallback to circles tab if ID not available yet
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    }
  };

  const handleInviteMore = async () => {
    try {
      await Share.share({
        message: `Join my TandaXn savings circle "${name}"! Download the app and use invite code: ${inviteCode}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          {/* Success Animation */}
          <View style={styles.successCircleOuter}>
            <View style={styles.successCircleInner}>
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.successTitle}>
            {isDisasterRelief
              ? "Relief Fund Created! 🆘"
              : `${name.length > 20 ? name.slice(0, 20) + "…" : name} Created! ${circleEmoji}`}
          </Text>
          <Text style={styles.successSubtitle}>
            {beneficiaryName
              ? `Supporting ${beneficiaryName}${isRecurring && totalCycles ? ` — ${totalCycles} contributions` : ""}`
              : `${name} is ready to go`}
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Circle Card */}
          <View style={styles.circleCard}>
            <View style={styles.circleIconContainer}>
              <Text style={styles.circleEmoji}>{circleEmoji}</Text>
            </View>
            <Text style={styles.circleName}>{name}</Text>
            <Text style={styles.circleDate}>Starting {formatDate(startDate)}</Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>${amount}</Text>
                <Text style={styles.statLabel}>
                  per {frequency === "biweekly" ? "2 wks" : frequency === "weekly" ? "week" : frequency === "daily" ? "day" : "cycle"}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{memberCount}+</Text>
                <Text style={styles.statLabel}>
                  {beneficiaryName ? "supporters" : "members"}
                </Text>
              </View>
              <View style={[styles.statItem, styles.statItemHighlight]}>
                <Text style={styles.statValueHighlight}>
                  ${monthlyPayout.toLocaleString()}+
                </Text>
                <Text style={styles.statLabel}>
                  {isRecurring ? `per ${frequency === "biweekly" ? "2 wks" : frequency === "weekly" ? "week" : "cycle"}` : isDisasterRelief ? "total relief" : "pot size"}
                </Text>
              </View>
            </View>

            {/* Recurring Support Info */}
            {isRecurring && totalCycles && totalCycles > 1 && (
              <View style={styles.recurringInfoContainer}>
                <View style={styles.recurringInfoRow}>
                  <Ionicons name="repeat" size={16} color="#00C6AE" />
                  <Text style={styles.recurringInfoText}>
                    {totalCycles} contributions
                  </Text>
                </View>
                <View style={styles.recurringTotalRow}>
                  <Text style={styles.recurringTotalLabel}>Total to {beneficiaryName}</Text>
                  <Text style={styles.recurringTotalValue}>
                    ${totalPayoutAllCycles.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Invite Code */}
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeLabel}>Circle Invite Code</Text>
              <Text style={styles.inviteCode}>{inviteCode}</Text>
            </View>
          </View>

          {/* Invites Sent */}
          {invitedMembers.length > 0 && (
            <View style={styles.invitesSentCard}>
              <View style={styles.invitesSentIcon}>
                <Ionicons name="send" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.invitesSentText}>
                <Text style={styles.invitesSentTitle}>
                  {invitedMembers.length} invite
                  {invitedMembers.length > 1 ? "s" : ""} sent!
                </Text>
                <Text style={styles.invitesSentSubtitle}>
                  They'll receive a notification to join
                </Text>
              </View>
            </View>
          )}

          {/* Next Steps */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>What's Next?</Text>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Wait for members to join</Text>
                <Text style={styles.stepDesc}>
                  Circle activates when members are ready
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, styles.stepNumberInactive]}>
                <Text style={styles.stepNumberTextInactive}>2</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Make your first contribution</Text>
                <Text style={styles.stepDesc}>Due on {formatDate(startDate)}</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, styles.stepNumberInactive]}>
                <Text style={styles.stepNumberTextInactive}>3</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Receive your payout</Text>
                <Text style={styles.stepDesc}>Based on rotation order</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.viewButton} onPress={handleViewCircle}>
          <Text style={styles.viewButtonText}>View Circle</Text>
        </TouchableOpacity>

        <View style={styles.secondaryButtons}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleInviteMore}>
            <Text style={styles.secondaryButtonText}>Invite More</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDone}>
            <Text style={styles.secondaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 100,
    alignItems: "center",
  },
  successCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successCircleInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
  },
  content: {
    marginTop: -60,
    padding: 20,
    paddingBottom: 180,
  },
  circleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  circleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  circleEmoji: {
    fontSize: 28,
  },
  circleName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  circleDate: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    width: "100%",
  },
  statItem: {
    flex: 1,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    alignItems: "center",
  },
  statItemHighlight: {
    backgroundColor: "#F0FDFB",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  statValueHighlight: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00C6AE",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  inviteCodeContainer: {
    backgroundColor: "#0A2342",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  invitesSentCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  invitesSentIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  invitesSentText: {
    flex: 1,
  },
  invitesSentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  invitesSentSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  nextStepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nextStepsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberInactive: {
    backgroundColor: "#F5F7FA",
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00C6AE",
  },
  stepNumberTextInactive: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  stepDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  footer: {
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
  viewButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  // Recurring Beneficiary Styles
  recurringInfoContainer: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    marginBottom: 16,
  },
  recurringInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  recurringInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00897B",
  },
  recurringTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,198,174,0.3)",
  },
  recurringTotalLabel: {
    fontSize: 13,
    color: "#065F46",
  },
  recurringTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
});
