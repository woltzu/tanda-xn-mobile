// ══════════════════════════════════════════════════════════════════════════════
// screens/AIInsightsScreen.tsx — deep-dive for the Score Hub AI Insights card.
// ══════════════════════════════════════════════════════════════════════════════
//
// Bucket A — reads from the real ai_decisions table via useDecisionHistory.
// Each card maps to one or more DecisionType values; when a relevant decision
// exists the card renders its `renderedExplanation` (already interpolated
// with the user's actual numbers by record_ai_decision).
//
// Bucket B (2026-06-20) — UX clarity + mark-as-read:
//   - HelpSheet (4 topics) replaces the Bucket-A Alert.alert placeholder
//   - First-visit coach mark (AsyncStorage @tandaxn_ai_insights_coach_seen_v1)
//   - Per-card explainer sheet — (?) glyph on each card opens it
//   - Mark-as-read: cards are auto-marked viewed after 2 s of visibility
//     (or immediately on tap), and a "New" pill is rendered while viewed_at
//     is null and the decision is < 3 days old. Viewed cards dim slightly.
//   - Telemetry: ai.help_opened, ai.card_tapped, ai.coach_dismissed,
//     ai.marked_read, ai.card_explainer_opened
//
// To wire a new metric: add its decision_type values to CARD_DECISION_TYPES.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  calcKey: string;
};

const INSIGHTS: InsightCardConfig[] = [
  {
    id: "xnscore",
    icon: "trophy-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.xnscore_card_title",
    statusKey: "ai_insights_screen.xnscore_status",
    route: Routes.XnScoreDashboard,
    calcKey: "ai_insights_screen.calc_xnscore",
  },
  {
    id: "honor",
    icon: "ribbon-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.honor_card_title",
    statusKey: "ai_insights_screen.honor_status",
    route: Routes.HonorScoreOverview,
    calcKey: "ai_insights_screen.calc_honor",
  },
  {
    id: "stress",
    icon: "pulse-outline",
    iconColor: "#F97316",
    titleKey: "ai_insights_screen.stress_card_title",
    statusKey: "ai_insights_screen.stress_status",
    route: Routes.StressScoreDashboard,
    calcKey: "ai_insights_screen.calc_stress",
  },
  {
    id: "mood",
    icon: "happy-outline",
    iconColor: "#EAB308",
    titleKey: "ai_insights_screen.mood_card_title",
    statusKey: "ai_insights_screen.mood_status",
    route: Routes.MoodInsights,
    calcKey: "ai_insights_screen.calc_mood",
  },
];

// Card id → DecisionType[] mapping. When a new decision_type is added on
// the backend (e.g., a future `honor_score_change`), append it here and
// the card automatically picks up the latest matching decision.
const CARD_DECISION_TYPES: Record<string, DecisionType[]> = {
  xnscore: ["xnscore_increase", "xnscore_decrease"],
  // Wired in migration 186. The TS DecisionType union doesn't know
  // about these yet — cast through the union so the screen can read
  // them without a hooks/useExplainableAI type bump.
  honor: ["honor_score_change" as DecisionType],
  stress: ["stress_score_change" as DecisionType],
  mood: ["mood_drift_change" as DecisionType],
};

// Bucket B — AsyncStorage gate for the first-visit coach mark.
// Versioned so we can re-prompt every user if the copy ever shifts.
const COACH_KEY = "@tandaxn_ai_insights_coach_seen_v1";

// Bucket B — HelpSheet topics. Four anchor points: what an insight is,
// where the data comes from (no third-party LLM), how to act, and why
// some cards may be empty.
type HelpTopic =
  | "what_is_insight"
  | "where_from"
  | "how_to_act"
  | "why_empty";
const HELP_TOPICS: HelpTopic[] = [
  "what_is_insight",
  "where_from",
  "how_to_act",
  "why_empty",
];

// Bucket B — auto-mark threshold. Cards visible for this many ms get
// stamped viewed_at = now(). Mirrors common notification-feed defaults.
const AUTO_VIEW_MS = 2000;

// Bucket B — "New" pill window. Once a decision is more than this many
// days old, the pill no longer renders even if viewed_at is null
// (avoids stale pills on dormant scores).
const NEW_PILL_DAYS = 3;

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

function decisionIsNew(decision: AIDecision | null): boolean {
  if (!decision) return false;
  if (decision.viewedAt) return false;
  const ageMs = Date.now() - new Date(decision.createdAt).getTime();
  return ageMs < NEW_PILL_DAYS * 24 * 60 * 60 * 1000;
}

function formatTimestamp(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export default function AIInsightsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useTypedNavigation();
  const { user } = useAuth();
  const {
    decisions,
    loading,
    markDecisionViewed,
  } = useDecisionHistory(user?.id, { limit: 50 });
  const { track } = useEventTracker();

  // Bucket A — one-shot mount fire so the focus refetch loop
  // doesn't double-emit ai.viewed.
  const viewedFiredRef = useRef(false);
  useEffect(() => {
    if (viewedFiredRef.current) return;
    viewedFiredRef.current = true;
    track({
      eventType: "ai.viewed",
      eventCategory: "score",
      eventAction: "viewed",
    });
  }, [track]);

  // Bucket B — HelpSheet + per-card explainer state.
  const [helpOpen, setHelpOpen] = useState(false);
  const [explainerCard, setExplainerCard] = useState<{
    cfg: InsightCardConfig;
    decision: AIDecision | null;
  } | null>(null);

  // Bucket B — first-visit coach mark. Auto-dismiss after 4 s or on
  // tap; AsyncStorage gate ensures it never re-shows after the first
  // visit.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_KEY);
        if (seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      } catch {
        // AsyncStorage unavailable — silently skip.
      }
    })();
  }, [coachOpacity]);
  const dismissCoach = useCallback(() => {
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(COACH_KEY, "1").catch(() => undefined);
    track({
      eventType: "ai.coach_dismissed",
      eventCategory: "score",
      eventAction: "dismissed",
    });
  }, [coachOpacity, track]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  // Bucket B — auto-mark each visible+unviewed decision after
  // AUTO_VIEW_MS. Re-fires only when the set of unviewed decision IDs
  // changes, so a quick scroll-past doesn't burn timers and a tap that
  // already marked the row doesn't double-fire.
  const unviewedIdsKey = useMemo(() => {
    return decisions
      .filter((d) => !d.viewedAt)
      .map((d) => d.id)
      .sort()
      .join(",");
  }, [decisions]);
  useEffect(() => {
    if (!unviewedIdsKey) return;
    const ids = unviewedIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) return;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const id of ids) {
      timers.push(
        setTimeout(() => {
          markDecisionViewed(id).then((ok) => {
            if (!ok) return;
            track({
              eventType: "ai.marked_read",
              eventCategory: "score",
              eventAction: "marked_read",
              eventLabel: id,
              eventValue: { source: "auto" },
            });
          });
        }, AUTO_VIEW_MS),
      );
    }
    return () => {
      for (const tid of timers) clearTimeout(tid);
    };
  }, [unviewedIdsKey, markDecisionViewed, track]);

  const handleHelpPress = useCallback(() => {
    setHelpOpen(true);
    track({
      eventType: "ai.help_opened",
      eventCategory: "score",
      eventAction: "opened",
    });
  }, [track]);

  const handleCardPress = useCallback(
    (cfg: InsightCardConfig, decision: AIDecision | null) => {
      track({
        eventType: "ai.card_tapped",
        eventCategory: "score",
        eventAction: "card_tapped",
        eventLabel: cfg.id,
      });
      if (decision && !decision.viewedAt) {
        markDecisionViewed(decision.id).then((ok) => {
          if (!ok) return;
          track({
            eventType: "ai.marked_read",
            eventCategory: "score",
            eventAction: "marked_read",
            eventLabel: decision.id,
            eventValue: { source: "tap" },
          });
        });
      }
      (navigation as any).navigate(cfg.route);
    },
    [navigation, track, markDecisionViewed],
  );

  const handleHistoryPress = useCallback(() => {
    track({
      eventType: "ai.history_opened",
      eventCategory: "score",
      eventAction: "history_opened",
    });
    (navigation as any).navigate(Routes.DecisionHistory);
  }, [navigation, track]);

  const openExplainer = useCallback(
    (cfg: InsightCardConfig, decision: AIDecision | null) => {
      setExplainerCard({ cfg, decision });
      track({
        eventType: "ai.card_explainer_opened",
        eventCategory: "score",
        eventAction: "opened",
        eventLabel: cfg.id,
      });
    },
    [track],
  );

  return (
    <View style={styles.root}>
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
              const isNew = decisionIsNew(decision);
              const viewed = !!decision?.viewedAt;
              return (
                <TouchableOpacity
                  key={cfg.id}
                  style={[styles.card, viewed && styles.cardViewed]}
                  onPress={() => handleCardPress(cfg, decision)}
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
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{t(cfg.titleKey)}</Text>
                        {isNew ? (
                          <View style={styles.newPill}>
                            <Text style={styles.newPillText}>
                              {t("ai_insights_screen.new_badge")}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.cardStatus, { color: cfg.iconColor }]}>
                        {t(cfg.statusKey)}
                      </Text>
                    </View>
                    {decision ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          openExplainer(cfg, decision);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          "ai_insights_screen.card_explainer_a11y",
                        )}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.cardInfoBtn}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    ) : null}
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

      {/* Bucket B — modals + coach mark. Mounted as siblings to the
          SafeAreaView so they sit above content but inside the screen's
          root View. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />
      <CardExplainerSheet
        payload={explainerCard}
        onClose={() => setExplainerCard(null)}
        navigate={(route) => {
          setExplainerCard(null);
          (navigation as any).navigate(route);
        }}
        t={t}
        locale={i18n.language}
      />
      {coachVisible ? (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.coachBackdrop} onPress={dismissCoach}>
            <View style={styles.coachCard}>
              <Ionicons name="bulb-outline" size={20} color="#FBBF24" />
              <Text style={styles.coachText}>
                {t("ai_insights_screen.coach_tip")}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket B subcomponents
// ─────────────────────────────────────────────────────────────────────────────

type TFn = (key: string, opts?: any) => string;

// Bucket B — HelpSheet. Four topics, each a localized title + body
// block. Modal slides from the bottom; backdrop tap dismisses.
function HelpSheet({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: TFn;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <Text style={sheetStyles.title}>
              {t("ai_insights_screen.help_sheet_title")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("ai_insights_screen.help_close")}
            >
              <Ionicons name="close" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={sheetStyles.scroll}
          >
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={sheetStyles.helpItem}>
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`ai_insights_screen.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.helpItemBody}>
                  {t(`ai_insights_screen.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Bucket B — per-card explainer. Renders the score name + full
// rendered explanation + how-it-is-calculated body + last-updated
// timestamp + CTA back to the score dashboard.
function CardExplainerSheet({
  payload,
  onClose,
  navigate,
  t,
  locale,
}: {
  payload: { cfg: InsightCardConfig; decision: AIDecision | null } | null;
  onClose: () => void;
  navigate: (route: string) => void;
  t: TFn;
  locale: string;
}) {
  if (!payload) return null;
  const { cfg, decision } = payload;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} />
              <Text style={sheetStyles.title}>{t(cfg.titleKey)}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("ai_insights_screen.help_close")}
            >
              <Ionicons name="close" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>

          {decision ? (
            <Text style={sheetStyles.explainerBody}>
              {decision.renderedExplanation}
            </Text>
          ) : (
            <Text style={sheetStyles.explainerBody}>
              {t("ai_insights_screen.empty_card_body")}
            </Text>
          )}

          <View style={sheetStyles.subBlock}>
            <Text style={sheetStyles.subHeading}>
              {t("ai_insights_screen.card_explainer_calc_heading")}
            </Text>
            <Text style={sheetStyles.subBody}>{t(cfg.calcKey)}</Text>
          </View>

          {decision ? (
            <View style={sheetStyles.subBlock}>
              <Text style={sheetStyles.subHeading}>
                {t("ai_insights_screen.card_explainer_updated_heading")}
              </Text>
              <Text style={sheetStyles.subBody}>
                {formatTimestamp(decision.createdAt, locale)}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[sheetStyles.ctaBtn, { backgroundColor: TEAL }]}
            onPress={() => navigate(cfg.route)}
          >
            <Text style={sheetStyles.ctaBtnText}>
              {t("ai_insights_screen.card_explainer_view_dashboard")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>
              {t("ai_insights_screen.help_close")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = "#0A2342";
const TEAL = "#00C6AE";

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
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
  cardViewed: {
    // Bucket B — subtle visual demotion for already-viewed cards.
    // 90% opacity keeps the card readable; the dim is just enough to
    // de-emphasize against fresh New-pill cards.
    opacity: 0.9,
    backgroundColor: "#FAFBFC",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardInfoBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
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

  newPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
  },
  newPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    letterSpacing: 0.5,
    textTransform: "uppercase",
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

  // Coach mark — same shape as Stress / Mood / Honor Bucket B.
  coachOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
  },
  coachBackdrop: {
    flex: 1,
    alignItems: "center",
    paddingTop: 160,
    paddingHorizontal: 24,
  },
  coachCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15,23,42,0.96)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    maxWidth: 320,
  },
  coachText: { flex: 1, fontSize: 13, color: "#FFF", lineHeight: 18 },
});

// Bucket B — bottom-sheet shared styles (HelpSheet + CardExplainerSheet).
const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
    maxHeight: "86%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "700", color: NAVY },
  scroll: { maxHeight: 500 },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  helpItemTitle: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 4 },
  helpItemBody: { fontSize: 13, color: "#4B5563", lineHeight: 19 },

  explainerBody: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 19,
    marginBottom: 14,
  },

  subBlock: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  subBody: { fontSize: 13, color: "#4B5563", lineHeight: 18 },

  ctaBtn: {
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  ctaBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  closeBtn: {
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#F1F5F9",
  },
  closeBtnText: { color: NAVY, fontSize: 14, fontWeight: "600" },
});
