import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
// Honor Bucket A — the screen now reads the real backend dashboard hook
// instead of the AsyncStorage-backed elderProfile.honorScore mock. Same
// shape as the post-Bucket-A XnScore Dashboard: one composite hook that
// fans out into score/tier/pillars/history/weakestPillar.
import { useHonorScoreDashboard } from "../hooks/useHonorScore";
import {
  HonorScoreEngine,
  HonorScoreTier,
} from "../services/HonorScoreEngine";

type RootStackParamList = {
  HonorScoreOverview: undefined;
  BecomeElder: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

  const totalScore = score?.totalScore ?? null;

  // Honor Bucket A — Bucket B will replace this with a HelpSheet. The
  // placeholder Alert kills the dead-button bug without forking copy.
  const handleHelpPress = () => {
    Alert.alert(
      t("honor_overview.help_title"),
      t("honor_overview.help_placeholder")
    );
  };

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
                  <View key={p.key} style={styles.pillarRow}>
                    <View style={[styles.pillarIcon, { backgroundColor: color + "20" }]}>
                      <Ionicons name={icon} size={18} color={color} />
                    </View>
                    <View style={styles.pillarBody}>
                      <View style={styles.pillarHeader}>
                        <Text style={styles.pillarName}>
                          {t(`honor_overview.pillar_${p.key}`)}
                        </Text>
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
                  </View>
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

        {/* Improve — data-driven: leads with weakest pillar, falls back
            to a generic "balance all three" tip. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("honor_overview.section_improve")}</Text>
          <View style={styles.tipsCard}>
            {weakestPillar ? (
              <View style={styles.tipItem}>
                <View
                  style={[
                    styles.tipIcon,
                    { backgroundColor: (PILLAR_COLOR[weakestPillar.key] ?? "#6B7280") + "20" },
                  ]}
                >
                  <Ionicons
                    name={PILLAR_ICON[weakestPillar.key] ?? "ellipse-outline"}
                    size={20}
                    color={PILLAR_COLOR[weakestPillar.key] ?? "#6B7280"}
                  />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>
                    {t("honor_overview.tip_focus_pillar_title", {
                      pillar: t(`honor_overview.pillar_${weakestPillar.key}`),
                    })}
                  </Text>
                  <Text style={styles.tipDescription}>
                    {t(`honor_overview.tip_focus_pillar_${weakestPillar.key}_body`)}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.tipItem}>
              <View style={[styles.tipIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="hand-right" size={20} color="#7C3AED" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{t("honor_overview.tip_vouches_title")}</Text>
                <Text style={styles.tipDescription}>{t("honor_overview.tip_vouches_body")}</Text>
              </View>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipIcon, { backgroundColor: "#F0FDFB" }]}>
                <Ionicons name="shield-checkmark" size={20} color="#00C6AE" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{t("honor_overview.tip_mediation_title")}</Text>
                <Text style={styles.tipDescription}>{t("honor_overview.tip_mediation_body")}</Text>
              </View>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="school" size={20} color="#3B82F6" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{t("honor_overview.tip_training_title")}</Text>
                <Text style={styles.tipDescription}>{t("honor_overview.tip_training_body")}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
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

  tipsCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, gap: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  tipItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tipIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  tipDescription: { fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 17 },

  bottomPadding: { height: 40 },
});
