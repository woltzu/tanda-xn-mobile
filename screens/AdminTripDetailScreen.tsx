// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminTripDetailScreen.tsx — trip detail (Bucket B mod 4)
// ═══════════════════════════════════════════════════════════════════════════
//
// Trip info + participants list + per-payment refunds. The cancel-trip
// + refund-payment actions are now backed by migration 274
// (admin_cancel_trip / admin_refund_payment RPCs) and the
// process-refunds Edge Function which drains the refund queue.
//
// Both flows surface a single ReasonModal (text input + Confirm) so the
// admin's audit log entry includes context. Refunds are per-payment,
// not per-participant — a participant with two payments gets two rows.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../components/Toast";
import AdminErrorState from "../components/AdminErrorState";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface Trip {
  id: string;
  trip_name: string | null;
  destination: string | null;
  description: string | null;
  status: string | null;
  price_per_person: number | null;
  start_date: string | null;
  end_date: string | null;
  max_participants: number | null;
  organizer_name: string | null;
}

interface Participant {
  id: string;
  user_id: string;
  status: string | null;
  full_name: string | null;
}

interface Payment {
  id: string;
  amount: number | null;
  status: string | null;
  refund_status: string | null;
  paid_at: string | null;
  participant_name: string | null;
}

type Params = { AdminTripDetail: { tripId: string } };

type ActionKind = "cancel_trip" | "refund_payment";

export default function AdminTripDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, "AdminTripDetail">>();
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const tripId = route.params?.tripId;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reason-modal state — one modal reused for both cancel and refund.
  // pendingAction holds the kind + the target id (trip id OR payment id).
  const [pendingAction, setPendingAction] = useState<
    { kind: ActionKind; targetId: string } | null
  >(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!tripId || !me?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [tripR, callerR, partsR, paysR] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "id, trip_name, destination, description, status, price_per_person, start_date, end_date, max_participants, organizer_id, profiles:organizer_id(full_name)",
          )
          .eq("id", tripId)
          .maybeSingle(),
        supabase
          .from("admin_users")
          .select("role")
          .eq("user_id", me.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("trip_participants")
          .select("id, user_id, status, profiles:user_id(full_name)")
          .eq("trip_id", tripId)
          .limit(100),
        // Pull payments via trip_participants!inner so the eq() filter
        // pushes into the join — trip_payments has no direct trip_id
        // column. Refund cols (refund_status etc.) come from migration
        // 274; until that lands the embed silently returns nulls which
        // the UI tolerates (eligibility checks treat null as 'none').
        supabase
          .from("trip_payments")
          .select(
            "id, amount, status, refund_status, paid_at, trip_participants!inner ( trip_id, profiles:user_id(full_name) )",
          )
          .eq("trip_participants.trip_id", tripId)
          .order("paid_at", { ascending: false })
          .limit(200),
      ]);
      const tr = tripR.data as any;
      setTrip(
        tr
          ? {
              id: tr.id,
              trip_name: tr.trip_name,
              destination: tr.destination,
              description: tr.description,
              status: tr.status,
              price_per_person: tr.price_per_person,
              start_date: tr.start_date,
              end_date: tr.end_date,
              max_participants: tr.max_participants,
              organizer_name: tr.profiles?.full_name ?? null,
            }
          : null,
      );
      setCallerRole((callerR.data as { role?: string } | null)?.role ?? null);
      setParticipants(
        ((partsR.data ?? []) as any[]).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          status: r.status,
          full_name: r.profiles?.full_name ?? null,
        })),
      );
      setPayments(
        ((paysR.data ?? []) as any[]).map((r) => ({
          id: r.id,
          amount: r.amount,
          status: r.status,
          refund_status: r.refund_status ?? "none",
          paid_at: r.paid_at,
          participant_name: r.trip_participants?.profiles?.full_name ?? null,
        })),
      );
    } catch (err) {
      console.warn("[AdminTripDetail] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tripId, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canAct = callerRole === "super_admin" || callerRole === "admin";
  const tripCancelled =
    trip?.status === "cancelled" || trip?.status === "completed";

  const openReasonModal = (kind: ActionKind, targetId: string) => {
    setPendingAction({ kind, targetId });
    setReason("");
  };

  const closeReasonModal = () => {
    if (submitting) return;
    setPendingAction(null);
    setReason("");
  };

  const submitAction = async () => {
    if (!pendingAction || submitting) return;
    setSubmitting(true);
    try {
      const trimmedReason = reason.trim() || null;
      if (pendingAction.kind === "cancel_trip") {
        const { error: rpcErr } = await supabase.rpc("admin_cancel_trip", {
          p_trip_id: pendingAction.targetId,
          p_reason: trimmedReason,
        });
        if (rpcErr) throw new Error(rpcErr.message);
        showToast(t("admin_trip_actions.cancel_success"), "success");
      } else {
        const { error: rpcErr } = await supabase.rpc("admin_refund_payment", {
          p_payment_id: pendingAction.targetId,
          p_reason: trimmedReason,
        });
        if (rpcErr) throw new Error(rpcErr.message);
        showToast(t("admin_trip_actions.refund_success"), "success");
      }
      setPendingAction(null);
      setReason("");
      await load();
    } catch (err) {
      console.warn("[AdminTripDetail] action failed:", err);
      const key =
        pendingAction.kind === "cancel_trip"
          ? "admin_trip_actions.cancel_failed"
          : "admin_trip_actions.refund_failed";
      showToast(t(key), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const paymentIsRefundable = (p: Payment) =>
    (p.status === "succeeded" || p.status === "pending") &&
    p.refund_status !== "refunded" &&
    p.refund_status !== "pending";

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!trip && error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={t("admin.trips.title")} onBack={() => navigation.goBack()} />
        <AdminErrorState onRetry={load} />
      </SafeAreaView>
    );
  }
  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={t("admin.trips.title")} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.mutedText}>{t("admin.trips.not_found")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <Header
        title={trip.trip_name || trip.destination || "—"}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title={t("admin.trips.section_info")}>
          <Field label={t("admin.trips.destination")} value={trip.destination ?? "—"} />
          <Field label={t("admin.trips.organizer")} value={trip.organizer_name ?? "—"} />
          <Field label={t("admin.trips.status")} value={trip.status ?? "—"} />
          <Field
            label={t("admin.trips.dates")}
            value={
              trip.start_date && trip.end_date
                ? `${new Date(trip.start_date).toLocaleDateString()} → ${new Date(
                    trip.end_date,
                  ).toLocaleDateString()}`
                : trip.start_date
                ? new Date(trip.start_date).toLocaleDateString()
                : "—"
            }
          />
          <Field
            label={t("admin.trips.price")}
            value={`$${Number(trip.price_per_person ?? 0).toLocaleString()}`}
          />
          <Field
            label={t("admin.trips.max_participants")}
            value={`${trip.max_participants ?? "—"}`}
          />
        </Section>

        <Section
          title={t("admin.trips.section_participants", { count: participants.length })}
        >
          {participants.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.trips.no_participants")}</Text>
          ) : (
            participants.map((p, i) => (
              <View
                key={p.id}
                style={[styles.subRow, i < participants.length - 1 && styles.subRowBorder]}
              >
                <Text style={styles.subRowName}>{p.full_name ?? "—"}</Text>
                <Text style={styles.subRowMeta}>{p.status ?? "—"}</Text>
              </View>
            ))
          )}
        </Section>

        {/* Payments section — one row per trip_payment. Per-row refund
            button only renders for super_admin/admin AND when the
            payment is in a refundable state (succeeded/pending + not
            already refunded/queued). */}
        <Section
          title={t("admin.trips.section_payments", { count: payments.length })}
        >
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.trips.no_payments")}</Text>
          ) : (
            payments.map((p, i) => (
              <View
                key={p.id}
                style={[styles.payRow, i < payments.length - 1 && styles.subRowBorder]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.subRowName}>{p.participant_name ?? "—"}</Text>
                  <Text style={styles.subRowMeta}>
                    ${Number(p.amount ?? 0).toFixed(2)} · {p.status ?? "—"}
                    {p.refund_status && p.refund_status !== "none"
                      ? ` · ${t(`admin_trip_actions.refund_status_${p.refund_status}`)}`
                      : ""}
                  </Text>
                </View>
                {canAct && paymentIsRefundable(p) ? (
                  <TouchableOpacity
                    style={styles.refundBtn}
                    onPress={() => openReasonModal("refund_payment", p.id)}
                  >
                    <Text style={styles.refundBtnText}>
                      {t("admin_trip_actions.refund_payment")}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </Section>

        {canAct && !tripCancelled ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => openReasonModal("cancel_trip", trip.id)}
            >
              <Text style={styles.dangerBtnText}>
                {t("admin_trip_actions.cancel_trip")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!pendingAction}
        transparent
        animationType="fade"
        onRequestClose={closeReasonModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pendingAction?.kind === "cancel_trip"
                ? t("admin_trip_actions.cancel_confirm")
                : t("admin_trip_actions.refund_confirm")}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={
                pendingAction?.kind === "cancel_trip"
                  ? t("admin_trip_actions.cancel_reason_placeholder")
                  : t("admin_trip_actions.refund_reason_placeholder")
              }
              placeholderTextColor={MUTED}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
              editable={!submitting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeReasonModal}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>
                  {t("admin_trip_actions.modal_cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, submitting && { opacity: 0.6 }]}
                onPress={submitAction}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t("admin_trip_actions.modal_confirm")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    textAlign: "center",
  },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingVertical: 8,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldLabel: { fontSize: typography.label, color: MUTED },
  fieldValue: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.medium,
    flexShrink: 1,
    textAlign: "right",
  },
  subRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  subRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F3F4F6" },
  subRowName: { fontSize: typography.body, color: NAVY, fontWeight: typography.medium },
  subRowMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  emptyText: {
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    padding: spacing.md,
  },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: spacing.md },
  dangerBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerBtnAlt: { backgroundColor: "#F59E0B" },
  dangerBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },
  note: {
    marginTop: 8,
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    fontStyle: "italic",
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  refundBtn: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refundBtnText: {
    color: "#92400E",
    fontSize: typography.label,
    fontWeight: typography.bold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    fontSize: typography.body,
    color: NAVY,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: { color: NAVY, fontWeight: typography.bold },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    minWidth: 96,
    alignItems: "center",
  },
  modalConfirmText: { color: "#FFFFFF", fontWeight: typography.bold },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
