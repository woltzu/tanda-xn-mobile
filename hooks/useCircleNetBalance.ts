// hooks/useCircleNetBalance.ts
// ─────────────────────────────────────────────────────────────────────────────
// Computes the Home tile's "circle net" — per-circle and total — for the
// signed-in user.
//
// Definitions:
//
//   contributed  = SUM(circle_contributions.amount)
//                  WHERE user_id = me AND status = 'paid'
//   received     = SUM(circle_payouts.amount)
//                  WHERE recipient_id = me AND status = 'completed'
//   net          = contributed - received
//                  positive → the circle owes me the difference
//                             (I've put in more than I've taken out so
//                              far — positive equity).
//                  negative → I'm "ahead" in cash, will catch up later
//                             (I've taken out more than I've put in;
//                              upcoming contributions will close the gap).
//
// Sign convention matches a bank account: deposits (contributions)
// add to the balance; withdrawals (payouts) subtract. Positive net
// therefore reads as "balance you're owed."
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
            net: contributed - received,
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

  // ── Realtime invalidation (D — task C) ──────────────────────────
  //
  // Two filtered postgres_changes channels listen for any INSERT /
  // UPDATE / DELETE against this user's contribution and payout
  // rows. The filter is server-side (Realtime evaluates it before
  // pushing), so a busy circle that processes thousands of other
  // members' rows doesn't fan out to this client.
  //
  // Events from a cycle settlement can land in a burst — one
  // contribution per member, all in the same tx — so we coalesce
  // into a single refetch via a 300 ms trailing-edge debounce. Cache
  // invalidation lives in the timer body so a stale entry can't be
  // re-served if a render happens to fire between the event and the
  // debounced refetch.
  //
  // fetchData is reached through a ref so the subscription effect
  // only re-subscribes when userId changes — without it, every
  // fetchData re-creation (currently triggered only by userId, but
  // that's an internal detail) would tear the channel down and
  // re-open it.
  //
  // Failures (network drop, RLS rejecting the subscription) surface
  // as channel-status callbacks; we log and continue. The existing
  // useFocusEffect refetch on HomeScreen is the documented fallback.
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const scheduleRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        cache.delete(userId);
        void fetchDataRef.current(true);
      }, 300);
    };

    type ChannelRef = ReturnType<typeof supabase.channel> | null;
    let contribChannel: ChannelRef = null;
    let payoutChannel: ChannelRef = null;

    try {
      contribChannel = supabase
        .channel(`circle-net-contributions-${userId}`)
        .on(
          // @ts-expect-error supabase-js types narrow event to a literal but
          // accept "*" at runtime to subscribe to all change events.
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "circle_contributions",
            filter: `user_id=eq.${userId}`,
          },
          () => scheduleRefetch(),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(
              "[useCircleNetBalance] contributions channel status:",
              status,
            );
          }
        });

      payoutChannel = supabase
        .channel(`circle-net-payouts-${userId}`)
        .on(
          // @ts-expect-error see contributions channel above.
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "circle_payouts",
            filter: `recipient_id=eq.${userId}`,
          },
          () => scheduleRefetch(),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(
              "[useCircleNetBalance] payouts channel status:",
              status,
            );
          }
        });
    } catch (e) {
      console.warn(
        "[useCircleNetBalance] realtime subscribe failed; falling back to focus refresh:",
        (e as Error)?.message ?? "unknown",
      );
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (contribChannel) {
        try {
          supabase.removeChannel(contribChannel);
        } catch {
          /* best-effort */
        }
      }
      if (payoutChannel) {
        try {
          supabase.removeChannel(payoutChannel);
        } catch {
          /* best-effort */
        }
      }
    };
  }, [userId]);

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

  // Memoize refetch so consumers can safely place it in
  // useFocusEffect / useEffect dependency arrays. Without this, the
  // arrow function got a new identity every render — HomeScreen's
  // useFocusEffect(useCallback(..., [refetch])) re-registered every
  // render, re-firing on focus, calling refetch, triggering setState,
  // triggering re-render, ad infinitum. Manifested as
  // "Maximum update depth exceeded" pointing at fetchData.
  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return {
    circleNetBalances: entries,
    totalNet,
    totalContributed,
    totalReceived,
    loading,
    error,
    refetch,
  };
}
