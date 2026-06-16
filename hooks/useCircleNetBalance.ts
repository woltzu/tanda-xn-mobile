// hooks/useCircleNetBalance.ts
// ─────────────────────────────────────────────────────────────────────────────
// Computes the Home tile's "circle net" — per-circle and total — for the
// signed-in user.
//
// Definitions (matching the existing Home bottom-sheet sign convention):
//
//   contributed  = SUM(circle_contributions.amount)
//                  WHERE user_id = me AND status = 'paid'
//   received     = SUM(circle_payouts.amount)
//                  WHERE recipient_id = me AND status = 'completed'
//   net          = received - contributed
//                  positive → I'm ahead (received more than I put in)
//                  negative → I'm "owed" (put in more than received)
//
// We scope the per-circle list to the user's CURRENTLY ACTIVE memberships
// (circle_members.status = 'active'). Past activity in circles the user
// has left is intentionally excluded — the Home tile is about "where I am
// right now", not lifetime totals.
//
// Caching: module-scope Map keyed by user id, 5-minute TTL. Two
// consecutive Home mounts (e.g. tab-switch out + back) share one
// round-trip. refetch() invalidates the slot.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type CircleNetEntry = {
  circleId: string;
  circleName: string;
  contributed: number;
  received: number;
  net: number;
};

export type UseCircleNetBalanceResult = {
  circleNetBalances: CircleNetEntry[];
  totalNet: number;
  totalContributed: number;
  totalReceived: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { entries: CircleNetEntry[]; ts: number };
const cache = new Map<string, CacheEntry>();

function isFresh(entry: CacheEntry | undefined): boolean {
  return !!entry && Date.now() - entry.ts < CACHE_TTL_MS;
}

// Numeric columns in Postgres can come back from PostgREST as either
// number or string depending on driver / column type. Number() handles
// both; the || 0 fallback rescues a stray null.
function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function useCircleNetBalance(): UseCircleNetBalanceResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [entries, setEntries] = useState<CircleNetEntry[]>(() => {
    if (!userId) return [];
    const hit = cache.get(userId);
    return isFresh(hit) ? hit!.entries : [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!userId) return false;
    return !isFresh(cache.get(userId));
  });
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (force: boolean = false) => {
      if (!userId) {
        setEntries([]);
        setLoading(false);
        return;
      }
      if (!force) {
        const hit = cache.get(userId);
        if (isFresh(hit)) {
          setEntries(hit!.entries);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        // Three queries in parallel:
        //   1. active membership → the canonical list + circle names.
        //   2. paid contributions made by this user.
        //   3. completed payouts received by this user.
        // Aggregation happens in JS — row counts are small enough that
        // an RPC is overkill for now.
        const [
          { data: members, error: membersErr },
          { data: contribs, error: contribsErr },
          { data: payouts, error: payoutsErr },
        ] = await Promise.all([
          supabase
            .from("circle_members")
            .select("circle_id, circles(name, emoji)")
            .eq("user_id", userId)
            .eq("status", "active"),
          supabase
            .from("circle_contributions")
            .select("circle_id, amount")
            .eq("user_id", userId)
            .eq("status", "paid"),
          supabase
            .from("circle_payouts")
            .select("circle_id, amount")
            .eq("recipient_id", userId)
            .eq("status", "completed"),
        ]);
        if (membersErr) throw new Error(membersErr.message);
        if (contribsErr) throw new Error(contribsErr.message);
        if (payoutsErr) throw new Error(payoutsErr.message);

        const contribByCircle = new Map<string, number>();
        for (const row of contribs ?? []) {
          const cid = (row as { circle_id: string }).circle_id;
          contribByCircle.set(
            cid,
            (contribByCircle.get(cid) ?? 0) +
              toNum((row as { amount: unknown }).amount),
          );
        }
        const payoutByCircle = new Map<string, number>();
        for (const row of payouts ?? []) {
          const cid = (row as { circle_id: string }).circle_id;
          payoutByCircle.set(
            cid,
            (payoutByCircle.get(cid) ?? 0) +
              toNum((row as { amount: unknown }).amount),
          );
        }

        const built: CircleNetEntry[] = (members ?? []).map((m) => {
          const row = m as {
            circle_id: string;
            circles?: { name?: string | null } | { name?: string | null }[] | null;
          };
          const cid = row.circle_id;
          // PostgREST may return the embedded relation as either an
          // array (default) or a single object — defensively read both.
          const rel = Array.isArray(row.circles) ? row.circles[0] : row.circles;
          const name = rel?.name ?? "";
          const contributed = contribByCircle.get(cid) ?? 0;
          const received = payoutByCircle.get(cid) ?? 0;
          return {
            circleId: cid,
            circleName: name,
            contributed,
            received,
            net: received - contributed,
          };
        });

        cache.set(userId, { entries: built, ts: Date.now() });
        setEntries(built);
      } catch (e) {
        setError(
          (e as Error)?.message ?? "Failed to load circle net balance",
        );
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalNet = useMemo(
    () => entries.reduce((sum, e) => sum + e.net, 0),
    [entries],
  );
  const totalContributed = useMemo(
    () => entries.reduce((sum, e) => sum + e.contributed, 0),
    [entries],
  );
  const totalReceived = useMemo(
    () => entries.reduce((sum, e) => sum + e.received, 0),
    [entries],
  );

  return {
    circleNetBalances: entries,
    totalNet,
    totalContributed,
    totalReceived,
    loading,
    error,
    refetch: () => fetchData(true),
  };
}
