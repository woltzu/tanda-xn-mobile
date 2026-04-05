import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStoreDetail, useMarketplaceActions, usePayoutCountdown } from "../hooks/useMarketplace";
import type { StoreService } from "../hooks/useMarketplace";

const BADGE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  claimed: { label: "Claimed", color: "#6B7280", icon: "checkmark-circle-outline" },
  trusted: { label: "Trusted", color: "#00C6AE", icon: "shield-checkmark" },
  verified: { label: "Verified", color: "#3B82F6", icon: "checkmark-done-circle" },
};

export default function StoreDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const storeId = (route.params as any)?.storeId ?? "";
  const nextPayoutDate = (route.params as any)?.nextPayoutDate;
  const payoutAmount = (route.params as any)?.payoutAmount;
  const circleId = (route.params as any)?.circleId;
  const circleName = (route.params as any)?.circleName;

  const { store, services, popularServices, reviews, loading, refresh } = useStoreDetail(storeId);
  const { calculateDiscount, sendInquiry, submitting } = useMarketplaceActions();
  const { daysUntilPayout, canPayOnPayoutDay, payoutDateFormatted } = usePayoutCountdown(nextPayoutDate, payoutAmount);

  const [inquiryText, setInquiryText] = useState("");
  const [showInquiry, setShowInquiry] = useState(false);

  const handleBook = useCallback((service: StoreService) => {
    if (!store) return;
    const pricing = calculateDiscount(service.priceCents, store.memberDiscountPct);
    navigation.navigate("BookService", {
      storeId: store.id,
      storeName: store.businessName,
      storeEmoji: store.emoji,
      serviceId: service.id,
      serviceName: service.name,
      originalAmountCents: pricing.originalCents,
      discountAmountCents: pricing.discountCents,
      finalAmountCents: pricing.finalCents,
      memberDiscountPct: store.memberDiscountPct,
      nextPayoutDate,
      payoutAmount,
      circleId,
      circleName,
      canPayOnPayoutDay,
    });
  }, [store, navigation, nextPayoutDate, payoutAmount, circleId, circleName, canPayOnPayoutDay, calculateDiscount]);

  const handleSendInquiry = async () => {
    if (!inquiryText.trim() || !storeId) return;
    try {
      await sendInquiry(storeId, inquiryText.trim());
      Alert.alert("Sent!", "Your message has been sent to the store owner.");
      setInquiryText("");
      setShowInquiry(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not send message");
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const badge = store ? BADGE_CONFIG[store.badge] : null;

  if (!store && !loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#6B7280" }}>Store not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{store?.businessName ?? "Store"}</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {store && (
          <>
            {/* Store Header Card */}
            <View style={styles.storeHeaderCard}>
              <View style={styles.storeTopRow}>
                <View style={styles.storeAvatar}>
                  <Text style={styles.storeEmoji}>{store.emoji}</Text>
                </View>
                <View style={styles.storeHeaderInfo}>
                  <Text style={styles.storeHeaderName}>{store.businessName}</Text>
                  <Text style={styles.storeOwner}>by {store.ownerName}</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.locationText}>{store.city}{store.state ? `, ${store.state}` : ""}</Text>
                  </View>
                </View>
              </View>

              {badge && (
                <View style={[styles.badgeLarge, { backgroundColor: badge.color + "15" }]}>
                  <Ionicons name={badge.icon as any} size={16} color={badge.color} />
                  <Text style={[styles.badgeLargeText, { color: badge.color }]}>{badge.label} Provider</Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{store.avgRating > 0 ? store.avgRating.toFixed(1) : "—"}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{store.totalReviews}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{store.totalBookings}</Text>
                  <Text style={styles.statLabel}>Bookings</Text>
                </View>
              </View>

              {store.description && (
                <Text style={styles.storeDescription}>{store.description}</Text>
              )}
            </View>

            {/* Payout Day Alert */}
            {canPayOnPayoutDay && payoutAmount && (
              <View style={styles.payoutAlert}>
                <Ionicons name="flash" size={18} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutAlertTitle}>
                    Your payout is in {daysUntilPayout} days!
                  </Text>
                  <Text style={styles.payoutAlertSubtitle}>
                    {formatPrice(payoutAmount)} from {circleName ?? "your circle"} — book now & pay on payout day
                  </Text>
                </View>
              </View>
            )}

            {/* Member Discount Banner */}
            {store.memberDiscountPct > 0 && (
              <View style={styles.discountBanner}>
                <Ionicons name="pricetag" size={18} color="#00C6AE" />
                <Text style={styles.discountBannerText}>
                  {store.memberDiscountPct}% off for circle members
                </Text>
                {store.exclusiveOffer && (
                  <Text style={styles.exclusiveOffer}>{store.exclusiveOffer}</Text>
                )}
              </View>
            )}

            {/* Popular Services */}
            {popularServices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Popular</Text>
                {popularServices.map(s => {
                  const pricing = calculateDiscount(s.priceCents, store.memberDiscountPct);
                  return (
                    <TouchableOpacity key={s.id} style={styles.serviceCard} onPress={() => handleBook(s)}>
                      <View style={styles.serviceLeft}>
                        <Text style={styles.serviceEmoji}>{s.emoji}</Text>
                      </View>
                      <View style={styles.serviceCenter}>
                        <View style={styles.serviceNameRow}>
                          <Text style={styles.serviceName}>{s.name}</Text>
                          {s.isPopular && (
                            <View style={styles.popularBadge}>
                              <Text style={styles.popularText}>Popular</Text>
                            </View>
                          )}
                        </View>
                        {s.description && <Text style={styles.serviceDesc} numberOfLines={1}>{s.description}</Text>}
                        {s.durationMinutes && (
                          <Text style={styles.serviceDuration}>{s.durationMinutes} min</Text>
                        )}
                      </View>
                      <View style={styles.serviceRight}>
                        {store.memberDiscountPct > 0 && (
                          <Text style={styles.originalPrice}>{formatPrice(pricing.originalCents)}</Text>
                        )}
                        <Text style={styles.finalPrice}>{formatPrice(pricing.finalCents)}</Text>
                        {store.memberDiscountPct > 0 && (
                          <Text style={styles.discountLabel}>{store.memberDiscountPct}% off</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* All Services */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Services ({services.length})</Text>
              {services.map(s => {
                const pricing = calculateDiscount(s.priceCents, store.memberDiscountPct);
                return (
                  <TouchableOpacity key={s.id} style={styles.serviceCard} onPress={() => handleBook(s)}>
                    <View style={styles.serviceLeft}>
                      <Text style={styles.serviceEmoji}>{s.emoji}</Text>
                    </View>
                    <View style={styles.serviceCenter}>
                      <Text style={styles.serviceName}>{s.name}</Text>
                      {s.description && <Text style={styles.serviceDesc} numberOfLines={1}>{s.description}</Text>}
                      {s.stockStatus === "limited" && (
                        <Text style={styles.stockWarning}>Limited availability</Text>
                      )}
                    </View>
                    <View style={styles.serviceRight}>
                      {store.memberDiscountPct > 0 && (
                        <Text style={styles.originalPrice}>{formatPrice(pricing.originalCents)}</Text>
                      )}
                      <Text style={styles.finalPrice}>{formatPrice(pricing.finalCents)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {services.length === 0 && (
                <Text style={styles.emptyText}>No services listed yet</Text>
              )}
            </View>

            {/* Reviews */}
            {reviews.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
                {reviews.slice(0, 5).map(r => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Ionicons
                            key={i}
                            name={i <= r.rating ? "star" : "star-outline"}
                            size={14}
                            color="#F59E0B"
                          />
                        ))}
                      </View>
                      {r.isVerifiedPurchase && (
                        <View style={styles.verifiedPurchase}>
                          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      )}
                    </View>
                    {r.reviewText && <Text style={styles.reviewText}>{r.reviewText}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Contact / Inquiry */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => setShowInquiry(!showInquiry)}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#0A2342" />
                <Text style={styles.contactButtonText}>Message Store Owner</Text>
              </TouchableOpacity>

              {showInquiry && (
                <View style={styles.inquiryBox}>
                  <View style={styles.inquiryInputRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#9CA3AF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inquiryPlaceholder}>
                        {inquiryText ? "" : "Ask about services, availability..."}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.inquiryActions}>
                    <TouchableOpacity onPress={() => setShowInquiry(false)}>
                      <Text style={styles.inquiryCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.inquirySendBtn, (!inquiryText.trim() || submitting) && { opacity: 0.4 }]}
                      onPress={handleSendInquiry}
                      disabled={!inquiryText.trim() || submitting}
                    >
                      <Text style={styles.inquirySendText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  content: { flex: 1, padding: 20 },

  storeHeaderCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  storeTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  storeAvatar: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center", marginRight: 16 },
  storeEmoji: { fontSize: 34 },
  storeHeaderInfo: { flex: 1 },
  storeHeaderName: { fontSize: 20, fontWeight: "700", color: "#0A2342", marginBottom: 2 },
  storeOwner: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 13, color: "#9CA3AF" },

  badgeLarge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, marginBottom: 16 },
  badgeLargeText: { fontSize: 13, fontWeight: "600" },

  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 12 },
  statBlock: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700", color: "#0A2342" },
  statLabel: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: "#E5E7EB" },

  storeDescription: { fontSize: 14, color: "#6B7280", lineHeight: 20 },

  payoutAlert: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FEF3C7", borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" },
  payoutAlertTitle: { fontSize: 14, fontWeight: "600", color: "#92400E" },
  payoutAlertSubtitle: { fontSize: 12, color: "#B45309", marginTop: 2 },

  discountBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F0FDFB", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#A7F3D0" },
  discountBannerText: { fontSize: 14, fontWeight: "600", color: "#00C6AE" },
  exclusiveOffer: { fontSize: 12, color: "#047857", marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#0A2342", marginBottom: 12 },

  serviceCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  serviceLeft: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", marginRight: 12 },
  serviceEmoji: { fontSize: 22 },
  serviceCenter: { flex: 1 },
  serviceNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  serviceName: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  popularBadge: { backgroundColor: "#FEF3C7", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  popularText: { fontSize: 10, fontWeight: "600", color: "#D97706" },
  serviceDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  serviceDuration: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  stockWarning: { fontSize: 11, color: "#F59E0B", fontWeight: "500", marginTop: 2 },
  serviceRight: { alignItems: "flex-end", marginLeft: 8 },
  originalPrice: { fontSize: 12, color: "#9CA3AF", textDecorationLine: "line-through" },
  finalPrice: { fontSize: 16, fontWeight: "700", color: "#0A2342" },
  discountLabel: { fontSize: 10, fontWeight: "600", color: "#00C6AE", marginTop: 2 },

  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center", paddingVertical: 20 },

  reviewCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  starsRow: { flexDirection: "row", gap: 2 },
  verifiedPurchase: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontSize: 11, color: "#10B981", fontWeight: "500" },
  reviewText: { fontSize: 13, color: "#6B7280", lineHeight: 18 },

  contactButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  contactButtonText: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  inquiryBox: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  inquiryInputRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 60 },
  inquiryPlaceholder: { fontSize: 14, color: "#9CA3AF" },
  inquiryActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10 },
  inquiryCancelText: { fontSize: 14, color: "#6B7280", paddingVertical: 8 },
  inquirySendBtn: { backgroundColor: "#0A2342", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  inquirySendText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
});
