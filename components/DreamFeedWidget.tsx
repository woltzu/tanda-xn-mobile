import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFeed, FeedPost } from "../context/FeedContext";
import { colors, radius, typography, spacing } from "../theme/tokens";

type DreamFeedWidgetProps = {
  onViewAll: () => void;
  onPostPress: (postId: string) => void;
};

// Post type emoji map
const TYPE_EMOJI: Record<string, string> = {
  dream: "✨",
  milestone: "🏆",
  contribution: "💰",
  goal_created: "🎯",
  goal_reached: "🎉",
  circle_joined: "🤝",
  payout_received: "💸",
  xn_level_up: "⬆️",
};

const formatTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
};

export default function DreamFeedWidget({ onViewAll, onPostPress }: DreamFeedWidgetProps) {
  const { posts, isLoading } = useFeed();

  // Show latest 3 posts
  const latestPosts = posts.slice(0, 3);

  if (isLoading || latestPosts.length === 0) {
    return (
      <TouchableOpacity style={styles.container} onPress={onViewAll} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerEmoji}>✨</Text>
            <Text style={styles.headerTitle}>Dream Feed</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </View>
        <Text style={styles.emptyText}>
          {isLoading ? "Loading dreams..." : "Share your first dream with the community!"}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={onViewAll}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>✨</Text>
          <Text style={styles.headerTitle}>Dream Feed</Text>
        </View>
        <View style={styles.viewAllRow}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accentTeal} />
        </View>
      </TouchableOpacity>

      {latestPosts.map((post, index) => (
        <TouchableOpacity
          key={post.id}
          style={[styles.postRow, index < latestPosts.length - 1 && styles.postRowBorder]}
          onPress={() => onPostPress(post.id)}
          activeOpacity={0.6}
        >
          <Text style={styles.postEmoji}>{TYPE_EMOJI[post.type] || "✨"}</Text>
          <View style={styles.postContent}>
            <Text style={styles.postAuthor}>
              {post.visibility === "anonymous" ? "Anonymous" : post.authorName}
            </Text>
            <Text style={styles.postText} numberOfLines={1}>
              {post.content}
            </Text>
          </View>
          <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerEmoji: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: typography.bodySmall,
    color: colors.accentTeal,
    fontWeight: typography.semibold,
    marginRight: 2,
  },
  emptyText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  postRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  postRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  postEmoji: {
    fontSize: 16,
    marginRight: spacing.sm,
    width: 24,
    textAlign: "center",
  },
  postContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  postAuthor: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  postText: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  postTime: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
});
