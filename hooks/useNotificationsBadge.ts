// ══════════════════════════════════════════════════════════════════════════════
// hooks/useNotificationsBadge.ts — drives the colored dot on the HomeScreen
// bell icon.
// ══════════════════════════════════════════════════════════════════════════════
//
// Mirrors useScoreHubBadge and useProfileIconBadge so the three top-bar
// icons share a vocabulary: 'critical' / 'attention' / 'none'. Pure read
// of state NotificationContext already maintains — no extra RPC, no new
// subscription. The context's realtime channel + AppState refresh keeps
// the underlying notifications list live; this hook just classifies it.
//
// Urgency rules (highest priority wins):
//   • critical  — at least one unread notification with
//                 category === 'security'. Security covers MFA/login
//                 anomalies, suspicious activity, account recovery —
//                 things the user shouldn't miss even if their inbox
//                 is otherwise busy.
//   • attention — unreadCount > 0 with no security unread.
//   • none      — unreadCount === 0.
//
// Returns:
//   • urgency        — for the dot color + a11y suffix selector
//   • unreadCount    — for the "N unread" a11y string
//   • criticalCount  — surfaced for downstream consumers (e.g. badge
//                       count overlays) even though the bell only flips
//                       red/none on critical's presence.
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { useNotifications } from "../context/NotificationContext";

export type NotificationsUrgency = "critical" | "attention" | "none";

export type NotificationsBadge = {
  urgency: NotificationsUrgency;
  unreadCount: number;
  criticalCount: number;
};

// Notification.category values that should escalate the bell to red.
// Keep the list small and obvious — every entry is a state the user
// shouldn't be allowed to scroll past.
const CRITICAL_CATEGORIES = new Set<string>(["security"]);

export function useNotificationsBadge(): NotificationsBadge {
  const { notifications, unreadCount } = useNotifications();

  return useMemo<NotificationsBadge>(() => {
    let criticalCount = 0;
    for (const n of notifications) {
      if (n.read) continue;
      if (n.category && CRITICAL_CATEGORIES.has(n.category)) {
        criticalCount++;
      }
    }

    let urgency: NotificationsUrgency = "none";
    if (criticalCount > 0) {
      urgency = "critical";
    } else if (unreadCount > 0) {
      urgency = "attention";
    }

    return { urgency, unreadCount, criticalCount };
  }, [notifications, unreadCount]);
}
