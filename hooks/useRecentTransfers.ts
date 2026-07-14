// ══════════════════════════════════════════════════════════════════════════════
// hooks/useRecentTransfers.ts — recent Wallet Recent Activity feed.
// ══════════════════════════════════════════════════════════════════════════════
//
// Coalesces two on-server sources into a single, sorted stream that drives
// the Wallet screen's "Recent Activity" list:
//
//   * money_transfers      — send-money rows (both sides: sent + received)
//   * wallet_transactions  — ledger rows (top-ups, payouts, credits, debits)
//
// Rows are tagged with a `source` discriminator so the renderer can map
// each shape to the shared Transaction type WalletScreen already uses.
//
// RLS handles authorization on both tables:
//   * money_transfers    — sender or recipient can read own rows.
//   * wallet_transactions — pe_wt_select scopes to auth.uid() = user_id.
//
// The `direction` field on money_transfers is computed client-side
// (sender_user_id vs current uid) so the renderer can pick sign + label
// without an extra round-trip.
//
// Refresh patterns:
//   - On mount: useEffect fires `refetch()` once.
//   - On screen focus: callers wrap `refetch` in `useFocusEffect` so a
//     successful send or top-up (which navigates back to Wallet) immediately
//     surfaces the new row instead of waiting for a cold app start.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type TransferDirection = "sent" | "received";

export type TransferStatus = "pending" | "completed" | "failed" | "reversed";

export type RecentTransfer = {
  source: "transfer";
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

export type RecentWalletTx = {
  source: "wallet";
  id: string;
  transaction_type: string;
  direction: "credit" | "debit";
  amount_cents: number;
  currency: string;
  description: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
};

export type RecentActivityRow = RecentTransfer | RecentWalletTx;

export function useRecentTransfers(limit = 10) {
  const [transfers, setTransfers] = useState<RecentActivityRow[]>([]);
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

      // Fan out both queries in parallel — merge + sort client-side.
      const [transfersRes, walletRes] = await Promise.all([
        supabase
          .from("money_transfers")
          .select("*")
          .or(`sender_user_id.eq.${uid},recipient_user_id.eq.${uid}`)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("wallet_transactions")
          .select(
            "id, transaction_type, direction, amount_cents, description, metadata, created_at",
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      if (transfersRes.error) {
        setError(transfersRes.error.message);
        setTransfers([]);
        return;
      }
      if (walletRes.error) {
        setError(walletRes.error.message);
        setTransfers([]);
        return;
      }

      const transferRows: RecentActivityRow[] = (transfersRes.data ?? []).map(
        (r: any) => ({
          source: "transfer" as const,
          id: r.id,
          direction: r.sender_user_id === uid ? "sent" : "received",
          amount_cents: r.amount_cents,
          currency: r.currency,
          fee_cents: r.fee_cents,
          method: r.method,
          funding_source: r.funding_source,
          status: r.status,
          created_at: r.created_at,
          recipient_external_identifier: r.recipient_external_identifier,
          recipient_user_id: r.recipient_user_id,
          sender_user_id: r.sender_user_id,
        }),
      );

      const walletRows: RecentActivityRow[] = (walletRes.data ?? []).map(
        (r: any) => ({
          source: "wallet" as const,
          id: r.id,
          transaction_type: r.transaction_type,
          direction: r.direction,
          amount_cents: r.amount_cents,
          // wallet_transactions stores USD amounts today; keep this
          // explicit so downstream currency formatting stays consistent.
          currency: "USD",
          description: r.description,
          metadata: r.metadata,
          created_at: r.created_at,
        }),
      );

      const merged = [...transferRows, ...walletRows].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setTransfers(merged.slice(0, limit));
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
