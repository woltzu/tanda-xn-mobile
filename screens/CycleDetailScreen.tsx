import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import {
  useCycleContributions,
  useCycleEvents,
  useCycleStatusSummary,
} from "../hooks/useCycleProgression";
import type {
  CycleWithDetails,
} from "../hooks/useCycleProgression";
import type {
  ContributionStatus,
} from "../services/CycleProgressionEngine";
// Substitution Visibility A.3 — overlay active substitution_records rows
// (pending_confirmation / confirmed / admin_pending) onto the per-member
// contribution list so members + admins see in-flight substitutions in
// the natural cycle-context flow instead of needing to navigate to
// SubstitutePoolScreen.
import {
  useCycleSubstitutions,
  type CycleSubstitutionRow,
} from "../hooks/useCycleSubstitutions";

type RouteParams = { circleId: string; cycleId: string };

// Reused palette + helpers — keep visual parity with the parent screen so
// drilling into a cycle doesn't feel like a different app.
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

const formatDollars = (n: number | string | null | undefined): string => {
  if (n == null) return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (!isFinite(num)) return "—";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const shortId = (id: string | undefined | null): string =>
  id ? `${id.slice(0, 8)}…` : "—";

// Mirror the parent screen's STATUS_META so the same status renders
// identically on both surfaces. If this diverges, the user gets confused.
type StatusMeta = { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; labelKey: string };
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

// ── Cycle-status badge meta. Maps the CycleStatus enum (collecting,
// ── grace_period, ready_payout, …) to colour + i18n key for the chip in
// ── the header. Keys live alongside the parent screen's state_chip_* set.
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

// Same paid-as-done semantics as the parent screen.
const PAID_STATUSES: ContributionStatus[] = ["completed", "covered"];

export default function CycleDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { cycleId } = route.params;

  // The detail screen owns its own cycle fetch (the parent's useCurrentCycle
  // only returns the active cycle). One-shot read by id with the same
  // circle + recipient joins so we can render the summary card.
  const [cycle, setCycle] = useState<CycleWithDetails | null>(null);
  const [cycleLoading, setCycleLoading] = useState(true);
  const [cycleError, setCycleError] = useState<string | null>(null);

  const fetchCycle = useCallback(async () => {
    if (!cycleId) return;
    try {
      setCycleLoading(true);
      const { data, error } = await supabase
        .from("circle_cycles")
        .select(`
          *,
          circle:circles(
            id, name,
            contribution_amount:amount, contribution_frequency,
            total_cycles, max_members:member_count, community_id, status
          ),
          recipient:profiles!circle_cycles_recipient_user_id_fkey(
            id, full_name, avatar_url
          )
        `)
        .eq("id", cycleId)
        .single();
      if (error) throw error;
      setCycle(data as CycleWithDetails);
      setCycleError(null);
    } catch (err: any) {
      console.error("[CycleDetail] fetch failed", err);
      setCycleError(err.message);
    } finally {
      setCycleLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    fetchCycle();
  }, [fetchCycle]);

  // Realtime — keep the single row fresh as the cron flips status.
  useEffect(() => {
    if (!cycleId) return;
    const subscription = supabase
      .channel(`cycle-detail-${cycleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "circle_cycles",
          filter: `id=eq.${cycleId}`,
        },
        () => { fetchCycle(); },
      )
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [cycleId, fetchCycle]);

  const { contributions, loading: contribLoading, error: contribError } = useCycleContributions(cycleId);
  const { events, loading: eventsLoading } = useCycleEvents(cycleId, 30);
  const { summary } = useCycleStatusSummary(cycleId);
  // Substitution Visibility A.3 — fetch non-terminal substitutions for this
  // cycle (migration 235). Returned rows are keyed off
  // entry_cycle_id = p_cycle_id and limited to pending_confirmation /
  // confirmed / admin_pending. Empty array when no in-flight subs exist.
  const { rows: substitutionRows } = useCycleSubstitutions(cycleId);
  // Build a Map<exiting_member_id → substitution_row> for O(1) lookup
  // inside the per-member render. exiting_member_id is the original
  // circle_members.user_id, which is what `contributions[].user_id`
  // already carries — so matching is direct.
  const substitutionByExitingMember = useMemo<
    Map<string, CycleSubstitutionRow>
  >(() => {
    const m = new Map<string, CycleSubstitutionRow>();
    for (const row of substitutionRows) {
      m.set(row.exiting_member_id, row);
    }
    return m;
  }, [substitutionRows]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchCycle();
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, [fetchCycle]);

  const loading = cycleLoading || contribLoading || eventsLoading;
  const fetchError = cycleError ?? contribError ?? null;

  // ── Derived ──────────────────────────────────────────────────────────────
  // Prefer the RPC totals when they're available; fall back to local counts
  // so the detail card renders something useful even if the RPC errors.
  const totalReceived = summary?.totalReceived ?? contributions.filter((c: any) => PAID_STATUSES.includes(c.status)).length;
  const totalExpected = summary?.totalExpected ?? contributions.length;
  const progressPct = useMemo(() => {
    if (summary && summary.progressPctByCount > 0) return summary.progressPctByCount;
    return totalExpected > 0 ? (totalReceived / totalExpected) * 100 : 0;
  }, [summary, totalReceived, totalExpected]);

  const stateMeta = cycle
    ? CYCLE_STATUS_META[cycle.status] ?? CYCLE_STATUS_FALLBACK
    : CYCLE_STATUS_FALLBACK;

  // ── Loading / not-found gates ───────────────────────────────────────────
  if (loading && !cycle && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loadingText}>{t("cycle_timeline.detail_loading")}</Text>
      </View>
    );
  }
  if (!cycle) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.red} />
        <Text style={styles.errorTitle}>{t("cycle_timeline.detail_not_found_title")}</Text>
        <Text style={styles.errorBody}>{t("cycle_timeline.detail_not_found_body")}</Text>
        <TouchableOpacity style={styles.backCta} onPress={() => navigation.goBack()}>
          <Text style={styles.backCtaText}>{t("cycle_timeline.detail_back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("cycle_timeline.cycle_label", { n: cycle.cycle_number })}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.stateChipRow}>
          <View style={[styles.stateChip, { backgroundColor: `${stateMeta.color}30`, borderColor: stateMeta.color }]}>
            <View style={[styles.stateDot, { backgroundColor: stateMeta.color }]} />
            <Text style={styles.stateChipText}>{t(stateMeta.labelKey)}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {fetchError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>{t("cycle_timeline.error_title")}</Text>
              <Text style={styles.errorBody} numberOfLines={3}>{fetchError}</Text>
            </View>
          </View>
        )}

        {/* Summary card — recipient + payout amount + dates + progress */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t("cycle_timeline.detail_recipient")}</Text>
          <Text style={styles.cardValue}>
            {cycle.recipient?.full_name ?? shortId(cycle.recipient_user_id)}
          </Text>

          <View style={styles.cardDivider} />

          <View style={styles.cardRow}>
            <View style={styles.cardCell}>
              <Text style={styles.cardLabel}>{t("cycle_timeline.detail_payout_amount")}</Text>
              <Text style={styles.cardValue}>{formatDollars(cycle.payout_amount)}</Text>
            </View>
            <View style={styles.cardCell}>
              <Text style={styles.cardLabel}>
                {cycle.actual_payout_date
                  ? t("cycle_timeline.detail_actual_payout_date")
                  : t("cycle_timeline.detail_expected_payout_date")}
              </Text>
              <Text style={styles.cardValue}>
                {cycle.actual_payout_date
                  ? new Date(cycle.actual_payout_date).toLocaleDateString()
                  : cycle.expected_payout_date
                    ? new Date(cycle.expected_payout_date).toLocaleDateString()
                    : t("cycle_timeline.tbd")}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <Text style={styles.cardLabel}>{t("cycle_timeline.detail_collection_progress")}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.cardValue}>
              {t("cycle_timeline.progress_paid", { paid: totalReceived, total: totalExpected })}
            </Text>
            <Text style={[styles.cardLabel, { color: COLORS.teal }]}>
              {Math.round(progressPct)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progressPct)}%` }]} />
          </View>

          {summary && (
            <View style={styles.summaryRow}>
              <SummaryStat label={t("cycle_timeline.status_pending")} value={summary.totalPending} color={STATUS_META.pending.fg} />
              <SummaryStat label={t("cycle_timeline.status_late")} value={summary.totalLate} color={STATUS_META.late.fg} />
              <SummaryStat label={t("cycle_timeline.status_missed")} value={summary.totalMissed} color={STATUS_META.missed.fg} />
            </View>
          )}
        </View>

        {/* Members */}
        <Text style={styles.sectionTitle}>{t("cycle_timeline.detail_members_title")}</Text>
        {contributions.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="people-outline" size={36} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>{t("cycle_timeline.empty_no_members_title")}</Text>
            <Text style={styles.emptyBody}>{t("cycle_timeline.empty_no_members_body")}</Text>
          </View>
        ) : (
          contributions.map((member: any, i: number) => {
            const meta = STATUS_META[member.status as ContributionStatus] ?? META_FALLBACK;
            const amount =
              member.contributed_amount && Number(member.contributed_amount) > 0
                ? member.contributed_amount
                : (member.expected_amount ?? cycle.circle?.contribution_amount ?? 0);
            // Substitution Visibility A.3 — pull the active sub row for
            // this original member (if any). Colour palette per actor:
            //   pending_confirmation → amber (substitute's 48 h clock)
            //   confirmed            → blue  (trigger-only flip pending)
            //   admin_pending        → red   (admin's 24 h clock)
            const sub = substitutionByExitingMember.get(member.user_id);
            const subColors = !sub
              ? null
              : sub.status === "admin_pending"
                ? { bg: `${COLORS.red}15`, fg: "#991B1B", border: COLORS.red }
                : sub.status === "pending_confirmation"
                  ? { bg: `${COLORS.yellow}15`, fg: "#A16207", border: COLORS.yellow }
                  : { bg: `${COLORS.blue}15`, fg: "#1E3A8A", border: COLORS.blue };
            return (
              <View key={member.id ?? i} style={styles.memberCard}>
                <View style={[styles.statusIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={16} color={meta.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {member.user?.full_name ?? shortId(member.user_id)}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusPillText, { color: meta.fg }]}>
                      {t(meta.labelKey)}
                    </Text>
                  </View>
                  {sub && subColors && (
                    <View
                      style={[
                        styles.substitutionBadge,
                        {
                          backgroundColor: subColors.bg,
                          borderColor: subColors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={12}
                        color={subColors.fg}
                      />
                      <Text
                        style={[styles.substitutionBadgeText, { color: subColors.fg }]}
                        numberOfLines={2}
                      >
                        {t(`cycle_timeline.substitution_${sub.status}`, {
                          substitute: sub.substitute_member_name,
                        })}
                      </Text>
                      {sub.hours_remaining_for_actor != null && (
                        <Text
                          style={[
                            styles.substitutionCountdown,
                            { color: subColors.fg },
                          ]}
                        >
                          {t("cycle_timeline.substitution_hours_left", {
                            count: sub.hours_remaining_for_actor,
                          })}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                <Text style={styles.memberAmount}>{formatDollars(amount)}</Text>
              </View>
            );
          })
        )}

        {/* Events */}
        <Text style={styles.sectionTitle}>{t("cycle_timeline.detail_events_title")}</Text>
        {events.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="document-text-outline" size={32} color={COLORS.muted} />
            <Text style={styles.emptyBody}>{t("cycle_timeline.detail_events_empty")}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {events.map((ev: any, i: number) => (
              <View
                key={ev.id ?? i}
                style={[styles.eventRow, i === events.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventType}>
                    {/* Engine emits cycle_started, contribution_received, payout_completed,
                        etc. We render the snake-cased token directly — Bucket B keeps
                        events read-only; a future bucket can map each to a localized
                        label if we decide it's load-bearing. */}
                    {String(ev.event_type ?? "—").replace(/_/g, " ")}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                    {ev.user?.full_name ? ` · ${ev.user.full_name}` : ""}
                  </Text>
                </View>
                {ev.amount != null && (
                  <Text style={styles.eventAmount}>{formatDollars(ev.amount)}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryStatValue, { color }]}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg, padding: 24, gap: 8 },
  loadingText: { fontSize: 13, color: COLORS.muted, marginTop: 8 },

  errorTitle: { fontSize: 16, fontWeight: "700", color: COLORS.navy, marginTop: 8 },
  errorBody: { fontSize: 13, color: COLORS.muted, textAlign: "center" },
  backCta: { marginTop: 16, backgroundColor: COLORS.navy, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  backCtaText: { color: "#FFF", fontWeight: "700" },

  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },

  stateChipRow: { flexDirection: "row", justifyContent: "center", marginTop: 12 },
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateChipText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

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
  cardLabel: { fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 15, fontWeight: "700", color: COLORS.navy },
  cardDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  cardRow: { flexDirection: "row", gap: 16 },
  cardCell: { flex: 1 },

  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 6 },
  progressTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: COLORS.teal, borderRadius: 4 },

  summaryRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  summaryStat: { flex: 1, alignItems: "center", paddingVertical: 8, backgroundColor: COLORS.bg, borderRadius: 10 },
  summaryStatValue: { fontSize: 18, fontWeight: "800" },
  summaryStatLabel: { fontSize: 10, color: COLORS.muted, textTransform: "uppercase", marginTop: 2, letterSpacing: 0.4 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.navy, marginBottom: 10, marginTop: 8 },

  emptyCard: { alignItems: "center", paddingVertical: 24, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: COLORS.navy, marginTop: 8 },
  emptyBody: { fontSize: 12, color: COLORS.muted, textAlign: "center", paddingHorizontal: 24 },

  memberCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  statusIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  memberName: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  memberAmount: { fontSize: 14, fontWeight: "700", color: COLORS.navy },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  statusPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  eventRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.teal },
  eventType: { fontSize: 13, fontWeight: "600", color: COLORS.navy, textTransform: "capitalize" },
  eventMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  eventAmount: { fontSize: 13, fontWeight: "700", color: COLORS.teal },

  // Substitution Visibility A.3 — overlay badge under the member status pill
  substitutionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  substitutionBadgeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  substitutionCountdown: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
});
