import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Share,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeed, FeedPost } from "../context/FeedContext";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";
import { useFilteredFeed, FeedFilter } from "../hooks/useFilteredFeed";
import FeedPostCard from "../components/FeedPostCard";
import { showToast } from "../components/Toast";
import { uploadToBucket } from "../utils/image";
import { colors, radius, typography, spacing } from "../theme/tokens";

const COACH_MARK_KEY = "@tandaxn_dream_feed_seen_v1";
const RETRY_URI_KEY_PREFIX = "@tandaxn_dream_post_retry_uri:";
const FEED_IMAGES_BUCKET = "feed-images";

type DreamFeedNavigationProp = StackNavigationProp<any>;

// i18n: labelKey resolved per-render via t() at call site.
const FILTER_TABS: { key: FeedFilter; labelKey: string; icon: string }[] = [
  { key: "for_you", labelKey: "dream_feed.tab_for_you", icon: "sparkles" },
  { key: "following", labelKey: "dream_feed.tab_following", icon: "people-outline" },
  { key: "trending", labelKey: "dream_feed.tab_trending", icon: "trending-up" },
];

export default function DreamFeedScreen() {
  const navigation = useNavigation<DreamFeedNavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    posts,
    isLoading,
    isLoadingMore,
    hasMore,
    likedPostIds,
    savedPostIds,
    toggleLike,
    toggleSave,
    fetchMorePosts,
    refreshFeed,
    refetchFeed,
    updateDreamPostImage,
    markDreamPostImageFailed,
  } = useFeed();

  // Cache-aware refetch on focus — uses the 5-minute in-memory cache so
  // tab-switching is cheap. Pull-to-refresh still busts the cache via
  // refreshFeed.
  useFocusEffect(
    useCallback(() => {
      refetchFeed();
    }, [refetchFeed]),
  );

  // ── First-visit coach mark ──────────────────────────────────────────
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachSlide, setCoachSlide] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_MARK_KEY);
        if (!cancelled && seen !== "1") setCoachVisible(true);
      } catch {
        /* AsyncStorage failure is non-fatal — skip the modal. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissCoach = () => {
    setCoachVisible(false);
    AsyncStorage.setItem(COACH_MARK_KEY, "1").catch(() => {});
  };

  // ── Retry upload — runs from FeedPostCard's "Retry upload" pill ────
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const handleRetryUpload = useCallback(
    async (post: FeedPost) => {
      if (!user?.id) return;
      if (retryingIds.has(post.id)) return;
      const localUri = await AsyncStorage.getItem(
        RETRY_URI_KEY_PREFIX + post.id,
      );
      if (!localUri) {
        Alert.alert(
          t("dream_feed.upload_retry_no_uri_title"),
          t("dream_feed.upload_retry_no_uri_body"),
        );
        return;
      }
      setRetryingIds((prev) => new Set(prev).add(post.id));
      const { publicUrl, error } = await uploadToBucket(
        localUri,
        user.id,
        FEED_IMAGES_BUCKET,
      );
      if (error || !publicUrl) {
        showToast(t("dream_feed.upload_retry_failed"), "error");
        await markDreamPostImageFailed(post.id);
      } else {
        await updateDreamPostImage(post.id, publicUrl);
        AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + post.id).catch(() => {});
        showToast(t("dream_feed.upload_retry_success"), "success");
      }
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    },
    [
      user?.id,
      retryingIds,
      updateDreamPostImage,
      markDreamPostImageFailed,
      t,
    ],
  );

  const { networkUserIds } = useCircles();

  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("for_you");
  const filteredPosts = useFilteredFeed(posts, activeFilter, networkUserIds);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    setRefreshing(false);
  }, [refreshFeed]);

  const handlePostPress = (postId: string) => {
    navigation.navigate("PostDetail", { postId });
  };

  const handleCommentPress = (postId: string) => {
    navigation.navigate("PostComments", { postId });
  };

  const handleAuthorPress = (userId: string) => {
    navigation.navigate("UserDreamProfile", { userId });
  };

  const handleClonePlan = (post: FeedPost) => {
    const meta = post.metadata || {};
    if (meta.goalName || meta.targetAmount) {
      // Navigate to CreateGoal with pre-filled data from the cloned dream
      navigation.navigate("CreateGoal" as any, {
        clonedGoalName: meta.goalName || "My Dream",
        clonedTargetAmount: meta.targetAmount || undefined,
        clonedEmoji: meta.goalEmoji || undefined,
      });
      showToast("Starting a similar goal!", "success");
    } else {
      // No goal data — go to CreateGoal with empty form
      navigation.navigate("CreateGoal" as any, {});
      showToast("Create your own version!", "success");
    }
  };

  const handleAccountability = async (post: FeedPost) => {
    try {
      const shareMessage = post.metadata?.goalName
        ? `Check out this dream on TandaXn: "${post.metadata.goalName}" — ${post.content.slice(0, 100)}`
        : `Check out this dream on TandaXn: ${post.content.slice(0, 120)}`;

      if (Platform.OS === "web") {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareMessage);
          showToast("Link copied to clipboard!", "success");
        } else {
          showToast("Share not available on this browser", "info");
        }
      } else {
        await Share.share({
          message: shareMessage,
          title: "TandaXn Dream",
        });
      }
    } catch {
      // User cancelled share — do nothing
    }
  };

  const handleSupport = (post: FeedPost) => {
    const meta = post.metadata || {};
    if (meta.circleId || meta.circleName) {
      // Navigate to join the circle
      navigation.navigate("JoinCircleConfirm" as any, {
        circleId: meta.circleId || post.relatedId,
      });
    } else if (meta.goalName) {
      // Navigate to support the dream
      navigation.navigate("SupportDream" as any, {
        postId: post.id,
        authorName: post.authorName,
        authorAvatar: post.authorAvatar,
        goalName: meta.goalName,
        goalEmoji: meta.goalEmoji || "🎯",
        targetAmount: meta.targetAmount || 0,
        currentBalance: meta.currentBalance || 0,
      });
    } else {
      showToast("Support coming soon!", "info");
    }
  };

  const handleFilterChange = (filter: FeedFilter) => {
    setActiveFilter(filter);
  };

  const renderPost = ({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      isLiked={likedPostIds.has(item.id)}
      isSaved={savedPostIds.has(item.id)}
      onLike={toggleLike}
      onComment={handleCommentPress}
      onPress={handlePostPress}
      onAuthorPress={handleAuthorPress}
      onSupport={handleSupport}
      onClonePlan={handleClonePlan}
      onAccountability={handleAccountability}
      onSave={toggleSave}
      onXnScorePress={() => navigation.navigate("XnScoreDashboard" as any)}
      currentUserId={user?.id}
      onRetryUpload={handleRetryUpload}
    />
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.accentTeal} />
        <Text style={styles.loadingMoreText}>{t("dream_feed.loading_more")}</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    if (activeFilter === "following") {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{"\u{1F465}"}</Text>
          <Text style={styles.emptyTitle}>{t("dream_feed.empty_following_title")}</Text>
          <Text style={styles.emptySubtitle}>
            {t("dream_feed.empty_following_body")}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate("Circles" as any)}
          >
            <Ionicons name="people" size={18} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>{t("dream_feed.empty_following_btn")}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeFilter === "trending") {
      // Two flavors:
      //   - posts.length === 0  → "feed is empty" (use the body copy)
      //   - posts.length > 0    → "posts exist but none have likes yet"
      //                           (use the no-likes copy)
      const bodyKey =
        posts.length > 0
          ? "dream_feed.empty_trending_no_likes_body"
          : "dream_feed.empty_trending_body";
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{"\u{1F525}"}</Text>
          <Text style={styles.emptyTitle}>
            {t("dream_feed.empty_trending_title")}
          </Text>
          <Text style={styles.emptySubtitle}>{t(bodyKey)}</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>{"\u{2728}"}</Text>
        <Text style={styles.emptyTitle}>{t("dream_feed.empty_for_you_title")}</Text>
        <Text style={styles.emptySubtitle}>
          {t("dream_feed.empty_for_you_body")}
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate("CreateDreamPost")}
        >
          <Ionicons name="videocam" size={18} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>{t("dream_feed.empty_for_you_btn")}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t("dream_feed.header_title")}</Text>
          <Text style={styles.headerSubtitle}>{t("dream_feed.header_subtitle")}</Text>
        </View>
        <View style={styles.headerActions}>
          {/* My Dreams button */}
          <TouchableOpacity
            style={styles.myDreamsButton}
            onPress={() => {
              if (user?.id) {
                navigation.navigate("UserDreamProfile", { userId: user.id });
              }
            }}
          >
            <Ionicons name="person-outline" size={20} color={colors.accentTeal} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate("FeedSettings")}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              activeFilter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => handleFilterChange(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeFilter === tab.key ? "#FFFFFF" : colors.textSecondary}
            />
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
          <Text style={styles.loadingText}>{t("dream_feed.loading_text")}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (activeFilter === "for_you" && hasMore && !isLoadingMore) {
              fetchMorePosts();
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentTeal}
              colors={[colors.accentTeal]}
            />
          }
        />
      )}

      {/* FAB: Create Post */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateDreamPost")}
        activeOpacity={0.8}
      >
        <Ionicons name="videocam" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* First-visit coach mark — AsyncStorage-gated 2-slide overlay. */}
      <Modal
        visible={coachVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissCoach}
      >
        <View style={styles.coachBackdrop}>
          <View style={styles.coachCard}>
            <Ionicons
              name={coachSlide === 0 ? "sparkles-outline" : "hand-left-outline"}
              size={36}
              color={colors.accentTeal}
              style={{ marginBottom: 14 }}
            />
            <Text style={styles.coachTitle}>
              {t(`dream_feed.coach_slide${coachSlide + 1}_title`)}
            </Text>
            <Text style={styles.coachBody}>
              {t(`dream_feed.coach_slide${coachSlide + 1}_body`)}
            </Text>
            <View style={styles.coachDots}>
              <View
                style={[
                  styles.coachDot,
                  coachSlide === 0 && styles.coachDotActive,
                ]}
              />
              <View
                style={[
                  styles.coachDot,
                  coachSlide === 1 && styles.coachDotActive,
                ]}
              />
            </View>
            <View style={styles.coachActions}>
              <TouchableOpacity
                onPress={dismissCoach}
                style={styles.coachSkipBtn}
                accessibilityRole="button"
              >
                <Text style={styles.coachSkipText}>
                  {t("dream_feed.coach_skip")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (coachSlide === 1) {
                    dismissCoach();
                  } else {
                    setCoachSlide(1);
                  }
                }}
                style={styles.coachPrimaryBtn}
                accessibilityRole="button"
              >
                <Text style={styles.coachPrimaryText}>
                  {coachSlide === 1
                    ? t("dream_feed.coach_got_it")
                    : t("dream_feed.coach_next")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.cardBg,
  },
  headerTitle: {
    fontSize: typography.userName,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  myDreamsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navyTintBg,
    alignItems: "center",
    justifyContent: "center",
  },

  // Filter Tabs
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.screenBg,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: colors.accentTeal,
  },
  filterTabText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },

  // Feed
  feedContent: {
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  loadingMoreText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: 80,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentTeal,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    gap: 8,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },

  // ── Coach mark modal ──────────────────────────────────────────────
  coachBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  coachCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  coachTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  coachBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  coachDots: { flexDirection: "row", gap: 6, marginBottom: 18 },
  coachDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  coachDotActive: { backgroundColor: colors.accentTeal, width: 18 },
  coachActions: { flexDirection: "row", gap: 10, width: "100%" },
  coachSkipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.screenBg,
  },
  coachSkipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  coachPrimaryBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.accentTeal,
  },
  coachPrimaryText: {
    fontSize: 13,
    color: colors.textWhite,
    fontWeight: "700",
  },
});
