// ═══════════════════════════════════════════════════════════════════════════
// screens/DisputesListScreen.tsx — Phase 2, migration 261
// ═══════════════════════════════════════════════════════════════════════════
//
// Lists disputes accessible to the current user. RLS does the filtering
// (filer / respondent / mediator / elder in the circle's community).
// Optional `circleId` route param scopes to a single circle.
//
// Each row is tappable → DisputeDetail.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { AppFlashList } from "../components/AppFlashList";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { Routes } from "../lib/routes";
import { useDisputes, Dispute, DisputeStatus } from "../hooks/useDisputes";

type Nav = StackNavigationProp<RootStackParamList, "DisputesList">;
type Rt = RouteProp<RootStackParamList, "DisputesList">;

const STATUS_COLOR: Record<DisputeStatus, { bg: string; fg: string }> = {
  open:          { bg: "#FEF3C7", fg: "#92400E" },
  under_review:  { bg: "#DBEAFE", fg: "#1E40AF" },
  resolved:      { bg: "#DCFCE7", fg: "#166534" },
  rejected:      { bg: "#FEE2E2", fg: "#991B1B" },
  closed:        { bg: "#E5E7EB", fg: "#374151" },
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DisputesListScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const circleId = route.params?.circleId;
  const { disputes, isLoading, error, refresh } = useDisputes(circleId);

  const renderRow = useCallback(
    ({ item }: { item: Dispute }) => {
      const color = STATUS_COLOR[item.status] ?? STATUS_COLOR.open;
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => nav.navigate("DisputeDetail", { disputeId: item.id })}
          accessibilityRole="button"
        >
          <View style={styles.rowMain}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {relativeDate(item.created_at)}
            </Text>
          </View>
          <View
            style={[styles.statusChip, { backgroundColor: color.bg }]}
          >
            <Text style={[styles.statusChipText, { color: color.fg }]}>
              {t(`dispute.status_${item.status}`)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      );
    },
    [nav, t],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <AppFlashList
        data={disputes}
        keyExtractor={(d) => d.id}
        estimatedItemSize={100}
        renderItem={renderRow}
        contentContainerStyle={
          disputes.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>{t("dispute.no_disputes")}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", padding: 32 },
  emptyText: { marginTop: 12, color: "#6B7280", fontSize: 14 },
  errorBanner: { backgroundColor: "#FEE2E2", padding: 12 },
  errorText: { color: "#991B1B", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  rowMain: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: "#111827" },
  meta: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  statusChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusChipText: { fontSize: 11, fontWeight: "700" },
});
