import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import {
  useCurrentCycle,
  useCircleCycles,
  useCycleContributions,
  useCycleStats,
  useCycleStatusSummary,
} from "../hooks/useCycleProgression";
import type { ContributionStatus } from "../services/CycleProgressionEngine";

// Bucket B — AsyncStorage gate for the first-visit coach mark.
const TIMELINE_COACH_KEY = "@tandaxn_timeline_coach_seen_v1";

// Bucket B — HelpSheet topics, rendered together in one scrollable sheet
// from the header (?) button.
type HelpTopic =
  | "what_is_cycle"
  | "what_statuses_mean"
  | "deadline_vs_grace"
  | "who_receives_payout"
  | "missed_contribution"
  | "cycle_closes";
const HELP_TOPICS: HelpTopic[] = [
  "what_is_cycle",
  "what_statuses_mean",
  "deadline_vs_grace",
  "who_receives_payout",
  "missed_contribution",
  "cycle_closes",
];

// Bucket B — per-pill explainer payload. The same sheet renders any of
// the 7 ContributionStatus values, keyed by the status string.
type PillExplainer = { kind: "status"; key: ContributionStatus } | null;

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  blue: "#3B82F6",
  bg: "#F5F7FA",
  white: "#FFFFFF",
  muted: "#6B7280",
  border: "#E5E7EB",
};

type RouteParams = { circleId: string };

// ─── Helpers ──────────────────────────────────────────────────────────────
// Engine returns amounts in dollars (DECIMAL(15,2)) — NOT cents. Bucket A
// fix: the previous formatCents() helper divided by 100, so a $100
// contribution rendered as "$1.00". Replaced with a dollars-aware
// formatter.
const formatDollars = (n: number | string | null | undefined): string => {
  if (n == null) return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (!isFinite(num)) return "—";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// 8-char UUID prefix used when a profile join misses (e.g. a member was
// deleted but their contribution row still exists). Same shape as the
// fallback used by Conflict Alerts.
const shortId = (id: string | undefined | null): string =>
  id ? `${id.slice(0, 8)}…` : "—";

// ─── Status meta — 7 ContributionStatus values from the engine. ───────────
// Bucket A: the screen previously only handled "paid"/"pending" (and "paid"
// isn't even a valid DB enum value). Every member rendered as pending
// regardless of their real status. STATUS_META covers all 7 enum values
// from CycleProgressionEngine.ContributionStatus and is keyed by the
// status string so the renderer is just `STATUS_META[member.status]`.
type StatusMeta = {
  bg: string;
  fg: string;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
};
const STATUS_META: Record<ContributionStatus, StatusMeta> = {
  pending:   { bg: `${COLORS.yellow}20`, fg: "#A16207", icon: "time-outline",          labelKey: "cycle_timeline.status_pending" },
  partial:   { bg: `${COLORS.orange}20`, fg: "#C2410C", icon: "ellipse-outline",       labelKey: "cycle_timeline.status_partial" },
  completed: { bg: `${COLORS.green}20`,  fg: "#15803D", icon: "checkmark-circle",       labelKey: "cycle_timeline.status_completed" },
  late:      { bg: `${COLORS.orange}20`, fg: "#C2410C", icon: "alert-circle-outline",   labelKey: "cycle_timeline.status_late" },
  missed:    { bg: `${COLORS.red}20`,    fg: "#991B1B", icon: "close-circle",           labelKey: "cycle_timeline.status_missed" },
  excused:   { bg: `${COLORS.muted}20`,  fg: "#374151", icon: "remove-circle-outline",  labelKey: "cycle_timeline.status_excused" },
  covered:   { bg: `${COLORS.blue}20`,   fg: "#1D4ED8", icon: "shield-checkmark",       labelKey: "cycle_timeline.status_covered" },
};
const META_FALLBACK: StatusMeta = STATUS_META.pending;

// Statuses that count toward "this person is done for the cycle" — drives
// the progress bar, the paid-count text, and the user's CTA band.
const PAID_STATUSES: ContributionStatus[] = ["completed", "covered"];
const DONE_STATUSES: ContributionStatus[] = ["completed", "covered", "excused"];

// Bucket B — cycle-status meta drives the hero card state chip. Maps the
// CycleStatus enum to a colour + label + descriptor template. For states
// with a clear time signal (collecting, grace_period) we interpolate
// remaining days; the rest just show the label.
const CYCLE_STATUS_META: Record<string, { color: string; labelKey: string }> = {
  scheduled:        { color: COLORS.muted,  labelKey: "cycle_timeline.state_scheduled" },
  collecting:       { color: COLORS.teal,   labelKey: "cycle_timeline.state_collecting" },
  deadline_reached: { color: COLORS.orange, labelKey: "cycle_timeline.state_deadline_reached" },
  grace_period:     { color: COLORS.orange, labelKey: "cycle_timeline.state_grace_period" },
  ready_payout:     { color: COLORS.blue,   labelKey: "cycle_timeline.state_ready_payout" },
  payout_pending:   { color: COLORS.blue,   labelKey: "cycle_timeline.state_payout_pending" },
  payout_completed: { color: COLORS.green,  labelKey: "cycle_timeline.state_payout_completed" },
  payout_failed:    { color: COLORS.red,    labelKey: "cycle_timeline.state_payout_failed" },
  payout_retry:     { color: COLORS.orange, labelKey: "cycle_timeline.state_payout_retry" },
  closed:           { color: COLORS.green,  labelKey: "cycle_timeline.state_closed" },
  skipped:          { color: COLORS.muted,  labelKey: "cycle_timeline.state_skipped" },
  cancelled:        { color: COLORS.muted,  labelKey: "cycle_timeline.state_cancelled" },
};
const CYCLE_STATUS_FALLBACK = CYCLE_STATUS_META.scheduled;

// Pure day-delta helper used by the state chip for "X days left" / "X days
// grace left" decorations. Returns null when the input is missing.
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (!isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86400000));
}

// Relative-time label for a contribution timestamp. Bucket A: the screen
// previously rendered "Paid {date}" by string-concatenation in English;
// now it picks one of three i18n keys keyed by days delta.
function paidLabel(
  t: (k: string, opts?: any) => string,
  status: ContributionStatus,
  contributedAt: string | null | undefined,
): string {
  if (status === "covered") return t("cycle_timeline.status_covered_long");
  if (status === "excused") return t("cycle_timeline.status_excused_long");
  if (!contributedAt) return t(`cycle_timeline.${STATUS_META[status]?.labelKey.split(".")[1] ?? "status_pending"}`);
  const days = Math.floor((Date.now() - new Date(contributedAt).getTime()) / 86400000);
  if (days <= 0) return t("cycle_timeline.paid_today");
  if (days === 1) return t("cycle_timeline.paid_yesterday");
  return t("cycle_timeline.paid_n_days_ago", { count: days });
}

// CTA band state derived from the user's own contribution row. The audit
// spec maps the 7 statuses onto four buckets:
//   pending / late  → "Pay now"
//   partial         → "Top up"
//   completed/covered/excused → "Paid"
//   missed          → "Missed · contact admin"
type CtaState = "pay" | "top_up" | "paid" | "missed";
function ctaForStatus(status: ContributionStatus | undefined | null): CtaState {
  if (!status) return "pay";
  if (status === "partial") return "top_up";
  if (status === "missed") return "missed";
  if (status === "completed" || status === "covered" || status === "excused") return "paid";
  return "pay";
}

export default function CycleTimelineScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { circleId } = route.params;

  const {
    cycle: currentCycle,
    loading: cycleLoading,
    error: cycleError,
  } = useCurrentCycle(circleId);

  const {
    cycles: allCycles,
    loading: cyclesLoading,
    error: cyclesError,
  } = useCircleCycles(circleId);

  const {
    contributions,
    loading: contribLoading,
    error: contribError,
  } = useCycleContributions(currentCycle?.id);

  const { stats, loading: statsLoading } = useCycleStats(circleId);

  // Bucket B — the RPC-backed summary replaces the screen's client-side
  // count math for the progress bar. Cron + trigger updates land here
  // through the contribution-realtime listener inside the hook.
  const { summary } = useCycleStatusSummary(currentCycle?.id);

  // Bucket B — HelpSheet + per-pill explainer visibility.
  const [helpOpen, setHelpOpen] = useState(false);
  const [pillExplainer, setPillExplainer] = useState<PillExplainer>(null);

  // Bucket B — first-visit coach mark. Same Animated.Value + useRef gate
  // pattern as prior buckets (Conflict Alerts, Voting). Auto-dismiss
  // after 4 s, or on tap.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(TIMELINE_COACH_KEY);
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
    AsyncStorage.setItem(TIMELINE_COACH_KEY, "1").catch(() => undefined);
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  const loading = cycleLoading || cyclesLoading || contribLoading || statsLoading;
  // First non-null error from any of the three hooks. Bucket A fix B6:
  // previously cycleError was destructured but never rendered.
  const fetchError = cycleError ?? cyclesError ?? contribError ?? null;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  // ─── Derived metrics ───────────────────────────────────────────────────
  // Bucket A fix B1 was the client-side "paid = completed + covered"
  // filter. Bucket B prefers the RPC summary (one round-trip,
  // server-authoritative) when it's available; the client-side filter
  // stays as a graceful fallback so the bar renders even if the RPC errors.
  const { paidCount, totalMembers, progressPct } = useMemo(() => {
    if (summary) {
      return {
        paidCount: summary.totalReceived,
        totalMembers: summary.totalExpected,
        progressPct: summary.progressPctByCount,
      };
    }
    const list = contributions ?? [];
    const paid = list.filter((c: any) => PAID_STATUSES.includes(c.status)).length;
    const total = list.length;
    return {
      paidCount: paid,
      totalMembers: total,
      progressPct: total > 0 ? (paid / total) * 100 : 0,
    };
  }, [summary, contributions]);

  // Bucket B — state chip data for the hero card. The chip renders the
  // cycle's lifecycle state (collecting / grace_period / ready_payout /
  // …) with a remaining-days decoration for the two time-sensitive
  // states. Falls back to the bare label everywhere else.
  const stateChip = useMemo(() => {
    if (!currentCycle) return null;
    const meta = CYCLE_STATUS_META[currentCycle.status] ?? CYCLE_STATUS_FALLBACK;
    const base = t(meta.labelKey);
    let decoration = "";
    if (currentCycle.status === "collecting") {
      const left = daysUntil(currentCycle.contribution_deadline);
      if (left != null) {
        decoration = t("cycle_timeline.state_days_left", { count: left });
      }
    } else if (currentCycle.status === "grace_period" || currentCycle.status === "deadline_reached") {
      const left = daysUntil(currentCycle.grace_period_end);
      if (left != null) {
        decoration = t("cycle_timeline.state_grace_days_left", { count: left });
      }
    }
    return { meta, label: decoration ? `${base} · ${decoration}` : base };
  }, [currentCycle, t]);

  // Bucket B — payout-row tap handler. The simplest correct routing for
  // now is PayoutHistory for any tap; PayoutReceived is a transparent-
  // modal celebration screen wired to push notifications, not really
  // meant to be opened on-demand from history. Recipient-specific
  // deep linking can be revisited in Bucket C or later.
  const handlePayoutTap = useCallback(() => {
    navigation.navigate(Routes.PayoutHistory);
  }, [navigation]);

  // The user's own contribution row drives the CTA band. useCurrentCycle
  // attaches it as my_contribution.
  const myContribution = currentCycle?.my_contribution;
  const cta = ctaForStatus(myContribution?.status);

  const currentCycleNumber = currentCycle?.cycle_number ?? stats?.current_cycle_number ?? 0;
  const totalCyclesCount = stats?.total_cycles ?? allCycles?.length ?? 0;

  // The contribution amount sits on `circle.contribution_amount`; the
  // value comes from `circles.amount` (NUMERIC, dollars). The previous
  // screen ran it through formatCents which divided by 100 — a $100
  // contribution rendered as "$1.00". Bucket A: format as dollars
  // directly.
  const contributionAmount = currentCycle?.circle?.contribution_amount ?? 0;

  // ─── Loading state ────────────────────────────────────────────────────
  if (loading && !refreshing && !fetchError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loadingText}>{t("cycle_timeline.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("screen_headers.cycle_timeline")}</Text>
        {/* Bucket B — opens the HelpSheet glossary. */}
        <TouchableOpacity
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("cycle_timeline.help_open")}
        >
          <Ionicons name="help-circle-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {/* Bucket A fix B6: render fetch errors instead of swallowing them. */}
        {fetchError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>{t("cycle_timeline.error_title")}</Text>
              <Text style={styles.errorBody} numberOfLines={3}>{fetchError}</Text>
            </View>
          </View>
        )}

        {/* Current Cycle Card */}
        <View style={styles.card}>
          <Text style={styles.mutedText}>
            {currentCycle?.circle?.name ?? t("cycle_timeline.circle_fallback")}
          </Text>
          <View style={styles.cycleHeader}>
            <Text style={styles.cycleNumber}>
              {t("cycle_timeline.cycle_label", { n: currentCycleNumber })}
            </Text>
            <Text style={styles.cycleTotal}>
              {t("cycle_timeline.of_total", { n: totalCyclesCount })}
            </Text>
          </View>

          {/* Bucket B — state chip. Sits above the progress bar so the
              first thing the user sees about the active cycle is what
              state it's in (collecting / grace_period / ready_payout / …).
              Time-sensitive states (collecting, grace_period,
              deadline_reached) get a "X days left" decoration. */}
          {stateChip && (
            <View style={[styles.stateChip, { backgroundColor: `${stateChip.meta.color}15`, borderColor: stateChip.meta.color }]}>
              <View style={[styles.stateDot, { backgroundColor: stateChip.meta.color }]} />
              <Text style={[styles.stateChipText, { color: stateChip.meta.color }]}>
                {stateChip.label}
              </Text>
            </View>
          )}

          {/* Contribution Progress (Bucket A fix B1: real paid count) */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{t("final_polish.cycletimeline_contributions")}</Text>
              <Text style={[styles.progressLabel, { color: COLORS.teal }]}>
                {t("cycle_timeline.progress_paid", { paid: paidCount, total: totalMembers })}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>

          {/* Deadline & Payout Info (Bucket A fix B2: expected_payout_date) */}
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={20} color={COLORS.orange} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.infoLabel}>{t("final_polish.cycletimeline_deadline")}</Text>
                <Text style={styles.infoValue}>
                  {currentCycle?.contribution_deadline
                    ? new Date(currentCycle.contribution_deadline).toLocaleDateString()
                    : t("cycle_timeline.tbd")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.infoBox}
              onPress={handlePayoutTap}
              accessibilityRole="button"
              accessibilityLabel={t("cycle_timeline.payout_tap_open")}
            >
              <Ionicons name="card-outline" size={20} color={COLORS.green} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.infoLabel}>{t("final_polish.cycletimeline_payout")}</Text>
                <Text style={styles.infoValue}>
                  {currentCycle?.expected_payout_date
                    ? new Date(currentCycle.expected_payout_date).toLocaleDateString()
                    : t("cycle_timeline.tbd")}
                </Text>
                {currentCycle?.recipient?.full_name ? (
                  <Text style={styles.mutedText}>
                    {t("cycle_timeline.payout_to", { name: currentCycle.recipient.full_name })}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Member Contribution Status (Bucket A fix B5 + B3 + B4) */}
        <Text style={styles.sectionTitle}>{t("final_polish.cycletimeline_member_status")}</Text>
        {contributions && contributions.length > 0 ? (
          contributions.map((member: any, i: number) => {
            const meta = STATUS_META[member.status as ContributionStatus] ?? META_FALLBACK;
            // Bucket A fix B4: contributed_amount / expected_amount sit on
            // cycle_contributions as DECIMAL(15,2) dollars. The previous
            // screen read member.amount_cents (no such column) and fell
            // through to the circle's contribution_amount divided by 100.
            const memberAmount =
              member.contributed_amount && Number(member.contributed_amount) > 0
                ? member.contributed_amount
                : (member.expected_amount ?? contributionAmount);
            return (
              <View key={member.id ?? i} style={styles.card}>
                <View style={styles.memberRow}>
                  <View style={[styles.statusIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={16} color={meta.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      {/* Bucket A fix B3: the hook joins as user (not member). */}
                      {member.user?.full_name ?? shortId(member.user_id)}
                    </Text>
                    <Text style={styles.mutedText}>
                      {paidLabel(t, (member.status as ContributionStatus) ?? "pending", member.contributed_at)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.memberAmount}>{formatDollars(memberAmount)}</Text>
                    {/* Bucket B — tappable status pill opens a small sheet
                        explaining what that status means. */}
                    <TouchableOpacity
                      style={[styles.statusPill, { backgroundColor: meta.bg }]}
                      onPress={() =>
                        setPillExplainer({ kind: "status", key: (member.status as ContributionStatus) ?? "pending" })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t("cycle_timeline.status_explainer_open", { label: t(meta.labelKey) })}
                    >
                      <Text style={[styles.statusPillText, { color: meta.fg }]}>
                        {t(meta.labelKey)}
                      </Text>
                      <Ionicons name="help-circle-outline" size={10} color={meta.fg} style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="people-outline" size={36} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>{t("cycle_timeline.empty_no_members_title")}</Text>
            <Text style={styles.emptyBody}>{t("cycle_timeline.empty_no_members_body")}</Text>
          </View>
        )}

        {/* Bucket B — horizontal cycle strip. Replaces the redundant
            vertical "Full Timeline" list with a glanceable scroll of
            dots, one per cycle. Tap a dot to drill into CycleDetail.
            Colour: green for completed/closed, teal for the active cycle,
            gray for upcoming. */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{t("cycle_timeline.jump_to_cycle")}</Text>
        {allCycles && allCycles.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
            style={styles.stripScroll}
          >
            {allCycles.map((cycle: any) => {
              const isActive = cycle.id === currentCycle?.id;
              const isCompleted = cycle.status === "closed" || cycle.status === "payout_completed";
              const dotColor = isCompleted ? COLORS.green : isActive ? COLORS.teal : "#D1D5DB";
              return (
                <TouchableOpacity
                  key={cycle.id ?? cycle.cycle_number}
                  style={styles.stripItem}
                  onPress={() =>
                    navigation.navigate(Routes.CycleDetail, { circleId, cycleId: cycle.id })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("cycle_timeline.cycle_label", { n: cycle.cycle_number })}
                >
                  <View style={[styles.stripDot, { backgroundColor: dotColor }, isActive && styles.stripDotActive]}>
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    ) : isActive ? (
                      <Ionicons name="pulse" size={14} color="#FFF" />
                    ) : (
                      <Text style={styles.stripDotNumber}>{cycle.cycle_number}</Text>
                    )}
                  </View>
                  <Text style={[styles.stripLabel, isActive && { color: COLORS.teal, fontWeight: "700" }]}>
                    {cycle.cycle_number}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="hourglass-outline" size={36} color={COLORS.muted} />
            <Text style={styles.emptyBody}>{t("cycle_timeline.empty_no_cycles")}</Text>
          </View>
        )}

        {/* Bucket A fix A.7 — status-aware CTA band. The previous screen
            always rendered "Pay $1.00 Now" regardless of whether the user
            had already paid (or how their status compared to the cycle
            state). Now the band reflects the user's contribution row. */}
        <CtaBand
          state={cta}
          amount={contributionAmount}
          onPay={() => navigation.navigate(Routes.MakeContribution, { circleId })}
        />
      </ScrollView>

      {/* Bucket B — HelpSheet + per-pill explainer sheets, mounted
          outside the ScrollView so they overlay the full screen. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <PillExplainerSheet explainer={pillExplainer} onClose={() => setPillExplainer(null)} />

      {/* Bucket B — first-visit coach mark. */}
      {coachVisible && (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.coachCard} onPress={dismissCoach} accessibilityRole="button">
            <Ionicons name="bulb-outline" size={20} color={COLORS.teal} />
            <Text style={styles.coachText}>{t("cycle_timeline.coach_tip")}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HelpSheet — six-topic glossary, opened from the header (?) button.
// ══════════════════════════════════════════════════════════════════════════════
function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>{t("cycle_timeline.help_sheet_title")}</Text>
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
                  {t(`cycle_timeline.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.body}>
                  {t(`cycle_timeline.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={sheetStyles.closeBtnText}>{t("cycle_timeline.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PillExplainerSheet — per-status explainer. The 7 ContributionStatus
// values each carry a {title, body} pair under cycle_timeline.status_
// explainer_<key>_*.
// ══════════════════════════════════════════════════════════════════════════════
function PillExplainerSheet({
  explainer,
  onClose,
}: {
  explainer: PillExplainer;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const visible = explainer != null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          {explainer ? (
            <>
              <Text style={sheetStyles.title}>
                {t(`cycle_timeline.status_explainer_${explainer.key}_title`)}
              </Text>
              <Text style={sheetStyles.body}>
                {t(`cycle_timeline.status_explainer_${explainer.key}_body`)}
              </Text>
            </>
          ) : null}
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={sheetStyles.closeBtnText}>{t("cycle_timeline.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Status-aware CTA band ───────────────────────────────────────────────
function CtaBand({
  state,
  amount,
  onPay,
}: {
  state: CtaState;
  amount: number;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  if (state === "paid") {
    return (
      <View style={[styles.payBandBase, styles.payBandPaid]}>
        <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
        <Text style={[styles.payBandText, { color: COLORS.green }]}>
          {t("cycle_timeline.cta_paid")}
        </Text>
      </View>
    );
  }
  if (state === "missed") {
    return (
      <View style={[styles.payBandBase, styles.payBandMissed]}>
        <Ionicons name="alert-circle" size={20} color={COLORS.red} />
        <Text style={[styles.payBandText, { color: COLORS.red }]}>
          {t("cycle_timeline.cta_missed")}
        </Text>
      </View>
    );
  }
  // pending / late / top_up — all tappable; copy varies.
  const labelKey = state === "top_up" ? "cycle_timeline.cta_top_up" : "cycle_timeline.cta_pay_now";
  return (
    <TouchableOpacity style={styles.payButton} onPress={onPay} accessibilityRole="button">
      <Ionicons name="card" size={20} color="#FFF" style={{ marginRight: 8 }} />
      <Text style={styles.payButtonText}>
        {t(labelKey, { amount: `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` })}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg, gap: 12 },
  loadingText: { fontSize: 13, color: COLORS.muted, marginTop: 8 },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorTitle: { fontSize: 13, fontWeight: "700", color: COLORS.red },
  errorBody: { fontSize: 12, color: "#991B1B", marginTop: 2 },

  emptyCard: { alignItems: "center", paddingVertical: 24, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: COLORS.navy, marginTop: 8 },
  emptyBody: { fontSize: 12, color: COLORS.muted, textAlign: "center", paddingHorizontal: 24 },

  mutedText: { fontSize: 13, color: COLORS.muted },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 12 },

  cycleHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4, marginBottom: 16 },
  cycleNumber: { fontSize: 28, fontWeight: "800", color: COLORS.navy },
  cycleTotal: { fontSize: 17, color: COLORS.muted },

  progressSection: { marginBottom: 16 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: "600", color: COLORS.navy },
  progressTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: COLORS.teal, borderRadius: 4 },

  infoGrid: { flexDirection: "row", gap: 12 },
  infoBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
  },
  infoLabel: { fontSize: 11, color: COLORS.muted },
  infoValue: { fontSize: 13, fontWeight: "700", color: COLORS.navy },

  memberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  memberName: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  memberAmount: { fontSize: 14, fontWeight: "700", color: COLORS.navy },
  // Bucket B: pill is now tappable + carries a (?) glyph; styled as flex
  // row to fit the icon.
  statusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  statusPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  // Bucket B — horizontal cycle strip (replaces the vertical timeline list).
  stripScroll: { marginBottom: 12 },
  stripContent: { paddingVertical: 4, paddingHorizontal: 2, gap: 14 },
  stripItem: { alignItems: "center", gap: 4 },
  stripDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stripDotActive: {
    borderWidth: 2,
    borderColor: COLORS.teal,
    transform: [{ scale: 1.05 }],
  },
  stripDotNumber: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  stripLabel: { fontSize: 11, color: COLORS.muted },

  // Bucket B — state chip on hero card.
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateChipText: { fontSize: 12, fontWeight: "700" },

  // Bucket B — first-visit coach overlay.
  coachOverlay: { position: "absolute", left: 16, right: 16, bottom: 24 },
  coachCard: {
    backgroundColor: COLORS.navy,
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
  coachText: { flex: 1, color: "#FFF", fontSize: 13, lineHeight: 18 },

  payButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  payButtonText: { fontSize: 16, fontWeight: "700", color: "#FFF" },

  // CTA band variants (paid / missed)
  payBandBase: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  payBandPaid: { backgroundColor: `${COLORS.green}15`, borderWidth: 1, borderColor: `${COLORS.green}55` },
  payBandMissed: { backgroundColor: `${COLORS.red}15`, borderWidth: 1, borderColor: `${COLORS.red}55` },
  payBandText: { fontSize: 14, fontWeight: "700" },
});

// ── Sheet styles shared by HelpSheet + PillExplainerSheet ────────────────────
const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 12 },
  body: { fontSize: 13, color: COLORS.navy, lineHeight: 19 },
  helpItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  helpItemLast: { borderBottomWidth: 0 },
  helpItemTitle: { fontSize: 14, fontWeight: "700", color: COLORS.navy, marginBottom: 4 },
  closeBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  closeBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
