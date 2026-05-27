// ══════════════════════════════════════════════════════════════════════════════
// screens/StoreBookingsScreen.tsx — Store owner's booking management
// ══════════════════════════════════════════════════════════════════════════════
//
// Route param: { storeId: string }
//
// Bookings come from the existing `useStoreBookings(storeId)` hook, which
// fetches from MarketplaceEngine.getStoreBookings + subscribes to
// realtime updates on marketplace_bookings. We layer two things on top
// of that:
//
//   1. Customer-name enrichment. getStoreBookings does `SELECT *` from
//      marketplace_bookings with no join, so customerName isn't on the
//      row. We do one batched `SELECT id, full_name FROM profiles WHERE
//      id IN (...)` for the unique memberIds and merge into local state.
//      One query per render set, regardless of booking count.
//
//   2. Segmented filter (Upcoming / Past / Cancelled). Status-based
//      rather than appointmentDate-based because appointmentDate is
//      nullable in the schema (walk-ins, immediate-pay services).
//        - Upcoming  = pending | confirmed | payment_due | payment_failed
//        - Past      = completed
//        - Cancelled = cancelled | refunded
//
// Per-row actions vary by status:
//   - pending           → Confirm (primary) + Cancel
//   - confirmed         → Mark Completed
//   - everything else   → View (Alert with booking id + notes)
//
// Status updates flow through `useStoreBookings.updateStatus`, which
// calls MarketplaceEngine.updateBookingStatus — that also stamps
// escrow_released_at when transitioning to "completed".
//
// Refresh is belt-and-suspenders: the hook already has a realtime
// subscription, but useFocusEffect re-fetches on screen focus too, in
// case the realtime channel dropped or the network was offline.
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useStoreBookings } from "../hooks/useMarketplace";
import type { Booking, BookingStatus } from "../services/MarketplaceEngine";
import { supabase } from "../lib/supabase";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const GREEN = "#059669";

type StoreBookingsRouteParams = { storeId: string };
type StoreBookingsRouteProp = RouteProp<
  { StoreBookings: StoreBookingsRouteParams },
  "StoreBookings"
>;

type FilterTab = "upcoming" | "past" | "cancelled";

const UPCOMING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "payment_due",
  "payment_failed",
];
const CANCELLED_STATUSES: BookingStatus[] = ["cancelled", "refunded"];

export default function StoreBookingsScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<StoreBookingsRouteProp>();
  const storeId = route.params?.storeId ?? "";

  const { bookings, loading, updateStatus, refresh } = useStoreBookings(storeId);

  const [tab, setTab] = useState<FilterTab>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  // ── Customer-name enrichment ────────────────────────────────────────────
  // One batched fetch per unique memberId set. Cheap (single round-trip).
  useEffect(() => {
    const uniqueIds = Array.from(
      new Set(bookings.map((b) => b.memberId).filter(Boolean)),
    );
    const missing = uniqueIds.filter((id) => !(id in customerNames));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", missing);
      if (cancelled || error || !data) return;
      const next: Record<string, string> = {};
      for (const row of data) {
        next[row.id] = row.full_name ?? "";
      }
      setCustomerNames((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [bookings, customerNames]);

  // ── Refresh on focus (in addition to the hook's realtime sub) ──────────
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // ── Filtering ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (tab === "upcoming") {
      return bookings.filter((b) => UPCOMING_STATUSES.includes(b.status));
    }
    if (tab === "past") {
      return bookings.filter((b) => b.status === "completed");
    }
    return bookings.filter((b) => CANCELLED_STATUSES.includes(b.status));
  }, [bookings, tab]);

  const counts = useMemo(
    () => ({
      upcoming: bookings.filter((b) => UPCOMING_STATUSES.includes(b.status)).length,
      past: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => CANCELLED_STATUSES.includes(b.status)).length,
    }),
    [bookings],
  );

  // ── Actions ────────────────────────────────────────────────────────────
  const runStatusChange = useCallback(
    async (booking: Booking, next: BookingStatus, label: string) => {
      setActionInFlight(booking.id);
      try {
        await updateStatus(booking.id, next);
      } catch (err: any) {
        console.error("[StoreBookings] updateStatus failed:", err);
        Alert.alert(
          `Could not ${label.toLowerCase()}`,
          err?.message ?? "Please try again.",
        );
      } finally {
        setActionInFlight(null);
      }
    },
    [updateStatus],
  );

  const confirmAction = (
    booking: Booking,
    next: BookingStatus,
    label: string,
    destructive = false,
  ) => {
    Alert.alert(
      `${label}?`,
      next === "cancelled"
        ? "This will cancel the booking. The customer may need a refund."
        : `Mark this booking as ${next}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: destructive ? "destructive" : "default",
          onPress: () => runStatusChange(booking, next, label),
        },
      ],
    );
  };

  const handleView = (booking: Booking) => {
    Alert.alert(
      "Booking details",
      [
        `Service: ${booking.serviceName}`,
        `Status: ${booking.status}`,
        `Amount: ${formatPrice(booking.finalAmountCents)}`,
        booking.appointmentDate && `Scheduled: ${formatDate(booking.appointmentDate)}`,
        booking.notes && `Notes: ${booking.notes}`,
        `ID: ${booking.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  };

  // ── Row renderer ───────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Booking }) => {
    const customerName = customerNames[item.memberId] || "Customer";
    const date = item.appointmentDate ?? item.createdAt;
    const isPending = item.status === "pending";
    const isConfirmed = item.status === "confirmed";
    const isBusy = actionInFlight === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.serviceName} numberOfLines={1}>
              {item.serviceName}
            </Text>
            <Text style={styles.customerName} numberOfLines={1}>
              {customerName}
            </Text>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </View>
          <View style={styles.amountBlock}>
            <Text style={styles.amount}>{formatPrice(item.finalAmountCents)}</Text>
            <StatusBadge status={item.status} />
          </View>
        </View>

        {item.paymentType === "payout_day" && (
          <View style={styles.payoutPill}>
            <Ionicons name="calendar-outline" size={12} color={BLUE} />
            <Text style={styles.payoutPillText}>Payout day</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          {isPending && (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, isBusy && styles.btnDisabled]}
                onPress={() => confirmAction(item, "confirmed", "Confirm")}
                disabled={isBusy}
                accessibilityRole="button"
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Confirm</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger, isBusy && styles.btnDisabled]}
                onPress={() => confirmAction(item, "cancelled", "Cancel booking", true)}
                disabled={isBusy}
                accessibilityRole="button"
              >
                <Text style={styles.btnDangerText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
          {isConfirmed && (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, styles.btnFull, isBusy && styles.btnDisabled]}
              onPress={() => confirmAction(item, "completed", "Mark completed")}
              disabled={isBusy}
              accessibilityRole="button"
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnPrimaryText}>Mark Completed</Text>
              )}
            </TouchableOpacity>
          )}
          {!isPending && !isConfirmed && (
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline, styles.btnFull]}
              onPress={() => handleView(item)}
              accessibilityRole="button"
            >
              <Text style={styles.btnOutlineText}>View Details</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Empty/loading states per tab ───────────────────────────────────────
  const renderEmpty = () => {
    if (loading) return null;
    const config = {
      upcoming: {
        icon: "calendar-outline" as const,
        title: "No upcoming bookings",
        body: "New bookings from customers will appear here.",
      },
      past: {
        icon: "checkmark-done-outline" as const,
        title: "No past bookings",
        body: "Completed bookings will show up here.",
      },
      cancelled: {
        icon: "close-circle-outline" as const,
        title: "No cancelled bookings",
        body: "Cancelled or refunded bookings will appear here.",
      },
    }[tab];

    return (
      <View style={styles.empty}>
        <Ionicons name={config.icon} size={48} color={MUTED} />
        <Text style={styles.emptyTitle}>{config.title}</Text>
        <Text style={styles.emptyBody}>{config.body}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bookings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Segmented control */}
      <View style={styles.tabs}>
        <TabPill
          label="Upcoming"
          count={counts.upcoming}
          active={tab === "upcoming"}
          onPress={() => setTab("upcoming")}
        />
        <TabPill
          label="Past"
          count={counts.past}
          active={tab === "past"}
          onPress={() => setTab("past")}
        />
        <TabPill
          label="Cancelled"
          count={counts.cancelled}
          active={tab === "cancelled"}
          onPress={() => setTab("cancelled")}
        />
      </View>

      {loading && bookings.length === 0 ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading bookings…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            filtered.length === 0 ? styles.listEmpty : styles.listContent
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={TEAL}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Helper components ────────────────────────────────────────────────────

function TabPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabPill, active && styles.tabPillActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.tabPillBadge, active && styles.tabPillBadgeActive]}>
          <Text
            style={[
              styles.tabPillBadgeText,
              active && styles.tabPillBadgeTextActive,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const config = statusConfig(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.fg }]}>
        {config.label}
      </Text>
    </View>
  );
}

function statusConfig(status: BookingStatus) {
  switch (status) {
    case "pending":
      return { label: "Pending", bg: "#FEF3C7", fg: "#92400E" };
    case "confirmed":
      return { label: "Confirmed", bg: "#DBEAFE", fg: "#1E40AF" };
    case "completed":
      return { label: "Completed", bg: "#D1FAE5", fg: GREEN };
    case "cancelled":
      return { label: "Cancelled", bg: "#FEE2E2", fg: RED };
    case "refunded":
      return { label: "Refunded", bg: "#F3E8FF", fg: "#7E22CE" };
    case "payment_due":
      return { label: "Payment Due", bg: "#FEF3C7", fg: AMBER };
    case "payment_failed":
      return { label: "Payment Failed", bg: "#FEE2E2", fg: RED };
    default:
      return { label: status, bg: "#F3F4F6", fg: MUTED };
  }
}

// ── Formatters ───────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Today, ${time}`;
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })} · ${time}`;
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  backButton: { minWidth: 44, paddingVertical: 4 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
  },
  headerSpacer: { width: 44 },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  tabPillActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  tabPillText: { fontSize: 13, fontWeight: "600", color: NAVY },
  tabPillTextActive: { color: "#FFFFFF" },
  tabPillBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  tabPillBadgeActive: { backgroundColor: TEAL },
  tabPillBadgeText: { fontSize: 11, fontWeight: "700", color: NAVY },
  tabPillBadgeTextActive: { color: "#FFFFFF" },

  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: MUTED },

  listContent: { padding: 16, paddingBottom: 32 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  separator: { height: 10 },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: NAVY,
    marginTop: 4,
  },
  emptyBody: { fontSize: 14, color: MUTED, textAlign: "center" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 13,
    color: NAVY,
    fontWeight: "500",
  },
  dateText: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
  },
  amountBlock: {
    alignItems: "flex-end",
    gap: 6,
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  payoutPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  payoutPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: BLUE,
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnFull: { flex: 1 },
  btnPrimary: {
    backgroundColor: TEAL,
  },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  btnDanger: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: RED,
  },
  btnDangerText: { color: RED, fontSize: 13, fontWeight: "600" },
  btnOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  btnOutlineText: { color: NAVY, fontSize: 13, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
