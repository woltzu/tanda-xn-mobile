// hooks/useRecentActivity.ts
//
// Pulls the caller's last N financial events across three sources —
// circle contributions (paid), wallet payout requests (completed),
// and wallet ledger rows — and returns them coalesced + sorted by
// created_at DESC. Replaces the `mockActivity` array HomeScreen was
// rendering.
//
// Sources deliberately kept simple:
//   circle_contributions   — user_id + status='paid'
//   payout_requests        — user_id + status='completed'
//   wallet_transactions    — user_id (any type; description field
//                            is used as the label so the row shows
//                            whatever the ledger insert wrote)
//
// circle_payouts and trip_payments both need multi-table joins to
// scope to the caller (payouts by recipient, trip payments by
// participant); left out for a follow-up so this hook stays fast +
// obvious. The wallet ledger typically has a mirrored row anyway,
// so the recipient side of a payout still lands in wallet_transactions.
//
// The circle name is resolved client-side against useCircles' myCircles
// list — avoids nested Supabase selects and stays fast even without
// an FK-configured relationship. Falls back to a generic label when
// the circle isn't in myCircles (e.g. user left the circle after
// paying in).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";

export type RecentActivityItem = {
  id: string;
  direction: "in" | "out";
  descKey: string;
  descParams?: Record<string, string>;
  amount: number; // dollars, signed
  date: string; // display date, e.g. "Mar 10"
  createdAt: string; // ISO string for stable sort
};

function formatDisplayDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function useRecentActivity(limit = 10) {
  const { user } = useAuth();
  const { myCircles } = useCircles();
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const [contribsRes, payoutsRes, walletRes] = await Promise.all([
        supabase
          .from("circle_contributions")
          .select("id, amount, created_at, status, circle_id")
          .eq("user_id", user.id)
          .eq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("payout_requests")
          .select("id, amount, created_at, status")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("wallet_transactions")
          .select("id, amount_cents, description, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      const circleName = (id: string | null | undefined) =>
        (id && myCircles.find((c) => c.id === id)?.name) ?? "a circle";

      const rows: RecentActivityItem[] = [];

      (contribsRes.data || []).forEach((r: any) => {
        rows.push({
          id: `c-${r.id}`,
          direction: "out",
          descKey: "home_screen.activity_contributed_to",
          descParams: { circle: circleName(r.circle_id) },
          amount: -Number(r.amount ?? 0),
          date: formatDisplayDate(r.created_at),
          createdAt: r.created_at,
        });
      });

      (payoutsRes.data || []).forEach((r: any) => {
        rows.push({
          id: `p-${r.id}`,
          direction: "in",
          descKey: "home_screen.activity_wallet_payout",
          amount: Number(r.amount ?? 0),
          date: formatDisplayDate(r.created_at),
          createdAt: r.created_at,
        });
      });

      (walletRes.data || []).forEach((r: any) => {
        const cents = Number(r.amount_cents) || 0;
        rows.push({
          id: `w-${r.id}`,
          direction: cents >= 0 ? "in" : "out",
          descKey: "home_screen.activity_wallet_generic",
          descParams: { desc: r.description || "Wallet activity" },
          amount: cents / 100,
          date: formatDisplayDate(r.created_at),
          createdAt: r.created_at,
        });
      });

      rows.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setItems(rows.slice(0, limit));
    } catch (err) {
      console.warn("[useRecentActivity] refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, myCircles, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
