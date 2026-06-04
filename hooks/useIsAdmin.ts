// =============================================================================
// useIsAdmin -- thin wrapper around the public.is_admin() SQL helper
// (migration 114). Returns whether the current authenticated user has an
// active row in admin_users.
//
// Source of truth is the DB function, not a local AsyncStorage cache or a
// hardcoded UUID allowlist. That means the same logic gates RLS reads on
// admin tables and the AIJobsHealthScreen render path -- there's no way
// to bypass one without the other.
//
// Idle state: { isAdmin: false, loading: true }
// Resolved:   { isAdmin: <boolean>, loading: false }
// On error:   { isAdmin: false, loading: false, error: <message> }  -- a
//   network blip should default to "not admin" rather than accidentally
//   open the gate.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!user?.id) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // Server-side check via the migration-114 helper. Passing user.id
      // is technically redundant (the function defaults to auth.uid())
      // but makes the intent explicit and lets us reuse the same RPC
      // server-side for ad-hoc admin lookups.
      const { data, error: rpcErr } = await supabase.rpc("is_admin", {
        p_user_id: user.id,
      });

      if (rpcErr) throw new Error(rpcErr.message);
      setIsAdmin(data === true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsAdmin(false); // fail closed
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    check();
  }, [check]);

  return { isAdmin, loading, error, refresh: check };
}
