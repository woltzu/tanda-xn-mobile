// ═══════════════════════════════════════════════════════════════════════════
// screens/OrganizerPayoutHistoryScreen.tsx — Stripe Connect payout list
// ═══════════════════════════════════════════════════════════════════════════
//
// One row per Stripe Transfer the organizer's trips have produced.
// Engine layer groups N trip_payments into a single row per transfer
// (release-trip-funds issues one transfer per trip-confirmation).
//
// Naming note: the route is OrganizerPayoutHistory (not PayoutHistory)
// because PayoutHistory is already taken by the circle-payouts screen
// shipped earlier. Both surface money landing in the user's account,
// but the data sources are different (circle_payouts vs trip_payments)
// and squashing them into one screen would conflate two very different
// payout cadences.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";
import {
  TripOrganizerEngine,
  type OrganizerPayoutEntry,
} from "../services/TripOrganizerEngine";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case "transferred":
      return { bg: "rgba(0,198,174,0.15)", fg: "#047857" };
    case "failed":
      return { bg: "#FEE2E2", fg: "#B91C1C" };
    default:
      return { bg: "#FEF3C7", fg: "#92400E" };
  }
}

function statusKey(status: string): string {
  if (status === "transferred") return "payout_history.status_completed";
  if (status === "failed") return "payout_history.status_failed";
  return "payout_history.status_pending";
}

function fmtUSD(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function OrganizerPayoutHistoryScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [rows, setRows] = useState<OrganizerPayoutEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await TripOrganizerEngine.getPayoutHistory(user.id);
      setRows(result);
    } catch (err) {
      console.warn("[OrganizerPayoutHistory] load failed:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Refresh on focus — payouts are slow async events (Stripe ACH can take
  // hours to settle), so refetching whenever the user comes back to the
  // screen is more reliable than relying on a single mount-time fetch.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("payout_history.title")}</Text>
        <TouchableOpacity onPress={load} style={styles.headerBtn} disabled={loading}>
          <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
        </TouchableOpacity>
      </View>

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.transfer_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const tone = statusColor(item.status);
            return (
              <View style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripName} numberOfLines={1}>
                      {item.trip_name || "—"}
                    </Text>
                    {item.destination ? (
                      <Text style={styles.destination} numberOfLines={1}>
                        {item.destination}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.chip, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.chipText, { color: tone.fg }]}>
                      {t(statusKey(item.status))}
                    </Text>
                  </View>
                </View>

                <View style={styles.amountBlock}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>{t("payout_history.amount")}</Text>
                    <Text style={styles.amountValue}>{fmtUSD(item.gross)}</Text>
                  </View>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>{t("payout_history.fee")}</Text>
                    <Text style={[styles.amountValue, { color: MUTED }]}>
                      −{fmtUSD(item.fee)}
                    </Text>
                  </View>
                  <View style={[styles.amountRow, styles.netRow]}>
                    <Text style={styles.netLabel}>{t("payout_history.net")}</Text>
                    <Text style={styles.netValue}>{fmtUSD(item.net)}</Text>
                  </View>
                </View>

                <Text style={styles.dateRow}>
                  {t("payout_history.date")} · {fmtDate(item.transferred_at)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>{t("payout_history.empty")}</Text>
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
  listContent: { padding: spacing.lg, paddingBottom: 40, gap: 10 },

  row: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tripName: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },
  destination: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: typography.label, fontWeight: typography.bold },

  amountBlock: { marginTop: 4 },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  amountLabel: { fontSize: typography.label, color: MUTED },
  amountValue: { fontSize: typography.label, color: NAVY },
  netRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  netLabel: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },
  netValue: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },

  dateRow: { fontSize: typography.label, color: MUTED, marginTop: 4 },

  empty: { alignItems: "center", gap: 10, padding: spacing.xl },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
