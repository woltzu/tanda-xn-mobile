// =============================================================================
// syncstream-reaper-cron -- Edge Function (Deno runtime)
//
// Hourly companion to the two reaper RPCs defined in migration 126.
// Runs at :30 of every hour (schedule lives in the migration).
//
// Each invocation:
//   1. Call clean_stale_room_members()   -- evict stale presence rows
//      (default 10-minute window matches the screen's 30-second
//      heartbeat).
//   2. Call deactivate_inactive_rooms()  -- flip is_active=false on
//      rooms whose last_active is older than 2 hours.
//   3. Write a single cron_job_logs row carrying both results in
//      details. status = 'failed' only if the RPC itself throws;
//      otherwise 'success'. (A zero-removed run is still 'success' --
//      that's the steady state.)
//
// Order matters: members first, then rooms. Removing the last member
// of a room doesn't itself flip is_active (the SyncRoomScreen's
// leave_sync_room RPC does that, but the reaper's DELETE bypasses
// that path). The room-deactivation step still catches it because
// the room's last_active stops being bumped once nobody is there to
// heartbeat.
//
// Deploy: supabase functions deploy syncstream-reaper-cron --no-verify-jwt
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "syncstream-reaper-cron";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    // Step 1: stale presence rows.
    const { data: membersResult, error: membersErr } = await supabase.rpc(
      "clean_stale_room_members",
    );
    if (membersErr) throw new Error(`clean_stale_room_members: ${membersErr.message}`);

    // Step 2: inactive rooms.
    const { data: roomsResult, error: roomsErr } = await supabase.rpc(
      "deactivate_inactive_rooms",
    );
    if (roomsErr) throw new Error(`deactivate_inactive_rooms: ${roomsErr.message}`);

    const members = (membersResult ?? {}) as Record<string, unknown>;
    const rooms = (roomsResult ?? {}) as Record<string, unknown>;

    const removedCount = Number(members.removed_count ?? 0);
    const deactivatedCount = Number(rooms.deactivated_count ?? 0);

    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status: "success",
      // records_processed = the total work surface this run touched.
      // succeeded/failed split is meaningless here (these RPCs don't
      // have a per-row failure path) so we lump everything as succeeded.
      records_processed: removedCount + deactivatedCount,
      records_succeeded: removedCount + deactivatedCount,
      records_failed: 0,
      execution_time_ms: Date.now() - startTime,
      details: {
        members_removed: removedCount,
        votes_dropped: Number(members.votes_dropped ?? 0),
        rooms_deactivated: deactivatedCount,
        members_cutoff: members.cutoff,
        rooms_cutoff: rooms.cutoff,
      },
      error_message: null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobName: JOB_NAME,
        status: "success",
        members,
        rooms,
        runtimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Best-effort fail log so cron-monitor flags us.
    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status: "failed",
      records_processed: 0,
      records_succeeded: 0,
      records_failed: 1,
      execution_time_ms: Date.now() - startTime,
      details: { fatal_error: msg },
      error_message: msg,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
