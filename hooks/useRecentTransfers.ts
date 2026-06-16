// ══════════════════════════════════════════════════════════════════════════════
// hooks/useRecentTransfers.ts — recent money_transfers feed for the wallet UI.
// ══════════════════════════════════════════════════════════════════════════════
//
// Replaces the local AsyncStorage `transactions` array as the source of truth
// for the Wallet screen's "Recent Activity" section. Queries the
// money_transfers table directly — both sides of every transfer the
// current user participates in (RLS handles authorization: sender sees own,
// recipient sees addressed-to-them).
//
// The `direction` field is computed client-side by comparing sender_user_id
// to the current auth uid, so the renderer can pick the right sign and
// label without an extra round-trip.
//
// Refresh patterns:
//   - On mount: useEffect fires `refetch()` once.
//   - On screen focus: callers wrap `refetch` in `useFocusEffect` so a
//     successful send (which navigates the user back to Wallet) immediately
//     surfaces the new row instead of waiting for a cold app start.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type TransferDirection = "sent" | "received";

export type TransferStatus = "pending" | "completed" | "failed" | "reversed";

export type RecentTransfer = {
  id: string;
  direction: TransferDirection;
  amount_cents: number;
  currency: string;
  fee_cents: number;
  method: string;
  funding_source: string;
  status: TransferStatus;
  created_at: string;
  recipient_external_identifier: string;
  recipient_user_id: string | null;
  sender_user_id: string;
};

export function useRecentTransfers(limit = 10) {
  const [transfers, setTransfers] = useState<RecentTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) {
        setTransfers([]);
        return;
      }

      // RLS on money_transfers allows the sender to read their own rows AND
      // the recipient to read rows addressed to them. `.or()` collapses
      // both sides into one ordered list with a single round-trip.
      const { data, error: qErr } = await supabase
        .from("money_transfers")
        .select("*")
        .or(`sender_user_id.eq.${uid},recipient_user_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (qErr) {
        setError(qErr.message);
        setTransfers([]);
        return;
      }

      const enriched: RecentTransfer[] = (data ?? []).map((r: any) => ({
        ...r,
        direction: r.sender_user_id === uid ? "sent" : "received",
      }));
      setTransfers(enriched);
    } catch (e: any) {
      setError(e?.message ?? "unknown_error");
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { transfers, loading, error, refetch };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

// Compact "Jun 11" / "2:34 PM" date label for the Recent Activity rows.
// Falls back to the ISO date when the value can't be parsed.
export function formatTransferDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
