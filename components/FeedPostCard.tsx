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
import VideoPlayer from "./VideoPlayer";

type FeedPostCardProps = {
  post: FeedPost;
  isLiked: boolean;
  isSaved?: boolean;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onPress: (postId: string) => void;
  onAuthorPress?: (userId: string) => void;
  onSupport?: (post: FeedPost) => void;
  onClonePlan?: (post: FeedPost) => void;
  onAccountability?: (post: FeedPost) => void;
  onSave?: (postId: string) => void;
  currentUserId?: string;
};

// Post type configurations — Blueprint vocabulary
const POST_TYPE_CONFIG: Record<FeedPostType, { emoji: string; label: string; color: string }> = {
  dream: { emoji: "\u{2728}", label: "Dream", color: "#8B5CF6" },
  milestone: { emoji: "\u{1F3C6}", label: "Savings Milestone", color: "#F59E0B" },
  contribution: { emoji: "\u{1F4B0}", label: "Streak Update", color: "#10B981" },
  goal_created: { emoji: "\u{1F3AF}", label: "New Goal", color: "#3B82F6" },
  goal_reached: { emoji: "\u{1F389}", label: "Dream Achieved!", color: "#10B981" },
  circle_joined: { emoji: "\u{1F91D}", label: "Group Win", color: "#6366F1" },
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
  onSupport,
  onClonePlan,
  onAccountability,
  onSave,
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
  const isVideo = meta.mediaType === "video" && post.imageUrl;

  // ============================================
  // VIDEO POST — TikTok-style full-width layout
  // ============================================
  if (isVideo) {
    return (
      <TouchableOpacity
        style={styles.videoCard}
        onPress={() => onPress(post.id)}
        activeOpacity={0.95}
      >
        {/* Full-width video with floating side actions */}
        <View style={styles.videoHero}>
          <VideoPlayer
            uri={post.imageUrl!}
            style={styles.videoPlayer}
            thumbnailMode
            showControls={false}
            disableTouch={false}
            aspectRatio={9 / 16}
          />

          {/* Floating side action buttons — TandaXn engagement */}
          <View style={styles.sideActions}>
            {/* I Saved Too */}
            <TouchableOpacity
              style={styles.sideBtn}
              onPress={() => onLike(post.id)}
            >
              <View style={[styles.sideBtnCircle, isLiked && { backgroundColor: "rgba(0, 198, 174, 0.3)" }]}>
                <Ionicons
                  name={isLiked ? "wallet" : "wallet-outline"}
                  size={24}
                  color={isLiked ? colors.accentTeal : "#FFFFFF"}
                />
              </View>
              <Text style={[styles.sideBtnCount, isLiked && { color: colors.accentTeal }]}>
                {post.likesCount > 0 ? post.likesCount : "Saved"}
              </Text>
            </TouchableOpacity>

            {/* Join — context-aware label */}
            <TouchableOpacity
              style={styles.sideBtn}
              onPress={() => onComment(post.id)}
            >
              <View style={styles.sideBtnCircle}>
                <Ionicons name="flag-outline" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.sideBtnCount}>
                {post.commentsCount > 0 ? post.commentsCount : "Join"}
              </Text>
            </TouchableOpacity>

            {/* Clone Goal — start a similar dream */}
            <TouchableOpacity
              style={styles.sideBtn}
              onPress={() => onClonePlan?.(post)}
            >
              <View style={styles.sideBtnCircle}>
                <Ionicons name="copy-outline" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.sideBtnCount}>Clone</Text>
            </TouchableOpacity>

            {/* Join Circle / Support — only for others' goal/circle posts */}
            {(hasGoalProgress || hasCircleProgress) && !isOwnPost && onSupport && (
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => onSupport(post)}
              >
                <View style={[styles.sideBtnCircle, { backgroundColor: colors.accentTeal }]}>
                  <Ionicons name="hand-left" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.sideBtnCount}>
                  {hasCircleProgress ? "Join" : "Support"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Share */}
            <TouchableOpacity
              style={styles.sideBtn}
              onPress={() => onAccountability?.(post)}
            >
              <View style={styles.sideBtnCircle}>
                <Ionicons name="arrow-redo" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.sideBtnCount}>Share</Text>
            </TouchableOpacity>

            {/* Save for later */}
            {onSave && (
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => onSave(post.id)}
              >
                <View style={[styles.sideBtnCircle, isSaved && { backgroundColor: "rgba(245, 158, 11, 0.3)" }]}>
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={22}
                    color={isSaved ? "#F59E0B" : "#FFFFFF"}
                  />
                </View>
                <Text style={[styles.sideBtnCount, isSaved && { color: "#F59E0B" }]}>
                  {isSaved ? "Saved" : "Save"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom overlay: author + caption */}
          <View style={styles.videoOverlayBottom} pointerEvents="none">
            <View style={styles.videoOverlayAuthor}>
              <View style={styles.videoOverlayAvatar}>
                {post.authorAvatar && !isAnonymous ? (
                  <Image source={{ uri: post.authorAvatar }} style={styles.videoOverlayAvatarImg} />
                ) : (
                  <Text style={styles.videoOverlayAvatarText}>
                    {isAnonymous && !isOwnPost ? "?" : displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.videoOverlayName}>
                {isOwnPost ? "You" : displayName}
              </Text>
              <View style={styles.videoOverlayTypeBadge}>
                <Text style={{ fontSize: 11 }}>{config.emoji}</Text>
              </View>
            </View>
            <Text style={styles.videoOverlayCaption} numberOfLines={2}>
              {post.content}
            </Text>
            {meta.location && (
              <View style={styles.videoOverlayLocRow}>
                <Ionicons name="location" size={11} color="#FFFFFF" />
                <Text style={styles.videoOverlayLocText}>{meta.location}</Text>
              </View>
            )}
            {meta.hashtags && meta.hashtags.length > 0 && (
              <Text style={styles.videoOverlayTags}>
                {meta.hashtags.map((t: string) => `#${t}`).join(" ")}
              </Text>
            )}
          </View>

          {/* Goal/Circle progress bar at very bottom */}
          {(hasGoalProgress || hasCircleProgress) && (
            <View style={styles.videoProgressBar}>
              <Text style={styles.videoProgressEmoji}>
                {hasGoalProgress ? (meta.goalEmoji || "\u{1F3AF}") : (meta.circleEmoji || "\u{1F91D}")}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.videoProgressName} numberOfLines={1}>
                  {hasGoalProgress ? meta.goalName : meta.circleName}
                </Text>
                <View style={styles.videoProgressTrack}>
                  <View style={[styles.videoProgressFill, { width: `${Math.min(progress || 0, 100)}%` }]} />
                </View>
              </View>
              <Text style={styles.videoProgressPercent}>{progress}%</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ============================================
  // NON-VIDEO POST — Standard card layout
  // ============================================
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

      {/* Circle Info Card — enriched with spots and per-person */}
      {hasCircleProgress && !hasGoalProgress && (
        <View style={styles.progressCard}>
          <View style={styles.progressCardHeader}>
            <Text style={styles.progressEmoji}>{meta.circleEmoji || "\u{1F91D}"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressTitle} numberOfLines={1}>
                {meta.circleName}
              </Text>
              <Text style={styles.progressSubtext}>
                {meta.currentMembers || "?"}/{meta.memberCount || "?"} members {"\u00B7"} $
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
          {/* Spots left indicator */}
          {meta.memberCount && meta.currentMembers && meta.memberCount > meta.currentMembers && (
            <Text style={styles.spotsLeftText}>
              {meta.memberCount - meta.currentMembers} spot{meta.memberCount - meta.currentMembers !== 1 ? "s" : ""} left
            </Text>
          )}
        </View>
      )}

      {/* New Dream Category Badge */}
      {meta.dreamTitle && meta.dreamCategory && !hasGoalProgress && !hasCircleProgress && (
        <View style={styles.dreamBadge}>
          <Text style={styles.dreamBadgeEmoji}>{meta.dreamCategoryEmoji || "\u{2728}"}</Text>
          <Text style={styles.dreamBadgeText}>{meta.dreamTitle}</Text>
        </View>
      )}

      {/* Amount pill */}
      {post.amount && post.amount > 0 && !(isAnonymous && !isOwnPost) && !hasGoalProgress && (
        <View style={styles.amountPill}>
          <Text style={styles.amountText}>
            ${post.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.amountCurrency}>{post.currency}</Text>
        </View>
      )}

      {/* Image (non-video) */}
      {post.imageUrl && meta.mediaType !== "video" && (
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Community Tags */}
      {meta.communityTags && meta.communityTags.length > 0 && (
        <View style={styles.tagsRow}>
          {meta.communityTags.map((tag: { id: string; name: string; icon: string }) => (
            <View key={tag.id} style={styles.communityTag}>
              <Text style={styles.communityTagIcon}>{tag.icon}</Text>
              <Text style={styles.communityTagText}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Location */}
      {meta.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.locationText}>{meta.location}</Text>
        </View>
      )}

      {/* Hashtags */}
      {meta.hashtags && meta.hashtags.length > 0 && (
        <View style={styles.hashtagsRow}>
          {meta.hashtags.map((tag: string, idx: number) => (
            <Text key={idx} style={styles.hashtagText}>#{tag}</Text>
          ))}
        </View>
      )}

      {/* Support CTA */}
      {(hasGoalProgress || hasCircleProgress) && !isOwnPost && onSupport && (
        <TouchableOpacity
          style={styles.supportCTA}
          onPress={() => onSupport(post)}
          activeOpacity={0.7}
        >
          <View style={styles.supportIcon}>
            <Ionicons name="hand-left" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.supportText}>
            {hasGoalProgress ? "Support this Dream" : "Join this Circle"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accentTeal} />
        </TouchableOpacity>
      )}

      {/* Footer — engagement actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onLike(post.id)}>
          <Ionicons
            name={isLiked ? "wallet" : "wallet-outline"}
            size={20}
            color={isLiked ? colors.accentTeal : colors.textSecondary}
          />
          <Text style={[styles.actionText, isLiked && { color: colors.accentTeal }]}>
            {post.likesCount > 0 ? `${post.likesCount} saved` : "I Saved Too"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onComment(post.id)}>
          <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.actionText}>
            {post.commentsCount > 0 ? `${post.commentsCount}` : "Join"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onClonePlan?.(post)}>
          <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.actionText}>Clone Goal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { marginRight: spacing.md }]} onPress={() => onAccountability?.(post)}>
          <Ionicons name="arrow-redo" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {onSave && (
          <TouchableOpacity
            style={[styles.actionButton, { marginRight: 0, marginLeft: "auto" }]}
            onPress={() => onSave(post.id)}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={18}
              color={isSaved ? "#F59E0B" : colors.textSecondary}
            />
            {isSaved && (
              <Text style={[styles.actionText, { color: "#F59E0B" }]}>Saved</Text>
            )}
          </TouchableOpacity>
        )}

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
  // ============================================
  // VIDEO POST — TikTok-style
  // ============================================
  videoCard: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  videoHero: {
    position: "relative",
    width: "100%",
  },
  videoPlayer: {
    width: "100%",
    borderRadius: 0,
  },

  // Floating side buttons
  sideActions: {
    position: "absolute",
    right: 10,
    bottom: 80,
    alignItems: "center",
    gap: 14,
  },
  sideBtn: {
    alignItems: "center",
    gap: 2,
  },
  sideBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideBtnCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Bottom overlay
  videoOverlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 60,
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 50,
  },
  videoOverlayAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  videoOverlayAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  videoOverlayAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  videoOverlayAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  videoOverlayName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  videoOverlayTypeBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  videoOverlayCaption: {
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  videoOverlayLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 3,
  },
  videoOverlayLocText: {
    fontSize: 11,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  videoOverlayTags: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accentTeal,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Progress bar at bottom of video
  videoProgressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  videoProgressEmoji: {
    fontSize: 18,
  },
  videoProgressName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  videoProgressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  videoProgressFill: {
    height: 3,
    backgroundColor: colors.accentTeal,
    borderRadius: 2,
  },
  videoProgressPercent: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentTeal,
  },

  // ============================================
  // NON-VIDEO POST — Standard card
  // ============================================
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

  // Progress card
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
  spotsLeftText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold as any,
    color: "#F59E0B",
    marginTop: spacing.xs,
    textAlign: "right",
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
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.sm,
  },
  communityTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  communityTagIcon: {
    fontSize: 12,
  },
  communityTagText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold as any,
    color: colors.accentTeal,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.sm,
  },
  locationText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  hashtagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.sm,
  },
  hashtagText: {
    fontSize: typography.caption,
    color: colors.accentTeal,
    fontWeight: typography.semibold as any,
  },
  supportCTA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    borderRadius: radius.small,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  supportIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  supportText: {
    flex: 1,
    fontSize: typography.bodySmall,
    fontWeight: typography.bold as any,
    color: colors.accentTeal,
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
