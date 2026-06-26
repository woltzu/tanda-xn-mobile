// ═══════════════════════════════════════════════════════════════════════════
// screens/SubstituteDashboardScreen.tsx — Phase 2, migration 264+265
// ═══════════════════════════════════════════════════════════════════════════
//
// Elder-facing substitute rotation surface.
//
//   • Per-user toggle backing profiles.is_substitute_available.
//   • Read-only directory of currently-available substitutes.
//   • At-risk feed: open rows from substitute_needed_events scoped to
//     circles the current user is an active member of. Elders see a
//     "Activate substitute" button per row that opens a picker.
//   • Activation modal: lists available substitutes; selecting one calls
//     rotate_substitute(p_circle_id, p_at_risk_user_id, p_substitute_user_id,
//     p_cycle_id). The RPC itself enforces elder role + community + funds,
//     so the UI surfaces the full list and lets the server reject.
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
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useRoles } from "../hooks/useRoles";
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

interface AtRiskEvent {
  id: string;
  circle_id: string;
  at_risk_user_id: string;
  cycle_id: string | null;
  risk_score: number | null;
  reason: string | null;
  circle_name: string | null;
  at_risk_name: string | null;
  at_risk_avatar: string | null;
}

const SubstituteDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isElder } = useRoles();

  const [available, setAvailable] = useState<boolean>(false);
  const [toggling, setToggling] = useState(false);
  const [loadingMe, setLoadingMe] = useState(true);

  const [substitutes, setSubstitutes] = useState<SubstituteRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [atRiskEvents, setAtRiskEvents] = useState<AtRiskEvent[]>([]);
  const [loadingAtRisk, setLoadingAtRisk] = useState(true);

  const [modalEvent, setModalEvent] = useState<AtRiskEvent | null>(null);
  const [rotatingSubId, setRotatingSubId] = useState<string | null>(null);

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

  // ── Load open at-risk events for circles the user is a member of ──
  const loadAtRiskEvents = useCallback(async () => {
    if (!user?.id) {
      setLoadingAtRisk(false);
      return;
    }
    try {
      setLoadingAtRisk(true);
      const { data: memberships, error: mErr } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (mErr) throw new Error(mErr.message);
      const circleIds = (memberships ?? [])
        .map((r: any) => r.circle_id)
        .filter(Boolean);
      if (circleIds.length === 0) {
        setAtRiskEvents([]);
        return;
      }
      const { data, error } = await supabase
        .from("substitute_needed_events")
        .select(
          "id, circle_id, at_risk_user_id, cycle_id, risk_score, reason, circles:circle_id(name), profiles:at_risk_user_id(full_name, display_name, avatar_url)",
        )
        .eq("status", "open")
        .in("circle_id", circleIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      const rows: AtRiskEvent[] = (data ?? []).map((r: any) => ({
        id: r.id,
        circle_id: r.circle_id,
        at_risk_user_id: r.at_risk_user_id,
        cycle_id: r.cycle_id,
        risk_score: r.risk_score,
        reason: r.reason,
        circle_name: r.circles?.name ?? null,
        at_risk_name:
          r.profiles?.full_name ?? r.profiles?.display_name ?? null,
        at_risk_avatar: r.profiles?.avatar_url ?? null,
      }));
      setAtRiskEvents(rows);
    } catch (err: any) {
      console.warn("[SubstituteDashboard] at-risk load failed:", err);
      setAtRiskEvents([]);
    } finally {
      setLoadingAtRisk(false);
    }
  }, [user?.id]);
  useEffect(() => {
    loadAtRiskEvents();
  }, [loadAtRiskEvents]);

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

  // ── Activation handler: call rotate_substitute RPC ────────────────
  const handleSelectSubstitute = useCallback(
    async (substituteId: string) => {
      if (!modalEvent || rotatingSubId) return;
      setRotatingSubId(substituteId);
      try {
        const { error } = await supabase.rpc("rotate_substitute", {
          p_circle_id: modalEvent.circle_id,
          p_at_risk_user_id: modalEvent.at_risk_user_id,
          p_substitute_user_id: substituteId,
          p_cycle_id: modalEvent.cycle_id,
        });
        if (error) throw new Error(error.message);
        showToast(t("substitute.activate_success"), "success");
        setModalEvent(null);
        loadAtRiskEvents();
        loadSubstitutes();
      } catch (err: any) {
        showToast(err?.message ?? t("substitute.activate_failed"), "error");
      } finally {
        setRotatingSubId(null);
      }
    },
    [modalEvent, rotatingSubId, t, loadAtRiskEvents, loadSubstitutes],
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
        {/* At-risk feed — elders only */}
        {isElder ? (
          <>
            <Text style={styles.sectionTitle}>
              {t("substitute.at_risk_title")}
            </Text>
            {loadingAtRisk ? (
              <View style={styles.listLoading}>
                <ActivityIndicator size="small" color={TEAL} />
              </View>
            ) : atRiskEvents.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={36}
                  color="#CBD5E1"
                />
                <Text style={styles.emptyText}>
                  {t("substitute.no_at_risk")}
                </Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                {atRiskEvents.map((ev, idx) => {
                  const name = ev.at_risk_name ?? "—";
                  return (
                    <View
                      key={ev.id}
                      style={[
                        styles.atRiskRow,
                        idx < atRiskEvents.length - 1 && styles.rowBorder,
                      ]}
                    >
                      {ev.at_risk_avatar ? (
                        <Image
                          source={{ uri: ev.at_risk_avatar }}
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
                        {ev.circle_name ? (
                          <Text style={styles.atRiskSub} numberOfLines={1}>
                            {ev.circle_name}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.activateBtn}
                        onPress={() => setModalEvent(ev)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.activateBtnText}>
                          {t("substitute.activate_modal_title")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        {/* Coming-soon banner */}
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

      {/* Activation modal */}
      <Modal
        visible={modalEvent !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setModalEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("substitute.select_substitute")}
              </Text>
              <TouchableOpacity
                onPress={() => setModalEvent(null)}
                accessibilityRole="button"
                disabled={rotatingSubId !== null}
              >
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>
            {modalEvent?.at_risk_name ? (
              <Text style={styles.modalSubtitle}>
                {modalEvent.at_risk_name}
                {modalEvent.circle_name
                  ? ` · ${modalEvent.circle_name}`
                  : ""}
              </Text>
            ) : null}
            <ScrollView style={styles.modalList}>
              {substitutes.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {t("substitute.no_substitutes")}
                  </Text>
                </View>
              ) : (
                substitutes.map((s, idx) => {
                  const name = s.full_name ?? s.display_name ?? "—";
                  const isRotating = rotatingSubId === s.id;
                  const otherRotating =
                    rotatingSubId !== null && rotatingSubId !== s.id;
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
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.selectBtn,
                          otherRotating && styles.selectBtnDisabled,
                        ]}
                        disabled={otherRotating || isRotating}
                        onPress={() => handleSelectSubstitute(s.id)}
                        accessibilityRole="button"
                      >
                        {isRotating ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.selectBtnText}>
                            {t("substitute.select")}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  atRiskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  atRiskSub: {
    fontSize: typography.label,
    color: MUTED,
    marginTop: 2,
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
  activateBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activateBtnText: {
    color: "#FFFFFF",
    fontWeight: typography.bold,
    fontSize: typography.label,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  modalSubtitle: {
    fontSize: typography.label,
    color: MUTED,
    paddingHorizontal: spacing.lg,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  modalList: {
    paddingHorizontal: spacing.md,
  },
  selectBtn: {
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 76,
    alignItems: "center",
  },
  selectBtnDisabled: {
    opacity: 0.4,
  },
  selectBtnText: {
    color: "#FFFFFF",
    fontWeight: typography.bold,
    fontSize: typography.label,
  },
});
