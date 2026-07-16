// ═══════════════════════════════════════════════════════════════════════════
// useCommunityHub — Phase 7 CommunityHubScreen data source
// ═══════════════════════════════════════════════════════════════════════════
//
// Single-hook fetch of everything CommunityHubScreen needs to render
// authoritative values instead of the mock/derived numbers on the
// existing Community context object.
//
// Fired queries (Promise.all, one round-trip per source):
//   1. Community details (name, description, type, country, city, icon,
//      member_count / created_at) — communities table.
//   2. Members count — exact count on community_memberships WHERE
//      community_id = $1 AND status = 'active'. Uses head: true so
//      Supabase returns just the count without ferrying rows over the
//      wire.
//   3. Circles list — SELECT * FROM circles WHERE community_id = $1
//      ORDER BY created_at DESC. All statuses (unlike CommunityContext's
//      getCommunityCircles which drops completed), so the hub shows the
//      full history for counts + a visible list.
//   4. Total saved — SUM(user_savings_goals.current_balance_cents) for
//      every active member. Two-step: fetch member user_ids from
//      community_memberships, then SUM on savings goals with an .in()
//      filter. Two round-trips is acceptable at the current
//      community-size scale; if this ever becomes hot, promote to a
//      Postgres RPC.
//   5. Activity — union of four sources, filtered by community_id
//      where applicable, sorted client-side by timestamp desc, top 20:
//        * community_feed_items    (structured feed events)
//        * community_arrivals      (new-member cards)
//        * community_gatherings    (upcoming/past events)
//        * feed_posts              (user posts scoped to the community)
//      Emitted as a normalized ActivityItem shape so the screen can
//      render every kind through the same card.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type CommunityHub = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  country: string | null;
  city: string | null;
  icon: string | null;
  parent_community_id: string | null;
  created_at: string | null;
};

export type CommunityCircleRow = {
  id: string;
  name: string;
  amount: number | null;
  frequency: string | null;
  member_count: number | null;
  current_members: number | null;
  status: string | null;
  type: string | null;
  created_at: string | null;
};

export type ActivityItemKind =
  | "feed_item"
  | "arrival"
  | "gathering"
  | "post";

export type ActivityItem = {
  id: string;
  kind: ActivityItemKind;
  createdAt: string;
  title: string;
  subtitle?: string | null;
  iconName?: string | null;   // Ionicons name for the leading icon
  accentColor?: string | null;
  avatarUrl?: string | null;
  attributedName?: string | null;
  meta?: Record<string, unknown>;
};

export type CommunityHubData = {
  community: CommunityHub | null;
  membersCount: number;
  circles: CommunityCircleRow[];
  circlesCount: number;
  totalSavedCents: number;
  activity: ActivityItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ACTIVITY_LIMIT = 20;

export function useCommunityHub(communityId?: string): CommunityHubData {
  const [community, setCommunity] = useState<CommunityHub | null>(null);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [circles, setCircles] = useState<CommunityCircleRow[]>([]);
  const [circlesCount, setCirclesCount] = useState<number>(0);
  const [totalSavedCents, setTotalSavedCents] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!communityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Batch 1 — everything that doesn't depend on member IDs.
      const [
        communityRes,
        membersCountRes,
        circlesRes,
        feedItemsRes,
        arrivalsRes,
        gatheringsRes,
        postsRes,
        memberIdsRes,
      ] = await Promise.all([
        supabase
          .from("communities")
          .select(
            "id, name, description, type, country, city, icon, parent_community_id, created_at",
          )
          .eq("id", communityId)
          .maybeSingle(),
        supabase
          .from("community_memberships")
          .select("user_id", { count: "exact", head: true })
          .eq("community_id", communityId)
          .eq("status", "active"),
        supabase
          .from("circles")
          .select(
            "id, name, amount, frequency, member_count, current_members, status, type, created_at",
          )
          .eq("community_id", communityId)
          .order("created_at", { ascending: false }),
        supabase
          .from("community_feed_items")
          .select(
            "id, feed_type, title, body, icon_name, accent_color, attributed_name, created_at",
          )
          .eq("community_id", communityId)
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_LIMIT),
        supabase
          .from("community_arrivals")
          .select(
            "id, first_name, origin_city, origin_country, origin_country_flag, created_at",
          )
          .eq("community_id", communityId)
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_LIMIT),
        supabase
          .from("community_gatherings")
          .select("id, title, location_name, event_type, created_at")
          .eq("community_id", communityId)
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_LIMIT),
        supabase
          .from("feed_posts")
          .select(
            "id, content, media_url, created_at, user_id, profile:profiles!feed_posts_user_id_fkey(full_name, avatar_url)",
          )
          .eq("community_id", communityId)
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_LIMIT),
        // We fetch member IDs on the same pass so batch 2's total-saved
        // query has them without a second serial round-trip.
        supabase
          .from("community_memberships")
          .select("user_id")
          .eq("community_id", communityId)
          .eq("status", "active"),
      ]);

      if (communityRes.data) setCommunity(communityRes.data as CommunityHub);
      setMembersCount(membersCountRes.count ?? 0);
      setCircles((circlesRes.data as CommunityCircleRow[]) ?? []);
      setCirclesCount(circlesRes.data?.length ?? 0);

      // Batch 2 — total saved. If there are no active members, the sum
      // is definitionally 0 and we skip the query entirely.
      const memberIds = (memberIdsRes.data ?? []).map(
        (r: { user_id: string }) => r.user_id,
      );
      if (memberIds.length > 0) {
        const { data: goalsData } = await supabase
          .from("user_savings_goals")
          .select("current_balance_cents")
          .in("user_id", memberIds);
        const sum = (goalsData ?? []).reduce(
          (acc: number, r: { current_balance_cents: number | null }) =>
            acc + (Number(r.current_balance_cents) || 0),
          0,
        );
        setTotalSavedCents(sum);
      } else {
        setTotalSavedCents(0);
      }

      // Normalize four sources into one ordered activity feed.
      const items: ActivityItem[] = [];

      for (const fi of feedItemsRes.data ?? []) {
        const f = fi as {
          id: string;
          feed_type: string;
          title: string;
          body: string | null;
          icon_name: string | null;
          accent_color: string | null;
          attributed_name: string | null;
          created_at: string;
        };
        items.push({
          id: `feed_item:${f.id}`,
          kind: "feed_item",
          createdAt: f.created_at,
          title: f.title,
          subtitle: f.body,
          iconName: f.icon_name ?? "megaphone-outline",
          accentColor: f.accent_color ?? "#00C6AE",
          attributedName: f.attributed_name,
        });
      }

      for (const ar of arrivalsRes.data ?? []) {
        const a = ar as {
          id: string;
          first_name: string;
          origin_city: string | null;
          origin_country: string | null;
          origin_country_flag: string | null;
          created_at: string;
        };
        const flag = a.origin_country_flag ?? "";
        const from = [a.origin_city, a.origin_country]
          .filter(Boolean)
          .join(", ");
        items.push({
          id: `arrival:${a.id}`,
          kind: "arrival",
          createdAt: a.created_at,
          title: `${a.first_name} just joined ${flag}`.trim(),
          subtitle: from ? `From ${from}` : null,
          iconName: "person-add-outline",
          accentColor: "#0EA5E9",
          attributedName: a.first_name,
        });
      }

      for (const gt of gatheringsRes.data ?? []) {
        const g = gt as {
          id: string;
          title: string;
          location_name: string | null;
          event_type: string;
          created_at: string;
        };
        items.push({
          id: `gathering:${g.id}`,
          kind: "gathering",
          createdAt: g.created_at,
          title: g.title,
          subtitle: g.location_name ?? null,
          iconName: "calendar-outline",
          accentColor: "#7C3AED",
          meta: { event_type: g.event_type },
        });
      }

      for (const pt of postsRes.data ?? []) {
        const p = pt as {
          id: string;
          content: string | null;
          media_url: string | null;
          created_at: string;
          profile: { full_name: string | null; avatar_url: string | null } | null;
        };
        const author = p.profile?.full_name?.trim() || "Someone";
        items.push({
          id: `post:${p.id}`,
          kind: "post",
          createdAt: p.created_at,
          title: `${author} posted`,
          subtitle: (p.content ?? "").trim().slice(0, 140) || null,
          iconName: "chatbubble-ellipses-outline",
          accentColor: "#F97316",
          avatarUrl: p.profile?.avatar_url ?? null,
          attributedName: author,
        });
      }

      items.sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return tb - ta;
      });
      setActivity(items.slice(0, ACTIVITY_LIMIT));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load community");
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    community,
    membersCount,
    circles,
    circlesCount,
    totalSavedCents,
    activity,
    loading,
    error,
    refresh: load,
  };
}
