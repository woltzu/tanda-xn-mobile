// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: remind-dream-support
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 10:00 UTC.
// Purpose:  Identify users who engaged with a dream post (liked or
//           commented) in the last 7 days but haven't backed it via
//           dream_supports yet. Drop one "you cared about X — support
//           it?" notification per (engager, post).
//
// Joins:
//   feed_likes / feed_comments  (engagement, last 7 days)
//   LEFT JOIN dream_supports    (skip if already supported)
//   skip self-engagement (engager = post author)
//   skip dream posts the engager owns
//
// Idempotency:
//   notifications.data.post_id contains-lookup over the last 14 days.
//   Re-running the cron the same day on the same engagement is a no-op.
//
// Deployment:
//   supabase functions deploy remind-dream-support --no-verify-jwt
//   Schedule via Supabase Scheduler or pg_cron.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENGAGEMENT_WINDOW_DAYS = 7;
const DUPE_WINDOW_DAYS = 14;
const PER_RUN_LIMIT = 5000;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const started = new Date().toISOString();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const sinceEng = new Date(
      Date.now() - ENGAGEMENT_WINDOW_DAYS * 86400 * 1000,
    ).toISOString();
    const sinceDupe = new Date(
      Date.now() - DUPE_WINDOW_DAYS * 86400 * 1000,
    ).toISOString();

    // Pull recent likes + comments. Two queries because we don't have a
    // unified feed_engagements view.
    const [{ data: likes, error: lErr }, { data: comments, error: cErr }] =
      await Promise.all([
        supabase
          .from("feed_likes")
          .select("user_id, post_id")
          .gte("created_at", sinceEng)
          .limit(PER_RUN_LIMIT),
        supabase
          .from("feed_comments")
          .select("user_id, post_id")
          .gte("created_at", sinceEng)
          .limit(PER_RUN_LIMIT),
      ]);
    if (lErr) throw lErr;
    if (cErr) throw cErr;

    // Dedup to one row per (user, post). The map key is "uid::pid" so
    // we get a single notification regardless of like + comment overlap.
    const pairs = new Map<string, { user_id: string; post_id: string }>();
    for (const row of [...(likes ?? []), ...(comments ?? [])]) {
      const k = `${row.user_id}::${row.post_id}`;
      if (!pairs.has(k)) pairs.set(k, row);
    }
    if (pairs.size === 0) return ok(started, { notifications: 0 });

    const postIds = [...new Set([...pairs.values()].map((p) => p.post_id))];

    // Authors + titles for the notification body, and to skip
    // self-engagement.
    const { data: posts, error: pErr } = await supabase
      .from("feed_posts")
      .select("id, user_id, content, type")
      .in("id", postIds);
    if (pErr) throw pErr;
    const postIndex = new Map(
      (posts ?? []).map((p: { id: string; user_id: string; content: string; type: string }) => [p.id, p]),
    );

    // Existing dream_supports rows — used to skip already-supported pairs.
    const { data: supports, error: sErr } = await supabase
      .from("dream_supports")
      .select("user_id, post_id")
      .in("post_id", postIds);
    if (sErr) throw sErr;
    const supported = new Set(
      (supports ?? []).map(
        (s: { user_id: string; post_id: string }) => `${s.user_id}::${s.post_id}`,
      ),
    );

    let notifications = 0;
    for (const [key, pair] of pairs) {
      if (supported.has(key)) continue;
      const post = postIndex.get(pair.post_id);
      if (!post) continue;
      if (post.user_id === pair.user_id) continue;
      // Only nudge for dream posts — not milestone celebrations etc.
      if (post.type !== "dream") continue;

      // Per-pair dupe check over the 14-day window.
      const { count: prior } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", pair.user_id)
        .eq("type", "dream_support_reminder")
        .gte("created_at", sinceDupe)
        .contains("data", { post_id: pair.post_id });
      if ((prior ?? 0) > 0) continue;

      // Trim the dream title from the first 60 chars of content so the
      // notification body reads naturally.
      const snippet =
        (post.content ?? "").trim().slice(0, 60) +
        (post.content && post.content.length > 60 ? "…" : "");

      const { error: nErr } = await supabase.from("notifications").insert({
        user_id: pair.user_id,
        type: "dream_support_reminder",
        title: "Back a dream you've been following",
        body: `You cared about "${snippet}" — want to chip in and help it happen?`,
        data: {
          post_id: pair.post_id,
          author_user_id: post.user_id,
        },
        read: false,
      });
      if (!nErr) notifications++;
    }

    return ok(started, {
      engaged_pairs: pairs.size,
      already_supported: supported.size,
      notifications,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[remind-dream-support] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(started: string, extras: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      ok: true,
      started,
      finished: new Date().toISOString(),
      ...extras,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
