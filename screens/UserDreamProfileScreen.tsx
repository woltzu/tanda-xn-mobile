import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useFeed, FeedPost } from "../context/FeedContext";
import { useAuth } from "../context/AuthContext";
import FeedPostCard from "../components/FeedPostCard";
import { showToast } from "../components/Toast";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIDEO_GRID_COLS = 3;
const VIDEO_GRID_GAP = 2;
const VIDEO_THUMB_WIDTH = (SCREEN_WIDTH - VIDEO_GRID_GAP * (VIDEO_GRID_COLS + 1)) / VIDEO_GRID_COLS;
const VIDEO_THUMB_HEIGHT = VIDEO_THUMB_WIDTH * (16 / 9);

type ProfileRouteParams = {
  UserDreamProfile: { userId: string };
};

type UserProfile = {
  id: string;
  fullName: string;
  avatarUrl?: string;
  xnScore?: number;
};

type TabKey = "videos" | "all";

// Blueprint engagement placeholder handlers
const handleClonePlan = (_post: FeedPost) => {
  showToast("Clone Plan coming soon!", "info");
};
const handleAccountability = (_post: FeedPost) => {
  showToast("Accountability Link coming soon!", "info");
};
const handleSupport = (_post: FeedPost) => {
  showToast("Support Dream coming soon!", "info");
};

export default function UserDreamProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ProfileRouteParams, "UserDreamProfile">>();
  const { userId } = route.params;
  const { user } = useAuth();
  const { getUserPosts, likedPostIds, savedPostIds, toggleLike, toggleSave } = useFeed();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("videos");

  const isOwnProfile = userId === user?.id;

  // Derived data
  const videoPosts = useMemo(
    () => posts.filter((p) => p.metadata?.mediaType === "video" && p.imageUrl),
    [posts]
  );
  const totalLikes = useMemo(
    () => posts.reduce((sum, p) => sum + p.likesCount, 0),
    [posts]
  );

  useEffect(() => {
    loadProfileAndPosts();
  }, [userId]);

  const loadProfileAndPosts = async () => {
    setIsLoading(true);

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, xn_score")
      .eq("id", userId)
      .single();

    if (profileData) {
      setProfile({
        id: profileData.id,
        fullName: profileData.full_name || "Unknown",
        avatarUrl: profileData.avatar_url || undefined,
        xnScore: profileData.xn_score || undefined,
      });
    }

    // Fetch user posts
    const userPosts = await getUserPosts(userId);
    setPosts(userPosts);
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const userPosts = await getUserPosts(userId);
    setPosts(userPosts);
    setRefreshing(false);
  }, [userId, getUserPosts]);

  // =========================================
  // Profile Header (used as FlatList header)
  // =========================================
  const renderProfileHeader = () => (
    <View>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {profile?.fullName?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {isOwnProfile ? "My Dream Portfolio" : profile?.fullName || "Unknown"}
            </Text>
            {profile?.xnScore ? (
              <View style={styles.scoreBadge}>
                <Ionicons name="shield-checkmark" size={12} color={colors.accentTeal} />
                <Text style={styles.scoreText}>XnScore: {profile.xnScore}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{videoPosts.length}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalLikes}</Text>
            <Text style={styles.statLabel}>Saves</Text>
          </View>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "videos" && styles.tabActive]}
          onPress={() => setActiveTab("videos")}
        >
          <Ionicons
            name="videocam"
            size={18}
            color={activeTab === "videos" ? colors.accentTeal : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === "videos" && styles.tabTextActive]}>
            Videos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && styles.tabActive]}
          onPress={() => setActiveTab("all")}
        >
          <Ionicons
            name="grid-outline"
            size={18}
            color={activeTab === "all" ? colors.accentTeal : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
            All Posts
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // =========================================
  // Video Grid Item
  // =========================================
  const renderVideoGridItem = ({ item }: { item: FeedPost }) => {
    const meta = item.metadata || {};
    const hasGoalProgress = meta.targetAmount && meta.currentBalance !== undefined;
    const progress = hasGoalProgress
      ? Math.round((meta.currentBalance / meta.targetAmount) * 100)
      : meta.progress || null;

    return (
      <TouchableOpacity
        style={styles.videoThumb}
        onPress={() => navigation.navigate("PostDetail", { postId: item.id })}
        activeOpacity={0.8}
      >
        {/* Dark background placeholder */}
        <View style={styles.videoThumbBg}>
          {/* Play icon overlay */}
          <View style={styles.videoThumbPlay}>
            <Ionicons name="play" size={24} color="#FFFFFF" />
          </View>

          {/* Bottom info overlay */}
          <View style={styles.videoThumbOverlay}>
            {/* Like count */}
            <View style={styles.videoThumbStat}>
              <Ionicons name="wallet" size={12} color="#FFFFFF" />
              <Text style={styles.videoThumbStatText}>{item.likesCount}</Text>
            </View>
            {/* Progress badge */}
            {progress !== null && (
              <View style={styles.videoThumbProgress}>
                <Text style={styles.videoThumbProgressText}>{progress}%</Text>
              </View>
            )}
          </View>

          {/* Post type emoji badge */}
          <View style={styles.videoThumbType}>
            <Text style={{ fontSize: 10 }}>
              {meta.goalEmoji || meta.circleEmoji || "\u{2728}"}
            </Text>
          </View>
        </View>

        {/* Caption below thumbnail */}
        <Text style={styles.videoThumbCaption} numberOfLines={2}>
          {item.content}
        </Text>
      </TouchableOpacity>
    );
  };

  // =========================================
  // All Posts list item
  // =========================================
  const renderPostItem = ({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      isLiked={likedPostIds.has(item.id)}
      isSaved={savedPostIds.has(item.id)}
      onLike={toggleLike}
      onComment={(postId) => navigation.navigate("PostComments", { postId })}
      onPress={(postId) => navigation.navigate("PostDetail", { postId })}
      onAuthorPress={(uid) => {
        if (uid !== userId) navigation.navigate("UserDreamProfile", { userId: uid });
      }}
      onSupport={handleSupport}
      onClonePlan={handleClonePlan}
      onAccountability={handleAccountability}
      onSave={toggleSave}
      currentUserId={user?.id}
    />
  );

  // =========================================
  // Empty States
  // =========================================
  const renderVideoEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="videocam-outline" size={48} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Videos Yet</Text>
      <Text style={styles.emptyText}>
        {isOwnProfile
          ? "Record a video to share your dream journey. Videos are the most powerful way to inspire others!"
          : "This dreamer hasn't posted any videos yet."}
      </Text>
      {isOwnProfile && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate("CreateDreamPost")}
        >
          <Ionicons name="videocam" size={18} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>Record Your Dream</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAllEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{"\u{2728}"}</Text>
      <Text style={styles.emptyTitle}>No Dreams Yet</Text>
      <Text style={styles.emptyText}>
        {isOwnProfile
          ? "Share your first dream! Tap the button below to get started."
          : "No dream posts to show."}
      </Text>
      {isOwnProfile && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate("CreateDreamPost")}
        >
          <Text style={styles.emptyButtonText}>Share Your Dream</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // =========================================
  // Loading State
  // =========================================
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      </SafeAreaView>
    );
  }

  // =========================================
  // Main Render
  // =========================================
  const currentData = activeTab === "videos" ? videoPosts : posts;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isOwnProfile ? "My Dreams" : "Dream Profile"}
        </Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => navigation.navigate("CreateDreamPost")}>
            <Ionicons name="add-circle-outline" size={24} color={colors.accentTeal} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <FlatList
        key={activeTab} // Force re-mount when switching between grid and list
        data={currentData}
        keyExtractor={(item) => item.id}
        renderItem={activeTab === "videos" ? renderVideoGridItem : renderPostItem}
        numColumns={activeTab === "videos" ? VIDEO_GRID_COLS : 1}
        columnWrapperStyle={activeTab === "videos" ? styles.videoGridRow : undefined}
        contentContainerStyle={activeTab === "videos" ? styles.videoGridContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderProfileHeader}
        ListEmptyComponent={activeTab === "videos" ? renderVideoEmpty : renderAllEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentTeal}
            colors={[colors.accentTeal]}
          />
        }
      />

      {/* FAB: Create Post (own profile only) */}
      {isOwnProfile && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("CreateDreamPost")}
          activeOpacity={0.8}
        >
          <Ionicons name="videocam" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.cardBg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: 0,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    gap: 4,
  },
  scoreText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },

  // Tab Switcher
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.accentTeal,
  },
  tabText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.accentTeal,
  },

  // Video Grid
  videoGridContent: {
    paddingBottom: 100,
  },
  videoGridRow: {
    gap: VIDEO_GRID_GAP,
    paddingHorizontal: VIDEO_GRID_GAP,
  },
  videoThumb: {
    width: VIDEO_THUMB_WIDTH,
    marginBottom: VIDEO_GRID_GAP,
  },
  videoThumbBg: {
    width: "100%",
    height: VIDEO_THUMB_HEIGHT,
    backgroundColor: "#1A1A2E",
    borderRadius: radius.small,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  videoThumbPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 198, 174, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  videoThumbOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  videoThumbStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  videoThumbStatText: {
    fontSize: 10,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
  videoThumbProgress: {
    backgroundColor: colors.accentTeal,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  videoThumbProgressText: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
  videoThumbType: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  videoThumbCaption: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    paddingHorizontal: 2,
    lineHeight: 14,
  },

  // All Posts list
  listContent: {
    paddingBottom: 100,
  },

  // Empty States
  emptyState: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xl,
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

  // FAB
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
