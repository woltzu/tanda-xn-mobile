// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalSetupSuccessScreen.tsx — GOALS-005b
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 156b-GOALS-005b-GoalSetupSuccess.jsx.
//
// Confirmation screen after a goal is created. Shows a summary + estimated
// interest, "boost your progress" next steps (deposit / link circle /
// auto-deposit), and a Circle → Goal → Achieve flow visualization.
//
// The web success-icon "scaleIn" CSS animation is dropped (static icon),
// matching the no-Animated convention used across the translated screens.
//
// NAVIGATION — onDone ("I'll do this later") → goBack(); "Go to My Goal" →
// GoalDetailV2, "Make First Deposit" → GoalAddMoney, "Link a Circle" →
// GoalLinkCircle (all forward the received goal). "Set Up Auto-Deposit"
// stays a "coming soon" Alert placeholder (no autopay/edit screen yet).
//
// Route params (optional):
//   goal?: { name; emoji; target; monthlyContribution; autoDepositEnabled;
//            estimatedAchieveDate; interestRate }
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const MUTED = "#6B7280";

type SuccessGoal = {
  id: string;
  name: string;
  emoji: string;
  target: number;
  monthlyContribution: number;
  autoDepositEnabled: boolean;
  linkedCircle: string | null;
  estimatedAchieveDate: string;
  interestRate: number;
};

type GoalSetupSuccessParams = { goal?: SuccessGoal };
type GoalSetupSuccessRouteProp = RouteProp<
  { GoalSetupSuccess: GoalSetupSuccessParams },
  "GoalSetupSuccess"
>;

const DEFAULT_GOAL: SuccessGoal = {
  id: "g1",
  name: "First Home in Atlanta",
  emoji: "🏠",
  target: 25000,
  monthlyContribution: 500,
  autoDepositEnabled: true,
  linkedCircle: null,
  estimatedAchieveDate: "Dec 2027",
  interestRate: 4.0,
};

export default function GoalSetupSuccessScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<GoalSetupSuccessRouteProp>();

  const goal = route.params?.goal ?? DEFAULT_GOAL;

  const monthsToGoal = Math.ceil(goal.target / (goal.monthlyContribution || 1));
  const estimatedInterest =
    (goal.target / 2) * (goal.interestRate / 100) * (monthsToGoal / 12);

  // "Go to My Goal" → GoalDetailV2, "Make First Deposit" → GoalAddMoney,
  // and "Link a Circle" → GoalLinkCircle are wired below. Only "Set Up
  // Auto-Deposit" stays a placeholder (no autopay/edit screen yet).
  const comingSoon = (label: string) =>
    Alert.alert(label, "This will be available soon.");

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <LinearGradient
        colors={[NAVY, "#143654", "#1E4D6B"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success icon + message */}
          <View style={styles.successHeader}>
            <LinearGradient
              colors={[TEAL, "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successIcon}
            >
              <Ionicons name="checkmark" size={50} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.successTitle}>Goal Created! 🎯</Text>
            <Text style={styles.successSubtitle}>
              Your journey to {goal.name} begins now
            </Text>
          </View>

          {/* Goal summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryEmojiBox}>
                <Text style={styles.summaryEmoji}>{goal.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryName}>{goal.name}</Text>
                <Text style={styles.summaryTarget}>
                  Target: ${goal.target.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>MONTHLY</Text>
                <Text style={styles.statValue}>${goal.monthlyContribution}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>ESTIMATED</Text>
                <Text style={styles.statValue}>{goal.estimatedAchieveDate}</Text>
              </View>
            </View>

            {/* Interest preview */}
            <LinearGradient
              colors={["#059669", "#047857"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.interestPreview}
            >
              <View style={styles.interestLeft}>
                <Text style={styles.interestEmoji}>📈</Text>
                <View>
                  <Text style={styles.interestApy}>
                    Earning {goal.interestRate}% APY
                  </Text>
                  <Text style={styles.interestAmount}>
                    ~${Math.round(estimatedInterest).toLocaleString()} in interest
                  </Text>
                </View>
              </View>
              <Text style={styles.interestEstimated}>estimated</Text>
            </LinearGradient>
          </View>

          {/* Next steps */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsLabel}>BOOST YOUR PROGRESS</Text>

            {/* Make first deposit */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(Routes.GoalAddMoney, {
                  goal: route.params?.goal,
                })
              }
              accessibilityRole="button"
              style={styles.stepButton}
            >
              <View style={styles.stepLeft}>
                <View style={[styles.stepIconBox, { backgroundColor: TEAL }]}>
                  <Text style={styles.stepIconEmoji}>💰</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Make First Deposit</Text>
                  <Text style={styles.stepBody}>
                    Start earning interest immediately
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Link circle */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(Routes.GoalLinkCircle, {
                  goal: route.params?.goal,
                })
              }
              accessibilityRole="button"
              style={styles.stepButton}
            >
              <View style={styles.stepLeft}>
                <View style={[styles.stepIconBox, { backgroundColor: "#1D4ED8" }]}>
                  <Text style={styles.stepIconEmoji}>🔗</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Link a Circle</Text>
                  <Text style={styles.stepBody}>
                    Auto-transfer Circle payouts here
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Auto-deposit (conditional) */}
            {!goal.autoDepositEnabled ? (
              <TouchableOpacity
                onPress={() => comingSoon("Set Up Auto-Deposit")}
                accessibilityRole="button"
                style={[styles.stepButton, { marginBottom: 0 }]}
              >
                <View style={styles.stepLeft}>
                  <View
                    style={[styles.stepIconBox, { backgroundColor: "#F59E0B" }]}
                  >
                    <Text style={styles.stepIconEmoji}>⚡</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>Set Up Auto-Deposit</Text>
                    <Text style={styles.stepBody}>Never miss a contribution</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.autoEnabledRow}>
                <Text style={styles.autoEnabledEmoji}>✅</Text>
                <Text style={styles.autoEnabledText}>
                  Auto-deposit enabled: ${goal.monthlyContribution}/month
                </Text>
              </View>
            )}
          </View>

          {/* Flow visualization */}
          <View style={styles.flowCard}>
            <Text style={styles.flowLabel}>HOW YOUR MONEY GROWS</Text>
            <View style={styles.flowRow}>
              <View style={styles.flowItem}>
                <View style={styles.flowCircleMuted}>
                  <Text style={styles.flowCircleEmoji}>🔄</Text>
                </View>
                <Text style={styles.flowName}>Circle</Text>
                <Text style={styles.flowSub}>Payouts</Text>
              </View>

              <Ionicons
                name="arrow-forward"
                size={24}
                color="rgba(255,255,255,0.4)"
              />

              <View style={styles.flowItem}>
                <View style={[styles.flowCircle, { backgroundColor: TEAL }]}>
                  <Text style={styles.flowCircleEmoji}>🎯</Text>
                </View>
                <Text style={styles.flowName}>Goal</Text>
                <Text style={[styles.flowSub, { color: TEAL }]}>+4% APY</Text>
              </View>

              <Ionicons
                name="arrow-forward"
                size={24}
                color="rgba(255,255,255,0.4)"
              />

              <View style={styles.flowItem}>
                <View style={styles.flowCircleMuted}>
                  <Text style={styles.flowCircleEmoji}>🏆</Text>
                </View>
                <Text style={styles.flowName}>Achieve</Text>
                <Text style={styles.flowSub}>Dream</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ===== BOTTOM CTA ===== */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate(Routes.GoalDetailV2, {
                goal: route.params?.goal,
              })
            }
            accessibilityRole="button"
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Go to My Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={styles.laterButton}
          >
            <Text style={styles.laterText}>I'll do this later</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  scrollContent: { paddingBottom: 24 },

  successHeader: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },

  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  summaryEmojiBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryEmoji: { fontSize: 32 },
  summaryName: { fontSize: 18, fontWeight: "700", color: NAVY },
  summaryTarget: { fontSize: 13, color: MUTED, marginTop: 4 },

  statsRow: { flexDirection: "row", gap: 12 },
  statBox: {
    flex: 1,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    alignItems: "center",
  },
  statLabel: { fontSize: 11, color: MUTED },
  statValue: { fontSize: 20, fontWeight: "700", color: NAVY, marginTop: 4 },

  interestPreview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  interestLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  interestEmoji: { fontSize: 20 },
  interestApy: { fontSize: 12, color: "rgba(255,255,255,0.9)" },
  interestAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  interestEstimated: { fontSize: 11, color: "rgba(255,255,255,0.8)" },

  nextStepsCard: {
    marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
  },
  nextStepsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 14,
  },
  stepButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 10,
  },
  stepLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  stepIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconEmoji: { fontSize: 20 },
  stepTitle: { fontSize: 14, fontWeight: "600", color: NAVY },
  stepBody: { fontSize: 12, color: MUTED, marginTop: 2 },
  autoEnabledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 10,
  },
  autoEnabledEmoji: { fontSize: 16 },
  autoEnabledText: { fontSize: 13, color: "#FFFFFF", flex: 1 },

  flowCard: {
    marginTop: 20,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
  },
  flowLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flowItem: { alignItems: "center" },
  flowCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  flowCircleMuted: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  flowCircleEmoji: { fontSize: 20 },
  flowName: { fontSize: 10, color: "rgba(255,255,255,0.7)" },
  flowSub: { fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  bottomBar: {
    backgroundColor: "rgba(10,35,66,0.95)",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  laterButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  laterText: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
});
