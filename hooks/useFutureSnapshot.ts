// hooks/useFutureSnapshot.ts
//
// Powers Home's "Future Snapshot" card. Two parallel selects:
//   - circle_contributions where user_id=me AND status IN ('due', 'pending')
//     AND due_date >= today → upcoming obligations
//   - circle_cycles where recipient_user_id=me AND cycle_status IN
//     ('pending', 'scheduled', 'in_progress') → expected payouts
//
// Circle names resolve client-side via useCircles' myCircles list —
// same rationale as useRecentActivity: avoids nested Supabase selects
// and stays fast without an FK relationship on the query. Falls back
// to a generic "a circle" label when the id isn't in myCircles.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";

export type FutureSnapshotItem = {
  id: string;
  date: string; // display, e.g. "Jul 12"
  isoDate: string; // sort key
  name: string;
  amount: number; // dollars
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

export function useFutureSnapshot(limit = 5) {
  const { user } = useAuth();
  const { myCircles } = useCircles();
  const [obligations, setObligations] = useState<FutureSnapshotItem[]>([]);
  const [expectedPayouts, setExpectedPayouts] = useState<FutureSnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setObligations([]);
      setExpectedPayouts([]);
      return;
    }
    setLoading(true);
    try {
      // ISO date for "today" in the client's local zone. Trimmed to
      // yyyy-mm-dd to match the `date` column on circle_contributions.
      const today = new Date().toISOString().slice(0, 10);

      const [contribsRes, cyclesRes] = await Promise.all([
        supabase
          .from("circle_contributions")
          .select("id, amount, due_date, status, circle_id")
          .eq("user_id", user.id)
          .in("status", ["due", "pending", "scheduled"])
          .gte("due_date", today)
          .order("due_date", { ascending: true })
          .limit(limit),
        supabase
          .from("circle_cycles")
          .select(
            "id, circle_id, payout_amount, expected_payout_date, cycle_status, recipient_user_id",
          )
          .eq("recipient_user_id", user.id)
          .in("cycle_status", ["pending", "scheduled", "in_progress"])
          .order("expected_payout_date", { ascending: true })
          .limit(limit),
      ]);

      const circleName = (id: string | null | undefined) =>
        (id && myCircles.find((c) => c.id === id)?.name) ?? "a circle";

      const oblig: FutureSnapshotItem[] = (contribsRes.data || []).map(
        (r: any) => ({
          id: `co-${r.id}`,
          date: formatDisplayDate(r.due_date),
          isoDate: r.due_date,
          name: circleName(r.circle_id),
          amount: Number(r.amount ?? 0),
        }),
      );
      const exp: FutureSnapshotItem[] = (cyclesRes.data || []).map((r: any) => ({
        id: `cy-${r.id}`,
        date: formatDisplayDate(r.expected_payout_date),
        isoDate: r.expected_payout_date,
        name: circleName(r.circle_id),
        amount: Number(r.payout_amount ?? 0),
      }));

      setObligations(oblig);
      setExpectedPayouts(exp);
    } catch (err) {
      console.warn("[useFutureSnapshot] refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, myCircles, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { obligations, expectedPayouts, loading, refresh };
}
