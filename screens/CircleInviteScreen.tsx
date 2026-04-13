import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";
import { useOnboarding, InviteData } from "../context/OnboardingContext";
import { useCircles } from "../context/CirclesContext";
import { colors, radius, typography, spacing } from "../theme/tokens";

type CircleInviteNavigationProp = StackNavigationProp<RootStackParamList, "CircleInvite">;
type CircleInviteRouteProp = RouteProp<RootStackParamList, "CircleInvite">;

// Helper to format a date string for display
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "TBD";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

// Helper to compute an approximate next contribution date
const getNextContributionLabel = (frequency?: string): string => {
  const now = new Date();
  switch (frequency) {
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "biweekly":
      now.setDate(now.getDate() + 14);
      break;
    case "monthly":
    default:
      now.setMonth(now.getMonth() + 1);
      break;
  }
  return now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const frequencyLabel = (f?: string): string => {
  switch (f) {
    case "daily": return "day";
    case "weekly": return "week";
    case "biweekly": return "2 weeks";
    case "monthly": return "month";
    case "one-time": return "one-time";
    default: return "month";
  }
};

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
    emoji: (route.params as any)?.emoji || "\uD83D\uDCB0",
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

  // ---- Invalid invite state ----
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
            style={styles.errorBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Derived display values
  const memberCount = inviteData.members;
  const contribution = inviteData.contribution;
  const freq = inviteData.frequency || "monthly";
  const position = memberCount ? memberCount + 1 : undefined;

  return (
    <SafeAreaView style={styles.container}>
      {/* ===== HEADER ===== */}
      <LinearGradient
        colors={[colors.primaryNavy, "#1A3A5A"]}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backArrow}
            onPress={handleDecline}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circle Invitation</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== INVITE CARD ===== */}
        <View style={styles.inviteCard}>
          {/* Circle Emoji */}
          <View style={styles.emojiContainer}>
            <Text style={styles.circleEmoji}>{inviteData.emoji}</Text>
          </View>

          {/* Circle Name */}
          <Text style={styles.circleName}>{inviteData.name}</Text>

          {/* Invited By */}
          <View style={styles.inviterRow}>
            <View style={styles.inviterAvatar}>
              <Text style={styles.inviterInitial}>
                {inviteData.inviterName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.inviterText}>
              Invited by{" "}
              <Text style={styles.inviterNameText}>{inviteData.inviterName}</Text>
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* ===== CIRCLE DETAILS ===== */}
          {memberCount !== undefined && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="people-outline" size={18} color={colors.accentTeal} />
              </View>
              <Text style={styles.detailText}>{memberCount} members</Text>
            </View>
          )}

          {contribution !== undefined && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="cash-outline" size={18} color={colors.accentTeal} />
              </View>
              <Text style={styles.detailText}>
                ${contribution.toLocaleString()} / {frequencyLabel(freq)}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Ionicons name="calendar-outline" size={18} color={colors.accentTeal} />
            </View>
            <Text style={styles.detailText}>Starts soon</Text>
          </View>

          {position !== undefined && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="locate-outline" size={18} color={colors.accentTeal} />
              </View>
              <Text style={styles.detailText}>Your position: #{position}</Text>
            </View>
          )}
        </View>

        {/* ===== CONTRIBUTION SUMMARY ===== */}
        {contribution !== undefined && (
          <View style={styles.commitmentBox}>
            <Text style={styles.commitmentTitle}>Your commitment</Text>
            <Text style={styles.commitmentAmount}>
              ${contribution.toLocaleString()} per {frequencyLabel(freq)}
            </Text>
            <Text style={styles.commitmentNext}>
              Next contribution: {getNextContributionLabel(freq)}
            </Text>
          </View>
        )}

        {/* ===== WHY JOIN (Trust + Benefits) ===== */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>Why join?</Text>
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

        {/* ===== TRUST INDICATORS ===== */}
        <View style={styles.trustSection}>
          <View style={styles.trustRow}>
            <Ionicons name="heart-outline" size={16} color={colors.accentTeal} />
            <Text style={styles.trustText}>
              {inviteData.inviterName} vouched for this circle
            </Text>
          </View>
          {memberCount && memberCount > 1 && (
            <View style={styles.trustRow}>
              <View style={styles.faceStack}>
                {Array.from({ length: Math.min(memberCount, 3) }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.faceCircle,
                      { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i },
                    ]}
                  >
                    <Ionicons name="person" size={12} color={colors.textWhite} />
                  </View>
                ))}
              </View>
              <Text style={styles.trustText}>
                {memberCount} member{memberCount > 1 ? "s" : ""} already in this circle
              </Text>
            </View>
          )}
        </View>

        {/* ===== ERROR BANNER ===== */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.errorText} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* ===== ACTION BUTTONS ===== */}
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
                  <ActivityIndicator color={colors.textWhite} size="small" />
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
                <Text style={styles.declineButtonText}>Decline</Text>
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
                  Already have an account?{" "}
                  <Text style={styles.loginLinkBold}>Log In</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ---- Layout ----
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 40,
  },

  // ---- Header ----
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },

  // ---- Invite Card ----
  inviteCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,

    // subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emojiContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  circleEmoji: {
    fontSize: 40,
  },
  circleName: {
    fontSize: 22,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  inviterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.lg,
  },
  inviterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryNavy,
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
    color: colors.textSecondary,
  },
  inviterNameText: {
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },

  // ---- Detail rows (inside card) ----
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailText: {
    fontSize: typography.body,
    color: colors.primaryNavy,
    flex: 1,
  },

  // ---- Contribution Summary ----
  commitmentBox: {
    backgroundColor: colors.tealTintBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  commitmentTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  commitmentAmount: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: 4,
  },
  commitmentNext: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },

  // ---- Benefits ----
  benefitsCard: {
    backgroundColor: colors.successBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
    flex: 1,
  },

  // ---- Trust Indicators ----
  trustSection: {
    marginBottom: spacing.lg,
    gap: 10,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trustText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  faceStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  faceCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.screenBg,
  },

  // ---- Error Banner ----
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorBg,
    borderRadius: radius.medium,
    padding: 12,
    marginBottom: spacing.lg,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.bodySmall,
    color: colors.errorText,
  },

  // ---- Action Buttons ----
  actions: {
    marginTop: 4,
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

  // ---- Error / Invalid State ----
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
  errorBackButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
  },
  errorBackButtonText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },
});
