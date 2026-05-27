// ══════════════════════════════════════════════════════════════════════════════
// screens/DefaultDetailScreen.tsx — Single-default detail view
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { defaultId: string }
//
// Reached from DefaultRecoveryScreen — tapping a row in the "Defaults"
// tab drills here. The screen exposes everything the cascade engine
// already tracks: the default record, the cascade event history, and
// (if the circle has resolved the shortfall) the resolution outcome.
//
// Data: consumed entirely from the existing `useDefaultDetails(defaultId)`
// hook (hooks/useDefaultCascade.ts:87). The hook bundles three fetches:
//   - defaults row by id
//   - cascade_events for the cascade_id
//   - the CircleResolution if any
// No new engine code, no new API calls.
//
// Action: "Start recovery plan" routes to MakeContribution scoped to
// the default's circle so the user can pay down their owed balance via
// the existing contribution flow. (Full recovery-plan acceptance UI
// can layer on later through useRecoveryPlan — that hook exists too.)
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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useDefaultDetails } from "../hooks/useDefaultCascade";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const GREEN = "#059669";
const PURPLE = "#8B5CF6";
const BG = "#F5F7FA";

type DefaultDetailRouteParams = { defaultId: string };
type DefaultDetailRouteProp = RouteProp<
  { DefaultDetail: DefaultDetailRouteParams },
  "DefaultDetail"
>;

export default function DefaultDetailScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<DefaultDetailRouteProp>();
  const defaultId = route.params?.defaultId ?? "";

  const {
    defaultRecord,
    cascadeEvents,
    resolution,
    loading,
    error,
    refresh,
  } = useDefaultDetails(defaultId);

  const [refreshing, setRefreshing] = useState(false);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleStartRecovery = () => {
    if (!defaultRecord?.circle_id) {
      Alert.alert(
        "Cannot start recovery",
        "This default isn't linked to a circle. Contact support.",
      );
      return;
    }
    Alert.alert(
      "Start recovery?",
      "You'll be taken to the contribution flow to pay down your outstanding balance.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () =>
            navigation.navigate(Routes.MakeContribution, {
              circleId: defaultRecord.circle_id,
            }),
        },
      ],
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading && !defaultRecord) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar onBack={() => navigation.goBack()} title="Default Details" />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error / missing ─────────────────────────────────────────────────────
  if (error || !defaultRecord) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar onBack={() => navigation.goBack()} title="Default Details" />
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
          <Text style={styles.errorTitle}>
            {error ? "Could not load" : "Default not found"}
          </Text>
          {error && <Text style={styles.errorBody}>{error}</Text>}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refresh()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const statusInfo = statusConfig(defaultRecord.default_status);
  const outstanding =
    defaultRecord.total_owed - (defaultRecord.amount_recovered ?? 0);
  const recoveryPct =
    defaultRecord.total_owed > 0
      ? Math.min(
          100,
          Math.round(
            ((defaultRecord.amount_recovered ?? 0) / defaultRecord.total_owed) *
              100,
          ),
        )
      : 0;
  const isActionable =
    defaultRecord.default_status === "unresolved" ||
    defaultRecord.default_status === "partial_recovery";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <HeaderBar onBack={() => navigation.goBack()} title="Default Details" />

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
          <Text style={styles.outstandingLabel}>Outstanding balance</Text>
          <Text style={styles.outstandingAmount}>{formatMoney(outstanding)}</Text>
          {(defaultRecord.amount_recovered ?? 0) > 0 && (
            <View style={styles.recoveryProgressBlock}>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${recoveryPct}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {formatMoney(defaultRecord.amount_recovered ?? 0)} recovered of{" "}
                {formatMoney(defaultRecord.total_owed)} ({recoveryPct}%)
              </Text>
            </View>
          )}
        </View>

        {/* Breakdown */}
        <SectionHeader title="Breakdown" />
        <View style={styles.listCard}>
          <DetailRow
            label="Original amount"
            value={formatMoney(defaultRecord.original_amount)}
            isFirst
          />
          <DetailRow
            label="Late fees"
            value={formatMoney(defaultRecord.late_fees ?? 0)}
          />
          <DetailRow
            label="Total owed"
            value={formatMoney(defaultRecord.total_owed)}
            emphasize
          />
          <DetailRow
            label="Cycle"
            value={
              defaultRecord.cycle_number != null
                ? `Cycle #${defaultRecord.cycle_number}`
                : "—"
            }
          />
          <DetailRow
            label="Created"
            value={formatDate(defaultRecord.created_at)}
            isLast
          />
        </View>

        {/* Flags */}
        {(defaultRecord.is_repeat_offender ||
          defaultRecord.triggered_suspension_review ||
          defaultRecord.cascade_id) && (
          <>
            <SectionHeader title="Status flags" />
            <View style={styles.flagsBlock}>
              {defaultRecord.cascade_id && (
                <View style={[styles.flagChip, { backgroundColor: PURPLE + "15" }]}>
                  <Ionicons name="git-branch-outline" size={12} color={PURPLE} />
                  <Text style={[styles.flagText, { color: PURPLE }]}>
                    Cascade {defaultRecord.cascade_completed ? "complete" : "active"}
                  </Text>
                </View>
              )}
              {defaultRecord.is_repeat_offender && (
                <View style={[styles.flagChip, { backgroundColor: RED + "15" }]}>
                  <Ionicons name="repeat" size={12} color={RED} />
                  <Text style={[styles.flagText, { color: RED }]}>Repeat default</Text>
                </View>
              )}
              {defaultRecord.triggered_suspension_review && (
                <View style={[styles.flagChip, { backgroundColor: AMBER + "15" }]}>
                  <Ionicons name="alert-circle" size={12} color={AMBER} />
                  <Text style={[styles.flagText, { color: AMBER }]}>
                    Suspension review
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* XnScore impact */}
        {defaultRecord.xnscore_impact_applied != null && (
          <>
            <SectionHeader title="Score impact" />
            <View style={styles.listCard}>
              <DetailRow
                label="XnScore"
                value={
                  defaultRecord.xnscore_impact_applied < 0
                    ? `${defaultRecord.xnscore_impact_applied} pts`
                    : `+${defaultRecord.xnscore_impact_applied} pts`
                }
                isFirst
                tintNegative
              />
              <DetailRow
                label="Voucher impacts"
                value={String(defaultRecord.voucher_impacts_applied ?? 0)}
                isLast
              />
            </View>
          </>
        )}

        {/* Cascade events */}
        {cascadeEvents.length > 0 && (
          <>
            <SectionHeader title="Cascade events" count={cascadeEvents.length} />
            <View style={styles.listCard}>
              {cascadeEvents.map((event, idx) => (
                <CascadeEventRow
                  key={event.id ?? idx}
                  event={event}
                  isFirst={idx === 0}
                  isLast={idx === cascadeEvents.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Resolution */}
        {resolution && (
          <>
            <SectionHeader title="Resolution" />
            <View style={styles.listCard}>
              <DetailRow
                label="Method"
                value={humanize(resolution.resolutionMethod)}
                isFirst
              />
              <DetailRow
                label="Status"
                value={humanize(resolution.resolutionStatus)}
              />
              <DetailRow
                label="From reserve"
                value={formatMoney(resolution.amountFromReserve)}
              />
              <DetailRow
                label="From redistribution"
                value={formatMoney(resolution.amountFromRedistribution)}
              />
              <DetailRow
                label="Payout reduction"
                value={formatMoney(resolution.payoutReduction)}
              />
              {resolution.resolvedAt && (
                <DetailRow
                  label="Resolved"
                  value={formatDate(resolution.resolvedAt)}
                  isLast
                />
              )}
            </View>
          </>
        )}

        {/* Action */}
        {isActionable && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleStartRecovery}
            accessibilityRole="button"
          >
            <Ionicons name="cash" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {recoveryPct > 0 ? "Continue recovery" : "Start recovery"}
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
  tintNegative,
}: {
  label: string;
  value: string;
  isFirst?: boolean;
  isLast?: boolean;
  emphasize?: boolean;
  tintNegative?: boolean;
}) {
  const isNeg = tintNegative && value.startsWith("-");
  return (
    <View
      style={[
        styles.detailRow,
        !isLast && styles.detailRowBorder,
      ]}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          emphasize && styles.detailValueEmphasize,
          isNeg && { color: RED },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function CascadeEventRow({
  event,
  isFirst,
  isLast,
}: {
  event: any;
  isFirst: boolean;
  isLast: boolean;
}) {
  // Cascade events have shape from the cascade_events table.
  // Field names vary by event type but generally include:
  // event_type (string), event_data (jsonb), created_at, status.
  const label = humanize(event.event_type ?? "event");
  return (
    <View style={[styles.cascadeRow, !isLast && styles.detailRowBorder]}>
      <View style={styles.cascadeDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cascadeLabel}>{label}</Text>
        <Text style={styles.cascadeMeta}>
          {event.created_at ? formatDate(event.created_at) : "—"}
        </Text>
      </View>
      {event.status && (
        <Text style={styles.cascadeStatus}>{humanize(event.status)}</Text>
      )}
    </View>
  );
}

// ── Formatters ───────────────────────────────────────────────────────────

function statusConfig(status: string) {
  switch (status) {
    case "unresolved":
      return { label: "Unresolved", bg: RED + "15", fg: RED, icon: "alert-circle" };
    case "partial_recovery":
      return { label: "Partial Recovery", bg: AMBER + "15", fg: AMBER, icon: "time" };
    case "fully_recovered":
      return { label: "Fully Recovered", bg: GREEN + "15", fg: GREEN, icon: "checkmark-circle" };
    case "written_off":
      return { label: "Written Off", bg: MUTED + "20", fg: MUTED, icon: "close-circle" };
    case "forgiven":
      return { label: "Forgiven", bg: PURPLE + "15", fg: PURPLE, icon: "heart" };
    case "disputed":
      return { label: "Disputed", bg: AMBER + "15", fg: AMBER, icon: "help-circle" };
    default:
      return { label: status, bg: "#F3F4F6", fg: MUTED, icon: "ellipse" };
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
  outstandingLabel: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  outstandingAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: NAVY,
  },
  recoveryProgressBlock: {
    width: "100%",
    marginTop: 12,
    gap: 6,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  progressText: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
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

  flagsBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  flagText: { fontSize: 12, fontWeight: "600" },

  cascadeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cascadeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PURPLE,
  },
  cascadeLabel: { fontSize: 13, fontWeight: "600", color: NAVY },
  cascadeMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  cascadeStatus: { fontSize: 11, color: MUTED, fontWeight: "600" },

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
