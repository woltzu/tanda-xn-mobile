// hooks/useCircleNotificationMute.ts
// ─────────────────────────────────────────────────────────────────────────────
// P2 of the Notification preferences review. Read/write the
// circle_notification_overrides row for (current user, circleId).
//
// Shape:
//   mutedUntil   string | null  — ISO timestamp; null means "muted forever".
//                                 undefined-equivalent: no row exists yet.
//   isMuted      boolean         — true when there's a row AND
//                                 (mutedUntil is null OR > now()).
//   mute(durationDays?)         — upserts the row. Pass null for
//                                 forever; otherwise mute for N days.
//   unmute()                     — deletes the row.
//
// Cache: module-scope, 60-second TTL keyed by `${userId}:${circleId}`.
// Mirrors useCircleAutopayConfig pattern.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type OverrideRow = {
  id: string;
  user_id: string;
  circle_id: string;
  muted_until: string | null;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<
  string,
  { value: OverrideRow | null; expiresAt: number }
>();

function cacheKey(userId: string, circleId: string): string {
  return `${userId}:${circleId}`;
}

function bust(userId: string, circleId: string): void {
  cache.delete(cacheKey(userId, circleId));
}

function isCurrentlyMuted(row: OverrideRow | null): boolean {
  if (!row) return false;
  if (row.muted_until === null) return true; // forever
  return new Date(row.muted_until).getTime() > Date.now();
}

export type UseCircleNotificationMuteResult = {
  mutedUntil: string | null | undefined; // undefined = no row
  isMuted: boolean;
  loading: boolean;
  mute: (durationDays: number | null) => Promise<void>;
  unmute: () => Promise<void>;
  refetch: () => Promise<void>;
};

export function useCircleNotificationMute(
  circleId: string | null,
): UseCircleNotificationMuteResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = userId && circleId ? cacheKey(userId, circleId) : null;
  const hit = key ? cache.get(key) : undefined;

  const [row, setRow] = useState<OverrideRow | null>(
    hit && hit.expiresAt > Date.now() ? hit.value : null,
  );
  const [loading, setLoading] = useState<boolean>(
    !(hit && hit.expiresAt > Date.now()),
  );

  const fetchOnce = useCallback(
    async (forUserId: string, forCircleId: string, opts?: { bypass?: boolean }) => {
      const k = cacheKey(forUserId, forCircleId);
      if (!opts?.bypass) {
        const h = cache.get(k);
        if (h && h.expiresAt > Date.now()) {
          setRow(h.value);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("circle_notification_overrides")
        .select("id, user_id, circle_id, muted_until")
        .eq("user_id", forUserId)
        .eq("circle_id", forCircleId)
        .maybeSingle();
      if (error) {
        console.warn(
          "[useCircleNotificationMute] read failed:",
          error.message,
        );
        setRow(null);
      } else {
        const value = (data as OverrideRow | null) ?? null;
        cache.set(k, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        setRow(value);
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!userId || !circleId) {
      setRow(null);
      setLoading(false);
      return;
    }
    fetchOnce(userId, circleId);
  }, [userId, circleId, fetchOnce]);

  const mute = useCallback(
    async (durationDays: number | null) => {
      if (!userId || !circleId) return;
      const mutedUntil =
        durationDays === null
          ? null
          : new Date(Date.now() + durationDays * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("circle_notification_overrides")
        .upsert(
          {
            user_id: userId,
            circle_id: circleId,
            muted_until: mutedUntil,
          },
          { onConflict: "user_id,circle_id" },
        )
        .select("id, user_id, circle_id, muted_until")
        .single();
      if (error) throw error;
      const value = data as OverrideRow;
      cache.set(cacheKey(userId, circleId), {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      setRow(value);
    },
    [userId, circleId],
  );

  const unmute = useCallback(async () => {
    if (!userId || !circleId) return;
    const { error } = await supabase
      .from("circle_notification_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("circle_id", circleId);
    if (error) throw error;
    cache.set(cacheKey(userId, circleId), {
      value: null,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    setRow(null);
  }, [userId, circleId]);

  const refetch = useCallback(async () => {
    if (!userId || !circleId) return;
    bust(userId, circleId);
    await fetchOnce(userId, circleId, { bypass: true });
  }, [userId, circleId, fetchOnce]);

  return {
    mutedUntil: row ? row.muted_until : undefined,
    isMuted: isCurrentlyMuted(row),
    loading,
    mute,
    unmute,
    refetch,
  };
}
