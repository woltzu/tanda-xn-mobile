// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminBugReportsScreen.tsx — admin bug-report queue
// ═══════════════════════════════════════════════════════════════════════════
//
// Lists bug_reports rows (migration 273) for admin triage. Status filter
// chips at the top, tap → AdminBugReportDetail. Scoped via
// useAdminScope: super_admin/admin see all; support admins only see
// reports filed by users in their community (via scopedUserIds).
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
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useAdminScope } from "../hooks/useAdminScope";
import AdminListSkeleton from "../components/AdminListSkeleton";
import AdminErrorState from "../components/AdminErrorState";
import AdminFilterChips from "../components/AdminFilterChips";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface ReportRow {
  id: string;
  user_id: string;
  screen_name: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  user_full_name: string | null;
  user_email: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#FEE2E2", fg: "#991B1B" },
  in_progress: { bg: "#FEF3C7", fg: "#92400E" },
  resolved: { bg: "#D1FAE5", fg: "#065F46" },
  closed: { bg: "#E5E7EB", fg: "#374151" },
};

export default function AdminBugReportsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    if (scope.loading) return;
    if (scope.noCommunityAssigned) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = supabase
        .from("bug_reports")
        .select(
          "id, user_id, screen_name, description, status, created_at, profiles:user_id(full_name, email)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      // Support admins see only reports from users in their community.
      // The bug_reports table has no community_id, so we filter via the
      // pre-resolved scopedUserIds list from the scope hook.
      if (scope.scopedUserIds) q.in("user_id", scope.scopedUserIds);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setRows(
        ((data ?? []) as any[]).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          screen_name: r.screen_name,
          description: r.description,
          status: r.status,
          created_at: r.created_at,
          user_full_name: r.profiles?.full_name ?? null,
          user_email: r.profiles?.email ?? null,
        })),
      );
    } catch (err) {
      console.warn("[AdminBugReports] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, scope.loading, scope.noCommunityAssigned, scope.scopedUserIds]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const qLower = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && (r.status ?? "open") !== statusFilter) return false;
      if (qLower) {
        const inName = (r.user_full_name ?? "").toLowerCase().includes(qLower);
        const inEmail = (r.user_email ?? "").toLowerCase().includes(qLower);
        const inDesc = (r.description ?? "").toLowerCase().includes(qLower);
        if (!inName && !inEmail && !inDesc) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter]);

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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("admin_bug_reports.title")}
        </Text>
        <TouchableOpacity
          onPress={load}
          style={styles.headerBtn}
          disabled={loading}
        >
          <Ionicons
            name="refresh"
            size={22}
            color={loading ? "#CBD5E1" : NAVY}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("admin.search_placeholder")}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.filtersWrap}>
        <AdminFilterChips
          label={t("admin.filter_status")}
          allLabel={t("admin_bug_reports.status_all")}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "open", label: t("admin_bug_reports.status_open") },
            {
              value: "in_progress",
              label: t("admin_bug_reports.status_in_progress"),
            },
            {
              value: "resolved",
              label: t("admin_bug_reports.status_resolved"),
            },
            { value: "closed", label: t("admin_bug_reports.status_closed") },
          ]}
        />
      </View>

      {scope.noCommunityAssigned ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={36} color="#CBD5E1" />
          <Text style={styles.mutedText}>
            {t("admin.no_community_assigned")}
          </Text>
        </View>
      ) : error && rows.length === 0 ? (
        <AdminErrorState onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <AdminListSkeleton rowCount={5} showChip={true} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={TEAL}
            />
          }
          renderItem={({ item }) => {
            const status = item.status ?? "open";
            const palette = STATUS_COLORS[status] ?? STATUS_COLORS.closed;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  navigation.navigate("AdminBugReportDetail", {
                    reportId: item.id,
                  })
                }
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowTopLine}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.user_full_name ||
                        item.user_email ||
                        t("admin.users.no_name")}
                    </Text>
                    <View
                      style={[styles.statusChip, { backgroundColor: palette.bg }]}
                    >
                      <Text style={[styles.statusChipText, { color: palette.fg }]}>
                        {t(`admin_bug_reports.status_${status}`)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.screen_name || "—"}
                  </Text>
                  <Text style={styles.rowDesc} numberOfLines={2}>
                    {item.description || ""}
                  </Text>
                  <Text style={styles.rowDate}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bug-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>
                {t("admin_bug_reports.empty")}
              </Text>
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
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
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
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowName: {
    flex: 1,
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.bold,
  },
  rowMeta: { fontSize: typography.label, color: MUTED },
  rowDesc: { fontSize: typography.label, color: NAVY },
  rowDate: { fontSize: 11, color: MUTED, marginTop: 2 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusChipText: { fontSize: 11, fontWeight: typography.bold },
  empty: { alignItems: "center", gap: 10, padding: spacing.xl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
