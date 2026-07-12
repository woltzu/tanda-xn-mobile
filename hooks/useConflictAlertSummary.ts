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

// Compare two MostRecent shapes without churning references. The fetch
// path can produce a fresh object each round with identical values;
// setState with that would cause a re-render even though nothing changed,
// which can cascade through parent memoization tied to this hook's
// output.
function sameMostRecent(a: MostRecent | null, b: MostRecent | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.source === b.source &&
    a.circleId === b.circleId &&
    a.circleName === b.circleName &&
    a.updatedAt === b.updatedAt
  );
}

export function useConflictAlertSummary(
  circleIds: string[] | undefined,
) {
  const [openCount, setOpenCount] = useState(0);
  const [mostRecent, setMostRecent] = useState<MostRecent | null>(null);
  const [loading, setLoading] = useState(false);

  // Content-address the id list so `fetchSummary` (and the effect that
  // owns it) rebuild only when the actual set of ids changes. The
  // upstream caller passes `myCircles.map(c => c.id)`, and `myCircles`
  // itself is `circles.filter(...)` in CirclesContext — recomputed on
  // every provider render, so callers received a fresh array reference
  // every render even when the ids were identical. Depending on that
  // reference directly made `fetchSummary` new every render, which
  // re-fired the effect, whose state updates triggered another render —
  // Maximum update depth on any downstream screen (CirclesV2Screen,
  // JoinCircleByCode, ...).
  //
  // Computed inline (no useMemo) because the deps of useCallback below
  // compare primitives with Object.is, so identical-content ids resolve
  // to the same cached callback identity regardless of how many times
  // this expression runs.
  const idsKey = (circleIds ?? []).slice().sort().join(",");

  const fetchSummary = useCallback(async () => {
    if (!idsKey) {
      // Functional updater form so React's dedupe short-circuits when
      // the current value already matches, avoiding a spurious render.
      setOpenCount((prev) => (prev === 0 ? prev : 0));
      setMostRecent((prev) => (prev === null ? prev : null));
      setLoading((prev) => (prev === false ? prev : false));
      return;
    }
    // Re-derive the id list from the key so the callback stays a pure
    // function of `idsKey` — no closure over the original array.
    const ids = idsKey.split(",");
    setLoading((prev) => (prev === true ? prev : true));
    try {
      const [
        { data: disputeRows },
        { data: escalatedRows },
      ] = await Promise.all([
        supabase
          .from("dispute_cases")
          .select("id, circle_id, updated_at, circles(name)")
          .in("circle_id", ids)
          .in("status", ["open", "investigating"])
          .order("updated_at", { ascending: false }),
        supabase
          .from("post_formation_monitor")
          .select("id, circle_id, updated_at, circles(name)")
          .in("circle_id", ids)
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
      setOpenCount((prev) => (prev === totalCount ? prev : totalCount));

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
      const next = candidates[0] ?? null;
      // Structural equality guard: successive fetches often produce a
      // fresh object with identical values. Skip the setState so the
      // parent memoized on this reference doesn't re-render for nothing.
      setMostRecent((prev) => (sameMostRecent(prev, next) ? prev : next));
    } catch {
      // Soft-fail — the CirclesV2 card just shows 0 / no most-recent line.
      setOpenCount((prev) => (prev === 0 ? prev : 0));
      setMostRecent((prev) => (prev === null ? prev : null));
    } finally {
      setLoading((prev) => (prev === false ? prev : false));
    }
  }, [idsKey]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { openCount, mostRecent, loading, refresh: fetchSummary };
}
