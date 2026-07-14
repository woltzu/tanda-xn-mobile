// ══════════════════════════════════════════════════════════════════════════════
// screens/MyCirclesScreen.tsx — "See all my circles" browse screen.
// ══════════════════════════════════════════════════════════════════════════════
//
// HomeScreen's Active Circles card only shows currently-running circles.
// This screen lists EVERY circle the user is a member of regardless of
// lifecycle state (active, pending, paused, completed, cancelled), so
// they can review history + jump into any of them.
//
// Data source: CirclesContext.myCircles — the full membership list
// (already includes non-active entries; see the memoized filter at
// HomeScreen.tsx:272 for the active-only slice). Pull-to-refresh
// re-runs refreshCircles which re-fetches from the DB via the
// context's throttled path.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { AppFlashList } from "../components/AppFlashList";
import { RootStackParamList } from "../App";
import { colors } from "../theme/tokens";
import { useCircles, Circle } from "../context/CirclesContext";

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Status → pill copy + color. Text-only status labels (i18n arrives
// later) so we don't add new translation keys just for this screen.
function statusPresentation(status: string): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "active":
      return { label: "Active", color: "#065F46", bg: "#D1FAE5" };
    case "pending":
    case "forming":
      return { label: "Pending", color: "#92400E", bg: "#FEF3C7" };
    case "paused":
      return { label: "Paused", color: "#5B21B6", bg: "#EDE9FE" };
    case "completed":
      return { label: "Completed", color: "#1E40AF", bg: "#DBEAFE" };
    case "cancelled":
      return { label: "Cancelled", color: "#991B1B", bg: "#FEE2E2" };
    default:
      return { label: status, color: colors.textSecondary, bg: colors.screenBg };
  }
}

function frequencyLabel(freq: Circle["frequency"]): string {
  switch (freq) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "one-time":
      return "One-time";
    default:
      return String(freq);
  }
}

export default function MyCirclesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { myCircles, refreshCircles } = useCircles();
  const [refreshing, setRefreshing] = useState(false);

  // Sort so still-actionable circles surface first, completed/cancelled
  // fall to the bottom. Within a status bucket, most recent first.
  const orderedCircles = useMemo(() => {
    const priority: Record<string, number> = {
      active: 0,
      pending: 1,
      forming: 1,
      paused: 2,
      completed: 3,
      cancelled: 4,
    };
    return [...myCircles].sort((a, b) => {
      const pa = priority[a.status] ?? 99;
      const pb = priority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [myCircles]);

  // Refresh on every focus so a payout/cancellation that landed while
  // the user was elsewhere shows up on their next visit.
  useFocusEffect(
    useCallback(() => {
      refreshCircles?.().catch(() => undefined);
    }, [refreshCircles]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCircles?.();
    } finally {
      setRefreshing(false);
    }
  }, [refreshCircles]);

  const goToDetail = useCallback(
    (circleId: string) => {
      navigation.navigate("CircleDetail", { circleId });
    },
    [navigation],
  );

  const renderRow = useCallback(
    ({ item }: { item: Circle }) => {
      const pill = statusPresentation(item.status);
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => goToDetail(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.emoji}>{item.emoji || "💰"}</Text>
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {frequencyLabel(item.frequency)} · $
                {item.amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                {" · "}
                {item.currentMembers}/{item.memberCount} members
              </Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <View style={[styles.pill, { backgroundColor: pill.bg }]}>
              <Text style={[styles.pillText, { color: pill.color }]}>
                {pill.label}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>
      );
    },
    [goToDetail],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Circles</Text>
        <View style={styles.backButton} />
      </View>

      {orderedCircles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No circles yet</Text>
          <Text style={styles.emptyBody}>
            Circles you create or join will appear here — past ones included.
          </Text>
        </View>
      ) : (
        <AppFlashList<Circle>
          data={orderedCircles}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          estimatedItemSize={76}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle ?? "#E5E7EB",
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.textPrimary },
  listContent: { paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.cardBg,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
  },
  rowLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  emoji: { fontSize: 26, marginRight: 12 },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  pillText: { fontSize: 11, fontWeight: "600" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
  },
});
