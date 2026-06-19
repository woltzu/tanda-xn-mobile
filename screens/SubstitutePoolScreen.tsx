// ═══════════════════════════════════════════════════════════════════════════════
// SubstitutePoolScreen — feat(substitute) Bucket A rewrite.
// ═══════════════════════════════════════════════════════════════════════════════
//
// Three sections, each driven by its OWN hook and OWN spinner / empty state.
// No more screen-wide setLoading gate, no more 30-second tick re-rendering
// the entire scroll view.
//
//   Member section (always visible):
//     * usePoolEligibility(userId) → Trusted-tier + completed-circle gates
//     * usePoolEntry(userId)       → current pool entry + realtime
//     * Opt-in form when eligible & not in pool; preferences editor when in.
//     * Leave Pool → useSubstituteMemberActions().leavePool.
//
//   Pending offers (always visible):
//     * usePendingOffers(userId)   → enriched offers (circle + names + cycles)
//                                    + realtime subscription on substitution_records.
//     * Accept → confirmSubstitution; Decline → declineSubstitution.
//
//   Admin section (only when adminItems is non-empty):
//     * useAdminSubstitutionQueue(userId) → cross-circle admin_pending list +
//                                            realtime per moderated circle.
//     * Approve → adminApprove; Decline → adminDecline.
//
// Each card uses an inline <Countdown> child that owns its own setInterval,
// so the screen's other cards don't re-render on countdown ticks.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  usePoolEligibility,
  usePoolEntry,
  usePendingOffers,
  useAdminSubstitutionQueue,
  useSubstituteMemberActions,
  type PoolStatus,
} from "../hooks/useSubstituteMember";

// Bucket B — HelpSheet topics (one sheet, all four topics rendered in
// sequence), plus the AsyncStorage gate for the first-visit coach mark
// and the tab keys for the tabified layout.
type HelpTopic =
  | "how_pool"
  | "commitment"
  | "reliability"
  | "decline_consequences";

const POOL_COACH_KEY = "@tandaxn_substitute_pool_coach_seen_v1";

type TabKey = "membership" | "offers" | "admin";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

function fmtCountdown(hours: number): string {
  if (hours < 1) {
    const mins = Math.max(0, Math.round(hours * 60));
    return `${mins}m`;
  }
  if (hours < 24) {
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  }
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
}

// ── Countdown ──────────────────────────────────────────────────────────────
// Self-contained countdown that owns its own ticker. Re-renders just
// itself (not the whole screen). Replaces the legacy `tick` useState
// pattern that re-rendered every card on every interval.
function Countdown({
  deadlineIso,
  warningHoursThreshold,
  prefixKey,
}: {
  deadlineIso: string;
  warningHoursThreshold?: number;
  prefixKey?: string;
}) {
  const { t } = useTranslation();
  const compute = useCallback(
    () =>
      Math.max(0, (new Date(deadlineIso).getTime() - Date.now()) / 3_600_000),
    [deadlineIso],
  );
  const [hours, setHours] = useState(compute);
  useEffect(() => {
    setHours(compute());
    const id = setInterval(() => setHours(compute()), 30_000);
    return () => clearInterval(id);
  }, [compute]);
  const warn = warningHoursThreshold != null && hours < warningHoursThreshold;
  return (
    <View style={[styles.badge, warn ? styles.badgeOrange : styles.badgeBlue]}>
      <Text style={styles.badgeText}>
        {prefixKey ? `${t(prefixKey)} ` : ""}
        {fmtCountdown(hours)}
      </Text>
    </View>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SubstitutePoolScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
    eligibility,
    loading: eligibilityLoading,
    refresh: refreshEligibility,
    xnScore,
    completedCircles,
    eligible,
  } = usePoolEligibility(userId);
  const {
    entry: poolEntry,
    loading: entryLoading,
    refresh: refreshEntry,
    isInPool,
    declinesRemaining,
    successRate,
  } = usePoolEntry(userId);
  const {
    offers,
    loading: offersLoading,
    refresh: refreshOffers,
  } = usePendingOffers(userId);
  const {
    items: adminItems,
    loading: adminLoading,
    refresh: refreshAdmin,
  } = useAdminSubstitutionQueue(userId);
  const actions = useSubstituteMemberActions();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [formStatus, setFormStatus] = useState<PoolStatus>("active");
  const [formMaxContrib, setFormMaxContrib] = useState<string>("0");
  const [formLanguage, setFormLanguage] = useState<string>("en");
  const [savingForm, setSavingForm] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Bucket B — tabs, sheets, coach mark.
  const [activeTab, setActiveTab] = useState<TabKey>("membership");
  const [helpOpen, setHelpOpen] = useState(false);
  const [reliabilityOpen, setReliabilityOpen] = useState(false);
  const [declineBudgetOpen, setDeclineBudgetOpen] = useState(false);
  const showAdminTab = adminItems.length > 0;
  // If the admin tab disappears (e.g. queue emptied while user was on it),
  // bounce them back to a tab that's still visible.
  useEffect(() => {
    if (activeTab === "admin" && !showAdminTab) {
      setActiveTab("membership");
    }
  }, [activeTab, showAdminTab]);

  // First-visit coach mark — AsyncStorage-gated, fades in on mount,
  // auto-dismisses after 4s or on tap. Same pattern as Insurance Pool
  // Bucket B's POOL_COACH_KEY.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(POOL_COACH_KEY);
        if (seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      } catch {
        // AsyncStorage unavailable → silently skip.
      }
    })();
  }, [coachOpacity]);
  const dismissCoach = useCallback(() => {
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(POOL_COACH_KEY, "1").catch(() => undefined);
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  // Hydrate form whenever the pool entry refreshes.
  useEffect(() => {
    if (poolEntry) {
      setFormStatus(poolEntry.status);
      setFormMaxContrib(
        ((poolEntry.maxContributionAmountCents ?? 0) / 100).toString(),
      );
      setFormLanguage(poolEntry.preferredLanguages?.[0] ?? "en");
    }
  }, [poolEntry]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshEligibility(),
      refreshEntry(),
      refreshOffers(),
      refreshAdmin(),
    ]);
    setRefreshing(false);
  }, [refreshEligibility, refreshEntry, refreshOffers, refreshAdmin]);

  // ── Pool actions ──────────────────────────────────────────────────────────
  const saveForm = async () => {
    if (!userId) return;
    const maxCents = Math.max(0, Math.round(Number(formMaxContrib) * 100));
    if (Number.isNaN(maxCents)) {
      Alert.alert(
        t("substitute_pool_v2.alert_invalid_title"),
        t("substitute_pool_v2.alert_invalid_body"),
      );
      return;
    }
    setSavingForm(true);
    try {
      const prefs = {
        status: formStatus,
        maxContributionAmountCents: maxCents,
        preferredLanguages: [formLanguage],
      };
      const result = isInPool
        ? await actions.updatePreferences(userId, prefs)
        : await actions.optIntoPool(userId, prefs);
      if (!result.success) {
        Alert.alert(
          isInPool
            ? t("substitute_pool_v2.alert_could_not_update")
            : t("substitute_pool_v2.alert_could_not_join"),
          result.error ?? "",
        );
        return;
      }
      setEditing(false);
      refreshEntry();
    } finally {
      setSavingForm(false);
    }
  };

  const leavePool = () => {
    if (!userId) return;
    Alert.alert(
      t("substitute_pool.alert_leave_title"),
      t("substitute_pool.alert_leave_body"),
      [
        { text: t("substitute_pool.alert_leave_cancel"), style: "cancel" },
        {
          text: t("substitute_pool.alert_leave_confirm"),
          style: "destructive",
          onPress: async () => {
            const result = await actions.leavePool(userId);
            if (!result.success) {
              Alert.alert(
                t("substitute_pool_v2.alert_could_not_leave"),
                result.error ?? "",
              );
              return;
            }
            refreshEntry();
          },
        },
      ],
    );
  };

  // ── Offer actions ─────────────────────────────────────────────────────────
  const respond = async (offerId: string, action: "accept" | "decline") => {
    if (!userId) return;
    setBusyOfferId(offerId);
    try {
      const result =
        action === "accept"
          ? await actions.confirmSubstitution(offerId, userId)
          : await actions.declineSubstitution(offerId, userId);
      if (!result.success) {
        Alert.alert(
          t("substitute_pool_v2.alert_could_not_respond"),
          result.error ?? t("substitute_pool_v2.alert_unknown_error"),
        );
        return;
      }
      refreshOffers();
      refreshEntry();
    } catch (err: any) {
      Alert.alert(
        t("substitute_pool_v2.alert_could_not_respond"),
        err?.message ?? t("substitute_pool_v2.alert_unknown_error"),
      );
    } finally {
      setBusyOfferId(null);
    }
  };

  // ── Admin actions ─────────────────────────────────────────────────────────
  const adminAct = async (recordId: string, action: "approve" | "decline") => {
    setBusyAdminId(recordId);
    try {
      const result =
        action === "approve"
          ? await actions.adminApprove(recordId)
          : await actions.adminDecline(recordId);
      if (!result.success) {
        Alert.alert(
          t("substitute_pool_v2.alert_could_not_respond"),
          result.error ?? t("substitute_pool_v2.alert_unknown_error"),
        );
        return;
      }
      refreshAdmin();
    } catch (err: any) {
      Alert.alert(
        t("substitute_pool_v2.alert_could_not_respond"),
        err?.message ?? t("substitute_pool_v2.alert_unknown_error"),
      );
    } finally {
      setBusyAdminId(null);
    }
  };

  // ── Renderers ─────────────────────────────────────────────────────────────

  const renderEligibility = () => {
    if (eligibilityLoading && !eligibility) {
      return (
        <View style={styles.sectionSpinner}>
          <ActivityIndicator color="#2563EB" />
        </View>
      );
    }
    if (!eligibility) return null;
    const okGate = eligible || isInPool;
    const color = okGate ? "#10B981" : "#F59E0B";
    return (
      <View
        style={[styles.card, { borderLeftWidth: 4, borderLeftColor: color }]}
      >
        <Text style={styles.cardTitle}>
          {t("substitute_pool_v2.card_eligibility")}
        </Text>
        <View style={styles.row}>
          <Text style={styles.label}>
            {t("substitute_pool_v2.label_xnscore")}
          </Text>
          <Text style={styles.value}>
            {xnScore}
            {xnScore >= 60
              ? " ✓"
              : t("substitute_pool.eligibility_xnscore_need")}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>
            {t("substitute_pool_v2.label_completed_circles")}
          </Text>
          <Text style={styles.value}>
            {completedCircles}
            {completedCircles >= 1
              ? " ✓"
              : t("substitute_pool.eligibility_circles_need")}
          </Text>
        </View>
        {!eligible && !isInPool && eligibility.reason && (
          <Text style={styles.helpText}>{eligibility.reason}</Text>
        )}
      </View>
    );
  };

  const renderPoolEntry = () => {
    if (entryLoading && !poolEntry) {
      return (
        <View style={styles.sectionSpinner}>
          <ActivityIndicator color="#2563EB" />
        </View>
      );
    }
    if (!isInPool) return null;
    const entry = poolEntry!;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {t("substitute_pool_v2.card_in_pool")}
          </Text>
          <View
            style={[
              styles.badge,
              entry.status === "active" && styles.badgeGreen,
              entry.status === "standby" && styles.badgeBlue,
              entry.status === "suspended" && styles.badgeOrange,
            ]}
          >
            <Text style={styles.badgeText}>
              {t(`substitute_pool.status_${entry.status}`)}
            </Text>
          </View>
        </View>
        {/* Bucket B — reliability row is tappable; opens the explainer. */}
        <TouchableOpacity
          style={styles.rowTappable}
          onPress={() => setReliabilityOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("substitute_pool.reliability_explainer_open")}
        >
          <View style={styles.labelWithIcon}>
            <Text style={styles.label}>
              {t("substitute_pool_v2.label_reliability")}
            </Text>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#6B7280"
              style={{ marginLeft: 4 }}
            />
          </View>
          <Text style={styles.value}>
            {entry.substituteReliabilityScore.toFixed(2)}
          </Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.label}>
            {t("substitute_pool_v2.label_total_substitutions")}
          </Text>
          <Text style={styles.value}>{entry.totalSubstitutions}</Text>
        </View>
        {entry.totalSubstitutions > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("substitute_pool_v2.label_success_rate")}
            </Text>
            <Text style={styles.value}>{successRate}%</Text>
          </View>
        )}
        {/* Bucket B — (?) next to declines remaining opens DeclineBudgetSheet. */}
        <View style={styles.row}>
          <View style={styles.labelWithIcon}>
            <Text style={styles.label}>
              {t("substitute_pool.label_declines_remaining")}
            </Text>
            <TouchableOpacity
              onPress={() => setDeclineBudgetOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t(
                "substitute_pool.decline_budget_explainer_open",
              )}
            >
              <Ionicons
                name="help-circle-outline"
                size={14}
                color="#6B7280"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
          <Text
            style={[
              styles.value,
              declinesRemaining === 0 && { color: "#DC2626" },
            ]}
          >
            {declinesRemaining}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>
            {t("substitute_pool_v2.label_max_contribution")}
          </Text>
          <Text style={styles.value}>
            {entry.maxContributionAmountCents === 0
              ? t("substitute_pool.value_no_cap")
              : fmtCents(entry.maxContributionAmountCents)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>
            {t("substitute_pool_v2.label_language")}
          </Text>
          <Text style={styles.value}>
            {entry.preferredLanguages?.[0] ?? "en"}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setEditing((v) => !v)}
          >
            <Ionicons name="create-outline" size={16} color="#2563EB" />
            <Text style={styles.secondaryButtonText}>
              {editing
                ? t("substitute_pool.btn_cancel_edit")
                : t("substitute_pool.btn_edit_preferences")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={leavePool}>
            <Ionicons name="exit-outline" size={16} color="#FFFFFF" />
            <Text style={styles.dangerButtonText}>
              {t("substitute_pool_v2.btn_leave_pool")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderForm = () => {
    if (isInPool && !editing) return null;
    if (!isInPool && !eligible) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {isInPool
            ? t("substitute_pool.card_edit_prefs_title")
            : t("substitute_pool.card_opt_in_title")}
        </Text>

        <Text style={styles.fieldLabel}>
          {t("substitute_pool_v2.field_status")}
        </Text>
        <View style={styles.segment}>
          {(["active", "standby"] as PoolStatus[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.segItem, formStatus === s && styles.segItemActive]}
              onPress={() => setFormStatus(s)}
            >
              <Text
                style={[
                  styles.segText,
                  formStatus === s && styles.segTextActive,
                ]}
              >
                {t(`substitute_pool.status_${s}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.helpText}>
          {t("substitute_pool.help_status_modes")}
        </Text>

        <Text style={styles.fieldLabel}>
          {t("substitute_pool.field_max_contribution")}
        </Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={formMaxContrib}
          onChangeText={setFormMaxContrib}
          placeholder={t("substitute_pool_v2.placeholder_no_cap")}
        />
        <Text style={styles.helpText}>{t("substitute_pool.help_no_cap")}</Text>

        <Text style={styles.fieldLabel}>
          {t("substitute_pool_v2.field_preferred_language")}
        </Text>
        <View style={styles.segment}>
          {["en", "fr", "es"].map((l) => (
            <TouchableOpacity
              key={l}
              style={[
                styles.segItem,
                formLanguage === l && styles.segItemActive,
              ]}
              onPress={() => setFormLanguage(l)}
            >
              <Text
                style={[
                  styles.segText,
                  formLanguage === l && styles.segTextActive,
                ]}
              >
                {l.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            savingForm && styles.primaryButtonDisabled,
          ]}
          onPress={saveForm}
          disabled={savingForm}
        >
          {savingForm ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isInPool
                ? t("substitute_pool.btn_save_preferences")
                : t("substitute_pool.btn_join_pool")}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderOffers = () => {
    if (offersLoading && offers.length === 0) {
      return (
        <View style={styles.sectionSpinner}>
          <ActivityIndicator color="#2563EB" />
        </View>
      );
    }
    if (offers.length === 0) {
      return (
        <View style={styles.emptyBlock}>
          <Ionicons name="mail-open-outline" size={28} color="#9CA3AF" />
          <Text style={styles.emptyText}>
            {t("substitute_pool_v2.empty_no_offers")}
          </Text>
        </View>
      );
    }
    return offers.map((o) => {
      const r = o.record;
      const busy = busyOfferId === r.id;
      return (
        <View key={r.id} style={styles.offerCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {o.circleName ?? t("substitute_pool.label_unknown_circle")}
            </Text>
            <Countdown
              deadlineIso={r.confirmationDeadline}
              warningHoursThreshold={6}
              prefixKey="substitute_pool.label_left_in"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("substitute_pool_v2.label_contribution")}
            </Text>
            <Text style={styles.value}>
              {o.circleAmount != null
                ? `$${o.circleAmount.toFixed(2)}`
                : "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("substitute_pool_v2.label_remaining_cycles")}
            </Text>
            <Text style={styles.value}>{o.remainingCycles}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("substitute_pool_v2.label_payout_position")}
            </Text>
            <Text style={styles.value}>#{r.originalPayoutPosition}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("substitute_pool_v2.label_exiting_member")}
            </Text>
            <Text style={styles.value}>{o.exitingMemberName ?? "—"}</Text>
          </View>
          {r.payoutEntitlementTransferCents > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>
                {t("substitute_pool.label_payout_transfer")}
              </Text>
              <Text style={[styles.value, { color: "#10B981" }]}>
                {fmtCents(r.payoutEntitlementTransferCents)}
              </Text>
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.dangerButton,
                busy && styles.primaryButtonDisabled,
              ]}
              onPress={() => respond(r.id, "decline")}
              disabled={busy}
            >
              <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.dangerButtonText}>
                {t("substitute_pool_v2.btn_decline")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.successButton,
                busy && styles.primaryButtonDisabled,
              ]}
              onPress={() => respond(r.id, "accept")}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.successButtonText}>
                    {t("substitute_pool_v2.btn_accept")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  const renderAdmin = () => {
    if (adminLoading && adminItems.length === 0) return null;
    if (adminItems.length === 0) return null;
    // Group items by circle so admins see their queues per-circle.
    const grouped = new Map<string, typeof adminItems>();
    for (const item of adminItems) {
      const arr = grouped.get(item.record.circleId) ?? [];
      arr.push(item);
      grouped.set(item.record.circleId, arr);
    }
    return (
      <>
        <Text style={styles.sectionTitle}>
          {t("substitute_pool_v2.section_admin_queue")}
        </Text>
        {Array.from(grouped.entries()).map(([circleId, rows]) => (
          <View key={circleId} style={styles.adminBlock}>
            <Text style={styles.adminCircleName}>
              {rows[0].circleName ?? circleId}
            </Text>
            {rows.map((row) => {
              const r = row.record;
              const busy = busyAdminId === r.id;
              const deadlineIso = r.adminNotifiedAt
                ? new Date(
                    new Date(r.adminNotifiedAt).getTime() +
                      24 * 60 * 60 * 1000,
                  ).toISOString()
                : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
              return (
                <View key={r.id} style={styles.adminCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                      {row.exitingMemberName ?? "—"} →{" "}
                      {row.substituteMemberName ?? "—"}
                    </Text>
                    <Countdown
                      deadlineIso={deadlineIso}
                      warningHoursThreshold={4}
                      prefixKey="substitute_pool.label_auto_approve_in"
                    />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>
                      {t("substitute_pool_v2.label_substitute_reliability")}
                    </Text>
                    <Text style={styles.value}>
                      {row.substituteReliabilityScore.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>
                      {t("substitute_pool_v2.label_position")}
                    </Text>
                    <Text style={styles.value}>#{r.originalPayoutPosition}</Text>
                  </View>
                  {row.originalPayoutAmountCents > 0 && (
                    <View style={styles.splitBlock}>
                      <Text style={styles.splitTitle}>
                        {t("substitute_pool.label_80_10_10_split")}
                      </Text>
                      <View style={styles.row}>
                        <Text style={styles.label}>
                          {t("substitute_pool_v2.label_substitute")}
                        </Text>
                        <Text style={styles.value}>
                          {fmtCents(row.substituteShareCents)}
                        </Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>
                          {t("substitute_pool_v2.label_insurance_pool")}
                        </Text>
                        <Text style={styles.value}>
                          {fmtCents(row.insurancePoolShareCents)}
                        </Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>
                          {t("substitute_pool_v2.label_exiting_member")}
                        </Text>
                        <Text style={styles.value}>
                          {fmtCents(row.originalMemberSettlementCents)}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[
                        styles.dangerButton,
                        busy && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => adminAct(r.id, "decline")}
                      disabled={busy}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.dangerButtonText}>
                        {t("substitute_pool_v2.btn_decline")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.successButton,
                        busy && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => adminAct(r.id, "approve")}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color="#FFFFFF"
                          />
                          <Text style={styles.successButtonText}>
                            {t("substitute_pool_v2.btn_approve")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </>
    );
  };

  // Bucket B — tab descriptors. The admin tab is conditionally appended;
  // its count badge mirrors the underlying queue length.
  const tabDescriptors: Array<{ key: TabKey; labelKey: string; count?: number }> = [
    { key: "membership", labelKey: "substitute_pool.tab_membership" },
    { key: "offers", labelKey: "substitute_pool.tab_offers", count: offers.length },
  ];
  if (showAdminTab) {
    tabDescriptors.push({
      key: "admin",
      labelKey: "substitute_pool.tab_admin_queue",
      count: adminItems.length,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("screen_headers.substitute_pool")}
        </Text>
        {/* Bucket B — wire the previously-empty header slot to a (?) button
            that opens the four-topic HelpSheet. */}
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("substitute_pool.help_open")}
        >
          <Ionicons name="help-circle-outline" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Bucket B — tab strip. Membership and offers always visible; admin
          appears only when there's at least one pending admin action. */}
      <View style={styles.tabRow}>
        {tabDescriptors.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.tabBtnText,
                  isActive && styles.tabBtnTextActive,
                ]}
              >
                {t(tab.labelKey)}
                {tab.count != null && tab.count > 0 ? ` (${tab.count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "membership" && (
          <>
            {renderEligibility()}
            {renderPoolEntry()}
            {renderForm()}
          </>
        )}

        {activeTab === "offers" && (
          <>
            <Text style={styles.sectionTitle}>
              {t("substitute_pool_v2.section_pending_offers")}
            </Text>
            {renderOffers()}
          </>
        )}

        {activeTab === "admin" && renderAdmin()}
      </ScrollView>

      {/* Bucket B — sheets and coach overlay mount outside ScrollView. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <ReliabilityExplainerSheet
        visible={reliabilityOpen}
        onClose={() => setReliabilityOpen(false)}
        currentScore={poolEntry?.substituteReliabilityScore ?? null}
      />
      <DeclineBudgetSheet
        visible={declineBudgetOpen}
        onClose={() => setDeclineBudgetOpen(false)}
      />

      {coachVisible && (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.coachCard}
            onPress={dismissCoach}
            accessibilityRole="button"
          >
            <Ionicons
              name="people-circle"
              size={20}
              color="#10B981"
            />
            <Text style={styles.coachText}>
              {t("substitute_pool.coach_tip")}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HelpSheet — Modal-based, all four Bucket B topics in one scroll. Same
// pattern as the Insurance Pool Bucket B HelpSheet.
// ══════════════════════════════════════════════════════════════════════════════
function HelpSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const topics: HelpTopic[] = [
    "how_pool",
    "commitment",
    "reliability",
    "decline_consequences",
  ];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>
            {t("substitute_pool.help_sheet_title")}
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {topics.map((topic, idx) => (
              <View
                key={topic}
                style={[
                  sheetStyles.helpItem,
                  idx === topics.length - 1 && sheetStyles.helpItemLast,
                ]}
              >
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`substitute_pool.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.body}>
                  {t(`substitute_pool.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={sheetStyles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.closeBtnText}>
              {t("substitute_pool.help_close")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ReliabilityExplainerSheet — opened from the reliability row. Shows the
// user's current score, the formula, and the three reliability tiers.
// ══════════════════════════════════════════════════════════════════════════════
function ReliabilityExplainerSheet({
  visible,
  onClose,
  currentScore,
}: {
  visible: boolean;
  onClose: () => void;
  currentScore: number | null;
}) {
  const { t } = useTranslation();
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(2));
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>
            {t("substitute_pool.reliability_explainer_title")}
          </Text>
          <Text style={sheetStyles.body}>
            {t("substitute_pool.reliability_current_score", {
              score: fmt(currentScore),
            })}
          </Text>

          <Text style={sheetStyles.sectionLabel}>
            {t("substitute_pool.reliability_formula_label")}
          </Text>
          <Text style={sheetStyles.body}>
            {t("substitute_pool.reliability_formula")}
          </Text>

          <Text style={sheetStyles.sectionLabel}>
            {t("substitute_pool.reliability_tiers_label")}
          </Text>
          <View style={sheetStyles.tierRow}>
            <Text
              style={[sheetStyles.tierLabel, { color: "#10B981" }]}
            >
              {t("substitute_pool.reliability_tier_trusted")}
            </Text>
            <Text style={sheetStyles.body}>
              {t("substitute_pool.reliability_tier_trusted_desc")}
            </Text>
          </View>
          <View style={sheetStyles.tierRow}>
            <Text style={[sheetStyles.tierLabel, { color: "#2563EB" }]}>
              {t("substitute_pool.reliability_tier_reliable")}
            </Text>
            <Text style={sheetStyles.body}>
              {t("substitute_pool.reliability_tier_reliable_desc")}
            </Text>
          </View>
          <View style={sheetStyles.tierRow}>
            <Text style={[sheetStyles.tierLabel, { color: "#F59E0B" }]}>
              {t("substitute_pool.reliability_tier_on_notice")}
            </Text>
            <Text style={sheetStyles.body}>
              {t("substitute_pool.reliability_tier_on_notice_desc")}
            </Text>
          </View>

          <TouchableOpacity
            style={sheetStyles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.closeBtnText}>
              {t("substitute_pool.help_close")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DeclineBudgetSheet — small tooltip-style modal opened from the (?) next
// to "Declines remaining (90d)".
// ══════════════════════════════════════════════════════════════════════════════
function DeclineBudgetSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>
            {t("substitute_pool.decline_budget_explainer_title")}
          </Text>
          <Text style={sheetStyles.body}>
            {t("substitute_pool.decline_budget_explainer")}
          </Text>
          <TouchableOpacity
            style={sheetStyles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.closeBtnText}>
              {t("substitute_pool.help_close")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  body: {
    fontSize: 13,
    color: "#1F2937",
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 6,
  },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  helpItemLast: { borderBottomWidth: 0 },
  helpItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  tierRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tierLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  closeBtn: {
    backgroundColor: "#1F2937",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBackButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  headerPlaceholder: { width: 40 },
  content: { flex: 1 },
  sectionSpinner: {
    alignItems: "center",
    paddingVertical: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
    paddingRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowTappable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  labelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: { fontSize: 13, color: "#6B7280" },
  value: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  helpText: { fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 17 },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: 0.4,
  },
  badgeGreen: { backgroundColor: "#D1FAE5" },
  badgeBlue: { backgroundColor: "#DBEAFE" },
  badgeOrange: { backgroundColor: "#FFEDD5" },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  segItemActive: { backgroundColor: "#FFFFFF" },
  segText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  segTextActive: { color: "#2563EB" },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: "#2563EB",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2563EB",
    gap: 6,
  },
  secondaryButtonText: { color: "#2563EB", fontWeight: "700", fontSize: 13 },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    gap: 6,
  },
  dangerButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  successButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#10B981",
    gap: 6,
  },
  successButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  emptyBlock: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
  },
  emptyText: { fontSize: 13, color: "#9CA3AF" },
  offerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
  },
  adminBlock: { marginBottom: 8 },
  adminCircleName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  adminCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  splitBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  splitTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 6,
  },

  // Bucket B — tab strip
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#1F2937",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },

  // Bucket B — coach overlay
  coachOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
  },
  coachCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  coachText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
  },
});
