// ═══════════════════════════════════════════════════════════════════════════
// useElderCommunities — Phase 8 elder cross-community overview
// ═══════════════════════════════════════════════════════════════════════════
//
// One hook that returns every community where the caller has an
// elder-tier role (elder or owner — mig 005's role hierarchy), each
// enriched with member count, pending-request count, and a 7-day
// activity summary.
//
// Query strategy:
//   1. Own memberships filtered to elder/owner + active. This gives
//      us the list of community_ids to elder-scope.
//   2. Per community, in a single Promise.all pass:
//        a. Full community row (name, description, member_count, etc.)
//        b. Active member count (head + exact on community_memberships)
//        c. Pending join requests count
//        d. Recent 7-day activity summary: counts of arrivals, posts,
//           and gatherings.
//
// The per-community fan-out is bounded by how many communities a
// single user elder-owns (currently max 4 per mig 345's audit note).
// Not a performance concern at present.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type ElderCommunity = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  country: string | null;
  city: string | null;
  icon: string | null;
  role: "elder" | "owner";
  membersCount: number;
  pendingRequestsCount: number;
  recent: {
    arrivals: number;
    posts: number;
    gatherings: number;
  };
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function useElderCommunities() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<ElderCommunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setCommunities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: memberships, error: mErr } = await supabase
        .from("community_memberships")
        .select("community_id, role")
        .eq("user_id", user.id)
        .in("role", ["elder", "owner"])
        .eq("status", "active");
      if (mErr) throw mErr;
      const rows = memberships ?? [];
      if (rows.length === 0) {
        setCommunities([]);
        return;
      }

      // Compute the 7-day cutoff once. Passed into per-community
      // queries as an ISO string.
      const cutoffIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

      const enriched = await Promise.all(
        rows.map(async (m: { community_id: string; role: string }) => {
          const communityId = m.community_id;
          const [
            communityRes,
            membersCountRes,
            pendingRes,
            arrivalsRes,
            postsRes,
            gatheringsRes,
          ] = await Promise.all([
            supabase
              .from("communities")
              .select(
                "id, name, description, type, country, city, icon",
              )
              .eq("id", communityId)
              .maybeSingle(),
            supabase
              .from("community_memberships")
              .select("user_id", { count: "exact", head: true })
              .eq("community_id", communityId)
              .eq("status", "active"),
            supabase
              .from("community_join_requests")
              .select("id", { count: "exact", head: true })
              .eq("community_id", communityId)
              .eq("status", "pending"),
            supabase
              .from("community_arrivals")
              .select("id", { count: "exact", head: true })
              .eq("community_id", communityId)
              .gte("created_at", cutoffIso),
            supabase
              .from("feed_posts")
              .select("id", { count: "exact", head: true })
              .eq("community_id", communityId)
              .gte("created_at", cutoffIso),
            supabase
              .from("community_gatherings")
              .select("id", { count: "exact", head: true })
              .eq("community_id", communityId)
              .gte("created_at", cutoffIso),
          ]);

          const c = communityRes.data as {
            id: string;
            name: string;
            description: string | null;
            type: string | null;
            country: string | null;
            city: string | null;
            icon: string | null;
          } | null;
          if (!c) return null;
          return {
            id: c.id,
            name: c.name,
            description: c.description,
            type: c.type,
            country: c.country,
            city: c.city,
            icon: c.icon,
            role: m.role as "elder" | "owner",
            membersCount: membersCountRes.count ?? 0,
            pendingRequestsCount: pendingRes.count ?? 0,
            recent: {
              arrivals: arrivalsRes.count ?? 0,
              posts: postsRes.count ?? 0,
              gatherings: gatheringsRes.count ?? 0,
            },
          } as ElderCommunity;
        }),
      );

      setCommunities(
        enriched
          .filter((c): c is ElderCommunity => c !== null)
          .sort(
            (a, b) => b.pendingRequestsCount - a.pendingRequestsCount,
          ),
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to load elder communities");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { communities, loading, error, refresh: load };
}
