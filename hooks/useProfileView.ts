// ═══════════════════════════════════════════════════════════════════════════
// hooks/useProfileView.ts — Phase 2, migration 258
// ═══════════════════════════════════════════════════════════════════════════
//
// Calls get_profile_view(p_target_id) — server-side RPC that projects a
// profile through a per-viewer visibility filter. Returns NULLs for fields
// the current viewer is not allowed to see.
//
// Field types are TypeScript-tightened versions of the JSONB shape returned
// by the RPC. Important: the RPC uses *_cents suffixes for money fields,
// matching the underlying column units. Render-time formatting is the
// caller's responsibility (don't show cents as dollars).
//
// Visibility scopes (see migration 258 header for the authoritative spec):
//   • ANON              — id, display_name, avatar_url only
//   • CO-COMMUNITY      — adds full_name, role, tier_badge,
//                         circles_completed, honor_badge
//   • SELF              — adds email, phone, wallet_balance_cents,
//                         goals_total_target_cents, xn_score,
//                         stress_score, mood_score
//   • ELDER + CO-COMMUNITY — adds max_exposure_cents, demotion_reason
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface ProfileView {
  id: string;
  display_name: string | null;
  avatar_url: string | null;

  // Authenticated viewers (omitted for anon)
  full_name?: string | null;
  role?: string | null;
  tier_badge?: string | null;

  // Self OR co-community
  circles_completed?: number | null;
  honor_badge?: number | null;

  // Self only
  email?: string | null;
  phone?: string | null;
  wallet_balance_cents?: number | null;
  goals_total_target_cents?: number | null;
  xn_score?: number | null;
  stress_score?: number | null;
  mood_score?: number | null;

  // Elder + co-community
  max_exposure_cents?: number | null;
  demotion_reason?: string | null;
}

export interface UseProfileViewResult {
  profile: ProfileView | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProfileView(userId: string | undefined): UseProfileViewResult {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("get_profile_view", {
        p_target_id: userId,
      });
      if (e) throw new Error(e.message);
      setProfile((data ?? null) as ProfileView | null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, isLoading, error, refresh };
}
