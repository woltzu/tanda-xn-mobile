import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";

// ============================================
// Types
// ============================================

export type FeedPostType =
  | "dream"
  | "milestone"
  | "contribution"
  | "goal_created"
  | "goal_reached"
  | "circle_joined"
  | "payout_received"
  | "xn_level_up";

export type FeedVisibility = "public" | "community" | "anonymous";

export type FeedPost = {
  id: string;
  userId: string;
  type: FeedPostType;
  content: string;
  imageUrl?: string;
  amount?: number;
  currency: string;
  visibility: FeedVisibility;
  relatedId?: string;
  relatedType?: string;
  metadata: Record<string, any>;
  likesCount: number;
  commentsCount: number;
  isAuto: boolean;
  createdAt: string;
  // Joined profile data
  authorName: string;
  authorAvatar?: string;
  authorXnScore?: number;
};

export type FeedComment = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  // Joined profile data
  authorName: string;
  authorAvatar?: string;
};

// Database row types (snake_case)
type FeedPostRow = {
  id: string;
  user_id: string;
  type: string;
  content: string;
  image_url: string | null;
  amount: number | null;
  currency: string;
  visibility: string;
  related_id: string | null;
  related_type: string | null;
  metadata: Record<string, any>;
  likes_count: number;
  comments_count: number;
  is_auto: boolean;
  created_at: string;
  // Joined from profiles
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    xn_score: number | null;
  };
};

type FeedCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

// ============================================
// Helpers
// ============================================

const rowToPost = (row: FeedPostRow): FeedPost => ({
  id: row.id,
  userId: row.user_id,
  type: row.type as FeedPostType,
  content: row.content,
  imageUrl: row.image_url || undefined,
  amount: row.amount || undefined,
  currency: row.currency,
  visibility: row.visibility as FeedVisibility,
  relatedId: row.related_id || undefined,
  relatedType: row.related_type || undefined,
  metadata: row.metadata || {},
  likesCount: row.likes_count,
  commentsCount: row.comments_count,
  isAuto: row.is_auto,
  createdAt: row.created_at,
  authorName: row.profiles?.full_name || "Anonymous",
  authorAvatar: row.profiles?.avatar_url || undefined,
  authorXnScore: row.profiles?.xn_score ?? undefined,
});

const rowToComment = (row: FeedCommentRow): FeedComment => ({
  id: row.id,
  postId: row.post_id,
  userId: row.user_id,
  content: row.content,
  createdAt: row.created_at,
  authorName: row.profiles?.full_name || "Anonymous",
  authorAvatar: row.profiles?.avatar_url || undefined,
});

// Auto-post message templates
const AUTO_POST_TEMPLATES: Record<string, (meta: Record<string, any>) => string> = {
  goal_created: (meta) =>
    `Started saving for ${meta.goalName || "a new goal"}! Target: $${meta.targetAmount || "???"}`,
  milestone: (meta) =>
    `${meta.percentage || 0}% of the way to ${meta.goalName || "my goal"}! Keep going!`,
  goal_reached: (meta) =>
    `Dream achieved! Reached $${meta.targetAmount || "???"} for ${meta.goalName || "my goal"}!`,
  contribution: (meta) =>
    `Made a contribution to ${meta.circleName || "a savings circle"}`,
  circle_joined: (meta) =>
    `Joined ${meta.circleName || "a savings circle"}! Let's save together!`,
  payout_received: (meta) =>
    `Received a circle payout from ${meta.circleName || "a savings circle"}`,
  xn_level_up: (meta) =>
    `Leveled up to ${meta.levelName || "a new level"}! XnScore: ${meta.score || "??"}`,
};

const PAGE_SIZE = 20;

// ============================================
// Context
// ============================================

type FeedContextType = {
  posts: FeedPost[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;
  fetchFeed: () => Promise<void>;
  fetchMorePosts: () => Promise<void>;
  createDreamPost: (
    content: string,
    imageUrl?: string,
    amount?: number,
    visibility?: FeedVisibility,
    metadata?: Record<string, any>,
    relatedId?: string,
    relatedType?: string
  ) => Promise<FeedPost>;
  createAutoPost: (
    type: FeedPostType,
    relatedId: string,
    relatedType: string,
    metadata: Record<string, any>,
    visibility?: FeedVisibility
  ) => Promise<FeedPost | null>;
  toggleLike: (postId: string) => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<FeedComment>;
  getComments: (postId: string) => Promise<FeedComment[]>;
  deletePost: (postId: string) => Promise<void>;
  refreshFeed: () => Promise<void>;
  getPostById: (postId: string) => Promise<FeedPost | null>;
  getUserPosts: (userId: string) => Promise<FeedPost[]>;
};

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export const useFeed = () => {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error("useFeed must be used within FeedProvider");
  }
  return context;
};

// ============================================
// Provider
// ============================================

export const FeedProvider = ({ children }: { children: ReactNode }) => {
  const { user, session } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const profileEnsured = useRef(false);
  const lastCreatedAt = useRef<string | null>(null);

  // Ensure the current auth user has a matching profiles row.
  // Calls the DB function first; if it doesn't exist yet, falls back to direct upsert.
  const ensureProfile = async () => {
    if (!user?.id || profileEnsured.current) return;

    try {
      // Try RPC first (created by migration 028)
      const { error: rpcError } = await supabase.rpc("ensure_user_profile");

      if (rpcError) {
        // Fallback: direct upsert (requires INSERT policy on profiles)
        console.warn("ensure_user_profile RPC failed, trying direct upsert:", rpcError.message);
        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email,
              full_name: user.name,
            },
            { onConflict: "id" }
          );

        if (upsertError) {
          console.error("Profile upsert failed:", upsertError.message);
          // Don't throw — the profile may already exist from the trigger
        }
      }

      profileEnsured.current = true;
    } catch (err) {
      console.error("ensureProfile error:", err);
    }
  };

  // Fetch feed posts with pagination
  const fetchFeed = useCallback(async () => {
    if (!session) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("feed_posts")
        .select(`
          *,
          profiles!feed_posts_user_id_fkey (
            full_name,
            avatar_url,
            xn_score
          )
        `)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (fetchError) {
        console.error("Error fetching feed:", fetchError);
        setError(fetchError.message);
        return;
      }

      const feedPosts = (data || []).map((row: any) => rowToPost(row));
      setPosts(feedPosts);
      setHasMore(feedPosts.length === PAGE_SIZE);

      if (feedPosts.length > 0) {
        lastCreatedAt.current = feedPosts[feedPosts.length - 1].createdAt;
      }

      // Fetch user's likes and saved posts
      if (user?.id) {
        const [likesRes, savedRes] = await Promise.all([
          supabase.from("feed_likes").select("post_id").eq("user_id", user.id),
          supabase.from("feed_saved_posts").select("post_id").eq("user_id", user.id),
        ]);

        if (likesRes.data) {
          setLikedPostIds(new Set(likesRes.data.map((l: any) => l.post_id)));
        }
        if (savedRes.data) {
          setSavedPostIds(new Set(savedRes.data.map((s: any) => s.post_id)));
        }
      }
    } catch (err) {
      console.error("Error in fetchFeed:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch feed");
    } finally {
      setIsLoading(false);
    }
  }, [session, user?.id]);

  // Fetch more posts (infinite scroll)
  const fetchMorePosts = useCallback(async () => {
    if (!session || !hasMore || isLoadingMore || !lastCreatedAt.current) return;

    try {
      setIsLoadingMore(true);

      const { data, error: fetchError } = await supabase
        .from("feed_posts")
        .select(`
          *,
          profiles!feed_posts_user_id_fkey (
            full_name,
            avatar_url,
            xn_score
          )
        `)
        .lt("created_at", lastCreatedAt.current)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (fetchError) {
        console.error("Error fetching more posts:", fetchError);
        return;
      }

      const morePosts = (data || []).map((row: any) => rowToPost(row));
      setPosts((prev) => [...prev, ...morePosts]);
      setHasMore(morePosts.length === PAGE_SIZE);

      if (morePosts.length > 0) {
        lastCreatedAt.current = morePosts[morePosts.length - 1].createdAt;
      }
    } catch (err) {
      console.error("Error in fetchMorePosts:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [session, hasMore, isLoadingMore]);

  // Setup real-time subscription
  useEffect(() => {
    if (!session) return;

    // Initial fetch
    fetchFeed();

    // Subscribe to real-time changes on feed_posts
    const channel: RealtimeChannel = supabase
      .channel("feed-posts-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feed_posts",
        },
        async (payload) => {
          // Fetch the full post with profile data
          const { data } = await supabase
            .from("feed_posts")
            .select(`
              *,
              profiles!feed_posts_user_id_fkey (
                full_name,
                avatar_url
              )
            `)
            .eq("id", (payload.new as any).id)
            .single();

          if (data) {
            const newPost = rowToPost(data as any);
            setPosts((prev) => [newPost, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "feed_posts",
        },
        async (payload) => {
          const { data } = await supabase
            .from("feed_posts")
            .select(`
              *,
              profiles!feed_posts_user_id_fkey (
                full_name,
                avatar_url
              )
            `)
            .eq("id", (payload.new as any).id)
            .single();

          if (data) {
            const updatedPost = rowToPost(data as any);
            setPosts((prev) =>
              prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "feed_posts",
        },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setPosts((prev) => prev.filter((p) => p.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchFeed]);

  // Create a user-authored dream post
  const createDreamPost = async (
    content: string,
    imageUrl?: string,
    amount?: number,
    visibility: FeedVisibility = "public",
    metadata: Record<string, any> = {},
    relatedId?: string,
    relatedType?: string
  ): Promise<FeedPost> => {
    if (!user?.id) throw new Error("Must be logged in to create a post");

    // Ensure the user has a profile row (fixes FK constraint error)
    await ensureProfile();

    const { data, error: insertError } = await supabase
      .from("feed_posts")
      .insert({
        user_id: user.id,
        type: "dream",
        content,
        image_url: imageUrl || null,
        amount: amount || null,
        visibility,
        is_auto: false,
        metadata,
        related_id: relatedId || null,
        related_type: relatedType || null,
      })
      .select(`
        *,
        profiles!feed_posts_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .single();

    if (insertError) {
      console.error("Error creating dream post:", insertError);
      throw new Error(insertError.message);
    }

    return rowToPost(data as any);
  };

  // Create an auto-generated post from app events
  const createAutoPost = async (
    type: FeedPostType,
    relatedId: string,
    relatedType: string,
    metadata: Record<string, any>,
    visibility: FeedVisibility = "public"
  ): Promise<FeedPost | null> => {
    if (!user?.id) return null;

    try {
      // Ensure the user has a profile row
      await ensureProfile();

      // Generate auto content from template
      const template = AUTO_POST_TEMPLATES[type];
      const content = template ? template(metadata) : `New activity: ${type}`;

      const { data, error: insertError } = await supabase
        .from("feed_posts")
        .insert({
          user_id: user.id,
          type,
          content,
          amount: metadata.amount || null,
          visibility,
          related_id: relatedId,
          related_type: relatedType,
          is_auto: true,
          metadata,
        })
        .select(`
          *,
          profiles!feed_posts_user_id_fkey (
            full_name,
            avatar_url,
            xn_score
          )
        `)
        .single();

      if (insertError) {
        console.error("Error creating auto post:", insertError);
        return null;
      }

      return rowToPost(data as any);
    } catch (err) {
      console.error("Error in createAutoPost:", err);
      return null;
    }
  };

  // Toggle like on a post
  const toggleLike = async (postId: string) => {
    if (!user?.id) return;

    const isLiked = likedPostIds.has(postId);

    // Optimistic update
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (isLiked) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    // Optimistic count update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likesCount: isLiked ? Math.max(p.likesCount - 1, 0) : p.likesCount + 1 }
          : p
      )
    );

    try {
      if (isLiked) {
        const { error } = await supabase
          .from("feed_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_likes").insert({
          post_id: postId,
          user_id: user.id,
        });

        if (error) throw error;
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      // Revert optimistic update on error
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (isLiked) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likesCount: isLiked ? p.likesCount + 1 : Math.max(p.likesCount - 1, 0) }
            : p
        )
      );
    }
  };

  // Toggle save (bookmark) on a post
  const toggleSave = async (postId: string) => {
    if (!user?.id) return;

    const isSaved = savedPostIds.has(postId);

    // Optimistic update
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      if (isSaved) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    try {
      if (isSaved) {
        const { error } = await supabase
          .from("feed_saved_posts")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_saved_posts").insert({
          post_id: postId,
          user_id: user.id,
        });

        if (error) throw error;
      }
    } catch (err) {
      console.error("Error toggling save:", err);
      // Revert optimistic update on error
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (isSaved) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
    }
  };

  // Add a comment to a post
  const addComment = async (postId: string, content: string): Promise<FeedComment> => {
    if (!user?.id) throw new Error("Must be logged in to comment");

    const { data, error: insertError } = await supabase
      .from("feed_comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        content,
      })
      .select(`
        *,
        profiles!feed_comments_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .single();

    if (insertError) {
      console.error("Error adding comment:", insertError);
      throw new Error(insertError.message);
    }

    // Update comment count optimistically
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      )
    );

    return rowToComment(data as any);
  };

  // Get comments for a post
  const getComments = async (postId: string): Promise<FeedComment[]> => {
    const { data, error: fetchError } = await supabase
      .from("feed_comments")
      .select(`
        *,
        profiles!feed_comments_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching comments:", fetchError);
      return [];
    }

    return (data || []).map((row: any) => rowToComment(row));
  };

  // Delete a post (own posts only)
  const deletePost = async (postId: string) => {
    if (!user?.id) return;

    const { error: deleteError } = await supabase
      .from("feed_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting post:", deleteError);
      throw new Error(deleteError.message);
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  // Refresh feed
  const refreshFeed = async () => {
    lastCreatedAt.current = null;
    setHasMore(true);
    await fetchFeed();
  };

  // Get a single post by ID
  const getPostById = async (postId: string): Promise<FeedPost | null> => {
    const { data, error: fetchError } = await supabase
      .from("feed_posts")
      .select(`
        *,
        profiles!feed_posts_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq("id", postId)
      .single();

    if (fetchError) {
      console.error("Error fetching post:", fetchError);
      return null;
    }

    return rowToPost(data as any);
  };

  // Get posts by a specific user
  const getUserPosts = async (userId: string): Promise<FeedPost[]> => {
    const { data, error: fetchError } = await supabase
      .from("feed_posts")
      .select(`
        *,
        profiles!feed_posts_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching user posts:", fetchError);
      return [];
    }

    return (data || []).map((row: any) => rowToPost(row));
  };

  return (
    <FeedContext.Provider
      value={{
        posts,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        likedPostIds,
        savedPostIds,
        fetchFeed,
        fetchMorePosts,
        createDreamPost,
        createAutoPost,
        toggleLike,
        toggleSave,
        addComment,
        getComments,
        deletePost,
        refreshFeed,
        getPostById,
        getUserPosts,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
};
