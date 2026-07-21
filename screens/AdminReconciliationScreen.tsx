// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminReconciliationScreen.tsx — Doc 38 v2
// ═══════════════════════════════════════════════════════════════════════════
//
// Lists circles in status='completed' or 'payout_complete' with each row's
// invariant net position. Tapping "Review" navigates to CircleDetail
// (which carries the v1 admin card + correction/close modals from the
// prior commit).
//
// Data flow — one query for the circle rows + one get_circle_invariant
// RPC per row, dispatched in parallel via Promise.all. For the current
// scale (2–20 completed circles) that's fine; if it grows past ~50 an
// aggregate RPC becomes worth writing.
//
// Gating — platform admin only (useIsAdmin, admin_users membership).
// Non-admins see a locked frame. Matches the CircleDetail v1 gate so
// the same audience is scoped end-to-end.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { AppFlashList } from "../components/AppFlashList";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { Routes } from "../lib/routes";
import type { CircleInvariant } from "../hooks/useCircleInvariant";

interface CircleRow {
  id: string;
  name: string;
  status: string;
  member_count: number;
  total_cycles: number | null;
  cycles_completed: number | null;
  completed_at: string | null;
  invariant: CircleInvariant | null;
  invariantError: string | null;
}

type Filter = "all" | "balanced" | "unbalanced";

export default function AdminReconciliationScreen() {
  const navigation = useNavigation<any>();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [rows, setRows] = useState<CircleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: circles, error: qErr } = await supabase
        .from("circles")
        .select(
          "id, name, status, member_count, total_cycles, cycles_completed, completed_at",
        )
        .in("status", ["completed", "payout_complete"])
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (qErr) throw new Error(qErr.message);

      const list = circles ?? [];
      // Fire all invariant fetches in parallel. Any single failure
      // falls back to invariant=null + invariantError populated so
      // one bad row doesn't blank the list.
      const invariants = await Promise.all(
        list.map(async (c: any) => {
          try {
            const { data, error: rpcErr } = await supabase.rpc(
              "get_circle_invariant",
              { p_circle_id: c.id },
            );
            if (rpcErr) throw new Error(rpcErr.message);
            return { invariant: data as CircleInvariant, invariantError: null };
          } catch (err) {
            return {
              invariant: null,
              invariantError: err instanceof Error ? err.message : String(err),
            };
          }
        }),
      );

      const merged: CircleRow[] = list.map((c: any, i: number) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        member_count: c.member_count,
        total_cycles: c.total_cycles,
        cycles_completed: c.cycles_completed,
        completed_at: c.completed_at,
        invariant: invariants[i].invariant,
        invariantError: invariants[i].invariantError,
      }));
      setRows(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (filter === "balanced" && r.invariant?.balanced !== true) return false;
      if (filter === "unbalanced" && r.invariant?.balanced !== false) return false;
      return true;
    });
  }, [rows, query, filter]);

  const counts = useMemo(() => {
    let balanced = 0;
    let unbalanced = 0;
    let unknown = 0;
    for (const r of rows) {
      if (r.invariant?.balanced === true) balanced++;
      else if (r.invariant?.balanced === false) unbalanced++;
      else unknown++;
    }
    return { total: rows.length, balanced, unbalanced, unknown };
  }, [rows]);

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.blockedText}>Admin only</Text>
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
        <Text style={styles.headerTitle}>Reconciliation</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.summaryRow}>
        <SummaryStat label="Total" value={counts.total} />
        <SummaryStat label="Balanced" value={counts.balanced} color="#059669" />
        <SummaryStat label="Unbalanced" value={counts.unbalanced} color={colors.errorText} />
      </View>

      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by circle name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.filterRow}>
          {(["all", "balanced", "unbalanced"] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === "all" ? "All" : f === "balanced" ? "Balanced" : "Unbalanced"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <AppFlashList
          data={visibleRows}
          keyExtractor={(it: CircleRow) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentTeal} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                {rows.length === 0
                  ? "No completed circles yet."
                  : "No circles match the current filter."}
              </Text>
            </View>
          }
          renderItem={({ item }: { item: CircleRow }) => {
            const inv = item.invariant;
            const netCents = inv?.net_cents ?? 0;
            const balanced = inv?.balanced ?? false;
            const canClose = inv?.can_close ?? false;
            const netColor = inv
              ? balanced
                ? "#059669"
                : colors.errorText
              : colors.textSecondary;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  navigation.navigate(Routes.CircleDetail, { circleId: item.id })
                }
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.member_count} members · {item.status}
                    {item.cycles_completed != null && item.total_cycles != null
                      ? ` · cycles ${item.cycles_completed}/${item.total_cycles}`
                      : ""}
                  </Text>
                  {item.invariantError ? (
                    <Text style={styles.rowError} numberOfLines={1}>
                      Invariant error: {item.invariantError}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowNet, { color: netColor }]}>
                    {inv
                      ? `${netCents >= 0 ? "+" : "-"}$${Math.abs(netCents / 100).toFixed(2)}${balanced ? " ✓" : " ⚠"}`
                      : "—"}
                  </Text>
                  {canClose ? (
                    <Text style={styles.rowCanClose}>ready to close</Text>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function SummaryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  controls: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  filterRow: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  chipActive: { backgroundColor: colors.primaryNavy, borderColor: colors.primaryNavy },
  chipText: { fontSize: 12, color: colors.textPrimary, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  listContent: { padding: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowName: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  rowMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  rowError: { fontSize: 10, color: colors.errorText, marginTop: 2, fontStyle: "italic" },
  rowRight: { alignItems: "flex-end" },
  rowNet: { fontSize: 14, fontWeight: "800" },
  rowCanClose: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  emptyText: { marginTop: 12, color: colors.textSecondary, textAlign: "center" },
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
});
