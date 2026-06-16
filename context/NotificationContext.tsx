import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform, AppState, AppStateStatus } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import Constants from "expo-constants";

// =============================================================================
// TYPES
// =============================================================================

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  read_at?: string;
  created_at: string;
  action_url?: string;
  image_url?: string;
  category?: string;
  priority?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  push_payments: boolean;
  push_payouts: boolean;
  push_circles: boolean;
  push_loans: boolean;
  push_reminders: boolean;
  push_security: boolean;
  push_marketing: boolean;
  push_system: boolean;
  email_payments: boolean;
  email_payouts: boolean;
  email_circles: boolean;
  email_loans: boolean;
  email_reminders: boolean;
  email_security: boolean;
  email_marketing: boolean;
  email_weekly_digest: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  // P1 (notification-prefs review): "Pause all for 24h" snooze. ISO
  // timestamp; the server-side dispatcher skips push delivery while
  // now() < push_snooze_until.
  push_snooze_until: string | null;
}

type NotificationContextType = {
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNotifications: () => void;

  // Push tokens
  expoPushToken: string | null;
  registerPushToken: () => Promise<string | null>;
  unregisterPushToken: () => Promise<void>;

  // Preferences
  preferences: NotificationPreferences | null;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  fetchPreferences: () => Promise<void>;

  // P1 (notification-prefs review):
  //   snoozePush(hours)  — write push_snooze_until = now()+hours.
  //   resumePush()       — clear push_snooze_until.
  //   sendTestNotification() — fires a local notification immediately
  //     so the user can verify permissions + delivery. Returns
  //     { granted } so the caller can surface a permission-prompt
  //     fallback when the device denies.
  snoozePush: (hours: number) => Promise<void>;
  resumePush: () => Promise<void>;
  sendTestNotification: () => Promise<{ granted: boolean }>;

  // Handlers
  handleNotificationReceived: (notification: Notifications.Notification) => void;
  handleNotificationResponse: (response: Notifications.NotificationResponse) => void;
};

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const defaultPreferences: NotificationPreferences = {
  push_enabled: true,
  email_enabled: true,
  push_payments: true,
  push_payouts: true,
  push_circles: true,
  push_loans: true,
  push_reminders: true,
  push_security: true,
  push_marketing: false,
  push_system: true,
  email_payments: true,
  email_payouts: true,
  email_circles: true,
  email_loans: true,
  email_reminders: true,
  email_security: true,
  email_marketing: false,
  email_weekly_digest: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  quiet_hours_timezone: "UTC",
  push_snooze_until: null,
};

// =============================================================================
// CONFIGURE NOTIFICATION HANDLER
// =============================================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// =============================================================================
// CONTEXT
// =============================================================================

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};

// =============================================================================
// PROVIDER
// =============================================================================

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user, session } = useAuth();

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  // Refs for listeners
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Computed
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ==========================================================================
  // FETCH NOTIFICATIONS FROM DATABASE
  // ==========================================================================

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch notifications");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ==========================================================================
  // MARK NOTIFICATION AS READ
  // ==========================================================================

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );

      try {
        const { error: updateError } = await supabase.rpc("mark_notification_read", {
          p_notification_id: id,
        });

        if (updateError) {
          console.error("Error marking notification as read:", updateError);
          // Revert on error
          await fetchNotifications();
        }
      } catch (err) {
        console.error("Error marking notification as read:", err);
        await fetchNotifications();
      }
    },
    [user, fetchNotifications]
  );

  // ==========================================================================
  // MARK ALL NOTIFICATIONS AS READ
  // ==========================================================================

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
    );

    try {
      const { error: updateError } = await supabase.rpc("mark_all_notifications_read");

      if (updateError) {
        console.error("Error marking all notifications as read:", updateError);
        await fetchNotifications();
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      await fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // ==========================================================================
  // DELETE NOTIFICATION
  // ==========================================================================

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!user) return;

      // P2 (notification-prefs review): capture category BEFORE the
      // optimistic filter wipes the row out of state. The auto-mute
      // EF (process-dismissal-auto-mute) reads from
      // notification_dismissal_log to spot users dismissing the same
      // category repeatedly. Falls back to `type` when the server
      // didn't set an explicit category — anything off the
      // ELIGIBLE_CATEGORIES list in the EF is silently ignored.
      const dismissed = notifications.find((n) => n.id === id);
      const dismissedCategory = dismissed?.category ?? dismissed?.type ?? null;

      // Optimistic update
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      try {
        const { error: deleteError } = await supabase
          .from("notifications")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

        if (deleteError) {
          console.error("Error deleting notification:", deleteError);
          await fetchNotifications();
          return;
        }

        // Log the dismissal AFTER the delete commits. Best-effort —
        // a failure here doesn't block the UI.
        if (dismissedCategory) {
          try {
            await supabase.rpc("record_notification_dismissal", {
              p_user_id: user.id,
              p_category: dismissedCategory,
            });
          } catch (e) {
            console.warn(
              "[NotificationContext] dismissal log skipped:",
              (e as Error).message,
            );
          }
        }
      } catch (err) {
        console.error("Error deleting notification:", err);
        await fetchNotifications();
      }
    },
    [user, fetchNotifications, notifications]
  );

  // ==========================================================================
  // CLEAR ALL NOTIFICATIONS (LOCAL ONLY)
  // ==========================================================================

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // ==========================================================================
  // REGISTER PUSH TOKEN
  // ==========================================================================

  const registerPushToken = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return null;
    }

    if (!user) {
      console.log("User not logged in, skipping push token registration");
      return null;
    }

    try {
      // Check/request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Push notification permission not granted");
        return null;
      }

      // Get the Expo push token
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.log("No EAS projectId found — push tokens unavailable in Expo Go. Use a development build.");
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenData.data;
      setExpoPushToken(token);

      // Register token in database
      const { error: registerError } = await supabase.rpc("register_push_token", {
        p_token: token,
        p_platform: Platform.OS,
        p_device_id: Device.deviceName || undefined,
        p_device_name: Device.modelName || undefined,
        p_app_version: Constants.expoConfig?.version || undefined,
        p_os_version: Device.osVersion || undefined,
      });

      if (registerError) {
        console.error("Error registering push token:", registerError);
      } else {
        console.log("Push token registered successfully");
      }

      // Migration 182: also denormalise the most-recent token onto
      // `profiles.expo_push_token`. The three push-dispatcher Edge
      // Functions (transfer-notification, goal-notification,
      // kyc-approval-notification) read from this column for a
      // single-row JOIN instead of paging through push_tokens. The RPC
      // above still owns the multi-device history table; this is the
      // cheap-read shadow.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ expo_push_token: token })
        .eq("id", user.id);
      if (profileError) {
        console.warn(
          "[NotificationContext] profiles.expo_push_token write failed:",
          profileError.message,
        );
      }

      // Configure Android notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#6366F1",
        });

        await Notifications.setNotificationChannelAsync("payments", {
          name: "Payments",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#10B981",
        });

        await Notifications.setNotificationChannelAsync("circles", {
          name: "Circles",
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: "#6366F1",
        });

        await Notifications.setNotificationChannelAsync("security", {
          name: "Security",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: "#EF4444",
        });
      }

      return token;
    } catch (err) {
      console.error("Error registering push token:", err);
      return null;
    }
  }, [user]);

  // ==========================================================================
  // UNREGISTER PUSH TOKEN
  // ==========================================================================

  const unregisterPushToken = useCallback(async () => {
    if (!expoPushToken) return;

    try {
      const { error: deactivateError } = await supabase.rpc("deactivate_push_token", {
        p_token: expoPushToken,
      });

      if (deactivateError) {
        console.error("Error deactivating push token:", deactivateError);
      }

      setExpoPushToken(null);
    } catch (err) {
      console.error("Error unregistering push token:", err);
    }
  }, [expoPushToken]);

  // ==========================================================================
  // FETCH PREFERENCES
  // ==========================================================================

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      if (data) {
        setPreferences(data);
        // P0 (notification-prefs review): one-shot timezone sync. If
        // the row still has the 'UTC' default and the user's profile
        // carries a real IANA zone (set by AuthContext on first auth
        // — migration 167), copy it over. The dispatcher uses
        // quiet_hours_timezone to compare against the user's clock;
        // a stale 'UTC' here is what makes DND fire at the wrong
        // local times. Best-effort: any error is non-fatal, the
        // user can edit it from the screen anyway.
        if (!data.quiet_hours_timezone || data.quiet_hours_timezone === "UTC") {
          try {
            const { data: profileRow } = await supabase
              .from("profiles")
              .select("timezone")
              .eq("id", user.id)
              .maybeSingle();
            const tz: string | null = profileRow?.timezone ?? null;
            if (tz && tz !== "UTC") {
              const { error: tzErr } = await supabase
                .from("notification_preferences")
                .update({ quiet_hours_timezone: tz })
                .eq("user_id", user.id);
              if (!tzErr) {
                setPreferences((prev) =>
                  prev ? { ...prev, quiet_hours_timezone: tz } : prev,
                );
              }
            }
          } catch (e) {
            console.warn(
              "[NotificationContext] timezone sync skipped:",
              (e as Error).message,
            );
          }
        }
      } else {
        // Create default preferences
        const { data: newPrefs, error: createError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id, ...defaultPreferences })
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (err) {
      console.error("Error fetching notification preferences:", err);
      setPreferences(defaultPreferences);
    }
  }, [user]);

  // ==========================================================================
  // UPDATE PREFERENCES
  // ==========================================================================

  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>) => {
      if (!user) return;

      // Optimistic update
      setPreferences((prev) => (prev ? { ...prev, ...prefs } : null));

      try {
        const { error: updateError } = await supabase
          .from("notification_preferences")
          .update(prefs)
          .eq("user_id", user.id);

        if (updateError) {
          console.error("Error updating preferences:", updateError);
          await fetchPreferences();
        }
      } catch (err) {
        console.error("Error updating preferences:", err);
        await fetchPreferences();
      }
    },
    [user, fetchPreferences]
  );

  // ==========================================================================
  // P1 (notification-prefs review): SNOOZE + TEST
  // ==========================================================================

  // Set push_snooze_until = now() + hours. Server-side dispatcher
  // gates push delivery against this column; client just persists.
  const snoozePush = useCallback(
    async (hours: number) => {
      const until = new Date(Date.now() + hours * 3_600_000).toISOString();
      await updatePreferences({ push_snooze_until: until });
    },
    [updatePreferences],
  );

  // Clear push_snooze_until.
  const resumePush = useCallback(async () => {
    await updatePreferences({ push_snooze_until: null });
  }, [updatePreferences]);

  // Fire a LOCAL notification (no server hop) so the user can verify
  // permissions + delivery. trigger=null = "immediately". Returns
  // { granted } so the caller can route to system settings if the OS
  // has notifications blocked.
  const sendTestNotification = useCallback(async (): Promise<{
    granted: boolean;
  }> => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      return { granted: false };
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "TandaXn",
        body: "Test notification — looks good!",
        data: { test: true },
      },
      trigger: null,
    });
    return { granted: true };
  }, []);

  // ==========================================================================
  // NOTIFICATION HANDLERS
  // ==========================================================================

  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      console.log("Notification received:", notification);

      // Add to local state
      const notificationData = notification.request.content.data as Record<string, unknown>;

      const newNotification: Notification = {
        id: notificationData?.notification_id as string || notification.request.identifier,
        type: (notificationData?.type as string) || "system",
        title: notification.request.content.title || "",
        body: notification.request.content.body || "",
        data: notificationData,
        read: false,
        created_at: new Date().toISOString(),
        category: notificationData?.category as string,
      };

      setNotifications((prev) => [newNotification, ...prev]);
    },
    []
  );

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      console.log("Notification tapped:", response);

      const data = response.notification.request.content.data as Record<string, unknown>;

      // Mark as read
      if (data?.notification_id) {
        markAsRead(data.notification_id as string);
      }

      // Handle deep linking based on action_url or category
      // This would typically navigate to the appropriate screen
      // The navigation logic should be handled by the NavigationContainer
    },
    [markAsRead]
  );

  // ==========================================================================
  // REAL-TIME SUBSCRIPTION
  // ==========================================================================

  useEffect(() => {
    if (!user) return;

    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // ==========================================================================
  // SETUP NOTIFICATION LISTENERS
  // ==========================================================================

  useEffect(() => {
    // Listen for notifications when app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  // ==========================================================================
  // APP STATE HANDLER (refresh on foreground)
  // ==========================================================================

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        // App has come to the foreground
        if (user) {
          fetchNotifications();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user, fetchNotifications]);

  // ==========================================================================
  // INITIAL DATA FETCH
  // ==========================================================================

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPreferences();
      registerPushToken();
    } else {
      // Clear data on logout
      setNotifications([]);
      setPreferences(null);
      setExpoPushToken(null);
    }
  }, [user, fetchNotifications, fetchPreferences, registerPushToken]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearNotifications,
        expoPushToken,
        registerPushToken,
        unregisterPushToken,
        preferences,
        updatePreferences,
        fetchPreferences,
        snoozePush,
        resumePush,
        sendTestNotification,
        handleNotificationReceived,
        handleNotificationResponse,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
