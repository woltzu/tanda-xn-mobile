// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminDisputeDetailScreen.tsx — mig 384
// ═══════════════════════════════════════════════════════════════════════════
//
// Detail view for a single dispute (admin surface). Reads mig 384's
// get_admin_dispute_detail RPC. Three actions:
//   * Reassign  — admin_reassign_dispute (super_admin OR admin).
//                 Picker fetches circle_members with role='elder' + all
//                 active admins as candidates.
//   * Override  — admin_override_dispute (super_admin only, big-hammer).
//                 Modal: resolution text, resolution_type dropdown,
//                 override reason (≥ 20 chars).
//   * Resolve   — existing resolve_dispute RPC (mig 261). Modal:
//                 resolution text + final status.
//
// Manual "escalate now" button is NOT wired in this MVP — the
// escalate-stale-disputes cron handles tier promotion on the 48h/7d
// clock. If manual escalation becomes a real need, follow-up mig 385
// can add admin_escalate_dispute(dispute_id, tier, reason) and one
// button here.
//
// Error surfacing inside modals uses Alert.alert (native, always renders
// above the Modal z-layer). Mirrors the pattern established after the
// payout console silent-toast bug.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useAdminScope } from "../hooks/useAdminScope";
import { showToast } from "../components/Toast";

interface DisputeRow {
  id: string;
  circle_id: string | null;
  circle_name: string | null;
  reporter_user_id: string;
  reporter_name: string;
  against_user_id: string | null;
  against_name: string | null;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  assignee_name: string | null;
  escalation_tier: string | null;
  escalated_at: string | null;
  escalated_to_admin_id: string | null;
  escalated_to_name: string | null;
  admin_override: boolean;
  override_reason: string | null;
  resolution: string | null;
  resolution_type: string | null;
  resolved_by: string | null;
  resolver_name: string | null;
  resolved_at: string | null;
  response_text: string | null;
  response_at: string | null;
  created_at: string;
  evidence_urls: string[] | null;
}

interface MessageRow {
  id: string;
  dispute_id: string;
  sender_user_id: string;
  sender_name: string;
  message: string;
  message_type: string | null;
  is_private: boolean;
  created_at: string;
}

interface Candidate {
  user_id: string;
  display_name: string;
  role: string;
}

const RESOLUTION_TYPES = ["upheld", "dismissed", "mediated", "escalated", "other"] as const;

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

type RouteParams = { disputeId: string };

export default function AdminDisputeDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();
  const canOverride = String(scope.role ?? "") === "super_admin";

  const disputeId = route.params?.disputeId;

  const [dispute, setDispute] = useState<DisputeRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reassign modal.
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);

  // Override modal.
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideResolution, setOverrideResolution] = useState("");
  const [overrideType, setOverrideType] = useState<string>("mediated");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Resolve modal.
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveText, setResolveText] = useState("");
  const [resolveStatus, setResolveStatus] = useState("resolved");
  const [resolveSaving, setResolveSaving] = useState(false);

  const load = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("get_admin_dispute_detail", {
        p_dispute_id: disputeId,
      });
      if (err) throw new Error(err.message);
      const payload = data as { dispute: DisputeRow; messages: MessageRow[] };
      setDispute(payload.dispute);
      setMessages(payload.messages ?? []);

      // Fetch reassign candidates: circle elders + active admins.
      if (payload.dispute?.circle_id) {
        const [eldersRes, adminsRes] = await Promise.all([
          supabase
            .from("circle_members")
            .select("user_id, role, profiles:user_id(full_name, display_name)")
            .eq("circle_id", payload.dispute.circle_id)
            .eq("role", "elder"),
          supabase
            .from("admin_users")
            .select("user_id, role, profiles:user_id(full_name, display_name)")
            .eq("is_active", true),
        ]);
        const merged: Candidate[] = [];
        const seen = new Set<string>();
        for (const src of [eldersRes.data ?? [], adminsRes.data ?? []]) {
          for (const r of src as any[]) {
            if (seen.has(r.user_id)) continue;
            seen.add(r.user_id);
            merged.push({
              user_id: r.user_id,
              display_name:
                r.profiles?.full_name ?? r.profiles?.display_name ?? "Member",
              role: r.role,
            });
          }
        }
        setCandidates(merged);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  const doReassign = async (newElderId: string) => {
    if (!dispute) return;
    setReassignSaving(true);
    try {
      const { data, error: err } = await supabase.rpc("admin_reassign_dispute", {
        p_dispute_id: dispute.id,
        p_new_elder_id: newElderId,
      });
      if (err) throw new Error(err.message);
      if (!(data as any)?.success) throw new Error("reassign_failed");
      showToast(t("admin.disputes.reassigned_toast"), "success");
      setReassignOpen(false);
      await load();
    } catch (e) {
      Alert.alert(
        t("admin.disputes.reassign_error_title"),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setReassignSaving(false);
    }
  };

  const doOverride = async () => {
    if (!dispute) return;
    if (overrideResolution.trim().length < 10) return;
    if (overrideReason.trim().length < 20) return;
    setOverrideSaving(true);
    try {
      const { data, error: err } = await supabase.rpc("admin_override_dispute", {
        p_dispute_id: dispute.id,
        p_resolution: overrideResolution.trim(),
        p_resolution_type: overrideType,
        p_reason: overrideReason.trim(),
      });
      if (err) throw new Error(err.message);
      if (!(data as any)?.success) throw new Error("override_failed");
      showToast(t("admin.disputes.overridden_toast"), "success");
      setOverrideOpen(false);
      setOverrideResolution("");
      setOverrideReason("");
      await load();
    } catch (e) {
      Alert.alert(
        t("admin.disputes.override_error_title"),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setOverrideSaving(false);
    }
  };

  const doResolve = async () => {
    if (!dispute) return;
    if (resolveText.trim().length < 10) return;
    setResolveSaving(true);
    try {
      const { data, error: err } = await supabase.rpc("resolve_dispute", {
        p_dispute_id: dispute.id,
        p_resolution: resolveText.trim(),
        p_status: resolveStatus,
      });
      if (err) throw new Error(err.message);
      // Existing mig 261 RPC — return shape may not include success flag,
      // so we only treat an SDK-level error as failure.
      showToast(t("admin.disputes.resolved_toast"), "success");
      setResolveOpen(false);
      setResolveText("");
      await load();
    } catch (e) {
      Alert.alert(
        t("admin.disputes.resolve_error_title"),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setResolveSaving(false);
    }
  };

  const isTerminal = useMemo(
    () => dispute?.status === "resolved",
    [dispute?.status],
  );

  if (adminLoading || loading) {
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
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  if (!dispute) return null;

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
        <Text style={styles.headerTitle} numberOfLines={1}>{dispute.title}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Meta card */}
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("admin.disputes.detail_circle")}</Text>
            <Text style={styles.metaValue}>{dispute.circle_name ?? "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("admin.disputes.detail_reporter")}</Text>
            <Text style={styles.metaValue}>{dispute.reporter_name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("admin.disputes.detail_against")}</Text>
            <Text style={styles.metaValue}>{dispute.against_name ?? "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("admin.disputes.detail_priority")}</Text>
            <Text style={styles.metaValue}>{dispute.priority}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("admin.disputes.detail_status")}</Text>
            <Text style={styles.metaValue}>{dispute.status}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("admin.disputes.detail_assignee")}</Text>
            <Text style={styles.metaValue}>{dispute.assignee_name ?? "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("admin.disputes.detail_created")}</Text>
            <Text style={styles.metaValue}>{fmtRelative(dispute.created_at)}</Text>
          </View>
          {dispute.escalation_tier ? (
            <View style={styles.escalatedBox}>
              <Ionicons name="arrow-up-circle" size={14} color="#991B1B" />
              <Text style={styles.escalatedText}>
                {t("admin.disputes.detail_escalated_tier", { tier: dispute.escalation_tier })}
                {dispute.escalated_at ? ` · ${fmtRelative(dispute.escalated_at)}` : ""}
              </Text>
            </View>
          ) : null}
          {dispute.admin_override ? (
            <View style={styles.overrideBox}>
              <Ionicons name="hammer" size={14} color="#92400E" />
              <Text style={styles.overrideText}>
                {t("admin.disputes.detail_override_note", { reason: dispute.override_reason ?? "—" })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("admin.disputes.detail_description")}</Text>
          <Text style={styles.body}>{dispute.description}</Text>
          {dispute.response_text ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
                {t("admin.disputes.detail_response")}
                {dispute.response_at ? ` · ${fmtRelative(dispute.response_at)}` : ""}
              </Text>
              <Text style={styles.body}>{dispute.response_text}</Text>
            </>
          ) : null}
        </View>

        {/* Resolution — only when resolved */}
        {isTerminal ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("admin.disputes.detail_resolution")}</Text>
            <Text style={styles.body}>{dispute.resolution ?? "—"}</Text>
            <Text style={styles.metaSub}>
              {dispute.resolver_name
                ? t("admin.disputes.resolved_by", { name: dispute.resolver_name })
                : "—"}
              {dispute.resolved_at ? ` · ${fmtRelative(dispute.resolved_at)}` : ""}
            </Text>
          </View>
        ) : null}

        {/* Action buttons */}
        {!isTerminal ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary]}
              onPress={() => setReassignOpen(true)}
            >
              <Ionicons name="person-add-outline" size={14} color={colors.primaryNavy} />
              <Text style={styles.actionSecondaryText}>{t("admin.disputes.action_reassign")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => {
                setResolveText("");
                setResolveStatus("resolved");
                setResolveOpen(true);
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
              <Text style={styles.actionPrimaryText}>{t("admin.disputes.action_resolve")}</Text>
            </TouchableOpacity>
            {canOverride ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDanger]}
                onPress={() => {
                  setOverrideResolution("");
                  setOverrideReason("");
                  setOverrideType("mediated");
                  setOverrideOpen(true);
                }}
              >
                <Ionicons name="hammer-outline" size={14} color="#FFFFFF" />
                <Text style={styles.actionPrimaryText}>{t("admin.disputes.action_override")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Message thread */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t("admin.disputes.detail_messages", { count: messages.length })}
          </Text>
          {messages.length === 0 ? (
            <Text style={styles.metaSub}>{t("admin.disputes.messages_empty")}</Text>
          ) : (
            messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.msgRow,
                  m.is_private && styles.msgRowPrivate,
                  m.message_type === "admin_override" && styles.msgRowOverride,
                  m.message_type === "admin_reassign" && styles.msgRowReassign,
                ]}
              >
                <View style={styles.msgHeader}>
                  <Text style={styles.msgSender}>{m.sender_name}</Text>
                  <Text style={styles.msgTs}>{fmtRelative(m.created_at)}</Text>
                </View>
                {m.message_type ? (
                  <Text style={styles.msgTypeTag}>{m.message_type}</Text>
                ) : null}
                <Text style={styles.msgBody}>{m.message}</Text>
                {m.is_private ? (
                  <View style={styles.msgPrivateTag}>
                    <Ionicons name="lock-closed-outline" size={10} color={colors.warningLabel} />
                    <Text style={styles.msgPrivateText}>
                      {t("admin.disputes.msg_private")}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Reassign modal */}
      <Modal
        visible={reassignOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReassignOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="person-add-outline" size={20} color={colors.primaryNavy} />
              <Text style={styles.modalTitle}>{t("admin.disputes.reassign_modal_title")}</Text>
            </View>
            <Text style={styles.modalBody}>{t("admin.disputes.reassign_modal_body")}</Text>
            <ScrollView style={styles.reassignList}>
              {candidates.length === 0 ? (
                <Text style={styles.metaSub}>{t("admin.disputes.reassign_no_candidates")}</Text>
              ) : (
                candidates.map((c) => (
                  <TouchableOpacity
                    key={c.user_id}
                    style={[
                      styles.reassignCell,
                      dispute.assigned_to === c.user_id && styles.reassignCellCurrent,
                      reassignSaving && styles.actionDisabled,
                    ]}
                    disabled={reassignSaving || dispute.assigned_to === c.user_id}
                    onPress={() => doReassign(c.user_id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reassignName}>{c.display_name}</Text>
                      <Text style={styles.reassignRole}>{c.role}</Text>
                    </View>
                    {dispute.assigned_to === c.user_id ? (
                      <Text style={styles.reassignCurrentTag}>current</Text>
                    ) : (
                      <Ionicons name="arrow-forward" size={14} color={colors.primaryNavy} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setReassignOpen(false)}
                disabled={reassignSaving}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Resolve modal */}
      <Modal
        visible={resolveOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResolveOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primaryNavy} />
              <Text style={styles.modalTitle}>{t("admin.disputes.resolve_modal_title")}</Text>
            </View>
            <Text style={styles.modalBody}>{t("admin.disputes.resolve_modal_body")}</Text>
            <Text style={styles.fieldLabel}>{t("admin.disputes.resolve_text_label")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.disputes.resolve_text_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={resolveText}
              onChangeText={setResolveText}
              maxLength={1000}
              editable={!resolveSaving}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setResolveOpen(false)}
                disabled={resolveSaving}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalConfirm,
                  (resolveText.trim().length < 10 || resolveSaving) && styles.actionDisabled,
                ]}
                onPress={doResolve}
                disabled={resolveText.trim().length < 10 || resolveSaving}
              >
                {resolveSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t("admin.disputes.action_resolve")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {!resolveSaving && resolveText.trim().length < 10 ? (
              <Text style={styles.disabledHint}>
                {t("admin.disputes.resolve_hint")}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Override modal */}
      <Modal
        visible={overrideOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverrideOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="hammer-outline" size={20} color="#991B1B" />
              <Text style={styles.modalTitle}>{t("admin.disputes.override_modal_title")}</Text>
            </View>
            <Text style={styles.modalBody}>{t("admin.disputes.override_modal_body")}</Text>

            <Text style={styles.fieldLabel}>{t("admin.disputes.override_resolution_label")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.disputes.override_resolution_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={overrideResolution}
              onChangeText={setOverrideResolution}
              maxLength={1000}
              editable={!overrideSaving}
            />

            <Text style={styles.fieldLabel}>{t("admin.disputes.override_type_label")}</Text>
            <View style={styles.typeRow}>
              {RESOLUTION_TYPES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.typePill, overrideType === r && styles.typePillActive]}
                  onPress={() => setOverrideType(r)}
                >
                  <Text style={[styles.typePillText, overrideType === r && styles.typePillTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t("admin.disputes.override_reason_label")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.disputes.override_reason_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={overrideReason}
              onChangeText={setOverrideReason}
              maxLength={500}
              editable={!overrideSaving}
            />
            <Text style={styles.charCount}>
              {t("admin.disputes.reason_min_count", {
                current: overrideReason.trim().length,
                min: 20,
              })}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setOverrideOpen(false)}
                disabled={overrideSaving}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalConfirmDanger,
                  (overrideResolution.trim().length < 10 ||
                    overrideReason.trim().length < 20 ||
                    overrideSaving) && styles.actionDisabled,
                ]}
                onPress={doOverride}
                disabled={
                  overrideResolution.trim().length < 10 ||
                  overrideReason.trim().length < 20 ||
                  overrideSaving
                }
              >
                {overrideSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t("admin.disputes.action_override")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {!overrideSaving &&
            (overrideResolution.trim().length < 10 || overrideReason.trim().length < 20) ? (
              <Text style={styles.disabledHint}>
                {[
                  overrideResolution.trim().length < 10
                    ? t("admin.disputes.override_hint_resolution")
                    : null,
                  overrideReason.trim().length < 20
                    ? t("admin.disputes.override_hint_reason")
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    width: 38, height: 38,
    alignItems: "center", justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  scroll: { padding: 12 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  metaLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
  metaValue: { fontSize: 12, color: colors.textPrimary, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  metaSub: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.primaryNavy, marginBottom: 4 },
  body: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },

  escalatedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginTop: 6,
  },
  escalatedText: { flex: 1, fontSize: 11, color: "#991B1B", fontWeight: "600" },

  overrideBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginTop: 6,
  },
  overrideText: { flex: 1, fontSize: 11, color: "#92400E", fontWeight: "600" },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    minWidth: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionSecondaryText: { color: colors.primaryNavy, fontWeight: "700", fontSize: 12 },
  actionPrimary: { backgroundColor: colors.primaryNavy },
  actionPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  actionDanger: { backgroundColor: "#991B1B" },

  msgRow: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  msgRowPrivate: { borderColor: "#FDE68A", backgroundColor: "#FEFCE8" },
  msgRowOverride: { borderColor: "#FCA5A5", backgroundColor: colors.errorBg },
  msgRowReassign: { borderColor: "#93C5FD", backgroundColor: "#EFF6FF" },
  msgHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  msgSender: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  msgTs: { fontSize: 10, color: colors.textSecondary },
  msgTypeTag: {
    alignSelf: "flex-start",
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    fontSize: 9,
    color: "#475569",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  msgBody: { fontSize: 12, color: colors.textPrimary, marginTop: 4, lineHeight: 17 },
  msgPrivateTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  msgPrivateText: { fontSize: 10, color: colors.warningLabel, fontWeight: "600" },

  errorText: { marginTop: 12, color: colors.errorText, textAlign: "center", fontSize: 13 },
  blockedText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primaryNavy,
  },
  retryText: { color: "#FFFFFF", fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 18,
    gap: 8,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.primaryNavy },
  modalBody: { fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.primaryNavy, marginTop: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 70,
    color: colors.textPrimary,
    fontSize: 13,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: -6,
  },
  disabledHint: {
    marginTop: 8,
    fontSize: 11,
    color: "#991B1B",
    fontWeight: "600",
    textAlign: "center",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  typePillActive: { backgroundColor: colors.primaryNavy, borderColor: colors.primaryNavy },
  typePillText: { fontSize: 11, fontWeight: "700", color: colors.textPrimary },
  typePillTextActive: { color: "#FFFFFF" },

  modalActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancel: { backgroundColor: colors.screenBg, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.textPrimary, fontWeight: "700" },
  modalConfirm: { backgroundColor: colors.primaryNavy },
  modalConfirmDanger: { backgroundColor: "#991B1B" },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "700" },
  actionDisabled: { opacity: 0.6 },

  reassignList: { maxHeight: 260 },
  reassignCell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
    marginTop: 6,
  },
  reassignCellCurrent: { backgroundColor: "#F1F5F9" },
  reassignName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  reassignRole: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  reassignCurrentTag: { fontSize: 10, color: colors.textSecondary, fontWeight: "700" },
});
