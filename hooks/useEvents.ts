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

export function useUpcomingEvents(options?: { limit?: number }): {
  events: CommunityEventRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const limit = options?.limit;
  const cacheKey = `${userId}:${limit ?? "all"}`;

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
    let query = supabase
      .from("community_events")
      .select("*")
      .gte("event_datetime", nowIso)
      .order("event_datetime", { ascending: true });
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
  }, [cacheKey, limit]);

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
