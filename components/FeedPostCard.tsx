import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FeedPost, FeedPostType } from "../context/FeedContext";
import { colors, radius, typography, spacing } from "../theme/tokens";

type FeedPostCardProps = {
  post: FeedPost;
  isLiked: boolean;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onPress: (postId: string) => void;
  onAuthorPress?: (userId: string) => void;
  currentUserId?: string;
};

// Post type configurations
const POST_TYPE_CONFIG: Record<FeedPostType, { emoji: string; label: string; color: string }> = {
  dream: { emoji: "✨", label: "Dream", color: "#8B5CF6" },
  milestone: { emoji: "🏆", label: "Milestone", color: "#F59E0B" },
  contribution: { emoji: "💰", label: "Contribution", color: "#10B981" },
  goal_created: { emoji: "🎯", label: "New Goal", color: "#3B82F6" },
  goal_reached: { emoji: "🎉", label: "Goal Reached!", color: "#10B981" },
  circle_joined: { emoji: "🤝", label: "Joined Circle", color: "#6366F1" },
  payout_received: { emoji: "💸", label: "Payout", color: "#059669" },
  xn_level_up: { emoji: "⬆️", label: "Level Up", color: "#EC4899" },
};

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function FeedPostCard({
  post,
  isLiked,
  onLike,
  onComment,
  onPress,
  onAuthorPress,
  currentUserId,
}: FeedPostCardProps) {
  const config = POST_TYPE_CONFIG[post.type] || POST_TYPE_CONFIG.dream;
  const isAnonymous = post.visibility === "anonymous";
  const isOwnPost = post.userId === currentUserId;
  const displayName = isAnonymous && !isOwnPost ? "Anonymous Member" : post.authorName;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(post.id)}
      activeOpacity={0.7}
    >
      {/* Header: Avatar + Name + Type Badge + Time */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => !isAnonymous && onAuthorPress?.(post.userId)}
          disabled={isAnonymous && !isOwnPost}
        >
          <View style={styles.avatar}>
            {post.authorAvatar && !isAnonymous ? (
              <Image source={{ uri: post.authorAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {isAnonymous && !isOwnPost ? "?" : displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName} numberOfLines={1}>
              {isOwnPost ? "You" : displayName}
            </Text>
            <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: config.color + "15" }]}>
          <Text style={styles.typeBadgeEmoji}>{config.emoji}</Text>
          <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {/* Content */}
      <Text style={styles.content} numberOfLines={4}>
        {post.content}
      </Text>

      {/* Amount pill (if applicable and not anonymous) */}
      {post.amount && post.amount > 0 && !(isAnonymous && !isOwnPost) && (
        <View style={styles.amountPill}>
          <Text style={styles.amountText}>
            ${post.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.amountCurrency}>{post.currency}</Text>
        </View>
      )}

      {/* Image (if any) */}
      {post.imageUrl && (
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Footer: Like + Comment counts */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onLike(post.id)}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#EF4444" : colors.textSecondary}
          />
          <Text style={[styles.actionText, isLiked && { color: "#EF4444" }]}>
            {post.likesCount > 0 ? post.likesCount : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onComment(post.id)}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.actionText}>
            {post.commentsCount > 0 ? post.commentsCount : ""}
          </Text>
        </TouchableOpacity>

        {/* Auto-generated indicator */}
        {post.isAuto && (
          <View style={styles.autoIndicator}>
            <Ionicons name="flash-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.autoText}>Auto</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  typeBadgeEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  typeBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
  },
  content: {
    fontSize: typography.body,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  amountPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.small,
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  amountText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.successText,
  },
  amountCurrency: {
    fontSize: typography.labelSmall,
    color: colors.successLabel,
    marginLeft: spacing.xs,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: radius.small,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.xl,
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  autoIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
  },
  autoText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginLeft: 2,
  },
});
