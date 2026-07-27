// ═══════════════════════════════════════════════════════════════════════════
// components/CircleAdminJoinCard.tsx — per-circle admin controls for joins
// ═══════════════════════════════════════════════════════════════════════════
//
// Rendered inside CircleDetailScreen's platform-admin block. Exposes:
//   * Toggle for circles.require_admin_approval_for_joins (mig 375)
//   * Summary chip "N pending · N suspicious" that deep-links to
//     AdminCircleJoinLog with the current circleId as the scope filter.
//
// Actual approve/reject actions happen on AdminCircleJoinLog — this card
// is the entry point + toggle only. Keeps the render surface here small.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { showToast } from "./Toast";

interface Props {
  circleId: string;
}

interface Stats {
  requireApproval: boolean;
  suspiciousCount: number;
  pendingCount: number;
}

export default function CircleAdminJoinCard({ circleId }: Props) {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [circleRes, pendingRes] = await Promise.all([
        supabase
          .from("circles")
          .select("require_admin_approval_for_joins, suspicious_join_count")
          .eq("id", circleId)
          .maybeSingle(),
        supabase
          .from("circle_membership_events")
          .select("id", { count: "exact", head: true })
          .eq("circle_id", circleId)
          .eq("status", "pending_approval"),
      ]);
      if (circleRes.error) throw new Error(circleRes.error.message);
      setStats({
        requireApproval: !!circleRes.data?.require_admin_approval_for_joins,
        suspiciousCount: Number(circleRes.data?.suspicious_join_count ?? 0),
        pendingCount: pendingRes.count ?? 0,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (nextValue: boolean) => {
    if (!stats) return;
    if (stats.requireApproval && !nextValue) {
      Alert.alert(
        t("admin.join_card.toggle_off_title"),
        t("admin.join_card.toggle_off_body"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("admin.join_card.toggle_off_confirm"),
            style: "destructive",
            onPress: () => applyToggle(false),
          },
        ],
      );
      return;
    }
    applyToggle(nextValue);
  };

  const applyToggle = async (nextValue: boolean) => {
    setToggling(true);
    try {
      const { data, error: err } = await supabase.rpc("set_circle_admin_approval", {
        p_circle_id: circleId,
        p_require_approval: nextValue,
        p_reason: null,
      });
      if (err) throw new Error(err.message);
      if (!(data as any)?.success) throw new Error("toggle_failed");
      setStats((prev) => (prev ? { ...prev, requireApproval: nextValue } : prev));
      showToast(
        nextValue
          ? t("admin.join_card.gate_enabled_toast")
          : t("admin.join_card.gate_disabled_toast"),
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setToggling(false);
    }
  };

  const openLog = () => {
    navigation.navigate("AdminCircleJoinLog", { circleId });
  };

  if (loading || !stats) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.accentTeal} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="people-outline" size={16} color={colors.primaryNavy} />
        <Text style={styles.title}>{t("admin.join_card.title")}</Text>
      </View>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>{t("admin.join_card.gate_label")}</Text>
          <Text style={styles.toggleHint}>{t("admin.join_card.gate_hint")}</Text>
        </View>
        <Switch
          value={stats.requireApproval}
          onValueChange={handleToggle}
          disabled={toggling}
          trackColor={{ false: "#CBD5E1", true: colors.accentTeal }}
          thumbColor="#FFFFFF"
        />
      </View>

      {stats.pendingCount > 0 || stats.suspiciousCount > 0 ? (
        <TouchableOpacity
          style={styles.summaryChip}
          onPress={openLog}
          accessibilityRole="button"
        >
          <View style={styles.chipTextWrap}>
            {stats.pendingCount > 0 ? (
              <Text style={styles.chipPending}>
                {t("admin.join_card.pending_count", { count: stats.pendingCount })}
              </Text>
            ) : null}
            {stats.pendingCount > 0 && stats.suspiciousCount > 0 ? (
              <Text style={styles.chipDot}> · </Text>
            ) : null}
            {stats.suspiciousCount > 0 ? (
              <Text style={styles.chipSuspicious}>
                <Ionicons name="alert-circle" size={11} color={colors.errorText} />
                {" "}
                {t("admin.join_card.suspicious_count", { count: stats.suspiciousCount })}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.emptyChip}
          onPress={openLog}
          accessibilityRole="button"
        >
          <Text style={styles.emptyChipText}>{t("admin.join_card.view_all")}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    gap: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 13, fontWeight: "700", color: colors.primaryNavy },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  toggleHint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  chipTextWrap: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  chipPending: { fontSize: 12, fontWeight: "700", color: colors.warningLabel },
  chipSuspicious: { fontSize: 12, fontWeight: "700", color: colors.errorText },
  chipDot: { fontSize: 12, color: colors.textSecondary },
  emptyChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
});
