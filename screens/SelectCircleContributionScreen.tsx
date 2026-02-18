import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";

type SelectCircleContributionNavigationProp = StackNavigationProp<RootStackParamList>;

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

export default function SelectCircleContributionScreen() {
  const navigation = useNavigation<SelectCircleContributionNavigationProp>();
  const { myCircles } = useCircles();

  // Filter circles that are active and can receive contributions
  const contributableCircles = myCircles.filter(
    (circle) => circle.status === "active" || circle.status === "pending"
  );

  const handleSelectCircle = (circleId: string) => {
    navigation.navigate("MakeContribution", { circleId });
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
          <Text style={styles.headerTitle}>Pay Circle</Text>
          <View style={styles.placeholder} />
        </View>
        <Text style={styles.headerSubtitle}>
          Select a circle to make your contribution
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {contributableCircles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No Active Circles</Text>
            <Text style={styles.emptyText}>
              You haven't joined any circles yet. Join or create a circle to start making contributions.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate("CreateCircleStart")}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Create Circle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emptyButtonSecondary}
              onPress={() => navigation.navigate("JoinCircleByCode")}
            >
              <Ionicons name="search-outline" size={20} color="#00C6AE" />
              <Text style={styles.emptyButtonSecondaryText}>Find a Circle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Your Circles ({contributableCircles.length})
            </Text>

            {contributableCircles.map((circle) => (
              <TouchableOpacity
                key={circle.id}
                style={styles.circleCard}
                onPress={() => handleSelectCircle(circle.id)}
              >
                <View style={styles.circleIconContainer}>
                  <Text style={styles.circleEmoji}>{circle.emoji}</Text>
                </View>
                <View style={styles.circleInfo}>
                  <Text style={styles.circleName} numberOfLines={1}>
                    {circle.name}
                  </Text>
                  <Text style={styles.circleDetails}>
                    ${circle.amount} {getFrequencyLabel(circle.frequency)} • {circle.currentMembers} members
                  </Text>
                  {circle.status === "pending" && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingText}>Pending Start</Text>
                    </View>
                  )}
                </View>
                <View style={styles.circleRight}>
                  <Text style={styles.contributionAmount}>${circle.amount}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}

            {/* Quick Tips */}
            <View style={styles.tipsCard}>
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
                <Text style={styles.tipsTitle}>Quick Tips</Text>
              </View>
              <Text style={styles.tipsText}>
                • Pay on time to maintain your XnScore{"\n"}
                • Use the grace period if you need extra time{"\n"}
                • Contact the circle admin if you have issues
              </Text>
            </View>
          </>
        )}
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
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 16,
  },
  circleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  circleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  circleEmoji: {
    fontSize: 24,
  },
  circleInfo: {
    flex: 1,
    marginRight: 12,
  },
  circleName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  circleDetails: {
    fontSize: 13,
    color: "#6B7280",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
  },
  circleRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  contributionAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  tipsCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
  },
  tipsText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: "100%",
    marginBottom: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  emptyButtonSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#00C6AE",
  },
});
