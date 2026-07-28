// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminChargebackConsoleScreen.tsx — mig 389
// ═══════════════════════════════════════════════════════════════════════════
//
// Stripe chargeback (dispute) management console for admins.
//
// Reads get_chargeback_dashboard() — returns open + recently-resolved
// disputes with member, circle, deadline, and impact info. Two admin
// actions per row: Respond (log evidence URLs + notes) and Freeze /
// Unfreeze the member's account.
//
// Vertical stack:
//   1. Counts strip (needs_response / under_review / resolved_30d /
//      frozen_accounts)
//   2. Dispute cards, deadline-sorted (nearest first)
//
// Freeze semantics: sets profiles.account_frozen_at (indefinite, admin-
// triggered — distinct from suspended_until which is temporal cool-down).
// The freeze doesn't automatically block any specific action yet — it's a
// signal for downstream checks to consult. Unfreeze clears the freeze +
// logs to admin_audit_log.
//
// Admin-gated via useIsAdmin.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";

interface DisputeRow {
  dispute_id: string;
  stripe_dispute_id: string;
  status: string;
  reason: string;
  amount_cents: number;
  currency: string;
  evidence_due_by: string | null;
  hours_until_deadline: number | null;
  evidence_submitted: boolean;
  evidence_urls: string[];
  admin_notes: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  frozen_account: boolean;
  created_at: string;
  member_id: string;
  member_full_name: string | null;
  member_email: string | null;
  member_frozen_at: string | null;
  circle_id: string | null;
  circle_name: string | null;
  circle_active_members: number;
  stripe_pi_text: string | null;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function fmtDeadline(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 0) return "overdue";
  if (hours < 24) return `${Math.round(hours)}h left`;
  const days = Math.round(hours / 24);
  return `${days}d left`;
}

function deadlineTone(hours: number | null): "danger" | "warning" | "neutral" {
  if (hours == null) return "neutral";
  if (hours < 24) return "danger";
  if (hours < 72) return "warning";
  return "neutral";
}

function statusTone(status: string): "danger" | "warning" | "success" | "neutral" {
  if (status === "won") return "success";
  if (status === "lost" || status === "charge_refunded") return "danger";
  if (status.includes("needs_response")) return "danger";
  if (status.includes("under_review")) return "warning";
  return "neutral";
}

function isOpen(status: string): boolean {
  return !["won", "lost", "charge_refunded", "warning_closed"].includes(status);
}

export default function AdminChargebackConsoleScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Respond modal state
  const [respondFor, setRespondFor] = useState<DisputeRow | null>(null);
  const [respondUrls, setRespondUrls] = useState("");
  const [respondNotes, setRespondNotes] = useState("");
  const [respondSaving, setRespondSaving] = useState(false);

  // Freeze/unfreeze modal state
  const [freezeFor, setFreezeFor] = useState<{
    dispute: DisputeRow;
    mode: "freeze" | "unfreeze";
  } | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [freezeSaving, setFreezeSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("get_chargeback_dashboard");
      if (err) throw new Error(err.message);
      setRows(Array.isArray(data) ? (data as DisputeRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openRespond = (r: DisputeRow) => {
    setRespondFor(r);
    setRespondUrls((r.evidence_urls ?? []).join("\n"));
    setRespondNotes(r.admin_notes ?? "");
  };

  const submitRespond = async () => {
    if (!respondFor) return;
    const urls = respondUrls
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (urls.length === 0) {
      Alert.alert(
        t("admin.chargebacks.respond_error_title"),
        t("admin.chargebacks.respond_error_urls_required")
      );
      return;
    }
    setRespondSaving(true);
    try {
      const { error: err } = await supabase.rpc("admin_respond_to_chargeback", {
        p_dispute_id: respondFor.dispute_id,
        p_evidence_urls: urls,
        p_notes: respondNotes.trim() || null,
      });
      if (err) throw new Error(err.message);
      setRespondFor(null);
      setRespondUrls("");
      setRespondNotes("");
      await load();
      Alert.alert(t("admin.chargebacks.saved_title"), t("admin.chargebacks.respond_saved_body"));
    } catch (e) {
      Alert.alert(
        t("admin.chargebacks.respond_error_title"),
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setRespondSaving(false);
    }
  };

  const openFreeze = (r: DisputeRow, mode: "freeze" | "unfreeze") => {
    setFreezeFor({ dispute: r, mode });
    setFreezeReason("");
  };

  const submitFreeze = async () => {
    if (!freezeFor) return;
    const reason = freezeReason.trim();
    if (!reason) {
      Alert.alert(
        t("admin.chargebacks.freeze_error_title"),
        t("admin.chargebacks.freeze_error_reason_required")
      );
      return;
    }
    setFreezeSaving(true);
    try {
      if (freezeFor.mode === "freeze") {
        const { error: err } = await supabase.rpc("admin_freeze_account", {
          p_user_id: freezeFor.dispute.member_id,
          p_reason: reason,
          p_dispute_id: freezeFor.dispute.dispute_id,
        });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await supabase.rpc("admin_unfreeze_account", {
          p_user_id: freezeFor.dispute.member_id,
          p_reason: reason,
        });
        if (err) throw new Error(err.message);
      }
      setFreezeFor(null);
      setFreezeReason("");
      await load();
      Alert.alert(
        t("admin.chargebacks.saved_title"),
        freezeFor.mode === "freeze"
          ? t("admin.chargebacks.freeze_saved_body")
          : t("admin.chargebacks.unfreeze_saved_body")
      );
    } catch (e) {
      Alert.alert(
        t("admin.chargebacks.freeze_error_title"),
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setFreezeSaving(false);
    }
  };

  if (adminLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accentTeal} />
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.blockedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const openRows = rows.filter((r) => isOpen(r.status));
  const needsResponse = openRows.filter((r) => r.status.includes("needs_response")).length;
  const underReview = openRows.filter((r) => r.status.includes("under_review")).length;
  const resolved30d = rows.filter(
    (r) =>
      !isOpen(r.status) &&
      r.resolved_at &&
      Date.now() - new Date(r.resolved_at).getTime() < 30 * 24 * 3600 * 1000
  ).length;
  const frozenAccounts = new Set(
    rows.filter((r) => r.member_frozen_at).map((r) => r.member_id)
  ).size;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2342" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.chargebacks.title")}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentTeal}
            />
          }
        >
          {/* Counts strip */}
          <View style={styles.countsStrip}>
            <CountCell
              label={t("admin.chargebacks.count_needs_response")}
              value={needsResponse}
              tone={needsResponse > 0 ? "danger" : "success"}
            />
            <CountCell
              label={t("admin.chargebacks.count_under_review")}
              value={underReview}
              tone={underReview > 0 ? "warning" : "success"}
            />
            <CountCell
              label={t("admin.chargebacks.count_resolved_30d")}
              value={resolved30d}
              tone="neutral"
            />
            <CountCell
              label={t("admin.chargebacks.count_frozen")}
              value={frozenAccounts}
              tone={frozenAccounts > 0 ? "warning" : "neutral"}
            />
          </View>

          {/* Disputes list */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="shield-half-outline"
                size={16}
                color={colors.primaryNavy}
              />
              <Text style={styles.cardTitle}>
                {t("admin.chargebacks.list_title", { count: rows.length })}
              </Text>
            </View>
            {rows.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.chargebacks.list_empty")}
              </Text>
            ) : (
              rows.map((r) => (
                <View key={r.dispute_id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {r.member_full_name ?? r.member_email ?? "—"}
                      </Text>
                      <StatusBadge status={r.status} t={t} />
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {r.circle_name ?? "—"}
                      {" · "}
                      ${(r.amount_cents / 100).toFixed(2)}{" "}
                      {(r.currency ?? "usd").toUpperCase()}
                      {" · "}
                      {t(`admin.chargebacks.reason_${r.reason}`, {
                        defaultValue: r.reason,
                      })}
                    </Text>
                    {r.circle_id ? (
                      <Text style={styles.rowSub}>
                        {t("admin.chargebacks.impact", {
                          count: r.circle_active_members,
                        })}
                      </Text>
                    ) : null}
                    {isOpen(r.status) && r.evidence_due_by ? (
                      <View
                        style={[
                          styles.deadlineChip,
                          deadlineTone(r.hours_until_deadline) === "danger" &&
                            styles.deadlineChipDanger,
                          deadlineTone(r.hours_until_deadline) === "warning" &&
                            styles.deadlineChipWarning,
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={11}
                          color={
                            deadlineTone(r.hours_until_deadline) === "danger"
                              ? "#991B1B"
                              : deadlineTone(r.hours_until_deadline) === "warning"
                              ? colors.warningLabel
                              : colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.deadlineChipText,
                            deadlineTone(r.hours_until_deadline) === "danger" && {
                              color: "#991B1B",
                            },
                            deadlineTone(r.hours_until_deadline) === "warning" && {
                              color: colors.warningLabel,
                            },
                          ]}
                        >
                          {fmtDeadline(r.hours_until_deadline)}
                        </Text>
                      </View>
                    ) : null}
                    {r.evidence_submitted && r.evidence_urls.length > 0 ? (
                      <Text style={styles.rowSub}>
                        {t("admin.chargebacks.evidence_count", {
                          count: r.evidence_urls.length,
                        })}
                        {r.responded_at
                          ? ` · ${fmtRelative(r.responded_at)}`
                          : ""}
                      </Text>
                    ) : null}
                    {r.member_frozen_at ? (
                      <View style={styles.frozenChip}>
                        <Ionicons
                          name="snow-outline"
                          size={11}
                          color="#0369A1"
                        />
                        <Text style={styles.frozenChipText}>
                          {t("admin.chargebacks.member_frozen", {
                            rel: fmtRelative(r.member_frozen_at),
                          })}
                        </Text>
                      </View>
                    ) : null}

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                      {isOpen(r.status) ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionRespond]}
                          onPress={() => openRespond(r)}
                        >
                          <Ionicons
                            name="document-attach-outline"
                            size={14}
                            color="#FFFFFF"
                          />
                          <Text style={styles.actionText}>
                            {r.evidence_submitted
                              ? t("admin.chargebacks.action_update_evidence")
                              : t("admin.chargebacks.action_respond")}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {r.member_frozen_at ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionUnfreeze]}
                          onPress={() => openFreeze(r, "unfreeze")}
                        >
                          <Ionicons
                            name="sunny-outline"
                            size={14}
                            color={colors.primaryNavy}
                          />
                          <Text
                            style={[styles.actionText, { color: colors.primaryNavy }]}
                          >
                            {t("admin.chargebacks.action_unfreeze")}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionFreeze]}
                          onPress={() => openFreeze(r, "freeze")}
                        >
                          <Ionicons
                            name="snow-outline"
                            size={14}
                            color="#FFFFFF"
                          />
                          <Text style={styles.actionText}>
                            {t("admin.chargebacks.action_freeze")}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ─── Respond modal ─── */}
      <Modal
        visible={respondFor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => (respondSaving ? null : setRespondFor(null))}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t("admin.chargebacks.respond_title")}
            </Text>
            <Text style={styles.modalSubtitle}>
              {respondFor
                ? t("admin.chargebacks.respond_subtitle", {
                    member: respondFor.member_full_name ?? "—",
                    amount: `$${(respondFor.amount_cents / 100).toFixed(2)}`,
                  })
                : ""}
            </Text>

            <Text style={styles.modalFieldLabel}>
              {t("admin.chargebacks.respond_urls_label")}
            </Text>
            <Text style={styles.modalFieldHint}>
              {t("admin.chargebacks.respond_urls_hint")}
            </Text>
            <TextInput
              style={styles.modalInputMulti}
              value={respondUrls}
              onChangeText={setRespondUrls}
              placeholder="https://…"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              editable={!respondSaving}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.modalFieldLabel}>
              {t("admin.chargebacks.respond_notes_label")}
            </Text>
            <TextInput
              style={styles.modalInputMulti}
              value={respondNotes}
              onChangeText={setRespondNotes}
              placeholder={t("admin.chargebacks.respond_notes_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              editable={!respondSaving}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setRespondFor(null)}
                disabled={respondSaving}
              >
                <Text style={styles.modalBtnGhostText}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={submitRespond}
                disabled={respondSaving}
              >
                {respondSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>
                    {t("admin.chargebacks.respond_submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Freeze/Unfreeze modal ─── */}
      <Modal
        visible={freezeFor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => (freezeSaving ? null : setFreezeFor(null))}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {freezeFor?.mode === "freeze"
                ? t("admin.chargebacks.freeze_title")
                : t("admin.chargebacks.unfreeze_title")}
            </Text>
            <Text style={styles.modalSubtitle}>
              {freezeFor
                ? t(
                    freezeFor.mode === "freeze"
                      ? "admin.chargebacks.freeze_subtitle"
                      : "admin.chargebacks.unfreeze_subtitle",
                    { member: freezeFor.dispute.member_full_name ?? "—" }
                  )
                : ""}
            </Text>

            <Text style={styles.modalFieldLabel}>
              {t("admin.chargebacks.reason_label")}
            </Text>
            <TextInput
              style={styles.modalInputMulti}
              value={freezeReason}
              onChangeText={setFreezeReason}
              placeholder={t("admin.chargebacks.reason_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              editable={!freezeSaving}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setFreezeFor(null)}
                disabled={freezeSaving}
              >
                <Text style={styles.modalBtnGhostText}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  freezeFor?.mode === "freeze"
                    ? styles.modalBtnDanger
                    : styles.modalBtnPrimary,
                ]}
                onPress={submitFreeze}
                disabled={freezeSaving}
              >
                {freezeSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>
                    {freezeFor?.mode === "freeze"
                      ? t("admin.chargebacks.freeze_submit")
                      : t("admin.chargebacks.unfreeze_submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const tone = statusTone(status);
  const toneMap: Record<string, { bg: string; fg: string }> = {
    success: { bg: "#D1FAE5", fg: colors.successLabel },
    warning: { bg: colors.warningBg, fg: colors.warningLabel },
    danger: { bg: colors.errorBg, fg: "#991B1B" },
    neutral: { bg: "#E2E8F0", fg: "#475569" },
  };
  const s = toneMap[tone];
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusBadgeText, { color: s.fg }]}>
        {t(`admin.chargebacks.status_${status}`, { defaultValue: status })}
      </Text>
    </View>
  );
}

function CountCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneMap: Record<string, { bg: string; fg: string }> = {
    success: { bg: "#D1FAE5", fg: colors.successLabel },
    warning: { bg: colors.warningBg, fg: colors.warningLabel },
    danger: { bg: colors.errorBg, fg: "#991B1B" },
    neutral: { bg: "#E2E8F0", fg: "#475569" },
  };
  const s = toneMap[tone];
  return (
    <View style={[styles.countCell, { backgroundColor: s.bg }]}>
      <Text style={[styles.countValue, { color: s.fg }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: s.fg }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: "#0A2342",
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scroll: { padding: 12 },

  countsStrip: { flexDirection: "row", gap: 8, marginBottom: 12 },
  countCell: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 74,
  },
  countValue: { fontSize: 22, fontWeight: "800" },
  countLabel: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryNavy,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  rowTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  rowSub: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  deadlineChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    marginTop: 6,
  },
  deadlineChipDanger: { backgroundColor: colors.errorBg },
  deadlineChipWarning: { backgroundColor: colors.warningBg },
  deadlineChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  frozenChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    marginTop: 4,
  },
  frozenChipText: { fontSize: 11, fontWeight: "700", color: "#0369A1" },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionRespond: { backgroundColor: colors.primaryNavy },
  actionFreeze: { backgroundColor: "#0369A1" },
  actionUnfreeze: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primaryNavy,
  },
  actionText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  errorText: {
    marginTop: 12,
    color: colors.errorText,
    textAlign: "center",
    fontSize: 13,
  },
  blockedText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primaryNavy,
  },
  retryText: { color: "#FFFFFF", fontWeight: "700" },

  // ─── Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primaryNavy,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginTop: 8,
  },
  modalFieldHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalInputMulti: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
    minHeight: 70,
    textAlignVertical: "top",
    marginTop: 6,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
    alignItems: "center",
  },
  modalBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnGhostText: { color: colors.textPrimary, fontWeight: "700" },
  modalBtnPrimary: { backgroundColor: colors.primaryNavy },
  modalBtnDanger: { backgroundColor: "#0369A1" },
  modalBtnPrimaryText: { color: "#FFFFFF", fontWeight: "700" },
});
