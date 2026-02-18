import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useElder } from "../context/ElderContext";

type RootStackParamList = {
  BecomeElder: undefined;
  ElderDashboard: undefined;
  HonorScoreOverview: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BecomeElderScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    getElderRequirements,
    checkEligibility,
    applyToBecomeElder,
    isLoading,
    isElder,
    elderProfile,
  } = useElder();

  const [isApplying, setIsApplying] = useState(false);

  const requirements = getElderRequirements();
  const isEligible = checkEligibility();
  const metCount = requirements.filter((r) => r.met).length;

  const benefits = [
    {
      icon: "shield-checkmark",
      title: "Mediate Disputes",
      description: "Help resolve conflicts and build trust in circles",
    },
    {
      icon: "star",
      title: "Earn Honor Points",
      description: "Build your reputation as a community leader",
    },
    {
      icon: "cash",
      title: "Earn Rewards",
      description: "Receive $25+ per successfully resolved case",
    },
    {
      icon: "ribbon",
      title: "Elder Badge",
      description: "Display your status as a trusted community elder",
    },
  ];

  const elderTiers = [
    {
      tier: "Junior Elder",
      icon: "🌱",
      requirements: "Starting tier",
      vouchStrength: "10 pts",
      maxCases: 3,
    },
    {
      tier: "Senior Elder",
      icon: "🌿",
      requirements: "100 training credits + 20 cases",
      vouchStrength: "25 pts",
      maxCases: 5,
    },
    {
      tier: "Grand Elder",
      icon: "🌳",
      requirements: "250 credits + 50 cases + 90% success",
      vouchStrength: "50 pts",
      maxCases: 10,
    },
  ];

  const handleApply = async () => {
    if (!isEligible) {
      Alert.alert(
        "Not Eligible",
        "Please meet all requirements before applying to become an Elder."
      );
      return;
    }

    setIsApplying(true);
    try {
      const result = await applyToBecomeElder();
      if (result.success) {
        Alert.alert("Application Submitted!", result.message, [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert("Application Failed", result.message);
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsApplying(false);
    }
  };

  // If already an Elder, show different content
  if (isElder && elderProfile?.status === "approved") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Elder Status</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.alreadyElderCard}>
            <View style={styles.elderBadge}>
              <Text style={styles.elderBadgeIcon}>
                {elderProfile.tier === "Grand"
                  ? "🌳"
                  : elderProfile.tier === "Senior"
                  ? "🌿"
                  : "🌱"}
              </Text>
            </View>
            <Text style={styles.alreadyElderTitle}>
              You're a {elderProfile.tier} Elder!
            </Text>
            <Text style={styles.alreadyElderSubtitle}>
              Thank you for serving our community
            </Text>

            <View style={styles.elderStatsRow}>
              <View style={styles.elderStatItem}>
                <Text style={styles.elderStatValue}>
                  {elderProfile.totalCasesResolved}
                </Text>
                <Text style={styles.elderStatLabel}>Cases Resolved</Text>
              </View>
              <View style={styles.elderStatItem}>
                <Text style={styles.elderStatValue}>
                  {elderProfile.successRate}%
                </Text>
                <Text style={styles.elderStatLabel}>Success Rate</Text>
              </View>
              <View style={styles.elderStatItem}>
                <Text style={styles.elderStatValue}>
                  {elderProfile.trainingCredits}
                </Text>
                <Text style={styles.elderStatLabel}>Training Credits</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Your Elder Journey</Text>

          {elderTiers.map((tier, index) => {
            const isCurrentTier = tier.tier.includes(elderProfile.tier);
            const isPastTier =
              (elderProfile.tier === "Senior" && tier.tier === "Junior Elder") ||
              (elderProfile.tier === "Grand" &&
                (tier.tier === "Junior Elder" || tier.tier === "Senior Elder"));

            return (
              <View
                key={tier.tier}
                style={[
                  styles.tierCard,
                  isCurrentTier && styles.currentTierCard,
                  isPastTier && styles.completedTierCard,
                ]}
              >
                <View style={styles.tierHeader}>
                  <Text style={styles.tierIcon}>{tier.icon}</Text>
                  <View style={styles.tierInfo}>
                    <View style={styles.tierTitleRow}>
                      <Text
                        style={[
                          styles.tierTitle,
                          isCurrentTier && styles.currentTierTitle,
                        ]}
                      >
                        {tier.tier}
                      </Text>
                      {isCurrentTier && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      )}
                      {isPastTier && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#00C6AE"
                        />
                      )}
                    </View>
                    <Text style={styles.tierRequirements}>{tier.requirements}</Text>
                  </View>
                </View>
                <View style={styles.tierStats}>
                  <View style={styles.tierStatItem}>
                    <Text style={styles.tierStatLabel}>Vouch Strength</Text>
                    <Text style={styles.tierStatValue}>{tier.vouchStrength}</Text>
                  </View>
                  <View style={styles.tierStatItem}>
                    <Text style={styles.tierStatLabel}>Max Cases</Text>
                    <Text style={styles.tierStatValue}>{tier.maxCases}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become an Elder</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield" size={48} color="#00C6AE" />
          </View>
          <Text style={styles.heroTitle}>Join Our Elder Council</Text>
          <Text style={styles.heroSubtitle}>
            Become a trusted leader who helps resolve disputes and guides our
            community to success
          </Text>
        </View>

        {/* Requirements Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.progressBadge}>
              <Text style={styles.progressText}>
                {metCount}/{requirements.length} met
              </Text>
            </View>
          </View>

          {requirements.map((req) => (
            <View key={req.id} style={styles.requirementCard}>
              <View
                style={[
                  styles.requirementStatus,
                  req.met ? styles.requirementMet : styles.requirementUnmet,
                ]}
              >
                <Ionicons
                  name={req.met ? "checkmark" : "close"}
                  size={16}
                  color={req.met ? "#00C6AE" : "#DC2626"}
                />
              </View>
              <View style={styles.requirementInfo}>
                <Text style={styles.requirementLabel}>{req.label}</Text>
                <Text style={styles.requirementCurrent}>
                  Current: {req.current}
                </Text>
              </View>
              {!req.met && (
                <View style={styles.requirementNeeded}>
                  <Text style={styles.requirementNeededText}>
                    Need: {req.required}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Benefits Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elder Benefits</Text>

          <View style={styles.benefitsGrid}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <Ionicons
                    name={benefit.icon as any}
                    size={24}
                    color="#00C6AE"
                  />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>
                  {benefit.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Elder Tiers Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elder Tiers</Text>
          <Text style={styles.sectionSubtitle}>
            Progress through tiers to unlock more privileges
          </Text>

          {elderTiers.map((tier, index) => (
            <View key={tier.tier} style={styles.tierPreviewCard}>
              <View style={styles.tierPreviewHeader}>
                <Text style={styles.tierIcon}>{tier.icon}</Text>
                <View style={styles.tierPreviewInfo}>
                  <Text style={styles.tierPreviewTitle}>{tier.tier}</Text>
                  <Text style={styles.tierPreviewReq}>{tier.requirements}</Text>
                </View>
              </View>
              <View style={styles.tierPreviewStats}>
                <Text style={styles.tierPreviewStat}>
                  Vouch: {tier.vouchStrength}
                </Text>
                <Text style={styles.tierPreviewStat}>
                  Max Cases: {tier.maxCases}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Apply Button */}
        <View style={styles.applySection}>
          <TouchableOpacity
            style={[
              styles.applyButton,
              !isEligible && styles.applyButtonDisabled,
            ]}
            onPress={handleApply}
            disabled={!isEligible || isApplying}
          >
            {isApplying ? (
              <Text style={styles.applyButtonText}>Submitting...</Text>
            ) : (
              <>
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color="#FFFFFF"
                  style={styles.applyButtonIcon}
                />
                <Text style={styles.applyButtonText}>
                  {isEligible ? "Apply to Become Elder" : "Requirements Not Met"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {!isEligible && (
            <Text style={styles.applyNote}>
              Complete all requirements above to apply
            </Text>
          )}
        </View>
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
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  progressBadge: {
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00C6AE",
  },
  requirementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  requirementStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  requirementMet: {
    backgroundColor: "#F0FDFB",
  },
  requirementUnmet: {
    backgroundColor: "#FEE2E2",
  },
  requirementInfo: {
    flex: 1,
  },
  requirementLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  requirementCurrent: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  requirementNeeded: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  requirementNeededText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
  },
  benefitsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  benefitCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    margin: "1%",
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },
  tierPreviewCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  tierPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  tierIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  tierPreviewInfo: {
    flex: 1,
  },
  tierPreviewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  tierPreviewReq: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  tierPreviewStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },
  tierPreviewStat: {
    fontSize: 12,
    color: "#6B7280",
    marginRight: 16,
  },
  applySection: {
    padding: 20,
    paddingBottom: 40,
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 16,
    borderRadius: 12,
  },
  applyButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  applyButtonIcon: {
    marginRight: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  applyNote: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
  },
  // Already Elder Styles
  alreadyElderCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
    margin: 20,
    borderRadius: 16,
  },
  elderBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  elderBadgeIcon: {
    fontSize: 40,
  },
  alreadyElderTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  alreadyElderSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },
  elderStatsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 20,
  },
  elderStatItem: {
    alignItems: "center",
  },
  elderStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00C6AE",
  },
  elderStatLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  tierCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  currentTierCard: {
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  completedTierCard: {
    opacity: 0.7,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierInfo: {
    flex: 1,
  },
  tierTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginRight: 8,
  },
  currentTierTitle: {
    color: "#00C6AE",
  },
  currentBadge: {
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#00C6AE",
  },
  tierRequirements: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  tierStats: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  tierStatItem: {
    marginRight: 24,
  },
  tierStatLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  tierStatValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
});
