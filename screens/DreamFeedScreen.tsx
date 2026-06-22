import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Pressable,
  ScrollView,
  Animated,
  Easing,
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
import { useEventTracker } from "../hooks/useEventTracker";
import FeedPostCard from "../components/FeedPostCard";
import { showToast } from "../components/Toast";
import { uploadToBucket } from "../utils/image";
import { colors, radius, typography, spacing } from "../theme/tokens";

const COACH_MARK_KEY = "@tandaxn_dream_feed_seen_v1";
const RETRY_URI_KEY_PREFIX = "@tandaxn_dream_post_retry_uri:";
const FEED_IMAGES_BUCKET = "feed-images";

// VDF Bucket B.1 — HelpSheet topics for the (?) header trigger.
type HelpTopic = "what_is_dream" | "what_is_support" | "what_is_cheer" | "who_sees";
const HELP_TOPICS: HelpTopic[] = [
  "what_is_dream",
  "what_is_support",
  "what_is_cheer",
  "who_sees",
];

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
    // VDF Bucket C.5 — trending data pool, server-ranked via the
    // get_trending_dreams RPC.
    trendingPosts,
    isLoadingTrending,
    isLoadingTrendingMore,
    trendingHasMore,
    fetchTrendingPosts,
  } = useFeed();

  // VDF Bucket C.1 — telemetry. One-shot mount fire for
  // dream_feed.viewed; per-action handlers below.
  const { track } = useEventTracker();
  const viewedFiredRef = useRef(false);
  useEffect(() => {
    if (viewedFiredRef.current) return;
    viewedFiredRef.current = true;
    track({
      eventType: "dream_feed.viewed",
      eventCategory: "dream_feed",
      eventAction: "viewed",
    });
  }, [track]);

  // Cache-aware refetch on focus — uses the 5-minute in-memory cache so
  // tab-switching is cheap. Pull-to-refresh still busts the cache via
  // refreshFeed.
  useFocusEffect(
    useCallback(() => {
      refetchFeed();
    }, [refetchFeed]),
  );

  // VDF Bucket B.1 — HelpSheet visibility.
  const [helpOpen, setHelpOpen] = useState(false);

  // VDF Bucket B.6 — skeleton pulse driver. Shared Animated.Value
  // keeps the placeholder cards in lock-step. Runs only during the
  // cold initial load (matches the WalletScreen + BrowseEvents
  // patterns).
  const skeletonPulse = useRef(new Animated.Value(0.5)).current;
  const showSkeleton = isLoading && posts.length === 0;
  useEffect(() => {
    if (!showSkeleton) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(skeletonPulse, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showSkeleton, skeletonPulse]);

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

  // VDF Bucket C.5 — Trending tab is server-ranked. The other two
  // tabs (For You / Following) stay on the chronological feed +
  // useFilteredFeed client filter.
  const displayedPosts =
    activeFilter === "trending" ? trendingPosts : filteredPosts;
  const showTrendingSpinner =
    activeFilter === "trending" && isLoadingTrending && trendingPosts.length === 0;

  // Initial trending fetch when the user first switches to / lands
  // on the Trending tab. Subsequent visits skip if data is loaded.
  useEffect(() => {
    if (activeFilter !== "trending") return;
    if (trendingPosts.length > 0) return;
    fetchTrendingPosts({ reset: true });
  }, [activeFilter, trendingPosts.length, fetchTrendingPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // VDF Bucket C.1 — refresh_pulled telemetry.
    track({
      eventType: "dream_feed.refresh_pulled",
      eventCategory: "dream_feed",
      eventAction: "refresh_pulled",
      eventLabel: activeFilter,
    });
    if (activeFilter === "trending") {
      await fetchTrendingPosts({ reset: true });
    } else {
      await refreshFeed();
    }
    setRefreshing(false);
  }, [refreshFeed, activeFilter, fetchTrendingPosts, track]);

  const handlePostPress = (postId: string) => {
    // VDF Bucket C.1 — post_opened (card tap).
    track({
      eventType: "dream_feed.post_opened",
      eventCategory: "dream_feed",
      eventAction: "opened",
      eventLabel: "card_tap",
      eventValue: { post_id: postId, source: "card_tap" },
    });
    navigation.navigate("PostDetail", { postId });
  };

  // VDF Bucket B.7 — DreamPostCommentsScreen was a duplicate of the
  // inline comments rendered by PostDetailScreen. Comment icon now
  // routes to PostDetail with focusComment='1' so the input auto-
  // focuses with the keyboard up.
  const handleCommentPress = (postId: string) => {
    // VDF Bucket C.1 — post_opened (comment tap).
    track({
      eventType: "dream_feed.post_opened",
      eventCategory: "dream_feed",
      eventAction: "opened",
      eventLabel: "comment_tap",
      eventValue: { post_id: postId, source: "comment_tap" },
    });
    navigation.navigate("PostDetail", { postId, focusComment: "1" });
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
        source: "feed",
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
    // VDF Bucket C.1 — tab_changed telemetry.
    track({
      eventType: "dream_feed.tab_changed",
      eventCategory: "dream_feed",
      eventAction: "tab_changed",
      eventLabel: filter,
    });
  };

  // VDF Bucket C.1 — scroll_depth telemetry. Debounced at 500 ms;
  // fires once per quartile crossed (25 / 50 / 75 / 100) per session
  // for the active filter. A Set tracks crossed milestones so a user
  // bouncing past 75% doesn't re-fire on the way back.
  const scrollMilestonesFiredRef = useRef<Set<number>>(new Set());
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const viewable = contentOffset.y + layoutMeasurement.height;
      const total = Math.max(contentSize.height, 1);
      const pct = Math.min(100, Math.round((viewable / total) * 100));
      const bucket =
        pct >= 100 ? 100 : pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0;
      if (bucket === 0) return;
      if (scrollMilestonesFiredRef.current.has(bucket)) return;
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
      scrollDebounceRef.current = setTimeout(() => {
        if (scrollMilestonesFiredRef.current.has(bucket)) return;
        scrollMilestonesFiredRef.current.add(bucket);
        track({
          eventType: "dream_feed.scroll_depth",
          eventCategory: "dream_feed",
          eventAction: "scroll",
          eventLabel: `${bucket}`,
          eventValue: { depth: bucket, tab: activeFilter },
        });
      }, 500);
    },
    [track, activeFilter],
  );
  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, []);

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
    const showMoreSpinner =
      activeFilter === "trending" ? isLoadingTrendingMore : isLoadingMore;
    if (!showMoreSpinner) return null;
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
          <Ionicons name="add" size={18} color="#FFFFFF" />
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
          {/* VDF Bucket B.1 — HelpSheet trigger. Recurrent access to
              the same 4 topics the 2-slide first-visit coach covers,
              for returning users who want a refresher. */}
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setHelpOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("dream_feed.help.title")}
          >
            <Ionicons
              name="help-circle-outline"
              size={22}
              color={colors.textPrimary}
            />
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

      {/* Feed. VDF Bucket B.6 — cold load renders 3 skeleton cards
          instead of a centred spinner; layout stays stable as data
          lands. C.5 — trending uses its own loading flag. */}
      {showSkeleton || showTrendingSpinner ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <FeedSkeletonCard key={i} pulse={skeletonPulse} />
          ))}
        </View>
      ) : (
        <FlatList
          data={displayedPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={250}
          onEndReached={() => {
            // VDF Bucket C.5 — Trending paginates through the RPC
            // offset cursor; For You / Following share the
            // chronological lt-cursor in FeedContext.
            if (activeFilter === "trending") {
              if (trendingHasMore && !isLoadingTrendingMore) {
                fetchTrendingPosts();
              }
            } else {
              if (hasMore && !isLoadingMore) {
                fetchMorePosts();
              }
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

      {/* FAB: Create Post — VDF A.5 (2026-06-21) videocam → add. P1
          dropped the video flow; the empty-state icon was fixed in
          CDP A.7 but this FAB instance was missed. */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateDreamPost")}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
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

      {/* VDF Bucket B.1 — HelpSheet. Modal slides from bottom, backdrop
          tap dismisses. Four topics keyed by HELP_TOPICS. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HelpSheet — VDF Bucket B.1
// ════════════════════════════════════════════════════════════════════════════
function HelpSheet({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: (key: string, opts?: any) => string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={helpStyles.backdrop} onPress={onClose}>
        <Pressable style={helpStyles.sheet} onPress={() => undefined}>
          <View style={helpStyles.handle} />
          <View style={helpStyles.headerRow}>
            <Text style={helpStyles.title}>{t("dream_feed.help.title")}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("dream_feed.help.close")}
            >
              <Ionicons name="close" size={22} color={colors.primaryNavy} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={helpStyles.item}>
                <Text style={helpStyles.itemTitle}>
                  {t(`dream_feed.help.${topic}_title`)}
                </Text>
                <Text style={helpStyles.itemBody}>
                  {t(`dream_feed.help.${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FeedSkeletonCard — VDF Bucket B.6
// ════════════════════════════════════════════════════════════════════════════
// Pulsing placeholder that approximates the FeedPostCard footprint —
// avatar row, content block, image area, footer row — so the layout
// doesn't jump when real data lands.
function FeedSkeletonCard({ pulse }: { pulse: Animated.Value }) {
  return (
    <Animated.View style={[styles.skeletonCard, { opacity: pulse }]}>
      <View style={styles.skeletonHeaderRow}>
        <View style={styles.skeletonAvatar} />
        <View style={{ flex: 1 }}>
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLineNarrow} />
        </View>
      </View>
      <View style={styles.skeletonLineFull} />
      <View style={styles.skeletonLineFull} />
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonFooter}>
        <View style={styles.skeletonChip} />
        <View style={styles.skeletonChip} />
        <View style={styles.skeletonChip} />
      </View>
    </Animated.View>
  );
}

const helpStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.primaryNavy },
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
});

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
  // VDF Bucket B.1 — (?) help button. Same footprint as the other
  // header buttons; neutral navy tint to read as "info" not "action".
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navyTintBg,
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

  // VDF Bucket B.6 — skeleton card styles.
  skeletonWrap: { paddingTop: spacing.md },
  skeletonCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: spacing.md,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  skeletonLineWide: {
    width: "60%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    marginBottom: 6,
  },
  skeletonLineNarrow: {
    width: "30%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
  },
  skeletonLineFull: {
    width: "100%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  },
  skeletonImage: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    marginTop: 4,
    marginBottom: 12,
  },
  skeletonFooter: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  skeletonChip: {
    width: 60,
    height: 16,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
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
