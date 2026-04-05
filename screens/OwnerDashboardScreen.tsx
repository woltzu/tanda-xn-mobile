import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useOwnerDashboard } from "../hooks/useMarketplace";

export default function OwnerDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const storeId = (route.params as any)?.storeId ?? "";
  const { dashboard, loading, refresh } = useOwnerDashboard(storeId);

  const formatPrice = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  if (!dashboard && !loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#6B7280" }}>Store not found</Text>
      </View>
    );
  }

  const store = dashboard?.store;
  const stats = dashboard?.inviteStats;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("EditStore", { storeId })}
          >
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {store && (
          <View style={styles.storeBanner}>
            <Text style={styles.storeBannerEmoji}>{store.emoji}</Text>
            <Text style={styles.storeBannerName}>{store.businessName}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {dashboard && (
          <>
            {/* Key Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: "#F0FDFB" }]}>
                <Ionicons name="people" size={20} color="#00C6AE" />
                <Text style={styles.metricValue}>{stats?.joined ?? 0}/{stats?.total ?? 0}</Text>
                <Text style={styles.metricLabel}>Members Joined</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="calendar" size={20} color="#3B82F6" />
                <Text style={styles.metricValue}>{dashboard.monthlyBookings}</Text>
                <Text style={styles.metricLabel}>Bookings (Month)</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="cash" size={20} color="#F59E0B" />
                <Text style={styles.metricValue}>{formatPrice(dashboard.monthlyRevenueCents)}</Text>
                <Text style={styles.metricLabel}>Revenue (Month)</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: "#FCE7F3" }]}>
                <Ionicons name="star" size={20} color="#EC4899" />
                <Text style={styles.metricValue}>
                  {store?.avgRating ? store.avgRating.toFixed(1) : "—"}
                </Text>
                <Text style={styles.metricLabel}>Avg Rating</Text>
              </View>
            </View>

            {/* Invite Progress */}
            {stats && stats.total > 0 && (
              <View style={styles.inviteProgress}>
                <View style={styles.inviteHeader}>
                  <Text style={styles.inviteSectionTitle}>Invite Progress</Text>
                  <Text style={styles.inviteCount}>{stats.joined}/{stats.total} joined</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[styles.progressBarFill, { width: `${stats.conversionRate}%` }]}
                  />
                </View>
                <View style={styles.inviteStatsRow}>
                  <View style={styles.inviteStatItem}>
                    <View style={[styles.inviteStatDot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={styles.inviteStatText}>Pending: {stats.pending}</Text>
                  </View>
                  <View style={styles.inviteStatItem}>
                    <View style={[styles.inviteStatDot, { backgroundColor: "#3B82F6" }]} />
                    <Text style={styles.inviteStatText}>Sent: {stats.sent + stats.delivered}</Text>
                  </View>
                  <View style={styles.inviteStatItem}>
                    <View style={[styles.inviteStatDot, { backgroundColor: "#10B981" }]} />
                    <Text style={styles.inviteStatText}>Joined: {stats.joined}</Text>
                  </View>
                </View>

                {stats.pending > 0 && (
                  <TouchableOpacity
                    style={styles.sendRemindersBtn}
                    onPress={() => navigation.navigate("BulkInvites", { storeId })}
                  >
                    <Ionicons name="send" size={14} color="#FFFFFF" />
                    <Text style={styles.sendRemindersText}>Send SMS to {stats.pending} Pending</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate("BulkInvites", { storeId })}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="people-outline" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.actionLabel}>Invite Members</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate("EditStore", { storeId })}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#F0FDFB" }]}>
                  <Ionicons name="storefront-outline" size={22} color="#00C6AE" />
                </View>
                <Text style={styles.actionLabel}>Edit Store</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate("ManageServices", { storeId })}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="list-outline" size={22} color="#F59E0B" />
                </View>
                <Text style={styles.actionLabel}>Services</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate("StoreBookings", { storeId })}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#FCE7F3" }]}>
                  <Ionicons name="calendar-outline" size={22} color="#EC4899" />
                </View>
                <Text style={styles.actionLabel}>Bookings</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Bookings */}
            {dashboard.recentBookings.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Bookings</Text>
                  <TouchableOpacity onPress={() => navigation.navigate("StoreBookings", { storeId })}>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                {dashboard.recentBookings.slice(0, 5).map(b => (
                  <View key={b.id} style={styles.bookingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingService}>{b.serviceName}</Text>
                      <Text style={styles.bookingMeta}>
                        {new Date(b.createdAt).toLocaleDateString()} · {b.paymentType === "payout_day" ? "Payout Day" : "Paid"}
                      </Text>
                    </View>
                    <Text style={styles.bookingAmount}>{formatPrice(b.finalAmountCents)}</Text>
                    <View style={[
                      styles.statusPill,
                      b.status === "completed" && { backgroundColor: "#D1FAE5" },
                      b.status === "pending" && { backgroundColor: "#FEF3C7" },
                      b.status === "payment_due" && { backgroundColor: "#DBEAFE" },
                    ]}>
                      <Text style={[
                        styles.statusText,
                        b.status === "completed" && { color: "#059669" },
                        b.status === "pending" && { color: "#D97706" },
                        b.status === "payment_due" && { color: "#2563EB" },
                      ]}>{b.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Reviews */}
            {dashboard.recentReviews.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Reviews</Text>
                {dashboard.recentReviews.slice(0, 3).map(r => (
                  <View key={r.id} style={styles.reviewRow}>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <Ionicons key={i} name={i <= r.rating ? "star" : "star-outline"} size={14} color="#F59E0B" />
                      ))}
                    </View>
                    {r.reviewText && <Text style={styles.reviewText} numberOfLines={2}>{r.reviewText}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Services */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Services ({dashboard.services.length})</Text>
                <TouchableOpacity onPress={() => navigation.navigate("ManageServices", { storeId })}>
                  <Text style={styles.seeAll}>Manage</Text>
                </TouchableOpacity>
              </View>
              {dashboard.services.slice(0, 4).map(s => (
                <View key={s.id} style={styles.serviceRow}>
                  <Text style={styles.serviceEmoji}>{s.emoji}</Text>
                  <Text style={styles.serviceRowName}>{s.name}</Text>
                  <Text style={styles.serviceRowPrice}>{formatPrice(s.priceCents)}</Text>
                </View>
              ))}
              {dashboard.services.length === 0 && (
                <TouchableOpacity
                  style={styles.addServiceBtn}
                  onPress={() => navigation.navigate("ManageServices", { storeId })}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#00C6AE" />
                  <Text style={styles.addServiceText}>Add your first service</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  editButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  storeBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  storeBannerEmoji: { fontSize: 24 },
  storeBannerName: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  content: { flex: 1, padding: 20 },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  metricCard: { width: "48%", borderRadius: 14, padding: 16, alignItems: "center" },
  metricValue: { fontSize: 22, fontWeight: "700", color: "#0A2342", marginTop: 8 },
  metricLabel: { fontSize: 11, color: "#6B7280", marginTop: 4 },

  inviteProgress: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  inviteHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  inviteSectionTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  inviteCount: { fontSize: 13, fontWeight: "600", color: "#00C6AE" },
  progressBarBg: { height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, marginBottom: 12 },
  progressBarFill: { height: 8, backgroundColor: "#00C6AE", borderRadius: 4 },
  inviteStatsRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  inviteStatItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  inviteStatDot: { width: 8, height: 8, borderRadius: 4 },
  inviteStatText: { fontSize: 12, color: "#6B7280" },
  sendRemindersBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#0A2342", borderRadius: 10, paddingVertical: 10 },
  sendRemindersText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },

  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#0A2342", marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: "600", color: "#00C6AE" },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  actionCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: "600", color: "#0A2342" },

  bookingRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", gap: 10 },
  bookingService: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  bookingMeta: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  bookingAmount: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  statusPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "600" },

  reviewRow: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  starsRow: { flexDirection: "row", gap: 2, marginBottom: 4 },
  reviewText: { fontSize: 13, color: "#6B7280", lineHeight: 18 },

  serviceRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "#E5E7EB" },
  serviceEmoji: { fontSize: 20 },
  serviceRowName: { flex: 1, fontSize: 14, fontWeight: "500", color: "#0A2342" },
  serviceRowPrice: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  addServiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F0FDFB", borderRadius: 12, paddingVertical: 16, borderWidth: 1, borderColor: "#A7F3D0", borderStyle: "dashed" },
  addServiceText: { fontSize: 14, fontWeight: "600", color: "#00C6AE" },
});
