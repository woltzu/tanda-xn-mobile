import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as ExpoLinking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import {
  useNotifications,
  Notification as NotificationType,
} from "../context/NotificationContext";
import { Routes } from "../lib/routes";
import { useEventTracker } from "../hooks/useEventTracker";
import { showToast } from "../components/Toast";

type NotificationsInboxNavigationProp = StackNavigationProp<RootStackParamList>;

const getNotificationIcon = (type: string): { name: string; color: string; bg: string } => {
  switch (type) {
    case "payment":
      return { name: "wallet", color: "#F59E0B", bg: "#FEF3C7" };
    case "payout":
      return { name: "cash", color: "#10B981", bg: "#D1FAE5" };
    case "circle":
      return { name: "people", color: "#6366F1", bg: "#EEF2FF" };
    case "score":
      return { name: "star", color: "#00C6AE", bg: "#F0FDFB" };
    case "security":
      return { name: "shield-checkmark", color: "#DC2626", bg: "#FEE2E2" };
    case "promo":
      return { name: "gift", color: "#EC4899", bg: "#FCE7F3" };
    // Phase 2 (migration 262) — elder lifecycle notifications.
    case "honor_demotion":
      return { name: "arrow-down-circle", color: "#991B1B", bg: "#FEE2E2" };
    case "elder_promotion":
      return { name: "arrow-up-circle", color: "#166534", bg: "#DCFCE7" };
    default:
      return { name: "notifications", color: "#6B7280", bg: "#F5F7FA" };
  }
};

// Bucket B — relative-time formatter now takes `t` so all output respects
// the active locale. i18next pluralisation (_one / _other) keeps the
// minutes/hours/days strings grammatically correct in FR even though
// the EN abbreviations look identical singular and plural.
type TFn = (key: string, opts?: Record<string, unknown>) => string;

const formatNotificationTime = (dateString: string, t: TFn): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("notifications_inbox.time_just_now");
  if (diffMins < 60)
    return t("notifications_inbox.time_minutes_ago", { count: diffMins });
  if (diffHours < 24)
    return t("notifications_inbox.time_hours_ago", { count: diffHours });
  if (diffDays < 7)
    return t("notifications_inbox.time_days_ago", { count: diffDays });
  return date.toLocaleDateString();
};

export default function NotificationsInboxScreen() {
  const navigation = useNavigation<NotificationsInboxNavigationProp>();
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  // Bucket C — telemetry channel. EventService self-dedupes consecutive
  // same-screen views, so the focus loop below doesn't double-fire if
  // the user briefly leaves and comes back to the same instance.
  const { trackScreenView, track } = useEventTracker();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  // Bucket C — group the filtered list into Today / This week /
  // Earlier sections. Empty sections are omitted so a quiet user
  // doesn't see three empty headers stacked. "Today" = since the
  // start of the local calendar day. "This week" = within the last
  // 7 × 24 h before that boundary. "Earlier" = everything older.
  const sections = (() => {
    if (filteredNotifications.length === 0) return [];
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const weekAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const today: NotificationType[] = [];
    const thisWeek: NotificationType[] = [];
    const earlier: NotificationType[] = [];
    for (const n of filteredNotifications) {
      const ts = new Date(n.created_at).getTime();
      if (ts >= startOfToday) today.push(n);
      else if (ts >= weekAgo) thisWeek.push(n);
      else earlier.push(n);
    }
    const out: Array<{
      key: "today" | "this_week" | "earlier";
      title: string;
      data: NotificationType[];
    }> = [];
    if (today.length > 0)
      out.push({
        key: "today",
        title: t("notifications_inbox.section_today"),
        data: today,
      });
    if (thisWeek.length > 0)
      out.push({
        key: "this_week",
        title: t("notifications_inbox.section_this_week"),
        data: thisWeek,
      });
    if (earlier.length > 0)
      out.push({
        key: "earlier",
        title: t("notifications_inbox.section_earlier"),
        data: earlier,
      });
    return out;
  })();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  // Bucket B — refetch on focus. The NotificationContext realtime
  // subscription covers INSERTs that arrive while the screen is
  // mounted + foregrounded, but read-marks set elsewhere (e.g. a push
  // tap into a Circle detail screen that marks the notification read)
  // don't propagate back unless the user pulls or re-mounts. Focus
  // refetch closes that gap.
  //
  // Bucket C — also emits screen_view + notifications_opened on every
  // focus. Lets us measure whether the bell badge actually drives
  // engagement and how often users return to clear inbox.
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      trackScreenView("Notifications");
      track({
        eventType: "notifications_opened",
        eventCategory: "system",
        eventAction: "opened",
      });
    }, [fetchNotifications, trackScreenView, track]),
  );

  const handleNotificationPress = useCallback(
    (notification: NotificationType) => {
      markAsRead(notification.id);

      // Navigate based on notification type or related entity. Priority:
      //   1. circleId (data or related_entity_type)
      //   2. loan-related
      //   3. security category
      //   4. action_url (Bucket B — real deep-link handling)
      const data = notification.data as Record<string, unknown> | undefined;

      if (data?.circleId || notification.related_entity_type === "circle") {
        const circleId = (data?.circleId as string) || notification.related_entity_id;
        if (circleId) {
          navigation.navigate("CircleDetail", { circleId });
        }
      } else if (notification.type === "loan" || notification.related_entity_type === "loan") {
        const loanId = notification.related_entity_id;
        if (loanId) {
          navigation.navigate("LoanDetails", { loanId });
        }
      } else if (notification.category === "security") {
        navigation.navigate(Routes.SecuritySettings);
      } else if (notification.action_url) {
        // Bucket B — Bug 2 fix: action_url used to just console.log,
        // silently swallowing the tap. Now:
        //   • http/https URLs → external browser via Linking.openURL
        //   • tandaxn:// (or other app schemes) → ExpoLinking.parse to
        //     extract the path, then map to a known in-app route.
        //   • Anything else → console.warn so we have a breadcrumb in
        //     dev tools instead of failing silently.
        const url = notification.action_url;
        if (/^https?:\/\//i.test(url)) {
          Linking.canOpenURL(url)
            .then((supported) => {
              if (supported) return Linking.openURL(url);
              console.warn(
                "[NotificationsInbox] cannot open external URL:",
                url,
              );
              return undefined;
            })
            .catch((e) =>
              console.warn(
                "[NotificationsInbox] openURL failed:",
                (e as Error).message,
              ),
            );
        } else {
          // App deep link — parse and route to a known screen. The
          // mapping mirrors the path patterns in lib/deepLinking.ts so
          // it stays in sync with what React Navigation's linkingConfig
          // already understands at app launch.
          try {
            const parsed = ExpoLinking.parse(url);
            const path = (parsed.path || "").replace(/^\/+/, "");
            const params = (parsed.queryParams ?? {}) as Record<
              string,
              string | undefined
            >;
            const circleMatch = path.match(/^circle\/(.+)$/);
            const postMatch = path.match(/^dreams\/post\/(.+)$/);
            if (circleMatch) {
              navigation.navigate("CircleDetail", { circleId: circleMatch[1] });
            } else if (postMatch) {
              navigation.navigate("PostDetail", { postId: postMatch[1] });
            } else if (path === "wallet") {
              navigation.navigate(Routes.WalletMain);
            } else if (path === "profile") {
              navigation.navigate(Routes.ProfileMain);
            } else if (path === "settings") {
              navigation.navigate(Routes.Settings);
            } else if (path === "goals") {
              navigation.navigate(Routes.GoalsHub);
            } else if (path) {
              console.warn(
                "[NotificationsInbox] unmapped deep-link path:",
                path,
                "params:",
                params,
              );
            }
          } catch (e) {
            console.warn(
              "[NotificationsInbox] failed to parse action_url:",
              url,
              (e as Error).message,
            );
          }
        }
      }
    },
    [markAsRead, navigation]
  );

  // Loading state
  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("screen_headers.notifications")}</Text>
            <View style={styles.settingsButton} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.loadingText}>{t("notifications_inbox.loading")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("screen_headers.notifications")}</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate(Routes.NotificationPrefs)}
          >
            <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bucket B — Filter tabs now translated. The Unread label
            uses a separate _with_count key so French ("Non lus (N)")
            renders with the right spacing rule. */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
              {t("notifications_inbox.filter_all")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === "unread" && styles.filterTabActive]}
            onPress={() => setFilter("unread")}
          >
            <Text style={[styles.filterText, filter === "unread" && styles.filterTextActive]}>
              {unreadCount > 0
                ? t("notifications_inbox.filter_unread_with_count", {
                    count: unreadCount,
                  })
                : t("notifications_inbox.filter_unread")}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Bucket C — SectionList replaces the flat FlatList.
          renderSectionHeader stamps Today / This week / Earlier.
          Each row is wrapped in a Swipeable that reveals a Dismiss
          action; tapping it calls deleteNotification + shows a
          confirmation toast. RefreshControl, ListHeader (Mark-all-
          read), and ListEmpty stay where they were. */}
      <SectionList
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        sections={sections}
        keyExtractor={(notification) => notification.id}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00C6AE"
            colors={["#00C6AE"]}
          />
        }
        ListHeaderComponent={
          unreadCount > 0 ? (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <Ionicons name="checkmark-done" size={18} color="#00C6AE" />
              <Text style={styles.markAllText}>{t("notifications_inbox.btn_mark_all_read")}</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {filter === "unread"
                ? t("notifications_inbox.empty_title_unread")
                : t("notifications_inbox.empty_title_all")}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === "unread"
                ? t("notifications_inbox.empty_body_unread")
                : t("notifications_inbox.empty_body_all")}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item: notification }) => {
          const iconStyle = getNotificationIcon(
            notification.type || notification.category || "system",
          );
          // Bucket C — swipe-left reveals a Dismiss action. Tap calls
          // deleteNotification (already in NotificationContext) +
          // toasts. The row removes itself when state updates because
          // the deletion drops the item from `notifications`.
          const renderRightActions = () => (
            <TouchableOpacity
              style={styles.swipeDismissAction}
              onPress={() => {
                deleteNotification(notification.id);
                showToast(t("notifications_inbox.dismissed_toast"), "info");
              }}
              accessibilityRole="button"
              accessibilityLabel={t("notifications_inbox.swipe_dismiss")}
            >
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              <Text style={styles.swipeDismissText}>
                {t("notifications_inbox.swipe_dismiss")}
              </Text>
            </TouchableOpacity>
          );
          return (
            <Swipeable
              renderRightActions={renderRightActions}
              overshootRight={false}
            >
              <TouchableOpacity
                style={[
                  styles.notificationCard,
                  !notification.read && styles.notificationCardUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View
                  style={[styles.notificationIcon, { backgroundColor: iconStyle.bg }]}
                >
                  <Ionicons
                    name={iconStyle.name as any}
                    size={22}
                    color={iconStyle.color}
                  />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    {!notification.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationMessage}>{notification.body}</Text>
                  <View style={styles.notificationFooter}>
                    <Text style={styles.notificationTime}>
                      {formatNotificationTime(notification.created_at, t)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: "#FFFFFF",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  filterTextActive: {
    color: "#0A2342",
  },
  content: {
    flex: 1,
  },
  // FlatList contentContainerStyle. paddingBottom gives the list a
  // breathing-room spacer in place of the old inline <View height: 40 />.
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginBottom: 12,
    paddingRight: 4,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 14,
  },
  notificationCardUnread: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00C6AE",
  },
  notificationMessage: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  // ----- Bucket C — section headers + swipe-to-dismiss action -----
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  swipeDismissAction: {
    width: 88,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 14,
    marginBottom: 10,
    gap: 4,
  },
  swipeDismissText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
