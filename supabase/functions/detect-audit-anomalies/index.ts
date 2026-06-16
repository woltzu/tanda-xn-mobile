// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: detect-audit-anomalies
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 07:20 UTC (after the admin-moderation triad).
// Purpose: scan the audit trail surface for three pattern anomalies and
//   stamp matching rows in `audit_anomalies`. High-severity rows also
//   notify every active admin (type='admin_alert', 48h dupe guard).
//
//   Three rules, three data sources:
//     1. failed_login_burst — auth.audit_log_entries (GoTrue's own log).
//        >5 failed logins from one IP in any 10-min bucket → severity high.
//        NOTE: CLAUDE.md flags auth.audit_log_entries as EMPTY today
//        (audit logging not enabled). The rule is here so it produces
//        anomalies the moment the Pro-tier audit log is turned on; for now
//        it logs zero and returns gracefully.
//     2. profile_churn — public.audit_logs WHERE table_name='profiles'.
//        >10 profile UPDATEs by one user in any 1-h bucket → severity medium.
//        The `audit_trigger` on `profiles` (mig 153) already populates this.
//     3. admin_ban_burst — public.moderation_actions.
//        >3 ban/suspend/auto_* actions by one admin in 24h → severity high.
//
// Idempotency: audit_anomalies has UNIQUE(anomaly_type, signature) —
//   upsert(..., ignoreDuplicates: true) skips re-emission across daily runs.
//
// Deployment:
//   supabase functions deploy detect-audit-anomalies --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FAILED_LOGIN_THRESHOLD = 5; // > N triggers
const FAILED_LOGIN_BUCKET_MIN = 10;
const PROFILE_CHURN_THRESHOLD = 10;
const PROFILE_CHURN_BUCKET_MIN = 60;
const ADMIN_BAN_THRESHOLD = 3;
const WINDOW_HOURS = 24;
const DUPE_LOOKBACK_HOURS = 48;

type AnomalyRow = {
  anomaly_type: "failed_login_burst" | "profile_churn" | "admin_ban_burst";
  severity: "low" | "medium" | "high";
  description: string;
  related_audit_ids: string[];
  signature: string;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const started = new Date().toISOString();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const sinceIso = new Date(
      Date.now() - WINDOW_HOURS * 3600 * 1000,
    ).toISOString();
    const sinceDupe = new Date(
      Date.now() - DUPE_LOOKBACK_HOURS * 3600 * 1000,
    ).toISOString();

    const anomalies: AnomalyRow[] = [];

    // ─── Rule 1: failed_login_burst ────────────────────────────────────────
    // GoTrue writes one row per auth event into auth.audit_log_entries.
    // Failed logins land with payload.action='login' and a non-null
    // payload.traits.error_message ('Invalid login credentials' usually).
    // IP comes from payload.traits.remote_ip (when present).
    try {
      const { data: failed, error: feErr } = await supabase
        .schema("auth")
        .from("audit_log_entries")
        .select("id, created_at, payload")
        .gte("created_at", sinceIso)
        .limit(20000);
      if (feErr) throw feErr;

      const byIpBucket = new Map<string, number>();
      for (const row of failed ?? []) {
        const p = (row as { payload: Record<string, unknown> }).payload ?? {};
        const action = (p as { action?: string }).action;
        const traits =
          (p as { traits?: Record<string, unknown> }).traits ?? {};
        const errMsg = (traits as { error_message?: string }).error_message;
        if (action !== "login" || !errMsg) continue;
        const ip = (traits as { remote_ip?: string }).remote_ip ?? "unknown";
        const t = new Date(
          (row as { created_at: string }).created_at,
        );
        const bucket = bucketStart(t, FAILED_LOGIN_BUCKET_MIN);
        const key = `${ip}|${bucket.toISOString()}`;
        byIpBucket.set(key, (byIpBucket.get(key) ?? 0) + 1);
      }
      for (const [key, count] of byIpBucket) {
        if (count <= FAILED_LOGIN_THRESHOLD) continue;
        const [ip, bucketIso] = key.split("|");
        anomalies.push({
          anomaly_type: "failed_login_burst",
          severity: "high",
          description: `${count} failed logins from IP ${ip} in the ${FAILED_LOGIN_BUCKET_MIN}-minute window starting ${bucketIso}.`,
          related_audit_ids: [], // auth.audit_log_entries.id is bigint, not in our UUID surface
          signature: `${ip}|${bucketIso}`,
        });
      }
    } catch (e) {
      console.warn(
        "[detect-audit-anomalies] failed_login_burst rule skipped:",
        e instanceof Error ? e.message : String(e),
      );
    }

    // ─── Rule 2: profile_churn ────────────────────────────────────────────
    {
      const { data: pChanges, error: pErr } = await supabase
        .from("audit_logs")
        .select("id, changed_by, changed_at")
        .eq("table_name", "profiles")
        .eq("action", "UPDATE")
        .gte("changed_at", sinceIso)
        .limit(20000);
      if (pErr) throw pErr;

      type Bucket = { count: number; ids: string[] };
      const byUserBucket = new Map<string, Bucket>();
      for (const row of pChanges ?? []) {
        const userId = (row as { changed_by: string | null }).changed_by;
        if (!userId) continue;
        const t = new Date((row as { changed_at: string }).changed_at);
        const bucket = bucketStart(t, PROFILE_CHURN_BUCKET_MIN);
        const key = `${userId}|${bucket.toISOString()}`;
        const cur = byUserBucket.get(key) ?? { count: 0, ids: [] };
        cur.count++;
        cur.ids.push((row as { id: string }).id);
        byUserBucket.set(key, cur);
      }
      for (const [key, b] of byUserBucket) {
        if (b.count <= PROFILE_CHURN_THRESHOLD) continue;
        const [userId, bucketIso] = key.split("|");
        anomalies.push({
          anomaly_type: "profile_churn",
          severity: "medium",
          description: `User ${userId} updated their profile ${b.count} times in the hour starting ${bucketIso}.`,
          related_audit_ids: b.ids,
          signature: `${userId}|${bucketIso}`,
        });
      }
    }

    // ─── Rule 3: admin_ban_burst ──────────────────────────────────────────
    {
      const { data: actions, error: aErr } = await supabase
        .from("moderation_actions")
        .select("id, admin_user_id, action, created_at")
        .in("action", ["ban", "suspend", "auto_ban", "auto_suspend"])
        .gte("created_at", sinceIso)
        .limit(20000);
      if (aErr) throw aErr;

      type Bucket = { count: number; modActionIds: string[] };
      const byAdminDay = new Map<string, Bucket>();
      for (const row of actions ?? []) {
        const adminId = (row as { admin_user_id: string | null })
          .admin_user_id;
        if (!adminId) continue;
        const t = new Date((row as { created_at: string }).created_at);
        const dayKey = t.toISOString().slice(0, 10); // YYYY-MM-DD
        const key = `${adminId}|${dayKey}`;
        const cur = byAdminDay.get(key) ?? { count: 0, modActionIds: [] };
        cur.count++;
        cur.modActionIds.push((row as { id: string }).id);
        byAdminDay.set(key, cur);
      }

      // For groups above threshold, resolve the audit_logs.id values for
      // those moderation_actions rows so the anomaly carries forensic links.
      for (const [key, b] of byAdminDay) {
        if (b.count <= ADMIN_BAN_THRESHOLD) continue;
        const [adminId, dayKey] = key.split("|");
        let relatedIds: string[] = [];
        try {
          const { data: linked } = await supabase
            .from("audit_logs")
            .select("id, record_id")
            .eq("table_name", "moderation_actions")
            .in("record_id", b.modActionIds)
            .limit(b.modActionIds.length * 3);
          relatedIds = (linked ?? []).map((r: { id: string }) => r.id);
        } catch (_) {
          relatedIds = [];
        }
        anomalies.push({
          anomaly_type: "admin_ban_burst",
          severity: "high",
          description: `Admin ${adminId} performed ${b.count} ban/suspend actions on ${dayKey}.`,
          related_audit_ids: relatedIds,
          signature: `${adminId}|${dayKey}`,
        });
      }
    }

    // ─── Persist ────────────────────────────────────────────────────────────
    let written = 0;
    if (anomalies.length > 0) {
      const { data: upserted, error: uErr } = await supabase
        .from("audit_anomalies")
        .upsert(anomalies, {
          onConflict: "anomaly_type,signature",
          ignoreDuplicates: true,
        })
        .select("id, anomaly_type, severity, signature");
      if (uErr) throw uErr;
      written = (upserted ?? []).length;

      // ─── Admin alerts (high severity, fresh rows only) ────────────────
      const fresh = (upserted ?? []).filter(
        (r: { severity: string }) => r.severity === "high",
      );
      if (fresh.length > 0) {
        const { data: admins } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("is_active", true);
        const adminIds = (admins ?? []).map(
          (a: { user_id: string }) => a.user_id,
        );

        for (const row of fresh) {
          const r = row as {
            id: string;
            anomaly_type: string;
            signature: string;
          };
          for (const adminId of adminIds) {
            const { count: prior } = await supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", adminId)
              .eq("type", "admin_alert")
              .gte("created_at", sinceDupe)
              .contains("data", { anomaly_signature: r.signature });
            if ((prior ?? 0) > 0) continue;

            await supabase.from("notifications").insert({
              user_id: adminId,
              type: "admin_alert",
              title: "Audit anomaly detected",
              body:
                r.anomaly_type === "failed_login_burst"
                  ? "A burst of failed logins was detected from a single IP. Tap to review."
                  : r.anomaly_type === "admin_ban_burst"
                  ? "An admin issued an unusual number of ban/suspend actions today. Tap to review."
                  : "An audit anomaly was detected. Tap to review.",
              data: {
                alert_kind: "audit_anomaly",
                anomaly_id: r.id,
                anomaly_type: r.anomaly_type,
                anomaly_signature: r.signature,
              },
              read: false,
            });
          }
        }
      }
    }

    return ok(started, {
      candidates: anomalies.length,
      written,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[detect-audit-anomalies] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function bucketStart(t: Date, bucketMinutes: number): Date {
  const ms = bucketMinutes * 60 * 1000;
  return new Date(Math.floor(t.getTime() / ms) * ms);
}

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
