import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useFeed, FeedPost } from "../context/FeedContext";
import { useAuth } from "../context/AuthContext";
import FeedPostCard from "../components/FeedPostCard";
import { showToast } from "../components/Toast";
import { colors, radius, typography, spacing } from "../theme/tokens";

type DreamFeedNavigationProp = StackNavigationProp<any>;

type FeedFilter = "for_you" | "following" | "trending";

const FILTER_TABS: { key: FeedFilter; label: string; icon: string }[] = [
  { key: "for_you", label: "For You", icon: "sparkles" },
  { key: "following", label: "Following", icon: "people-outline" },
  { key: "trending", label: "Trending", icon: "trending-up" },
];

export default function DreamFeedScreen() {
  const navigation = useNavigation<DreamFeedNavigationProp>();
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
  } = useFeed();

  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("for_you");

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

  const handleClonePlan = (_post: FeedPost) => {
    showToast("Clone Plan coming soon!", "info");
  };

  const handleAccountability = (_post: FeedPost) => {
    showToast("Share coming soon!", "info");
  };

  const handleSupport = (_post: FeedPost) => {
    showToast("Support Dream coming soon!", "info");
  };

  const handleFilterChange = (filter: FeedFilter) => {
    setActiveFilter(filter);
    if (filter !== "for_you") {
      showToast(`${filter === "following" ? "Following" : "Trending"} feed coming soon!`, "info");
    }
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
      currentUserId={user?.id}
    />
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.accentTeal} />
        <Text style={styles.loadingMoreText}>Loading more dreams...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>{"\u{2728}"}</Text>
        <Text style={styles.emptyTitle}>No Dreams Yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to share your dream! Tap the + button below to create your first post.
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate("CreateDreamPost")}
        >
          <Ionicons name="videocam" size={18} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>Share Your Dream</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dream Feed</Text>
          <Text style={styles.headerSubtitle}>Dream. Save. Achieve.</Text>
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
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
          <Text style={styles.loadingText}>Loading dreams...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasMore && !isLoadingMore) {
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
});
