import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useMarketplaceStores, type StoreCategory, type MarketplaceStore } from "../hooks/useMarketplace";

// i18n: CATEGORIES + BADGE_CONFIG hold visual config (icon, color) only.
// Their human-readable labels are resolved per-render via t() so language
// flips re-paint without re-instantiating these maps.
const CATEGORIES: { key: StoreCategory | "all"; icon: string; labelKey: string; color: string }[] = [
  { key: "all", icon: "grid", labelKey: "marketplace.category_all", color: "#0A2342" },
  { key: "food", icon: "restaurant", labelKey: "marketplace.category_food", color: "#F59E0B" },
  { key: "beauty", icon: "cut", labelKey: "marketplace.category_beauty", color: "#EC4899" },
  { key: "travel", icon: "airplane", labelKey: "marketplace.category_travel", color: "#3B82F6" },
  { key: "shipping", icon: "cube", labelKey: "marketplace.category_shipping", color: "#8B5CF6" },
  { key: "finance", icon: "cash", labelKey: "marketplace.category_finance", color: "#10B981" },
  { key: "events", icon: "calendar", labelKey: "marketplace.category_events", color: "#F97316" },
  { key: "realestate", icon: "home", labelKey: "marketplace.category_realestate", color: "#6366F1" },
  { key: "health", icon: "heart", labelKey: "marketplace.category_health", color: "#EF4444" },
];

const BADGE_CONFIG: Record<string, { labelKey: string; color: string; icon: string }> = {
  claimed: { labelKey: "marketplace.badge_claimed", color: "#6B7280", icon: "checkmark-circle-outline" },
  trusted: { labelKey: "marketplace.badge_trusted", color: "#00C6AE", icon: "shield-checkmark" },
  verified: { labelKey: "marketplace.badge_verified", color: "#3B82F6", icon: "checkmark-done-circle" },
};

export default function MarketplaceScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<StoreCategory | "all">("all");
  const [searchText, setSearchText] = useState("");

  const { stores, featured, loading, refresh } = useMarketplaceStores({
    category: selectedCategory === "all" ? undefined : selectedCategory,
    search: searchText || undefined,
  });

  const renderStoreCard = (store: MarketplaceStore) => {
    const badge = BADGE_CONFIG[store.badge];
    const catConfig = CATEGORIES.find(c => c.key === store.category);

    return (
      <TouchableOpacity
        key={store.id}
        style={styles.storeCard}
        onPress={() => navigation.navigate(Routes.StoreDetail, { storeId: store.id })}
      >
        {store.isFeatured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.featuredText}>{t("marketplace.featured_chip")}</Text>
          </View>
        )}

        <View style={styles.storeTop}>
          <View style={styles.storeAvatar}>
            <Text style={styles.storeEmoji}>{store.emoji}</Text>
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{store.businessName}</Text>
            <View style={styles.storeMetaRow}>
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text style={styles.storeMeta}>{store.city}{store.state ? `, ${store.state}` : ""}</Text>
            </View>
            <View style={styles.storeMetaRow}>
              <Ionicons name={catConfig?.icon as any ?? "storefront"} size={12} color={catConfig?.color ?? "#6B7280"} />
              <Text style={[styles.storeMeta, { color: catConfig?.color }]}>
                {catConfig ? t(catConfig.labelKey) : store.category}
              </Text>
            </View>
          </View>
          <View style={styles.storeRight}>
            {badge && (
              <View style={[styles.badgePill, { backgroundColor: badge.color + "15" }]}>
                <Ionicons name={badge.icon as any} size={12} color={badge.color} />
                <Text style={[styles.badgeText, { color: badge.color }]}>{t(badge.labelKey)}</Text>
              </View>
            )}
          </View>
        </View>

        {store.description && (
          <Text style={styles.storeDesc} numberOfLines={2}>{store.description}</Text>
        )}

        <View style={styles.storeBottom}>
          {store.memberDiscountPct > 0 && (
            <View style={styles.discountPill}>
              <Ionicons name="pricetag" size={12} color="#00C6AE" />
              <Text style={styles.discountText}>
                {t("marketplace.member_discount", { percent: store.memberDiscountPct })}
              </Text>
            </View>
          )}
          <View style={styles.storeStats}>
            {store.totalReviews > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.statText}>{store.avgRating.toFixed(1)}</Text>
              </View>
            )}
            {store.totalBookings > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                <Text style={styles.statText}>{store.totalBookings}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t("marketplace.header")}</Text>
            <Text style={styles.headerSubtitle}>{t("marketplace.subtitle")}</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate(Routes.StoreApplication)}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder={t("marketplace.search_placeholder")}
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                selectedCategory === cat.key && { backgroundColor: cat.color, borderColor: cat.color },
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={selectedCategory === cat.key ? "#FFFFFF" : cat.color}
              />
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.key && { color: "#FFFFFF" },
                ]}
              >
                {t(cat.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured */}
        {featured.length > 0 && selectedCategory === "all" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("marketplace.section_featured")}</Text>
            {featured.map(renderStoreCard)}
          </View>
        )}

        {/* All Stores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === "all"
              ? t("marketplace.section_all")
              : (() => {
                  const cat = CATEGORIES.find(c => c.key === selectedCategory);
                  return cat ? t(cat.labelKey) : selectedCategory;
                })()}
            {" "}({stores.length})
          </Text>

          {stores.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t("marketplace.empty_title")}</Text>
              <Text style={styles.emptySubtitle}>{t("marketplace.empty_subtitle")}</Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => navigation.navigate(Routes.StoreApplication)}
              >
                <Text style={styles.emptyActionText}>{t("marketplace.empty_cta")}</Text>
              </TouchableOpacity>
            </View>
          )}

          {stores.filter(s => !s.isFeatured || selectedCategory !== "all").map(renderStoreCard)}
        </View>

        {/* Request a Provider — restored to real navigation after the
            RequestProviderScreen landed in commit d25e290. The Phase 0
            holding-pattern Alert is no longer needed. */}
        <TouchableOpacity
          style={styles.requestCard}
          onPress={() => navigation.navigate(Routes.RequestProvider)}
        >
          <Ionicons name="hand-right-outline" size={24} color="#00C6AE" />
          <View style={{ flex: 1 }}>
            <Text style={styles.requestTitle}>{t("marketplace.request_title")}</Text>
            <Text style={styles.requestSubtitle}>{t("marketplace.request_subtitle")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 3 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#00C6AE", alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#FFFFFF" },
  content: { flex: 1 },
  categoryScroll: { marginTop: 16 },
  categoryRow: { paddingHorizontal: 20, gap: 8 },
  categoryPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  categoryText: { fontSize: 13, fontWeight: "600", color: "#0A2342" },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginBottom: 12 },
  storeCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  featuredBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, alignSelf: "flex-start", marginBottom: 10 },
  featuredText: { fontSize: 11, fontWeight: "600", color: "#D97706" },
  storeTop: { flexDirection: "row", alignItems: "center" },
  storeAvatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center", marginRight: 14 },
  storeEmoji: { fontSize: 28 },
  storeInfo: { flex: 1 },
  storeName: { fontSize: 16, fontWeight: "600", color: "#0A2342", marginBottom: 4 },
  storeMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  storeMeta: { fontSize: 12, color: "#9CA3AF" },
  storeRight: { alignItems: "flex-end" },
  badgePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  storeDesc: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginTop: 10 },
  storeBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  discountPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FDFB", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  discountText: { fontSize: 12, fontWeight: "600", color: "#00C6AE" },
  storeStats: { flexDirection: "row", gap: 12 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontWeight: "500", color: "#6B7280" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center" },
  emptyAction: { marginTop: 16, backgroundColor: "#00C6AE", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  emptyActionText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  requestCard: { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 20, marginTop: 20, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  requestTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  requestSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
