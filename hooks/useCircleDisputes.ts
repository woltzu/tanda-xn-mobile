// ═══════════════════════════════════════════════════════════════════════════════
// useCircleDisputes — Conflict Alerts Bucket A
// ═══════════════════════════════════════════════════════════════════════════════
//
// Reads open / investigating `dispute_cases` rows for a circle and keeps
// them fresh via realtime. Surfaces "Universe B" (member-reported + auto-
// created disputes) on the ConflictAlertScreen alongside the existing
// Universe A formation flags + monitors.
//
// Why not go through ElderContext? It models the elder lens — availableCases
// (offered to me) and myCases (claimed by me). The Conflict Alerts screen
// needs the full open queue for a circle regardless of who has claimed it,
// so a direct supabase read is cleaner. ElderContext keeps owning the
// claim/ruling flow once an elder taps "Open mediation".
//
// Migration 161 added the auto_created BOOLEAN and escalation_tier TEXT
// columns; both are pulled here so the screen can render the system pill
// + the "Escalated to L2 / Global queue" pill without a second fetch.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type DisputeStatus = "open" | "investigating" | "resolved" | "closed";

export type DisputeEscalationTier = "elder_l2" | "global_queue" | null;

export interface CircleDisputeRow {
  id: string;
  circleId: string;
  complainantId: string;
  respondentId: string | null;
  disputeType: string | null;
  description: string | null;
  status: DisputeStatus;
  autoCreated: boolean;
  escalationTier: DisputeEscalationTier;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): CircleDisputeRow {
  return {
    id: row.id,
    circleId: row.circle_id,
    complainantId: row.complainant_id,
    respondentId: row.respondent_id ?? null,
    disputeType: row.dispute_type ?? null,
    description: row.description ?? null,
    status: row.status,
    autoCreated: row.auto_created === true,
    escalationTier: row.escalation_tier ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useCircleDisputes(circleId: string | undefined) {
  const [disputes, setDisputes] = useState<CircleDisputeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDisputes = useCallback(async () => {
    if (!circleId) {
      setDisputes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("dispute_cases")
        .select(
          "id, circle_id, complainant_id, respondent_id, dispute_type, description, status, auto_created, escalation_tier, created_at, updated_at",
        )
        .eq("circle_id", circleId)
        .in("status", ["open", "investigating"])
        .order("updated_at", { ascending: false });
      if (error || !data) {
        setDisputes([]);
        return;
      }
      setDisputes(data.map(mapRow));
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  // Realtime — any insert/update/delete to a dispute on this circle
  // triggers a re-fetch. Cheap because we already cap status to open +
  // investigating and order by updated_at.
  useEffect(() => {
    if (!circleId) return;
    const channel = supabase
      .channel(`circle-disputes-${circleId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "dispute_cases",
          filter: `circle_id=eq.${circleId}`,
        },
        () => fetchDisputes(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId, fetchDisputes]);

  return { disputes, loading, refresh: fetchDisputes };
}
