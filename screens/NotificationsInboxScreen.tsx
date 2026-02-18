import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import {
  useNotifications,
  Notification as NotificationType,
} from "../context/NotificationContext";

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
    default:
      return { name: "notifications", color: "#6B7280", bg: "#F5F7FA" };
  }
};

// Helper to format notification time
const formatNotificationTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function NotificationsInboxScreen() {
  const navigation = useNavigation<NotificationsInboxNavigationProp>();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleNotificationPress = useCallback(
    (notification: NotificationType) => {
      markAsRead(notification.id);

      // Navigate based on notification type or related entity
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
        navigation.navigate("SecuritySettings" as any);
      } else if (notification.action_url) {
        // Handle action URL for deep linking
        console.log("Action URL:", notification.action_url);
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
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.settingsButton} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
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
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate("NotificationPrefs" as any)}
          >
            <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === "unread" && styles.filterTabActive]}
            onPress={() => setFilter("unread")}
          >
            <Text style={[styles.filterText, filter === "unread" && styles.filterTextActive]}>
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Mark All as Read */}
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Ionicons name="checkmark-done" size={18} color="#00C6AE" />
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === "unread"
                ? "You're all caught up!"
                : "When you have new activity, it will appear here."}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => {
            const iconStyle = getNotificationIcon(notification.type || notification.category || "system");
            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.notificationCardUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View style={[styles.notificationIcon, { backgroundColor: iconStyle.bg }]}>
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
                      {formatNotificationTime(notification.created_at)}
                    </Text>
                    {notification.action_url && (
                      <TouchableOpacity style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>View</Text>
                        <Ionicons name="chevron-forward" size={14} color="#00C6AE" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    padding: 16,
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
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
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
