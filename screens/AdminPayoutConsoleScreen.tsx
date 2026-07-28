// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminPayoutConsoleScreen.tsx — Doc 39 Phase 2 (mig 379 + 380)
// ═══════════════════════════════════════════════════════════════════════════
//
// Admin operational surface for payouts. Vertical stack (mobile-first;
// Doc 39's three-column ASCII was desktop-flavored):
//
//   1. Header + platform pause banner + super_admin toggle
//   2. Invariant strip — horizontal scroll of closable-circle pills, each
//      showing net balance and a green/red indicator.
//   3. Upcoming (next 7 days) — held / awaiting_approval / scheduled /
//      ready rows with per-row Hold / Release actions.
//   4. In-flight — status IN (executing, processing). Empty until Phase 3
//      EF wiring lands.
//   5. Recent history — completed / failed / reversed / cancelled
//      (last 30d), color-coded.
//
// Data via mig 380 read RPCs + the existing useCircleInvariant hook
// (fanned out per closable circle). Refresh: 5s polling while visible.
//
// Mutations: mig 379's hold_payout (cycle-keyed), release_payout (cycle-
// keyed — works for both held and awaiting_approval; releases the latter
// by writing an approval_granted event), toggle_platform_pause.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const POLL_MS = 5000;
const HOLD_REASON_CODES = [
  "investigation",
  "webhook_delay",
  "documentation_check",
  "other",
] as const;
type HoldReasonCode = (typeof HOLD_REASON_CODES)[number];

interface UpcomingPayout {
  payout_id: string;
  circle_id: string;
  circle_name: string;
  cycle_id: string;
  cycle_number: number | null;
  recipient_id: string;
  recipient_name: string;
  amount: number;
  amount_cents: number | null;
  currency: string;
  status: string;
  expected_date: string | null;
  created_at: string;
  held_at: string | null;
  held_by_admin_id: string | null;
  held_by_name: string | null;
  hold_reason: string | null;
  hold_justification: string | null;
}

interface InFlightPayout {
  payout_id: string;
  circle_id: string;
  circle_name: string;
  cycle_id: string;
  recipient_id: string;
  recipient_name: string;
  amount: number;
  currency: string;
  status: string;
  transfer_id: string | null;
  pending_intent_id: string | null;
  ledger_event_id: string | null;
  created_at: string;
}

interface RecentPayout {
  payout_id: string;
  circle_id: string;
  circle_name: string;
  cycle_id: string;
  cycle_number: number | null;
  recipient_id: string;
  recipient_name: string;
  amount: number;
  amount_cents: number | null;
  currency: string;
  status: string;
  transfer_id: string | null;
  completed_at: string | null;
  actual_date: string | null;
  created_at: string;
  notes: string | null;
}

interface PauseState {
  paused: boolean;
  paused_at: string | null;
  paused_by: string | null;
  paused_by_name: string | null;
  reason: string | null;
}

interface ClosableCircle {
  id: string;
  name: string;
  status: string;
  completed_at: string | null;
}

interface Invariant {
  circle_id: string;
  circle_name: string;
  net_cents: number;
  balanced: boolean;
  contributions_total: number;
  payouts_total: number;
  corrections_total: number;
  status: string;
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

function fmtMoney(amount: number, currency: string): string {
  const cur = (currency ?? "USD").toUpperCase();
  const prefix = cur === "USD" ? "$" : "";
  const suffix = cur === "USD" ? "" : ` ${cur}`;
  return `${prefix}${amount.toFixed(2)}${suffix}`;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  scheduled:         { bg: "#E0F2FE", fg: "#075985" },
  pending:           { bg: "#E0F2FE", fg: "#075985" },
  ready:             { bg: "#DBEAFE", fg: "#1E40AF" },
  held:              { bg: colors.errorBg, fg: "#991B1B" },
  awaiting_approval: { bg: colors.warningBg, fg: colors.warningLabel },
  executing:         { bg: "#FEF3C7", fg: "#92400E" },
  processing:        { bg: "#FEF3C7", fg: "#92400E" },
  completed:         { bg: "#D1FAE5", fg: colors.successLabel },
  failed:            { bg: colors.errorBg, fg: "#991B1B" },
  cancelled:         { bg: "#E2E8F0", fg: "#475569" },
  reversed:          { bg: colors.warningBg, fg: colors.warningLabel },
};

export default function AdminPayoutConsoleScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();
  const canPause = String(scope.role ?? "") === "super_admin";

  const [upcoming, setUpcoming] = useState<UpcomingPayout[]>([]);
  const [inflight, setInflight] = useState<InFlightPayout[]>([]);
  const [recent, setRecent] = useState<RecentPayout[]>([]);
  const [pauseState, setPauseState] = useState<PauseState | null>(null);
  const [closable, setClosable] = useState<ClosableCircle[]>([]);
  const [invariants, setInvariants] = useState<Record<string, Invariant>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hold modal state.
  const [holdTarget, setHoldTarget] = useState<UpcomingPayout | null>(null);
  const [holdReason, setHoldReason] = useState<HoldReasonCode>("investigation");
  const [holdJustification, setHoldJustification] = useState("");
  const [holdMemberNote, setHoldMemberNote] = useState("");
  const [holding, setHolding] = useState(false);

  // Platform pause modal state.
  const [pauseModalVisible, setPauseModalVisible] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseConfirmText, setPauseConfirmText] = useState("");
  const [togglingPause, setTogglingPause] = useState(false);

  const [releasingCycleId, setReleasingCycleId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [upRes, ifRes, rcRes, psRes, ccRes] = await Promise.all([
        supabase.rpc("list_upcoming_payouts", { p_days: 7 }),
        supabase.rpc("list_in_flight_payouts"),
        supabase.rpc("list_recent_payouts", { p_days: 30 }),
        supabase.rpc("get_platform_pause_state"),
        supabase.rpc("list_closable_circles_for_invariant_strip"),
      ]);
      if (upRes.error) throw new Error(upRes.error.message);
      if (ifRes.error) throw new Error(ifRes.error.message);
      if (rcRes.error) throw new Error(rcRes.error.message);
      if (psRes.error) throw new Error(psRes.error.message);
      if (ccRes.error) throw new Error(ccRes.error.message);

      setUpcoming((upRes.data as UpcomingPayout[]) ?? []);
      setInflight((ifRes.data as InFlightPayout[]) ?? []);
      setRecent((rcRes.data as RecentPayout[]) ?? []);
      setPauseState(psRes.data as PauseState);
      const cc = (ccRes.data as ClosableCircle[]) ?? [];
      setClosable(cc);

      // Fan out invariant calls in parallel — one per closable circle.
      if (cc.length > 0) {
        const invRes = await Promise.all(
          cc.map((c) =>
            supabase.rpc("get_circle_invariant", { p_circle_id: c.id }),
          ),
        );
        const nextInv: Record<string, Invariant> = {};
        cc.forEach((c, i) => {
          const inv = invRes[i]?.data as Invariant | null;
          if (inv) nextInv[c.id] = inv;
        });
        setInvariants(nextInv);
      } else {
        setInvariants({});
      }

      setLastFetchAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  // 5s polling while the screen is mounted + admin.
  useEffect(() => {
    if (!isAdmin) return;
    pollRef.current = setInterval(() => {
      load(true);
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAdmin, load]);

  const onRefresh = async () => {
    await load(true);
  };

  // ── Hold flow ──────────────────────────────────────────────────────────
  const openHoldModal = (p: UpcomingPayout) => {
    setHoldTarget(p);
    setHoldReason("investigation");
    setHoldJustification("");
    setHoldMemberNote("");
  };
  const closeHoldModal = () => {
    setHoldTarget(null);
    setHoldReason("investigation");
    setHoldJustification("");
    setHoldMemberNote("");
  };

  const submitHold = async () => {
    if (!holdTarget) return;
    if (holdJustification.trim().length < 20) return;
    setHolding(true);
    const args = {
      p_cycle_id: holdTarget.cycle_id,
      p_reason_code: holdReason,
      p_justification: holdJustification.trim(),
      p_member_facing_note: holdMemberNote.trim() || null,
    };
    // eslint-disable-next-line no-console
    if (__DEV__) console.log("[AdminPayoutConsole] hold_payout args:", args);
    try {
      const { data, error: err } = await supabase.rpc("hold_payout", args);
      // eslint-disable-next-line no-console
      if (__DEV__) console.log("[AdminPayoutConsole] hold_payout resp:", { data, err });
      if (err) throw new Error(err.message);
      if (!(data as any)?.success) throw new Error("hold_failed");
      showToast(t("admin.payout_console.hold_toast"), "success");
      closeHoldModal();
      await load(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // In-modal error path uses Alert.alert — showToast renders under the
      // Modal's z-layer on React Native and users see nothing.
      Alert.alert(t("admin.payout_console.hold_error_title"), msg);
    } finally {
      setHolding(false);
    }
  };

  // ── Release / Approve flow ─────────────────────────────────────────────
  const doRelease = (p: UpcomingPayout) => {
    const isApproval = p.status === "awaiting_approval";
    Alert.alert(
      isApproval
        ? t("admin.payout_console.approve_confirm_title")
        : t("admin.payout_console.release_confirm_title"),
      isApproval
        ? t("admin.payout_console.approve_confirm_body", { name: p.recipient_name })
        : t("admin.payout_console.release_confirm_body", { name: p.recipient_name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: isApproval
            ? t("admin.payout_console.approve_btn")
            : t("admin.payout_console.release_btn"),
          onPress: async () => {
            setReleasingCycleId(p.cycle_id);
            try {
              const { data, error: err } = await supabase.rpc("release_payout", {
                p_cycle_id: p.cycle_id,
              });
              if (err) throw new Error(err.message);
              if (!(data as any)?.success) throw new Error("release_failed");
              showToast(
                isApproval
                  ? t("admin.payout_console.approved_toast")
                  : t("admin.payout_console.released_toast"),
                "success",
              );
              await load(true);
            } catch (e) {
              showToast(e instanceof Error ? e.message : String(e), "error");
            } finally {
              setReleasingCycleId(null);
            }
          },
        },
      ],
    );
  };

  // ── Platform pause flow ────────────────────────────────────────────────
  const openPauseModal = () => {
    setPauseReason("");
    setPauseConfirmText("");
    setPauseModalVisible(true);
  };
  const closePauseModal = () => {
    setPauseModalVisible(false);
  };

  const submitActivatePause = async () => {
    if (pauseReason.trim().length < 50) return;
    if (pauseConfirmText.trim() !== "PAUSE") return;
    setTogglingPause(true);
    const args = { p_activate: true, p_reason: pauseReason.trim() };
    // eslint-disable-next-line no-console
    if (__DEV__) console.log("[AdminPayoutConsole] toggle_platform_pause args:", args);
    try {
      const { data, error: err } = await supabase.rpc("toggle_platform_pause", args);
      // eslint-disable-next-line no-console
      if (__DEV__) console.log("[AdminPayoutConsole] toggle_platform_pause resp:", { data, err });
      if (err) throw new Error(err.message);
      if (!(data as any)?.success) throw new Error("pause_failed");
      showToast(t("admin.payout_console.paused_toast"), "success");
      closePauseModal();
      await load(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t("admin.payout_console.pause_error_title"), msg);
    } finally {
      setTogglingPause(false);
    }
  };

  const confirmUnpause = () => {
    Alert.alert(
      t("admin.payout_console.unpause_confirm_title"),
      t("admin.payout_console.unpause_confirm_body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.payout_console.unpause_btn"),
          onPress: async () => {
            setTogglingPause(true);
            try {
              const { data, error: err } = await supabase.rpc(
                "toggle_platform_pause",
                { p_activate: false, p_reason: null },
              );
              if (err) throw new Error(err.message);
              if (!(data as any)?.success) throw new Error("unpause_failed");
              showToast(t("admin.payout_console.unpaused_toast"), "success");
              await load(true);
            } catch (e) {
              showToast(e instanceof Error ? e.message : String(e), "error");
            } finally {
              setTogglingPause(false);
            }
          },
        },
      ],
    );
  };

  const holdCount = useMemo(
    () => upcoming.filter((p) => p.status === "held").length,
    [upcoming],
  );
  const approvalCount = useMemo(
    () => upcoming.filter((p) => p.status === "awaiting_approval").length,
    [upcoming],
  );

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
        <Text style={styles.headerTitle}>
          {t("admin.payout_console.title")}
          {holdCount + approvalCount > 0 ? ` (${holdCount + approvalCount})` : ""}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {loading && !upcoming.length && !recent.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentTeal} />
          }
        >
          {/* Card 1 — Platform pause status + toggle */}
          <View
            style={[
              styles.card,
              pauseState?.paused ? styles.cardPaused : null,
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name={pauseState?.paused ? "pause-circle" : "play-circle-outline"}
                size={16}
                color={pauseState?.paused ? "#991B1B" : colors.primaryNavy}
              />
              <Text style={styles.cardTitle}>{t("admin.payout_console.pause_card_title")}</Text>
              <View
                style={[
                  styles.stateBadge,
                  pauseState?.paused ? styles.stateBadgePaused : styles.stateBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.stateBadgeText,
                    { color: pauseState?.paused ? "#991B1B" : colors.successLabel },
                  ]}
                >
                  {pauseState?.paused
                    ? t("admin.payout_console.state_paused")
                    : t("admin.payout_console.state_active")}
                </Text>
              </View>
            </View>

            {pauseState?.paused ? (
              <View style={styles.pausedBox}>
                <Text style={styles.pausedLine}>
                  {t("admin.payout_console.paused_by")}:{" "}
                  <Text style={styles.pausedValue}>
                    {pauseState.paused_by_name ?? pauseState.paused_by ?? "—"}
                  </Text>
                </Text>
                <Text style={styles.pausedLine}>
                  {t("admin.payout_console.paused_at")}:{" "}
                  <Text style={styles.pausedValue}>{fmtRelative(pauseState.paused_at)}</Text>
                </Text>
                {pauseState.reason ? (
                  <Text style={styles.pausedReason}>"{pauseState.reason}"</Text>
                ) : null}
              </View>
            ) : null}

            {canPause ? (
              pauseState?.paused ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionUnpause, togglingPause && styles.actionDisabled]}
                  onPress={confirmUnpause}
                  disabled={togglingPause}
                >
                  <Ionicons name="play" size={14} color="#FFFFFF" />
                  <Text style={styles.actionText}>{t("admin.payout_console.unpause_btn")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionPause, togglingPause && styles.actionDisabled]}
                  onPress={openPauseModal}
                  disabled={togglingPause}
                >
                  <Ionicons name="pause" size={14} color="#FFFFFF" />
                  <Text style={styles.actionText}>{t("admin.payout_console.pause_btn")}</Text>
                </TouchableOpacity>
              )
            ) : (
              <Text style={styles.readonlyNote}>{t("admin.payout_console.readonly_note")}</Text>
            )}

            {lastFetchAt ? (
              <Text style={styles.lastUpdated}>
                {t("admin.payout_console.last_updated", { rel: fmtRelative(lastFetchAt.toISOString()) })}
              </Text>
            ) : null}
          </View>

          {/* Card 2 — Invariant strip (horizontal scroll) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="git-merge-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("admin.payout_console.invariants_title")}</Text>
            </View>
            {closable.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.payout_console.invariants_empty")}</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {closable.map((c) => {
                  const inv = invariants[c.id];
                  const net = inv ? inv.net_cents / 100 : 0;
                  const balanced = inv?.balanced ?? false;
                  return (
                    <View
                      key={c.id}
                      style={[styles.invPill, balanced ? styles.invPillOk : styles.invPillBad]}
                    >
                      <Text style={styles.invName} numberOfLines={1}>{c.name}</Text>
                      <Text
                        style={[
                          styles.invNet,
                          { color: balanced ? colors.successLabel : "#991B1B" },
                        ]}
                      >
                        {net >= 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}
                        {balanced ? " ✓" : " ⚠"}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Card 3 — Upcoming (7d) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.payout_console.upcoming_title", { count: upcoming.length })}
              </Text>
            </View>
            {upcoming.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.payout_console.upcoming_empty")}</Text>
            ) : (
              upcoming.map((p) => {
                const badge = STATUS_STYLE[p.status] ?? STATUS_STYLE.scheduled;
                const isActing = releasingCycleId === p.cycle_id;
                const canRelease = p.status === "held" || p.status === "awaiting_approval";
                const canHold = !canRelease && p.status !== "completed";
                return (
                  <View key={p.payout_id ?? p.cycle_id} style={styles.payoutRow}>
                    <View style={styles.payoutRowMain}>
                      <View style={styles.payoutRowHeader}>
                        <Text style={styles.payoutCircle} numberOfLines={1}>{p.circle_name}</Text>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.fg }]}>
                            {p.status.replace(/_/g, " ")}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.payoutSub}>
                        {p.recipient_name} · {fmtMoney(p.amount, p.currency)}
                        {p.cycle_number != null ? ` · cycle ${p.cycle_number}` : ""}
                      </Text>
                      <Text style={styles.payoutMeta}>
                        {p.expected_date
                          ? t("admin.payout_console.due", { date: p.expected_date })
                          : t("admin.payout_console.no_date")}
                        {" · "}
                        {fmtRelative(p.created_at)}
                      </Text>
                      {p.hold_reason ? (
                        <View style={styles.holdInfo}>
                          <Ionicons name="pause-circle-outline" size={11} color="#991B1B" />
                          <Text style={styles.holdText} numberOfLines={2}>
                            {p.hold_reason}
                            {p.held_by_name ? ` · ${p.held_by_name}` : ""}
                            {p.held_at ? ` · ${fmtRelative(p.held_at)}` : ""}
                          </Text>
                        </View>
                      ) : null}
                      {p.hold_justification ? (
                        <Text style={styles.holdJustification} numberOfLines={2}>
                          "{p.hold_justification}"
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.payoutRowActions}>
                      {canRelease ? (
                        <TouchableOpacity
                          style={[styles.rowActionBtn, styles.rowActionPrimary, isActing && styles.actionDisabled]}
                          onPress={() => doRelease(p)}
                          disabled={isActing}
                        >
                          {isActing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.rowActionPrimaryText}>
                              {p.status === "awaiting_approval"
                                ? t("admin.payout_console.approve_btn")
                                : t("admin.payout_console.release_btn")}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                      {canHold ? (
                        <TouchableOpacity
                          style={[styles.rowActionBtn, styles.rowActionHold]}
                          onPress={() => openHoldModal(p)}
                        >
                          <Text style={styles.rowActionHoldText}>{t("admin.payout_console.hold_btn")}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Card 4 — In-flight */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pulse" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.payout_console.inflight_title", { count: inflight.length })}
              </Text>
            </View>
            {inflight.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.payout_console.inflight_empty")}</Text>
            ) : (
              inflight.map((p) => {
                const badge = STATUS_STYLE[p.status] ?? STATUS_STYLE.processing;
                return (
                  <View key={p.payout_id} style={styles.simpleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payoutCircle} numberOfLines={1}>{p.circle_name}</Text>
                      <Text style={styles.payoutSub}>
                        {p.recipient_name} · {fmtMoney(p.amount, p.currency)}
                      </Text>
                      <Text style={styles.payoutMeta}>
                        {p.transfer_id ? `transfer ${p.transfer_id.slice(0, 12)}…` : t("admin.payout_console.no_transfer")}
                        {" · "}
                        {fmtRelative(p.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{p.status}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Card 5 — Recent history */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.payout_console.recent_title", { count: recent.length })}
              </Text>
            </View>
            {recent.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.payout_console.recent_empty")}</Text>
            ) : (
              recent.map((p) => {
                const badge = STATUS_STYLE[p.status] ?? STATUS_STYLE.completed;
                return (
                  <View key={p.payout_id} style={styles.simpleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payoutCircle} numberOfLines={1}>{p.circle_name}</Text>
                      <Text style={styles.payoutSub}>
                        {p.recipient_name} · {fmtMoney(p.amount, p.currency)}
                        {p.cycle_number != null ? ` · cycle ${p.cycle_number}` : ""}
                      </Text>
                      <Text style={styles.payoutMeta}>
                        {fmtRelative(p.completed_at ?? p.created_at)}
                        {p.transfer_id ? ` · ${p.transfer_id.slice(0, 12)}…` : ""}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{p.status}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Hold modal */}
      <Modal
        visible={holdTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeHoldModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="pause-circle" size={20} color="#991B1B" />
              <Text style={styles.modalTitle}>
                {t("admin.payout_console.hold_modal_title", {
                  name: holdTarget?.recipient_name ?? "",
                })}
              </Text>
            </View>
            <Text style={styles.modalBody}>
              {t("admin.payout_console.hold_modal_body", {
                circle: holdTarget?.circle_name ?? "",
                amount: holdTarget ? fmtMoney(holdTarget.amount, holdTarget.currency) : "",
              })}
            </Text>

            <Text style={styles.fieldLabel}>{t("admin.payout_console.reason_code_label")}</Text>
            <View style={styles.reasonRow}>
              {HOLD_REASON_CODES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.reasonPill,
                    holdReason === r && styles.reasonPillActive,
                  ]}
                  onPress={() => setHoldReason(r)}
                >
                  <Text
                    style={[
                      styles.reasonPillText,
                      holdReason === r && styles.reasonPillTextActive,
                    ]}
                  >
                    {t(`admin.payout_console.reason_${r}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t("admin.payout_console.justification_label")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.payout_console.justification_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={holdJustification}
              onChangeText={setHoldJustification}
              maxLength={500}
              editable={!holding}
            />
            <Text style={styles.charCount}>
              {t("admin.payout_console.reason_min_count", {
                current: holdJustification.trim().length,
                min: 20,
              })}
            </Text>

            <Text style={styles.fieldLabel}>{t("admin.payout_console.member_note_label")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.payout_console.member_note_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={holdMemberNote}
              onChangeText={setHoldMemberNote}
              maxLength={300}
              editable={!holding}
            />
            <Text style={styles.fieldHint}>{t("admin.payout_console.member_note_hint")}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closeHoldModal}
                disabled={holding}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalConfirmDanger,
                  (holdJustification.trim().length < 20 || holding) && styles.actionDisabled,
                ]}
                onPress={submitHold}
                disabled={holdJustification.trim().length < 20 || holding}
              >
                {holding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t("admin.payout_console.hold_btn")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {!holding && holdJustification.trim().length < 20 ? (
              <Text style={styles.disabledHint}>
                {t("admin.payout_console.hint_justification_20")}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Platform pause modal */}
      <Modal
        visible={pauseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePauseModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="pause-circle" size={20} color="#991B1B" />
              <Text style={styles.modalTitle}>{t("admin.payout_console.pause_modal_title")}</Text>
            </View>
            <Text style={styles.modalBody}>{t("admin.payout_console.pause_modal_body")}</Text>

            <Text style={styles.fieldLabel}>{t("admin.payout_console.pause_reason_label")}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t("admin.payout_console.pause_reason_placeholder")}
              placeholderTextColor={colors.textSecondary}
              multiline
              value={pauseReason}
              onChangeText={setPauseReason}
              maxLength={1000}
              editable={!togglingPause}
            />
            <Text style={styles.charCount}>
              {t("admin.payout_console.reason_min_count", {
                current: pauseReason.trim().length,
                min: 50,
              })}
            </Text>

            <Text style={styles.fieldLabel}>{t("admin.payout_console.pause_confirm_label")}</Text>
            <TextInput
              style={styles.smallInput}
              placeholder="PAUSE"
              placeholderTextColor={colors.textSecondary}
              value={pauseConfirmText}
              onChangeText={setPauseConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!togglingPause}
            />
            <Text style={styles.fieldHint}>{t("admin.payout_console.pause_confirm_hint")}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closePauseModal}
                disabled={togglingPause}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalConfirmDanger,
                  (pauseReason.trim().length < 50 ||
                    pauseConfirmText.trim() !== "PAUSE" ||
                    togglingPause) &&
                    styles.actionDisabled,
                ]}
                onPress={submitActivatePause}
                disabled={
                  pauseReason.trim().length < 50 ||
                  pauseConfirmText.trim() !== "PAUSE" ||
                  togglingPause
                }
              >
                {togglingPause ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t("admin.payout_console.pause_btn")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {!togglingPause &&
            (pauseReason.trim().length < 50 || pauseConfirmText.trim() !== "PAUSE") ? (
              <Text style={styles.disabledHint}>
                {[
                  pauseReason.trim().length < 50
                    ? t("admin.payout_console.hint_reason_50")
                    : null,
                  pauseConfirmText.trim() !== "PAUSE"
                    ? t("admin.payout_console.hint_type_pause")
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
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  scroll: { padding: 12 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  cardPaused: { borderColor: "#FCA5A5", borderWidth: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
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
  stateBadgePaused: { backgroundColor: colors.errorBg, borderColor: "#FCA5A5" },
  stateBadgeText: { fontSize: 11, fontWeight: "700" },
  pausedBox: {
    backgroundColor: colors.errorBg,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    gap: 3,
  },
  pausedLine: { fontSize: 12, color: colors.textPrimary },
  pausedValue: { fontWeight: "700" },
  pausedReason: { marginTop: 4, fontSize: 12, fontStyle: "italic", color: "#991B1B" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  actionPause: { backgroundColor: "#991B1B" },
  actionUnpause: { backgroundColor: colors.primaryNavy },
  actionDisabled: { opacity: 0.6 },
  actionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  readonlyNote: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
  },
  lastUpdated: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
  },
  invPill: {
    minWidth: 130,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  invPillOk:  { borderColor: "#A7F3D0", backgroundColor: "#F0FDF4" },
  invPillBad: { borderColor: "#FCA5A5", backgroundColor: colors.errorBg },
  invName: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  invNet: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  payoutRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  payoutRowMain: { gap: 3 },
  payoutRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  payoutCircle: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginRight: 6 },
  payoutSub: { fontSize: 12, color: colors.textPrimary },
  payoutMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  holdInfo: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  holdText: { flex: 1, fontSize: 11, color: "#991B1B", fontWeight: "600" },
  holdJustification: {
    fontSize: 11,
    color: colors.textPrimary,
    fontStyle: "italic",
    marginTop: 2,
  },
  payoutRowActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  rowActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 84,
  },
  rowActionPrimary: { backgroundColor: colors.primaryNavy },
  rowActionPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  rowActionHold: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: "#FCA5A5" },
  rowActionHoldText: { color: "#991B1B", fontSize: 12, fontWeight: "700" },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
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
    maxWidth: 460,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 18,
    gap: 8,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.primaryNavy },
  modalBody: { fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
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
  smallInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.primaryNavy, marginTop: 6 },
  fieldHint: { fontSize: 11, color: colors.textSecondary },
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
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  reasonPillActive: { backgroundColor: colors.primaryNavy, borderColor: colors.primaryNavy },
  reasonPillText: { fontSize: 11, fontWeight: "700", color: colors.textPrimary },
  reasonPillTextActive: { color: "#FFFFFF" },
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
  modalConfirmDanger: { backgroundColor: "#991B1B" },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "700" },
});
