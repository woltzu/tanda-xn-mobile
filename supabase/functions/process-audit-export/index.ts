// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: process-audit-export
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): every 5 minutes via pg_cron, OR triggered manually
//   right after the screen enqueues a job (HTTP POST with empty body).
//
// Purpose: drain the `audit_export_jobs` queue. For each queued row:
//   1. Atomically claim it via `claim_audit_export_job()` (FOR UPDATE
//      SKIP LOCKED — safe under concurrency).
//   2. Build the CSV via `export_audit_logs_for_job(job_id)` (service-role
//      twin of the inline RPC, defends owner-admin status at build time).
//   3. Upload to the `audit-exports` private bucket at `<job_id>.csv`.
//   4. Mark the job completed (status='completed', file_path, total_rows,
//      completed_at) and post an `admin_audit_export_ready` notification
//      to the job owner so the screen can pop the download chip.
//
//   On error: status='failed', error_message set, completed_at stamped,
//   no notification fan-out.
//
// Caps:
//   - MAX_JOBS_PER_RUN keeps a single invocation from monopolising the
//     worker tier when a flood lands; remaining jobs fall to the next run.
//   - Upstream RPC caps the result set at 200k rows (mig 165).
//
// Deployment:
//   supabase functions deploy process-audit-export --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_JOBS_PER_RUN = 5;
const BUCKET = "audit-exports";

type Job = {
  id: string;
  user_id: string;
  filters: Record<string, unknown>;
  status: string;
  total_rows: number | null;
  file_path: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const started = new Date().toISOString();
  const processed: Array<{ id: string; status: string; rows?: number }> = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      // 1) Atomic claim. RPC returns NULL row when nothing is queued.
      const { data: claimed, error: cErr } = await supabase.rpc(
        "claim_audit_export_job",
      );
      if (cErr) throw cErr;
      const job = claimed as Job | null;
      if (!job || !job.id) break; // queue drained

      try {
        // 2) Build CSV (job-scoped RPC, defends owner admin status).
        const { data: csv, error: eErr } = await supabase.rpc(
          "export_audit_logs_for_job",
          { p_job_id: job.id },
        );
        if (eErr) throw eErr;
        const csvText = (csv as string) ?? "";
        // Header is line 1; data rows are lines 2..N.
        const totalRows = csvText
          ? Math.max(0, csvText.split("\n").length - 1)
          : 0;

        // 3) Upload to private bucket.
        const filePath = `${job.id}.csv`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, new Blob([csvText], { type: "text/csv" }), {
            contentType: "text/csv",
            upsert: true,
          });
        if (upErr) throw upErr;

        // 4) Mark completed + notify owner.
        const completedAt = new Date().toISOString();
        const { error: updErr } = await supabase
          .from("audit_export_jobs")
          .update({
            status: "completed",
            file_path: filePath,
            total_rows: totalRows,
            completed_at: completedAt,
          })
          .eq("id", job.id);
        if (updErr) throw updErr;

        await supabase.from("notifications").insert({
          user_id: job.user_id,
          type: "admin_audit_export_ready",
          title: "Audit export ready",
          body:
            `Your audit export is ready (${totalRows} row${
              totalRows === 1 ? "" : "s"
            }). Tap to download.`,
          data: {
            alert_kind: "audit_export_ready",
            job_id: job.id,
            file_path: filePath,
            total_rows: totalRows,
          },
          read: false,
        });

        processed.push({ id: job.id, status: "completed", rows: totalRows });
      } catch (perJob) {
        const msg =
          perJob instanceof Error ? perJob.message : String(perJob);
        console.error("[process-audit-export] job failed:", job.id, msg);
        // Best-effort failure stamp — separate try so a status write error
        // doesn't blow up the whole batch.
        try {
          await supabase
            .from("audit_export_jobs")
            .update({
              status: "failed",
              error_message: msg.slice(0, 500),
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } catch (_) {
          // already-logged
        }
        processed.push({ id: job.id, status: "failed" });
      }
    }

    return ok(started, { processed_count: processed.length, processed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[process-audit-export] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(started: string, extras: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      ok: true,
      started,
      finished: new Date().toISOString(),
      ...extras,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
