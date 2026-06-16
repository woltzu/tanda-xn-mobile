// hooks/useAuditAnomalies.ts
// ─────────────────────────────────────────────────────────────────────────────
// Loads the `audit_anomalies` queue for the PlatformAuditTrailScreen
// Anomalies tab. The detector Edge Function (detect-audit-anomalies)
// writes rows; this hook reads them, sorted unreviewed-first then by
// recency, and exposes a markReviewed() mutation that stamps
// reviewed_at / reviewed_by via the RLS-gated admin UPDATE policy
// from migration 163.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type AnomalyType =
  | "failed_login_burst"
  | "profile_churn"
  | "admin_ban_burst";

export type AnomalySeverity = "low" | "medium" | "high";

export type AuditAnomaly = {
  id: string;
  detected_at: string;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  related_audit_ids: string[];
  signature: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_note: string | null;
};

const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function useAuditAnomalies() {
  const [anomalies, setAnomalies] = useState<AuditAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("audit_anomalies")
      .select(
        "id, detected_at, anomaly_type, severity, description, related_audit_ids, signature, reviewed_at, reviewed_by, reviewed_note",
      )
      .order("detected_at", { ascending: false })
      .limit(500);
    if (e) {
      setError(e.message);
      return;
    }
    const rows = (data ?? []) as AuditAnomaly[];
    // Unreviewed first, then by severity (high → low), then by detected_at desc.
    rows.sort((a, b) => {
      const ar = a.reviewed_at ? 1 : 0;
      const br = b.reviewed_at ? 1 : 0;
      if (ar !== br) return ar - br;
      const as = SEVERITY_RANK[a.severity] ?? 99;
      const bs = SEVERITY_RANK[b.severity] ?? 99;
      if (as !== bs) return as - bs;
      return b.detected_at.localeCompare(a.detected_at);
    });
    setAnomalies(rows);
    setError(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const markReviewed = useCallback(
    async (id: string, note?: string) => {
      const { data: who } = await supabase.auth.getUser();
      const userId = who?.user?.id ?? null;
      const { error: e } = await supabase
        .from("audit_anomalies")
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewed_note: note ?? null,
        })
        .eq("id", id);
      if (e) {
        setError(e.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  return { anomalies, loading, error, refresh, markReviewed };
}
