// ═══════════════════════════════════════════════════════════════════════════
// generate-financial-report — Edge Function (Deno runtime)
// ═══════════════════════════════════════════════════════════════════════════
//
// Feature #13: Credit Report Export.
//
// Produces a self-contained HTML "Financial Behavior Report" for the
// authenticated member, covering the last N months (default 12). The
// client then prints the HTML to PDF via expo-print and shares it.
//
// Why HTML, not PDF, server-side: PDF generation in Deno requires
// puppeteer-equivalent binaries (Chromium) that aren't available in the
// supabase functions runtime. expo-print already provides a system PDF
// renderer on iOS/Android/Web — we hand it self-contained HTML with
// inline CSS and it returns a PDF URI we can share.
//
// Auth model:
//   * Caller sends their JWT in the Authorization header (supabase
//     client does this automatically when invoking via supabase.functions.invoke).
//   * EF extracts the JWT, calls supabase.auth.getUser(jwt) to resolve
//     auth.uid(), and uses that as the report target — body.userId is
//     IGNORED (a member cannot generate someone else's report).
//   * If no JWT is present (curl without auth header), the EF refuses
//     with 401.
//
// Deployment:
//   supabase functions deploy generate-financial-report
//   (NOT --no-verify-jwt — this is user-initiated and must reject
//    anonymous requests at the gateway too.)
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmtDate(d: string | Date | null): string {
  if (!d) return "—";
  const dd = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dd.getTime())) return "—";
  return dd.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ── Status mapping for contribution badge in the table ──
const CONTRIB_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: "Paid", color: "#065F46", bg: "#D1FAE5" },
  late: { label: "Late", color: "#92400E", bg: "#FEF3C7" },
  partial: { label: "Partial", color: "#1E40AF", bg: "#DBEAFE" },
  missed: { label: "Missed", color: "#991B1B", bg: "#FEE2E2" },
  pending: { label: "Pending", color: "#374151", bg: "#F3F4F6" },
};

function statusBadge(status: string): string {
  const s = CONTRIB_STATUS_STYLE[status] || {
    label: status,
    color: "#374151",
    bg: "#F3F4F6",
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;color:${s.color};background:${s.bg};">${esc(s.label)}</span>`;
}

// ── HTML builder ─────────────────────────────────────────────────────────

interface ReportInputs {
  memberName: string;
  memberEmail: string | null;
  reportDate: Date;
  windowMonths: number;
  windowStart: Date;

  totalContributions: number;
  totalExpectedCents: number;
  totalPaidCents: number;
  onTimePct: number;
  onTimeCount: number;
  lateCount: number;
  missedCount: number;
  partialCount: number;

  startXnScore: number | null;
  endXnScore: number | null;
  xnScoreTier: string | null;
  paymentStreak: number | null;
  bestStreak: number | null;

  circlesParticipated: number;
  circlesCompleted: number;
  circlesAbandoned: number;
  defaultFreeCircles: number;

  rows: Array<{
    date: string | null;
    circleName: string;
    expectedAmount: number;
    paidAmount: number;
    currency: string;
    status: string;
    daysLate: number;
  }>;
}

function buildHtml(d: ReportInputs): string {
  const reportId = `TXN-${d.reportDate.getTime().toString(36).toUpperCase()}`;

  const summary = `
    <table style="width:100%;border-collapse:separate;border-spacing:12px;margin:0;padding:0;">
      <tr>
        <td style="background:#F8FAFC;border-radius:12px;padding:14px 16px;vertical-align:top;width:25%;">
          <div style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:0.4px;">TOTAL CONTRIBUTIONS</div>
          <div style="font-size:24px;color:#0A2342;font-weight:800;margin-top:4px;">${d.totalContributions}</div>
          <div style="font-size:11px;color:#6B7280;margin-top:2px;">${esc(fmtMoney(d.totalPaidCents / 100))} paid</div>
        </td>
        <td style="background:#F0FDF4;border-radius:12px;padding:14px 16px;vertical-align:top;width:25%;">
          <div style="font-size:11px;color:#15803D;font-weight:600;letter-spacing:0.4px;">ON-TIME RATE</div>
          <div style="font-size:24px;color:#065F46;font-weight:800;margin-top:4px;">${esc(fmtPct(d.onTimePct))}</div>
          <div style="font-size:11px;color:#15803D;margin-top:2px;">${d.onTimeCount} of ${d.totalContributions}</div>
        </td>
        <td style="background:#EFF6FF;border-radius:12px;padding:14px 16px;vertical-align:top;width:25%;">
          <div style="font-size:11px;color:#1D4ED8;font-weight:600;letter-spacing:0.4px;">XNSCORE</div>
          <div style="font-size:24px;color:#1E3A8A;font-weight:800;margin-top:4px;">${d.endXnScore ?? "—"}</div>
          <div style="font-size:11px;color:#1D4ED8;margin-top:2px;">${
            d.startXnScore != null && d.endXnScore != null
              ? `${d.startXnScore > d.endXnScore ? "↓" : d.startXnScore < d.endXnScore ? "↑" : "→"} ${Math.abs(d.endXnScore - d.startXnScore)} over period`
              : esc(d.xnScoreTier || "Current")
          }</div>
        </td>
        <td style="background:#FFFBEB;border-radius:12px;padding:14px 16px;vertical-align:top;width:25%;">
          <div style="font-size:11px;color:#B45309;font-weight:600;letter-spacing:0.4px;">CIRCLES COMPLETED</div>
          <div style="font-size:24px;color:#92400E;font-weight:800;margin-top:4px;">${d.circlesCompleted}</div>
          <div style="font-size:11px;color:#B45309;margin-top:2px;">${d.defaultFreeCircles} default-free</div>
        </td>
      </tr>
    </table>
  `;

  const detailRows = d.rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">${esc(fmtDate(r.date))}</td>
        <td style="padding:10px 12px;font-size:12px;color:#1F2937;font-weight:600;border-bottom:1px solid #F3F4F6;">${esc(r.circleName)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;text-align:right;">${esc(fmtMoney(r.paidAmount, r.currency))}</td>
        <td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;text-align:right;">${esc(fmtMoney(r.expectedAmount, r.currency))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;text-align:right;">${statusBadge(r.status)}${r.daysLate > 0 ? ` <span style="font-size:10px;color:#92400E;margin-left:4px;">${r.daysLate}d</span>` : ""}</td>
      </tr>
    `,
    )
    .join("");

  const noRowsBanner = d.rows.length === 0
    ? `<tr><td colspan="5" style="padding:24px;text-align:center;font-size:13px;color:#6B7280;background:#F9FAFB;">
         No contributions recorded in the last ${d.windowMonths} months.
       </td></tr>`
    : "";

  const streakBadge = (() => {
    if (d.bestStreak == null || d.bestStreak === 0) return "";
    return `
      <div style="margin-top:12px;padding:12px 14px;background:#F0F9FF;border-left:4px solid #0EA5E9;border-radius:8px;">
        <div style="font-size:11px;color:#0369A1;font-weight:700;letter-spacing:0.4px;">PAYMENT STREAKS</div>
        <div style="font-size:13px;color:#0A2342;margin-top:4px;">
          Current streak: <strong>${d.paymentStreak ?? 0}</strong> on-time payments
          &nbsp;·&nbsp;
          Best streak: <strong>${d.bestStreak}</strong>
        </div>
      </div>
    `;
  })();

  const circlesBlock = `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#6B7280;">Circles participated</td>
        <td style="padding:8px 0;font-size:13px;color:#1F2937;font-weight:700;text-align:right;">${d.circlesParticipated}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">Circles completed</td>
        <td style="padding:8px 0;font-size:13px;color:#1F2937;font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${d.circlesCompleted}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">Default-free circles</td>
        <td style="padding:8px 0;font-size:13px;color:#065F46;font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${d.defaultFreeCircles}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">Circles abandoned</td>
        <td style="padding:8px 0;font-size:13px;color:${d.circlesAbandoned > 0 ? "#991B1B" : "#1F2937"};font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${d.circlesAbandoned}</td>
      </tr>
    </table>
  `;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Financial Behavior Report — ${esc(d.memberName)}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1F2937;">
  <div style="max-width:780px;margin:0 auto;background:#FFFFFF;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0A2342 0%,#143654 100%);padding:32px 36px;color:#FFFFFF;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:11px;letter-spacing:1.2px;opacity:0.7;font-weight:600;">TANDAXN</div>
          <div style="font-size:28px;font-weight:800;margin-top:6px;">Financial Behavior Report</div>
          <div style="font-size:13px;opacity:0.85;margin-top:8px;">
            Period: ${esc(fmtDate(d.windowStart))} – ${esc(fmtDate(d.reportDate))}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;opacity:0.7;letter-spacing:0.6px;font-weight:600;">REPORT ID</div>
          <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:14px;font-weight:700;margin-top:4px;">${esc(reportId)}</div>
          <div style="font-size:11px;opacity:0.7;margin-top:6px;">Generated ${esc(fmtDate(d.reportDate))}</div>
        </div>
      </div>
    </div>

    <!-- Member -->
    <div style="padding:24px 36px;border-bottom:1px solid #E5E7EB;">
      <div style="font-size:11px;color:#6B7280;letter-spacing:0.6px;font-weight:600;">MEMBER</div>
      <div style="font-size:20px;color:#0A2342;font-weight:700;margin-top:6px;">${esc(d.memberName)}</div>
      ${d.memberEmail ? `<div style="font-size:13px;color:#6B7280;margin-top:2px;">${esc(d.memberEmail)}</div>` : ""}
    </div>

    <!-- Summary cards -->
    <div style="padding:20px 24px 4px 24px;">
      ${summary}
    </div>

    <!-- Section: contribution behavior -->
    <div style="padding:28px 36px 8px 36px;">
      <div style="font-size:11px;color:#6B7280;letter-spacing:0.6px;font-weight:700;">SECTION 1</div>
      <div style="font-size:18px;color:#0A2342;font-weight:700;margin-top:4px;">Contribution Behavior</div>

      <table style="width:100%;border-collapse:collapse;margin-top:14px;">
        <tr>
          <td style="padding:8px 0;font-size:12px;color:#6B7280;">Total expected</td>
          <td style="padding:8px 0;font-size:13px;color:#1F2937;font-weight:700;text-align:right;">${esc(fmtMoney(d.totalExpectedCents / 100))}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">Total paid</td>
          <td style="padding:8px 0;font-size:13px;color:#1F2937;font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${esc(fmtMoney(d.totalPaidCents / 100))}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">On-time payments</td>
          <td style="padding:8px 0;font-size:13px;color:#065F46;font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${d.onTimeCount} (${esc(fmtPct(d.onTimePct))})</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">Late payments</td>
          <td style="padding:8px 0;font-size:13px;color:${d.lateCount > 0 ? "#92400E" : "#1F2937"};font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${d.lateCount}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">Partial payments</td>
          <td style="padding:8px 0;font-size:13px;color:${d.partialCount > 0 ? "#1E40AF" : "#1F2937"};font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${d.partialCount}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6;">Missed payments</td>
          <td style="padding:8px 0;font-size:13px;color:${d.missedCount > 0 ? "#991B1B" : "#1F2937"};font-weight:700;text-align:right;border-top:1px solid #F3F4F6;">${d.missedCount}</td>
        </tr>
      </table>
      ${streakBadge}
    </div>

    <!-- Section: circles -->
    <div style="padding:28px 36px 8px 36px;">
      <div style="font-size:11px;color:#6B7280;letter-spacing:0.6px;font-weight:700;">SECTION 2</div>
      <div style="font-size:18px;color:#0A2342;font-weight:700;margin-top:4px;">Circle Participation</div>
      ${circlesBlock}
    </div>

    <!-- Section: transactions -->
    <div style="padding:28px 36px 8px 36px;">
      <div style="font-size:11px;color:#6B7280;letter-spacing:0.6px;font-weight:700;">SECTION 3</div>
      <div style="font-size:18px;color:#0A2342;font-weight:700;margin-top:4px;">Transaction History</div>
      <div style="font-size:12px;color:#6B7280;margin-top:4px;">Last ${d.windowMonths} months · ${d.rows.length} record${d.rows.length === 1 ? "" : "s"}</div>

      <table style="width:100%;border-collapse:collapse;margin-top:14px;">
        <thead>
          <tr style="background:#F9FAFB;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;letter-spacing:0.4px;border-bottom:1px solid #E5E7EB;">DATE</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;letter-spacing:0.4px;border-bottom:1px solid #E5E7EB;">CIRCLE</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6B7280;font-weight:700;letter-spacing:0.4px;border-bottom:1px solid #E5E7EB;">PAID</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6B7280;font-weight:700;letter-spacing:0.4px;border-bottom:1px solid #E5E7EB;">EXPECTED</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6B7280;font-weight:700;letter-spacing:0.4px;border-bottom:1px solid #E5E7EB;">STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows}
          ${noRowsBanner}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:32px 36px;margin-top:16px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
      <div style="font-size:11px;color:#6B7280;line-height:18px;">
        <strong style="color:#374151;">Disclaimer.</strong>
        This is not a credit score. It is a behavioural financial report generated by TandaXn
        based on the member's contribution history within the platform.
        It should not be construed as a regulated credit bureau report,
        a guarantee of future behavior, or financial advice. Recipients
        should independently verify any decision made on the basis of this report.
      </div>
      <div style="font-size:10px;color:#9CA3AF;margin-top:16px;text-align:center;">
        © ${d.reportDate.getFullYear()} TandaXn · Report ${esc(reportId)} · Generated ${esc(fmtDate(d.reportDate))}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Main handler ─────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Service-role client for DB reads. User identity verified separately.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Auth — extract user from JWT in Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;

    // Parse body for months window
    let months = 12;
    try {
      const body = await req.json();
      if (typeof body?.months === "number" && body.months > 0 && body.months <= 60) {
        months = Math.floor(body.months);
      }
    } catch {
      // body is optional
    }

    const reportDate = new Date();
    const windowStart = new Date(reportDate);
    windowStart.setMonth(windowStart.getMonth() - months);
    const windowStartIso = windowStart.toISOString();

    // ── Member profile ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, xn_score")
      .eq("id", userId)
      .maybeSingle();

    const memberName = profile?.full_name?.trim() || userEmail || "Member";
    const memberEmail = profile?.email ?? userEmail;

    // ── Contributions in window ──
    const { data: contribsRaw } = await supabase
      .from("cycle_contributions")
      .select(
        "id, circle_id, expected_amount, contributed_amount, contribution_status, was_on_time, days_late, due_date, contributed_at, created_at",
      )
      .eq("user_id", userId)
      .gte("created_at", windowStartIso)
      .order("due_date", { ascending: false });
    const contribs = contribsRaw ?? [];

    // Join circle names
    const circleIds = Array.from(new Set(contribs.map((c) => c.circle_id)));
    const circlesMap = new Map<string, { name: string; currency: string; status: string }>();
    if (circleIds.length > 0) {
      const { data: circles } = await supabase
        .from("circles")
        .select("id, name, currency, status")
        .in("id", circleIds);
      for (const c of (circles ?? []) as any[]) {
        circlesMap.set(c.id, {
          name: c.name,
          currency: c.currency || "USD",
          status: c.status,
        });
      }
    }

    // ── Aggregate ──
    const totalContributions = contribs.length;
    let totalExpectedCents = 0;
    let totalPaidCents = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let missedCount = 0;
    let partialCount = 0;

    for (const c of contribs) {
      const expCents = Math.round(Number(c.expected_amount || 0) * 100);
      const paidCents = Math.round(Number(c.contributed_amount || 0) * 100);
      totalExpectedCents += expCents;
      totalPaidCents += paidCents;
      const st = c.contribution_status;
      if (st === "paid" && (c.was_on_time === true || c.was_on_time === null)) onTimeCount++;
      else if (st === "late" || (c.days_late ?? 0) > 0) lateCount++;
      else if (st === "missed" || st === "defaulted") missedCount++;
      else if (st === "partial") partialCount++;
    }

    const onTimePct = totalContributions > 0
      ? (onTimeCount / totalContributions) * 100
      : 0;

    // ── XnScore + history ──
    const { data: xn } = await supabase
      .from("xn_scores")
      .select(
        "total_score, score_tier, payment_streak, best_payment_streak, circles_participated, full_cycles_completed, circles_abandoned, has_defaults, default_count",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const { data: xnHistoryRaw } = await supabase
      .from("xn_score_history")
      .select("score_before, score_after, created_at")
      .eq("user_id", userId)
      .gte("created_at", windowStartIso)
      .order("created_at", { ascending: true });
    const xnHistory = xnHistoryRaw ?? [];

    const endXnScore = (xn?.total_score ?? profile?.xn_score) ?? null;
    const startXnScore = xnHistory.length > 0
      ? Number(xnHistory[0].score_before)
      : endXnScore;

    const paymentStreak = xn?.payment_streak ?? null;
    const bestStreak = xn?.best_payment_streak ?? null;
    const xnScoreTier = xn?.score_tier ?? null;

    // ── Circles ──
    const { data: memberRowsRaw } = await supabase
      .from("circle_members")
      .select("circle_id, status, has_active_default")
      .eq("user_id", userId);
    const memberRows = memberRowsRaw ?? [];

    let circlesParticipated = memberRows.length;
    let circlesCompleted = 0;
    let circlesAbandoned = 0;
    let defaultFreeCircles = 0;

    if (memberRows.length > 0) {
      const { data: theirCircles } = await supabase
        .from("circles")
        .select("id, status")
        .in("id", memberRows.map((m: any) => m.circle_id));
      const circleStatus = new Map(
        (theirCircles ?? []).map((c: any) => [c.id, c.status]),
      );
      for (const m of memberRows as any[]) {
        const cstatus = circleStatus.get(m.circle_id);
        if (cstatus === "completed" || m.status === "inactive") circlesCompleted++;
        if (m.status === "exited" || m.status === "removed") circlesAbandoned++;
        if (!m.has_active_default) defaultFreeCircles++;
      }
    }

    // Fall back to xn_scores aggregates when our direct counts are zero —
    // matches engine numbers when older circle_members data is gone.
    if (circlesParticipated === 0 && xn) {
      circlesParticipated = Number(xn.circles_participated ?? 0);
      circlesCompleted = Number(xn.full_cycles_completed ?? 0);
      circlesAbandoned = Number(xn.circles_abandoned ?? 0);
    }

    // ── Build row list for the table ──
    const rows = contribs.map((c: any) => {
      const circle = circlesMap.get(c.circle_id) || { name: "Unknown", currency: "USD" };
      return {
        date: c.contributed_at || c.due_date || c.created_at || null,
        circleName: circle.name,
        expectedAmount: Number(c.expected_amount || 0),
        paidAmount: Number(c.contributed_amount || 0),
        currency: circle.currency,
        status: c.contribution_status,
        daysLate: Number(c.days_late ?? 0),
      };
    });

    const html = buildHtml({
      memberName,
      memberEmail,
      reportDate,
      windowMonths: months,
      windowStart,
      totalContributions,
      totalExpectedCents,
      totalPaidCents,
      onTimePct,
      onTimeCount,
      lateCount,
      missedCount,
      partialCount,
      startXnScore,
      endXnScore,
      xnScoreTier,
      paymentStreak,
      bestStreak,
      circlesParticipated,
      circlesCompleted,
      circlesAbandoned,
      defaultFreeCircles,
      rows,
    });

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[generate-financial-report] fatal:", err?.message);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
