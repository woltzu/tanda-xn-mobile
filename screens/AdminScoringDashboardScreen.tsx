// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminScoringDashboardScreen.tsx — Phase 1 scoring admin surface
// ═══════════════════════════════════════════════════════════════════════════
//
// Single get_scoring_dashboard() RPC (mig 376) feeds three cards:
//   1. Pipeline status — frozen badge, last-run, next-run, freeze toggle
//      (button visible only to super_admin/platform_admin/admin;
//      community_admin sees the state read-only per Doc 39 §3.3.2 pattern).
//   2. Biggest deltas — top rows from xn_scores where
//      |total_score - previous_score| ≥ threshold.
//   3. Recent runs — last 10 rows from cron_job_logs
//      (scoring-pipeline-daily + freeze/unfreeze audit events).
//
// Freeze submit uses a modal for reason input (≥ 20 chars, matches the
// RPC guard). Unfreeze uses a simple Alert.alert confirm.
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
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useAdminScope } from "../hooks/useAdminScope";
import { showToast } from "../components/Toast";

const CAN_FREEZE_ROLES = new Set<string>(["super_admin", "platform_admin", "admin"]);

interface Delta {
  user_id: string;
  display_name: string;
  total_score: number;
  previous_score: number;
  delta: number;
  abs_delta: number;
  initial_calculated_at: string | null;
}

interface RunRow {
  id: string;
  job_name: string;
  status: string;
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  execution_time_ms: number | null;
  details: any;
  error_message: string | null;
  created_at: string;
}

interface PipelineStatus {
  frozen: boolean;
  frozen_at: string | null;
  frozen_by: string | null;
  frozen_by_name: string | null;
  frozen_reason: string | null;
  threshold: number;
  last_run_at: string | null;
  last_run_status: string | null;
  cron_schedule: string;
  cron_note: string;
}

interface AlertRow {
  id: string;
  title: string;
  body: string;
  data: {
    target_user_id?: string;
    member_name?: string;
    old_score?: number;
    new_score?: number;
    delta?: number;
    threshold?: number;
    pipeline_run_id?: string;
  };
  read: boolean;
  read_at: string | null;
  created_at: string;
}

interface OverrideRow {
  id: string;
  user_id: string;
  member_name: string;
  old_score: number;
  new_score: number;
  delta: number;
  reason: string;
  admin_note: string | null;
  admin_user_id: string;
  admin_name: string;
  created_at: string;
  expires_at: string | null;
  is_expired: boolean;
}

interface DashboardPayload {
  biggest_deltas: Delta[];
  recent_runs: RunRow[];
  recent_alerts: AlertRow[];
  pipeline_status: PipelineStatus;
  threshold_used: number;
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

function fmtDelta(d: number): string {
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(2)}`;
}

const RUN_STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  success: { bg: "#D1FAE5", fg: colors.successLabel },
  partial: { bg: colors.warningBg, fg: colors.warningLabel },
  failed:  { bg: colors.errorBg,   fg: "#991B1B" },
  running: { bg: "#E2E8F0",        fg: "#475569" },
};

function jobKind(job_name: string): "run" | "freeze" | "unfreeze" {
  if (job_name === "admin.scoring_freeze")   return "freeze";
  if (job_name === "admin.scoring_unfreeze") return "unfreeze";
  return "run";
}

export default function AdminScoringDashboardScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();
  const canFreeze = CAN_FREEZE_ROLES.has(String(scope.role ?? ""));

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [freezeModalVisible, setFreezeModalVisible] = useState(false);
  const [freezeReason, setFreezeReason] = useState("");
  const [toggling, setToggling] = useState(false);

  // Override modal state. When overrideTarget is non-null, the modal is
  // open and the fields are bound to the target user.
  const [overrideTarget, setOverrideTarget] = useState<{
    user_id: string;
    display_name: string;
    current_score: number;
  } | null>(null);
  const [overrideNewScore, setOverrideNewScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDays, setOverrideDays] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [removingOverride, setRemovingOverride] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, ovRes] = await Promise.all([
        supabase.rpc("get_scoring_dashboard", { p_threshold: null }),
        supabase.rpc("get_active_xnscore_overrides"),
      ]);
      if (dashRes.error) throw new Error(dashRes.error.message);
      if (ovRes.error) throw new Error(ovRes.error.message);
      setData(dashRes.data as DashboardPayload);
      setOverrides(((ovRes.data as any)?.overrides ?? []) as OverrideRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const openOverrideModal = (delta: Delta) => {
    setOverrideTarget({
      user_id: delta.user_id,
      display_name: delta.display_name,
      current_score: delta.total_score,
    });
    setOverrideNewScore(String(delta.total_score.toFixed(2)));
    setOverrideReason("");
    setOverrideDays("");
  };

  const closeOverrideModal = () => {
    setOverrideTarget(null);
    setOverrideNewScore("");
    setOverrideReason("");
    setOverrideDays("");
  };

  const submitOverride = async () => {
    if (!overrideTarget) return;
    const parsedScore = Number.parseFloat(overrideNewScore);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      showToast(t("admin.scoring.override_bad_score"), "error");
      return;
    }
    if (overrideReason.trim().length < 20) return;
    const parsedDays = overrideDays.trim() === "" ? null : Number.parseInt(overrideDays, 10);
    if (parsedDays !== null && (!Number.isFinite(parsedDays) || parsedDays < 1)) {
      showToast(t("admin.scoring.override_bad_days"), "error");
      return;
    }
    const expiresAt =
      parsedDays !== null
        ? new Date(Date.now() + parsedDays * 86400_000).toISOString()
        : null;

    setSavingOverride(true);
    try {
      const { data: res, error: err } = await supabase.rpc("override_xn_score", {
        p_user_id: overrideTarget.user_id,
        p_new_score: parsedScore,
        p_reason: overrideReason.trim(),
        p_admin_note: null,
        p_expires_at: expiresAt,
      });
      if (err) throw new Error(err.message);
      if (!(res as any)?.success) throw new Error("override_failed");
      showToast(t("admin.scoring.override_saved_toast"), "success");
      closeOverrideModal();
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSavingOverride(false);
    }
  };

  const confirmRemoveOverride = (row: OverrideRow) => {
    Alert.alert(
      t("admin.scoring.remove_override_confirm_title"),
      t("admin.scoring.remove_override_confirm_body", { name: row.member_name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.scoring.overrides_remove_btn"),
          style: "destructive",
          onPress: async () => {
            setRemovingOverride(row.id);
            try {
              const { data: res, error: err } = await supabase.rpc(
                "remove_xn_score_override",
                { p_user_id: row.user_id, p_reason: "admin_removed_via_dashboard" },
              );
              if (err) throw new Error(err.message);
              if (!(res as any)?.success) throw new Error("remove_failed");
              showToast(t("admin.scoring.override_removed_toast"), "info");
              await load();
            } catch (e) {
              showToast(e instanceof Error ? e.message : String(e), "error");
            } finally {
              setRemovingOverride(null);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openFreezeModal = () => {
    setFreezeReason("");
    setFreezeModalVisible(true);
  };

  const submitFreeze = async () => {
    if (freezeReason.trim().length < 20) return;
    setToggling(true);
    try {
      const { data: res, error: err } = await supabase.rpc("set_scoring_freeze", {
        p_frozen: true,
        p_reason: freezeReason.trim(),
      });
      if (err) throw new Error(err.message);
      if (!(res as any)?.success) throw new Error("freeze_failed");
      setFreezeModalVisible(false);
      showToast(t("admin.scoring.frozen_toast"), "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setToggling(false);
    }
  };

  const submitUnfreeze = () => {
    Alert.alert(
      t("admin.scoring.unfreeze_confirm_title"),
      t("admin.scoring.unfreeze_confirm_body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.scoring.unfreeze_btn"),
          onPress: async () => {
            setToggling(true);
            try {
              const { data: res, error: err } = await supabase.rpc("set_scoring_freeze", {
                p_frozen: false,
                p_reason: null,
              });
              if (err) throw new Error(err.message);
              if (!(res as any)?.success) throw new Error("unfreeze_failed");
              showToast(t("admin.scoring.unfrozen_toast"), "success");
              await load();
            } catch (e) {
              showToast(e instanceof Error ? e.message : String(e), "error");
            } finally {
              setToggling(false);
            }
          },
        },
      ],
    );
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
        <Text style={styles.headerTitle}>{t("admin.scoring.title")}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading && !data ? (
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
      ) : !data ? null : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentTeal} />
          }
        >
          {/* Card 1 — Pipeline Status */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pulse" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("admin.scoring.status_card_title")}</Text>
              <View
                style={[
                  styles.stateBadge,
                  data.pipeline_status.frozen ? styles.stateBadgeFrozen : styles.stateBadgeActive,
                ]}
              >
                <Ionicons
                  name={data.pipeline_status.frozen ? "snow-outline" : "play-circle-outline"}
                  size={12}
                  color={data.pipeline_status.frozen ? "#991B1B" : colors.successLabel}
                />
                <Text
                  style={[
                    styles.stateBadgeText,
                    { color: data.pipeline_status.frozen ? "#991B1B" : colors.successLabel },
                  ]}
                >
                  {data.pipeline_status.frozen
                    ? t("admin.scoring.state_frozen")
                    : t("admin.scoring.state_active")}
                </Text>
              </View>
            </View>

            {data.pipeline_status.frozen ? (
              <View style={styles.frozenBox}>
                <Text style={styles.frozenLine}>
                  {t("admin.scoring.frozen_by")}:{" "}
                  <Text style={styles.frozenValue}>
                    {data.pipeline_status.frozen_by_name ?? data.pipeline_status.frozen_by ?? "—"}
                  </Text>
                </Text>
                <Text style={styles.frozenLine}>
                  {t("admin.scoring.frozen_at")}:{" "}
                  <Text style={styles.frozenValue}>{fmtRelative(data.pipeline_status.frozen_at)}</Text>
                </Text>
                {data.pipeline_status.frozen_reason ? (
                  <Text style={styles.frozenReason}>
                    "{data.pipeline_status.frozen_reason}"
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t("admin.scoring.last_run")}</Text>
              <Text style={styles.metaValue}>
                {fmtRelative(data.pipeline_status.last_run_at)}
                {data.pipeline_status.last_run_status
                  ? ` · ${data.pipeline_status.last_run_status}`
                  : ""}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t("admin.scoring.next_run")}</Text>
              <Text style={styles.metaValue}>{data.pipeline_status.cron_note}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t("admin.scoring.threshold")}</Text>
              <Text style={styles.metaValue}>{data.pipeline_status.threshold.toFixed(2)}</Text>
            </View>

            {canFreeze ? (
              data.pipeline_status.frozen ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionUnfreeze, toggling && styles.actionDisabled]}
                  onPress={submitUnfreeze}
                  disabled={toggling}
                  accessibilityRole="button"
                >
                  <Ionicons name="play" size={14} color="#FFFFFF" />
                  <Text style={styles.actionText}>{t("admin.scoring.unfreeze_btn")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionFreeze, toggling && styles.actionDisabled]}
                  onPress={openFreezeModal}
                  disabled={toggling}
                  accessibilityRole="button"
                >
                  <Ionicons name="snow" size={14} color="#FFFFFF" />
                  <Text style={styles.actionText}>{t("admin.scoring.freeze_btn")}</Text>
                </TouchableOpacity>
              )
            ) : (
              <Text style={styles.readonlyNote}>{t("admin.scoring.readonly_note")}</Text>
            )}
          </View>

          {/* Card 2 — Biggest deltas */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-up" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.scoring.deltas_card_title", { threshold: data.pipeline_status.threshold.toFixed(0) })}
              </Text>
            </View>
            {data.biggest_deltas.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.scoring.deltas_empty", { threshold: data.pipeline_status.threshold.toFixed(0) })}
              </Text>
            ) : (
              data.biggest_deltas.map((row) => (
                <View key={row.user_id} style={styles.deltaRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deltaName} numberOfLines={1}>{row.display_name}</Text>
                    <Text style={styles.deltaSub}>
                      {row.previous_score.toFixed(2)} → {row.total_score.toFixed(2)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.deltaBadge,
                      row.delta >= 0 ? styles.deltaBadgePos : styles.deltaBadgeNeg,
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaBadgeText,
                        { color: row.delta >= 0 ? colors.successLabel : "#991B1B" },
                      ]}
                    >
                      {fmtDelta(row.delta)}
                    </Text>
                  </View>
                  {canFreeze ? (
                    <TouchableOpacity
                      style={styles.overrideBtn}
                      onPress={() => openOverrideModal(row)}
                      accessibilityRole="button"
                    >
                      <Ionicons name="create-outline" size={14} color={colors.primaryNavy} />
                      <Text style={styles.overrideBtnText}>
                        {t("admin.scoring.override_btn")}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>

          {/* Card 2.5 — Active overrides (mig 377) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="hand-left-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.scoring.overrides_card_title", { count: overrides.length })}
              </Text>
            </View>
            {overrides.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.scoring.overrides_empty")}</Text>
            ) : (
              overrides.map((o) => {
                const isRemoving = removingOverride === o.id;
                return (
                  <View
                    key={o.id}
                    style={[styles.overrideRow, o.is_expired && styles.overrideRowExpired]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.overrideName} numberOfLines={1}>
                        {o.member_name}
                        {o.is_expired ? (
                          <Text style={styles.overrideExpiredTag}>
                            {"  "}
                            {t("admin.scoring.overrides_expired_tag")}
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={styles.overrideSub}>
                        {o.old_score.toFixed(2)} → {o.new_score.toFixed(2)} ({fmtDelta(o.delta)})
                        {" · "}
                        {t("admin.scoring.overrides_by", { name: o.admin_name })}
                        {" · "}
                        {fmtRelative(o.created_at)}
                        {o.expires_at
                          ? ` · ${t("admin.scoring.overrides_expires_in")} ${
                              Math.max(
                                0,
                                Math.round(
                                  (new Date(o.expires_at).getTime() - Date.now()) / 86400_000,
                                ),
                              )
                            }d`
                          : ""}
                      </Text>
                      <Text style={styles.overrideReason} numberOfLines={2}>
                        "{o.reason}"
                      </Text>
                    </View>
                    {canFreeze ? (
                      <TouchableOpacity
                        style={[styles.overrideRemoveBtn, isRemoving && styles.actionDisabled]}
                        onPress={() => confirmRemoveOverride(o)}
                        disabled={isRemoving}
                        accessibilityRole="button"
                      >
                        {isRemoving ? (
                          <ActivityIndicator size="small" color="#991B1B" />
                        ) : (
                          <>
                            <Ionicons name="trash-outline" size={14} color="#991B1B" />
                            <Text style={styles.overrideRemoveText}>
                              {t("admin.scoring.overrides_remove_btn")}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {/* Card 2.6 — Recent alerts (mig 378) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="notifications-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("admin.scoring.alerts_card_title")}</Text>
            </View>
            {data.recent_alerts.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.scoring.alerts_empty")}</Text>
            ) : (
              data.recent_alerts.map((a) => (
                <View key={a.id} style={[styles.alertRow, !a.read && styles.alertRowUnread]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.alertBody} numberOfLines={2}>{a.body}</Text>
                    <Text style={styles.alertMeta}>{fmtRelative(a.created_at)}</Text>
                  </View>
                  {!a.read ? <View style={styles.alertDot} /> : null}
                </View>
              ))
            )}
          </View>

          {/* Card 3 — Recent runs */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("admin.scoring.runs_card_title")}</Text>
            </View>
            {data.recent_runs.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.scoring.runs_empty")}</Text>
            ) : (
              data.recent_runs.map((r) => {
                const kind = jobKind(r.job_name);
                const badge = RUN_STATUS_STYLE[r.status] ?? RUN_STATUS_STYLE.success;
                return (
                  <View
                    key={r.id}
                    style={[
                      styles.runRow,
                      kind === "freeze" && styles.runRowFreeze,
                      kind === "unfreeze" && styles.runRowUnfreeze,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.runJob} numberOfLines={1}>
                        {kind === "freeze"
                          ? t("admin.scoring.run_freeze")
                          : kind === "unfreeze"
                          ? t("admin.scoring.run_unfreeze")
                          : t("admin.scoring.run_pipeline")}
                      </Text>
                      <Text style={styles.runMeta}>
                        {kind === "run"
                          ? `${r.records_processed} records · ${r.execution_time_ms ?? 0}ms · ${fmtRelative(r.created_at)}`
                          : fmtRelative(r.created_at)}
                      </Text>
                      {r.details?.skipped ? (
                        <Text style={styles.runNote}>
                          {t("admin.scoring.run_skipped_note")}
                        </Text>
                      ) : null}
                      {r.error_message ? (
                        <Text style={styles.runError} numberOfLines={2}>{r.error_message}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.runBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.runBadgeText, { color: badge.fg }]}>{r.status}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Override modal (mig 377) */}
      <Modal
        visible={overrideTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeOverrideModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="create-outline" size={20} color={colors.primaryNavy} />
              <Text style={styles.modalTitle}>
                {t("admin.scoring.override_modal_title", {
                  name: overrideTarget?.display_name ?? "",
                })}
              </Text>
            </View>
            <Text style={styles.modalBody}>
              {t("admin.scoring.override_modal_body", {
                current: overrideTarget?.current_score.toFixed(2) ?? "—",
              })}
            </Text>

            <Text style={styles.fieldLabel}>{t("admin.scoring.override_new_score_label")}</Text>
            <TextInput
              style={styles.smallInput}
              placeholder={t("admin.scoring.override_new_score_placeholder")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={overrideNewScore}
              onChangeText={setOverrideNewScore}
              editable={!savingOverride}
            />

            <Text style={styles.fieldLabel}>{t("admin.scoring.override_reason_label")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.scoring.override_reason_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={overrideReason}
              onChangeText={setOverrideReason}
              maxLength={500}
              editable={!savingOverride}
            />
            <Text style={styles.charCount}>
              {t("admin.scoring.reason_min_count", {
                current: overrideReason.trim().length,
                min: 20,
              })}
            </Text>

            <Text style={styles.fieldLabel}>{t("admin.scoring.override_days_label")}</Text>
            <TextInput
              style={styles.smallInput}
              placeholder={t("admin.scoring.override_days_placeholder")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={overrideDays}
              onChangeText={setOverrideDays}
              editable={!savingOverride}
            />
            <Text style={styles.fieldHint}>{t("admin.scoring.override_days_hint")}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closeOverrideModal}
                disabled={savingOverride}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalOverrideConfirm,
                  (overrideReason.trim().length < 20 || savingOverride) && styles.actionDisabled,
                ]}
                onPress={submitOverride}
                disabled={overrideReason.trim().length < 20 || savingOverride}
              >
                {savingOverride ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t("admin.scoring.override_save_btn")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Freeze modal */}
      <Modal
        visible={freezeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFreezeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="snow" size={20} color="#991B1B" />
              <Text style={styles.modalTitle}>{t("admin.scoring.freeze_modal_title")}</Text>
            </View>
            <Text style={styles.modalBody}>{t("admin.scoring.freeze_modal_body")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.scoring.freeze_reason_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={freezeReason}
              onChangeText={setFreezeReason}
              maxLength={500}
              editable={!toggling}
            />
            <Text style={styles.charCount}>
              {t("admin.scoring.reason_min_count", {
                current: freezeReason.trim().length,
                min: 20,
              })}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setFreezeModalVisible(false)}
                disabled={toggling}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalConfirm,
                  (freezeReason.trim().length < 20 || toggling) && styles.actionDisabled,
                ]}
                onPress={submitFreeze}
                disabled={freezeReason.trim().length < 20 || toggling}
              >
                {toggling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t("admin.scoring.freeze_btn")}</Text>
                )}
              </TouchableOpacity>
            </View>
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
  scroll: { padding: 12, gap: 12 },
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
  cardTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.primaryNavy },
  stateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  stateBadgeActive: { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0" },
  stateBadgeFrozen: { backgroundColor: colors.errorBg, borderColor: "#FCA5A5" },
  stateBadgeText: { fontSize: 11, fontWeight: "700" },
  frozenBox: {
    backgroundColor: colors.errorBg,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    gap: 3,
  },
  frozenLine: { fontSize: 12, color: colors.textPrimary },
  frozenValue: { fontWeight: "700" },
  frozenReason: {
    marginTop: 4,
    fontSize: 12,
    fontStyle: "italic",
    color: "#991B1B",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  metaLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  metaValue: { fontSize: 12, color: colors.textPrimary, fontWeight: "500" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  actionFreeze: { backgroundColor: "#991B1B" },
  actionUnfreeze: { backgroundColor: colors.primaryNavy },
  actionDisabled: { opacity: 0.6 },
  actionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  readonlyNote: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  deltaName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  deltaSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  deltaBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  deltaBadgePos: { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0" },
  deltaBadgeNeg: { backgroundColor: colors.errorBg, borderColor: "#FCA5A5" },
  deltaBadgeText: { fontSize: 12, fontWeight: "700" },
  runRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  runRowFreeze: { backgroundColor: colors.errorBg },
  runRowUnfreeze: { backgroundColor: "#D1FAE5" },
  runJob: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  runMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  runNote: { fontSize: 11, color: colors.warningLabel, fontStyle: "italic", marginTop: 2 },
  runError: { fontSize: 11, color: colors.errorText, marginTop: 2 },
  runBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  runBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },
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
    maxWidth: 420,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryNavy },
  modalBody: { fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
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
  modalConfirm: { backgroundColor: "#991B1B" },
  modalOverrideConfirm: { backgroundColor: colors.primaryNavy },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "700" },

  overrideBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
    marginLeft: 6,
  },
  overrideBtnText: { fontSize: 11, fontWeight: "700", color: colors.primaryNavy },

  overrideRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  overrideRowExpired: { opacity: 0.55 },
  overrideName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  overrideExpiredTag: { fontSize: 10, fontWeight: "700", color: colors.warningLabel },
  overrideSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  overrideReason: {
    fontSize: 11,
    color: colors.textPrimary,
    fontStyle: "italic",
    marginTop: 3,
  },
  overrideRemoveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    minWidth: 72,
    justifyContent: "center",
  },
  overrideRemoveText: { fontSize: 11, fontWeight: "700", color: "#991B1B" },

  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  alertRowUnread: { backgroundColor: colors.warningBg },
  alertTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  alertBody: { fontSize: 12, color: colors.textPrimary, marginTop: 1 },
  alertMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warningLabel,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginTop: 6,
  },
  fieldHint: { fontSize: 11, color: colors.textSecondary, marginTop: -2 },
  smallInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
});
