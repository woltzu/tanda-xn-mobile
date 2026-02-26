import { useMemo } from "react";
import { FeedPost } from "../context/FeedContext";

export type FeedFilter = "for_you" | "following" | "trending";

/**
 * Calculate a trending score for a post.
 * Uses engagement (likes + comments) weighted by recency.
 * Similar to Hacker News: score / (age + 2)^gravity
 * Recent popular posts rank higher than old viral ones.
 */
function calculateTrendingScore(post: FeedPost): number {
  const engagement = post.likesCount + post.commentsCount;
  const ageInHours =
    (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const gravity = 1.5;
  return engagement / Math.pow(ageInHours + 2, gravity);
}

/**
 * Hook that filters/sorts feed posts based on the active filter tab.
 *
 * - for_you: All posts, newest first (default behavior from DB)
 * - following: Only posts from users in your circle network
 * - trending: Sorted by engagement score with recency weighting
 */
export function useFilteredFeed(
  posts: FeedPost[],
  activeFilter: FeedFilter,
  networkUserIds: Set<string>
): FeedPost[] {
  return useMemo(() => {
    switch (activeFilter) {
      case "for_you":
        return posts;

      case "following":
        if (networkUserIds.size === 0) return [];
        return posts.filter((post) => networkUserIds.has(post.userId));

      case "trending":
        return [...posts]
          .filter((post) => post.likesCount + post.commentsCount > 0)
          .sort(
            (a, b) => calculateTrendingScore(b) - calculateTrendingScore(a)
          );

      default:
        return posts;
    }
  }, [posts, activeFilter, networkUserIds]);
}
