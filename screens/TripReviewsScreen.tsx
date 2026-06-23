// ═══════════════════════════════════════════════════════════════════════════
// screens/TripReviewsScreen.tsx — Leave-review Bucket B.2
// ═══════════════════════════════════════════════════════════════════════════
//
// Public list of all reviews for a trip. Reachable from the rating badge on
// TripPublicPageScreen + (Bucket B.3) future cards. Read-only — participants
// submit through LeaveReviewScreen, not here.
//
// Each row: reviewer avatar + name, 1-5 stars, relative time, optional text.
// Empty state nudges the first reviewer; loading state shows a spinner.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { colors, radius, typography, spacing } from "../theme/tokens";
import {
  TripOrganizerEngine,
  type TripReviewWithReviewer,
} from "../services/TripOrganizerEngine";
import StarRatingDisplay from "../components/StarRatingDisplay";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#9CA3AF";

const TripReviewsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const tripId: string = route.params?.tripId ?? "";

  const [items, setItems] = useState<TripReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!tripId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await TripOrganizerEngine.getTripReviews(tripId);
      setItems(rows);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const renderItem = ({ item }: { item: TripReviewWithReviewer }) => {
    const reviewerLabel =
      item.reviewerName?.trim() || t("trip_reviews.anonymous_reviewer");
    let timeLabel = "";
    if (item.createdAt) {
      try {
        timeLabel = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
      } catch {
        timeLabel = "";
      }
    }
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          {item.reviewerAvatarUrl ? (
            <Image source={{ uri: item.reviewerAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {reviewerLabel.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewerName} numberOfLines={1}>
              {reviewerLabel}
            </Text>
            <View style={styles.starsRow}>
              <StarRatingDisplay rating={item.rating} size={14} />
              {timeLabel ? (
                <Text style={styles.timeAgo}>{` · ${timeLabel}`}</Text>
              ) : null}
            </View>
          </View>
        </View>
        {item.reviewText ? (
          <Text style={styles.reviewText}>{item.reviewText}</Text>
        ) : null}
      </View>
    );
  };

  // ── Header (shared across all states) ────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t("trip_reviews.title")}</Text>
      <View style={styles.headerBtn} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <Ionicons name="star-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>{t("trip_reviews.empty")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      {renderHeader()}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

export default TripReviewsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: 10 },

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
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: NAVY,
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
  reviewerName: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  timeAgo: {
    fontSize: typography.label,
    color: MUTED,
  },
  reviewText: {
    fontSize: typography.body,
    color: NAVY,
    lineHeight: 20,
    marginTop: 4,
  },

  emptyTitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  errorText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
