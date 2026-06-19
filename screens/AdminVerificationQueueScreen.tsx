// ══════════════════════════════════════════════════════════════════════════════
// AdminVerificationQueueScreen — admin-only queue of pending verifications
// ══════════════════════════════════════════════════════════════════════════════
// Phase 2C. Lists every staged-disbursement verification request the admin
// can see (RLS on goal_disbursement_milestone_verifications grants SELECT
// to active admin_users). Filter chips switch the view between pending /
// approved / rejected. Tapping Review on a pending row hands off to
// MilestoneVerificationScreen with the request + milestone ids — the same
// surface elders use to sign off — so admins go through the same evidence
// pipeline.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  AdminVerificationItem,
  AdminVerificationStatus,
  useAdminVerificationQueue,
} from "../hooks/useAdminVerificationQueue";

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FILTERS: AdminVerificationStatus[] = ["pending", "approved", "rejected"];

export default function AdminVerificationQueueScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AdminVerificationStatus>("pending");
  const { items, loading, refetch } = useAdminVerificationQueue(filter);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const pendingCount = useMemo(
    () => (filter === "pending" ? items.length : 0),
    [filter, items.length],
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("admin_verification_queue.title")}
          {pendingCount > 0 ? ` (${pendingCount})` : ""}
        </Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {t(`admin_verification_queue.filter_${f}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C6AE" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.request_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyText}>
                {t(`admin_verification_queue.empty_${filter}`)}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <QueueRow
              item={item}
              onReview={() =>
                navigation.navigate("MilestoneVerification", {
                  milestoneId: item.milestone_id,
                  requestId: item.request_id,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
}

function QueueRow({
  item,
  onReview,
}: {
  item: AdminVerificationItem;
  onReview: () => void;
}) {
  const { t } = useTranslation();
  const statusColor =
    item.status === "approved"
      ? "#059669"
      : item.status === "rejected"
      ? "#EF4444"
      : "#F59E0B";
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.milestone_name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {t(`admin_verification_queue.status_${item.status}`)}
          </Text>
        </View>
      </View>
      <Text style={styles.cardSubtitle}>{item.goal_name}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="business-outline" size={13} color="#6B7280" />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.provider_business_name}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="cash-outline" size={13} color="#6B7280" />
        <Text style={styles.metaText}>{fmt(item.milestone_amount_cents)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={13} color="#6B7280" />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.requester_name ?? t("admin_verification_queue.requester_unknown")}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={13} color="#6B7280" />
        <Text style={styles.metaText}>
          {t("admin_verification_queue.requested_on", { date: fmtDate(item.created_at) })}
        </Text>
      </View>
      {item.status === "pending" ? (
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={onReview}
          accessibilityRole="button"
        >
          <Text style={styles.reviewBtnText}>
            {t("admin_verification_queue.review")}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      ) : item.responded_at ? (
        <Text style={styles.respondedNote}>
          {t("admin_verification_queue.responded_on", {
            date: fmtDate(item.responded_at),
          })}
        </Text>
      ) : null}
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

  filtersWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 6,
  },
  chipActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  chipTextActive: { color: "#FFFFFF" },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center", paddingHorizontal: 24 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: "#0A2342", marginRight: 8 },
  cardSubtitle: { fontSize: 13, fontWeight: "600", color: "#0A2342", marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
  },
  metaText: { fontSize: 13, color: "#374151" },

  reviewBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
  },
  reviewBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  respondedNote: { fontSize: 12, color: "#6B7280", marginTop: 8 },
});
