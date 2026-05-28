// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceRejectedScreen.tsx — ADVANCE-018 denial + improvement path
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 120-ADVANCE-018-AdvanceRejected.jsx.
//
// Denial screen with actionable next steps. Four reason codes drive
// the title/copy:
//   - xnscore_low         (below threshold — shows full XnScore
//                          progress + improvements + alternative)
//   - no_upcoming_payout  (needs an active circle first)
//   - existing_advance    (one-active-at-a-time policy)
//   - new_user            (no XnScore history yet)
//
// Only the `xnscore_low` branch renders the score-progress card and
// the per-action improvements list. The alternative-product card
// renders whenever `rejection.alternativeProduct` is present.
//
// Route params (all optional, defaults match canonical mock):
//   rejection?: Rejection
//   improvements?: Improvement[]
//
// Navigation:
//   - back → goBack
//   - "Apply for {alternative}" → AdvanceHubV2 (start fresh from the
//     hub so the user sees the active product available to them)
//   - "See All Ways to Improve →" → XnScoreDashboard (existing
//     improvements UI)
//   - "Back to Home" → goBack (typically lands on Dashboard since
//     this screen is usually a push)
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";

type RejectionReason =
  | "xnscore_low"
  | "no_upcoming_payout"
  | "existing_advance"
  | "new_user";

type AlternativeProduct = {
  name: string;
  maxAmount: number;
  minScore: number;
};

type Rejection = {
  advanceType: string;
  requestedAmount: number;
  reason: RejectionReason;
  currentXnScore: number;
  requiredXnScore: number;
  alternativeProduct?: AlternativeProduct;
};

type Improvement = {
  action: string;
  points: string;
  timeframe: string;
};

type AdvanceRejectedParams = {
  rejection?: Rejection;
  improvements?: Improvement[];
};
type AdvanceRejectedRouteProp = RouteProp<
  { AdvanceRejected: AdvanceRejectedParams },
  "AdvanceRejected"
>;

const DEFAULT_REJECTION: Rejection = {
  advanceType: "Flex Advance",
  requestedAmount: 1000,
  reason: "xnscore_low",
  currentXnScore: 68,
  requiredXnScore: 75,
  alternativeProduct: {
    name: "Quick Advance",
    maxAmount: 400,
    minScore: 65,
  },
};

const DEFAULT_IMPROVEMENTS: Improvement[] = [
  { action: "Complete current circle", points: "+3", timeframe: "2 weeks" },
  {
    action: "Make 2 on-time contributions",
    points: "+2",
    timeframe: "This month",
  },
  { action: "Refer a friend who joins", points: "+2", timeframe: "Anytime" },
];

function rejectionMessage(rejection: Rejection) {
  switch (rejection.reason) {
    case "xnscore_low":
      return {
        title: "XnScore Below Requirement",
        description: `${rejection.advanceType} requires XnScore ${rejection.requiredXnScore}+. You're at ${rejection.currentXnScore}.`,
      };
    case "no_upcoming_payout":
      return {
        title: "No Upcoming Payout",
        description:
          "Advances are secured by your circle payouts. Join a circle to become eligible.",
      };
    case "existing_advance":
      return {
        title: "Active Advance Exists",
        description:
          "You can only have one active advance at a time. Repay your current advance first.",
      };
    case "new_user":
      return {
        title: "Build Your History First",
        description:
          "Complete at least one circle contribution to establish your XnScore.",
      };
  }
}

export default function AdvanceRejectedScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<AdvanceRejectedRouteProp>();

  const rejection = route.params?.rejection ?? DEFAULT_REJECTION;
  const improvements = route.params?.improvements ?? DEFAULT_IMPROVEMENTS;
  const message = rejectionMessage(rejection);

  const progressPct = Math.min(
    100,
    Math.round(
      (rejection.currentXnScore / rejection.requiredXnScore) * 100,
    ),
  );
  const pointsNeeded = rejection.requiredXnScore - rejection.currentXnScore;
  const isScoreLow = rejection.reason === "xnscore_low";

  const handleTryAlternative = () =>
    navigation.navigate(Routes.AdvanceHubV2);
  const handleViewImprovements = () =>
    navigation.navigate(Routes.XnScoreDashboard);
  const handleGoHome = () => navigation.goBack();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Advance Request</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.heroBlock}>
            <View style={styles.heroIconBox}>
              <Ionicons name="alert-circle" size={40} color={AMBER} />
            </View>
            <Text style={styles.heroTitle}>{message.title}</Text>
            <Text style={styles.heroBody}>{message.description}</Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* XnScore progress card (only for xnscore_low) */}
          {isScoreLow && (
            <View style={styles.scoreCard}>
              <View style={styles.scoreHeader}>
                <View>
                  <Text style={styles.scoreLabel}>Your XnScore</Text>
                  <Text style={styles.scoreCurrent}>
                    {rejection.currentXnScore}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.scoreLabel}>Required</Text>
                  <Text style={styles.scoreRequired}>
                    {rejection.requiredXnScore}
                  </Text>
                </View>
              </View>

              {/* Gradient progress bar */}
              <View style={styles.progressBg}>
                <LinearGradient
                  colors={[AMBER, TEAL]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>

              <Text style={styles.scoreFooter}>
                You need{" "}
                <Text style={styles.scoreFooterEmphasis}>
                  {pointsNeeded} more points
                </Text>{" "}
                to unlock {rejection.advanceType}
              </Text>
            </View>
          )}

          {/* Improvements (only for xnscore_low) */}
          {isScoreLow && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                How to reach {rejection.requiredXnScore} XnScore
              </Text>
              <View style={styles.improvementsList}>
                {improvements.map((item, idx) => (
                  <View key={idx} style={styles.improvementRow}>
                    <View style={styles.improvementLeft}>
                      <View style={styles.stepBubble}>
                        <Text style={styles.stepBubbleText}>{idx + 1}</Text>
                      </View>
                      <View>
                        <Text style={styles.improvementAction}>
                          {item.action}
                        </Text>
                        <Text style={styles.improvementTime}>
                          {item.timeframe}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsBadgeText}>{item.points}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.improveButton}
                onPress={handleViewImprovements}
                accessibilityRole="button"
                accessibilityLabel="See all ways to improve"
              >
                <Text style={styles.improveButtonText}>
                  See All Ways to Improve →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Alternative product (when present) */}
          {rejection.alternativeProduct && (
            <View style={styles.alternativeCard}>
              <View style={styles.alternativeRow}>
                <View style={styles.alternativeIconBox}>
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alternativeEyebrow}>YOU QUALIFY FOR</Text>
                  <Text style={styles.alternativeName}>
                    {rejection.alternativeProduct.name}
                  </Text>
                  <Text style={styles.alternativeMeta}>
                    Up to ${rejection.alternativeProduct.maxAmount} • Min
                    XnScore {rejection.alternativeProduct.minScore}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.alternativeButton}
                onPress={handleTryAlternative}
                accessibilityRole="button"
                accessibilityLabel={`Apply for ${rejection.alternativeProduct.name}`}
              >
                <Text style={styles.alternativeButtonText}>
                  Apply for {rejection.alternativeProduct.name}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Encouragement */}
          <View style={styles.encouragementCard}>
            <Text style={styles.encouragementEmoji}>🌱</Text>
            <Text style={styles.encouragementTitle}>
              Keep building your XnScore!
            </Text>
            <Text style={styles.encouragementBody}>
              Every on-time contribution moves you closer to unlocking better
              advance options with lower rates.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleGoHome}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 80, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  heroBlock: { alignItems: "center" },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(217,119,6,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 280,
    textAlign: "center",
    lineHeight: 22,
  },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  scoreLabel: { fontSize: 12, color: MUTED },
  scoreCurrent: {
    fontSize: 28,
    fontWeight: "700",
    color: AMBER,
    marginTop: 2,
  },
  scoreRequired: {
    fontSize: 28,
    fontWeight: "700",
    color: TEAL,
    marginTop: 2,
  },
  progressBg: {
    height: 12,
    backgroundColor: BORDER,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: { height: 12, borderRadius: 6 },
  scoreFooter: { fontSize: 13, color: MUTED, textAlign: "center" },
  scoreFooterEmphasis: { color: TEAL, fontWeight: "700" },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  improvementsList: { gap: 10 },
  improvementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  improvementLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  stepBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBubbleText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEAL,
  },
  improvementAction: { fontSize: 13, fontWeight: "600", color: NAVY },
  improvementTime: { fontSize: 11, color: MUTED, marginTop: 2 },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
  },
  pointsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEAL,
  },
  improveButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TEAL,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  improveButtonText: { fontSize: 13, fontWeight: "600", color: TEAL },

  alternativeCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: TEAL,
  },
  alternativeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  alternativeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  alternativeEyebrow: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
    marginBottom: 4,
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 4,
  },
  alternativeMeta: { fontSize: 13, color: "#047857" },
  alternativeButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  alternativeButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  encouragementCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  encouragementEmoji: { fontSize: 32 },
  encouragementTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginTop: 8,
    textAlign: "center",
  },
  encouragementBody: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  homeButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
  },
  homeButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
