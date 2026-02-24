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
  dream: { emoji: "\u{2728}", label: "Dream", color: "#8B5CF6" },
  milestone: { emoji: "\u{1F3C6}", label: "Milestone", color: "#F59E0B" },
  contribution: { emoji: "\u{1F4B0}", label: "Contribution", color: "#10B981" },
  goal_created: { emoji: "\u{1F3AF}", label: "New Goal", color: "#3B82F6" },
  goal_reached: { emoji: "\u{1F389}", label: "Goal Reached!", color: "#10B981" },
  circle_joined: { emoji: "\u{1F91D}", label: "Joined Circle", color: "#6366F1" },
  payout_received: { emoji: "\u{1F4B8}", label: "Payout", color: "#059669" },
  xn_level_up: { emoji: "\u{2B06}\u{FE0F}", label: "Level Up", color: "#EC4899" },
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

  // Extract progress data from metadata
  const meta = post.metadata || {};
  const hasGoalProgress = meta.targetAmount && meta.currentBalance !== undefined;
  const hasCircleProgress = meta.circleName && meta.progress !== undefined;
  const progress = hasGoalProgress
    ? Math.round((meta.currentBalance / meta.targetAmount) * 100)
    : hasCircleProgress
      ? meta.progress
      : null;

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

      {/* Goal Progress Card */}
      {hasGoalProgress && (
        <View style={styles.progressCard}>
          <View style={styles.progressCardHeader}>
            <Text style={styles.progressEmoji}>{meta.goalEmoji || "\u{1F3AF}"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressTitle} numberOfLines={1}>
                {meta.goalName}
              </Text>
              <Text style={styles.progressSubtext}>
                ${Number(meta.currentBalance).toLocaleString()} of $
                {Number(meta.targetAmount).toLocaleString()}
              </Text>
            </View>
            <View style={styles.progressPercentBadge}>
              <Text style={styles.progressPercentText}>{progress}%</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(progress || 0, 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Circle Info Card */}
      {hasCircleProgress && !hasGoalProgress && (
        <View style={styles.progressCard}>
          <View style={styles.progressCardHeader}>
            <Text style={styles.progressEmoji}>{meta.circleEmoji || "\u{1F91D}"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressTitle} numberOfLines={1}>
                {meta.circleName}
              </Text>
              <Text style={styles.progressSubtext}>
                {meta.currentMembers || "?"} members {"\u00B7"} $
                {meta.contributionAmount || "??"}/{meta.frequency || "month"}
              </Text>
            </View>
            <View style={styles.progressPercentBadge}>
              <Text style={styles.progressPercentText}>{progress}%</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(progress || 0, 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* New Dream Category Badge */}
      {meta.dreamTitle && meta.dreamCategory && !hasGoalProgress && !hasCircleProgress && (
        <View style={styles.dreamBadge}>
          <Text style={styles.dreamBadgeEmoji}>{meta.dreamCategoryEmoji || "\u{2728}"}</Text>
          <Text style={styles.dreamBadgeText}>{meta.dreamTitle}</Text>
        </View>
      )}

      {/* Amount pill (if applicable and not anonymous) */}
      {post.amount && post.amount > 0 && !(isAnonymous && !isOwnPost) && !hasGoalProgress && (
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

  // Progress card (goal/circle data)
  progressCard: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.small,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  progressTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  progressSubtext: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  progressPercentBadge: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  progressPercentText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 3,
  },

  // Dream badge
  dreamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.08)",
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: "flex-start",
  },
  dreamBadgeEmoji: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  dreamBadgeText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: "#8B5CF6",
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
