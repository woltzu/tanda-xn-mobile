// ═══════════════════════════════════════════════════════════════════════════
// screens/ElderNominationsScreen.tsx — Phase 2 Bucket A
// ═══════════════════════════════════════════════════════════════════════════
//
// Lists pending elder_nominations (migration 248) and lets the current
// elder vote Approve / Reject via vote_elder_nomination RPC. Auto-promotion
// happens server-side at 3 yes-votes (see migration header note on the
// threshold being too high for the current elder cohort).
//
// Access control is client-side gating (route presence) + server-side RPC
// gating (raises if caller isn't an elder). Non-elders who somehow land
// here see the "You aren't an elder" guard render.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useRoles } from "../hooks/useRoles";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const GREEN = "#047857";
const RED = "#DC2626";
const MUTED = "#6B7280";

interface NominationRow {
  id: string;
  nominee_id: string;
  nominator_id: string;
  reason: string | null;
  votes_for: number;
  votes_against: number;
  created_at: string;
  nominee_name: string | null;
  nominator_name: string | null;
}

const ElderNominationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isElder, isLoading: roleLoading } = useRoles(user?.id);

  const [items, setItems] = useState<NominationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      // Two-query approach: nominations + profile lookups. The N+1 risk is
      // bounded — pending nominations are a small set (typically < 20).
      const { data: noms, error: e } = await supabase
        .from("elder_nominations")
        .select("id, nominee_id, nominator_id, reason, votes_for, votes_against, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (e) throw new Error(e.message);
      const rows = noms ?? [];
      const ids = Array.from(
        new Set(rows.flatMap((r) => [r.nominee_id, r.nominator_id])),
      );
      const nameMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        for (const p of profs ?? []) {
          if (p.full_name) nameMap.set(p.id, p.full_name);
        }
      }
      setItems(
        rows.map((r) => ({
          ...r,
          nominee_name: nameMap.get(r.nominee_id) ?? null,
          nominator_name: nameMap.get(r.nominator_id) ?? null,
        })),
      );
    } catch (err: any) {
      console.warn("[ElderNominationsScreen] fetch failed:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleVote = async (id: string, voteFor: boolean) => {
    try {
      setVoting(id);
      const { error: e } = await supabase.rpc("vote_elder_nomination", {
        p_nomination_id: id,
        p_vote: voteFor,
      });
      if (e) throw new Error(e.message);
      await fetchPending();
    } catch (err: any) {
      Alert.alert(
        t("role.vote_failed_title"),
        err?.message ?? t("role.vouch_failed"),
      );
    } finally {
      setVoting(null);
    }
  };

  // ── Header ──────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t("role.nomination_pending")}</Text>
      <View style={styles.headerBtn} />
    </View>
  );

  if (roleLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isElder) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={36} color={MUTED} />
          <Text style={styles.guardText}>{t("role.elder_only_guard")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <Ionicons name="ribbon-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>{t("role.nomination_no_pending")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      {renderHeader()}
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isOwnNomination = item.nominator_id === user?.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.nominee_name ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nomineeName} numberOfLines={1}>
                    {item.nominee_name ?? t("role.unknown_member")}
                  </Text>
                  <Text style={styles.nominatorLine} numberOfLines={1}>
                    {t("role.nominated_by", {
                      name: item.nominator_name ?? t("role.unknown_member"),
                    })}
                  </Text>
                </View>
                <View style={styles.voteCount}>
                  <Text style={styles.voteCountFor}>{item.votes_for} ✓</Text>
                  <Text style={styles.voteCountAgainst}>{item.votes_against} ✗</Text>
                </View>
              </View>
              {item.reason ? (
                <Text style={styles.reason} numberOfLines={3}>
                  {item.reason}
                </Text>
              ) : null}
              {isOwnNomination ? (
                <Text style={styles.ownNote}>
                  {t("role.cant_vote_own_nomination")}
                </Text>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnReject]}
                    onPress={() => handleVote(item.id, false)}
                    disabled={voting === item.id}
                  >
                    {voting === item.id ? (
                      <ActivityIndicator size="small" color={RED} />
                    ) : (
                      <Text style={[styles.btnText, { color: RED }]}>
                        {t("role.nomination_vote_against")}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnApprove]}
                    onPress={() => handleVote(item.id, true)}
                    disabled={voting === item.id}
                  >
                    {voting === item.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.btnText, { color: "#FFFFFF" }]}>
                        {t("role.nomination_vote_for")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
};

export default ElderNominationsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: 10 },
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

  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: NAVY, fontSize: typography.body, fontWeight: typography.bold },
  nomineeName: { fontSize: typography.body, fontWeight: typography.bold, color: NAVY },
  nominatorLine: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  voteCount: { alignItems: "flex-end", gap: 2 },
  voteCountFor: { fontSize: typography.label, color: GREEN, fontWeight: typography.bold },
  voteCountAgainst: { fontSize: typography.label, color: RED, fontWeight: typography.bold },
  reason: {
    fontSize: typography.bodySmall,
    color: NAVY,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  btnReject: { backgroundColor: "#FEE2E2" },
  btnApprove: { backgroundColor: GREEN },
  btnText: { fontSize: typography.body, fontWeight: typography.bold },
  ownNote: {
    fontSize: typography.label,
    color: MUTED,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },
  emptyText: {
    fontSize: typography.body,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
  },
  guardText: {
    fontSize: typography.body,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
  },
});
