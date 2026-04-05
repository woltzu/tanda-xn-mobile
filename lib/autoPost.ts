/**
 * Auto-Post Utility
 * Creates feed posts automatically when financial events occur.
 * Uses Supabase directly to avoid circular context dependencies.
 */

import { supabase } from "./supabase";

export type AutoPostType =
  | "goal_created"
  | "milestone"
  | "goal_reached"
  | "contribution"
  | "circle_joined"
  | "payout_received"
  | "xn_level_up";

// Auto-post message templates
const TEMPLATES: Record<AutoPostType, (meta: Record<string, any>) => string> = {
  goal_created: (meta) =>
    `Started saving for ${meta.goalName || "a new goal"}! Target: $${meta.targetAmount?.toLocaleString() || "???"}`,
  milestone: (meta) =>
    `${meta.percentage || 0}% of the way to ${meta.goalName || "my goal"}! Keep going!`,
  goal_reached: (meta) =>
    `Dream achieved! Reached $${meta.targetAmount?.toLocaleString() || "???"} for ${meta.goalName || "my goal"}!`,
  contribution: (meta) =>
    `Made a contribution to ${meta.circleName || "a savings circle"}`,
  circle_joined: (meta) =>
    `Joined ${meta.circleName || "a savings circle"}! Let's save together!`,
  payout_received: (meta) =>
    `Received a circle payout from ${meta.circleName || "a savings circle"}`,
  xn_level_up: (meta) =>
    `Leveled up to ${meta.levelName || "a new level"}! XnScore: ${meta.score || "??"}`,
};

/**
 * Create an auto-post in the feed.
 * Fire-and-forget: errors are logged but don't interrupt the caller.
 */
export async function createAutoPost(
  userId: string,
  type: AutoPostType,
  relatedId: string,
  relatedType: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const template = TEMPLATES[type];
    const content = template ? template(metadata) : `New activity: ${type}`;

    const { error } = await supabase.from("feed_posts").insert({
      user_id: userId,
      type,
      content,
      amount: metadata.amount || null,
      visibility: "public",
      related_id: relatedId,
      related_type: relatedType,
      is_auto: true,
      metadata,
    });

    if (error) {
      console.error("[AutoPost] Error creating auto post:", error.message);
    }
  } catch (err) {
    console.error("[AutoPost] Unexpected error:", err);
  }
}
