import React, { useEffect, useState, useCallback } from "react";
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
  Image,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useFeed, FeedPost, FeedComment } from "../context/FeedContext";
import { useAuth } from "../context/AuthContext";
import FeedPostCard from "../components/FeedPostCard";
import FeedCommentItem from "../components/FeedCommentItem";
import VideoPlayer from "../components/VideoPlayer";
import { showToast } from "../components/Toast";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";

type PostDetailRouteParams = {
  PostDetail: { postId: string };
};

// Helper: format date for journey timeline
const formatJourneyDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return "Today \u00B7 " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Helper: format creation date
const formatCreatedDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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
  const [journeyPosts, setJourneyPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwnPost = post?.userId === user?.id;
  const meta = post?.metadata || {};
  const hasGoalProgress = meta.targetAmount && meta.currentBalance !== undefined;
  const hasCircleProgress = meta.circleName && meta.progress !== undefined;

  // Blueprint engagement handlers (wired to real navigation)
  const handleClonePlan = useCallback((p: FeedPost) => {
    const m = p.metadata || {};
    if (m.goalName || m.targetAmount) {
      navigation.navigate("CreateGoal", {
        clonedGoalName: m.goalName || "My Dream",
        clonedTargetAmount: m.targetAmount || undefined,
        clonedEmoji: m.goalEmoji || undefined,
      });
      showToast("Starting a similar goal!", "success");
    } else {
      navigation.navigate("CreateGoal", {});
      showToast("Create your own version!", "success");
    }
  }, [navigation]);

  const handleAccountability = useCallback(async (p: FeedPost) => {
    try {
      const m = p.metadata || {};
      const shareMessage = m.goalName
        ? `Check out this dream on TandaXn: "${m.goalName}" — ${p.content.slice(0, 100)}`
        : `Check out this dream on TandaXn: ${p.content.slice(0, 120)}`;

      if (Platform.OS === "web") {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareMessage);
          showToast("Link copied to clipboard!", "success");
        }
      } else {
        await Share.share({ message: shareMessage, title: "TandaXn Dream" });
      }
    } catch {
      // User cancelled share
    }
  }, []);

  const handleSupport = useCallback((p: FeedPost) => {
    const m = p.metadata || {};
    if (m.circleId || m.circleName) {
      navigation.navigate("JoinCircleConfirm", {
        circleId: m.circleId || p.relatedId,
      });
    } else if (m.goalName) {
      showToast("Support Dream coming soon!", "info");
    } else {
      showToast("Support coming soon!", "info");
    }
  }, [navigation]);

  useEffect(() => {
    loadPostAndComments();
  }, [postId]);

  // After post loads, fetch journey timeline for own goal posts
  useEffect(() => {
    if (post && isOwnPost && post.relatedId) {
      fetchJourneyPosts();
    }
  }, [post?.id, isOwnPost]);

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

  // Fetch all posts by this user related to the same goal/circle
  const fetchJourneyPosts = async () => {
    if (!post?.relatedId || !post?.userId) return;

    try {
      const { data } = await supabase
        .from("feed_posts")
        .select(`
          *,
          profiles!feed_posts_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq("user_id", post.userId)
        .eq("related_id", post.relatedId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const posts: FeedPost[] = data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          type: row.type,
          content: row.content,
          imageUrl: row.image_url || undefined,
          amount: row.amount || undefined,
          currency: row.currency,
          visibility: row.visibility,
          relatedId: row.related_id || undefined,
          relatedType: row.related_type || undefined,
          metadata: row.metadata || {},
          likesCount: row.likes_count,
          commentsCount: row.comments_count,
          isAuto: row.is_auto,
          createdAt: row.created_at,
          authorName: row.profiles?.full_name || "Anonymous",
          authorAvatar: row.profiles?.avatar_url || undefined,
        }));
        setJourneyPosts(posts);
      }
    } catch (err) {
      console.error("Error fetching journey posts:", err);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const newComment = await addComment(postId, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
      showToast(isOwnPost ? "Comment added!" : "Commitment posted!", "success");
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

  // =========================================
  // Loading & Error States
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

  // =========================================
  // OWN POST — Dream Journal Layout
  // =========================================
  if (isOwnPost) {
    const goalProgress = hasGoalProgress
      ? Math.round((meta.currentBalance / meta.targetAmount) * 100)
      : hasCircleProgress
        ? meta.progress
        : null;
    const isVideo = meta.mediaType === "video" && post.imageUrl;
    const timelineData = journeyPosts.length > 0 ? journeyPosts : [post];

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header — Dream Journal */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Dream Journal</Text>
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color={colors.errorText} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Goal/Circle Hero Card */}
            {(hasGoalProgress || hasCircleProgress) && (
              <View style={styles.goalHeroCard}>
                <View style={styles.goalHeroRow}>
                  <Text style={styles.goalHeroEmoji}>
                    {hasGoalProgress ? (meta.goalEmoji || "\u{1F3AF}") : (meta.circleEmoji || "\u{1F91D}")}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalHeroTitle}>
                      {hasGoalProgress ? meta.goalName : meta.circleName}
                    </Text>
                    {hasGoalProgress && (
                      <Text style={styles.goalHeroAmount}>
                        ${Number(meta.currentBalance || 0).toLocaleString()} of $
                        {Number(meta.targetAmount).toLocaleString()}
                      </Text>
                    )}
                    {hasCircleProgress && (
                      <Text style={styles.goalHeroAmount}>
                        {meta.currentMembers || "?"}/{meta.memberCount || "?"} members {"\u00B7"} $
                        {meta.contributionAmount || "??"}/{meta.frequency || "month"}
                      </Text>
                    )}
                  </View>
                  {goalProgress !== null && (
                    <View style={styles.goalHeroBadge}>
                      <Text style={styles.goalHeroBadgeText}>{goalProgress}%</Text>
                    </View>
                  )}
                </View>
                {/* Progress Bar */}
                {goalProgress !== null && (
                  <View style={styles.goalHeroBarBg}>
                    <View style={[styles.goalHeroBarFill, { width: `${Math.min(goalProgress, 100)}%` }]} />
                  </View>
                )}
                {/* Date Info */}
                <View style={styles.goalHeroDateRow}>
                  <View style={styles.goalHeroDateItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.goalHeroDateText}>
                      Created {formatCreatedDate(post.createdAt)}
                    </Text>
                  </View>
                  {meta.targetDate && (
                    <View style={styles.goalHeroDateItem}>
                      <Ionicons name="flag-outline" size={14} color={colors.accentTeal} />
                      <Text style={[styles.goalHeroDateText, { color: colors.accentTeal }]}>
                        Target: {formatCreatedDate(meta.targetDate)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Video Preview — if this post has video */}
            {isVideo && (
              <View style={styles.journeyVideoContainer}>
                <VideoPlayer
                  uri={post.imageUrl!}
                  style={styles.journeyVideo}
                  thumbnailMode
                  showControls={false}
                  disableTouch={false}
                  aspectRatio={16 / 9}
                />
              </View>
            )}

            {/* Post content (if no goal hero, show it standalone) */}
            {!hasGoalProgress && !hasCircleProgress && (
              <View style={styles.standalonePostCard}>
                <Text style={styles.standalonePostContent}>{post.content}</Text>
                {post.imageUrl && meta.mediaType !== "video" && (
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={styles.standalonePostImage}
                    resizeMode="cover"
                  />
                )}
                {meta.location && (
                  <View style={styles.standaloneLocationRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.standaloneLocationText}>{meta.location}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Journey Timeline */}
            <View style={styles.journeySection}>
              <View style={styles.journeySectionHeader}>
                <Ionicons name="time-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.journeySectionTitle}>
                  My Journey ({timelineData.length} update{timelineData.length !== 1 ? "s" : ""})
                </Text>
              </View>

              {timelineData.map((jp, index) => {
                const jpMeta = jp.metadata || {};
                const jpIsVideo = jpMeta.mediaType === "video" && jp.imageUrl;
                const jpHasImage = jp.imageUrl && jpMeta.mediaType !== "video";
                const isCurrentPost = jp.id === post.id;

                return (
                  <TouchableOpacity
                    key={jp.id}
                    style={[
                      styles.timelineEntry,
                      isCurrentPost && styles.timelineEntryCurrent,
                    ]}
                    onPress={() => {
                      if (!isCurrentPost) {
                        navigation.push("PostDetail", { postId: jp.id });
                      }
                    }}
                    activeOpacity={isCurrentPost ? 1 : 0.7}
                  >
                    {/* Timeline line + dot */}
                    <View style={styles.timelineLine}>
                      <View style={[
                        styles.timelineDot,
                        isCurrentPost && styles.timelineDotCurrent,
                      ]} />
                      {index < timelineData.length - 1 && (
                        <View style={styles.timelineConnector} />
                      )}
                    </View>

                    {/* Entry content */}
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineDateRow}>
                        <Text style={styles.timelineDate}>
                          {formatJourneyDate(jp.createdAt)}
                        </Text>
                        {jpIsVideo && (
                          <View style={styles.timelineMediaBadge}>
                            <Ionicons name="videocam" size={10} color="#FFFFFF" />
                          </View>
                        )}
                        {jpHasImage && (
                          <View style={[styles.timelineMediaBadge, { backgroundColor: "#8B5CF6" }]}>
                            <Ionicons name="image" size={10} color="#FFFFFF" />
                          </View>
                        )}
                        {isCurrentPost && (
                          <View style={styles.timelineCurrentBadge}>
                            <Text style={styles.timelineCurrentBadgeText}>Current</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.timelineText} numberOfLines={3}>
                        {jp.content}
                      </Text>
                      <View style={styles.timelineStatsRow}>
                        <View style={styles.timelineStat}>
                          <Ionicons name="wallet-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.timelineStatText}>{jp.likesCount} saves</Text>
                        </View>
                        <View style={styles.timelineStat}>
                          <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.timelineStatText}>{jp.commentsCount}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Own Post CTAs */}
            <View style={styles.ownCTAs}>
              <TouchableOpacity
                style={styles.ownPrimaryCTA}
                onPress={() => navigation.navigate("CreateDreamPost")}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.ownPrimaryCTAText}>Add New Update</Text>
              </TouchableOpacity>
              <View style={styles.ownSecondaryRow}>
                <TouchableOpacity
                  style={styles.ownSecondaryCTA}
                  onPress={() => handleAccountability(post)}
                >
                  <Ionicons name="share-outline" size={16} color={colors.accentTeal} />
                  <Text style={styles.ownSecondaryCTAText}>Share Goal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ownSecondaryCTA}
                  onPress={() => handleClonePlan(post)}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.accentTeal} />
                  <Text style={styles.ownSecondaryCTAText}>Clone for Friend</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsSectionTitle}>
                Comments & Support ({comments.length})
              </Text>
              {comments.length === 0 ? (
                <View style={styles.noComments}>
                  <Text style={styles.noCommentsText}>
                    No comments yet. Your supporters can cheer you on here!
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
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Comment Input */}
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
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

  // =========================================
  // OTHERS' POST — Dream Details Layout
  // =========================================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dream Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Post Card — with full social buttons for others' posts */}
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

          {/* Dream Details Card — Goal info (only for others' posts) */}
          {hasGoalProgress && (() => {
            const p = Math.round(((meta.currentBalance || 0) / meta.targetAmount) * 100);
            return (
              <View style={styles.dreamDetailCard}>
                <Text style={styles.dreamDetailSectionLabel}>Dream Details</Text>
                <View style={styles.dreamDetailRow}>
                  <Text style={styles.dreamDetailEmoji}>{meta.goalEmoji || "\u{1F3AF}"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dreamDetailTitle}>{meta.goalName}</Text>
                    <Text style={styles.dreamDetailAmount}>
                      ${Number(meta.currentBalance || 0).toLocaleString()} of $
                      {Number(meta.targetAmount).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.dreamDetailBadge}>
                    <Text style={styles.dreamDetailBadgeText}>{p}%</Text>
                  </View>
                </View>
                <View style={styles.dreamDetailBarBg}>
                  <View style={[styles.dreamDetailBarFill, { width: `${Math.min(p, 100)}%` }]} />
                </View>
                {/* Dreamer XnScore */}
                <View style={styles.dreamerInfoRow}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.accentTeal} />
                  <Text style={styles.dreamerInfoText}>
                    {post.authorName}{"\u2019"}s Dream
                  </Text>
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

          {/* Dream Details Card — Circle info (only for others' posts) */}
          {hasCircleProgress && !hasGoalProgress && (() => {
            const spotsLeft = (meta.memberCount || 0) - (meta.currentMembers || 0);
            return (
              <View style={styles.dreamDetailCard}>
                <Text style={styles.dreamDetailSectionLabel}>Circle Details</Text>
                <View style={styles.dreamDetailRow}>
                  <Text style={styles.dreamDetailEmoji}>{meta.circleEmoji || "\u{1F91D}"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dreamDetailTitle}>{meta.circleName}</Text>
                    <Text style={styles.dreamDetailAmount}>
                      {meta.currentMembers || "?"}/{meta.memberCount || "?"} members {"\u00B7"} $
                      {meta.contributionAmount || "??"}/{meta.frequency || "month"}
                    </Text>
                  </View>
                </View>
                <View style={styles.dreamDetailBarBg}>
                  <View style={[styles.dreamDetailBarFill, { width: `${Math.min(meta.progress || 0, 100)}%` }]} />
                </View>
                {spotsLeft > 0 && (
                  <Text style={styles.spotsLeftText}>
                    {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                  </Text>
                )}
                <View style={styles.dreamerInfoRow}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.accentTeal} />
                  <Text style={styles.dreamerInfoText}>
                    {post.authorName}{"\u2019"}s Circle
                  </Text>
                </View>
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

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>
              Comments ({comments.length})
            </Text>
            {comments.length === 0 ? (
              <View style={styles.noComments}>
                <Text style={styles.noCommentsText}>
                  No comments yet. Be the first to show support!
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
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Show your support..."
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

// ============================================
// Styles
// ============================================
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

  // ============================================
  // OWN POST — Goal Hero Card
  // ============================================
  goalHeroCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1.5,
    borderColor: colors.tealTintBg,
  },
  goalHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  goalHeroEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  goalHeroTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  goalHeroAmount: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  goalHeroBadge: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  goalHeroBadgeText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  goalHeroBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  goalHeroBarFill: {
    height: 8,
    backgroundColor: colors.accentTeal,
    borderRadius: 4,
  },
  goalHeroDateRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  goalHeroDateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  goalHeroDateText: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
  },

  // Video in journey view
  journeyVideoContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  journeyVideo: {
    width: "100%",
    borderRadius: radius.card,
  },

  // Standalone post (no goal)
  standalonePostCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  standalonePostContent: {
    fontSize: typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  standalonePostImage: {
    width: "100%",
    height: 200,
    borderRadius: radius.small,
    marginBottom: spacing.sm,
  },
  standaloneLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  standaloneLocationText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },

  // ============================================
  // Journey Timeline
  // ============================================
  journeySection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  journeySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.lg,
  },
  journeySectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  timelineEntry: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  timelineEntryCurrent: {
    // Subtle highlight for the current post
  },
  timelineLine: {
    width: 24,
    alignItems: "center",
    marginRight: spacing.md,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginTop: 4,
    zIndex: 1,
  },
  timelineDotCurrent: {
    backgroundColor: colors.accentTeal,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.tealTintBg,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.small,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.xs,
  },
  timelineDate: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  timelineMediaBadge: {
    backgroundColor: colors.accentTeal,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineCurrentBadge: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineCurrentBadgeText: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  timelineText: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  timelineStatsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  timelineStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  timelineStatText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },

  // ============================================
  // Own Post CTAs
  // ============================================
  ownCTAs: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  ownPrimaryCTA: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 14,
    gap: 8,
    marginBottom: spacing.sm,
  },
  ownPrimaryCTAText: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
  ownSecondaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  ownSecondaryCTA: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 12,
    gap: 6,
  },
  ownSecondaryCTAText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },

  // ============================================
  // OTHERS' POST — Dream Detail Card
  // ============================================
  dreamDetailCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.tealTintBg,
  },
  dreamDetailSectionLabel: {
    fontSize: typography.labelSmall,
    fontWeight: typography.bold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
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
  spotsLeftText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: "#F59E0B",
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  dreamerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.md,
  },
  dreamerInfoText: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
  },
  dreamDetailCTAs: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.xs,
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

  // ============================================
  // Comments Section (shared)
  // ============================================
  commentsSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  commentsSectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  noComments: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  noCommentsText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // ============================================
  // Comment Input (shared)
  // ============================================
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
