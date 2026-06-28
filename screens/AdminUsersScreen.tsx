// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminUsersScreen.tsx — admin users list (Bucket B mod 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// List + name/email search. support-role admins see only members of their
// community (via community_memberships join). Tap → AdminUserDetail.
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

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export default function AdminUsersScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kycFilter, setKycFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

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

      let scopedIds: string[] | null = null;
      if (role === "support" && communityId) {
        const { data: memberships } = await supabase
          .from("community_memberships")
          .select("user_id")
          .eq("community_id", communityId)
          .eq("status", "active");
        scopedIds = (memberships ?? []).map((r: any) => r.user_id);
      }

      const q = supabase
        .from("profiles")
        .select("id, full_name, email, kyc_status, role, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (scopedIds) q.in("id", scopedIds);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setRows((data ?? []) as UserRow[]);
    } catch (err) {
      console.warn("[AdminUsers] load failed:", err);
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
    return rows.filter((r) => {
      if (q) {
        const inName = (r.full_name ?? "").toLowerCase().includes(q);
        const inEmail = (r.email ?? "").toLowerCase().includes(q);
        if (!inName && !inEmail) return false;
      }
      if (kycFilter && (r.kyc_status ?? "none") !== kycFilter) return false;
      if (statusFilter === "active" && r.is_active === false) return false;
      if (statusFilter === "suspended" && r.is_active !== false) return false;
      if (roleFilter && (r.role ?? "member") !== roleFilter) return false;
      return true;
    });
  }, [rows, query, kycFilter, statusFilter, roleFilter]);

  // Role options come from the loaded rows so we don't hardcode the long
  // tail of elder/tier roles. Sorted for deterministic ordering.
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.role) set.add(r.role);
    });
    return Array.from(set)
      .sort()
      .map((value) => ({ value, label: value }));
  }, [rows]);

  const hasActiveFilters =
    !!query || !!kycFilter || !!statusFilter || !!roleFilter;

  const clearFilters = useCallback(() => {
    setQuery("");
    setKycFilter(null);
    setStatusFilter(null);
    setRoleFilter(null);
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
        <Text style={styles.headerTitle}>{t("admin.users.title")}</Text>
        <TouchableOpacity onPress={load} style={styles.headerBtn} disabled={loading}>
          <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("admin.users.search_placeholder")}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
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
            { value: "active", label: t("admin.users.active_chip") },
            { value: "suspended", label: t("admin.users.suspended_chip") },
          ]}
        />
        <AdminFilterChips
          label={t("admin.filter_kyc")}
          allLabel={t("admin.filter_all")}
          value={kycFilter}
          onChange={setKycFilter}
          options={[
            { value: "none", label: "none" },
            { value: "pending", label: "pending" },
            { value: "verified", label: "verified" },
            { value: "rejected", label: "rejected" },
          ]}
        />
        {roleOptions.length > 1 ? (
          <AdminFilterChips
            label={t("admin.filter_role")}
            allLabel={t("admin.filter_all")}
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleOptions}
          />
        ) : null}
      </View>

      {error && rows.length === 0 ? (
        <AdminErrorState onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <AdminListSkeleton rowCount={5} showChip={true} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                navigation.navigate("AdminUserDetail", { userId: item.id })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.full_name || t("admin.users.no_name")}
                </Text>
                <Text style={styles.rowEmail} numberOfLines={1}>
                  {item.email ?? "—"}
                </Text>
                <View style={styles.rowMeta}>
                  <Chip label={`KYC: ${item.kyc_status ?? "none"}`} />
                  {item.role && item.role !== "member" ? (
                    <Chip label={item.role} />
                  ) : null}
                  {item.is_active === false ? (
                    <Chip label={t("admin.users.suspended_chip")} tone="danger" />
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>{t("admin.users.empty")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, tone }: { label: string; tone?: "danger" }) {
  return (
    <View
      style={[
        styles.chip,
        tone === "danger" && { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          tone === "danger" && { color: "#991B1B" },
        ]}
      >
        {label}
      </Text>
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
  rowEmail: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  rowMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,198,174,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.35)",
  },
  chipText: { fontSize: 11, color: NAVY, fontWeight: typography.bold },
  empty: { alignItems: "center", gap: 10, padding: spacing.xl },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
