import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useFeed, FeedPost, FeedComment } from "../context/FeedContext";
import { useAuth } from "../context/AuthContext";
import FeedPostCard from "../components/FeedPostCard";
import FeedCommentItem from "../components/FeedCommentItem";
import { showToast } from "../components/Toast";
import { colors, radius, typography, spacing } from "../theme/tokens";

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

type PostDetailRouteParams = {
  PostDetail: { postId: string };
};

export default function PostDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<PostDetailRouteParams, "PostDetail">>();
  const { postId } = route.params;
  const { user } = useAuth();
  const {
    getPostById,
    getComments,
    toggleLike,
    toggleSave,
    addComment,
    deletePost,
    likedPostIds,
    savedPostIds,
  } = useFeed();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPostAndComments();
  }, [postId]);

  const loadPostAndComments = async () => {
    setIsLoading(true);
    const [fetchedPost, fetchedComments] = await Promise.all([
      getPostById(postId),
      getComments(postId),
    ]);
    setPost(fetchedPost);
    setComments(fetchedComments);
    setIsLoading(false);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const newComment = await addComment(postId, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
      showToast("Commitment posted!", "success");
      // Reload post to get updated comment count
      const updatedPost = await getPostById(postId);
      if (updatedPost) setPost(updatedPost);
    } catch (err) {
      showToast("Failed to add comment", "error");
      Alert.alert("Error", "Failed to add comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!post || post.userId !== user?.id) return;

    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(postId);
            showToast("Post deleted", "info");
            navigation.goBack();
          } catch (err) {
            showToast("Failed to delete post", "error");
            Alert.alert("Error", "Failed to delete post.");
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dream Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dream Details</Text>
          {post.userId === user?.id ? (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color={colors.errorText} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {/* Post + Comments */}
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FeedPostCard
            post={post}
            isLiked={likedPostIds.has(post.id)}
            isSaved={savedPostIds.has(post.id)}
            onLike={async (id) => {
              await toggleLike(id);
              const updated = await getPostById(id);
              if (updated) setPost(updated);
            }}
            onComment={() => {}}
            onPress={() => {}}
            onAuthorPress={(userId) =>
              navigation.navigate("UserDreamProfile", { userId })
            }
            onSupport={handleSupport}
            onClonePlan={handleClonePlan}
            onAccountability={handleAccountability}
            onSave={toggleSave}
            currentUserId={user?.id}
          />

          {/* Dream Details Card — Goal info */}
          {post.metadata?.goalName && post.metadata?.targetAmount && (() => {
            const meta = post.metadata;
            const p = Math.round(((meta.currentBalance || 0) / meta.targetAmount) * 100);
            return (
              <View style={styles.dreamDetailCard}>
                <View style={styles.dreamDetailRow}>
                  <Text style={styles.dreamDetailEmoji}>{meta.goalEmoji || "\u{1F3AF}"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dreamDetailTitle}>{meta.goalName}</Text>
                    <Text style={styles.dreamDetailAmount}>
                      ${Number(meta.currentBalance || 0).toLocaleString()} of ${Number(meta.targetAmount).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.dreamDetailBadge}>
                    <Text style={styles.dreamDetailBadgeText}>{p}%</Text>
                  </View>
                </View>
                <View style={styles.dreamDetailBarBg}>
                  <View style={[styles.dreamDetailBarFill, { width: `${Math.min(p, 100)}%` }]} />
                </View>
                {/* CTA Buttons */}
                <View style={styles.dreamDetailCTAs}>
                  <TouchableOpacity style={styles.dreamDetailPrimaryCTA} onPress={() => handleSupport(post)}>
                    <Ionicons name="hand-left" size={16} color="#FFFFFF" />
                    <Text style={styles.dreamDetailPrimaryCTAText}>Support Dream</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dreamDetailSecondaryCTA} onPress={() => handleClonePlan(post)}>
                    <Ionicons name="copy-outline" size={16} color={colors.accentTeal} />
                    <Text style={styles.dreamDetailSecondaryCTAText}>Start Similar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {/* Dream Details Card — Circle info */}
          {post.metadata?.circleName && !post.metadata?.goalName && (() => {
            const meta = post.metadata;
            const spotsLeft = (meta.memberCount || 0) - (meta.currentMembers || 0);
            return (
              <View style={styles.dreamDetailCard}>
                <View style={styles.dreamDetailRow}>
                  <Text style={styles.dreamDetailEmoji}>{meta.circleEmoji || "\u{1F91D}"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dreamDetailTitle}>{meta.circleName}</Text>
                    <Text style={styles.dreamDetailAmount}>
                      {meta.currentMembers || "?"}/{meta.memberCount || "?"} members {"\u00B7"} ${meta.contributionAmount || "??"}/{meta.frequency || "month"}
                    </Text>
                  </View>
                </View>
                <View style={styles.dreamDetailBarBg}>
                  <View style={[styles.dreamDetailBarFill, { width: `${Math.min(meta.progress || 0, 100)}%` }]} />
                </View>
                {spotsLeft > 0 && (
                  <Text style={styles.dreamDetailSpotsLeft}>
                    {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                  </Text>
                )}
                {/* CTA Buttons */}
                <View style={styles.dreamDetailCTAs}>
                  <TouchableOpacity style={styles.dreamDetailPrimaryCTA} onPress={() => handleSupport(post)}>
                    <Ionicons name="people" size={16} color="#FFFFFF" />
                    <Text style={styles.dreamDetailPrimaryCTAText}>Join Circle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dreamDetailSecondaryCTA} onPress={() => handleClonePlan(post)}>
                    <Ionicons name="copy-outline" size={16} color={colors.accentTeal} />
                    <Text style={styles.dreamDetailSecondaryCTAText}>Start Similar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {/* Challenge Commitments Section */}
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>
              Challenge Commitments ({comments.length})
            </Text>
          </View>

          {comments.length === 0 ? (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsText}>
                No commitments yet. Be the first to join the challenge!
              </Text>
            </View>
          ) : (
            comments.map((comment) => (
              <FeedCommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
              />
            ))
          )}

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Make your commitment..."
            placeholderTextColor={colors.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={300}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!commentText.trim() || isSubmitting) && styles.sendButtonDisabled,
            ]}
            onPress={handleAddComment}
            disabled={!commentText.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  commentsHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  commentsTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  noComments: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  noCommentsText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  // Dream Detail Card
  dreamDetailCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.tealTintBg,
  },
  dreamDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dreamDetailEmoji: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  dreamDetailTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  dreamDetailAmount: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dreamDetailBadge: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  dreamDetailBadgeText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  dreamDetailBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  dreamDetailBarFill: {
    height: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 3,
  },
  dreamDetailSpotsLeft: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: "#F59E0B",
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  dreamDetailCTAs: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.sm,
  },
  dreamDetailPrimaryCTA: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 12,
    gap: 6,
  },
  dreamDetailPrimaryCTAText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
  dreamDetailSecondaryCTA: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 12,
    gap: 4,
  },
  dreamDetailSecondaryCTAText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },

  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentInput: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
