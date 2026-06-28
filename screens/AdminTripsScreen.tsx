// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminTripsScreen.tsx — admin trips list (Bucket B mod 4)
// ═══════════════════════════════════════════════════════════════════════════
//
// List + name/destination search. support admins are community-scoped
// via the circles.community_id link (trips themselves have no
// community_id — they hang off circles).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import AdminListSkeleton from "../components/AdminListSkeleton";
import AdminErrorState from "../components/AdminErrorState";
import AdminFilterChips from "../components/AdminFilterChips";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface TripRow {
  id: string;
  trip_name: string | null;
  destination: string | null;
  status: string | null;
  price_per_person: number | null;
  start_date: string | null;
  end_date: string | null;
  max_participants: number | null;
}

export default function AdminTripsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("role, community_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      const role = adminRow?.role as string | undefined;
      const communityId = adminRow?.community_id as string | null | undefined;

      // For support role, restrict to trips whose circle's community
      // matches admin's community_id. Resolve circle ids first.
      let scopedCircleIds: string[] | null = null;
      if (role === "support" && communityId) {
        const { data: scoped } = await supabase
          .from("circles")
          .select("id")
          .eq("community_id", communityId);
        scopedCircleIds = (scoped ?? []).map((r: any) => r.id);
      }

      const q = supabase
        .from("trips")
        .select(
          "id, trip_name, destination, status, price_per_person, start_date, end_date, max_participants",
        )
        .order("start_date", { ascending: false })
        .limit(200);
      if (scopedCircleIds) q.in("circle_id", scopedCircleIds);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setRows((data ?? []) as TripRow[]);
    } catch (err) {
      console.warn("[AdminTrips] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      if (q) {
        const inName = (r.trip_name ?? "").toLowerCase().includes(q);
        const inDest = (r.destination ?? "").toLowerCase().includes(q);
        if (!inName && !inDest) return false;
      }
      if (statusFilter && (r.status ?? "") !== statusFilter) return false;
      if (dateFilter === "upcoming" || dateFilter === "past") {
        const start = r.start_date ? new Date(r.start_date) : null;
        if (!start) return false;
        const isUpcoming = start.getTime() >= today.getTime();
        if (dateFilter === "upcoming" && !isUpcoming) return false;
        if (dateFilter === "past" && isUpcoming) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, dateFilter]);

  const hasActiveFilters = !!query || !!statusFilter || !!dateFilter;

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter(null);
    setDateFilter(null);
  }, []);

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.mutedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.trips.title")}</Text>
        <TouchableOpacity onPress={load} style={styles.headerBtn} disabled={loading}>
          <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("admin.trips.search_placeholder")}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {hasActiveFilters ? (
          <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>{t("admin.clear_filters")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filtersWrap}>
        <AdminFilterChips
          label={t("admin.filter_status")}
          allLabel={t("admin.filter_all")}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "draft", label: "draft" },
            { value: "published", label: "published" },
            { value: "closed", label: "closed" },
            { value: "cancelled", label: "cancelled" },
          ]}
        />
        <AdminFilterChips
          label={t("admin.filter_date_range")}
          allLabel={t("admin.filter_all")}
          value={dateFilter}
          onChange={setDateFilter}
          options={[
            { value: "upcoming", label: t("admin.filter_upcoming") },
            { value: "past", label: t("admin.filter_past") },
          ]}
        />
      </View>

      {error && rows.length === 0 ? (
        <AdminErrorState onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <AdminListSkeleton rowCount={5} showChip={false} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                navigation.navigate("AdminTripDetail", { tripId: item.id })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.trip_name || item.destination || "—"}
                </Text>
                {item.destination && item.trip_name ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.destination}
                  </Text>
                ) : null}
                <Text style={styles.rowMeta}>
                  {item.status ?? "—"} ·{" "}
                  {item.start_date
                    ? new Date(item.start_date).toLocaleDateString()
                    : "—"}
                  {item.end_date
                    ? ` → ${new Date(item.end_date).toLocaleDateString()}`
                    : ""}{" "}
                  · ${Number(item.price_per_person ?? 0).toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="airplane-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>{t("admin.trips.empty")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  headerTitle: { fontSize: typography.sectionHeader, fontWeight: typography.bold, color: NAVY },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: typography.body, color: NAVY, padding: 0 },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  clearBtnText: { fontSize: 11, color: "#991B1B", fontWeight: typography.bold },
  filtersWrap: { gap: 10, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 8,
  },
  rowName: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },
  rowMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  empty: { alignItems: "center", gap: 10, padding: spacing.xl },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
