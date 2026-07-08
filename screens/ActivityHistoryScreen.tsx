// screens/ActivityHistoryScreen.tsx
//
// Full activity list linked from Home's "Recent Activity" card. Uses
// the same useRecentActivity hook Home does, just with a much larger
// limit so we can slice out month sections client-side. Each month
// gets a "Share" affordance that exports that month's rows as CSV
// via RN's built-in Share API — no extra deps, no EF, works on iOS
// and Android in the same session. A follow-up will replace this
// with a PDF via a generate-statement Edge Function (Puppeteer in
// Deno needs a full Chromium bootstrap, out of scope for this
// bucket).

import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useRecentActivity, RecentActivityItem } from "../hooks/useRecentActivity";
import ScreenHeader from "../components/ScreenHeader";
import ScreenState from "../components/ScreenState";

type NavProp = StackNavigationProp<RootStackParamList>;

function monthKey(iso: string): string {
  // yyyy-mm sort key. Falls back to '0000-00' so undated rows sink
  // to the bottom rather than getting silently dropped.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "0000-00";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function toCsvRow(fields: (string | number)[]): string {
  return fields
    .map((f) => {
      const s = String(f);
      // RFC 4180 minimal: quote if contains comma/quote/newline; escape "
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(",");
}

function buildMonthCsv(
  monthTitle: string,
  rows: RecentActivityItem[],
  translate: (k: string, p?: any) => string,
): string {
  const header = ["Date", "Description", "Amount"];
  const lines = [
    `Statement — ${monthTitle}`,
    "",
    toCsvRow(header),
    ...rows.map((r) =>
      toCsvRow([
        r.date || r.createdAt,
        translate(r.descKey, r.descParams ?? {}),
        r.amount.toFixed(2),
      ]),
    ),
  ];
  return lines.join("\n");
}

export default function ActivityHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavProp>();
  // Fetch up to 500 events per source — plenty for a screen where
  // users scroll a few months back. Full history export is a
  // follow-up (server-side statement EF).
  const { items, loading } = useRecentActivity(500);

  const grouped = useMemo(() => {
    const map = new Map<string, RecentActivityItem[]>();
    for (const item of items) {
      const key = monthKey(item.createdAt);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    // Newest month first; rows within a month already sorted by
    // the underlying hook (created_at DESC).
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, rows]) => ({ key, label: monthLabel(key), rows }));
  }, [items]);

  const handleShareMonth = async (
    monthTitle: string,
    rows: RecentActivityItem[],
  ) => {
    try {
      const csv = buildMonthCsv(monthTitle, rows, t);
      await Share.share({
        title: `${monthTitle} — TandaXn statement`,
        message: csv,
      });
    } catch (err: any) {
      Alert.alert(
        t("activity_history.share_failed_title"),
        err?.message || t("activity_history.share_failed_body"),
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("activity_history.title")}
        onBackPress={() => navigation.goBack()}
      />
      {loading && items.length === 0 ? (
        <ScreenState type="loading" />
      ) : items.length === 0 ? (
        <ScreenState
          type="empty"
          title={t("activity_history.empty_title")}
          description={t("activity_history.empty_body")}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {grouped.map(({ key, label, rows }) => (
            <View key={key} style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{label}</Text>
                <TouchableOpacity
                  onPress={() => void handleShareMonth(label, rows)}
                  style={styles.shareButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("activity_history.share_button")}
                >
                  <Ionicons name="share-outline" size={16} color="#00C6AE" />
                  <Text style={styles.shareButtonText}>
                    {t("activity_history.share_button")}
                  </Text>
                </TouchableOpacity>
              </View>
              {rows.map((row, idx) => (
                <View
                  key={row.id}
                  style={[
                    styles.row,
                    idx === rows.length - 1 && styles.rowLast,
                  ]}
                >
                  <View
                    style={[
                      styles.icon,
                      {
                        backgroundColor:
                          row.direction === "in" ? "#DCFCE7" : "#FEF3C7",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        row.direction === "in"
                          ? "arrow-down-outline"
                          : "arrow-up-outline"
                      }
                      size={14}
                      color={row.direction === "in" ? "#059669" : "#B45309"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.desc} numberOfLines={1}>
                      {t(row.descKey, row.descParams ?? {})}
                    </Text>
                    <Text style={styles.date}>{row.date}</Text>
                  </View>
                  <Text
                    style={[
                      styles.amount,
                      { color: row.amount >= 0 ? "#059669" : "#111827" },
                    ]}
                  >
                    {row.amount >= 0 ? "+" : ""}${row.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 40 },
  monthCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
    gap: 4,
  },
  shareButtonText: { fontSize: 12, color: "#00C6AE", fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  desc: { fontSize: 14, color: "#111827" },
  date: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "600" },
});
