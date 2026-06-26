// ═══════════════════════════════════════════════════════════════════════════
// screens/SubstituteDashboardScreen.tsx — Phase 2, migration 264 scaffold
// ═══════════════════════════════════════════════════════════════════════════
//
// Placeholder dashboard for the elder-triggered substitute rotation
// feature. Scope of this surface:
//
//   • Per-user toggle backing profiles.is_substitute_available.
//     Writes optimistically; rolls back on failure.
//   • Read-only directory of currently-available substitutes, scoped by
//     the get_profile_view RPC (migration 258) — so the list respects
//     bounded-belonging visibility automatically.
//   • "Coming soon" banner for the rotation activation flow itself
//     (rotate_substitute RPC + at-risk member feed) — those land in the
//     follow-up migration once the cycle / wallet / payout-position
//     schema fit is locked down.
//
// Reachable from ProfileScreen → Trust section → "Substitute dashboard".
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Switch,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface SubstituteRow {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const SubstituteDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [available, setAvailable] = useState<boolean>(false);
  const [toggling, setToggling] = useState(false);
  const [loadingMe, setLoadingMe] = useState(true);

  const [substitutes, setSubstitutes] = useState<SubstituteRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // ── Load the current user's toggle state ──────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setLoadingMe(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_substitute_available")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        setAvailable(data?.is_substitute_available === true);
      } catch (err: any) {
        console.warn("[SubstituteDashboard] toggle load failed:", err);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [user?.id]);

  // ── Load the read-only directory of available substitutes ─────────
  const loadSubstitutes = useCallback(async () => {
    try {
      setLoadingList(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, avatar_url")
        .eq("is_substitute_available", true)
        .order("full_name", { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);
      setSubstitutes((data ?? []) as SubstituteRow[]);
    } catch (err: any) {
      console.warn("[SubstituteDashboard] list load failed:", err);
      setSubstitutes([]);
    } finally {
      setLoadingList(false);
    }
  }, []);
  useEffect(() => {
    loadSubstitutes();
  }, [loadSubstitutes]);

  // ── Toggle handler (optimistic, rolls back on failure) ────────────
  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!user?.id || toggling) return;
      const prev = available;
      setAvailable(next);
      setToggling(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ is_substitute_available: next })
          .eq("id", user.id);
        if (error) throw new Error(error.message);
        showToast(
          next
            ? t("substitute.toggle_on_toast")
            : t("substitute.toggle_off_toast"),
          "success",
        );
        // Refresh the directory so the user's row appears/disappears.
        loadSubstitutes();
      } catch (err: any) {
        setAvailable(prev);
        showToast(err?.message ?? t("substitute.toggle_failed"), "error");
      } finally {
        setToggling(false);
      }
    },
    [user?.id, available, toggling, t, loadSubstitutes],
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.headerBtn}
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {t("substitute.dashboard_title")}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Coming-soon banner — explicit that activation isn't live yet. */}
        <View style={styles.banner}>
          <Ionicons name="time-outline" size={18} color="#92400E" />
          <Text style={styles.bannerText}>
            {t("substitute.coming_soon")}
          </Text>
        </View>

        {/* Self toggle */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleLabel}>
                {t("substitute.toggle_label")}
              </Text>
              <Text style={styles.toggleDescription}>
                {t("substitute.toggle_description")}
              </Text>
            </View>
            {loadingMe ? (
              <ActivityIndicator color={TEAL} />
            ) : (
              <Switch
                value={available}
                onValueChange={handleToggle}
                disabled={toggling}
                trackColor={{ false: "#D1D5DB", true: TEAL }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>
        </View>

        {/* Read-only list of available substitutes */}
        <Text style={styles.sectionTitle}>
          {t("substitute.available_substitutes")}
        </Text>
        {loadingList ? (
          <View style={styles.listLoading}>
            <ActivityIndicator size="small" color={TEAL} />
          </View>
        ) : substitutes.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              {t("substitute.no_substitutes")}
            </Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {substitutes.map((s, idx) => {
              const name = s.full_name ?? s.display_name ?? "—";
              const isMe = user?.id === s.id;
              return (
                <View
                  key={s.id}
                  style={[
                    styles.row,
                    idx < substitutes.length - 1 && styles.rowBorder,
                  ]}
                >
                  {s.avatar_url ? (
                    <Image
                      source={{ uri: s.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>
                        {(name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {name}
                    </Text>
                    {isMe ? (
                      <Text style={styles.rowMeChip}>
                        {t("substitute.you_chip")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SubstituteDashboardScreen;

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
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: typography.label,
    color: "#92400E",
    fontWeight: typography.medium,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  toggleDescription: {
    fontSize: typography.label,
    color: MUTED,
    marginTop: 4,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 6,
    marginLeft: 4,
  },
  listCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  listLoading: {
    padding: spacing.lg,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    gap: 10,
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body,
    color: MUTED,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: NAVY,
    fontWeight: typography.bold,
    fontSize: typography.body,
  },
  rowName: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.medium,
  },
  rowMeChip: {
    marginTop: 2,
    fontSize: typography.label,
    color: TEAL,
    fontWeight: typography.bold,
  },
});
