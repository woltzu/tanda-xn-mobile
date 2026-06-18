// ══════════════════════════════════════════════════════════════════════════════
// ProviderDetailScreen — single provider profile
// ══════════════════════════════════════════════════════════════════════════════
// Header (business name + category + location + verification badge), stats
// (rating, jobs, years), description, reviews list. "Pay from goal" and
// "Link to my goal" CTAs are Phase 1A placeholders — they show an Alert
// pointing to Phase 1B as the wire-up window.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { ProviderReview, useProvider } from "../hooks/useProviders";

type RouteParams = { providerId: string };

function verificationLevelLabel(t: any, level: number): string {
  switch (level) {
    case 3:
      return t("provider_list.level_premium");
    case 2:
      return t("provider_list.level_standard");
    default:
      return t("provider_list.level_basic");
  }
}

function verificationLevelColor(level: number): string {
  switch (level) {
    case 3:
      return "#7C3AED";
    case 2:
      return "#059669";
    default:
      return "#00C6AE";
  }
}

export default function ProviderDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const { providerId } = route.params ?? ({} as RouteParams);

  const { provider, reviews, loading, refetch } = useProvider(providerId);
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handlePayFromGoal = () => {
    // Phase 1B will wire this to the goal selection + send-money flow.
    Alert.alert(
      t("provider_detail.cta_pay_title"),
      t("provider_detail.cta_phase_1b_pending"),
    );
  };

  const handleLinkToGoal = () => {
    Alert.alert(
      t("provider_detail.cta_link_title"),
      t("provider_detail.cta_phase_1b_pending"),
    );
  };

  if (loading && !provider) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("provider_detail.title")}</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("provider_detail.not_found")}</Text>
        </View>
      </View>
    );
  }

  const color = verificationLevelColor(provider.verification_level);
  const locationLine = [provider.city, provider.country].filter(Boolean).join(", ");

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {provider.business_name}
        </Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />
        }
      >
        {/* Identity block */}
        <View style={styles.identityCard}>
          <Text style={styles.identityName}>{provider.business_name}</Text>
          <Text style={styles.identityCategory}>
            {t(`provider_category.${provider.category}`)}
          </Text>
          {locationLine ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.locationText}>{locationLine}</Text>
            </View>
          ) : null}
          <View style={[styles.levelBadge, { backgroundColor: `${color}22` }]}>
            <Ionicons name="shield-checkmark-outline" size={12} color={color} />
            <Text style={[styles.levelBadgeText, { color }]}>
              {verificationLevelLabel(t, provider.verification_level)}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat
            icon="star"
            color="#F59E0B"
            label={t("provider_detail.stat_rating")}
            value={
              provider.rating_count > 0
                ? `${provider.rating_avg.toFixed(1)} (${provider.rating_count})`
                : "—"
            }
          />
          <Stat
            icon="briefcase-outline"
            color="#0A2342"
            label={t("provider_detail.stat_jobs")}
            value={String(provider.total_jobs_completed)}
          />
          <Stat
            icon="time-outline"
            color="#0A2342"
            label={t("provider_detail.stat_experience")}
            value={
              provider.years_experience != null
                ? `${provider.years_experience} ${t("provider_detail.years")}`
                : "—"
            }
          />
        </View>

        {/* Description */}
        {provider.description ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("provider_detail.section_about")}</Text>
            <Text style={styles.descText}>{provider.description}</Text>
          </View>
        ) : null}

        {/* Contact */}
        {(provider.phone || provider.email || provider.website) ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("provider_detail.section_contact")}</Text>
            {provider.phone ? (
              <ContactRow icon="call-outline" text={provider.phone} />
            ) : null}
            {provider.email ? (
              <ContactRow icon="mail-outline" text={provider.email} />
            ) : null}
            {provider.website ? (
              <ContactRow icon="globe-outline" text={provider.website} />
            ) : null}
          </View>
        ) : null}

        {/* Reviews */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {t("provider_detail.section_reviews")} ({reviews.length})
          </Text>
          {reviews.length === 0 ? (
            <Text style={styles.mutedText}>{t("provider_detail.no_reviews")}</Text>
          ) : (
            reviews.map((r) => <ReviewRow key={r.id} review={r} />)
          )}
        </View>

        {/* CTAs (placeholders for Phase 1B) */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            style={[styles.cta, styles.ctaPrimary]}
            onPress={handlePayFromGoal}
            accessibilityRole="button"
          >
            <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.ctaPrimaryText}>{t("provider_detail.cta_pay_from_goal")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cta, styles.ctaSecondary]}
            onPress={handleLinkToGoal}
            accessibilityRole="button"
          >
            <Ionicons name="link-outline" size={18} color="#0A2342" />
            <Text style={styles.ctaSecondaryText}>{t("provider_detail.cta_link_to_goal")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ContactRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={16} color="#6B7280" />
      <Text style={styles.contactText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function ReviewRow({ review }: { review: ProviderReview }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewerName}>
          {review.reviewer_name ?? "Member"}
        </Text>
        <View style={styles.reviewRating}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.reviewRatingText}>{review.rating}</Text>
        </View>
      </View>
      {review.review_text ? (
        <Text style={styles.reviewText}>{review.review_text}</Text>
      ) : null}
      {review.is_verified ? (
        <View style={styles.verifiedTag}>
          <Ionicons name="checkmark-circle" size={10} color="#059669" />
          <Text style={styles.verifiedTagText}>verified purchase</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" },
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#FFFFFF" },

  scrollContent: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280" },

  identityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  identityName: { fontSize: 18, fontWeight: "800", color: "#0A2342" },
  identityCategory: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginTop: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { fontSize: 13, color: "#6B7280" },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  levelBadgeText: { fontSize: 12, fontWeight: "700" },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "space-between",
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 14, fontWeight: "800", color: "#0A2342" },
  statLabel: { fontSize: 11, color: "#6B7280" },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342", marginBottom: 8 },
  descText: { fontSize: 14, color: "#374151", lineHeight: 20 },
  mutedText: { fontSize: 13, color: "#6B7280" },

  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  contactText: { flex: 1, fontSize: 13, color: "#0A2342" },

  reviewRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewerName: { fontSize: 13, fontWeight: "700", color: "#0A2342" },
  reviewRating: { flexDirection: "row", alignItems: "center", gap: 2 },
  reviewRatingText: { fontSize: 12, fontWeight: "700", color: "#0A2342" },
  reviewText: { fontSize: 13, color: "#374151", marginTop: 4, lineHeight: 18 },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 6,
  },
  verifiedTagText: { fontSize: 10, fontWeight: "700", color: "#059669" },

  ctaWrap: { flexDirection: "row", gap: 10, marginTop: 4 },
  cta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaPrimary: { backgroundColor: "#00C6AE" },
  ctaPrimaryText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  ctaSecondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaSecondaryText: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
});
