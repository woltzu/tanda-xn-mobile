// ══════════════════════════════════════════════════════════════════════════════
// USE EVENT TRACKER - React hook for event tracking with user context
// Thin wrapper around EventService singleton that auto-binds the current user.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { eventService, TrackEvent, EventOutcome } from '../services/EventService';

/**
 * React hook that provides event tracking methods with automatic user binding.
 *
 * @example
 * const { trackButtonTap, trackTransaction } = useEventTracker();
 *
 * <TouchableOpacity onPress={() => {
 *   trackButtonTap('join_circle_btn', 'CircleDetails');
 *   handleJoinCircle();
 * }}>
 *
 * @example
 * const { trackTransaction } = useEventTracker();
 * try {
 *   await sendMoney(amount);
 *   trackTransaction('wallet_send', amount, 'success');
 * } catch (err) {
 *   trackTransaction('wallet_send', amount, 'failure', { error: err.message });
 * }
 */
export function useEventTracker() {
  const { user } = useAuth();

  // Sync user ID to EventService whenever it changes
  useEffect(() => {
    eventService.setUserId(user?.id ?? null);
  }, [user?.id]);

  // Memoize bound methods to prevent unnecessary re-renders
  const tracker = useMemo(() => ({
    /**
     * Generic event tracking. Fire-and-forget.
     */
    track: (event: TrackEvent) => eventService.track(event),

    /**
     * Track a screen view (usually auto-tracked via NavigationContainer).
     */
    trackScreenView: (screenName: string, params?: Record<string, any>) =>
      eventService.trackScreenView(screenName, params),

    /**
     * Track a button tap or UI interaction.
     */
    trackButtonTap: (buttonId: string, screenName: string, metadata?: Record<string, any>) =>
      eventService.trackButtonTap(buttonId, screenName, metadata),

    /**
     * Track auth events: login, signup, logout.
     */
    trackAuth: (
      action: 'login' | 'signup' | 'logout',
      outcome: EventOutcome,
      method?: string,
      errorDetails?: { code?: string; message?: string }
    ) => eventService.trackAuth(action, outcome, method, errorDetails),

    /**
     * Track financial transactions.
     */
    trackTransaction: (
      type: string,
      amount: number,
      outcome: EventOutcome,
      details?: Record<string, any>
    ) => eventService.trackTransaction(type, amount, outcome, details),

    /**
     * Track a feature gate block.
     */
    trackFeatureBlocked: (featureKey: string, reasonCode: string, progress: number) =>
      eventService.trackFeatureBlocked(featureKey, reasonCode, progress),

    /**
     * Get current session ID.
     */
    getSessionId: () => eventService.getSessionId(),
  }), []);

  return tracker;
}
