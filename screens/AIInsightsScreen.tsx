// ══════════════════════════════════════════════════════════════════════════════
// screens/AIInsightsScreen.tsx — deep-dive for the Score Hub AI Insights card.
// ══════════════════════════════════════════════════════════════════════════════
//
// Bucket A (Explainable AI) — reads from the real ai_decisions table via
// useDecisionHistory. Each card maps to one or more DecisionType values:
//
//   XnScore card → xnscore_increase | xnscore_decrease
//   Honor / Stress / Mood → no DecisionType wired yet (template seeded in
//     migration 046 but no trigger fires for these metrics today).
//
// When a relevant decision exists, the card renders its `renderedExplanation`
// — already interpolated with the user's actual numbers by record_ai_decision.
// When no decision exists (no events yet OR no trigger wired), an empty-state
// card asks the user to keep using TandaXn to generate insights.
//
// To wire a new metric: add its decision_type values to CARD_DECISION_TYPES.
// No screen refactor needed — the render path is unified.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useAuth } from "../context/AuthContext";
import { useDecisionHistory, DecisionType, AIDecision } from "../hooks/useExplainableAI";
import { colors } from "../theme/tokens";

type InsightCardConfig = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  titleKey: string;
  statusKey: string;
};

const INSIGHTS: InsightCardConfig[] = [
  {
    id: "xnscore",
    icon: "trophy-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.xnscore_card_title",
    statusKey: "ai_insights_screen.xnscore_status",
  },
  {
    id: "honor",
    icon: "ribbon-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.honor_card_title",
    statusKey: "ai_insights_screen.honor_status",
  },
  {
    id: "stress",
    icon: "pulse-outline",
    iconColor: "#F97316",
    titleKey: "ai_insights_screen.stress_card_title",
    statusKey: "ai_insights_screen.stress_status",
  },
  {
    id: "mood",
    icon: "happy-outline",
    iconColor: "#EAB308",
    titleKey: "ai_insights_screen.mood_card_title",
    statusKey: "ai_insights_screen.mood_status",
  },
];

// Card id → DecisionType[] mapping. When a new decision_type is added on
// the backend (e.g., a future `honor_score_change`), append it here and
// the card automatically picks up the latest matching decision.
const CARD_DECISION_TYPES: Record<string, DecisionType[]> = {
  xnscore: ["xnscore_increase", "xnscore_decrease"],
  honor: [],
  stress: [],
  mood: [],
};

function pickLatestDecisionForCard(
  decisions: AIDecision[],
  cardId: string,
): AIDecision | null {
  const types = CARD_DECISION_TYPES[cardId] ?? [];
  if (types.length === 0) return null;
  // useDecisionHistory returns decisions ordered by created_at DESC, so
  // the first matching one is the latest.
  return decisions.find((d) => types.includes(d.decisionType)) ?? null;
}

export default function AIInsightsScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const { user } = useAuth();
  const { decisions, loading } = useDecisionHistory(user?.id, { limit: 50 });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
        <LinearGradient
          colors={[colors.primaryNavy, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
            </TouchableOpacity>
            <View style={styles.headerTitleRow}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={colors.accentTeal}
              />
              <Text style={styles.headerTitle}>
                {t("ai_insights_screen.header_title")}
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <Text style={styles.headerSubtitle}>
            {t("ai_insights_screen.header_subtitle")}
          </Text>
        </LinearGradient>

        {/* ===== INSIGHT CARDS ===== */}
        <View style={styles.cardsWrap}>
          {INSIGHTS.map((cfg) => {
            const decision = pickLatestDecisionForCard(decisions, cfg.id);
            return (
              <View key={cfg.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: `${cfg.iconColor}1A` },
                    ]}
                  >
                    <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{t(cfg.titleKey)}</Text>
                    <Text style={[styles.cardStatus, { color: cfg.iconColor }]}>
                      {t(cfg.statusKey)}
                    </Text>
                  </View>
                </View>

                {loading && !decision ? (
                  <View style={styles.skeletonCard}>
                    <View style={styles.skeletonLine} />
                    <View
                      style={[styles.skeletonLine, { width: "70%", marginTop: 6 }]}
                    />
                  </View>
                ) : decision ? (
                  <View style={styles.explanationCard}>
                    <Ionicons
                      name="bulb-outline"
                      size={14}
                      color={colors.accentTeal}
                    />
                    <Text style={styles.explanationText}>
                      {decision.renderedExplanation}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color="#9CA3AF"
                    />
                    <Text style={styles.emptyText}>
                      We don't have a specific explanation yet. Keep using
                      TandaXn to generate insights.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: colors.textWhite,
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.textOnNavy,
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 2,
  },

  cardsWrap: { padding: 16 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  explanationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.tealTintBg,
    padding: 12,
    borderRadius: 10,
  },
  explanationText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },

  emptyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 10,
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
    fontStyle: "italic",
  },

  skeletonCard: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 10,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 5,
    width: "100%",
  },
});
