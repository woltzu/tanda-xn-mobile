// ══════════════════════════════════════════════════════════════════════════════
// screens/ParticipantDetailScreen.tsx — Trip organizer's per-participant view
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { tripId: string; participantId: string }
//
// Reached from ParticipantManagerScreen — tapping a row in the roster
// drills into one participant's full detail: payment progress, document
// submissions, and action buttons to confirm or cancel.
//
// Data comes from the existing `useParticipantDetail(participantId)` hook
// (hooks/useTripOrganizer.ts:392), which already exposes:
//
//   { participant, loading, error, confirm, cancel, verifySubmission, refresh }
//
// `participant` is enriched with `submissions: TripSubmission[]` and
// `payments: TripPayment[]` by the engine. No new API code.
//
// Name enrichment: TripOrganizerEngine.getParticipantDetail does
// `SELECT *` from trip_participants with no join, so first/last name
// aren't on the row. We do one batched `SELECT id, full_name FROM
// profiles WHERE id = userId` here. Falls back to "Participant" if the
// fetch fails. Same pattern used in StoreBookingsScreen.
//
// After confirm/cancel actions, we goBack — ParticipantManagerScreen
// re-fetches via its own hook refresh, so the row will reflect the new
// status without explicit callback plumbing.
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
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
import { useParticipantDetail } from "../hooks/useTripOrganizer";
import { supabase } from "../lib/supabase";
import type {
  TripSubmission,
  TripPayment,
} from "../services/TripOrganizerEngine";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const GREEN = "#059669";
const BLUE = "#3B82F6";
const BG = "#F5F7FA";

type ParticipantDetailRouteParams = {
  tripId: string;
  participantId: string;
};
type ParticipantDetailRouteProp = RouteProp<
  { ParticipantDetail: ParticipantDetailRouteParams },
  "ParticipantDetail"
>;

export default function ParticipantDetailScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<ParticipantDetailRouteProp>();
  const { tripId, participantId } = route.params ?? { tripId: "", participantId: "" };

  const {
    participant,
    loading,
    error,
    confirm,
    cancel,
    refresh,
  } = useParticipantDetail(participantId);

  const [refreshing, setRefreshing] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<"confirm" | "cancel" | null>(null);

  // ── Name enrichment: one-shot profile lookup ──────────────────────────
  useEffect(() => {
    if (!participant?.userId) return;
    let cancelled = false;
    (async () => {
      const { data, error: profErr } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", participant.userId)
        .single();
      if (cancelled || profErr || !data) return;
      setFullName(data.full_name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [participant?.userId]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────
  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // ── Actions ───────────────────────────────────────────────────────────
  const handleConfirm = () => {
    Alert.alert(
      "Confirm participant?",
      "This marks the participant as confirmed for the trip.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setActionInFlight("confirm");
            try {
              await confirm();
              // Pop back so ParticipantManager re-runs its own refresh
              // and the row reflects the new status.
              navigation.goBack();
            } catch (err: any) {
              Alert.alert(
                "Could not confirm",
                err?.message ?? "Please try again.",
              );
            } finally {
              setActionInFlight(null);
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel participant?",
      "This removes the participant from the trip. They may need a refund if they've already paid.",
      [
        { text: "Keep them", style: "cancel" },
        {
          text: "Cancel participant",
          style: "destructive",
          onPress: async () => {
            setActionInFlight("cancel");
            try {
              await cancel();
              navigation.goBack();
            } catch (err: any) {
              Alert.alert(
                "Could not cancel",
                err?.message ?? "Please try again.",
              );
            } finally {
              setActionInFlight(null);
            }
          },
        },
      ],
    );
  };

  const openDocument = (submission: TripSubmission) => {
    navigation.navigate(Routes.DocumentSubmission, {
      tripId,
      participantId,
      fieldKey: submission.fieldKey,
    });
  };

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading && !participant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar onBack={() => navigation.goBack()} title="Participant" />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading participant…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (error && !participant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar onBack={() => navigation.goBack()} title="Participant" />
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
          <Text style={styles.errorTitle}>Could not load</Text>
          <Text style={styles.errorBody}>{error}</Text>
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

  if (!participant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar onBack={() => navigation.goBack()} title="Participant" />
        <View style={styles.centerFill}>
          <Text style={styles.errorTitle}>Participant not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const displayName = fullName?.trim() || "Participant";
  const submissions = participant.submissions ?? [];
  const payments = participant.payments ?? [];
  const verifiedCount = submissions.filter((s) => s.verified).length;
  const totalSubmissions = submissions.length;
  const isPending = participant.status === "pending";
  const isCancelled = participant.status === "cancelled";
  const isBusy = actionInFlight !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <HeaderBar onBack={() => navigation.goBack()} title={displayName} />

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
        {/* Identity block */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>
          <Text style={styles.identityName}>{displayName}</Text>
          <StatusPill status={participant.status} />
          <Text style={styles.joinedText}>
            Joined {formatDate(participant.joinedAt)}
          </Text>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total paid</Text>
              <Text style={styles.summaryValue}>
                {formatMoney(participant.totalPaidCents)}
              </Text>
              <Text style={styles.summaryHint}>
                {humanizePaymentStatus(participant.paymentStatus)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Documents</Text>
              <Text style={styles.summaryValue}>
                {verifiedCount}/{totalSubmissions}
              </Text>
              <Text style={styles.summaryHint}>
                {totalSubmissions === 0
                  ? "None submitted"
                  : verifiedCount === totalSubmissions
                    ? "All verified"
                    : "Verified / submitted"}
              </Text>
            </View>
          </View>
        </View>

        {/* Documents */}
        <SectionHeader title="Documents" count={totalSubmissions} />
        {totalSubmissions === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="document-outline" size={32} color={MUTED} />
            <Text style={styles.emptyText}>No documents submitted yet</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {submissions.map((submission, idx) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                isLast={idx === submissions.length - 1}
                onPress={() => openDocument(submission)}
              />
            ))}
          </View>
        )}

        {/* Payments */}
        <SectionHeader title="Payments" count={payments.length} />
        {payments.length === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="cash-outline" size={32} color={MUTED} />
            <Text style={styles.emptyText}>No payments yet</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {payments.map((payment, idx) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                isLast={idx === payments.length - 1}
              />
            ))}
          </View>
        )}

        {/* Spacer above sticky-feel action footer */}
        <View style={{ height: 8 }} />

        {/* Actions */}
        {!isCancelled && (
          <View style={styles.actionsBlock}>
            {isPending && (
              <TouchableOpacity
                style={[styles.btnPrimary, isBusy && styles.btnDisabled]}
                onPress={handleConfirm}
                disabled={isBusy}
                accessibilityRole="button"
              >
                {actionInFlight === "confirm" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.btnPrimaryText}>Confirm participant</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btnDanger, isBusy && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={isBusy}
              accessibilityRole="button"
            >
              {actionInFlight === "cancel" ? (
                <ActivityIndicator size="small" color={RED} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={RED} />
                  <Text style={styles.btnDangerText}>Cancel participant</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isCancelled && participant.cancellationReason && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="information-circle-outline" size={18} color={RED} />
            <Text style={styles.cancelledText}>
              Cancelled: {participant.cancellationReason}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Header bar ───────────────────────────────────────────────────────────

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

// ── Status pill ──────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const config = statusConfig(status);
  return (
    <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusPillText, { color: config.fg }]}>
        {config.label}
      </Text>
    </View>
  );
}

function statusConfig(status: string) {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", bg: "#D1FAE5", fg: GREEN };
    case "pending":
      return { label: "Pending", bg: "#FEF3C7", fg: AMBER };
    case "waitlist":
      return { label: "Waitlist", bg: "rgba(0,198,174,0.15)", fg: TEAL };
    case "cancelled":
      return { label: "Cancelled", bg: "#FEE2E2", fg: RED };
    default:
      return { label: status, bg: "#F3F4F6", fg: MUTED };
  }
}

// ── Section header ───────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count > 0 && (
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ── Submission row ───────────────────────────────────────────────────────

function SubmissionRow({
  submission,
  isLast,
  onPress,
}: {
  submission: TripSubmission;
  isLast: boolean;
  onPress: () => void;
}) {
  const fieldLabel = humanizeFieldKey(submission.fieldKey);
  const valuePreview = submission.fileUrl
    ? "File uploaded"
    : submission.textValue
      ? submission.textValue
      : "Not provided";

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${fieldLabel} document`}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={submission.fileUrl ? "document-text" : "create-outline"}
          size={18}
          color={NAVY}
        />
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {fieldLabel}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {valuePreview}
        </Text>
      </View>
      <View style={styles.rowEnd}>
        {submission.verified ? (
          <View style={[styles.miniBadge, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="checkmark" size={12} color={GREEN} />
            <Text style={[styles.miniBadgeText, { color: GREEN }]}>Verified</Text>
          </View>
        ) : (
          <View style={[styles.miniBadge, { backgroundColor: "#FEF3C7" }]}>
            <Text style={[styles.miniBadgeText, { color: AMBER }]}>Pending</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={MUTED} />
      </View>
    </TouchableOpacity>
  );
}

// ── Payment row ──────────────────────────────────────────────────────────

function PaymentRow({
  payment,
  isLast,
}: {
  payment: TripPayment;
  isLast: boolean;
}) {
  const config = paymentStatusConfig(payment.status);
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name="cash" size={18} color={NAVY} />
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>
          {formatMoney(payment.amountCents)}
        </Text>
        <Text style={styles.rowSubtitle}>
          {humanizePaymentType(payment.type)} ·{" "}
          {formatDate(payment.paidAt ?? payment.createdAt)}
        </Text>
      </View>
      <View style={[styles.miniBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.miniBadgeText, { color: config.fg }]}>
          {config.label}
        </Text>
      </View>
    </View>
  );
}

function paymentStatusConfig(status: string) {
  switch (status) {
    case "succeeded":
    case "paid":
      return { label: "Paid", bg: "#D1FAE5", fg: GREEN };
    case "pending":
      return { label: "Pending", bg: "#FEF3C7", fg: AMBER };
    case "failed":
      return { label: "Failed", bg: "#FEE2E2", fg: RED };
    case "refunded":
      return { label: "Refunded", bg: "#F3E8FF", fg: "#7E22CE" };
    default:
      return { label: status, bg: "#F3F4F6", fg: MUTED };
  }
}

// ── Formatters ───────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

function formatMoney(cents: number): string {
  return `$${((cents ?? 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function humanizeFieldKey(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizePaymentStatus(status: string): string {
  switch (status) {
    case "paid":
      return "Paid in full";
    case "partial":
      return "Partial payment";
    case "unpaid":
      return "Unpaid";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

function humanizePaymentType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
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

  identityCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
  },
  identityName: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },
  joinedText: { fontSize: 12, color: MUTED, marginTop: 2 },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
  },
  summaryHint: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
    textAlign: "center",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginHorizontal: 12,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
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

  emptySection: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "dashed",
    paddingVertical: 24,
    gap: 6,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: MUTED,
  },

  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  rowSubtitle: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  rowEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  actionsBlock: {
    gap: 10,
    marginTop: 12,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RED,
  },
  btnDangerText: { color: RED, fontSize: 15, fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },

  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  cancelledText: {
    flex: 1,
    fontSize: 13,
    color: RED,
  },
});
