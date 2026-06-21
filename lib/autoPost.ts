/**
 * Auto-Post Utility
 * Creates feed posts automatically when financial events occur.
 * Uses Supabase directly to avoid circular context dependencies.
 *
 * Post to Community Bucket C (2026-06-20): on a `goal_reached` or
 * `xn_level_up` event, the function inserts the canonical typed row AND
 * mirrors a `type='community'` row so the new Community section on the
 * Community tab feels inhabited day-one. Both rows carry `is_auto=true`,
 * which the community lifecycle triggers (migration 221) use to skip
 * "you posted" notifications and AI-decision recording — the user
 * didn't author them.
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

// Post to Community Bucket C — types that ALSO get mirrored into the
// community feed as a `type='community'` row so the Community section
// on the Community tab shows celebratory milestones from the get-go.
// Keep the set small: only events that read as "share-worthy news"
// to fellow community members, not internal bookkeeping. Bucket C
// intentionally limits this to goal_reached + xn_level_up; we can
// add payout_received / circle_joined later if engagement data warrants.
const COMMUNITY_MIRROR_TYPES = new Set<AutoPostType>([
  "goal_reached",
  "xn_level_up",
]);

/**
 * Create an auto-post in the feed.
 * Fire-and-forget: errors are logged but don't interrupt the caller.
 *
 * Bucket C: when the event type is in COMMUNITY_MIRROR_TYPES, we ALSO
 * insert a parallel `type='community'` row so the community feed
 * surfaces the same celebratory content. Both inserts run in parallel;
 * if either fails the other still lands.
 */
export async function createAutoPost(
  userId: string,
  type: AutoPostType,
  relatedId: string,
  relatedType: string,
  metadata: Record<string, any>
): Promise<void> {
  const template = TEMPLATES[type];
  const content = template ? template(metadata) : `New activity: ${type}`;
  const basePayload = {
    user_id: userId,
    content,
    amount: metadata.amount || null,
    visibility: "public",
    related_id: relatedId,
    related_type: relatedType,
    is_auto: true,
    metadata,
  };

  const inserts: Promise<unknown>[] = [
    supabase.from("feed_posts").insert({ ...basePayload, type }),
  ];
  if (COMMUNITY_MIRROR_TYPES.has(type)) {
    // Mirror entry: same content + metadata, distinct row keyed by
    // type='community'. The community lifecycle triggers (migration 221)
    // skip both notification + ai_decision recording on is_auto=true,
    // so this mirror does NOT spam the user with a "you posted" alert.
    inserts.push(
      supabase
        .from("feed_posts")
        .insert({ ...basePayload, type: "community" }),
    );
  }

  try {
    const results = await Promise.all(inserts);
    results.forEach((r, idx) => {
      const err = (r as { error?: { message?: string } | null })?.error;
      if (err) {
        console.error(
          `[AutoPost] Error creating ${idx === 0 ? "typed" : "community mirror"} post:`,
          err.message,
        );
      }
    });
  } catch (err) {
    console.error("[AutoPost] Unexpected error:", err);
  }
}
