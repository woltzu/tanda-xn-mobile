import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";
import { useOnboarding, InviteData } from "../context/OnboardingContext";
import { useCircles } from "../context/CirclesContext";
import { colors, radius, typography } from "../theme/tokens";

type CircleInviteNavigationProp = StackNavigationProp<RootStackParamList, "CircleInvite">;
type CircleInviteRouteProp = RouteProp<RootStackParamList, "CircleInvite">;

export default function CircleInviteScreen() {
  const navigation = useNavigation<CircleInviteNavigationProp>();
  const route = useRoute<CircleInviteRouteProp>();
  const { user, isAuthenticated } = useAuth();
  const { pendingInvite, setPendingInvite, clearPendingInvite, completeStep } = useOnboarding();
  const { joinCircle } = useCircles();

  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get invite data from route params or pending invite
  const circleId = (route.params as any)?.circleId;
  const inviteData: InviteData | null = pendingInvite || {
    type: "circle",
    id: circleId,
    name: (route.params as any)?.name || "Savings Circle",
    emoji: (route.params as any)?.emoji || "💰",
    invitedBy: (route.params as any)?.inviter || "",
    inviterName: (route.params as any)?.inviterName || "A friend",
    contribution: (route.params as any)?.contribution,
    frequency: (route.params as any)?.frequency || "monthly",
    members: (route.params as any)?.members,
  };

  // If not authenticated, save invite and redirect to signup
  useEffect(() => {
    if (!isAuthenticated && inviteData) {
      setPendingInvite(inviteData);
      navigation.replace("Signup" as any);
    }
  }, [isAuthenticated]);

  const handleJoinCircle = async () => {
    if (!inviteData || !user) return;

    setIsJoining(true);
    setError(null);

    try {
      // Join the circle
      await joinCircle(inviteData.id);

      // Mark onboarding step complete
      completeStep("first_circle");

      // Clear pending invite
      clearPendingInvite();

      // Navigate to circle detail
      navigation.replace("CircleDetail", { circleId: inviteData.id });
    } catch (err: any) {
      setError(err.message || "Failed to join circle. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleDecline = () => {
    clearPendingInvite();
    navigation.goBack();
  };

  const handleSignup = () => {
    if (inviteData) {
      setPendingInvite(inviteData);
    }
    navigation.navigate("Signup" as any);
  };

  if (!inviteData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.textSecondary} />
          <Text style={styles.errorTitle}>Invalid Invite</Text>
          <Text style={styles.errorMessage}>
            This invite link is invalid or has expired.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Gradient */}
      <LinearGradient
        colors={[colors.primaryNavy, "#1A3A5A"]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDecline}
        >
          <Ionicons name="close" size={24} color={colors.textWhite} />
        </TouchableOpacity>

        {/* Circle Icon */}
        <View style={styles.circleIconContainer}>
          <LinearGradient
            colors={[colors.accentTeal, "#00A896"]}
            style={styles.circleIconGradient}
          >
            <Text style={styles.circleEmoji}>{inviteData.emoji}</Text>
          </LinearGradient>
        </View>

        <Text style={styles.inviteLabel}>You've been invited to join</Text>
        <Text style={styles.circleName}>{inviteData.name}</Text>

        <View style={styles.inviterRow}>
          <View style={styles.inviterAvatar}>
            <Text style={styles.inviterInitial}>
              {inviteData.inviterName.charAt(0)}
            </Text>
          </View>
          <Text style={styles.inviterText}>
            Invited by <Text style={styles.inviterName}>{inviteData.inviterName}</Text>
          </Text>
        </View>
      </LinearGradient>

      {/* Circle Details */}
      <View style={styles.content}>
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Circle Details</Text>

          {inviteData.contribution && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="cash-outline" size={18} color={colors.accentTeal} />
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Contribution Amount</Text>
                <Text style={styles.detailValue}>
                  ${inviteData.contribution.toLocaleString()} / {inviteData.frequency}
                </Text>
              </View>
            </View>
          )}

          {inviteData.members && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="people-outline" size={18} color={colors.accentTeal} />
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Members</Text>
                <Text style={styles.detailValue}>
                  {inviteData.members} members
                </Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="sync-outline" size={18} color={colors.accentTeal} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>How it works</Text>
              <Text style={styles.detailValue}>
                Members contribute {inviteData.frequency} and take turns receiving the pool
              </Text>
            </View>
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>Why Join?</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="shield-checkmark" size={16} color={colors.successText} />
            <Text style={styles.benefitText}>Save together with trusted members</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="trending-up" size={16} color={colors.successText} />
            <Text style={styles.benefitText}>Build your Xn Score with on-time payments</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="flash" size={16} color={colors.successText} />
            <Text style={styles.benefitText}>Access advances when you need them</Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {isAuthenticated ? (
            <>
              <TouchableOpacity
                style={[styles.joinButton, isJoining && styles.joinButtonDisabled]}
                onPress={handleJoinCircle}
                disabled={isJoining}
                activeOpacity={0.8}
              >
                {isJoining ? (
                  <ActivityIndicator color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.textWhite} />
                    <Text style={styles.joinButtonText}>Join Circle</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.declineButton}
                onPress={handleDecline}
              >
                <Text style={styles.declineButtonText}>Not Now</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.joinButton}
                onPress={handleSignup}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={20} color={colors.textWhite} />
                <Text style={styles.joinButtonText}>Sign Up to Join</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => {
                  setPendingInvite(inviteData);
                  navigation.navigate("Login" as any);
                }}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.loginLinkBold}>Log In</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleIconContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  circleIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  circleEmoji: {
    fontSize: 40,
  },
  inviteLabel: {
    fontSize: typography.label,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  circleName: {
    fontSize: 24,
    fontWeight: typography.bold,
    color: colors.textWhite,
    textAlign: "center",
    marginBottom: 16,
  },
  inviterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviterInitial: {
    fontSize: 12,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  inviterText: {
    fontSize: typography.body,
    color: "rgba(255,255,255,0.8)",
  },
  inviterName: {
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  detailsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.body,
    color: colors.primaryNavy,
  },
  benefitsCard: {
    backgroundColor: colors.successBg,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.successText,
  },
  benefitsTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.successText,
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  benefitText: {
    fontSize: typography.bodySmall,
    color: colors.successLabel,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: radius.medium,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.bodySmall,
    color: "#DC2626",
  },
  actions: {
    marginTop: "auto",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    paddingVertical: 16,
    borderRadius: radius.button,
    gap: 8,
    marginBottom: 12,
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinButtonDisabled: {
    opacity: 0.7,
  },
  joinButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  declineButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  declineButtonText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  loginLinkText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  loginLinkBold: {
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginTop: 16,
  },
  errorMessage: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
  },
  backButtonText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },
});
