import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useXnScore } from "../context/XnScoreContext";
import { useTrust, TrustTier } from "../context/TrustContext";

type AccessRestrictedNavigationProp = StackNavigationProp<RootStackParamList>;
type AccessRestrictedRouteProp = RouteProp<RootStackParamList, "AccessRestricted">;

const ACCESS_MESSAGES = {
  contacts_only: {
    title: "Contacts-Only Access",
    description: "With your current XnScore™, you can only join circles with people from your contacts.",
    icon: "people",
    color: "#F59E0B",
    scoreNeeded: 25,
    tip: "Build your score to 25+ to receive circle invitations",
  },
  needs_vouch: {
    title: "Elder Vouch Required",
    description: "As a new member, you need an elder (score 75+) to vouch for you before joining circles.",
    icon: "hand-right",
    color: "#8B5CF6",
    scoreNeeded: 25,
    tip: "Ask a trusted elder in your network to vouch for you",
  },
  invitation_only: {
    title: "Invitation Required",
    description: "You need to be invited to join this circle. Build your score to browse public circles.",
    icon: "mail",
    color: "#3B82F6",
    scoreNeeded: 45,
    tip: "Reach score 45+ to browse and join public circles",
  },
  score_too_low: {
    title: "Score Too Low",
    description: "Your XnScore™ doesn't meet the minimum requirement for this circle.",
    icon: "trending-down",
    color: "#DC2626",
    scoreNeeded: 0,
    tip: "Keep making on-time payments to improve your score",
  },
  cannot_vouch: {
    title: "Cannot Vouch Yet",
    description: "You need an XnScore™ of 75 or higher to vouch for other members.",
    icon: "lock-closed",
    color: "#F59E0B",
    scoreNeeded: 75,
    tip: "Continue building trust to unlock vouching ability",
  },
  payout_slot_restricted: {
    title: "Payout Slot Restricted",
    description: "Your current score only allows you to select from the last 3 payout slots.",
    icon: "list",
    color: "#F59E0B",
    scoreNeeded: 60,
    tip: "Score 60+ unlocks slot 4+ positions, 75+ unlocks any slot",
  },
};

export default function AccessRestrictedScreen() {
  const navigation = useNavigation<AccessRestrictedNavigationProp>();
  const route = useRoute<AccessRestrictedRouteProp>();
  const { score, level } = useXnScore();
  const { getTrustTier } = useTrust();

  const restrictionType = route.params?.type || "score_too_low";
  const requiredScore = route.params?.requiredScore;
  const circleId = route.params?.circleId;

  const restriction = ACCESS_MESSAGES[restrictionType as keyof typeof ACCESS_MESSAGES] ||
    ACCESS_MESSAGES.score_too_low;

  const actualRequiredScore = requiredScore || restriction.scoreNeeded;
  const pointsNeeded = Math.max(0, actualRequiredScore - score);
  const trustTier = getTrustTier(score);

  const handleViewScore = () => {
    navigation.navigate("XnScoreDashboard");
  };

  const handleFindElder = () => {
    navigation.navigate("VouchMember");
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.background}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleGoBack}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: restriction.color + "30" }]}>
            <Ionicons
              name={restriction.icon as any}
              size={48}
              color={restriction.color}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>{restriction.title}</Text>
          <Text style={styles.description}>{restriction.description}</Text>

          {/* Score Card */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreSection}>
                <Text style={styles.scoreLabel}>Your Score</Text>
                <View style={styles.scoreValue}>
                  <Ionicons
                    name={level.icon as any}
                    size={20}
                    color={level.color}
                  />
                  <Text style={[styles.scoreNumber, { color: level.color }]}>{score}</Text>
                </View>
                <Text style={styles.scoreTier}>{level.name}</Text>
              </View>

              <View style={styles.scoreDivider} />

              <View style={styles.scoreSection}>
                <Text style={styles.scoreLabel}>Required</Text>
                <Text style={styles.scoreNumber}>{actualRequiredScore}</Text>
                <Text style={styles.scoreTier}>Minimum</Text>
              </View>
            </View>

            {pointsNeeded > 0 && (
              <View style={styles.pointsNeeded}>
                <Ionicons name="arrow-up" size={16} color="#F59E0B" />
                <Text style={styles.pointsNeededText}>
                  You need <Text style={styles.bold}>{pointsNeeded} more points</Text>
                </Text>
              </View>
            )}
          </View>

          {/* Tip Card */}
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={20} color="#F59E0B" />
            <Text style={styles.tipText}>{restriction.tip}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleViewScore}
            >
              <Ionicons name="analytics" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>View XnScore™ Dashboard</Text>
            </TouchableOpacity>

            {(restrictionType === "needs_vouch" || restrictionType === "contacts_only") && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleFindElder}
              >
                <Ionicons name="people" size={20} color="#00C6AE" />
                <Text style={styles.secondaryButtonText}>Find an Elder to Vouch</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.textButton}
              onPress={handleGoBack}
            >
              <Text style={styles.textButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trust Progression */}
        <View style={styles.trustProgression}>
          <Text style={styles.progressionTitle}>Trust Progression Path</Text>
          <View style={styles.progressionSteps}>
            {[
              { score: "0-24", label: "Contacts Only", active: score < 25 },
              { score: "25-44", label: "Invitations", active: score >= 25 && score < 45 },
              { score: "45+", label: "Public Circles", active: score >= 45 },
              { score: "75+", label: "Can Vouch", active: score >= 75 },
            ].map((step, index) => (
              <View key={index} style={styles.progressionStep}>
                <View
                  style={[
                    styles.progressionDot,
                    step.active && styles.progressionDotActive,
                  ]}
                >
                  {step.active && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <Text
                  style={[
                    styles.progressionScore,
                    step.active && styles.progressionTextActive,
                  ]}
                >
                  {step.score}
                </Text>
                <Text
                  style={[
                    styles.progressionLabel,
                    step.active && styles.progressionTextActive,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
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
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  scoreCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreSection: {
    flex: 1,
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  scoreValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scoreTier: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  scoreDivider: {
    width: 1,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 20,
  },
  pointsNeeded: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  pointsNeededText: {
    fontSize: 14,
    color: "#F59E0B",
  },
  bold: {
    fontWeight: "700",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,198,174,0.15)",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.4)",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00C6AE",
  },
  textButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  textButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  trustProgression: {
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  progressionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 16,
  },
  progressionSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressionStep: {
    alignItems: "center",
    flex: 1,
  },
  progressionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  progressionDotActive: {
    backgroundColor: "#00C6AE",
  },
  progressionScore: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 2,
  },
  progressionLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  progressionTextActive: {
    color: "#FFFFFF",
  },
});
