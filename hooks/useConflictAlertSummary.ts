// ═══════════════════════════════════════════════════════════════════════════════
// useConflictAlertSummary — Conflict Alerts Bucket A
// ═══════════════════════════════════════════════════════════════════════════════
//
// Drives the CirclesV2 "Conflict Alerts" feature card. Replaces the
// hardcoded `mockConflicts = { count: 2, most_recent: { ... } }` object.
//
// Counts open/investigating disputes across all of the user's circles plus
// escalated post-formation monitors, and picks the freshest row as the
// "most recent" line (with its circle name + date).
//
// Two cheap queries each; cap the count display at 99+ on the card. No
// realtime channel — the card itself is read-only; opening the screen
// is where the real surface lives.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface MostRecent {
  source: "dispute" | "monitor";
  circleId: string;
  circleName: string | null;
  updatedAt: string;
}

export function useConflictAlertSummary(
  circleIds: string[] | undefined,
) {
  const [openCount, setOpenCount] = useState(0);
  const [mostRecent, setMostRecent] = useState<MostRecent | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!circleIds || circleIds.length === 0) {
      setOpenCount(0);
      setMostRecent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        { data: disputeRows },
        { data: escalatedRows },
      ] = await Promise.all([
        supabase
          .from("dispute_cases")
          .select("id, circle_id, updated_at, circles(name)")
          .in("circle_id", circleIds)
          .in("status", ["open", "investigating"])
          .order("updated_at", { ascending: false }),
        supabase
          .from("post_formation_monitor")
          .select("id, circle_id, updated_at, circles(name)")
          .in("circle_id", circleIds)
          .eq("escalated", true)
          .order("updated_at", { ascending: false }),
      ]);

      const disputes = (disputeRows ?? []) as Array<{
        id: string;
        circle_id: string;
        updated_at: string;
        circles?: { name?: string | null } | null;
      }>;
      const escalations = (escalatedRows ?? []) as Array<{
        id: string;
        circle_id: string;
        updated_at: string;
        circles?: { name?: string | null } | null;
      }>;

      const totalCount = disputes.length + escalations.length;
      setOpenCount(totalCount);

      // Pick whichever has the freshest updated_at as the most-recent
      // line. Ties favor disputes — the actionable-by-elder surface
      // people are most likely to need.
      const candidates: MostRecent[] = [];
      const firstDispute = disputes[0];
      if (firstDispute) {
        candidates.push({
          source: "dispute",
          circleId: firstDispute.circle_id,
          circleName: firstDispute.circles?.name ?? null,
          updatedAt: firstDispute.updated_at,
        });
      }
      const firstEscalation = escalations[0];
      if (firstEscalation) {
        candidates.push({
          source: "monitor",
          circleId: firstEscalation.circle_id,
          circleName: firstEscalation.circles?.name ?? null,
          updatedAt: firstEscalation.updated_at,
        });
      }
      candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setMostRecent(candidates[0] ?? null);
    } catch {
      // Soft-fail — the CirclesV2 card just shows 0 / no most-recent line.
      setOpenCount(0);
      setMostRecent(null);
    } finally {
      setLoading(false);
    }
  }, [circleIds]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { openCount, mostRecent, loading, refresh: fetchSummary };
}
