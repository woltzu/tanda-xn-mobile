// ══════════════════════════════════════════════════════════════════════════════
// screens/LateContributionDetailScreen.tsx — Single-late-contribution view
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { lateContributionId: string }
//
// Reached from DefaultRecoveryScreen — tapping a row in the "Late
// Contributions" tab drills here. Shows the late contribution, the
// late-fee structure, days overdue, the active payment plan if one
// exists, and the auto-retry history.
//
// Data: consumed entirely from the existing
// `useLateContributionDetails(lateContributionId)` hook
// (hooks/useLateContributions.ts:165). The hook bundles four fetches:
//   - the late_contributions row
//   - late_contribution_events (history)
//   - the most recent payment_plan row
//   - autoRetryService.getRetryHistory()
// No new engine code, no new API calls.
//
// Field-name note: the engine's `LateContribution` interface has names
// like `expected_amount` / `late_fee_amount`, but DefaultRecoveryScreen
// already reads `amount` and `late_fee` directly from the row. There's
// pre-existing drift between the engine type and the actual DB
// columns. We use the names DefaultRecoveryScreen uses (proven to
// work in production) and read via `(lc as any)` to bypass the stale
// type for those fields.
//
// Action: "Pay now" routes to MakeContribution scoped to the late
// contribution's circle. Full payment-plan acceptance UI can layer
// on later through usePaymentPlanDetails / acceptPlan / startPlan
// (those exist as exported hook actions).
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useLateContributionDetails } from "../hooks/useLateContributions";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const GREEN = "#059669";
const BLUE = "#3B82F6";
const PURPLE = "#8B5CF6";
const BG = "#F5F7FA";

type LateContributionDetailRouteParams = { lateContributionId: string };
type LateContributionDetailRouteProp = RouteProp<
  { LateContributionDetail: LateContributionDetailRouteParams },
  "LateContributionDetail"
>;

export default function LateContributionDetailScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<LateContributionDetailRouteProp>();
  const { t } = useTranslation();
  const lateContributionId = route.params?.lateContributionId ?? "";

  const {
    lateContribution,
    events,
    paymentPlan,
    retryHistory,
    loading,
    error,
    refresh,
  } = useLateContributionDetails(lateContributionId);

  const [refreshing, setRefreshing] = useState(false);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handlePayNow = () => {
    const lc = lateContribution as any;
    if (!lc?.circle_id) {
      Alert.alert(
        "Cannot start payment",
        "This late contribution isn't linked to a circle. Contact support.",
      );
      return;
    }
    navigation.navigate(Routes.MakeContribution, { circleId: lc.circle_id });
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading && !lateContribution) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar onBack={() => navigation.goBack()} title="Late Contribution" />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error / missing ─────────────────────────────────────────────────────
  if (error || !lateContribution) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar onBack={() => navigation.goBack()} title="Late Contribution" />
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
          <Text style={styles.errorTitle}>
            {error ? "Could not load" : "Late contribution not found"}
          </Text>
          {error && <Text style={styles.errorBody}>{error}</Text>}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refresh()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>{t("late_contribution.btn_retry")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  // Bypass the engine LateContribution type — actual DB columns differ
  // (see file header note). DefaultRecoveryScreen's list rows already
  // read these names successfully against the live table.
  const lc = lateContribution as any;
  const amount: number = lc.amount ?? lc.expected_amount ?? 0;
  const lateFee: number = lc.late_fee ?? lc.late_fee_amount ?? 0;
  const totalDue = amount + lateFee;
  const dueDate: string | null = lc.original_due_date ?? null;
  const daysOverdue = dueDate
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0;
  const statusInfo = lateStatusConfig(lc.late_status);
  const isActionable = lc.late_status !== "resolved";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <HeaderBar onBack={() => navigation.goBack()} title="Late Contribution" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={TEAL}
          />
        }
      >
        {/* Status header card */}
        <View style={styles.summaryCard}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons
              name={statusInfo.icon as any}
              size={14}
              color={statusInfo.fg}
            />
            <Text style={[styles.statusBadgeText, { color: statusInfo.fg }]}>
              {statusInfo.label}
            </Text>
          </View>
          <Text style={styles.dueLabel}>{t("late_contribution.label_total_due")}</Text>
          <Text style={styles.dueAmount}>{formatMoney(totalDue)}</Text>
          {daysOverdue > 0 && (
            <Text style={styles.overdueText}>
              {daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue
            </Text>
          )}
        </View>

        {/* Breakdown */}
        <SectionHeader title="Breakdown" />
        <View style={styles.listCard}>
          <DetailRow
            label="Original amount"
            value={formatMoney(amount)}
            isFirst
          />
          <DetailRow label="Late fee" value={formatMoney(lateFee)} />
          <DetailRow label="Total due" value={formatMoney(totalDue)} emphasize />
          <DetailRow label="Original due date" value={formatDate(dueDate)} />
          <DetailRow
            label="Auto-retry attempts"
            value={String(lc.auto_retry_attempts ?? 0)}
            isLast
          />
        </View>

        {/* Payment plan (if any) */}
        {paymentPlan && (
          <>
            <SectionHeader title="Payment plan" />
            <View style={styles.listCard}>
              <DetailRow
                label="Status"
                value={humanize(paymentPlan.plan_status)}
                isFirst
              />
              <DetailRow
                label="Installments"
                value={String(paymentPlan.num_installments)}
              />
              <DetailRow
                label="Per installment"
                value={formatMoney(paymentPlan.installment_amount)}
              />
              <DetailRow
                label="Total amount"
                value={formatMoney(paymentPlan.total_amount)}
              />
              {paymentPlan.next_due_date && (
                <DetailRow
                  label="Next due"
                  value={formatDate(paymentPlan.next_due_date)}
                />
              )}
              <DetailRow
                label="Proposed"
                value={formatDate(paymentPlan.proposed_at)}
                isLast
              />
            </View>
          </>
        )}

        {/* Events history */}
        {events.length > 0 && (
          <>
            <SectionHeader title="History" count={events.length} />
            <View style={styles.listCard}>
              {events.map((event: any, idx: number) => (
                <EventRow
                  key={event.id ?? idx}
                  event={event}
                  isLast={idx === events.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Retry history */}
        {retryHistory.length > 0 && (
          <>
            <SectionHeader title="Auto-retry attempts" count={retryHistory.length} />
            <View style={styles.listCard}>
              {retryHistory.map((retry: any, idx: number) => (
                <RetryRow
                  key={retry.id ?? idx}
                  retry={retry}
                  isLast={idx === retryHistory.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Action */}
        {isActionable && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePayNow}
            accessibilityRole="button"
          >
            <Ionicons name="card" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              Pay {formatMoney(totalDue)} now
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function HeaderBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null && count > 0 && (
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function DetailRow({
  label,
  value,
  isFirst,
  isLast,
  emphasize,
}: {
  label: string;
  value: string;
  isFirst?: boolean;
  isLast?: boolean;
  emphasize?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          emphasize && styles.detailValueEmphasize,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function EventRow({ event, isLast }: { event: any; isLast: boolean }) {
  return (
    <View style={[styles.eventRow, !isLast && styles.detailRowBorder]}>
      <View style={styles.eventDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eventLabel}>
          {humanize(event.event_type ?? "event")}
        </Text>
        <Text style={styles.eventMeta}>
          {event.created_at ? formatDate(event.created_at) : "—"}
        </Text>
      </View>
    </View>
  );
}

function RetryRow({ retry, isLast }: { retry: any; isLast: boolean }) {
  const statusColor =
    retry.status === "succeeded"
      ? GREEN
      : retry.status === "failed"
        ? RED
        : AMBER;
  return (
    <View style={[styles.eventRow, !isLast && styles.detailRowBorder]}>
      <Ionicons
        name="refresh"
        size={16}
        color={statusColor}
        style={{ width: 16 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.eventLabel}>
          Attempt {retry.attempt_number ?? "—"}
        </Text>
        <Text style={styles.eventMeta}>
          {retry.scheduled_at
            ? formatDate(retry.scheduled_at)
            : retry.created_at
              ? formatDate(retry.created_at)
              : "—"}
        </Text>
      </View>
      {retry.status && (
        <Text style={[styles.cascadeStatus, { color: statusColor }]}>
          {humanize(retry.status)}
        </Text>
      )}
    </View>
  );
}

// ── Formatters ───────────────────────────────────────────────────────────

function lateStatusConfig(status: string | undefined) {
  switch (status) {
    case "soft_late":
      return { label: "Soft Late", bg: AMBER + "15", fg: AMBER, icon: "time" };
    case "grace_period":
      return { label: "Grace Period", bg: BLUE + "15", fg: BLUE, icon: "hourglass" };
    case "final_warning":
      return { label: "Final Warning", bg: RED + "15", fg: RED, icon: "alert-circle" };
    case "defaulted":
      return { label: "Defaulted", bg: RED + "15", fg: RED, icon: "close-circle" };
    case "resolved":
      return { label: "Resolved", bg: GREEN + "15", fg: GREEN, icon: "checkmark-circle" };
    default:
      return { label: humanize(status), bg: "#F3F4F6", fg: MUTED, icon: "ellipse" };
  }
}

function formatMoney(cents: number): string {
  return `$${((cents ?? 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function humanize(s: string | undefined): string {
  if (!s) return "—";
  return s
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  backButton: { minWidth: 44, paddingVertical: 4 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
  },
  headerSpacer: { width: 44 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { fontSize: 14, color: MUTED },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: NAVY,
    marginTop: 4,
  },
  errorBody: { fontSize: 14, color: MUTED, textAlign: "center" },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  retryButtonText: { fontSize: 14, color: NAVY, fontWeight: "600" },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  dueLabel: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dueAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: NAVY,
  },
  overdueText: {
    fontSize: 13,
    color: RED,
    fontWeight: "600",
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: NAVY },
  sectionCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: { fontSize: 11, fontWeight: "700", color: MUTED },

  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: 12,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  detailLabel: { fontSize: 13, color: MUTED },
  detailValue: { fontSize: 14, fontWeight: "600", color: NAVY },
  detailValueEmphasize: { fontSize: 15, fontWeight: "700" },

  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PURPLE,
  },
  eventLabel: { fontSize: 13, fontWeight: "600", color: NAVY },
  eventMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  cascadeStatus: { fontSize: 11, fontWeight: "600" },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
