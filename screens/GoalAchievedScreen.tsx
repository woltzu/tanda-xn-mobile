// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalAchievedScreen.tsx — GOALS-012
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 163-GOALS-012-GoalAchieved.jsx.
//
// Full-screen celebration when a goal target is reached: trophy, final
// balance + interest, achievement stats, an inspirational quote, a "share
// your story" CTA, a partner-discounts (B-items) link, and Withdraw / Done.
//
// ANIMATION NOTE — the web used CSS @keyframes for a confetti fall and a
// trophy pulse. React Native has no CSS keyframes; per the batch brief we
// render the confetti as STATIC decorative dots (no Animated loop) and keep
// the trophy static. A real Animated celebration can be layered on later.
//
// NAVIGATION — translation-only batch. onClose (X) and Done → goBack();
// share story / view B-items / withdraw resolve to "coming soon" Alert
// placeholders tagged TODO(goals-wiring).
//
// Route params (optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
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

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";

type AchievedGoal = {
  id: string;
  name: string;
  emoji: string;
  achievement: string;
  target: number;
  finalBalance: number;
  totalInterestEarned: number;
  monthsToAchieve: number;
  circlePayoutsReceived: number;
  totalContributions: number;
  startDate: string;
  achievedDate: string;
};

type GoalAchievedParams = { goal?: AchievedGoal };
type GoalAchievedRouteProp = RouteProp<
  { GoalAchieved: GoalAchievedParams },
  "GoalAchieved"
>;

const DEFAULT_GOAL: AchievedGoal = {
  id: "g1",
  name: "First Home in Atlanta",
  emoji: "🏠",
  achievement: "Become a homeowner",
  target: 25000,
  finalBalance: 25089.42,
  totalInterestEarned: 412.35,
  monthsToAchieve: 24,
  circlePayoutsReceived: 6,
  totalContributions: 24632.07,
  startDate: "Jan 15, 2024",
  achievedDate: "Jan 15, 2026",
};

// Static confetti decoration — deterministic positions so it doesn't
// re-randomize (and flicker) on re-render. No animation (see header note).
const CONFETTI_COLORS = ["#00C6AE", "#F59E0B", "#EC4899", "#8B5CF6", "#FFFFFF"];
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  top: (i * 29 + 5) % 94,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 2 === 0,
  rotate: (i * 53) % 360,
}));

export default function GoalAchievedScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<GoalAchievedRouteProp>();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const [showConfetti] = useState(true);

  // TODO(goals-wiring):
  //   onShareStory → Routes.GoalStories (compose)
  //   onViewBItems → Routes.GoalBItems
  //   onWithdraw   → Routes.GoalWithdraw
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

      {/* Static confetti decoration (behind content) */}
      {showConfetti && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {CONFETTI.map((c, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: `${c.left}%`,
                top: `${c.top}%`,
                width: 10,
                height: 10,
                backgroundColor: c.color,
                borderRadius: c.round ? 5 : 2,
                opacity: 0.7,
                transform: [{ rotate: `${c.rotate}deg` }],
              }}
            />
          ))}
        </View>
      )}

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Close */}
          <View style={styles.closeRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Main content */}
          <View style={styles.content}>
            {/* Trophy (static) */}
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.trophy}
            >
              <Text style={styles.trophyEmoji}>🏆</Text>
            </LinearGradient>

            <Text style={styles.headline}>YOU DID IT!</Text>
            <Text style={styles.subhead}>Goal Achieved: {goal.achievement}</Text>

            {/* Goal card */}
            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                <View style={{ alignItems: "flex-start" }}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalStarted}>Started {goal.startDate}</Text>
                </View>
              </View>

              {/* Final balance */}
              <View style={styles.finalBox}>
                <Text style={styles.finalLabel}>FINAL BALANCE</Text>
                <Text style={styles.finalValue}>
                  $
                  {goal.finalBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
                <Text style={styles.finalInterest}>
                  +${goal.totalInterestEarned.toFixed(2)} interest earned 📈
                </Text>
              </View>

              {/* Stats grid */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{goal.monthsToAchieve}</Text>
                  <Text style={styles.statLabel}>months to achieve</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {goal.circlePayoutsReceived}
                  </Text>
                  <Text style={styles.statLabel}>Circle payouts received</Text>
                </View>
              </View>
            </View>

            {/* Quote */}
            <View style={styles.quoteCard}>
              <Text style={styles.quoteText}>
                "Every expert was once a beginner. Every achiever was once a
                dreamer. You proved that discipline beats talent when talent
                doesn't work hard."
              </Text>
            </View>

            {/* Share story CTA */}
            <LinearGradient
              colors={[TEAL, GREEN]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shareCard}
            >
              <Text style={styles.shareTitle}>🌟 Inspire Others</Text>
              <Text style={styles.shareBody}>
                Share your achievement story to help others on their journey
              </Text>
              <TouchableOpacity
                onPress={() => comingSoon("Share My Story")}
                accessibilityRole="button"
                style={styles.shareButton}
              >
                <Text style={styles.shareButtonText}>Share My Story</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* B-items */}
            <TouchableOpacity
              onPress={() => comingSoon("Next Steps & Partner Discounts")}
              accessibilityRole="button"
              style={styles.bItemsButton}
            >
              <Text style={styles.bItemsEmoji}>🛒</Text>
              <Text style={styles.bItemsText}>
                View Next Steps & Partner Discounts
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* ===== BOTTOM CTA ===== */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={() => comingSoon("Withdraw Funds")}
            accessibilityRole="button"
            style={styles.withdrawButton}
          >
            <Text style={styles.withdrawText}>Withdraw Funds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={styles.doneButton}
          >
            <Text style={styles.doneText}>Done 🎉</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  scrollContent: { paddingBottom: 24 },

  closeRow: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingHorizontal: 20, alignItems: "center" },

  trophy: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  trophyEmoji: { fontSize: 60 },

  headline: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subhead: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },

  goalCard: {
    width: "100%",
    marginVertical: 32,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  goalEmoji: { fontSize: 40 },
  goalName: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  goalStarted: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  finalBox: {
    padding: 20,
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  finalLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  finalValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
  },
  finalInterest: { fontSize: 14, color: TEAL, marginTop: 8 },

  statsRow: { flexDirection: "row", gap: 12 },
  statBox: {
    flex: 1,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  statValue: { fontSize: 24, fontWeight: "700", color: "#FFFFFF" },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  quoteCard: {
    width: "100%",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    marginBottom: 24,
  },
  quoteText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontStyle: "italic",
    lineHeight: 22,
    textAlign: "center",
  },

  shareCard: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  shareTitle: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  shareBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
    marginBottom: 16,
    textAlign: "center",
  },
  shareButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  shareButtonText: { fontSize: 14, fontWeight: "700", color: GREEN },

  bItemsButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bItemsEmoji: { fontSize: 16 },
  bItemsText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  bottomBar: {
    backgroundColor: "rgba(10,35,66,0.95)",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    gap: 12,
  },
  withdrawButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  withdrawText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  doneButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  doneText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
});
