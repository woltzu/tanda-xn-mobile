// ═══════════════════════════════════════════════════════════════════════════════
// SubstitutePoolScreen — Phase D3.2 of feat(substitute)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Single screen with two sections:
//
// Member section (always visible):
//   * Eligibility (via check_substitute_pool_eligibility RPC)
//   * Opt-in form when eligible & not in pool: status (active/standby),
//     max contribution $, language
//   * Pool entry card when in pool: reliability score, totals, declines
//     remaining (3 − decline_count_90d), edit, leave
//   * Pending offers inbox: substitution_records where this user is the
//     matched substitute and status='pending_confirmation'. Live countdown
//     to confirmation_deadline. Accept calls respond_to_substitution(id,'accept'),
//     decline calls respond_to_substitution(id,'decline').
//
// Admin section (only if user has role IN (creator, admin) in any circle):
//   * One block per circle the user moderates
//   * Lists substitution_records with status='admin_pending' for that circle
//   * Each card shows exiting member name, proposed substitute name,
//     substitute's reliability score, and the 80/10/10 split. Approve calls
//     admin_approve_substitution(id), decline calls admin_decline_substitution(id).
//     Live countdown to 24h auto-approval (record.admin_notified_at + 24h).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState, useCallback } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ── Types ───────────────────────────────────────────────────────────────────
type PoolStatus = "active" | "standby" | "suspended" | "removed";

interface Eligibility {
  eligible: boolean;
  reason?: string;
  xn_score: number;
  completed_circles: number;
  already_in_pool: boolean;
}

interface PoolEntry {
  id: string;
  member_id: string;
  status: PoolStatus;
  availability_radius_miles: number;
  max_contribution_amount_cents: number;
  preferred_languages: string[];
  substitute_reliability_score: number;
  total_substitutions: number;
  successful_substitutions: number;
  decline_count_90d: number;
  last_decline_at: string | null;
}

interface OfferRow {
  id: string;
  circle_id: string;
  exit_request_id: string;
  exiting_member_id: string;
  substitute_member_id: string;
  original_payout_position: number;
  payout_entitlement_transfer_cents: number;
  entry_cycle_number: number;
  confirmation_deadline: string;
  status: string;
  // joined data
  circle_name?: string;
  circle_amount?: number;
  exiting_member_name?: string;
  remaining_cycles?: number;
}

interface AdminPendingRow {
  id: string;
  circle_id: string;
  circle_name: string;
  exit_request_id: string;
  exiting_member_id: string;
  exiting_member_name: string;
  substitute_member_id: string;
  substitute_member_name: string;
  substitute_reliability_score: number;
  original_payout_position: number;
  admin_notified_at: string;
  // From exit_request:
  original_payout_amount_cents: number;
  substitute_share_cents: number;
  insurance_pool_share_cents: number;
  original_member_settlement_cents: number;
}

interface AdminCircle {
  id: string;
  name: string;
  pending: AdminPendingRow[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

function hoursRemaining(deadlineIso: string): number {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  return Math.max(0, ms / (1000 * 60 * 60));
}

function fmtCountdown(hours: number): string {
  if (hours < 1) {
    const mins = Math.max(0, Math.round(hours * 60));
    return `${mins}m`;
  }
  if (hours < 24) return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SubstitutePoolScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const userId = user?.id;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [poolEntry, setPoolEntry] = useState<PoolEntry | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [adminCircles, setAdminCircles] = useState<AdminCircle[]>([]);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);

  // Opt-in form state
  const [editing, setEditing] = useState(false);
  const [formStatus, setFormStatus] = useState<PoolStatus>("active");
  const [formMaxContrib, setFormMaxContrib] = useState<string>("0"); // dollars, 0 = no cap
  const [formLanguage, setFormLanguage] = useState<string>("en");
  const [savingForm, setSavingForm] = useState(false);

  // Tick counter so countdowns re-render every 30s
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadEligibilityAndEntry = useCallback(async () => {
    if (!userId) return;
    const [{ data: eligData }, { data: entryData }] = await Promise.all([
      supabase.rpc("check_substitute_pool_eligibility", { p_user_id: userId }),
      supabase
        .from("substitute_pool")
        .select("*")
        .eq("member_id", userId)
        .maybeSingle(),
    ]);
    setEligibility(eligData ?? null);
    if (entryData) {
      const e: PoolEntry = {
        ...entryData,
        substitute_reliability_score: Number(entryData.substitute_reliability_score),
      };
      setPoolEntry(e);
      // Hydrate form defaults from current entry
      setFormStatus(e.status);
      setFormMaxContrib(((e.max_contribution_amount_cents ?? 0) / 100).toString());
      setFormLanguage((e.preferred_languages?.[0] ?? "en") as string);
    } else {
      setPoolEntry(null);
    }
  }, [userId]);

  const loadOffers = useCallback(async () => {
    if (!userId) return;
    const { data: raw } = await supabase
      .from("substitution_records")
      .select(
        "id, circle_id, exit_request_id, exiting_member_id, substitute_member_id, original_payout_position, payout_entitlement_transfer_cents, entry_cycle_number, confirmation_deadline, status",
      )
      .eq("substitute_member_id", userId)
      .eq("status", "pending_confirmation")
      .order("confirmation_deadline", { ascending: true });

    const records: OfferRow[] = (raw ?? []) as OfferRow[];
    if (records.length === 0) {
      setOffers([]);
      return;
    }

    // Join in circles + exiting member names + remaining cycles
    const circleIds = Array.from(new Set(records.map((r) => r.circle_id)));
    const exitingIds = Array.from(new Set(records.map((r) => r.exiting_member_id)));

    const [{ data: circles }, { data: profiles }] = await Promise.all([
      supabase.from("circles").select("id, name, amount").in("id", circleIds),
      supabase.from("profiles").select("id, full_name").in("id", exitingIds),
    ]);

    const circleMap = new Map((circles ?? []).map((c: any) => [c.id, c]));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Per-circle remaining cycle counts
    const remainingMap = new Map<string, number>();
    await Promise.all(
      circleIds.map(async (cid) => {
        const { count } = await supabase
          .from("circle_cycles")
          .select("id", { count: "exact", head: true })
          .eq("circle_id", cid)
          .in("cycle_status", ["scheduled", "collecting"]);
        remainingMap.set(cid, count ?? 0);
      }),
    );

    setOffers(
      records.map((r) => {
        const c = circleMap.get(r.circle_id);
        const p = profileMap.get(r.exiting_member_id);
        return {
          ...r,
          circle_name: c?.name,
          circle_amount: c?.amount,
          exiting_member_name: p?.full_name,
          remaining_cycles: remainingMap.get(r.circle_id) ?? 0,
        };
      }),
    );
  }, [userId]);

  const loadAdminQueue = useCallback(async () => {
    if (!userId) return;

    // Circles user moderates
    const { data: memberships } = await supabase
      .from("circle_members")
      .select("circle_id, role")
      .eq("user_id", userId)
      .in("role", ["creator", "admin"])
      .eq("status", "active");

    const adminCircleIds = Array.from(
      new Set((memberships ?? []).map((m: any) => m.circle_id)),
    );

    if (adminCircleIds.length === 0) {
      setAdminCircles([]);
      return;
    }

    const [{ data: circlesRaw }, { data: pending }] = await Promise.all([
      supabase.from("circles").select("id, name").in("id", adminCircleIds),
      supabase
        .from("substitution_records")
        .select(
          "id, circle_id, exit_request_id, exiting_member_id, substitute_member_id, original_payout_position, admin_notified_at",
        )
        .in("circle_id", adminCircleIds)
        .eq("status", "admin_pending")
        .order("admin_notified_at", { ascending: true }),
    ]);

    const pendingRows = (pending ?? []) as any[];
    if (pendingRows.length === 0) {
      setAdminCircles((circlesRaw ?? []).map((c: any) => ({ id: c.id, name: c.name, pending: [] })));
      return;
    }

    // Hydrate names + reliability + share amounts
    const peopleIds = Array.from(
      new Set(
        pendingRows.flatMap((r: any) => [r.exiting_member_id, r.substitute_member_id]),
      ),
    );
    const exitReqIds = Array.from(new Set(pendingRows.map((r: any) => r.exit_request_id)));
    const substituteIds = Array.from(
      new Set(pendingRows.map((r: any) => r.substitute_member_id)),
    );

    const [
      { data: peopleRows },
      { data: exitReqRows },
      { data: poolRows },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", peopleIds),
      supabase
        .from("circle_exit_requests")
        .select(
          "id, original_payout_amount_cents, substitute_share_cents, insurance_pool_share_cents, original_member_settlement_cents",
        )
        .in("id", exitReqIds),
      supabase
        .from("substitute_pool")
        .select("member_id, substitute_reliability_score")
        .in("member_id", substituteIds),
    ]);

    const peopleMap = new Map((peopleRows ?? []).map((p: any) => [p.id, p.full_name]));
    const exitReqMap = new Map((exitReqRows ?? []).map((r: any) => [r.id, r]));
    const poolMap = new Map(
      (poolRows ?? []).map((p: any) => [
        p.member_id,
        Number(p.substitute_reliability_score),
      ]),
    );

    const circles = (circlesRaw ?? []) as Array<{ id: string; name: string }>;
    const byCircle = new Map<string, AdminPendingRow[]>();
    for (const r of pendingRows) {
      const er = exitReqMap.get(r.exit_request_id);
      const row: AdminPendingRow = {
        id: r.id,
        circle_id: r.circle_id,
        circle_name: circles.find((c) => c.id === r.circle_id)?.name ?? "Circle",
        exit_request_id: r.exit_request_id,
        exiting_member_id: r.exiting_member_id,
        exiting_member_name: peopleMap.get(r.exiting_member_id) ?? "Exiting member",
        substitute_member_id: r.substitute_member_id,
        substitute_member_name: peopleMap.get(r.substitute_member_id) ?? "Substitute",
        substitute_reliability_score: poolMap.get(r.substitute_member_id) ?? 100,
        original_payout_position: r.original_payout_position,
        admin_notified_at: r.admin_notified_at,
        original_payout_amount_cents: er?.original_payout_amount_cents ?? 0,
        substitute_share_cents: er?.substitute_share_cents ?? 0,
        insurance_pool_share_cents: er?.insurance_pool_share_cents ?? 0,
        original_member_settlement_cents: er?.original_member_settlement_cents ?? 0,
      };
      const arr = byCircle.get(r.circle_id) ?? [];
      arr.push(row);
      byCircle.set(r.circle_id, arr);
    }

    setAdminCircles(
      circles.map((c) => ({
        id: c.id,
        name: c.name,
        pending: byCircle.get(c.id) ?? [],
      })),
    );
  }, [userId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadEligibilityAndEntry(), loadOffers(), loadAdminQueue()]);
    } catch (err: any) {
      // Soft-fail so partial data still renders
      console.warn("[SubstitutePoolScreen] loadAll error:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [loadEligibilityAndEntry, loadOffers, loadAdminQueue]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // ── Pool actions ──────────────────────────────────────────────────────────
  const saveForm = async () => {
    if (!userId) return;
    const maxCents = Math.max(0, Math.round(Number(formMaxContrib) * 100));
    if (Number.isNaN(maxCents)) {
      Alert.alert("Invalid amount", "Max contribution must be a number");
      return;
    }
    setSavingForm(true);
    try {
      const payload: any = {
        status: formStatus,
        max_contribution_amount_cents: maxCents,
        preferred_languages: [formLanguage],
      };
      if (poolEntry) {
        // Update
        const { error } = await supabase
          .from("substitute_pool")
          .update(payload)
          .eq("member_id", userId);
        if (error) {
          Alert.alert("Could not update", error.message);
          return;
        }
      } else {
        // Insert (RLS permits when member_id = auth.uid())
        const { error } = await supabase
          .from("substitute_pool")
          .insert({
            ...payload,
            member_id: userId,
            availability_radius_miles: 50,
          });
        if (error) {
          Alert.alert("Could not join pool", error.message);
          return;
        }
      }
      setEditing(false);
      await loadEligibilityAndEntry();
    } finally {
      setSavingForm(false);
    }
  };

  const leavePool = async () => {
    if (!userId) return;
    Alert.alert(
      "Leave substitute pool?",
      "You won't be offered new substitution matches until you opt back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave Pool",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("substitute_pool")
              .update({ status: "removed", removed_at: new Date().toISOString() })
              .eq("member_id", userId);
            if (error) {
              Alert.alert("Could not leave pool", error.message);
              return;
            }
            await loadEligibilityAndEntry();
          },
        },
      ],
    );
  };

  // ── Offer actions ─────────────────────────────────────────────────────────
  const respond = async (offer: OfferRow, response: "accept" | "decline") => {
    setBusyOfferId(offer.id);
    try {
      const { data, error } = await supabase.rpc("respond_to_substitution", {
        p_record_id: offer.id,
        p_response: response,
      });
      if (error) {
        Alert.alert("Could not respond", error.message);
        return;
      }
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        Alert.alert("Could not respond", result.error ?? "Unknown error");
        return;
      }
      await Promise.all([loadOffers(), loadEligibilityAndEntry()]);
    } catch (err: any) {
      Alert.alert("Could not respond", err?.message ?? "Unknown error");
    } finally {
      setBusyOfferId(null);
    }
  };

  // ── Admin actions ─────────────────────────────────────────────────────────
  const adminAct = async (row: AdminPendingRow, action: "approve" | "decline") => {
    setBusyAdminId(row.id);
    try {
      const rpc =
        action === "approve" ? "admin_approve_substitution" : "admin_decline_substitution";
      const { data, error } = await supabase.rpc(rpc, { p_record_id: row.id });
      if (error) {
        Alert.alert("Could not respond", error.message);
        return;
      }
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        Alert.alert("Could not respond", result.error ?? "Unknown error");
        return;
      }
      await loadAdminQueue();
    } catch (err: any) {
      Alert.alert("Could not respond", err?.message ?? "Unknown error");
    } finally {
      setBusyAdminId(null);
    }
  };

  // ── Derived UI state ──────────────────────────────────────────────────────
  const inPool = !!poolEntry && poolEntry.status !== "removed";
  const declinesRemaining = useMemo(
    () => Math.max(0, 3 - (poolEntry?.decline_count_90d ?? 0)),
    [poolEntry],
  );
  const successRate = useMemo(() => {
    if (!poolEntry || poolEntry.total_substitutions === 0) return null;
    return Math.round(
      (poolEntry.successful_substitutions / poolEntry.total_substitutions) * 100,
    );
  }, [poolEntry]);

  // ── Renderers ─────────────────────────────────────────────────────────────

  const renderEligibility = () => {
    if (!eligibility) return null;
    const color = eligibility.eligible || inPool ? "#10B981" : "#F59E0B";
    return (
      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: color }]}>
        <Text style={styles.cardTitle}>Pool eligibility</Text>
        <View style={styles.row}>
          <Text style={styles.label}>XnScore</Text>
          <Text style={styles.value}>
            {eligibility.xn_score}
            {eligibility.xn_score >= 60 ? " ✓" : " (need 60+)"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Completed circles</Text>
          <Text style={styles.value}>
            {eligibility.completed_circles}
            {eligibility.completed_circles >= 1 ? " ✓" : " (need 1+)"}
          </Text>
        </View>
        {!eligibility.eligible && !inPool && eligibility.reason && (
          <Text style={styles.helpText}>{eligibility.reason}</Text>
        )}
      </View>
    );
  };

  const renderPoolEntry = () => {
    if (!inPool) return null;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>You're in the substitute pool</Text>
          <View
            style={[
              styles.badge,
              poolEntry!.status === "active" && styles.badgeGreen,
              poolEntry!.status === "standby" && styles.badgeBlue,
              poolEntry!.status === "suspended" && styles.badgeOrange,
            ]}
          >
            <Text style={styles.badgeText}>{poolEntry!.status.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Reliability score</Text>
          <Text style={styles.value}>{poolEntry!.substitute_reliability_score.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total substitutions</Text>
          <Text style={styles.value}>{poolEntry!.total_substitutions}</Text>
        </View>
        {successRate !== null && (
          <View style={styles.row}>
            <Text style={styles.label}>Success rate</Text>
            <Text style={styles.value}>{successRate}%</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Declines remaining (90d)</Text>
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
          <Text style={styles.label}>Max contribution</Text>
          <Text style={styles.value}>
            {poolEntry!.max_contribution_amount_cents === 0
              ? "No cap"
              : fmtCents(poolEntry!.max_contribution_amount_cents)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Language</Text>
          <Text style={styles.value}>{poolEntry!.preferred_languages?.[0] ?? "en"}</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setEditing((v) => !v)}
          >
            <Ionicons name="create-outline" size={16} color="#2563EB" />
            <Text style={styles.secondaryButtonText}>
              {editing ? "Cancel" : "Edit preferences"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={leavePool}>
            <Ionicons name="exit-outline" size={16} color="#FFFFFF" />
            <Text style={styles.dangerButtonText}>Leave pool</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderForm = () => {
    if (inPool && !editing) return null;
    if (!inPool && !(eligibility?.eligible)) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{inPool ? "Edit preferences" : "Opt into the pool"}</Text>

        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.segment}>
          {(["active", "standby"] as PoolStatus[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.segItem, formStatus === s && styles.segItemActive]}
              onPress={() => setFormStatus(s)}
            >
              <Text style={[styles.segText, formStatus === s && styles.segTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.helpText}>
          Active = ready to be offered substitutions. Standby = contactable but lower priority.
        </Text>

        <Text style={styles.fieldLabel}>Max contribution ($)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={formMaxContrib}
          onChangeText={setFormMaxContrib}
          placeholder="0 (no cap)"
        />
        <Text style={styles.helpText}>0 means no cap — you can take any circle.</Text>

        <Text style={styles.fieldLabel}>Preferred language</Text>
        <View style={styles.segment}>
          {["en", "fr", "es"].map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.segItem, formLanguage === l && styles.segItemActive]}
              onPress={() => setFormLanguage(l)}
            >
              <Text style={[styles.segText, formLanguage === l && styles.segTextActive]}>
                {l.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, savingForm && styles.primaryButtonDisabled]}
          onPress={saveForm}
          disabled={savingForm}
        >
          {savingForm ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {inPool ? "Save preferences" : "Join substitute pool"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderOffers = () => {
    if (offers.length === 0) {
      return (
        <View style={styles.emptyBlock}>
          <Ionicons name="mail-open-outline" size={28} color="#9CA3AF" />
          <Text style={styles.emptyText}>No pending offers right now.</Text>
        </View>
      );
    }
    return offers.map((o) => {
      // tick is read so eslint-friendly; countdown re-evaluates on every render
      void tick;
      const hours = hoursRemaining(o.confirmation_deadline);
      return (
        <View key={o.id} style={styles.offerCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{o.circle_name ?? "Circle"}</Text>
            <View style={[styles.badge, hours < 6 ? styles.badgeOrange : styles.badgeBlue]}>
              <Text style={styles.badgeText}>{fmtCountdown(hours)} left</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Contribution</Text>
            <Text style={styles.value}>
              {o.circle_amount != null ? `$${Number(o.circle_amount).toFixed(2)}` : "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Remaining cycles</Text>
            <Text style={styles.value}>{o.remaining_cycles ?? 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payout position</Text>
            <Text style={styles.value}>#{o.original_payout_position}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Exiting member</Text>
            <Text style={styles.value}>{o.exiting_member_name ?? "—"}</Text>
          </View>
          {o.payout_entitlement_transfer_cents > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Payout transfer (80%)</Text>
              <Text style={[styles.value, { color: "#10B981" }]}>
                {fmtCents(o.payout_entitlement_transfer_cents)}
              </Text>
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.dangerButton,
                busyOfferId === o.id && styles.primaryButtonDisabled,
              ]}
              onPress={() => respond(o, "decline")}
              disabled={busyOfferId === o.id}
            >
              <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.dangerButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.successButton,
                busyOfferId === o.id && styles.primaryButtonDisabled,
              ]}
              onPress={() => respond(o, "accept")}
              disabled={busyOfferId === o.id}
            >
              {busyOfferId === o.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.successButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  const renderAdmin = () => {
    if (adminCircles.length === 0) return null;
    return (
      <>
        <Text style={styles.sectionTitle}>Admin queue</Text>
        {adminCircles.map((c) => (
          <View key={c.id} style={styles.adminBlock}>
            <Text style={styles.adminCircleName}>{c.name}</Text>
            {c.pending.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>No pending substitutions.</Text>
              </View>
            ) : (
              c.pending.map((row) => {
                void tick;
                const notifiedMs = new Date(row.admin_notified_at).getTime();
                const autoApproveIn = Math.max(
                  0,
                  (notifiedMs + 24 * 3600 * 1000 - Date.now()) / (3600 * 1000),
                );
                return (
                  <View key={row.id} style={styles.adminCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{row.exiting_member_name} → {row.substitute_member_name}</Text>
                      <View style={[styles.badge, autoApproveIn < 4 ? styles.badgeOrange : styles.badgeBlue]}>
                        <Text style={styles.badgeText}>
                          auto-approves in {fmtCountdown(autoApproveIn)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Substitute reliability</Text>
                      <Text style={styles.value}>{row.substitute_reliability_score.toFixed(2)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Position</Text>
                      <Text style={styles.value}>#{row.original_payout_position}</Text>
                    </View>
                    {row.original_payout_amount_cents > 0 && (
                      <View style={styles.splitBlock}>
                        <Text style={styles.splitTitle}>80/10/10 split</Text>
                        <View style={styles.row}>
                          <Text style={styles.label}>Substitute</Text>
                          <Text style={styles.value}>{fmtCents(row.substitute_share_cents)}</Text>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.label}>Insurance pool</Text>
                          <Text style={styles.value}>{fmtCents(row.insurance_pool_share_cents)}</Text>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.label}>Exiting member</Text>
                          <Text style={styles.value}>{fmtCents(row.original_member_settlement_cents)}</Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.dangerButton, busyAdminId === row.id && styles.primaryButtonDisabled]}
                        onPress={() => adminAct(row, "decline")}
                        disabled={busyAdminId === row.id}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.dangerButtonText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.successButton, busyAdminId === row.id && styles.primaryButtonDisabled]}
                        onPress={() => adminAct(row, "approve")}
                        disabled={busyAdminId === row.id}
                      >
                        {busyAdminId === row.id ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                            <Text style={styles.successButtonText}>Approve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ))}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Substitute Pool</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.loadingText}>Loading your substitute pool…</Text>
          </View>
        ) : (
          <>
            {renderEligibility()}
            {renderPoolEntry()}
            {renderForm()}

            <Text style={styles.sectionTitle}>Pending offers</Text>
            {renderOffers()}

            {renderAdmin()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  loadingBox: { alignItems: "center", padding: 32, gap: 12 },
  loadingText: { color: "#6B7280", fontSize: 14 },
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
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937", flex: 1, paddingRight: 8 },
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
  label: { fontSize: 13, color: "#6B7280" },
  value: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  helpText: { fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 17 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#E5E7EB" },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#1F2937", letterSpacing: 0.4 },
  badgeGreen: { backgroundColor: "#D1FAE5" },
  badgeBlue: { backgroundColor: "#DBEAFE" },
  badgeOrange: { backgroundColor: "#FFEDD5" },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 12, marginBottom: 6 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  segItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
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
  splitTitle: { fontSize: 13, fontWeight: "700", color: "#1F2937", marginBottom: 6 },
});
