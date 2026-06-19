// ═══════════════════════════════════════════════════════════════════════════════
// useProfileBatch — Conflict Alerts Bucket A
// ═══════════════════════════════════════════════════════════════════════════════
//
// Resolves a list of user ids to display names in a single round-trip.
// Replaces the legacy `shortId(uuid)` truncation that rendered pair members
// and dispute parties as "abcd1234…" — useless for an elder who needs to
// know WHO is in conflict before they can act.
//
// Pattern: dedupe + sort the input, then check a module-level cache (5-min
// TTL keyed by the sorted id list). On miss, single SELECT on profiles
// joined by `id IN (…)`. Returns a Map for O(1) name lookups on the
// render path; consumers fall back to the truncated id when a profile is
// missing (deleted user, RLS, etc.).
//
// Not bound to any particular feature — usable anywhere a screen needs to
// translate a small handful of UUIDs into names.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  key: string; // sorted-deduped id list joined by ","
  names: Map<string, string>;
  fetchedAt: number;
};
let profileCache: CacheEntry | null = null;

function cacheKey(ids: string[]): string {
  return Array.from(new Set(ids)).sort().join(",");
}

export function useProfileBatch(ids: string[] | undefined) {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  // Stable key for the dep array so non-changing id lists don't trigger
  // refetches on every render.
  const key = useMemo(() => cacheKey(ids ?? []), [ids]);

  const fetchNames = useCallback(async () => {
    if (!key) {
      setNames(new Map());
      return;
    }
    if (
      profileCache &&
      profileCache.key === key &&
      Date.now() - profileCache.fetchedAt < PROFILE_CACHE_TTL_MS
    ) {
      setNames(profileCache.names);
      return;
    }
    setLoading(true);
    try {
      const dedupedIds = key.split(",");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", dedupedIds);
      if (error || !data) {
        setNames(new Map());
        return;
      }
      const map = new Map<string, string>();
      for (const row of data as Array<{ id: string; full_name: string | null }>) {
        if (row.full_name) map.set(row.id, row.full_name);
      }
      profileCache = { key, names: map, fetchedAt: Date.now() };
      setNames(map);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchNames();
  }, [fetchNames]);

  return { names, loading };
}
