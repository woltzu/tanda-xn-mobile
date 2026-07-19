// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminKYCReviewQueueScreen.tsx — admin KYC review queue
// ═══════════════════════════════════════════════════════════════════════════
//
// Lists rows from `kyc_verifications` (mig 053 + 359 + 360) for admin
// triage. Filter chips at the top switch between pending / approved /
// rejected. Tap → AdminKYCReviewDetail. Scope-aware via useAdminScope:
// super_admin/admin see all rows; support admins see only their
// community's members.
//
// Read path: direct supabase.from() query with an inner join to
// profiles for the reviewer-facing name/email. Reviews (approve/reject)
// go through the SECURITY DEFINER RPCs from mig 360.
//
// UI strings are inline English for the first pass. i18n keys can be
// added as a follow-up — the labels have no per-locale translation
// pressure yet (admin-only screen, staff-facing).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useAdminScope } from "../hooks/useAdminScope";

type StatusFilter = "pending" | "approved" | "rejected";
const FILTERS: StatusFilter[] = ["pending", "approved", "rejected"];

// Pending in the UI covers both raw 'pending' and the manual-upload
// 'provider_pending' status the KYCDocumentScreen writes.
const STATUS_PREDICATES: Record<StatusFilter, string[]> = {
  pending: ["pending", "provider_pending"],
  approved: ["approved"],
  rejected: ["rejected"],
};

interface Row {
  id: string;
  member_id: string;
  status: string;
  id_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  member_full_name: string | null;
  member_email: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: colors.warningBg, fg: colors.warningLabel },
  provider_pending: { bg: colors.warningBg, fg: colors.warningLabel },
  approved: { bg: "#D1FAE5", fg: colors.successLabel },
  rejected: { bg: colors.errorBg, fg: "#991B1B" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtIdType(t: string | null): string {
  switch (t) {
    case "passport":
      return "Passport";
    case "national_id":
      return "National ID";
    case "drivers_license":
      return "Driver's License";
    case "residence_permit":
      return "Residence Permit";
    default:
      return t ?? "—";
  }
}

export default function AdminKYCReviewQueueScreen() {
  const navigation = useNavigation<any>();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();

  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (scope.loading) return;
    if (scope.noCommunityAssigned) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("kyc_verifications")
        .select(
          "id, member_id, status, id_type, created_at, updated_at, profiles:member_id(full_name, email)",
        )
        .in("status", STATUS_PREDICATES[filter])
        .order("updated_at", { ascending: false })
        .limit(200);

      if (scope.isSupport && scope.scopedUserIds) {
        q = q.in("member_id", scope.scopedUserIds);
      }

      const { data, error: err } = await q;
      if (err) throw new Error(err.message);
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        member_id: r.member_id,
        status: r.status,
        id_type: r.id_type,
        created_at: r.created_at,
        updated_at: r.updated_at,
        member_full_name: r.profiles?.full_name ?? null,
        member_email: r.profiles?.email ?? null,
      }));
      setRows(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filter, scope.loading, scope.noCommunityAssigned, scope.isSupport, scope.scopedUserIds]);

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pendingCount = useMemo(
    () => (filter === "pending" ? rows.length : 0),
    [filter, rows.length],
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
        <Text style={styles.headerTitle}>
          KYC Review Queue
          {pendingCount > 0 ? ` (${pendingCount})` : ""}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {scope.noCommunityAssigned ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Your admin account has no community assigned.</Text>
        </View>
      ) : loading && rows.length === 0 ? (
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
        <FlatList
          data={rows}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentTeal} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                No {filter} submissions.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  navigation.navigate("AdminKYCReviewDetail", { verificationId: item.id })
                }
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>
                    {item.member_full_name ?? "(no name)"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {fmtIdType(item.id_type)} · {fmtDate(item.updated_at)}
                  </Text>
                  {item.member_email ? (
                    <Text style={styles.rowEmail}>{item.member_email}</Text>
                  ) : null}
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.fg }]}>
                    {item.status.replace("_", " ")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  filtersWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.cardBg,
  },
  chipActive: { backgroundColor: colors.primaryNavy, borderColor: colors.primaryNavy },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  listContent: { padding: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowName: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowEmail: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
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
