// ══════════════════════════════════════════════════════════════════════════════
// screens/AIInsightsScreen.tsx — deep-dive for the Score Hub AI Insights card.
// ══════════════════════════════════════════════════════════════════════════════
//
// Bucket A (Explainable AI) — reads from the real ai_decisions table via
// useDecisionHistory. Each card maps to one or more DecisionType values:
//
//   XnScore card → xnscore_increase | xnscore_decrease
//   Honor card   → honor_score_change   (migration 186)
//   Stress card  → stress_score_change  (migration 186)
//   Mood card    → mood_drift_change    (migration 186)
//
// When a relevant decision exists, the card renders its `renderedExplanation`
// — already interpolated with the user's actual numbers by record_ai_decision.
// When no decision exists (no events yet OR no trigger wired), an empty-state
// card asks the user to keep using TandaXn to generate insights.
//
// Bucket A polish (2026-06-20):
//   - Each card is tappable and routes to the corresponding score dashboard
//   - Footer "See full history →" link routes to DecisionHistoryScreen
//   - Header (?) button shows an Alert placeholder (HelpSheet lands in Bucket B)
//   - Empty state is localized
//   - useEventTracker fires ai.viewed once on mount
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useAuth } from "../context/AuthContext";
import { useDecisionHistory, DecisionType, AIDecision } from "../hooks/useExplainableAI";
import { useEventTracker } from "../hooks/useEventTracker";
import { Routes } from "../lib/routes";
import { colors } from "../theme/tokens";

type InsightCardConfig = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  titleKey: string;
  statusKey: string;
  route: string;
};

const INSIGHTS: InsightCardConfig[] = [
  {
    id: "xnscore",
    icon: "trophy-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.xnscore_card_title",
    statusKey: "ai_insights_screen.xnscore_status",
    route: Routes.XnScoreDashboard,
  },
  {
    id: "honor",
    icon: "ribbon-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.honor_card_title",
    statusKey: "ai_insights_screen.honor_status",
    route: Routes.HonorScoreOverview,
  },
  {
    id: "stress",
    icon: "pulse-outline",
    iconColor: "#F97316",
    titleKey: "ai_insights_screen.stress_card_title",
    statusKey: "ai_insights_screen.stress_status",
    route: Routes.StressScoreDashboard,
  },
  {
    id: "mood",
    icon: "happy-outline",
    iconColor: "#EAB308",
    titleKey: "ai_insights_screen.mood_card_title",
    statusKey: "ai_insights_screen.mood_status",
    route: Routes.MoodInsights,
  },
];

// Card id → DecisionType[] mapping. When a new decision_type is added on
// the backend (e.g., a future `honor_score_change`), append it here and
// the card automatically picks up the latest matching decision.
const CARD_DECISION_TYPES: Record<string, DecisionType[]> = {
  xnscore: ["xnscore_increase", "xnscore_decrease"],
  // Wired in Bucket B (migration 186). The TS DecisionType union doesn't
  // know about these yet — cast through the union so the screen can read
  // them without a hooks/useExplainableAI type bump.
  honor: ["honor_score_change" as DecisionType],
  stress: ["stress_score_change" as DecisionType],
  mood: ["mood_drift_change" as DecisionType],
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
  const { track } = useEventTracker();

  const viewedFired = useRef(false);
  useEffect(() => {
    if (viewedFired.current) return;
    viewedFired.current = true;
    track({
      eventType: "ai.viewed",
      eventCategory: "score",
      eventAction: "viewed",
    });
  }, [track]);

  const handleHelpPress = () => {
    Alert.alert(
      t("ai_insights_screen.help_placeholder_title"),
      t("ai_insights_screen.help_placeholder_body"),
    );
  };

  const handleCardPress = (cfg: InsightCardConfig) => {
    track({
      eventType: "ai.card_tapped",
      eventCategory: "score",
      eventAction: "card_tapped",
      eventLabel: cfg.id,
    });
    (navigation as any).navigate(cfg.route);
  };

  const handleHistoryPress = () => {
    track({
      eventType: "ai.history_opened",
      eventCategory: "score",
      eventAction: "history_opened",
    });
    (navigation as any).navigate(Routes.DecisionHistory);
  };

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
            <TouchableOpacity
              onPress={handleHelpPress}
              style={styles.helpBtn}
              accessibilityRole="button"
              accessibilityLabel={t("ai_insights_screen.help_button_a11y")}
            >
              <Ionicons
                name="help-circle-outline"
                size={22}
                color={colors.textWhite}
              />
            </TouchableOpacity>
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
              <TouchableOpacity
                key={cfg.id}
                style={styles.card}
                onPress={() => handleCardPress(cfg)}
                accessibilityRole="button"
                accessibilityLabel={t(cfg.titleKey)}
                activeOpacity={0.85}
              >
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
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textSecondary}
                  />
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
                      {t("ai_insights_screen.empty_card_body")}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===== FOOTER: See full history ===== */}
        <TouchableOpacity
          onPress={handleHistoryPress}
          style={styles.historyLink}
          accessibilityRole="button"
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={colors.accentTeal}
          />
          <Text style={styles.historyLinkText}>
            {t("ai_insights_screen.view_history_link")}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.accentTeal}
          />
        </TouchableOpacity>
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
  helpBtn: {
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

  historyLink: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  historyLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accentTeal,
  },
});
