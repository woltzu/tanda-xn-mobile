// ══════════════════════════════════════════════════════════════════════════════
// screens/CircleHealthScreen.tsx — Circle Health surface (Bucket A revival).
// ══════════════════════════════════════════════════════════════════════════════
//
// Two modes driven by route.params.circleId:
//
//   * Chooser (no circleId)   — lists the user's circles with status pill
//                               + score pulled from circle_health_scores in
//                               a single bulk SELECT. Tapping a row navigates
//                               here again with the circleId param.
//
//   * Detail  (circleId set)  — wires to useCircleHealth(circleId), the same
//                               hook that powers CircleDetail's Health card.
//                               Renders: status pill, score gauge, 4 component
//                               scores, 5 real metrics, trend chip, last
//                               computed timestamp, "Refresh now" button that
//                               calls the recompute_circle_health RPC.
//
// The earlier mock-data implementation invented metric names that did not
// exist in the schema (`payout_speed_days`, `active_ratio_pct`). Those are
// gone — the only metrics rendered here are the ones the nightly scoring
// pipeline actually writes.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useRoute } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useCircles } from "../context/CirclesContext";
import {
  useCircleHealth,
  STATUS_VISUALS,
  TREND_VISUALS,
  HealthStatus,
} from "../hooks/useCircleHealth";
import { useCircleHealthScoringHistory } from "../hooks/useScoringPipeline";

// ─── Metric keys that have help copy (Bucket B). Topic = the i18n suffix. ───
type HelpTopic =
  | "on_time_contribution"
  | "members_in_default"
  | "total_members"
  | "avg_xn_score"
  | "avg_default_probability";

// ─── Chooser-row shape (just what the row needs, not full coercion) ─────────
type ChooserHealth = {
  health_score: number;
  health_status: HealthStatus;
};

// ─── Relative-time helper (no extra dep — date-fns isn't already imported) ──
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Top-level screen — picks Chooser or Detail based on route.params.circleId.
// ══════════════════════════════════════════════════════════════════════════════
export default function CircleHealthScreen() {
  const route = useRoute<any>();
  const circleId: string | undefined = route.params?.circleId;
  return circleId ? <DetailView circleId={circleId} /> : <ChooserView />;
}

// ══════════════════════════════════════════════════════════════════════════════
// ChooserView — bulk SELECT of circle_health_scores for the user's circles.
// ══════════════════════════════════════════════════════════════════════════════
function ChooserView() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const { myCircles, isLoading: circlesLoading } = useCircles();

  const [healthMap, setHealthMap] = useState<Record<string, ChooserHealth>>({});
  const [loading, setLoading] = useState(false);

  const ids = useMemo(() => myCircles.map((c) => c.id), [myCircles]);

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      setHealthMap({});
      return;
    }
    setLoading(true);
    supabase
      .from("circle_health_scores")
      .select("circle_id, health_score, health_status")
      .in("circle_id", ids)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setHealthMap({});
        } else {
          const map: Record<string, ChooserHealth> = {};
          for (const row of data) {
            map[row.circle_id] = {
              health_score: Number(row.health_score),
              health_status: row.health_status as HealthStatus,
            };
          }
          setHealthMap(map);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const showSpinner = circlesLoading || loading;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              accessibilityLabel={t("common.back")}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {t("circle_health_screen.header_title")}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <Text style={styles.headerSubtitle}>
            {t("circle_health_screen.header_subtitle_chooser")}
          </Text>
        </LinearGradient>

        <Text style={styles.sectionHeader}>
          {t("circle_health_screen.chooser_title")}
        </Text>

        {showSpinner ? (
          <ActivityIndicator
            style={{ marginTop: 24 }}
            color={colors.accentTeal}
          />
        ) : myCircles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t("circle_health_screen.no_circles")}
            </Text>
          </View>
        ) : (
          myCircles.map((circle) => {
            const row = healthMap[circle.id];
            const visual = row ? STATUS_VISUALS[row.health_status] : null;
            return (
              <TouchableOpacity
                key={circle.id}
                style={styles.chooserCard}
                onPress={() =>
                  navigation.navigate(Routes.CircleHealth, {
                    circleId: circle.id,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${circle.name} — ${t(
                  "circle_health_screen.view_details",
                )}`}
              >
                <View style={styles.chooserLeft}>
                  <Text style={styles.chooserName}>{circle.name}</Text>
                  {row ? (
                    <View style={styles.chooserMeta}>
                      <Text style={styles.chooserScore}>
                        {Math.round(row.health_score)}
                        <Text style={styles.chooserOutOf}>
                          {" "}
                          {t("circle_health_screen.score_out_of")}
                        </Text>
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.chooserNoScore}>
                      {t("circle_health_screen.no_score_yet")}
                    </Text>
                  )}
                </View>
                {visual ? (
                  <View
                    style={[styles.statusPill, { backgroundColor: visual.bg }]}
                  >
                    <Text style={[styles.statusPillText, { color: visual.color }]}>
                      {visual.emoji}{" "}
                      {t(`circle_health_screen.status_${row!.health_status}`)}
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DetailView — single-circle health backed by useCircleHealth(circleId).
// ══════════════════════════════════════════════════════════════════════════════
function DetailView({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const { myCircles } = useCircles();
  const {
    health,
    loading,
    recomputing,
    error,
    refresh,
    recompute,
    statusVisual,
    trendVisual,
    scoreDelta,
    hasNeverBeenComputed,
  } = useCircleHealth(circleId);

  // 30-day score history for the sparkline. Returns empty array when the
  // circle_health_history table has no rows for this circle yet (common on
  // freshly created circles or before the first nightly pipeline run).
  const { history } = useCircleHealthScoringHistory(circleId, 30);

  // Help sheet topic — set by tapping a (?) icon, cleared on close.
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  // Optimistically rounded numbers for display (DB stores DECIMAL).
  const score = health ? Math.round(health.health_score) : 0;
  const gaugeColor = statusVisual?.color ?? colors.border;

  // Look up the circle's name for the action-banner copy and the CTA target.
  const circleName = useMemo(
    () => myCircles.find((c) => c.id === circleId)?.name ?? "",
    [myCircles, circleId],
  );

  // Action-banner trigger: critical status OR > 15% of members in default.
  const defaultRatio = health
    ? health.total_members > 0
      ? health.members_with_defaults / health.total_members
      : 0
    : 0;
  const showActionBanner =
    !!health &&
    (health.health_status === "critical" || defaultRatio > 0.15);
  const actionReasonKey =
    showActionBanner && health
      ? health.members_with_defaults > 0
        ? "action_needed_body_defaults"
        : "action_needed_body_critical"
      : null;

  const componentRows = health
    ? [
        {
          key: "contribution_reliability",
          value: health.contribution_reliability_score,
        },
        { key: "member_quality", value: health.member_quality_score },
        {
          key: "financial_stability",
          value: health.financial_stability_score,
        },
        { key: "social_cohesion", value: health.social_cohesion_score },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              accessibilityLabel={t("common.back")}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {t("circle_health_screen.header_title")}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <Text style={styles.headerSubtitle}>
            {t("circle_health_screen.header_subtitle_detail")}
          </Text>

          {/* Action banner — surfaces above the gauge when health is critical
              or > 15% of members are in default. Tap routes to CircleDetail
              so the user can drill into the Members tab and act. */}
          {showActionBanner && actionReasonKey && health ? (
            <TouchableOpacity
              style={styles.actionBanner}
              onPress={() =>
                navigation.navigate(Routes.CircleDetail, { circleId })
              }
              accessibilityRole="button"
            >
              <Ionicons name="warning" size={20} color="#991B1B" />
              <View style={styles.actionBannerCopy}>
                <Text style={styles.actionBannerTitle}>
                  {t("circle_health_screen.action_needed_title", {
                    circle_name: circleName,
                  })}
                </Text>
                <Text style={styles.actionBannerBody}>
                  {t(`circle_health_screen.${actionReasonKey}`, {
                    count: health.members_with_defaults,
                    total: health.total_members,
                  })}
                </Text>
                <Text style={styles.actionBannerCta}>
                  {t("circle_health_screen.action_needed_cta")} ›
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Score card */}
          <View style={styles.overallCard}>
            <View style={styles.overallTopRow}>
              <Text style={styles.overallLabel}>
                {t("circle_health_screen.metric_health_score")}
              </Text>
              {statusVisual ? (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusVisual.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: statusVisual.color },
                    ]}
                  >
                    {statusVisual.emoji}{" "}
                    {t(`circle_health_screen.status_${health!.health_status}`)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.overallScoreRow}>
              <Text style={[styles.overallScore, { color: gaugeColor }]}>
                {score}
              </Text>
              <Text style={styles.overallOutOf}>
                {" "}
                {t("circle_health_screen.score_out_of")}
              </Text>
            </View>
            <View style={styles.gaugeBg}>
              <View
                style={[
                  styles.gaugeFill,
                  { width: `${score}%`, backgroundColor: gaugeColor },
                ]}
              />
            </View>

            {/* 30-day sparkline. Falls back to the no-history label when
                circle_health_history hasn't accumulated rows yet. */}
            <View style={styles.sparkRow}>
              <Text style={styles.sparkLabel}>
                {t("circle_health_screen.sparkline_label")}
              </Text>
              {history.length > 1 ? (
                <Sparkline
                  values={history.map((h) => h.healthScore).reverse()}
                  color={gaugeColor}
                />
              ) : (
                <Text style={styles.sparkEmpty}>
                  {t("circle_health_screen.no_history")}
                </Text>
              )}
            </View>

            <View style={styles.deltaRow}>
              {scoreDelta != null ? (
                <Text
                  style={[
                    styles.deltaText,
                    {
                      color:
                        scoreDelta > 0
                          ? "#10B981"
                          : scoreDelta < 0
                            ? "#EF4444"
                            : colors.textOnNavy,
                    },
                  ]}
                >
                  {scoreDelta > 0
                    ? t("circle_health_screen.delta_positive", {
                        delta: scoreDelta,
                      })
                    : scoreDelta < 0
                      ? t("circle_health_screen.delta_negative", {
                          delta: scoreDelta,
                        })
                      : t("circle_health_screen.delta_zero")}
                </Text>
              ) : (
                <View />
              )}
              {trendVisual ? (
                <Text
                  style={[styles.trendChip, { color: trendVisual.color }]}
                >
                  {trendVisual.emoji}{" "}
                  {t(`circle_health_screen.trend_${health!.trend}`)}
                </Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {/* Loading / empty / error */}
        {loading && !health ? (
          <ActivityIndicator
            style={{ marginTop: 24 }}
            color={colors.accentTeal}
          />
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              {t("circle_health_screen.error_title")}
            </Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={refresh}
              accessibilityRole="button"
            >
              <Text style={styles.retryBtnText}>
                {t("circle_health_screen.error_retry")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasNeverBeenComputed && !error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t("circle_health_screen.no_score_yet")}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={recompute}
              disabled={recomputing}
              accessibilityRole="button"
            >
              <Text style={styles.retryBtnText}>
                {recomputing
                  ? t("circle_health_screen.refreshing")
                  : t("circle_health_screen.refresh_now")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {health ? (
          <>
            {/* Component scores — what makes up the headline score */}
            <Text style={styles.sectionHeader}>
              {t("circle_health_screen.section_components")}
            </Text>
            <View style={styles.card}>
              {componentRows.map((row, idx) => (
                <View
                  key={row.key}
                  style={[
                    styles.metricRow,
                    idx === componentRows.length - 1 && styles.metricRowLast,
                  ]}
                >
                  <Text style={styles.metricLabel}>
                    {t(`circle_health_screen.component_${row.key}`)}
                  </Text>
                  <Text style={styles.metricValue}>
                    {Math.round(row.value)} / 100
                  </Text>
                </View>
              ))}
            </View>

            {/* Underlying metrics — every row has a (?) that opens HelpSheet
                for that metric. Help copy lives under circle_health_screen.
                help_<topic>_{title,description,threshold,action}. */}
            <Text style={styles.sectionHeader}>
              {t("circle_health_screen.section_metrics")}
            </Text>
            <View style={styles.card}>
              <MetricRow
                label={t("circle_health_screen.metric_on_time_contribution")}
                value={`${Math.round(health.on_time_contribution_pct)}%`}
                onHelp={() => setHelpTopic("on_time_contribution")}
              />
              <MetricRow
                label={t("circle_health_screen.metric_members_in_default")}
                value={`${health.members_with_defaults} / ${health.total_members}`}
                onHelp={() => setHelpTopic("members_in_default")}
              />
              <MetricRow
                label={t("circle_health_screen.metric_total_members")}
                value={`${health.total_members}`}
                onHelp={() => setHelpTopic("total_members")}
              />
              <MetricRow
                label={t("circle_health_screen.metric_avg_xn_score")}
                value={`${Math.round(health.avg_member_xnscore)}`}
                onHelp={() => setHelpTopic("avg_xn_score")}
              />
              <MetricRow
                label={t(
                  "circle_health_screen.metric_avg_default_probability",
                )}
                value={`${Math.round(health.avg_default_probability * 100)}%`}
                onHelp={() => setHelpTopic("avg_default_probability")}
                last
              />
            </View>

            {/* Refresh footer */}
            <View style={styles.footer}>
              <Text style={styles.footerStamp}>
                {t("circle_health_screen.last_computed", {
                  when: relativeTime(health.last_computed_at),
                })}
              </Text>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={recompute}
                disabled={recomputing}
                accessibilityRole="button"
                accessibilityLabel={t("circle_health_screen.refresh_now")}
              >
                {recomputing ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.textWhite} />
                )}
                <Text style={styles.refreshBtnText}>
                  {recomputing
                    ? t("circle_health_screen.refreshing")
                    : t("circle_health_screen.refresh_now")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Glossary tooltip — opened by tapping any (?) icon. */}
      <HelpSheet
        topic={helpTopic}
        onClose={() => setHelpTopic(null)}
      />
    </SafeAreaView>
  );
}

function MetricRow({
  label,
  value,
  last,
  onHelp,
}: {
  label: string;
  value: string;
  last?: boolean;
  onHelp?: () => void;
}) {
  return (
    <View style={[styles.metricRow, last && styles.metricRowLast]}>
      <View style={styles.metricLabelRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        {onHelp ? (
          <TouchableOpacity
            onPress={onHelp}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Ionicons
              name="help-circle-outline"
              size={16}
              color={colors.textSecondary}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sparkline — View-based dot-bar chart for the 30-day score history.
// Mirrors ScoreHubScreen's SparklineSeven but generic over input length.
// ══════════════════════════════════════════════════════════════════════════════
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  return (
    <View style={sparklineStyles.row}>
      {values.map((v, i) => {
        const h = 4 + Math.round(((v - min) / span) * 18);
        const isLast = i === values.length - 1;
        return (
          <View
            key={i}
            style={[
              sparklineStyles.dot,
              {
                height: h,
                backgroundColor: isLast ? color : `${color}55`,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const sparklineStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 22,
  },
  dot: {
    width: 3,
    borderRadius: 1.5,
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// HelpSheet — Modal-based glossary, opened by tapping any (?) icon.
// Reads circle_health_screen.help_<topic>_{title,description,threshold,action}.
// ══════════════════════════════════════════════════════════════════════════════
function HelpSheet({
  topic,
  onClose,
}: {
  topic: HelpTopic | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const visible = topic != null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={helpStyles.backdrop} onPress={onClose}>
        <Pressable style={helpStyles.sheet} onPress={() => {}}>
          <View style={helpStyles.handle} />
          {topic ? (
            <>
              <Text style={helpStyles.title}>
                {t(`circle_health_screen.help_${topic}_title`)}
              </Text>
              <Text style={helpStyles.label}>
                {t("circle_health_screen.help_label_description")}
              </Text>
              <Text style={helpStyles.body}>
                {t(`circle_health_screen.help_${topic}_description`)}
              </Text>
              <Text style={helpStyles.label}>
                {t("circle_health_screen.help_label_threshold")}
              </Text>
              <Text style={helpStyles.body}>
                {t(`circle_health_screen.help_${topic}_threshold`)}
              </Text>
              <Text style={helpStyles.label}>
                {t("circle_health_screen.help_label_action")}
              </Text>
              <Text style={helpStyles.body}>
                {t(`circle_health_screen.help_${topic}_action`)}
              </Text>
              <TouchableOpacity
                style={helpStyles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={helpStyles.closeBtnText}>
                  {t("circle_health_screen.help_close")}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const helpStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  closeBtn: {
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
  },
  closeBtnText: {
    color: colors.textWhite,
    fontSize: 14,
    fontWeight: "700",
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════════
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
  headerTitle: {
    color: colors.textWhite,
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.textOnNavy,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
  },

  overallCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
  },
  overallTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  overallLabel: {
    color: colors.textOnNavy,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  overallScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  overallScore: { fontSize: 32, fontWeight: "700" },
  overallOutOf: {
    color: colors.textOnNavy,
    fontSize: 14,
    marginLeft: 4,
  },

  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  deltaText: { fontSize: 12, fontWeight: "600" },
  trendChip: { fontSize: 12, fontWeight: "700" },

  sparkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 4,
  },
  sparkLabel: {
    color: colors.textOnNavy,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  sparkEmpty: {
    color: colors.textOnNavy,
    fontSize: 11,
    fontStyle: "italic",
  },

  actionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  actionBannerCopy: { flex: 1, marginLeft: 10 },
  actionBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 2,
  },
  actionBannerBody: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 16,
  },
  actionBannerCta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991B1B",
    marginTop: 6,
  },

  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },

  card: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },

  chooserCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chooserLeft: { flex: 1, paddingRight: 12 },
  chooserName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  chooserMeta: { marginTop: 4 },
  chooserScore: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  chooserOutOf: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  chooserNoScore: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },

  gaugeBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  gaugeFill: { height: "100%", borderRadius: 3 },

  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricRowLast: { borderBottomWidth: 0 },
  metricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    paddingRight: 8,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  metricValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },

  errorCard: {
    backgroundColor: "#FEE2E2",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: "#991B1B",
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: "#991B1B",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  retryBtnText: { color: colors.textWhite, fontSize: 13, fontWeight: "700" },

  footer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerStamp: { fontSize: 12, color: colors.textSecondary },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryNavy,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  refreshBtnText: { color: colors.textWhite, fontSize: 13, fontWeight: "700" },
});
