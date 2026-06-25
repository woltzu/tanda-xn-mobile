// ═══════════════════════════════════════════════════════════════════════════
// hooks/useProviderAccess.ts — Phase 2, migration 260
// ═══════════════════════════════════════════════════════════════════════════
//
// Calls is_provider_accessible(provider_id). Returns whether the current
// user can interact with this provider — used by ProviderDetailScreen to
// gate booking/contact actions. The RLS policy on providers (migration
// 260) backstops this at the data layer; the hook is for UX preview.
//
// Fails closed on error: any failure → canAccess=false. The provider
// detail screen should render the "not available in your community"
// message when this is false.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface UseProviderAccessResult {
  canAccess: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProviderAccess(
  providerId: string | undefined,
): UseProviderAccessResult {
  const [canAccess, setCanAccess] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!providerId) {
      setCanAccess(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("is_provider_accessible", {
        p_provider_id: providerId,
      });
      if (e) throw new Error(e.message);
      setCanAccess(data === true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to check provider access");
      setCanAccess(false);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { canAccess, isLoading, error, refresh };
}
