import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useElder } from "../context/ElderContext";

type RootStackParamList = {
  ElderDashboard: undefined;
  BecomeElder: undefined;
  HonorScoreOverview: undefined;
  VouchSystem: undefined;
  MediationCase: undefined;
  ElderTrainingHub: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ElderDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    isElder,
    elderProfile,
    elderStats,
    vouchRequests,
    myCases,
    getHonorScoreTier,
    getElderTierInfo,
  } = useElder();

  // If not an elder yet, show the become elder CTA
  if (!isElder || !elderProfile || elderProfile.status !== "approved") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Elder System</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notElderContent}>
          <View style={styles.notElderCard}>
            <View style={styles.notElderIcon}>
              <Ionicons name="shield" size={64} color="#00C6AE" />
            </View>
            <Text style={styles.notElderTitle}>Become an Elder</Text>
            <Text style={styles.notElderDescription}>
              Elders are trusted community members who help resolve disputes,
              vouch for new members, and maintain the integrity of our savings
              circles.
            </Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>Mediate disputes and earn rewards</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>Vouch for members to help them join circles</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>Build your Honor Score and reputation</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>Earn $25+ per resolved case</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.becomeElderButton}
              onPress={() => navigation.navigate("BecomeElder")}
            >
              <Text style={styles.becomeElderButtonText}>
                Check Eligibility
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const tierInfo = getElderTierInfo(elderProfile.tier);
  const honorTierInfo = getHonorScoreTier(elderProfile.honorScore);
  const pendingRequests = vouchRequests.length;
  const activeCases = myCases.filter(
    (c) => c.status === "assigned" || c.status === "in_progress"
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elder Dashboard</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate("BecomeElder")}
        >
          <Ionicons name="settings-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Elder Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.elderInfo}>
              <Text style={styles.elderTierIcon}>{tierInfo.icon}</Text>
              <View>
                <Text style={styles.elderTierLabel}>{elderProfile.tier} Elder</Text>
                <Text style={styles.memberSince}>
                  Since {elderProfile.joinedAsElderDate}
                </Text>
              </View>
            </View>
            <View style={styles.scoreDisplay}>
              <Text
                style={[styles.honorScore, { color: honorTierInfo.color }]}
              >
                {elderProfile.honorScore}
              </Text>
              <Text style={styles.honorLabel}>Honor Score</Text>
            </View>
          </View>

          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {elderProfile.totalCasesResolved}
              </Text>
              <Text style={styles.quickStatLabel}>Cases Resolved</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {elderProfile.successRate}%
              </Text>
              <Text style={styles.quickStatLabel}>Success Rate</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {elderStats?.successfulVouches || 0}
              </Text>
              <Text style={styles.quickStatLabel}>Vouches</Text>
            </View>
          </View>
        </View>

        {/* Action Items */}
        {(pendingRequests > 0 || activeCases > 0) && (
          <View style={styles.actionItems}>
            {pendingRequests > 0 && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => navigation.navigate("VouchSystem")}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="hand-right" size={20} color="#7C3AED" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>
                    {pendingRequests} Vouch Request{pendingRequests > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.actionSubtitle}>Waiting for your review</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
            {activeCases > 0 && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => navigation.navigate("MediationCase")}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#D97706" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>
                    {activeCases} Active Case{activeCases > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.actionSubtitle}>Awaiting resolution</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>Elder Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("HonorScoreOverview")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#F0FDFB" }]}>
              <Ionicons name="trophy" size={28} color="#00C6AE" />
            </View>
            <Text style={styles.actionCardTitle}>Honor Score</Text>
            <Text style={styles.actionCardValue}>
              {elderProfile.honorScore} pts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("VouchSystem")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="hand-right" size={28} color="#7C3AED" />
            </View>
            <Text style={styles.actionCardTitle}>Vouch System</Text>
            <Text style={styles.actionCardValue}>
              {elderStats?.vouchesAvailable || 0} available
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("MediationCase")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="shield-checkmark" size={28} color="#D97706" />
            </View>
            <Text style={styles.actionCardTitle}>Mediation</Text>
            <Text style={styles.actionCardValue}>
              {elderProfile.activeCases}/{elderProfile.maxConcurrentCases} cases
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("ElderTrainingHub")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="school" size={28} color="#3B82F6" />
            </View>
            <Text style={styles.actionCardTitle}>Training</Text>
            <Text style={styles.actionCardValue}>
              {elderProfile.trainingCredits} credits
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle}>Tier Progress</Text>
            <TouchableOpacity onPress={() => navigation.navigate("ElderTrainingHub")}>
              <Text style={styles.viewAllText}>View Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.tierProgressRow}>
              <View style={styles.currentTierInfo}>
                <Text style={styles.tierProgressIcon}>{tierInfo.icon}</Text>
                <Text style={styles.tierProgressLabel}>
                  {elderProfile.tier} Elder
                </Text>
              </View>
              {elderProfile.tier !== "Grand" && (
                <View style={styles.nextTierInfo}>
                  <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                  <Text style={styles.nextTierIcon}>
                    {elderProfile.tier === "Junior" ? "🌿" : "🌳"}
                  </Text>
                  <Text style={styles.nextTierLabel}>
                    {elderProfile.tier === "Junior" ? "Senior" : "Grand"}
                  </Text>
                </View>
              )}
            </View>

            {elderProfile.tier !== "Grand" && (
              <>
                <View style={styles.progressBarRow}>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            elderProfile.tier === "Junior"
                              ? (elderProfile.trainingCredits / 100) * 100
                              : (elderProfile.trainingCredits / 250) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.progressHint}>
                  {elderProfile.tier === "Junior"
                    ? `${100 - elderProfile.trainingCredits} more credits to Senior Elder`
                    : `${250 - elderProfile.trainingCredits} more credits to Grand Elder`}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.bottomPadding} />
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
  settingsButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  // Not Elder Styles
  notElderContent: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  notElderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  notElderIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  notElderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 12,
  },
  notElderDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  benefitsList: {
    width: "100%",
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: "#4B5563",
    marginLeft: 12,
  },
  becomeElderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
  },
  becomeElderButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginRight: 8,
  },
  // Elder Dashboard Styles
  statusCard: {
    backgroundColor: "#FFFFFF",
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  elderInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  elderTierIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  elderTierLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  memberSince: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  scoreDisplay: {
    alignItems: "flex-end",
  },
  honorScore: {
    fontSize: 32,
    fontWeight: "700",
  },
  honorLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  quickStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  quickStatItem: {
    flex: 1,
    alignItems: "center",
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  quickStatLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  actionItems: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    margin: "1%",
    alignItems: "center",
  },
  actionCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  actionCardValue: {
    fontSize: 12,
    color: "#6B7280",
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: "#00C6AE",
    fontWeight: "600",
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
  },
  tierProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  currentTierInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierProgressIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  tierProgressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  nextTierInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextTierIcon: {
    fontSize: 24,
    marginHorizontal: 8,
  },
  nextTierLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  progressBarRow: {
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  bottomPadding: {
    height: 40,
  },
});
