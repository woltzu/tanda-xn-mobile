import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";

type ContributionSuccessNavigationProp = StackNavigationProp<RootStackParamList>;
type ContributionSuccessRouteProp = RouteProp<RootStackParamList, "ContributionSuccess">;

export default function ContributionSuccessScreen() {
  const navigation = useNavigation<ContributionSuccessNavigationProp>();
  const route = useRoute<ContributionSuccessRouteProp>();
  const { circleId, amount, transactionId } = route.params;
  const { circles, browseCircles, myCircles } = useCircles();

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  // Find the circle
  const circle = [...circles, ...myCircles, ...browseCircles].find((c) => c.id === circleId);

  useEffect(() => {
    // Success animation sequence
    Animated.sequence([
      // First: Scale in the circle
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      // Then: Fade in checkmark
      Animated.timing(checkmarkAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Finally: Fade in content
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
  const hasBeneficiary = circle.beneficiaryName;
  const paidMembers = Math.floor(Math.random() * (circle.currentMembers - 1)) + 2; // Mock: random number including you
  const paymentProgress = (paidMembers / circle.memberCount) * 100;

  const now = new Date();
  const timestamp = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const getNextPayoutDate = () => {
    const start = new Date(circle.startDate);
    const today = new Date();
    let next = new Date(start);

    while (next <= today) {
      switch (circle.frequency) {
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "biweekly":
          next.setDate(next.getDate() + 14);
          break;
        case "monthly":
          next.setMonth(next.getMonth() + 1);
          break;
        default:
          return next;
      }
    }
    return next;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleViewCircle = () => {
    navigation.navigate("CircleDetail", { circleId });
  };

  const handleGoHome = () => {
    navigation.navigate("MainTabs");
  };

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        message: `I just contributed $${amount.toFixed(2)} to ${circle.name} on TandaXn!\n\nTransaction ID: ${transactionId}\n\nJoin me in building financial power together!`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#059669", "#047857"]} style={styles.background}>
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
            <View style={styles.successIconOuter}>
              <Animated.View
                style={[
                  styles.successIconInner,
                  { opacity: checkmarkAnim },
                ]}
              >
                <Ionicons name="checkmark" size={48} color="#059669" />
              </Animated.View>
            </View>
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
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successSubtitle}>
              Your contribution has been received
            </Text>
          </Animated.View>

          {/* Amount Display */}
          <Animated.View
            style={[
              styles.amountContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
            <View style={styles.circleTag}>
              <Text style={styles.circleEmoji}>{circle.emoji}</Text>
              <Text style={styles.circleTagName}>{circle.name}</Text>
            </View>
          </Animated.View>

          {/* Details Card */}
          <Animated.View
            style={[
              styles.detailsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValue}>{transactionId}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{timestamp}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>TandaXn Wallet</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.statusText}>Confirmed</Text>
              </View>
            </View>
          </Animated.View>

          {/* Progress Card */}
          <Animated.View
            style={[
              styles.progressCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Cycle Progress</Text>
              <Text style={styles.progressPercentage}>{Math.round(paymentProgress)}%</Text>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${paymentProgress}%` }]} />
            </View>

            <Text style={styles.progressText}>
              {paidMembers} of {circle.memberCount} members have contributed
            </Text>

            {paymentProgress < 100 ? (
              <View style={styles.progressNote}>
                <Ionicons name="time-outline" size={16} color="#92400E" />
                <Text style={styles.progressNoteText}>
                  Waiting for {circle.memberCount - paidMembers} more members
                </Text>
              </View>
            ) : (
              <View style={styles.progressComplete}>
                <Ionicons name="sparkles" size={16} color="#059669" />
                <Text style={styles.progressCompleteText}>
                  All members have paid! Payout releasing soon.
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Beneficiary Info */}
          {hasBeneficiary && (
            <Animated.View
              style={[
                styles.beneficiaryCard,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Ionicons name="heart" size={24} color="#FFFFFF" />
              <View style={styles.beneficiaryContent}>
                <Text style={styles.beneficiaryLabel}>Your contribution is supporting</Text>
                <Text style={styles.beneficiaryName}>{circle.beneficiaryName}</Text>
              </View>
            </Animated.View>
          )}

          {/* Next Payout Info */}
          {!hasBeneficiary && circle.frequency !== "one-time" && (
            <Animated.View
              style={[
                styles.nextPayoutCard,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.nextPayoutIcon}>
                <Ionicons name="calendar" size={20} color="#F59E0B" />
              </View>
              <View style={styles.nextPayoutContent}>
                <Text style={styles.nextPayoutLabel}>Next Payout</Text>
                <Text style={styles.nextPayoutDate}>
                  {formatDate(getNextPayoutDate())}
                </Text>
              </View>
              <Text style={styles.nextPayoutAmount}>${totalPot.toLocaleString()}</Text>
            </Animated.View>
          )}

          {/* Share Button */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShareReceipt}>
            <Ionicons name="share-outline" size={18} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Share Receipt</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.viewCircleButton} onPress={handleViewCircle}>
            <Ionicons name="eye-outline" size={20} color="#059669" />
            <Text style={styles.viewCircleButtonText}>View Circle</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Ionicons name="home-outline" size={20} color="#FFFFFF" />
            <Text style={styles.homeButtonText}>Go Home</Text>
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
  successIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  messageContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
  },
  amountContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -2,
    marginBottom: 12,
  },
  circleTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 8,
  },
  circleEmoji: {
    fontSize: 18,
  },
  circleTagName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  detailsCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  detailLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  progressCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#059669",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  progressNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
  },
  progressNoteText: {
    fontSize: 12,
    color: "#92400E",
  },
  progressComplete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 8,
  },
  progressCompleteText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
  },
  beneficiaryCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  beneficiaryContent: {
    flex: 1,
  },
  beneficiaryLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  nextPayoutCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  nextPayoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextPayoutContent: {
    flex: 1,
  },
  nextPayoutLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
  },
  nextPayoutDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 2,
  },
  nextPayoutAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "rgba(5,150,105,0.95)",
    flexDirection: "row",
    gap: 12,
  },
  viewCircleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  viewCircleButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#059669",
  },
  homeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  homeButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
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
