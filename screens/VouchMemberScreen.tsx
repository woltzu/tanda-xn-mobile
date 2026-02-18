import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useTrust } from "../context/TrustContext";
import { useXnScore } from "../context/XnScoreContext";
import MemberTrustBadge from "../components/MemberTrustBadge";

type VouchMemberNavigationProp = StackNavigationProp<RootStackParamList>;
type VouchMemberRouteProp = RouteProp<RootStackParamList, "VouchMember">;

// Mock users who need vouching (Critical tier users)
const USERS_NEEDING_VOUCH = [
  {
    id: "user_1",
    name: "Fatou Diallo",
    score: 12,
    phone: "+1 555-0101",
    isContact: true,
    requestedCircle: "Family Savings Circle",
  },
  {
    id: "user_2",
    name: "Kofi Mensah",
    score: 18,
    phone: "+1 555-0102",
    isContact: true,
    requestedCircle: null,
  },
  {
    id: "user_3",
    name: "Amara Toure",
    score: 8,
    phone: "+1 555-0103",
    isContact: false,
    requestedCircle: "Community Support",
  },
];

export default function VouchMemberScreen() {
  const navigation = useNavigation<VouchMemberNavigationProp>();
  const route = useRoute<VouchMemberRouteProp>();
  const { score } = useXnScore();
  const {
    canVouchForOthers,
    honorStats,
    vouchForUser,
    vouchRecords,
  } = useTrust();

  const [searchQuery, setSearchQuery] = useState("");
  const [isVouching, setIsVouching] = useState(false);

  const canVouch = canVouchForOthers(score);
  const activeVouches = vouchRecords.filter((v) => v.status === "active");
  const remainingVouches = honorStats.vouchLimit - activeVouches.length;

  const filteredUsers = USERS_NEEDING_VOUCH.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVouch = async (userId: string, userName: string) => {
    if (!canVouch) {
      Alert.alert(
        "Cannot Vouch",
        "You need an XnScore™ of 75 or higher to vouch for others.",
        [{ text: "OK" }]
      );
      return;
    }

    if (remainingVouches <= 0) {
      Alert.alert(
        "Vouch Limit Reached",
        `You can only have ${honorStats.vouchLimit} active vouches at a time. Wait for a vouched member to complete their circle or revoke an existing vouch.`,
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Vouch for Member",
      `Are you sure you want to vouch for ${userName}?\n\nBy vouching, you confirm this person is trustworthy. If they default on payments, your XnScore™ may be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Vouch",
          onPress: async () => {
            setIsVouching(true);
            const success = await vouchForUser(userId, userName);
            setIsVouching(false);

            if (success) {
              Alert.alert(
                "Vouch Successful",
                `You are now vouching for ${userName}. They can now join circles with your endorsement.`,
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            } else {
              Alert.alert("Error", "Could not complete the vouch. Please try again.");
            }
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>Vouch for Member</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Elder Status Card */}
        <View style={styles.elderCard}>
          <View style={styles.elderLeft}>
            <View style={styles.elderIcon}>
              <Ionicons name="people" size={24} color="#8B5CF6" />
            </View>
            <View>
              <Text style={styles.elderTitle}>Your Vouching Power</Text>
              <Text style={styles.elderSubtitle}>
                {canVouch ? "Active Elder Status" : "Score 75+ required"}
              </Text>
            </View>
          </View>
          <View style={styles.vouchCount}>
            <Text style={styles.vouchCountNumber}>{remainingVouches}</Text>
            <Text style={styles.vouchCountLabel}>remaining</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{honorStats.totalVouchesGiven}</Text>
            <Text style={styles.statLabel}>Total Vouches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{honorStats.successfulVouches}</Text>
            <Text style={styles.statLabel}>Successful</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#00C6AE" }]}>
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
        {/* Warning Card */}
        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            <Text style={styles.bold}>Vouching Responsibility:</Text> If a member you vouch for
            defaults on payments, your XnScore™ may be reduced by up to 4 points per incident.
            Only vouch for people you trust.
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Active Vouches */}
        {activeVouches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Active Vouches ({activeVouches.length})</Text>
            {activeVouches.map((vouch) => (
              <View key={vouch.id} style={styles.activeVouchCard}>
                <View style={styles.activeVouchLeft}>
                  <View style={styles.activeVouchAvatar}>
                    <Text style={styles.activeVouchAvatarText}>
                      {vouch.vouchedUserName.charAt(0)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.activeVouchName}>{vouch.vouchedUserName}</Text>
                    <Text style={styles.activeVouchDate}>
                      Vouched {new Date(vouch.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.activeVouchStatus}>
                  <Ionicons name="checkmark-circle" size={16} color="#00C6AE" />
                  <Text style={styles.activeVouchStatusText}>Active</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Users Needing Vouch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>People Who Need Vouching</Text>
          <Text style={styles.sectionSubtitle}>
            These new members need an elder to vouch for them before joining circles
          </Text>

          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{user.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{user.name}</Text>
                      {user.isContact && (
                        <View style={styles.contactBadge}>
                          <Ionicons name="people" size={10} color="#3B82F6" />
                          <Text style={styles.contactBadgeText}>Contact</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userPhone}>{user.phone}</Text>
                  </View>
                  <View style={styles.userScore}>
                    <Ionicons name="alert-circle" size={14} color="#DC2626" />
                    <Text style={styles.userScoreText}>{user.score}</Text>
                  </View>
                </View>

                {user.requestedCircle && (
                  <View style={styles.requestedCircle}>
                    <Ionicons name="people-circle-outline" size={16} color="#6B7280" />
                    <Text style={styles.requestedCircleText}>
                      Wants to join: <Text style={styles.bold}>{user.requestedCircle}</Text>
                    </Text>
                  </View>
                )}

                <View style={styles.userFooter}>
                  <View style={styles.userStats}>
                    <Text style={styles.userStatText}>New member</Text>
                    <Text style={styles.userStatDot}>•</Text>
                    <Text style={styles.userStatText}>No history yet</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.vouchButton,
                      (!canVouch || remainingVouches <= 0) && styles.vouchButtonDisabled,
                    ]}
                    onPress={() => handleVouch(user.id, user.name)}
                    disabled={!canVouch || remainingVouches <= 0 || isVouching}
                  >
                    <Ionicons
                      name="hand-right"
                      size={16}
                      color={canVouch && remainingVouches > 0 ? "#FFFFFF" : "#9CA3AF"}
                    />
                    <Text
                      style={[
                        styles.vouchButtonText,
                        (!canVouch || remainingVouches <= 0) && styles.vouchButtonTextDisabled,
                      ]}
                    >
                      Vouch
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Results</Text>
              <Text style={styles.emptySubtitle}>
                No users found matching your search
              </Text>
            </View>
          )}
        </View>

        {/* How Vouching Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Vouching Works</Text>
          <View style={styles.howItWorksCard}>
            <View style={styles.howItWorksItem}>
              <View style={[styles.howItWorksIcon, { backgroundColor: "#EEF2FF" }]}>
                <Text style={styles.howItWorksNumber}>1</Text>
              </View>
              <View style={styles.howItWorksContent}>
                <Text style={styles.howItWorksTitle}>You Vouch</Text>
                <Text style={styles.howItWorksText}>
                  Endorse a new member you trust
                </Text>
              </View>
            </View>

            <View style={styles.howItWorksItem}>
              <View style={[styles.howItWorksIcon, { backgroundColor: "#F0FDFB" }]}>
                <Text style={styles.howItWorksNumber}>2</Text>
              </View>
              <View style={styles.howItWorksContent}>
                <Text style={styles.howItWorksTitle}>They Join</Text>
                <Text style={styles.howItWorksText}>
                  They can join circles with your backing
                </Text>
              </View>
            </View>

            <View style={styles.howItWorksItem}>
              <View style={[styles.howItWorksIcon, { backgroundColor: "#FEF3C7" }]}>
                <Text style={styles.howItWorksNumber}>3</Text>
              </View>
              <View style={styles.howItWorksContent}>
                <Text style={styles.howItWorksTitle}>Build Trust</Text>
                <Text style={styles.howItWorksText}>
                  They build their own score over time
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
  elderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.15)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  elderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  elderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(139,92,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  elderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  elderSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  vouchCount: {
    alignItems: "center",
  },
  vouchCountNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  vouchCountLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 14,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  bold: {
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0A2342",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  activeVouchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  activeVouchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeVouchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  activeVouchAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  activeVouchName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  activeVouchDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  activeVouchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeVouchStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00C6AE",
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DC262620",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#DC2626",
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  contactBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  contactBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#3B82F6",
  },
  userPhone: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  userScore: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  userScoreText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
  requestedCircle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  requestedCircleText: {
    fontSize: 13,
    color: "#6B7280",
  },
  userFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userStatText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  userStatDot: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  vouchButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  vouchButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  vouchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  vouchButtonTextDisabled: {
    color: "#9CA3AF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  howItWorksCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  howItWorksItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  howItWorksIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  howItWorksNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  howItWorksContent: {
    flex: 1,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  howItWorksText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
