// ═══════════════════════════════════════════════════════════════════════════
// hooks/useAdminCharts.ts — composite chart data for AdminOverviewScreen
// ═══════════════════════════════════════════════════════════════════════════
//
// Fetches the row-level data needed for all 9 admin charts in one
// Promise.all, then buckets client-side. Pre-launch volumes (<10k
// rows per table) make client-side aggregation cheaper than a fleet of
// per-chart RPCs. Long-term these can move to server-side views.
//
// Bucket size auto-adapts to the range:
//   * 7d   → 7 daily buckets
//   * 30d  → 30 daily buckets
//   * 90d  → 13 weekly buckets
//   * all  → 12 monthly buckets
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type ChartRange = "7d" | "30d" | "90d" | "all";

const PLATFORM_FEE_RATE = 0.02; // matches migration 200 (elder/platform fee)

export interface SeriesPoint {
  label: string;
  value: number;
  iso: string;
}

export interface CategoryPoint {
  key: string;
  label: string;
  value: number;
}

export interface AdminChartData {
  userGrowth: SeriesPoint[]; // cumulative
  dailyActiveUsers: SeriesPoint[];
  circlesCreated: SeriesPoint[];
  circleStatus: CategoryPoint[];
  transactionVolume: SeriesPoint[]; // dollars
  tripRevenue: SeriesPoint[]; // dollars
  platformFee: SeriesPoint[]; // dollars
  disputes: CategoryPoint[];
  kycFunnel: CategoryPoint[];
  // Top-line totals for the summary line under each chart.
  totals: {
    totalUsers: number;
    avgDau: number;
    circlesCreated: number;
    activeCircles: number;
    totalCircles: number;
    transactionVolume: number;
    tripRevenue: number;
    platformFee: number;
    openDisputes: number;
    kycVerified: number;
  };
}

interface Bucket {
  start: Date;
  end: Date;
  label: string;
  iso: string;
}

function buildBuckets(range: ChartRange, anchor: Date): Bucket[] {
  const out: Bucket[] = [];
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const today = startOfDay(anchor);
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(today);
      start.setDate(today.getDate() - i);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      out.push({
        start,
        end,
        label: start.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        iso: start.toISOString().slice(0, 10),
      });
    }
  } else if (range === "90d") {
    // 13 weekly buckets ending today.
    const today = startOfDay(anchor);
    const end = new Date(today);
    end.setDate(today.getDate() + 1);
    for (let i = 12; i >= 0; i--) {
      const bEnd = new Date(end);
      bEnd.setDate(end.getDate() - i * 7);
      const bStart = new Date(bEnd);
      bStart.setDate(bEnd.getDate() - 7);
      out.push({
        start: bStart,
        end: bEnd,
        label: bStart.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        iso: bStart.toISOString().slice(0, 10),
      });
    }
  } else {
    // 12 monthly buckets ending this month.
    const today = startOfDay(anchor);
    for (let i = 11; i >= 0; i--) {
      const bStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const bEnd = new Date(
        today.getFullYear(),
        today.getMonth() - i + 1,
        1,
      );
      out.push({
        start: bStart,
        end: bEnd,
        label: bStart.toLocaleDateString(undefined, {
          month: "short",
          year: "2-digit",
        }),
        iso: bStart.toISOString().slice(0, 10),
      });
    }
  }
  return out;
}

function bucketIndex(buckets: Bucket[], ts: string | null | undefined): number {
  if (!ts) return -1;
  const t = new Date(ts).getTime();
  for (let i = 0; i < buckets.length; i++) {
    if (
      t >= buckets[i].start.getTime() &&
      t < buckets[i].end.getTime()
    ) {
      return i;
    }
  }
  return -1;
}

function makeSeries(
  buckets: Bucket[],
  values: number[],
): SeriesPoint[] {
  return buckets.map((b, i) => ({
    label: b.label,
    iso: b.iso,
    value: values[i] ?? 0,
  }));
}

interface FetchArgs {
  range: ChartRange;
  scopedUserIds: string[] | null;
  scopedCircleIds: string[] | null;
}

async function fetchAll({
  range,
  scopedUserIds,
  scopedCircleIds,
}: FetchArgs): Promise<AdminChartData> {
  const now = new Date();
  const buckets = buildBuckets(range, now);
  const rangeStart = buckets[0].start.toISOString();
  // For cumulative user growth we also need historical totals before rangeStart.

  // ── 1. Profiles for user growth, DAU, KYC funnel ──────────────────────
  const profilesQ = supabase
    .from("profiles")
    .select("id, created_at, last_active_at, kyc_status")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (scopedUserIds) profilesQ.in("id", scopedUserIds);
  const profilesP = profilesQ;

  // ── 2. Circles for creation, status donut ─────────────────────────────
  const circlesQ = supabase
    .from("circles")
    .select("id, status, created_at")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (scopedCircleIds) circlesQ.in("id", scopedCircleIds);
  const circlesP = circlesQ;

  // ── 3. Circle contributions for transaction volume ────────────────────
  const contribsQ = supabase
    .from("circle_contributions")
    .select("amount, created_at, status, circle_id")
    .gte("created_at", rangeStart)
    .limit(10000);
  if (scopedCircleIds) contribsQ.in("circle_id", scopedCircleIds);
  const contribsP = contribsQ;

  // ── 4. Trips + participants for trip revenue ──────────────────────────
  // For trip revenue we use trip_participants.created_at + the joined
  // trip's price_per_person (one booking = one price-per-person worth
  // of revenue, regardless of installments).
  const tripPartsP = supabase
    .from("trip_participants")
    .select("created_at, trips:trip_id(price_per_person)")
    .gte("created_at", rangeStart)
    .limit(10000);

  // ── 5. Trip payments for platform fee ─────────────────────────────────
  const tripPaymentsP = supabase
    .from("trip_payments")
    .select("amount, created_at, status")
    .gte("created_at", rangeStart)
    .eq("status", "succeeded")
    .limit(10000);

  // ── 6. Disputes for resolution pie ────────────────────────────────────
  const disputesP = supabase
    .from("disputes")
    .select("status, created_at")
    .limit(5000);

  const [profilesR, circlesR, contribsR, tripPartsR, tripPaymentsR, disputesR] =
    await Promise.all([
      profilesP,
      circlesP,
      contribsP,
      tripPartsP,
      tripPaymentsP,
      disputesP,
    ]);

  if (profilesR.error) throw new Error(profilesR.error.message);
  if (circlesR.error) throw new Error(circlesR.error.message);
  if (contribsR.error) throw new Error(contribsR.error.message);
  if (tripPartsR.error) throw new Error(tripPartsR.error.message);
  if (tripPaymentsR.error) throw new Error(tripPaymentsR.error.message);
  if (disputesR.error) throw new Error(disputesR.error.message);

  const profiles = (profilesR.data ?? []) as Array<{
    id: string;
    created_at: string | null;
    last_active_at: string | null;
    kyc_status: string | null;
  }>;
  const circles = (circlesR.data ?? []) as Array<{
    id: string;
    status: string | null;
    created_at: string | null;
  }>;
  const contribs = (contribsR.data ?? []) as Array<{
    amount: number | null;
    created_at: string | null;
    status: string | null;
  }>;
  const tripParts = (tripPartsR.data ?? []) as Array<{
    created_at: string | null;
    trips: { price_per_person: number | null } | null;
  }>;
  const tripPayments = (tripPaymentsR.data ?? []) as Array<{
    amount: number | null;
    created_at: string | null;
  }>;
  const disputes = (disputesR.data ?? []) as Array<{
    status: string | null;
    created_at: string | null;
  }>;

  // ─── User growth (cumulative): count profiles created on/before each
  // bucket end. ─────────────────────────────────────────────────────────
  const userGrowthValues = buckets.map((b) => {
    const end = b.end.getTime();
    return profiles.filter(
      (p) => p.created_at && new Date(p.created_at).getTime() < end,
    ).length;
  });

  // ─── DAU: profiles whose last_active_at falls into the bucket. ────────
  const dauValues = new Array(buckets.length).fill(0);
  profiles.forEach((p) => {
    const idx = bucketIndex(buckets, p.last_active_at);
    if (idx >= 0) dauValues[idx] += 1;
  });

  // ─── Circles created per bucket. ──────────────────────────────────────
  const circlesValues = new Array(buckets.length).fill(0);
  circles.forEach((c) => {
    const idx = bucketIndex(buckets, c.created_at);
    if (idx >= 0) circlesValues[idx] += 1;
  });

  // ─── Circle status donut (all circles). ───────────────────────────────
  const statusColorMap: Record<string, string> = {
    active: "#00C6AE",
    forming: "#60A5FA",
    pending: "#FBBF24",
    paused: "#F59E0B",
    completed: "#10B981",
    cancelled: "#EF4444",
  };
  const statusCounts: Record<string, number> = {};
  circles.forEach((c) => {
    const k = c.status ?? "unknown";
    statusCounts[k] = (statusCounts[k] ?? 0) + 1;
  });
  const circleStatus: CategoryPoint[] = Object.entries(statusCounts)
    .map(([key, value]) => ({ key, label: key, value }))
    .sort((a, b) => b.value - a.value);

  // ─── Transaction volume: sum contribution amounts per bucket. ─────────
  const txValues = new Array(buckets.length).fill(0);
  contribs.forEach((c) => {
    const idx = bucketIndex(buckets, c.created_at);
    if (idx >= 0 && c.status !== "failed" && c.status !== "cancelled") {
      txValues[idx] += Number(c.amount) || 0;
    }
  });

  // ─── Trip revenue: count of participants × trip.price_per_person per
  // bucket. ─────────────────────────────────────────────────────────────
  const tripRevValues = new Array(buckets.length).fill(0);
  tripParts.forEach((p) => {
    const idx = bucketIndex(buckets, p.created_at);
    if (idx >= 0) {
      tripRevValues[idx] += Number(p.trips?.price_per_person) || 0;
    }
  });

  // ─── Platform fee revenue (2% of successful trip payments). ───────────
  const feeValues = new Array(buckets.length).fill(0);
  tripPayments.forEach((p) => {
    const idx = bucketIndex(buckets, p.created_at);
    if (idx >= 0) {
      feeValues[idx] += (Number(p.amount) || 0) * PLATFORM_FEE_RATE;
    }
  });

  // ─── Disputes by status. ──────────────────────────────────────────────
  const disputeColorMap: Record<string, string> = {
    open: "#EF4444",
    investigating: "#FBBF24",
    in_review: "#FBBF24",
    resolved: "#10B981",
    dismissed: "#9CA3AF",
    closed: "#9CA3AF",
  };
  const disputeCounts: Record<string, number> = {};
  disputes.forEach((d) => {
    const k = d.status ?? "unknown";
    disputeCounts[k] = (disputeCounts[k] ?? 0) + 1;
  });
  const disputesData: CategoryPoint[] = Object.entries(disputeCounts)
    .map(([key, value]) => ({ key, label: key, value }))
    .sort((a, b) => b.value - a.value);

  // ─── KYC funnel: profiles by kyc_status, in funnel order. ─────────────
  // Funnel stages: total → started (any kyc_status not 'none') →
  // pending → verified.
  const kycCounts: Record<string, number> = {};
  profiles.forEach((p) => {
    const k = p.kyc_status ?? "none";
    kycCounts[k] = (kycCounts[k] ?? 0) + 1;
  });
  const totalProfiles = profiles.length;
  const started = totalProfiles - (kycCounts["none"] ?? 0);
  const pendingKyc = kycCounts["pending"] ?? 0;
  const verifiedKyc = kycCounts["verified"] ?? 0;
  const kycFunnel: CategoryPoint[] = [
    { key: "total", label: "Profiles", value: totalProfiles },
    { key: "started", label: "Started KYC", value: started },
    { key: "pending", label: "Pending review", value: pendingKyc },
    { key: "verified", label: "Verified", value: verifiedKyc },
  ];

  // Attach colours to categorical sets (UI-only convenience, not part of
  // the CategoryPoint type — kept loose because consumers map them).
  const circleStatusWithColor = circleStatus.map((s) => ({
    ...s,
    color: statusColorMap[s.key] ?? "#9CA3AF",
  })) as any;
  const disputesWithColor = disputesData.map((s) => ({
    ...s,
    color: disputeColorMap[s.key] ?? "#9CA3AF",
  })) as any;

  return {
    userGrowth: makeSeries(buckets, userGrowthValues),
    dailyActiveUsers: makeSeries(buckets, dauValues),
    circlesCreated: makeSeries(buckets, circlesValues),
    circleStatus: circleStatusWithColor,
    transactionVolume: makeSeries(buckets, txValues),
    tripRevenue: makeSeries(buckets, tripRevValues),
    platformFee: makeSeries(buckets, feeValues),
    disputes: disputesWithColor,
    kycFunnel,
    totals: {
      totalUsers: totalProfiles,
      avgDau: Math.round(
        dauValues.reduce((s, v) => s + v, 0) / Math.max(buckets.length, 1),
      ),
      circlesCreated: circlesValues.reduce((s, v) => s + v, 0),
      activeCircles: statusCounts["active"] ?? 0,
      totalCircles: circles.length,
      transactionVolume: txValues.reduce((s, v) => s + v, 0),
      tripRevenue: tripRevValues.reduce((s, v) => s + v, 0),
      platformFee: feeValues.reduce((s, v) => s + v, 0),
      openDisputes:
        (disputeCounts["open"] ?? 0) +
        (disputeCounts["investigating"] ?? 0) +
        (disputeCounts["in_review"] ?? 0),
      kycVerified: verifiedKyc,
    },
  };
}

export function useAdminCharts(
  range: ChartRange,
  scope: { scopedUserIds: string[] | null; scopedCircleIds: string[] | null },
) {
  const [data, setData] = useState<AdminChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable string keys for memoization — array refs change on every render
  // even when contents are equal.
  const scopeKey = useMemo(
    () =>
      `${scope.scopedUserIds?.join(",") ?? ""}|${
        scope.scopedCircleIds?.join(",") ?? ""
      }`,
    [scope.scopedUserIds, scope.scopedCircleIds],
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAll({
        range,
        scopedUserIds: scope.scopedUserIds,
        scopedCircleIds: scope.scopedCircleIds,
      });
      setData(next);
    } catch (e) {
      console.warn("[useAdminCharts] fetch failed", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // scope intentionally excluded — scopeKey covers it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, scopeKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
