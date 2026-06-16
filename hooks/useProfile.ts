// hooks/useProfile.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central fetch of the current user's `public.profiles` row. Used by
// ProfileScreen and PersonalInfoScreen (P1 of the profile review) so
// the screens stop running ad-hoc `supabase.from('profiles').select(...)`
// calls in their own effects.
//
// Cache: module-scope Map keyed by user id, 60-second TTL. Two screens
// mounting back-to-back share a single round-trip. Call refetch() after
// an avatar upload, country pick, or any write that should bust the
// cache.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type Profile = {
  id: string;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  date_of_birth: string | null;
  email: string | null;
  full_name: string | null;
  language: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  round_up_increment: number | null;
  timezone: string | null;
};

type CacheEntry = { value: Profile | null; expiresAt: number };
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

const SELECT_COLUMNS =
  "id, avatar_url, city, country, date_of_birth, email, full_name, language, phone, phone_verified, round_up_increment, timezone";

export type UseProfileResult = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useProfile(): UseProfileResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(() => {
    if (!userId) return null;
    const hit = cache.get(userId);
    return hit && hit.expiresAt > Date.now() ? hit.value : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!userId) return false;
    const hit = cache.get(userId);
    return !(hit && hit.expiresAt > Date.now());
  });
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(
    async (forUserId: string, opts?: { bypassCache?: boolean }) => {
      if (!opts?.bypassCache) {
        const hit = cache.get(forUserId);
        if (hit && hit.expiresAt > Date.now()) {
          setProfile(hit.value);
          setLoading(false);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("profiles")
        .select(SELECT_COLUMNS)
        .eq("id", forUserId)
        .maybeSingle();
      if (e) {
        setError(e.message);
        setLoading(false);
        return;
      }
      const value = (data as Profile | null) ?? null;
      cache.set(forUserId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      setProfile(value);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    fetchOnce(userId);
  }, [userId, fetchOnce]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    await fetchOnce(userId, { bypassCache: true });
  }, [userId, fetchOnce]);

  return { profile, loading, error, refetch };
}
