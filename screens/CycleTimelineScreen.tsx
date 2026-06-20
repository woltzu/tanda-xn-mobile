import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
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
} from "../hooks/useCycleProgression";
import type { ContributionStatus } from "../services/CycleProgressionEngine";

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

  // ─── Derived metrics (Bucket A fix B1) ─────────────────────────────────
  // Previously: filter on status === "paid" (an enum value that doesn't
  // exist) returned [] always. Progress bar permanently 0/N.
  // Now: paid = completed + covered, per the engine's ContributionStatus
  // enum. useMemo prevents an unnecessary recompute when the parent
  // re-renders for an unrelated reason.
  const { paidCount, totalMembers, progressPct } = useMemo(() => {
    const list = contributions ?? [];
    const paid = list.filter((c: any) => PAID_STATUSES.includes(c.status)).length;
    const total = list.length;
    const pct = total > 0 ? (paid / total) * 100 : 0;
    return { paidCount: paid, totalMembers: total, progressPct: pct };
  }, [contributions]);

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
        <View style={{ width: 24 }} />
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
            <View style={styles.infoBox}>
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
            </View>
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
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusPillText, { color: meta.fg }]}>
                        {t(meta.labelKey)}
                      </Text>
                    </View>
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

        {/* Full Timeline (Bucket A fix B2 + amount column rename) */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{t("final_polish.cycletimeline_full_timeline")}</Text>
        <View style={styles.timeline}>
          {allCycles?.map((cycle: any, i: number) => {
            const isActive = cycle.id === currentCycle?.id;
            const isCompleted = cycle.status === "closed" || cycle.status === "payout_completed";
            const dotColor = isCompleted ? COLORS.green : isActive ? COLORS.teal : "#D1D5DB";
            // Prefer the real payout date once a payout has landed; fall
            // back to the expected date for upcoming cycles. The previous
            // screen read cycle.payout_date (no such column) → "TBD" on
            // every row.
            const dateStr = cycle.actual_payout_date
              ? new Date(cycle.actual_payout_date).toLocaleDateString()
              : cycle.expected_payout_date
                ? new Date(cycle.expected_payout_date).toLocaleDateString()
                : t("cycle_timeline.tbd");

            return (
              <View key={cycle.id ?? i} style={styles.timelineItem}>
                {i < (allCycles?.length ?? 0) - 1 && <View style={styles.timelineConnector} />}
                <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                  {isCompleted && <Ionicons name="checkmark" size={12} color="#FFF" />}
                  {isActive && <Ionicons name="pulse" size={12} color="#FFF" />}
                </View>
                <View style={[styles.timelineCard, isActive && { borderWidth: 2, borderColor: COLORS.teal }]}>
                  <View style={styles.timelineCardHeader}>
                    <Text
                      style={[
                        styles.timelineCycleLabel,
                        { color: isActive ? COLORS.teal : COLORS.navy },
                      ]}
                    >
                      {t("cycle_timeline.cycle_label", { n: cycle.cycle_number })}
                    </Text>
                    <Text style={styles.mutedText}>{dateStr}</Text>
                  </View>
                  <Text style={styles.mutedText}>
                    {t("cycle_timeline.payout_to_short", {
                      name: cycle.recipient?.full_name ?? shortId(cycle.recipient_user_id),
                    })}
                  </Text>
                  <Text style={[styles.timelineAmount, { color: COLORS.teal }]}>
                    {/* Bucket A fix: cycle.payout_amount is dollars per
                        engine type (was previously payout_amount_cents,
                        which doesn't exist — every row showed $0.00). */}
                    {formatDollars(cycle.payout_amount)}
                  </Text>
                  {isActive && (
                    <View style={styles.currentCycleBadge}>
                      <Text style={styles.currentCycleBadgeText}>
                        {t("final_polish.cycletimeline_current_cycle")}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

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
    </View>
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
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  statusPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  timeline: { position: "relative" },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", position: "relative" },
  timelineConnector: {
    position: "absolute",
    left: 11,
    top: 24,
    width: 2,
    height: "100%",
    backgroundColor: COLORS.border,
  },
  timelineDot: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center", zIndex: 1 },
  timelineCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginLeft: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  timelineCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  timelineCycleLabel: { fontSize: 14, fontWeight: "700" },
  timelineAmount: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  currentCycleBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${COLORS.teal}15`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  currentCycleBadgeText: { fontSize: 11, fontWeight: "600", color: COLORS.teal },

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
