import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { FeedComment } from "../context/FeedContext";
import { colors, typography, spacing } from "../theme/tokens";

type FeedCommentItemProps = {
  comment: FeedComment;
  currentUserId?: string;
};

const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function FeedCommentItem({ comment, currentUserId }: FeedCommentItemProps) {
  const isOwnComment = comment.userId === currentUserId;

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        {comment.authorAvatar ? (
          <Image source={{ uri: comment.authorAvatar }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>
            {comment.authorName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.authorName}>
            {isOwnComment ? "You" : comment.authorName}
          </Text>
          <Text style={styles.time}>{formatRelativeTime(comment.createdAt)}</Text>
        </View>
        <Text style={styles.content}>{comment.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navyTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  body: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  authorName: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  time: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  content: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    lineHeight: 18,
  },
});
