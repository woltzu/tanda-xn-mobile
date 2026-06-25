// ═══════════════════════════════════════════════════════════════════════════
// hooks/useCommunityProviders.ts — Phase 2, migration 260
// ═══════════════════════════════════════════════════════════════════════════
//
// Calls get_community_providers(community_id, query?, limit). Returns
// providers that are either platform-wide or in the requested community.
// Server-side filters: verification_status='verified' AND is_active=true.
//
// Empty/blank queries skip similarity scoring server-side. The hook
// debounces query input by 300ms (matches useMemberSearch).
//
// Spec mismatch retained for the API: spec listed `name`, `review_count`,
// `avatar_url`, `tags` — the real provider table has business_name,
// rating_count, and no avatar/tags. UI consumers should bind to
// business_name/rating_count; avatar URLs require joining profiles
// (deferred).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const DEBOUNCE_MS = 300;

export interface CommunityProvider {
  provider_id: string;
  business_name: string | null;
  description: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  similarity: number | null;
}

export interface UseCommunityProvidersResult {
  providers: CommunityProvider[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCommunityProviders(
  communityId: string | undefined,
  query: string = "",
  limit: number = 20,
): UseCommunityProvidersResult {
  const [providers, setProviders] = useState<CommunityProvider[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(
    async (q: string) => {
      if (!communityId) {
        setProviders([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const { data, error: e } = await supabase.rpc("get_community_providers", {
          p_community_id: communityId,
          p_query: q.trim().length > 0 ? q.trim() : null,
          p_limit: limit,
        });
        if (e) throw new Error(e.message);
        setProviders((data ?? []) as CommunityProvider[]);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load providers");
        setProviders([]);
      } finally {
        setLoading(false);
      }
    },
    [communityId, limit],
  );

  useEffect(() => {
    const handle = setTimeout(() => fetch(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, fetch]);

  const refresh = useCallback(() => fetch(query), [fetch, query]);

  return { providers, isLoading, error, refresh };
}
