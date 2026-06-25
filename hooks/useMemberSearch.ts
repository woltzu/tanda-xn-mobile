// ═══════════════════════════════════════════════════════════════════════════
// hooks/useMemberSearch.ts — Phase 2, migration 259
// ═══════════════════════════════════════════════════════════════════════════
//
// Calls search_members(query, community_id?, limit). The RPC enforces
// bounded-belonging server-side — only profiles that share a community
// or a current circle with the caller are returned. Empty queries return
// an empty result set without hitting the DB.
//
// 300ms debounce keeps every keystroke from firing a round-trip. Adjust
// in DEBOUNCE_MS if the user is on a slow connection (or remove the
// debounce and tie it to onSubmitEditing for explicit-search UX).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const DEBOUNCE_MS = 300;

export interface MemberSearchResult {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  tier_badge: string | null;
  similarity: number | null;
}

export interface UseMemberSearchOptions {
  communityId?: string;
  limit?: number;
}

export interface UseMemberSearchResult {
  results: MemberSearchResult[];
  isLoading: boolean;
  error: string | null;
}

export function useMemberSearch(
  query: string,
  options: UseMemberSearchOptions = {},
): UseMemberSearchResult {
  const { communityId, limit = 20 } = options;
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const { data, error: e } = await supabase.rpc("search_members", {
          p_query: trimmed,
          p_community_id: communityId ?? null,
          p_limit: limit,
        });
        if (e) throw new Error(e.message);
        setResults((data ?? []) as MemberSearchResult[]);
      } catch (err: any) {
        setError(err?.message ?? "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [communityId, limit],
  );

  useEffect(() => {
    const handle = setTimeout(() => search(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, search]);

  return { results, isLoading, error };
}

// ═══════════════════════════════════════════════════════════════════════════
// useCanInvite — one-shot pre-flight for the invite button.
//
// The DB has tr_block_critical_invitation (migration 257) that will reject
// the INSERT, so this hook is UX preview only — it lets the UI disable the
// invite button before the user taps it. Don't rely on the boolean for
// security; always let the trigger fire too.
// ═══════════════════════════════════════════════════════════════════════════

export interface UseCanInviteResult {
  canInvite: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCanInvite(
  inviterId: string | undefined,
  targetId: string | undefined,
  circleId: string | undefined,
): UseCanInviteResult {
  const [canInvite, setCanInvite] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!inviterId || !targetId || !circleId) {
      setCanInvite(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("can_invite", {
        p_inviter_id: inviterId,
        p_target_id: targetId,
        p_circle_id: circleId,
      });
      if (e) throw new Error(e.message);
      setCanInvite(data === true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to check invite permission");
      setCanInvite(false);
    } finally {
      setLoading(false);
    }
  }, [inviterId, targetId, circleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { canInvite, isLoading, error, refresh };
}
