// hooks/useAuditExports.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages the background CSV export queue from PlatformAuditTrailScreen.
//
//   - createJob(filters) enqueues via create_audit_export_job RPC
//     (mig 163, admin-only).
//   - jobs are read straight from audit_export_jobs (own-row + admin-all
//     RLS from mig 163).
//   - Realtime subscription on `notifications` listens for the worker's
//     admin_audit_export_ready notifications and refreshes; this is
//     the low-latency happy path.
//   - 5-second polling kicks in whenever any job is queued or running
//     and unsubscribes once all jobs are terminal. The realtime path
//     is the primary signal; polling is a fallback for the gap between
//     enqueue and the first notification delivery (Edge Function
//     scheduling drift, etc.).
//   - newReadyCount is a session-scoped counter the screen uses to badge
//     the Exports tab; consumers reset it by calling clearNewReady().
//   - getDownloadUrl(file_path) returns a 5-minute signed URL from the
//     private audit-exports bucket created by migration 165.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type AuditExportStatus = "queued" | "running" | "completed" | "failed";

export type AuditExportJob = {
  id: string;
  user_id: string;
  filters: Record<string, unknown>;
  status: AuditExportStatus;
  total_rows: number | null;
  file_path: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const BUCKET = "audit-exports";
const POLL_INTERVAL_MS = 5000;

export function useAuditExports() {
  const [jobs, setJobs] = useState<AuditExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReadyCount, setNewReadyCount] = useState(0);
  const userIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("audit_export_jobs")
      .select(
        "id, user_id, filters, status, total_rows, file_path, error_message, created_at, started_at, completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (e) {
      setError(e.message);
      return;
    }
    setJobs((data ?? []) as AuditExportJob[]);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: who } = await supabase.auth.getUser();
      if (cancelled) return;
      userIdRef.current = who?.user?.id ?? null;
      await refresh();
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Realtime: react to admin_audit_export_ready notifications targeting
  // the current admin. The worker fans these out per job owner.
  useEffect(() => {
    const userId = userIdRef.current;
    if (!userId) return;
    const channel = supabase
      .channel(`audit-exports-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new?: { type?: string } }) => {
          if (payload?.new?.type === "admin_audit_export_ready") {
            setNewReadyCount((n) => n + 1);
            refresh();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // userIdRef populates after the initial fetch; depend on jobs length
    // so the subscription wires up once data lands.
  }, [refresh, jobs.length]);

  // Poll only while something is in-flight. Stops automatically when
  // every job is terminal.
  useEffect(() => {
    const active = jobs.some(
      (j) => j.status === "queued" || j.status === "running",
    );
    if (!active) return;
    const t = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [jobs, refresh]);

  const createJob = useCallback(
    async (filters: Record<string, string>) => {
      const { data, error: e } = await supabase.rpc(
        "create_audit_export_job",
        { p_filters: filters },
      );
      if (e) {
        setError(e.message);
        return null;
      }
      await refresh();
      return (data as string) ?? null;
    },
    [refresh],
  );

  const getDownloadUrl = useCallback(async (filePath: string) => {
    const { data, error: e } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 5);
    if (e) return { url: null, error: e.message };
    return { url: data?.signedUrl ?? null, error: null };
  }, []);

  const clearNewReady = useCallback(() => setNewReadyCount(0), []);

  return {
    jobs,
    loading,
    error,
    newReadyCount,
    refresh,
    createJob,
    getDownloadUrl,
    clearNewReady,
  };
}
