// ══════════════════════════════════════════════════════════════════════════════
// PayoutHistoryScreen — list of every payout the user has received,
// across all circles. Reuses usePayouts.loadUserPayouts() which is
// backed by the existing PayoutService.getUserPayouts(). Grouped by
// circle so a user with multiple circles can scan their history per-
// circle; sorted within each group by date desc. Tap a row → the
// corresponding CircleDetail.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { usePayouts } from "../hooks/usePayouts";
import type { Payout } from "../services/PayoutService";
import { useEventTracker } from "../hooks/useEventTracker";

type Nav = StackNavigationProp<RootStackParamList>;

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatAmount = (amount: number, currency?: string): string => {
  const symbol = !currency || currency === "USD" ? "$" : "";
  const suffix = currency && currency !== "USD" ? ` ${currency}` : "";
  return `${symbol}${amount.toFixed(2)}${suffix}`;
};

type Section = {
  circleId: string;
  circleName: string;
  total: number;
  payouts: Payout[];
};

export default function PayoutHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { payouts, isLoading, loadUserPayouts } = usePayouts();
  const { track } = useEventTracker();
  const openedTrackedRef = useRef(false);

  useEffect(() => {
    if (!openedTrackedRef.current) {
      openedTrackedRef.current = true;
      track({
        eventType: "payout_history_opened",
        eventCategory: "savings",
        eventAction: "history_opened",
      });
    }
    loadUserPayouts().catch(() => undefined);
  }, [loadUserPayouts, track]);

  // Group by circle; sort each group by date desc; sort groups by the
  // most-recent payout in each group (so the "freshest" circle is on top).
  const sections = useMemo<Section[]>(() => {
    const byCircle = new Map<string, Section>();
    for (const p of payouts) {
      const id = p.circleId;
      let s = byCircle.get(id);
      if (!s) {
        s = {
          circleId: id,
          circleName: p.circleName ?? "",
          total: 0,
          payouts: [],
        };
        byCircle.set(id, s);
      }
      s.payouts.push(p);
      s.total += p.netAmount ?? p.amount ?? 0;
    }
    const list = Array.from(byCircle.values());
    for (const s of list) {
      s.payouts.sort(
        (a, b) =>
          new Date(b.completedAt ?? b.createdAt).getTime() -
          new Date(a.completedAt ?? a.createdAt).getTime(),
      );
    }
    list.sort((a, b) => {
      const aDate = new Date(
        a.payouts[0]?.completedAt ?? a.payouts[0]?.createdAt ?? 0,
      ).getTime();
      const bDate = new Date(
        b.payouts[0]?.completedAt ?? b.payouts[0]?.createdAt ?? 0,
      ).getTime();
      return bDate - aDate;
    });
    return list;
  }, [payouts]);

  const renderHeader = () => (
    <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t("payout_history.title")}</Text>
      <View style={{ width: 38 }} />
    </LinearGradient>
  );

  if (isLoading && payouts.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C6AE" />
        </View>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.center}>
          <Ionicons name="cash-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("payout_history.empty")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={sections}
        keyExtractor={(s) => s.circleId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: section }) => (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionName} numberOfLines={1}>
                {section.circleName || section.circleId.slice(0, 8)}
              </Text>
              <Text style={styles.sectionTotal}>
                {formatAmount(section.total, section.payouts[0]?.currency)}
              </Text>
            </View>
            {section.payouts.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.payoutRow}
                onPress={() =>
                  navigation.navigate("CircleDetail", { circleId: p.circleId })
                }
                accessibilityRole="button"
              >
                <View style={styles.payoutIcon}>
                  <Ionicons name="arrow-down" size={16} color="#059669" />
                </View>
                <View style={styles.payoutInfo}>
                  <Text style={styles.payoutDate}>
                    {formatDate(p.completedAt ?? p.createdAt)}
                  </Text>
                  <Text style={styles.payoutCycle}>
                    {t("payout_history.cycle_label", { cycle: p.cycleNumber })}
                  </Text>
                </View>
                <Text style={styles.payoutAmount}>
                  {formatAmount(p.netAmount ?? p.amount ?? 0, p.currency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  emptyText: { fontSize: 14, color: "#6B7280" },
  listContent: { padding: 16, paddingBottom: 32 },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  sectionName: { flex: 1, fontSize: 15, fontWeight: "700", color: "#0A2342" },
  sectionTotal: { fontSize: 13, fontWeight: "700", color: "#059669" },
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  payoutIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  payoutInfo: { flex: 1 },
  payoutDate: { fontSize: 13, fontWeight: "600", color: "#0A2342" },
  payoutCycle: { fontSize: 11, color: "#6B7280", marginTop: 1 },
  payoutAmount: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
});
