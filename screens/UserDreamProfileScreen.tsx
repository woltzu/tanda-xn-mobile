import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useFeed, FeedPost } from "../context/FeedContext";
import { useAuth } from "../context/AuthContext";
import FeedPostCard from "../components/FeedPostCard";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";

type ProfileRouteParams = {
  UserDreamProfile: { userId: string };
};

type UserProfile = {
  id: string;
  fullName: string;
  avatarUrl?: string;
  xnScore?: number;
};

export default function UserDreamProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ProfileRouteParams, "UserDreamProfile">>();
  const { userId } = route.params;
  const { user } = useAuth();
  const { getUserPosts, likedPostIds, toggleLike } = useFeed();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const isOwnProfile = userId === user?.id;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      </SafeAreaView>
    );
  }

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
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedPostCard
            post={item}
            isLiked={likedPostIds.has(item.id)}
            onLike={toggleLike}
            onComment={(postId) => navigation.navigate("PostComments", { postId })}
            onPress={(postId) => navigation.navigate("PostDetail", { postId })}
            currentUserId={user?.id}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {profile?.fullName?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              )}
            </View>
            <Text style={styles.profileName}>
              {isOwnProfile ? "You" : profile?.fullName || "Unknown"}
            </Text>
            {profile?.xnScore && (
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>XnScore: {profile.xnScore}</Text>
              </View>
            )}
            <Text style={styles.postCount}>{posts.length} dream posts</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyText}>
              {isOwnProfile
                ? "You haven't shared any dreams yet."
                : "No dream posts to show."}
            </Text>
          </View>
        }
      />
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
  listContent: {
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    backgroundColor: colors.cardBg,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  profileName: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  scoreBadge: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  scoreText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  postCount: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
});
