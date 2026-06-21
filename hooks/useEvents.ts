// ══════════════════════════════════════════════════════════════════════════════
// hooks/useEvents.ts — community_events read queries + cache.
// ══════════════════════════════════════════════════════════════════════════════
//
// Backs EventsScreen (full list) and CommunityTabScreen teaser (first item
// off the same shared list). Both consume `useUpcomingEvents({ limit: 50 })`,
// which is backed by a 5-minute in-memory cache keyed by userId so the two
// surfaces share one round-trip.
//
// Writes — insert + flyer upload — live inline in CreateEventScreen so the
// optimistic-insert-then-background-upload flow can navigate away as soon
// as the row lands. `invalidateUpcomingEventsCache()` (exported below) is
// the contract between CreateEventScreen and this hook's cache.
//
// Migration: supabase/migrations/137_community_events.sql.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// P2 (migration 158) — bounded category set. Kept in sync with the
// community_events_category_chk CHECK constraint.
export type EventCategory =
  | "birthday"
  | "wedding"
  | "concert"
  | "community"
  | "business"
  | "other";

export const EVENT_CATEGORIES: EventCategory[] = [
  "birthday",
  "wedding",
  "concert",
  "community",
  "business",
  "other",
];

export type CommunityEventRow = {
  id: string;
  user_id: string;
  title: string;
  event_datetime: string; // ISO 8601 timestamptz
  location_name: string;
  // Bucket A of Create-an-event review (migration 222) dropped NOT NULL.
  // Pre-migration rows always have a value (the screen previously fell
  // back to location_name); post-migration rows may be null when the
  // user leaves "Full address" empty in the More-details disclosure.
  full_address: string | null;
  price: number | null;
  price_description: string | null;
  description: string;
  image_url: string | null;
  contact_info: ContactInfo | null;
  age_range: string | null;
  prizes: string | null;
  presented_by: string | null;
  created_at: string;
  // P2 (migration 158)
  category: EventCategory | null;
  // Browse-events Bucket C (migration 224) — engagement counters. The
  // existing-row default is 0 / null per the ADD COLUMN definition, so
  // these are safe to read against pre-224 data via maybeSingle.
  view_count: number;
  last_viewed_at: string | null;
};

export type ContactInfo = {
  phone?: string;
  email?: string;
  ticket_link?: string;
};

export type CreateEventInput = {
  title: string;
  event_datetime: string;
  location_name: string;
  full_address: string | null;
  price: number | null;
  price_description: string | null;
  description: string;
  contact_info: ContactInfo | null;
  age_range: string | null;
  prizes: string | null;
  presented_by: string | null;
  imageLocalUri?: string;
  // P2 (migration 158): bounded category; nullable to keep existing
  // CreateEventScreen consumers compiling.
  category?: EventCategory | null;
};

// ─── P2 — keyword categoriser ────────────────────────────────────────────────
//
// Hand-rolled keyword map. Called from CreateEventScreen on title blur so
// the user sees their event drop into a category without picking from a
// dropdown. They can override via the picker — this is a nudge, not a
// gate. Returns null when no keyword matches.
const CATEGORY_KEYWORDS: { kw: string[]; cat: EventCategory }[] = [
  { kw: ["birthday", "bday", "b-day"], cat: "birthday" },
  { kw: ["wedding", "engagement", "anniversary"], cat: "wedding" },
  {
    kw: [
      "concert",
      "live music",
      "show",
      "festival",
      "dj",
      "afrobeat",
      "gig",
    ],
    cat: "concert",
  },
  {
    kw: ["meetup", "potluck", "picnic", "gathering", "fundraiser", "vigil"],
    cat: "community",
  },
  {
    kw: ["sale", "pop-up", "popup", "market", "launch", "workshop", "mixer"],
    cat: "business",
  },
];

export function categoriseFromTitle(title: string): EventCategory | null {
  const haystack = title.toLowerCase();
  if (haystack.trim().length < 3) return null;
  for (const { kw, cat } of CATEGORY_KEYWORDS) {
    if (kw.some((k) => haystack.includes(k))) return cat;
  }
  return null;
}

// ─── P2 — price suggestion wrapper ───────────────────────────────────────────
//
// Returns the median price (dollars) for past same-category events in the
// same location_name. NULL when no comparables exist (the caller hides the
// chip in that case).
export async function suggestEventPrice(
  category: EventCategory,
  location: string,
): Promise<number | null> {
  if (!location || location.trim().length === 0) return null;
  const { data, error } = await supabase.rpc("suggest_event_price", {
    p_category: category,
    p_location: location,
  });
  if (error) {
    console.warn("[useEvents] suggest_event_price failed:", error.message);
    return null;
  }
  if (data === null || data === undefined) return null;
  const n = typeof data === "number" ? data : Number(data);
  return Number.isFinite(n) ? n : null;
}

// ─── List query: upcoming events (event_datetime >= now), ASC ───────────────
//
// 5-minute module-level cache keyed by `${userId}:${limit}` so the
// Community-tab teaser and the full EventsScreen list share one round-trip
// when both pass `{ limit: 50 }`. Mirrors the useAdvanceDashboard /
// useScoreHub pattern. `useFocusEffect` re-fires the loader on screen
// focus; the cache short-circuits if still fresh.

const UPCOMING_EVENTS_TTL_MS = 5 * 60 * 1000;
type UpcomingCacheEntry = {
  key: string;
  data: CommunityEventRow[];
  fetchedAt: number;
};
let upcomingCache: UpcomingCacheEntry | null = null;

function bustUpcomingCache() {
  upcomingCache = null;
}

export function useUpcomingEvents(options?: {
  limit?: number;
  // Browse-events Bucket B.6 — when true, flips the predicate so the
  // hook returns events whose start time is in the past, ordered most
  // recent first. Cache entry is keyed separately so toggling the flag
  // doesn't poison the upcoming-events cache for callers that don't
  // pass it. Default false (preserves existing behaviour).
  showPast?: boolean;
}): {
  events: CommunityEventRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const limit = options?.limit;
  const showPast = options?.showPast === true;
  const cacheKey = `${userId}:${limit ?? "all"}:${showPast ? "past" : "upcoming"}`;

  const seed =
    upcomingCache && upcomingCache.key === cacheKey
      ? upcomingCache.data
      : null;
  const [events, setEvents] = useState<CommunityEventRow[]>(seed ?? []);
  const [loading, setLoading] = useState<boolean>(seed == null);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    // Cache short-circuit: if a fresh entry exists for this key, use it.
    if (
      upcomingCache &&
      upcomingCache.key === cacheKey &&
      Date.now() - upcomingCache.fetchedAt < UPCOMING_EVENTS_TTL_MS
    ) {
      setEvents(upcomingCache.data);
      setLoading(false);
      return;
    }

    setError(null);
    if (!upcomingCache || upcomingCache.key !== cacheKey) {
      setLoading(true);
    }

    const nowIso = new Date().toISOString();
    let query = supabase.from("community_events").select("*");
    if (showPast) {
      query = query
        .lte("event_datetime", nowIso)
        .order("event_datetime", { ascending: false });
    } else {
      query = query
        .gte("event_datetime", nowIso)
        .order("event_datetime", { ascending: true });
    }
    if (typeof limit === "number") query = query.limit(limit);

    const { data, error: qErr } = await query;

    if (qErr) {
      setError(qErr.message);
      setEvents([]);
    } else {
      const fresh = (data as CommunityEventRow[]) ?? [];
      upcomingCache = {
        key: cacheKey,
        data: fresh,
        fetchedAt: Date.now(),
      };
      setEvents(fresh);
    }
    setLoading(false);
  }, [cacheKey, limit, showPast]);

  // Initial fetch on mount (or whenever the cache key changes).
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Refetch on screen focus — keeps the list fresh after the user returns
  // from CreateEventScreen. The cache short-circuit keeps this cheap.
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents]),
  );

  // External refresh (pull-to-refresh) must bypass the cache.
  const refetch = useCallback(async () => {
    bustUpcomingCache();
    await fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch };
}

// Exported so screens that mutate events (createEvent, future deleteEvent)
// can invalidate the cache before navigating back to the list.
export function invalidateUpcomingEventsCache() {
  bustUpcomingCache();
}

// Browse-events Bucket A.3 — single-row fetch used by the deep-link path.
// When the user taps a notification carrying ?eventId=<uuid> the list
// hook may not yet have that row in its 50-item cache (e.g. the event
// is far in the future). This helper hits the DB directly so the sheet
// can still open on cold deep-link entry. No caching layer of its own;
// the caller wires the result straight into setSelectedEvent.
export async function fetchEventById(
  id: string,
): Promise<CommunityEventRow | null> {
  if (!id || typeof id !== "string") return null;
  const { data, error } = await supabase
    .from("community_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[useEvents] fetchEventById failed:", error.message);
    return null;
  }
  return (data as CommunityEventRow) ?? null;
}

// Note: the old `createEvent` + private `uploadFlyerImage` helpers were
// removed in the P1 form-rewrite (CreateEventScreen now performs the
// insert + downscaled background upload inline, since the optimistic
// flow doesn't map cleanly onto the prior "one shot" helper signature).
// The `CreateEventInput` type is retained for any future caller that
// wants a typed payload shape.

// ─── Helpers for UI formatting ──────────────────────────────────────────────
//
// Re-used by EventsScreen and the CommunityTab teaser so date/price rendering
// stays consistent.

export function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// Browse-events Bucket A.7 — compact form for card rows. "Sat 20 Jun" in
// EN, "sam. 20 juin" in FR. The long form above is still used inside the
// bottom-sheet, where the extra width is fine and the year matters.
export function formatEventDateCompact(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

export function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function isEventFree(row: CommunityEventRow): boolean {
  return row.price == null || row.price === 0;
}

// ─── View-event-details Bucket A.3 — Interested / Going hook ─────────────────
//
// Pairs with migration 226 (public.event_interest). Returns the
// authenticated user's status on a single event plus the public count
// of interested + going rows.
//
// Status cycle (matches the toggle UI on EventsScreen's bottom sheet):
//
//     null → 'interested' → 'going' → 'not_going' → null
//
// `null` is represented by row absence — so the final hop deletes
// rather than UPDATEs to a sentinel value. The hook handles all four
// transitions and applies an optimistic delta to the count so the
// "{{count}} people interested" subtitle moves in step with the tap.
//
// On error the optimistic state is reverted to whatever the DB
// returned, and a console warning is logged. RLS does the rest of
// the heavy lifting — no SECURITY DEFINER RPC is needed because the
// public SELECT policy lets any authenticated caller count.

export type EventInterestStatus = "interested" | "going" | "not_going" | null;

const INTERESTED_COUNTED: ReadonlyArray<EventInterestStatus> = [
  "interested",
  "going",
];

function nextStatus(prev: EventInterestStatus): EventInterestStatus {
  switch (prev) {
    case null:
      return "interested";
    case "interested":
      return "going";
    case "going":
      return "not_going";
    case "not_going":
      return null;
  }
}

export function useEventInterest(eventId: string | null | undefined): {
  status: EventInterestStatus;
  count: number;
  loading: boolean;
  cycleStatus: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<EventInterestStatus>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Refetch helper so cycleStatus can reconcile after a write.
  const refresh = useCallback(async () => {
    if (!eventId) {
      setStatus(null);
      setCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Two cheap reads, parallel.
    const [{ data: rows, error: rowsErr }, { count: cnt, error: cntErr }] =
      await Promise.all([
        userId
          ? supabase
              .from("event_interest")
              .select("status")
              .eq("event_id", eventId)
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("event_interest")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .in("status", INTERESTED_COUNTED.filter(Boolean) as string[]),
      ]);
    if (rowsErr) {
      console.warn("[useEventInterest] status read failed:", rowsErr.message);
    }
    if (cntErr) {
      console.warn("[useEventInterest] count read failed:", cntErr.message);
    }
    setStatus(
      (rows && (rows as { status: EventInterestStatus }).status) ?? null,
    );
    setCount(typeof cnt === "number" ? cnt : 0);
    setLoading(false);
  }, [eventId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cycleStatus = useCallback(async () => {
    if (!eventId || !userId) return;

    const prev = status;
    const next = nextStatus(prev);

    // Optimistic delta: did the row's "is counted" membership flip?
    const prevCounted = INTERESTED_COUNTED.includes(prev);
    const nextCounted = INTERESTED_COUNTED.includes(next);
    const delta = (nextCounted ? 1 : 0) - (prevCounted ? 1 : 0);
    setStatus(next);
    setCount((c) => Math.max(0, c + delta));

    try {
      if (next === null) {
        const { error } = await supabase
          .from("event_interest")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", userId);
        if (error) throw error;
      } else if (prev === null) {
        const { error } = await supabase
          .from("event_interest")
          .insert({ event_id: eventId, user_id: userId, status: next });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_interest")
          .update({ status: next })
          .eq("event_id", eventId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[useEventInterest] cycle failed:", message);
      // Reconcile against the DB so the UI doesn't drift.
      await refresh();
    }
  }, [eventId, userId, status, refresh]);

  return { status, count, loading, cycleStatus };
}
