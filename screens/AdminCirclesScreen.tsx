// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminCirclesScreen.tsx — admin circles list (Bucket B mod 3)
// ═══════════════════════════════════════════════════════════════════════════
//
// List + name search. support-role admins see only circles in their
// community via circles.community_id. Tap → AdminCircleDetail.
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

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface CircleRow {
  id: string;
  name: string | null;
  status: string | null;
  amount: number | null;
  member_count: number | null;
  current_members: number | null;
  community_id: string | null;
  community_name: string | null;
  created_at: string | null;
}

export default function AdminCirclesScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<CircleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("role, community_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      const role = adminRow?.role as string | undefined;
      const communityId = adminRow?.community_id as string | null | undefined;

      const q = supabase
        .from("circles")
        .select(
          "id, name, status, amount, member_count, current_members, community_id, created_at, communities:community_id(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (role === "support" && communityId) q.eq("community_id", communityId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setRows(
        ((data ?? []) as any[]).map((r) => ({
          ...r,
          community_name: r.communities?.name ?? null,
        })),
      );
    } catch (err) {
      console.warn("[AdminCircles] load failed:", err);
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
    if (!q) return rows;
    return rows.filter((r) => (r.name ?? "").toLowerCase().includes(q));
  }, [rows, query]);

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
        <Text style={styles.headerTitle}>{t("admin.circles.title")}</Text>
        <TouchableOpacity onPress={load} style={styles.headerBtn} disabled={loading}>
          <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("admin.circles.search_placeholder")}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                navigation.navigate("AdminCircleDetail", { circleId: item.id })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name ?? "—"}
                </Text>
                {item.community_name ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.community_name}
                  </Text>
                ) : null}
                <Text style={styles.rowMeta}>
                  {item.status ?? "—"} ·{" "}
                  {t("admin.circles.members_n", {
                    count: item.current_members ?? 0,
                    total: item.member_count ?? 0,
                  })}{" "}
                  · ${Number(item.amount ?? 0).toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="refresh-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>{t("admin.circles.empty")}</Text>
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
