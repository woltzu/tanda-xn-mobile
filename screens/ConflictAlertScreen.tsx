import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
  Modal, Pressable, Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  useFormationReview,
  usePostFormationMonitor,
  useCircleConflictHistory,
  useConflictActions,
  type FormationFlag,
  type PostFormationMonitor as MonitorType,
  type ConflictRecord,
  type ReviewOutcome,
} from "../hooks/useConflictPrediction";
import { useCircleDisputes, type CircleDisputeRow } from "../hooks/useCircleDisputes";
import { useProfileBatch } from "../hooks/useProfileBatch";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";
import { useEventTracker } from "../hooks/useEventTracker";
import { Routes } from "../lib/routes";

// Bucket B: AsyncStorage key for the first-visit coach mark. Version suffix
// lets us re-prompt every user if the coach copy shifts materially.
const CONFLICT_COACH_KEY = "@tandaxn_conflict_alert_coach_seen_v1";

// Bucket B: HelpSheet topics — six glossary entries rendered together in one
// scrollable sheet, opened by the header (?) button.
type HelpTopic =
  | "live_vs_dispute"
  | "tier_levels"
  | "why_autoflag"
  | "when_escalate"
  | "role_actions"
  | "status_lifecycle";

const HELP_TOPICS: HelpTopic[] = [
  "live_vs_dispute",
  "tier_levels",
  "why_autoflag",
  "when_escalate",
  "role_actions",
  "status_lifecycle",
];

// Bucket B: single source of truth for the 0–100 score → severity mapping.
// All three visual layers (score-bar fill, pair-score number, monitor card
// border accent) read from this constant via severityFromScore() so they
// never disagree about where the colour bands sit.
const SEVERITY_THRESHOLDS = { low: 30, medium: 60, high: 85 };

type SeverityKey = "low" | "medium" | "high" | "critical";

function severityFromScore(score: number): SeverityKey {
  if (score >= SEVERITY_THRESHOLDS.high) return "critical";
  if (score >= SEVERITY_THRESHOLDS.medium) return "high";
  if (score >= SEVERITY_THRESHOLDS.low) return "medium";
  return "low";
}

// Engine return types use snake_case; the FlaggedPairSummary interface from
// the engine matches what's actually inside circle_formation_flags.flagged_pair_ids.
type FlaggedPair = {
  member_a_id: string;
  member_b_id: string;
  friction_score: number;
  tier: string;
  top_factor: string;
};

// Short-form ID for display until we wire a profiles lookup hook here.
// Shows "abcd1234…" so admins can at least correlate with a member ID.
const shortId = (id: string | undefined): string =>
  id ? `${id.slice(0, 8)}…` : "—";

const formatFactor = (factor: string): string =>
  String(factor).replace(/_/g, " ");

// Conflict P1 (2026-06-12): collapsed 3 tabs → 2. The legacy split between
// Formation (pre-cycle) and Monitoring (mid-cycle) sat behind the same
// "what's happening now?" question. They now share a single "Live signals"
// tab that renders pending formation reviews above active monitoring rows.
// History stays as-is because users explicitly browse it as a separate axis.
type TabKey = "live_signals" | "history";

const TABS: { key: TabKey; labelKey: string; icon: string }[] = [
  { key: "live_signals", labelKey: "conflict_alert.tab_live_signals", icon: "pulse-outline" },
  { key: "history", labelKey: "conflict_alert.tab_history", icon: "time-outline" },
];

// Bucket A: SEVERITY/TIER labels are now i18n keys looked up at render
// time via t(`conflict_alert.severity_${key}`) and
// t(`conflict_alert.tier_${key}`). Colour/icon meta stays as a literal
// because the design tokens don't change per locale.
const SEVERITY_META: Record<string, { color: string; bg: string; icon: string }> = {
  low:      { color: "#10B981", bg: "#ECFDF5", icon: "information-circle-outline" },
  medium:   { color: "#F59E0B", bg: "#FFFBEB", icon: "warning-outline" },
  high:     { color: "#EF4444", bg: "#FEF2F2", icon: "alert-circle-outline" },
  critical: { color: "#991B1B", bg: "#FEE2E2", icon: "skull-outline" },
};

const TIER_META: Record<string, { color: string; bg: string }> = {
  clear:      { color: "#10B981", bg: "#ECFDF5" },
  compatible: { color: "#10B981", bg: "#ECFDF5" },
  watch:      { color: "#F59E0B", bg: "#FFFBEB" },
  flag:       { color: "#EF4444", bg: "#FEF2F2" },
  separate:   { color: "#991B1B", bg: "#FEE2E2" },
};

export default function ConflictAlertScreen() {
  const { t } = useTranslation();

  const navigation = useNavigation<any>();
  const route = useRoute();
  const routeCircleId = (route.params as any)?.circleId as string | undefined;
  const { user } = useAuth();

  // Conflict P0 (2026-06-12): the route now declares `circleId?` to
  // match how CirclesV2Screen historically navigates (no params). When
  // missing, we render an inline picker using the user's active circles
  // and let them choose. The selected id flows into all the hooks
  // below, so swapping a circle re-fetches everything cleanly.
  const { myCircles } = useCircles();
  const activeCircles = myCircles.filter((c) => c.status === "active");
  const { track } = useEventTracker();
  const [selectedCircleId, setSelectedCircleId] = useState<string | undefined>(
    routeCircleId,
  );
  const effectiveCircleId = selectedCircleId ?? routeCircleId;
  const noCirclesAtAll = activeCircles.length === 0;
  const showCirclePicker = !effectiveCircleId && !noCirclesAtAll;
  const showNoCirclesState = !effectiveCircleId && noCirclesAtAll;

  const [activeTab, setActiveTab] = useState<TabKey>("live_signals");

  // Bucket C telemetry. Caller role for resolved/review events comes from
  // the user's circle membership row; falls back to 'member' if missing.
  const myRole: string = useMemo(() => {
    if (!effectiveCircleId) return "member";
    const c = myCircles.find((mc) => mc.id === effectiveCircleId);
    return c?.role ?? "member";
  }, [myCircles, effectiveCircleId]);

  // conflict_alert.viewed — fires once per (circleId, tab) pair. StrictMode
  // double-mounts the screen in dev, so the ref is keyed by both axes; a
  // tab change is treated as a separate view by the tab_switched event
  // below, not here.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveCircleId) return;
    const key = `${effectiveCircleId}:${activeTab}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    track({
      eventType: "conflict_alert.viewed",
      eventCategory: "circle",
      eventAction: "view",
      eventLabel: effectiveCircleId,
      eventValue: { circle_id: effectiveCircleId, tab: activeTab },
    });
  }, [effectiveCircleId, activeTab, track]);

  // conflict_alert.tab_switched — fires when the active tab changes. We
  // skip the initial render so the very first viewed event doesn't get a
  // matching tab_switched twin.
  const lastTabRef = useRef<TabKey | null>(null);
  useEffect(() => {
    if (lastTabRef.current === null) {
      lastTabRef.current = activeTab;
      return;
    }
    if (lastTabRef.current === activeTab) return;
    lastTabRef.current = activeTab;
    track({
      eventType: "conflict_alert.tab_switched",
      eventCategory: "circle",
      eventAction: "click",
      eventLabel: effectiveCircleId ?? "none",
      eventValue: { circle_id: effectiveCircleId, tab: activeTab },
    });
  }, [activeTab, effectiveCircleId, track]);

  // Bucket B — UX state. HelpSheet visibility, per-pill explainer payload,
  // and the unified confirm-sheet payload that replaces Alert.alert for
  // formation review + resolve actions.
  const [helpOpen, setHelpOpen] = useState(false);
  const [pillExplainer, setPillExplainer] = useState<
    { kind: "tier" | "severity"; key: string } | null
  >(null);
  type ConfirmSheetPayload =
    | { kind: "review"; outcome: "approved" | "override" | "rejected"; flag: FormationFlag }
    | { kind: "resolve"; conflict: ConflictRecord }
    | null;
  const [confirmSheet, setConfirmSheet] = useState<ConfirmSheetPayload>(null);

  // Wire to real hooks. The cache layer added in P0 (see
  // useConflictPrediction.ts) is keyed by the id passed in, so passing
  // `undefined` short-circuits the fetch and returns empty data.
  const formation = useFormationReview();
  const monitor = usePostFormationMonitor(effectiveCircleId);
  // Bucket A fix: was useConflictHistory(effectiveCircleId) — wrong
  // semantic. The hook filtered by member_id, so this returned []. The
  // renamed hook calls engine.getCircleConflicts(circleId) which actually
  // filters by circle_id.
  const history = useCircleConflictHistory(effectiveCircleId);
  const disputes = useCircleDisputes(effectiveCircleId);
  const actions = useConflictActions();

  // Bucket A — collect every user id that appears on the visible cards
  // (pair members from formation flags, monitored pair members, dispute
  // parties) into a single batch lookup. Falls back to shortId on miss.
  const profileIds = useMemo<string[]>(() => {
    const ids = new Set<string>();
    for (const flag of formation.pendingReviews) {
      const pairs = (flag.flaggedPairIds ?? []) as unknown as FlaggedPair[];
      for (const p of pairs) {
        if (p.member_a_id) ids.add(p.member_a_id);
        if (p.member_b_id) ids.add(p.member_b_id);
      }
    }
    for (const m of monitor.monitors) {
      if (m.memberAId) ids.add(m.memberAId);
      if (m.memberBId) ids.add(m.memberBId);
    }
    for (const d of disputes.disputes) {
      if (d.complainantId) ids.add(d.complainantId);
      if (d.respondentId) ids.add(d.respondentId);
    }
    return Array.from(ids);
  }, [formation.pendingReviews, monitor.monitors, disputes.disputes]);
  const { names: profileNames } = useProfileBatch(profileIds);
  const resolveName = useCallback(
    (id?: string | null) => (id && profileNames.get(id)) || shortId(id ?? undefined),
    [profileNames],
  );

  const isRefreshing =
    (activeTab === "live_signals" &&
      (formation.loading || monitor.loading || disputes.loading)) ||
    (activeTab === "history" && history.loading);

  const handleRefresh = useCallback(() => {
    if (activeTab === "live_signals") {
      formation.refresh();
      monitor.refresh();
      disputes.refresh();
    } else {
      history.refresh();
    }
  }, [activeTab, formation, monitor, disputes, history]);

  // ── Formation review handlers ──────────────────────────────────────────────
  // Map UI verbs ("approved" / "rejected" / "override") to the engine's
  // ReviewOutcome enum. The original code mistakenly called
  // actions.resolveConflict() (which targets conflict_history) with a
  // FormationFlag id — that would have either errored or silently mutated
  // the wrong row. Correct call is formation.reviewFormation() which routes
  // to ConflictPredictionEngine.reviewFormationFlag().
  const mapToReviewOutcome = (
    uiOutcome: "approved" | "rejected" | "override"
  ): ReviewOutcome => {
    if (uiOutcome === "approved") return "approved";
    if (uiOutcome === "rejected") return "formation_blocked";
    return "overridden";
  };

  // Bucket B — Alert.alert replaced by a single confirm bottom sheet.
  // The Alert.alert call below is the ONE remaining guard: an unauthenticated
  // reviewer is a state error, not a confirm flow, so keep it as a native
  // alert with no bottom-sheet detour.
  const handleReview = useCallback((flag: FormationFlag, uiOutcome: "approved" | "rejected" | "override") => {
    if (!user?.id) {
      Alert.alert(t("conflict_alert.alert_signin_required_title"), t("conflict_alert.alert_signin_required_body"));
      return;
    }
    setConfirmSheet({ kind: "review", outcome: uiOutcome, flag });
  }, [user?.id, t]);

  // ── Resolve conflict handler ───────────────────────────────────────────────
  const handleResolve = useCallback((conflict: ConflictRecord) => {
    setConfirmSheet({ kind: "resolve", conflict });
  }, []);

  // ── Confirm-sheet executor — runs the action chosen above. The sheet
  // closes immediately on tap, then awaits the engine call. Errors fall back
  // to a native Alert.alert because the sheet is already gone by then.
  const executeConfirm = useCallback(async () => {
    if (!confirmSheet) return;
    const payload = confirmSheet;
    setConfirmSheet(null);
    try {
      if (payload.kind === "review") {
        if (!user?.id) return;
        await formation.reviewFormation(
          payload.flag.id,
          user.id,
          mapToReviewOutcome(payload.outcome),
          // Server-side audit note — English by design (see Bucket A).
          "Reviewed via mobile dashboard",
        );
        formation.refresh();
        // Bucket C telemetry — fires only on a successful engine write so
        // the dataset doesn't get polluted with attempted-but-failed
        // reviews (those surface as Alert.alert below).
        track({
          eventType: "conflict_alert.review_submitted",
          eventCategory: "circle",
          eventAction: "submit",
          eventLabel: effectiveCircleId ?? "none",
          eventValue: {
            circle_id: effectiveCircleId,
            flag_id: payload.flag.id,
            outcome: payload.outcome,
          },
        });
      } else if (payload.kind === "resolve") {
        await actions.resolveConflict(payload.conflict.id, "manual", "Resolved from mobile");
        history.refresh();
        track({
          eventType: "conflict_alert.resolved",
          eventCategory: "circle",
          eventAction: "submit",
          eventLabel: effectiveCircleId ?? "none",
          eventValue: {
            circle_id: effectiveCircleId,
            conflict_id: payload.conflict.id,
            resolved_by: myRole,
          },
        });
      }
    } catch (err: any) {
      const failKey =
        payload.kind === "review"
          ? "conflict_alert.alert_failed_review"
          : "conflict_alert.alert_failed_resolve";
      Alert.alert(t("conflict_alert.alert_error_title"), err?.message ?? t(failKey));
    }
  }, [confirmSheet, user?.id, formation, actions, history, t, track, effectiveCircleId, myRole]);

  // ── Bucket B coach mark ────────────────────────────────────────────────────
  // First-visit hint. AsyncStorage-gated so it shows once per device/install.
  // Auto-dismiss after 4s or on tap. Mirrors InsurancePoolScreen / SubstitutePool /
  // PartialContribution Bucket B.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(CONFLICT_COACH_KEY);
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
    AsyncStorage.setItem(CONFLICT_COACH_KEY, "1").catch(() => undefined);
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  // ── Open mediation handler ─────────────────────────────────────────────────
  // The dispute_cases row drives Universe B. Tap routes to MediationCase
  // (ConflictCaseScreen) — that screen owns the elder claim + ruling flow
  // through ElderContext. The dispute id is carried via navigation state so
  // the destination can hydrate the case lazily.
  const handleOpenMediation = useCallback((dispute: CircleDisputeRow) => {
    track({
      eventType: "conflict_alert.dispute_opened",
      eventCategory: "circle",
      eventAction: "click",
      eventLabel: effectiveCircleId ?? "none",
      eventValue: {
        circle_id: effectiveCircleId,
        dispute_id: dispute.id,
      },
    });
    navigation.navigate(Routes.MediationCase, { caseId: dispute.id });
  }, [navigation, track, effectiveCircleId]);

  // ── Formation section (Bucket A: empty rendered by combined fallback). ────
  const renderFormationSection = () => {
    if (formation.loading && formation.pendingReviews.length === 0) {
      return <LoadingPlaceholder />;
    }
    if (formation.pendingReviews.length === 0) return null;

    return formation.pendingReviews.map((flag) => {
      // Engine: circleTier (not frictionTier), flaggedPairIds (snake-cased
      // payload, not flaggedPairs), flaggedAt (not createdAt), reviewNotes
      // (not notes). friction_score is already 0-100, no *100 needed.
      const tierMeta = TIER_META[flag.circleTier] ?? TIER_META.clear;
      const tierLabel = t(`conflict_alert.tier_${flag.circleTier ?? "clear"}`);
      const pairs = flag.flaggedPairIds as unknown as FlaggedPair[];
      return (
        <View key={flag.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <TouchableOpacity
              style={[styles.tierPill, { backgroundColor: tierMeta.bg }]}
              onPress={() => setPillExplainer({ kind: "tier", key: flag.circleTier ?? "clear" })}
              accessibilityRole="button"
              accessibilityLabel={t("conflict_alert.tier_explainer_open", { label: tierLabel })}
            >
              <View style={[styles.tierDot, { backgroundColor: tierMeta.color }]} />
              <Text style={[styles.tierLabel, { color: tierMeta.color }]}>{tierLabel}</Text>
              <Ionicons
                name="help-circle-outline"
                size={12}
                color={tierMeta.color}
                style={{ marginLeft: 2 }}
              />
            </TouchableOpacity>
            <Text style={styles.cardTimestamp}>
              {new Date(flag.flaggedAt).toLocaleDateString()}
            </Text>
          </View>

          <Text style={styles.cardTitle}>{t("conflict_alert.card_title")}</Text>
          <Text style={styles.cardNotes}>
            {t("conflict_alert.live_signals_subtitle", {
              scored: flag.totalPairs,
              flagged: flag.flaggedPairs,
              highest: Math.round(flag.highestScore),
            })}
          </Text>

          {pairs && pairs.length > 0 && (
            <View style={styles.pairsList}>
              {pairs.map((pair: FlaggedPair, idx: number) => (
                <View key={idx} style={styles.pairRow}>
                  <Ionicons name="people-outline" size={16} color="#6B7280" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pairText}>
                      {resolveName(pair.member_a_id)} ↔ {resolveName(pair.member_b_id)}
                    </Text>
                    <Text style={[styles.pairText, { fontSize: 11, color: "#9CA3AF" }]}>
                      {t("conflict_alert.monitor_top_factor", {
                        factor: formatFactor(pair.top_factor),
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.pairScore,
                      { color: SEVERITY_META[severityFromScore(pair.friction_score)].color },
                    ]}
                  >
                    {Math.round(pair.friction_score)}/100
                  </Text>
                </View>
              ))}
            </View>
          )}

          {flag.reviewNotes && (
            <Text style={styles.cardNotes}>{flag.reviewNotes}</Text>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleReview(flag, "approved")}
              disabled={actions.submitting}
            >
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>{t("conflict_alert.btn_approve")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.overrideBtn]}
              onPress={() => handleReview(flag, "override")}
              disabled={actions.submitting}
            >
              <Ionicons name="swap-horizontal" size={16} color="#F59E0B" />
              <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>{t("conflict_alert.btn_override")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReview(flag, "rejected")}
              disabled={actions.submitting}
            >
              <Ionicons name="close" size={16} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>{t("conflict_alert.btn_reject")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  // ── Monitoring section (Bucket A: empty rendered by combined fallback). ──
  const renderMonitoringSection = () => {
    if (monitor.loading && monitor.monitors.length === 0) {
      return <LoadingPlaceholder />;
    }
    if (monitor.monitors.length === 0) return null;

    return (
      <>
        {monitor.hasEscalations && (
          <View style={styles.escalationBanner}>
            <Ionicons name="warning" size={20} color="#EF4444" />
            <Text style={styles.escalationText}>
              {t("conflict_alert.monitor_escalated_pairs", {
                count: monitor.escalated.length,
              })}
            </Text>
          </View>
        )}

        {/* Stats bar */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{monitor.activeCount}</Text>
            <Text style={styles.statLabel}>{t("conflict_alert.stat_active")}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: "#EF4444" }]}>{monitor.escalated.length}</Text>
            <Text style={styles.statLabel}>{t("conflict_alert.stat_escalated")}</Text>
          </View>
        </View>

        {monitor.monitors.map((m) => {
          // Engine: currentScore (not frictionScore) — already 0-100;
          // memberAId/memberBId only (no Name fields); escalationReason
          // (not reason); monitoringStart (not createdAt).
          // Previous code multiplied a 0-100 score by 100, making the bar
          // always fill (`width: 7000%`) — fixed in Bucket A.
          // Bucket B: score → severity goes through severityFromScore so
          // the bar fill, the pair-score text, and the card border all
          // agree on the same threshold bands.
          const score = m.currentScore ?? m.initialScore;
          const sevKey = severityFromScore(score);
          const sevColor = SEVERITY_META[sevKey].color;
          const showSevBorder = m.escalated || sevKey === "high" || sevKey === "critical";
          return (
            <View
              key={m.id}
              style={[
                styles.card,
                showSevBorder && { borderColor: sevColor, borderWidth: 1.5 },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.monitorMeta}>
                  <Ionicons
                    name={m.escalated ? "alert-circle" : "eye-outline"}
                    size={18}
                    color={m.escalated ? "#EF4444" : "#00C6AE"}
                  />
                  <Text style={[styles.monitorStatus, { color: m.escalated ? "#EF4444" : "#00C6AE" }]}>
                    {m.escalated
                      ? t("conflict_alert.monitor_escalated")
                      : t("conflict_alert.monitor_watching")}
                  </Text>
                </View>
                <Text style={styles.cardTimestamp}>
                  {new Date(m.monitoringStart).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.pairRow}>
                <Ionicons name="people" size={16} color="#0A2342" />
                <Text style={styles.pairTextBold}>
                  {resolveName(m.memberAId)} ↔ {resolveName(m.memberBId)}
                </Text>
              </View>

              <View style={styles.scoreBar}>
                <View style={styles.scoreTrack}>
                  <View
                    style={[
                      styles.scoreFill,
                      {
                        width: `${Math.min(score, 100)}%`,
                        backgroundColor: sevColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.scoreText}>
                  {Math.round(score)}/100
                </Text>
              </View>

              {m.escalationReason && (
                <Text style={styles.cardNotes}>{m.escalationReason}</Text>
              )}
            </View>
          );
        })}
      </>
    );
  };

  // ── Disputes section (Bucket A — Universe B unified into Live signals). ──
  const renderDisputesSection = () => {
    if (disputes.loading && disputes.disputes.length === 0) {
      return <LoadingPlaceholder />;
    }
    if (disputes.disputes.length === 0) return null;

    return (
      <>
        <Text style={styles.sectionHeader}>
          {t("conflict_alert.disputes_section_title", {
            count: disputes.disputes.length,
          })}
        </Text>
        {disputes.disputes.map((d) => (
          <View key={d.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.disputePillRow}>
                {d.autoCreated && (
                  <View style={[styles.disputePill, styles.disputePillAuto]}>
                    <Text style={styles.disputePillText}>
                      {t("conflict_alert.dispute_auto_created")}
                    </Text>
                  </View>
                )}
                {d.escalationTier && (
                  <View style={[styles.disputePill, styles.disputePillEscalated]}>
                    <Text style={[styles.disputePillText, { color: "#991B1B" }]}>
                      {t("conflict_alert.dispute_escalated_to", {
                        tier: t(`conflict_alert.dispute_tier_${d.escalationTier}`),
                      })}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardTimestamp}>
                {new Date(d.updatedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.cardTitle}>
              {d.autoCreated
                ? t("conflict_alert.dispute_title_auto", {
                    type: formatFactor(d.disputeType ?? "missed_contribution"),
                  })
                : t("conflict_alert.dispute_title_reported", {
                    reporter: resolveName(d.complainantId),
                  })}
            </Text>
            {d.description && (
              <Text style={styles.cardNotes} numberOfLines={3}>
                {d.description}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.resolveBtn]}
              onPress={() => handleOpenMediation(d)}
              accessibilityRole="button"
            >
              <Ionicons name="hammer-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>
                {t("conflict_alert.dispute_open_mediation")}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </>
    );
  };

  // ── Combined empty state for Live signals ─────────────────────────────────
  // When all three sections are empty and none is loading, render ONE card
  // instead of the previous three stacked empties (formation + monitor +
  // disputes). Mirrors the "this circle is healthy" framing in Circle Health
  // Bucket B's no-data state.
  const liveSignalsFullyEmpty =
    !formation.loading &&
    !monitor.loading &&
    !disputes.loading &&
    formation.pendingReviews.length === 0 &&
    monitor.monitors.length === 0 &&
    disputes.disputes.length === 0;

  // ── History tab ────────────────────────────────────────────────────────────
  const renderHistoryTab = () => {
    if (history.loading && history.conflicts.length === 0) {
      return <LoadingPlaceholder />;
    }

    if (history.conflicts.length === 0) {
      return (
        <EmptyState
          icon="time"
          title={t("conflict_alert.history_empty_title")}
          subtitle={t("conflict_alert.history_empty_body")}
        />
      );
    }

    return (
      <>
        {/* Summary bar */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{history.conflicts.length}</Text>
            <Text style={styles.statLabel}>{t("conflict_alert.stat_total")}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: "#F59E0B" }]}>{history.unresolvedCount}</Text>
            <Text style={styles.statLabel}>{t("conflict_alert.stat_unresolved")}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: "#EF4444" }]}>{history.highSeverityCount}</Text>
            <Text style={styles.statLabel}>{t("conflict_alert.stat_high_severity")}</Text>
          </View>
        </View>

        {history.conflicts.map((conflict) => {
          const sev = SEVERITY_META[conflict.severity] ?? SEVERITY_META.low;
          const isResolved = !!conflict.resolvedAt;

          const sevLabel = t(`conflict_alert.severity_${conflict.severity}`);
          return (
            <View key={conflict.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <TouchableOpacity
                  style={[styles.severityPill, { backgroundColor: sev.bg }]}
                  onPress={() => setPillExplainer({ kind: "severity", key: conflict.severity })}
                  accessibilityRole="button"
                  accessibilityLabel={t("conflict_alert.severity_explainer_open", { label: sevLabel })}
                >
                  <Ionicons name={sev.icon as any} size={14} color={sev.color} />
                  <Text style={[styles.severityLabel, { color: sev.color }]}>{sevLabel}</Text>
                  <Ionicons
                    name="help-circle-outline"
                    size={12}
                    color={sev.color}
                    style={{ marginLeft: 2 }}
                  />
                </TouchableOpacity>
                <View style={[styles.statusPill, isResolved ? styles.resolvedPill : styles.unresolvedPill]}>
                  <Text style={[styles.statusText, { color: isResolved ? "#10B981" : "#F59E0B" }]}>
                    {isResolved
                      ? t("conflict_alert.status_resolved")
                      : t("conflict_alert.status_open")}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>
                {(conflict.conflictType ?? "Conflict").replace(/_/g, " ")}
              </Text>
              <Text style={styles.cardTimestamp}>
                {new Date(conflict.reportedAt).toLocaleDateString()}
              </Text>

              {conflict.description && (
                <Text style={styles.cardNotes} numberOfLines={3}>{conflict.description}</Text>
              )}

              {!isResolved && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.resolveBtn]}
                  onPress={() => handleResolve(conflict)}
                  disabled={actions.submitting}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{t("conflict_alert.btn_resolve")}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("screen_headers.conflict_alert")}</Text>
          {/* Bucket B — opens the HelpSheet glossary. */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setHelpOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("conflict_alert.help_open")}
          >
            <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            // Badge counts — live_signals now combines formation + monitoring.
            let badge = 0;
            if (tab.key === "live_signals") {
              // Bucket A: badge now includes open disputes too — the bucket
              // unification means the tab covers all three signal types.
              badge =
                formation.pendingReviews.length +
                monitor.escalated.length +
                disputes.disputes.length;
            } else if (tab.key === "history") {
              badge = history.unresolvedCount;
            }

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? "#00C6AE" : "rgba(255,255,255,0.5)"}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t(tab.labelKey)}
                </Text>
                {badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.section}>
          {showNoCirclesState ? (
            <EmptyState
              icon="people-outline"
              title={t("conflict_alert.no_circle_title")}
              subtitle={t("conflict_alert.no_circle_body")}
            />
          ) : showCirclePicker ? (
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>
                {t("conflict_alert.pick_title")}
              </Text>
              <Text style={styles.pickerSubtitle}>
                {t("conflict_alert.pick_subtitle")}
              </Text>
              {activeCircles.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.pickerRow}
                  onPress={() => setSelectedCircleId(c.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.pickerEmoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerName}>{c.name}</Text>
                    <Text style={styles.pickerSub}>
                      {t("conflict_alert.pick_members", {
                        n: c.memberCount,
                      })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              {activeTab === "live_signals" && (
                <>
                  {liveSignalsFullyEmpty ? (
                    <EmptyState
                      icon="shield-checkmark"
                      title={t("conflict_alert.empty_no_live_signals_title")}
                      subtitle={t("conflict_alert.empty_no_live_signals_body")}
                    />
                  ) : (
                    <>
                      {renderFormationSection()}
                      <View style={{ height: 14 }} />
                      {renderMonitoringSection()}
                      <View style={{ height: 14 }} />
                      {renderDisputesSection()}
                    </>
                  )}
                </>
              )}
              {activeTab === "history" && renderHistoryTab()}
            </>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bucket B — sheets and coach mark, mounted outside ScrollView so
          they overlay the full screen. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <PillExplainerSheet
        explainer={pillExplainer}
        onClose={() => setPillExplainer(null)}
      />
      <ReviewConfirmSheet
        payload={confirmSheet}
        submitting={actions.submitting}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmSheet(null)}
      />

      {coachVisible && (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.coachCard}
            onPress={dismissCoach}
            accessibilityRole="button"
          >
            <Ionicons name="alert-circle-outline" size={20} color="#00C6AE" />
            <Text style={styles.coachText}>{t("conflict_alert.coach_tip")}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

// The dangling `t(...)` here predates the screen rewrite — there's no `t`
// in scope at module level. Render the activity indicator without a label;
// callers can still see the spinner.
function LoadingPlaceholder() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#00C6AE" />
    </View>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={56} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HelpSheet — Modal-based glossary for the conflict-alert surface. Opens from
// the header (?) button. Reads conflict_alert.help_<topic>_{title,body} for
// each of HELP_TOPICS.
// ══════════════════════════════════════════════════════════════════════════════
function HelpSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>
            {t("conflict_alert.help_sheet_title")}
          </Text>
          <ScrollView style={{ maxHeight: 460 }}>
            {HELP_TOPICS.map((topic, idx) => (
              <View
                key={topic}
                style={[
                  sheetStyles.helpItem,
                  idx === HELP_TOPICS.length - 1 && sheetStyles.helpItemLast,
                ]}
              >
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`conflict_alert.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.body}>
                  {t(`conflict_alert.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={sheetStyles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.closeBtnText}>
              {t("conflict_alert.help_close")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PillExplainerSheet — opens from a tier or severity pill. Renders one
// (title, body) pair keyed by the pill's kind + key.
// ══════════════════════════════════════════════════════════════════════════════
function PillExplainerSheet({
  explainer,
  onClose,
}: {
  explainer: { kind: "tier" | "severity"; key: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const visible = explainer != null;
  const prefix = explainer ? `conflict_alert.${explainer.kind}_explainer_${explainer.key}` : "";
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          {explainer ? (
            <>
              <Text style={sheetStyles.title}>{t(`${prefix}_title`)}</Text>
              <Text style={sheetStyles.body}>{t(`${prefix}_body`)}</Text>
            </>
          ) : null}
          <TouchableOpacity
            style={sheetStyles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.closeBtnText}>
              {t("conflict_alert.help_close")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ReviewConfirmSheet — bottom-sheet replacement for the prior Alert.alert
// confirm flows on Approve/Override/Reject + Resolve. Single Confirm + Cancel.
// Title and body are looked up by action key (approved/override/rejected/resolve).
// ══════════════════════════════════════════════════════════════════════════════
function ReviewConfirmSheet({
  payload,
  submitting,
  onConfirm,
  onCancel,
}: {
  payload:
    | { kind: "review"; outcome: "approved" | "override" | "rejected"; flag: FormationFlag }
    | { kind: "resolve"; conflict: ConflictRecord }
    | null;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const visible = payload != null;
  // actionKey collapses both kinds into one of four i18n suffixes so the
  // sheet can fetch title/body with a single template lookup.
  const actionKey = payload
    ? payload.kind === "resolve"
      ? "resolve"
      : payload.outcome
    : null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onCancel}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          {actionKey ? (
            <>
              <Text style={sheetStyles.title}>
                {t(`conflict_alert.review_confirm_title_${actionKey}`)}
              </Text>
              <Text style={sheetStyles.body}>
                {t(`conflict_alert.review_confirm_body_${actionKey}`)}
              </Text>
            </>
          ) : null}
          <View style={sheetStyles.confirmRow}>
            <TouchableOpacity
              style={[sheetStyles.cancelBtn]}
              onPress={onCancel}
              accessibilityRole="button"
              disabled={submitting}
            >
              <Text style={sheetStyles.cancelBtnText}>
                {t("conflict_alert.review_confirm_cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sheetStyles.closeBtn, { flex: 1, marginTop: 0 }]}
              onPress={onConfirm}
              accessibilityRole="button"
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={sheetStyles.closeBtnText}>
                  {t("conflict_alert.review_confirm_confirm")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 12,
  },
  body: {
    fontSize: 13,
    color: "#0A2342",
    lineHeight: 19,
  },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  helpItemLast: { borderBottomWidth: 0 },
  helpItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  closeBtn: {
    backgroundColor: "#0A2342",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#0A2342",
    fontSize: 14,
    fontWeight: "700",
  },
});

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },

  // Header
  header: { paddingTop: 60, paddingBottom: 4, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  // Tab bar
  tabBar: { flexDirection: "row", marginBottom: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#00C6AE" },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
  tabLabelActive: { color: "#FFFFFF" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },

  // Content
  content: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 16 },

  // Cards
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 6 },
  cardTimestamp: { fontSize: 12, color: "#9CA3AF" },
  cardNotes: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginTop: 8 },

  // Tier pill
  tierPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierLabel: { fontSize: 12, fontWeight: "600" },

  // Severity pill
  severityPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  severityLabel: { fontSize: 12, fontWeight: "600" },

  // Status pill
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  resolvedPill: { backgroundColor: "#ECFDF5" },
  unresolvedPill: { backgroundColor: "#FFFBEB" },
  statusText: { fontSize: 12, fontWeight: "600" },

  // Bucket A — section header above the Disputes list within Live signals
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 10,
  },
  disputePillRow: { flexDirection: "row", gap: 6 },
  disputePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  disputePillAuto: { backgroundColor: "#EEF2FF" },
  disputePillEscalated: { backgroundColor: "#FEE2E2" },
  disputePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4338CA",
    letterSpacing: 0.3,
  },

  // Pairs list
  pairsList: { marginTop: 8, gap: 6 },
  pairRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  pairText: { flex: 1, fontSize: 13, color: "#6B7280" },
  pairTextBold: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0A2342" },
  pairScore: { fontSize: 13, fontWeight: "700" },

  // Score bar (monitoring)
  scoreBar: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  scoreTrack: { flex: 1, height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  scoreFill: { height: 6, borderRadius: 3 },
  scoreText: { fontSize: 13, fontWeight: "700", color: "#0A2342", width: 36, textAlign: "right" },

  // Escalation banner
  escalationBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#FCA5A5" },
  escalationText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#EF4444" },

  // Stats row
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#0A2342" },
  statLabel: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  // Monitor meta
  monitorMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  monitorStatus: { fontSize: 13, fontWeight: "600" },

  // Action buttons
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  approveBtn: { flex: 1, backgroundColor: "#00C6AE" },
  overrideBtn: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F59E0B" },
  rejectBtn: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EF4444" },
  resolveBtn: { alignSelf: "flex-start", backgroundColor: "#00C6AE", marginTop: 12 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center" },

  // Loading
  // Circle picker (rendered when route.params.circleId is undefined).
  pickerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  pickerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 14,
    lineHeight: 17,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  pickerEmoji: { fontSize: 22 },
  pickerName: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  pickerSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  loadingContainer: { alignItems: "center", paddingVertical: 60 },
  loadingText: { fontSize: 14, color: "#9CA3AF", marginTop: 12 },

  // Bucket B — first-visit coach overlay (mirrors InsurancePool pattern).
  coachOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
  },
  coachCard: {
    backgroundColor: "#0A2342",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  coachText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
  },
});
