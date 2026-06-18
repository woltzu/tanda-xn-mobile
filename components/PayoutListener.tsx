// ══════════════════════════════════════════════════════════════════════════════
// PayoutListener — no-render component mounted at the root that
// subscribes to `circle_payouts` INSERTs filtered by the current
// user's id. When a row lands with status='completed', it routes the
// user to the PayoutReceived modal.
//
// Coverage map:
//   - Foreground app  → realtime channel fires, this component opens
//                       the modal directly.
//   - Background app  → push notification (from the notify_payout_received
//                       trigger, migration 188) wakes the OS; the user
//                       taps it; NotificationContext's tap router opens
//                       the same modal. This component never runs in
//                       that path.
//   - Cold start      → if there's an unread payout_received notification
//                       waiting in the inbox when the app opens, the
//                       Notifications inbox UI is the source of truth;
//                       this component intentionally doesn't backfill
//                       (would double-open every cold start).
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { navigationRef } from "../lib/navigation";

export default function PayoutListener() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`payout-listener:${user.id}`)
      .on(
        // supabase-js v2 narrows postgres_changes via a string-literal
        // overload that the channel-builder type doesn't expose, hence the cast.
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "circle_payouts",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload: { new?: Record<string, any> }) => {
          const row = payload?.new;
          if (!row) return;
          if (row.status !== "completed") return;

          // Open the modal. navigationRef may not be ready in rare
          // edge cases (cold start before NavigationContainer mounts);
          // skip silently if so — the push notification covers the
          // user-perceptible side, and the user can find the row in
          // the activity feed.
          if (!navigationRef.isReady()) return;
          navigationRef.navigate("PayoutReceived", {
            payoutId: String(row.id),
            circleId: String(row.circle_id),
            amount: Number(row.amount ?? 0),
            currency: row.currency ?? "USD",
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
