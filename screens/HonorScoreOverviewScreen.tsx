import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
// Honor Bucket A — the screen now reads the real backend dashboard hook
// instead of the AsyncStorage-backed elderProfile.honorScore mock. Same
// shape as the post-Bucket-A XnScore Dashboard: one composite hook that
// fans out into score/tier/pillars/history/weakestPillar.
import { useHonorScoreDashboard, useHonorScoreHistory, useHonorScorePillarBreakdown } from "../hooks/useHonorScore";
import {
  HonorScoreEngine,
  HonorScoreTier,
} from "../services/HonorScoreEngine";

type RootStackParamList = {
  HonorScoreOverview: undefined;
  BecomeElder: undefined;
  // Honor Bucket B — tip CTAs route here.
  VouchMember: undefined;
  Circles: undefined;
  ElderTrainingHub: undefined;
  ScoreHub: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Honor Bucket B — AsyncStorage gate for the first-visit coach mark.
// Versioned so we can re-prompt every user if the copy ever shifts.
const COACH_KEY = "@tandaxn_honor_coach_seen_v1";

// Honor Bucket B — six topics rendered together in one scrollable
// HelpSheet, opened by the header (?) button.
type HelpTopic =
  | "what_is_honor_score"
  | "three_pillars"
  | "vouching_works"
  | "disputes_affect"
  | "expertise_domains"
  | "tier_ladder";
const HELP_TOPICS: HelpTopic[] = [
  "what_is_honor_score",
  "three_pillars",
  "vouching_works",
  "disputes_affect",
  "expertise_domains",
  "tier_ladder",
];

// Honor Bucket B — pillar → improve-CTA destination. Each weakest-
// pillar tip routes to the surface where the user can act on it.
type RouteName = keyof RootStackParamList;
function routeForPillar(key: string): RouteName {
  switch (key) {
    case "community": return "Circles";
    case "character": return "VouchMember";
    case "expertise": return "ElderTrainingHub";
    default:          return "ScoreHub";
  }
}

// Honor Bucket B — per-pillar explainer payload. Captures the pillar
// key + current/max score so the sheet can render "32 / 40" alongside
// the localized title + body + sub-components + matching tip.
type PillarExplainer = {
  key: string;
  value: number;
  max: number;
} | null;

// Honor Bucket A — canonical tier ladder, sourced from the engine.
// Replaces the literal Platinum/Gold/Silver/Bronze/Provisional ladder
// that contradicted both the Score Hub and the engine's tier function.
const TIER_LADDER: HonorScoreTier[] = [
  "Grand Elder",
  "Elder",
  "Respected",
  "Trusted",
  "Novice",
];

// Maps the typed tier into a slug used as an i18n key fragment so EN/FR
// labels stay in sync with the engine without forking the constant.
function tierSlug(tier: HonorScoreTier): string {
  switch (tier) {
    case "Grand Elder": return "grand_elder";
    case "Elder":       return "elder";
    case "Respected":   return "respected";
    case "Trusted":     return "trusted";
    case "Novice":      return "novice";
  }
}

// Honor Bucket A — recent-activity icon + sign for each real
// honor_score_history.trigger_event value. Mirrors the taxonomy
// declared in services/HonorScoreEngine.ts:HonorScoreTrigger so
// adding a new event there forces a touch here too.
type EventVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  defaultSign: "positive" | "negative" | "neutral";
};
const EVENT_VISUALS: Record<string, EventVisual> = {
  vouch_created:         { icon: "hand-right",                  color: "#7C3AED", defaultSign: "positive" },
  vouch_defaulted:       { icon: "alert-circle",                color: "#DC2626", defaultSign: "negative" },
  case_resolved:         { icon: "shield-checkmark",            color: "#00C6AE", defaultSign: "positive" },
  training_completed:    { icon: "school",                      color: "#3B82F6", defaultSign: "positive" },
  circle_completed:      { icon: "checkmark-done-circle-outline", color: "#00C6AE", defaultSign: "positive" },
  dispute_filed_against: { icon: "warning",                     color: "#DC2626", defaultSign: "negative" },
  pipeline_recompute:    { icon: "refresh",                     color: "#6B7280", defaultSign: "neutral"  },
  initial_computation:   { icon: "star",                        color: "#6B7280", defaultSign: "neutral"  },
  on_demand:             { icon: "sync",                        color: "#6B7280", defaultSign: "neutral"  },
};
const FALLBACK_VISUAL: EventVisual = { icon: "star", color: "#6B7280", defaultSign: "neutral" };

// Honor Bucket A — per-pillar icon for the breakdown card. Pillar
// labels themselves are localized via t() at render time.
const PILLAR_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  community: "people",
  character: "shield-checkmark",
  expertise: "school",
};
const PILLAR_COLOR: Record<string, string> = {
  community: "#3B82F6",
  character: "#00C6AE",
  expertise: "#7C3AED",
};

export default function HonorScoreOverviewScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  // Honor Bucket A — real composite hook. Returns score, tierInfo,
  // progressToNextTier, pillars, subComponents, history, weakestPillar.
  const {
    score,
    loading,
    tierInfo,
    progressToNextTier,
    pillars,
    history,
    weakestPillar,
  } = useHonorScoreDashboard();
  // Bucket B — sub-component breakdown is read via the pillar hook so
  // the explainer sheet can render value/max per sub-component.
  const { subComponents } = useHonorScorePillarBreakdown();
  // Bucket B — 30 rows of history give the sparkline + the existing
  // Recent Activity card their data. The dashboard hook only pulls 20;
  // this dedicated fetch widens the window to 30 days without changing
  // the dashboard's behaviour.
  const { history: extendedHistory } = useHonorScoreHistory(undefined, 30);

  const totalScore = score?.totalScore ?? null;

  // Honor Bucket B — HelpSheet visibility + per-pillar explainer
  // payload. State lives at component scope so the back-button can
  // dismiss either sheet without unmounting the screen.
  const [helpOpen, setHelpOpen] = useState(false);
  const [pillarExplainer, setPillarExplainer] = useState<PillarExplainer>(null);

  // Bucket B — first-visit coach mark. Same Animated.Value + useRef
  // gate pattern as XnScore Bucket B. Auto-dismiss after 4 s or on
  // tap; the gate ensures it never re-shows after the first visit.
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
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  // Bucket B — open the help sheet. Replaces the Bucket-A Alert.alert
  // placeholder.
  const handleHelpPress = useCallback(() => {
    setHelpOpen(true);
  }, []);

  // Bucket B — pillar row tap → explainer sheet. The payload is the
  // canonical pillar object so the sheet can render value/max + tier
  // sub-components by key.
  const openPillarExplainer = useCallback((key: string, value: number, max: number) => {
    setPillarExplainer({ key, value, max });
  }, []);

  // Bucket B — sparkline data. honor_score_history rows are sorted
  // desc-by-created_at, so reverse for chronological order. Each
  // row's `score` field is the post-event score; the current score
  // is appended so the rightmost dot always reflects "now" even if
  // no event has landed in the last few hours. Sparkline renders a
  // no-history fallback below 2 points.
  const historyForSparkline = useMemo<number[]>(() => {
    const rows = [...extendedHistory].reverse();
    const values: number[] = [];
    for (const row of rows) {
      const direct = Number(row.score);
      if (Number.isFinite(direct)) values.push(direct);
    }
    if (totalScore != null) values.push(Number(totalScore));
    return values;
  }, [extendedHistory, totalScore]);

  // Bucket B — improvement tips driven by pillars sorted weakest-first.
  // Each tip is tappable and routes via routeForPillar(). When no
  // pillars exist (rare empty state), falls back to the three baseline
  // tips already covered by the i18n keys.
  const topTips = useMemo(() => {
    if (!pillars || pillars.length === 0) return [];
    return [...pillars]
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3)
      .map((p) => ({ key: p.key, value: p.value, max: p.max, percentage: p.percentage }));
  }, [pillars]);

  // ── Loading gate ────────────────────────────────────────────────────────
  if (loading && score == null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("honor_overview.header_title")}</Text>
          <View style={styles.infoButton} />
        </View>
        <View style={styles.skeletonWrap}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.skeletonText}>{t("honor_overview.skeleton_loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state — no honor_scores row yet ───────────────────────────────
  if (score == null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("honor_overview.header_title")}</Text>
          <TouchableOpacity onPress={handleHelpPress} style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="ribbon-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t("honor_overview.empty_title")}</Text>
          <Text style={styles.emptyBody}>{t("honor_overview.empty_body")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const recentHistory = history.slice(0, 8);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("honor_overview.header_title")}</Text>
        <TouchableOpacity style={styles.infoButton} onPress={handleHelpPress}>
          <Ionicons name="information-circle-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <View style={[styles.scoreCard, { backgroundColor: tierInfo?.bgColor ?? "#F3F4F6" }]}>
          <View style={styles.scoreHeader}>
            <View>
              <Text style={styles.scoreLabel}>{t("honor_overview.score_label")}</Text>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreValue, { color: tierInfo?.color ?? "#6B7280" }]}>
                  {Math.round(totalScore ?? 0)}
                </Text>
                {tierInfo ? (
                  <View style={[styles.tierBadge, { backgroundColor: tierInfo.color }]}>
                    <Text style={styles.tierBadgeText}>
                      {t(`honor_overview.tier_${tierSlug(tierInfo.tier)}`)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.honorTierContainer}>
              <Text style={styles.honorTierLabel}>{t("honor_overview.tier_label")}</Text>
              <Text style={[styles.honorTierValue, { color: tierInfo?.color ?? "#6B7280" }]}>
                {tierInfo ? t(`honor_overview.tier_${tierSlug(tierInfo.tier)}`) : "—"}
              </Text>
            </View>
          </View>

          {/* Bucket B — 30-day sparkline. Reads honor_score_history
              + appends the current score so the rightmost dot is
              always "now". Falls back to a no-history label below
              2 points. */}
          <Sparkline values={historyForSparkline} accentColor={tierInfo?.color ?? "#00C6AE"} />

          {/* Progress to next tier — from the engine helper. */}
          {progressToNextTier?.nextTier ? (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {t("honor_overview.progress_to", {
                    tier: t(`honor_overview.tier_${tierSlug(progressToNextTier.nextTier)}`),
                  })}
                </Text>
                <Text style={styles.progressValue}>
                  {t("honor_overview.pts_needed", { n: Math.round(progressToNextTier.pointsNeeded) })}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(0, Math.min(100, progressToNextTier.progress))}%`,
                      backgroundColor: tierInfo?.color ?? "#00C6AE",
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>

        {/* 3-Pillar Breakdown — Bucket A core deliverable. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("honor_overview.section_pillars")}</Text>
          <Text style={styles.sectionSubtitle}>{t("honor_overview.section_pillars_subtitle")}</Text>
          <View style={styles.pillarsCard}>
            {pillars && pillars.length > 0 ? (
              pillars.map((p) => {
                const icon = PILLAR_ICON[p.key] ?? "ellipse-outline";
                const color = PILLAR_COLOR[p.key] ?? "#6B7280";
                const pct = p.max > 0 ? Math.min(100, (p.value / p.max) * 100) : 0;
                return (
                  // Bucket B — pillar row is tappable. The (?) glyph
                  // next to the label flags the affordance; tapping
                  // anywhere on the row opens the PillarExplainerSheet.
                  <TouchableOpacity
                    key={p.key}
                    style={styles.pillarRow}
                    onPress={() => openPillarExplainer(p.key, p.value, p.max)}
                    accessibilityRole="button"
                    accessibilityLabel={t("honor_overview.pillar_explainer_open", {
                      pillar: t(`honor_overview.pillar_${p.key}`),
                    })}
                  >
                    <View style={[styles.pillarIcon, { backgroundColor: color + "20" }]}>
                      <Ionicons name={icon} size={18} color={color} />
                    </View>
                    <View style={styles.pillarBody}>
                      <View style={styles.pillarHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={styles.pillarName}>
                            {t(`honor_overview.pillar_${p.key}`)}
                          </Text>
                          <Ionicons name="help-circle-outline" size={13} color={color} />
                        </View>
                        <Text style={styles.pillarValue}>
                          {Math.round(p.value)} / {p.max}
                        </Text>
                      </View>
                      <Text style={styles.pillarSubtitle}>
                        {t(`honor_overview.pillar_${p.key}_subtitle`)}
                      </Text>
                      <View style={styles.pillarBarBg}>
                        <View
                          style={[
                            styles.pillarBarFill,
                            { width: `${Math.max(pct, 3)}%`, backgroundColor: color },
                          ]}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.pillarsEmpty}>{t("honor_overview.pillars_empty")}</Text>
            )}
          </View>
        </View>

        {/* Tier ladder — canonical engine tiers. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("honor_overview.section_tiers")}</Text>
          <View style={styles.tiersCard}>
            {TIER_LADDER.map((tier, i) => {
              const info = HonorScoreEngine.getTierInfo(tier);
              const isCurrent = tierInfo?.tier === tier;
              return (
                <View
                  key={tier}
                  style={[
                    styles.tierRow,
                    isCurrent && styles.currentTierRow,
                    i < TIER_LADDER.length - 1 && styles.tierRowBorder,
                  ]}
                >
                  <View style={[styles.tierDot, { backgroundColor: info.color }]} />
                  <Text style={[styles.tierName, isCurrent && { color: info.color, fontWeight: "700" }]}>
                    {t(`honor_overview.tier_${tierSlug(tier)}`)}
                  </Text>
                  <Text style={styles.tierRange}>
                    {info.minScore}-{info.maxScore}
                  </Text>
                  {isCurrent ? (
                    <View style={[styles.currentIndicator, { backgroundColor: info.color }]}>
                      <Text style={styles.currentIndicatorText}>{t("honor_overview.you")}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Activity — real honor_score_history rows. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("honor_overview.section_recent")}</Text>
          <View style={styles.activityCard}>
            {recentHistory.length > 0 ? (
              recentHistory.map((row, idx) => {
                const visual = EVENT_VISUALS[row.triggerEvent] ?? FALLBACK_VISUAL;
                const change = Number(row.scoreChange || 0);
                const sign =
                  change > 0 ? "positive" : change < 0 ? "negative" : visual.defaultSign;
                const color =
                  sign === "positive" ? "#00C6AE" :
                  sign === "negative" ? "#DC2626" : "#6B7280";
                const dateStr = row.createdAt
                  ? new Date(row.createdAt).toLocaleDateString()
                  : "";
                return (
                  <View
                    key={row.id ?? `${row.triggerEvent}-${idx}`}
                    style={[styles.activityRow, idx < recentHistory.length - 1 && styles.activityRowBorder]}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: visual.color + "20" }]}>
                      <Ionicons name={visual.icon} size={18} color={visual.color} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityDescription}>
                        {t(`honor_overview.event_${row.triggerEvent}`, {
                          defaultValue: row.triggerEvent.replace(/_/g, " "),
                        })}
                      </Text>
                      {dateStr ? <Text style={styles.activityDate}>{dateStr}</Text> : null}
                    </View>
                    <Text style={[styles.activityPoints, { color }]}>
                      {change > 0 ? "+" : ""}{Number(change.toFixed(2))}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.activityEmpty}>
                <Ionicons name="time-outline" size={28} color="#D1D5DB" />
                <Text style={styles.activityEmptyText}>{t("honor_overview.activity_empty")}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bucket B — Improve your Honor Score. Top-3 pillars sorted
            weakest-first; each tip is tappable and routes via
            routeForPillar(). When the engine returns no pillars
            (fresh user), the card is skipped — the empty state above
            already explains the situation. */}
        {topTips.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("honor_overview.tips_title")}</Text>
            {topTips.map((tip, i) => {
              const color = PILLAR_COLOR[tip.key] ?? "#6B7280";
              const icon = PILLAR_ICON[tip.key] ?? "ellipse-outline";
              const pointsRemaining = Math.max(0, Math.round(tip.max - tip.value));
              return (
                <TouchableOpacity
                  key={`${tip.key}-${i}`}
                  style={styles.tipCard}
                  onPress={() => {
                    const route = routeForPillar(tip.key);
                    navigation.navigate(route as any);
                  }}
                  accessibilityRole="button"
                >
                  <View style={styles.tipHeaderRow}>
                    <View style={[styles.tipFactorChip, { backgroundColor: color + "20" }]}>
                      <Ionicons name={icon} size={12} color={color} />
                      <Text style={[styles.tipFactorChipText, { color }]}>
                        {t(`honor_overview.pillar_${tip.key}`)}
                      </Text>
                    </View>
                    {pointsRemaining > 0 ? (
                      <Text style={[styles.tipPoints, { color }]}>
                        {t("honor_overview.tip_points_label", { points: pointsRemaining })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.tipTitle}>
                    {t(`honor_overview.tip_pillar_${tip.key}_title`)}
                  </Text>
                  <Text style={styles.tipBody}>
                    {t(`honor_overview.tip_pillar_${tip.key}_body`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bucket B — modals + coach mark. Mounted as siblings to the
          ScrollView so they sit above content but inside the screen's
          root View. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />
      <PillarExplainerSheet
        explainer={pillarExplainer}
        onClose={() => setPillarExplainer(null)}
        subComponents={subComponents}
        weakestPillarKey={weakestPillar?.key ?? null}
        navigate={(route) => {
          setPillarExplainer(null);
          navigation.navigate(route as any);
        }}
        t={t}
      />
      {coachVisible ? (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.coachBackdrop} onPress={dismissCoach}>
            <View style={styles.coachCard}>
              <Ionicons name="bulb-outline" size={20} color="#FBBF24" />
              <Text style={styles.coachText}>{t("honor_overview.coach_tip")}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bucket B subcomponents
// ─────────────────────────────────────────────────────────────────────────

type TFn = (key: string, opts?: any) => string;

// Bucket B — 30-day sparkline. Renders post-event score values as
// dot bars. Below 2 data points we render the no-history fallback
// instead of a flat line that would convey nothing.
function Sparkline({ values, accentColor }: { values: number[]; accentColor: string }) {
  const { t } = useTranslation();
  if (!values || values.length < 2) {
    return (
      <View style={sparklineStyles.fallback}>
        <Text style={sparklineStyles.fallbackText}>{t("honor_overview.no_history")}</Text>
      </View>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  // Cap at 30 dots so the sparkline width stays bounded on narrow phones.
  const trimmed = values.slice(-30);
  return (
    <View style={sparklineStyles.container}>
      {trimmed.map((v, i) => {
        const pct = (v - min) / span;
        const height = 4 + pct * 26;
        return (
          <View
            key={i}
            style={[
              sparklineStyles.dot,
              {
                height,
                backgroundColor:
                  i === trimmed.length - 1 ? accentColor : "rgba(15,23,42,0.25)",
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// Bucket B — HelpSheet glossary. Six topics, each a localized title +
// body block. Modal slides from the bottom; backdrop tap dismisses.
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
            <Text style={sheetStyles.title}>{t("honor_overview.help_sheet_title")}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t("honor_overview.help_close")}>
              <Ionicons name="close" size={22} color="#0A2342" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={sheetStyles.scroll}>
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={sheetStyles.helpItem}>
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`honor_overview.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.helpItemBody}>
                  {t(`honor_overview.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Bucket B — per-pillar explainer. Renders title/value/body +
// sub-components (real values from useHonorScorePillarBreakdown) +
// a CTA that routes to the action surface for that pillar.
function PillarExplainerSheet({
  explainer,
  onClose,
  subComponents,
  weakestPillarKey,
  navigate,
  t,
}: {
  explainer: PillarExplainer;
  onClose: () => void;
  subComponents: { community: { name: string; value: number; max: number }[]; character: { name: string; value: number; max: number }[]; expertise: { name: string; value: number; max: number }[] } | null;
  weakestPillarKey: string | null;
  navigate: (route: RouteName) => void;
  t: TFn;
}) {
  if (!explainer) return null;
  const color = PILLAR_COLOR[explainer.key] ?? "#6B7280";
  const icon = PILLAR_ICON[explainer.key] ?? "ellipse-outline";
  const pillarLabel = t(`honor_overview.pillar_${explainer.key}`);
  // Map the sub-component array's `name` strings (defined in the
  // hook) to the i18n key for each sub-component so the sheet
  // shows localized labels rather than the raw engine names.
  const subRows: { name: string; value: number; max: number }[] =
    subComponents && (subComponents as any)[explainer.key]
      ? ((subComponents as any)[explainer.key] as { name: string; value: number; max: number }[])
      : [];
  const subKeyForName = (name: string): string => {
    switch (name) {
      case "Circles Participation":   return "circles_participation";
      case "Community Engagement":    return "community_engagement";
      case "Vouch Given":             return "vouch_given";
      case "Vouch Received":          return "vouch_received";
      case "Dispute Involvement":     return "dispute_involvement";
      case "Top 3 Domain Average":    return "expertise_top3_avg";
      case "Active Domains":          return "expertise_domains_active";
      default: return name.toLowerCase().replace(/\s+/g, "_");
    }
  };
  const isWeakest = weakestPillarKey === explainer.key;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name={icon} size={18} color={color} />
              <Text style={sheetStyles.title}>{pillarLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t("honor_overview.help_close")}>
              <Ionicons name="close" size={22} color="#0A2342" />
            </TouchableOpacity>
          </View>
          <View style={sheetStyles.scoreChipRow}>
            <Text style={[sheetStyles.scoreChipText, { backgroundColor: color + "20", color: "#0A2342" }]}>
              {Math.round(explainer.value)} / {explainer.max}
            </Text>
            {isWeakest ? (
              <Text style={sheetStyles.weakestChip}>{t("honor_overview.weakest_chip")}</Text>
            ) : null}
          </View>
          <Text style={sheetStyles.explainerBody}>
            {t(`honor_overview.pillar_explainer_${explainer.key}_body`)}
          </Text>
          {subRows.length > 0 ? (
            <View style={sheetStyles.subBlock}>
              <Text style={sheetStyles.subHeading}>
                {t("honor_overview.subcomponents_heading")}
              </Text>
              {subRows.map((sub) => {
                const subKey = subKeyForName(sub.name);
                const subPct = sub.max > 0 ? Math.min(100, (sub.value / sub.max) * 100) : 0;
                return (
                  <View key={sub.name} style={sheetStyles.subRow}>
                    <View style={sheetStyles.subRowHeader}>
                      <Text style={sheetStyles.subRowLabel}>
                        {t(`honor_overview.subcomp_${subKey}`, { defaultValue: sub.name })}
                      </Text>
                      <Text style={sheetStyles.subRowValue}>
                        {Math.round(sub.value)} / {sub.max}
                      </Text>
                    </View>
                    <View style={sheetStyles.subRowBarBg}>
                      <View
                        style={[
                          sheetStyles.subRowBarFill,
                          { width: `${Math.max(subPct, 3)}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          <View style={sheetStyles.tipBlock}>
            <Text style={sheetStyles.tipBlockHeading}>
              {t("honor_overview.tips_title")}
            </Text>
            <Text style={sheetStyles.tipBlockTitle}>
              {t(`honor_overview.tip_pillar_${explainer.key}_title`)}
            </Text>
            <Text style={sheetStyles.tipBlockBody}>
              {t(`honor_overview.tip_pillar_${explainer.key}_body`)}
            </Text>
          </View>
          <TouchableOpacity
            style={[sheetStyles.ctaBtn, { backgroundColor: color }]}
            onPress={() => navigate(routeForPillar(explainer.key))}
          >
            <Text style={sheetStyles.ctaBtnText}>
              {t(`honor_overview.tip_pillar_${explainer.key}_cta`)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>{t("honor_overview.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
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
  backButton: { padding: 4, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a2e" },
  infoButton: { padding: 4, width: 32, alignItems: "flex-end" },

  skeletonWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  skeletonText: { fontSize: 13, color: "#6B7280" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0A2342", textAlign: "center", marginTop: 8 },
  emptyBody: { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 18 },

  content: { flex: 1 },

  scoreCard: { margin: 20, padding: 20, borderRadius: 16 },
  scoreHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  scoreLabel: { fontSize: 14, color: "#6B7280", marginBottom: 4 },
  scoreRow: { flexDirection: "row", alignItems: "center" },
  scoreValue: { fontSize: 48, fontWeight: "700", marginRight: 12 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tierBadgeText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  honorTierContainer: { alignItems: "flex-end" },
  honorTierLabel: { fontSize: 12, color: "#6B7280" },
  honorTierValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  progressSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 13, color: "#6B7280" },
  progressValue: { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  progressBar: { height: 8, backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 4 },
  progressFill: { height: 8, borderRadius: 4 },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a2e", marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: "#6B7280", marginBottom: 12 },

  pillarsCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, gap: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  pillarRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  pillarIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 2 },
  pillarBody: { flex: 1 },
  pillarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pillarName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  pillarValue: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  pillarSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2, marginBottom: 6 },
  pillarBarBg: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  pillarBarFill: { height: 6, borderRadius: 3 },
  pillarsEmpty: { fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingVertical: 12 },

  tiersCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 4, borderWidth: 1, borderColor: "#E5E7EB" },
  tierRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  currentTierRow: { backgroundColor: "#F5F7FA", borderRadius: 8 },
  tierRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  tierDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  tierName: { fontSize: 14, color: "#1a1a2e", flex: 1 },
  tierRange: { fontSize: 14, color: "#6B7280", marginRight: 8 },
  currentIndicator: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentIndicatorText: { fontSize: 10, fontWeight: "600", color: "#FFFFFF" },

  activityCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 4, borderWidth: 1, borderColor: "#E5E7EB" },
  activityRow: { flexDirection: "row", alignItems: "center", padding: 12 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  activityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12 },
  activityInfo: { flex: 1 },
  activityDescription: { fontSize: 14, color: "#1a1a2e" },
  activityDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  activityPoints: { fontSize: 16, fontWeight: "700" },
  activityEmpty: { padding: 24, alignItems: "center", gap: 8 },
  activityEmptyText: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },

  // Bucket B — improvement tip cards (tappable, pillar-routed).
  tipCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  tipHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  tipFactorChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  tipFactorChipText: { fontSize: 11, fontWeight: "700" },
  tipPoints: { fontSize: 12, fontWeight: "700" },
  tipTitle: { fontSize: 14, fontWeight: "600", color: "#1a1a2e", marginBottom: 4 },
  tipBody: { fontSize: 13, color: "#6B7280", lineHeight: 18 },

  // Bucket B — coach mark overlay.
  coachOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-start" },
  coachBackdrop: { flex: 1, alignItems: "center", paddingTop: 110, paddingHorizontal: 24 },
  coachCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(15,23,42,0.96)", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, maxWidth: 320 },
  coachText: { flex: 1, fontSize: 13, color: "#FFFFFF", lineHeight: 18 },

  bottomPadding: { height: 40 },
});

// Bucket B — 30-day sparkline styles. The accent dot at the right
// edge is colored by the active tier; the rest are muted slate to
// keep the focus on the current value.
const sparklineStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 14, height: 32 },
  dot: { width: 4, borderRadius: 2 },
  fallback: { marginTop: 14, height: 32, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontSize: 11, color: "#6B7280", fontStyle: "italic" },
});

// Bucket B — bottom-sheet shared styles (HelpSheet + PillarExplainerSheet).
const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, maxHeight: "86%" },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700", color: "#0A2342" },
  scroll: { maxHeight: 500 },
  helpItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  helpItemTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  helpItemBody: { fontSize: 13, color: "#4B5563", lineHeight: 19 },

  scoreChipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  scoreChipText: { fontSize: 13, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },
  weakestChip: { fontSize: 11, fontWeight: "700", color: "#92400E", backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },
  explainerBody: { fontSize: 13, color: "#4B5563", lineHeight: 19, marginBottom: 14 },

  subBlock: { marginBottom: 14 },
  subHeading: { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  subRow: { marginBottom: 10 },
  subRowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  subRowLabel: { fontSize: 13, color: "#0A2342" },
  subRowValue: { fontSize: 13, fontWeight: "700", color: "#0A2342" },
  subRowBarBg: { height: 4, backgroundColor: "#E5E7EB", borderRadius: 2 },
  subRowBarFill: { height: 4, borderRadius: 2 },

  tipBlock: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 14 },
  tipBlockHeading: { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  tipBlockTitle: { fontSize: 13, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  tipBlockBody: { fontSize: 13, color: "#4B5563", lineHeight: 18 },

  ctaBtn: { borderRadius: 12, alignItems: "center", paddingVertical: 14, marginBottom: 10 },
  ctaBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  closeBtn: { borderRadius: 12, alignItems: "center", paddingVertical: 14, backgroundColor: "#F1F5F9" },
  closeBtnText: { color: "#0A2342", fontSize: 14, fontWeight: "600" },
});
