// ══════════════════════════════════════════════════════════════════════════════
// EVENT SERVICE - User Action Logging & Analytics
// Captures every user action: screen views, button taps, auth events,
// transactions, and more. Fire-and-forget with batch inserts and
// offline resilience.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type EventCategory =
  | 'navigation'
  | 'auth'
  | 'circle'
  | 'wallet'
  | 'loan'
  | 'elder'
  | 'goals'
  | 'community'
  | 'tokens'
  | 'feature_gate'
  | 'lifecycle'
  | 'ui'
  | 'settings'
  | 'onboarding'
  | 'score'
  | 'cross_border';

export type EventOutcome = 'success' | 'failure' | 'abandoned' | 'pending';

export interface TrackEvent {
  eventType: string;
  eventCategory: EventCategory;
  eventAction: string;
  eventLabel?: string;
  eventValue?: Record<string, any>;
  outcome?: EventOutcome;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
}

export interface DeviceInfo {
  platform: string;
  osVersion: string | number;
  appVersion: string;
  screenSize: string;
}

// Internal payload ready for Supabase insert
interface EventPayload {
  user_id: string | null;
  event_type: string;
  event_category: string;
  event_action: string;
  event_label: string | null;
  event_value: Record<string, any> | null;
  session_id: string;
  device_type: string;
  device_info: DeviceInfo;
  outcome: string;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = '@tandaxn_event_queue';
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 5000;    // 5 seconds
const OFFLINE_MAX = 500;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONSECUTIVE_FAILURES = 3;        // Stop retrying after 3 consecutive RLS failures
const BACKOFF_BASE_MS = 10000;             // 10s base backoff after failures

// ═══════════════════════════════════════════════════════════════════════════════
// UUID GENERATOR (lightweight, no external dep)
// ═══════════════════════════════════════════════════════════════════════════════

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class EventService {
  // ─── State ─────────────────────────────────────────────────────────────────
  private buffer: EventPayload[] = [];
  private offlineQueue: EventPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private userId: string | null = null;
  private deviceInfo: DeviceInfo;
  private lastActivityAt: number;
  private isFlushing = false;
  private initialized = false;
  private currentScreenName: string | null = null;

  // ─── Constructor ───────────────────────────────────────────────────────────
  constructor() {
    this.sessionId = generateUUID();
    this.lastActivityAt = Date.now();
    this.deviceInfo = this.getDeviceInfo();
    this.init();
  }

  // ─── Initialization ───────────────────────────────────────────────────────
  private async init(): Promise<void> {
    try {
      await this.loadOfflineQueue();
      this.startFlushTimer();
      this.initialized = true;
    } catch (err) {
      console.warn('[EventService] Init error:', err);
      this.initialized = true; // Continue anyway — don't block app
    }
  }

  // ─── Device Info (collected once) ─────────────────────────────────────────
  private getDeviceInfo(): DeviceInfo {
    const { width, height } = Dimensions.get('window');
    return {
      platform: Platform.OS,
      osVersion: Platform.Version,
      appVersion: Constants.expoConfig?.version || '1.0.0',
      screenSize: `${Math.round(width)}x${Math.round(height)}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set the current user ID. Called by useEventTracker when user changes.
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Start a new session. Called on app open / foregrounding.
   * If last activity was > 30 min ago, generates new sessionId.
   */
  startSession(): void {
    const now = Date.now();
    if (now - this.lastActivityAt > SESSION_TIMEOUT_MS) {
      this.sessionId = generateUUID();
    }
    this.lastActivityAt = now;

    this.track({
      eventType: 'app_open',
      eventCategory: 'lifecycle',
      eventAction: 'start',
      eventLabel: 'session_start',
    });

    this.startFlushTimer();
  }

  /**
   * End the current session. Called on app backgrounding.
   * Flushes buffer and stops timer.
   */
  endSession(): void {
    this.track({
      eventType: 'app_close',
      eventCategory: 'lifecycle',
      eventAction: 'end',
      eventLabel: 'session_end',
    });

    this.flush();
    this.stopFlushTimer();
  }

  /**
   * Fire-and-forget event tracking.
   * Pushes to in-memory buffer synchronously. Never blocks.
   */
  track(event: TrackEvent): void {
    this.lastActivityAt = Date.now();

    const payload: EventPayload = {
      user_id: this.userId,
      event_type: event.eventType,
      event_category: event.eventCategory,
      event_action: event.eventAction,
      event_label: event.eventLabel || null,
      event_value: event.eventValue || null,
      session_id: this.sessionId,
      device_type: Platform.OS,
      device_info: this.deviceInfo,
      outcome: event.outcome || 'success',
      error_code: event.errorCode || null,
      error_message: event.errorMessage || null,
      duration_ms: event.durationMs || null,
      created_at: new Date().toISOString(),
    };

    this.buffer.push(payload);

    // Flush immediately if batch is full
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  // ─── Specialized Trackers ─────────────────────────────────────────────────

  /**
   * Track a screen view. Called automatically by NavigationContainer.onStateChange.
   */
  trackScreenView(screenName: string, params?: Record<string, any>): void {
    // Deduplicate consecutive identical screen views
    if (screenName === this.currentScreenName) return;
    this.currentScreenName = screenName;

    this.track({
      eventType: 'screen_view',
      eventCategory: 'navigation',
      eventAction: 'view',
      eventLabel: screenName,
      eventValue: params,
    });
  }

  /**
   * Track a button tap / UI interaction.
   */
  trackButtonTap(
    buttonId: string,
    screenName: string,
    metadata?: Record<string, any>
  ): void {
    this.track({
      eventType: 'button_tap',
      eventCategory: 'ui',
      eventAction: 'tap',
      eventLabel: buttonId,
      eventValue: { screenName, ...metadata },
    });
  }

  /**
   * Track auth events: login, signup, logout.
   */
  trackAuth(
    action: 'login' | 'signup' | 'logout',
    outcome: EventOutcome,
    method?: string,
    errorDetails?: { code?: string; message?: string }
  ): void {
    this.track({
      eventType: action,
      eventCategory: 'auth',
      eventAction: outcome === 'success' ? 'success' : 'failure',
      eventLabel: method || 'email',
      eventValue: method ? { method } : undefined,
      outcome,
      errorCode: errorDetails?.code,
      errorMessage: errorDetails?.message,
    });
  }

  /**
   * Track financial transactions: wallet send, withdraw, contribution, loan.
   */
  trackTransaction(
    type: string,
    amount: number,
    outcome: EventOutcome,
    details?: Record<string, any>
  ): void {
    this.track({
      eventType: type,
      eventCategory: this.inferCategory(type),
      eventAction: outcome,
      eventLabel: type,
      eventValue: { amount, ...details },
      outcome,
    });
  }

  /**
   * Track a feature gate block event.
   */
  trackFeatureBlocked(
    featureKey: string,
    reasonCode: string,
    progress: number
  ): void {
    this.track({
      eventType: 'feature_blocked',
      eventCategory: 'feature_gate',
      eventAction: 'blocked',
      eventLabel: featureKey,
      eventValue: { reasonCode, progress },
      outcome: 'failure',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH FLUSH ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Flush buffered events to Supabase.
   * Handles offline queue draining automatically.
   */
  private _rlsPaused = false;
  private _rlsResumeAt = 0;

  async flush(): Promise<void> {
    if (this.isFlushing) return;
    if (this.buffer.length === 0 && this.offlineQueue.length === 0) return;

    // Hard pause: if RLS failed, stop ALL flush attempts for a long time
    if (this._rlsPaused) {
      if (Date.now() < this._rlsResumeAt) {
        // Silently drop new buffer events to prevent unbounded growth
        if (this.buffer.length > 50) {
          this.buffer.length = 0;
        }
        return;
      }
      // Resume window — try once
      this._rlsPaused = false;
    }

    this.isFlushing = true;

    try {
      // 1. Drain offline queue first
      if (this.offlineQueue.length > 0) {
        const offlineBatch = this.offlineQueue.splice(0, BATCH_SIZE);
        const { error: offlineError } = await supabase
          .from('user_events')
          .insert(offlineBatch);

        if (offlineError) {
          const isRlsError = offlineError.message?.includes('row-level security')
            || offlineError.message?.includes('permission denied');

          if (isRlsError) {
            // Hard pause — stop everything for 5 minutes
            console.warn('[EventService] RLS error on user_events — pausing all event tracking for 5 min');
            this._rlsPaused = true;
            this._rlsResumeAt = Date.now() + 5 * 60 * 1000;
            this.offlineQueue.length = 0;
            this.buffer.length = 0;
            await this.persistOfflineQueue();
          } else {
            this.offlineQueue.unshift(...offlineBatch);
          }
          this.isFlushing = false;
          return;
        }

        await this.persistOfflineQueue();
      }

      // 2. Flush current buffer
      if (this.buffer.length > 0) {
        const batch = this.buffer.splice(0);

        const { error } = await supabase
          .from('user_events')
          .insert(batch);

        if (error) {
          const isRlsError = error.message?.includes('row-level security')
            || error.message?.includes('permission denied');
          if (isRlsError) {
            console.warn('[EventService] RLS error on user_events — pausing all event tracking for 5 min');
            this._rlsPaused = true;
            this._rlsResumeAt = Date.now() + 5 * 60 * 1000;
            this.offlineQueue.length = 0;
            this.buffer.length = 0;
            await this.persistOfflineQueue();
          } else {
            this.moveToOfflineQueue(batch);
          }
        }
      }
    } catch (err) {
      console.warn('[EventService] Flush error:', err);
      if (this.buffer.length > 0) {
        const failed = this.buffer.splice(0);
        this.moveToOfflineQueue(failed);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OFFLINE QUEUE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Move events to the offline queue (for retry later).
   * Caps at OFFLINE_MAX to prevent unbounded storage.
   */
  private moveToOfflineQueue(events: EventPayload[]): void {
    const remaining = OFFLINE_MAX - this.offlineQueue.length;
    if (remaining <= 0) {
      console.warn('[EventService] Offline queue full, dropping events');
      return;
    }

    const toAdd = events.slice(0, remaining);
    this.offlineQueue.push(...toAdd);
    this.persistOfflineQueue();
  }

  /**
   * Load offline queue from AsyncStorage on startup.
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.offlineQueue = parsed.slice(0, OFFLINE_MAX);
        }
      }
    } catch (err) {
      console.warn('[EventService] Failed to load offline queue:', err);
      this.offlineQueue = [];
    }
  }

  /**
   * Persist offline queue to AsyncStorage.
   */
  private async persistOfflineQueue(): Promise<void> {
    try {
      if (this.offlineQueue.length === 0) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(this.offlineQueue)
        );
      }
    } catch (err) {
      console.warn('[EventService] Failed to persist offline queue:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  private startFlushTimer(): void {
    if (this.flushTimer) return; // Already running
    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Infer event category from event type string.
   */
  private inferCategory(eventType: string): EventCategory {
    if (eventType.startsWith('wallet_') || eventType.includes('withdraw') || eventType.includes('send_money')) return 'wallet';
    if (eventType.startsWith('circle_') || eventType.includes('contribution')) return 'circle';
    if (eventType.startsWith('loan_') || eventType.includes('advance')) return 'loan';
    if (eventType.startsWith('elder_') || eventType.includes('mediat') || eventType.includes('vouch')) return 'elder';
    if (eventType.startsWith('goal_') || eventType.includes('savings')) return 'goals';
    if (eventType.startsWith('community_')) return 'community';
    if (eventType.startsWith('token_')) return 'tokens';
    if (eventType.includes('cross_border') || eventType.includes('international')) return 'cross_border';
    return 'ui';
  }

  /**
   * Get current session ID (for external reference).
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get buffer size (for debugging / monitoring).
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get offline queue size (for debugging / monitoring).
   */
  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  /**
   * Force flush and cleanup (for app shutdown).
   */
  async destroy(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
    await this.persistOfflineQueue();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const eventService = new EventService();
