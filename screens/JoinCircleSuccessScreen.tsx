import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useXnScore } from "../context/XnScoreContext";

type JoinCircleSuccessNavigationProp = StackNavigationProp<RootStackParamList>;
type JoinCircleSuccessRouteProp = RouteProp<RootStackParamList, "JoinCircleSuccess">;

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
      return "daily";
    case "weekly":
      return "weekly";
    case "biweekly":
      return "bi-weekly";
    case "monthly":
      return "monthly";
    case "one-time":
      return "one-time";
    default:
      return frequency;
  }
};

export default function JoinCircleSuccessScreen() {
  const navigation = useNavigation<JoinCircleSuccessNavigationProp>();
  const route = useRoute<JoinCircleSuccessRouteProp>();
  const { circleId } = route.params;
  const { circles, browseCircles, myCircles } = useCircles();
  const { processCircleEvent } = useXnScore();

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Find the circle
  const circle = [...circles, ...myCircles, ...browseCircles].find((c) => c.id === circleId);

  useEffect(() => {
    // Award XnScore points for joining a circle
    processCircleEvent("joined");

    // Success animation sequence
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  if (!circle) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.errorText}>Circle not found</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.navigate("MainTabs")}
          >
            <Text style={styles.errorButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const totalPot = circle.amount * circle.memberCount;
  const yourPosition = circle.currentMembers; // You're now the last member who joined
  const hasBeneficiary = circle.beneficiaryName;
  const isOneTime = circle.frequency === "one-time";

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const getFirstContributionDate = () => {
    const startDate = new Date(circle.startDate);
    const now = new Date();
    if (startDate > now) {
      return startDate;
    }
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

  const handleViewCircle = () => {
    navigation.navigate("CircleDetail", { circleId });
  };

  const handleBackToCircles = () => {
    navigation.navigate("MainTabs");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.background}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Animation */}
          <Animated.View
            style={[
              styles.successIconContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <LinearGradient
              colors={["#00C6AE", "#00A896"]}
              style={styles.successIconGradient}
            >
              <Ionicons name="checkmark" size={48} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          {/* Success Message */}
          <Animated.View
            style={[
              styles.messageContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.congratsText}>Welcome!</Text>
            <Text style={styles.successTitle}>You've Joined</Text>
            <View style={styles.circleNameRow}>
              <Text style={styles.circleEmoji}>{circle.emoji}</Text>
              <Text style={styles.circleName}>{circle.name}</Text>
            </View>
            <Text style={styles.circleType}>{getCircleTypeLabel(circle.type)}</Text>
          </Animated.View>

          {/* Info Cards */}
          <Animated.View
            style={[
              styles.cardsContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Position Card - For rotating circles */}
            {!hasBeneficiary && !isOneTime && (
              <View style={styles.positionCard}>
                <View style={styles.positionBadge}>
                  <Text style={styles.positionNumber}>#{yourPosition}</Text>
                </View>
                <Text style={styles.positionText}>
                  You are <Text style={styles.boldText}>#{yourPosition}</Text> in the payout order
                </Text>
                <Text style={styles.positionSubtext}>
                  Your payout will come in round {yourPosition}
                </Text>
              </View>
            )}

            {/* Beneficiary Card */}
            {hasBeneficiary && (
              <View style={styles.beneficiaryInfoCard}>
                <Ionicons name="heart" size={24} color="#00C6AE" />
                <Text style={styles.beneficiaryInfoText}>
                  You're supporting <Text style={styles.boldText}>{circle.beneficiaryName}</Text>
                </Text>
              </View>
            )}

            {/* Next Steps Card */}
            <View style={styles.nextStepsCard}>
              <Text style={styles.nextStepsTitle}>What's Next?</Text>

              <View style={styles.stepItem}>
                <View style={styles.stepIcon}>
                  <Ionicons name="calendar" size={18} color="#00C6AE" />
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>First Contribution Due</Text>
                  <Text style={styles.stepValue}>
                    {formatDate(getFirstContributionDate().toISOString())}
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepIcon}>
                  <Ionicons name="cash" size={18} color="#00C6AE" />
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>Amount</Text>
                  <Text style={styles.stepValue}>
                    ${circle.amount} {isOneTime ? "(one-time)" : getFrequencyLabel(circle.frequency)}
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepIcon}>
                  <Ionicons name="people" size={18} color="#00C6AE" />
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>Circle Size</Text>
                  <Text style={styles.stepValue}>
                    {circle.currentMembers} of {circle.memberCount} members
                  </Text>
                </View>
              </View>

              <View style={[styles.stepItem, { borderBottomWidth: 0 }]}>
                <View style={styles.stepIcon}>
                  <Ionicons name="wallet" size={18} color="#00C6AE" />
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>Total Pot</Text>
                  <Text style={[styles.stepValue, { color: "#00C6AE" }]}>
                    ${totalPot.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Tip */}
            <View style={styles.tipCard}>
              <Ionicons name="bulb" size={20} color="#F59E0B" />
              <Text style={styles.tipText}>
                Set up automatic contributions from your wallet to never miss a payment and maintain your XnScore!
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.viewCircleButton} onPress={handleViewCircle}>
            <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
            <Text style={styles.viewCircleButtonText}>View Circle</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={handleBackToCircles}>
            <Text style={styles.backButtonText}>Back to Circles</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 180,
    alignItems: "center",
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  messageContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  congratsText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  circleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  circleEmoji: {
    fontSize: 28,
  },
  circleName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#00C6AE",
  },
  circleType: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  cardsContainer: {
    width: "100%",
    gap: 16,
  },
  positionCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  positionBadge: {
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  positionNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  positionText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  positionSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  boldText: {
    fontWeight: "700",
  },
  beneficiaryInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,198,174,0.15)",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.3)",
  },
  beneficiaryInfoText: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
  },
  nextStepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
    gap: 12,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  stepValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "rgba(10,35,66,0.95)",
    gap: 12,
  },
  viewCircleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  viewCircleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  backButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#F5F7FA",
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
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
