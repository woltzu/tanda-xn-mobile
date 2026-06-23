// ══════════════════════════════════════════════════════════════════════════════
// screens/ParticipantDetailScreen.tsx — Trip organizer's per-participant view
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { tripId: string; participantId: string }
//
// View-trip-dashboard Bucket A fixes:
//   A.1 — formatMoney no longer divides by 100. The engine field names
//         `totalPaidCents` / `amountCents` are misnomers carried from
//         migration 065 — the underlying columns (trip_participants.
//         total_paid and trip_payments.amount) are DECIMAL DOLLARS, so a
//         $100 payment was rendering as $1.00 before this fix.
//   A.2 — SubmissionRow + PaymentRow + StatusPill + payment/status
//         config helpers now live INSIDE the screen component so they
//         have `t` in scope. The previous top-level definitions called
//         t() but t was undefined at module scope, throwing
//         `ReferenceError: t is not defined` the moment any participant
//         with submissions or payments rendered.
//   A.3 — Every previously-hardcoded English string is now t-keyed
//         under the `participant_detail.*` namespace (Alert titles +
//         bodies + buttons, status pill labels, payment badges, doc
//         labels, summary hints, loading copy, section headers).
//
// Data comes from `useParticipantDetail(participantId)` (hooks/useTrip
// Organizer.ts), which already exposes:
//   { participant, loading, error, confirm, cancel, verifySubmission, refresh }
//
// `participant` is enriched with `submissions: TripSubmission[]` and
// `payments: TripPayment[]` by the engine. No new API code.
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
import { useTranslation } from "react-i18next";
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
const BG = "#F5F7FA";

type ParticipantDetailRouteParams = {
  tripId: string;
  participantId: string;
};
type ParticipantDetailRouteProp = RouteProp<
  { ParticipantDetail: ParticipantDetailRouteParams },
  "ParticipantDetail"
>;

// ── Module-level helpers (no i18n) ───────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

// View-trip-dashboard Bucket A.1 — drop the /100 division. The engine
// returns DOLLARS in both `totalPaidCents` and `amountCents` (the field
// names are misnomers — see services/TripOrganizerEngine.ts:322 + the
// trip_participants.total_paid / trip_payments.amount DECIMAL columns).
function formatMoney(dollars: number): string {
  return `$${(dollars ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  return key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ParticipantDetailScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<ParticipantDetailRouteProp>();
  const { tripId, participantId } = route.params ?? { tripId: "", participantId: "" };

  const { participant, loading, error, confirm, cancel, refresh } =
    useParticipantDetail(participantId);

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
  // View-trip-dashboard Bucket A.3 — every string i18n'd. The Alert
  // buttons are paired (cancel/confirm vs keep/cancel-destructive) so
  // they live under participant_detail.confirm_* / cancel_*.
  const handleConfirm = () => {
    Alert.alert(
      t("participant_detail.confirm_title"),
      t("participant_detail.confirm_body"),
      [
        { text: t("participant_detail.confirm_action_cancel"), style: "cancel" },
        {
          text: t("participant_detail.confirm_action_confirm"),
          onPress: async () => {
            setActionInFlight("confirm");
            try {
              await confirm();
              navigation.goBack();
            } catch (err: any) {
              Alert.alert(
                t("participant_detail.error_could_not_confirm"),
                err?.message ?? t("participant_detail.error_try_again"),
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
      t("participant_detail.cancel_title"),
      t("participant_detail.cancel_body"),
      [
        { text: t("participant_detail.cancel_action_keep"), style: "cancel" },
        {
          text: t("participant_detail.cancel_action_cancel"),
          style: "destructive",
          onPress: async () => {
            setActionInFlight("cancel");
            try {
              await cancel();
              navigation.goBack();
            } catch (err: any) {
              Alert.alert(
                t("participant_detail.error_could_not_cancel"),
                err?.message ?? t("participant_detail.error_try_again"),
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

  // ── i18n status + payment helpers (closure over t) ────────────────────
  // View-trip-dashboard Bucket A.2 — moved INSIDE the screen so `t` is in
  // scope. Top-level versions called t() but t was undefined at module
  // scope, throwing on any participant with submissions or payments.
  const statusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: t("participant_detail.status_confirmed"), bg: "#D1FAE5", fg: GREEN };
      case "pending":
        return { label: t("participant_detail.status_pending"), bg: "#FEF3C7", fg: AMBER };
      case "waitlist":
        return { label: t("participant_detail.status_waitlist"), bg: "rgba(0,198,174,0.15)", fg: TEAL };
      case "cancelled":
        return { label: t("participant_detail.status_cancelled"), bg: "#FEE2E2", fg: RED };
      default:
        return { label: status, bg: "#F3F4F6", fg: MUTED };
    }
  };

  const paymentStatusConfig = (status: string) => {
    switch (status) {
      case "succeeded":
      case "paid":
        return { label: t("participant_detail.payment_paid"), bg: "#D1FAE5", fg: GREEN };
      case "pending":
        return { label: t("participant_detail.payment_pending"), bg: "#FEF3C7", fg: AMBER };
      case "failed":
        return { label: t("participant_detail.payment_failed"), bg: "#FEE2E2", fg: RED };
      case "refunded":
        return { label: t("participant_detail.payment_refunded"), bg: "#F3E8FF", fg: "#7E22CE" };
      default:
        return { label: status, bg: "#F3F4F6", fg: MUTED };
    }
  };

  const humanizePaymentStatus = (status: string): string => {
    switch (status) {
      case "paid":
      case "paid_in_full":
        return t("participant_detail.payment_status_paid_in_full");
      case "deposit_paid":
        return t("participant_detail.payment_status_deposit_paid");
      case "partial":
        return t("participant_detail.payment_status_partial");
      case "unpaid":
        return t("participant_detail.payment_status_unpaid");
      case "refunded":
        return t("participant_detail.payment_status_refunded");
      default:
        return status;
    }
  };

  const humanizePaymentType = (type: string): string =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // ── Sub-components (closure over t + helpers) ─────────────────────────

  function StatusPill({ status }: { status: string }) {
    const config = statusConfig(status);
    return (
      <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
        <Text style={[styles.statusPillText, { color: config.fg }]}>{config.label}</Text>
      </View>
    );
  }

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
      ? t("participant_detail.doc_file_uploaded")
      : submission.textValue
        ? submission.textValue
        : t("participant_detail.doc_not_provided");

    return (
      <TouchableOpacity
        style={[styles.row, !isLast && styles.rowBorder]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("participant_detail.doc_open_a11y", { label: fieldLabel })}
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
              <Text style={[styles.miniBadgeText, { color: GREEN }]}>
                {t("participant_detail.doc_verified")}
              </Text>
            </View>
          ) : (
            <View style={[styles.miniBadge, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.miniBadgeText, { color: AMBER }]}>
                {t("participant_detail.doc_pending")}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </View>
      </TouchableOpacity>
    );
  }

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
          {/*
            A.1 fix lives here too: payment.amountCents is dollars per the
            engine misnomer documented at the top of the file.
          */}
          <Text style={styles.rowTitle}>{formatMoney(payment.amountCents)}</Text>
          <Text style={styles.rowSubtitle}>
            {humanizePaymentType(payment.type)} ·{" "}
            {formatDate(payment.paidAt ?? payment.createdAt)}
          </Text>
        </View>
        <View style={[styles.miniBadge, { backgroundColor: config.bg }]}>
          <Text style={[styles.miniBadgeText, { color: config.fg }]}>{config.label}</Text>
        </View>
      </View>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading && !participant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar
          onBack={() => navigation.goBack()}
          title={t("participant_detail.header_title_fallback")}
          a11yLabel={t("participant_detail.back_a11y")}
        />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>{t("participant_detail.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (error && !participant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar
          onBack={() => navigation.goBack()}
          title={t("participant_detail.header_title_fallback")}
          a11yLabel={t("participant_detail.back_a11y")}
        />
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
          <Text style={styles.errorTitle}>
            {t("final_polish.participantdetail_could_not_load")}
          </Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refresh()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>
              {t("final_polish.participantdetail_retry")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!participant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <HeaderBar
          onBack={() => navigation.goBack()}
          title={t("participant_detail.header_title_fallback")}
          a11yLabel={t("participant_detail.back_a11y")}
        />
        <View style={styles.centerFill}>
          <Text style={styles.errorTitle}>
            {t("final_polish.participantdetail_participant_not_found")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const displayName =
    fullName?.trim() || t("participant_detail.header_title_fallback");
  const submissions = participant.submissions ?? [];
  const payments = participant.payments ?? [];
  const verifiedCount = submissions.filter((s) => s.verified).length;
  const totalSubmissions = submissions.length;
  const isPending = participant.status === "pending";
  const isCancelled = participant.status === "cancelled";
  const isBusy = actionInFlight !== null;

  const docsHint =
    totalSubmissions === 0
      ? t("participant_detail.summary_docs_none")
      : verifiedCount === totalSubmissions
        ? t("participant_detail.summary_docs_all_verified")
        : t("participant_detail.summary_docs_verified_of_submitted");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <HeaderBar
        onBack={() => navigation.goBack()}
        title={displayName}
        a11yLabel={t("participant_detail.back_a11y")}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={TEAL} />
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
            {t("participant_detail.joined_date", { date: formatDate(participant.joinedAt) })}
          </Text>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>
                {t("final_polish.participantdetail_total_paid")}
              </Text>
              <Text style={styles.summaryValue}>
                {/* A.1 fix: pass dollars (not divided) */}
                {formatMoney(participant.totalPaidCents)}
              </Text>
              <Text style={styles.summaryHint}>
                {humanizePaymentStatus(participant.paymentStatus)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>
                {t("final_polish.participantdetail_documents")}
              </Text>
              <Text style={styles.summaryValue}>
                {verifiedCount}/{totalSubmissions}
              </Text>
              <Text style={styles.summaryHint}>{docsHint}</Text>
            </View>
          </View>
        </View>

        {/* Documents */}
        <SectionHeader title={t("participant_detail.documents")} count={totalSubmissions} />
        {totalSubmissions === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="document-outline" size={32} color={MUTED} />
            <Text style={styles.emptyText}>{t("participant_detail.no_submissions")}</Text>
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
        <SectionHeader title={t("participant_detail.payments")} count={payments.length} />
        {payments.length === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="cash-outline" size={32} color={MUTED} />
            <Text style={styles.emptyText}>{t("participant_detail.no_payments")}</Text>
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

        {/* Spacer above action footer */}
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
                    <Text style={styles.btnPrimaryText}>
                      {t("final_polish.participantdetail_confirm_participant")}
                    </Text>
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
                  <Text style={styles.btnDangerText}>
                    {t("final_polish.participantdetail_cancel_participant")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isCancelled && participant.cancellationReason && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="information-circle-outline" size={18} color={RED} />
            <Text style={styles.cancelledText}>
              {t("participant_detail.cancelled_reason", {
                reason: participant.cancellationReason,
              })}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Header bar (no i18n inside; accepts pre-translated strings) ────────

function HeaderBar({
  onBack,
  title,
  a11yLabel,
}: {
  onBack: () => void;
  title: string;
  a11yLabel: string;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
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

// ── Section header (no i18n inside; accepts pre-translated title) ──────

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
  avatarText: { fontSize: 20, fontWeight: "700", color: NAVY },
  identityName: { fontSize: 18, fontWeight: "700", color: NAVY, textAlign: "center" },
  joinedText: { fontSize: 12, color: MUTED, marginTop: 2 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 12, fontWeight: "600" },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", alignItems: "stretch" },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryValue: { fontSize: 20, fontWeight: "700", color: NAVY },
  summaryHint: { fontSize: 11, color: MUTED, marginTop: 2, textAlign: "center" },
  summaryDivider: { width: 1, backgroundColor: BORDER, marginHorizontal: 12 },

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
  emptyText: { fontSize: 13, color: MUTED },

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
  rowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: NAVY },
  rowSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  rowEnd: { flexDirection: "row", alignItems: "center", gap: 8 },

  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniBadgeText: { fontSize: 11, fontWeight: "600" },

  actionsBlock: { gap: 10, marginTop: 12 },
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
  cancelledText: { flex: 1, fontSize: 13, color: RED },
});
