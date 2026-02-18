import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import {
  useNotifications,
  NotificationPreferences,
} from "../context/NotificationContext";

type NotificationPrefsNavigationProp = StackNavigationProp<RootStackParamList>;

interface NotificationCategory {
  id: string;
  title: string;
  description: string;
  pushKey: keyof NotificationPreferences;
  emailKey: keyof NotificationPreferences;
}

const CATEGORIES: NotificationCategory[] = [
  {
    id: "payments",
    title: "Payments & Contributions",
    description: "Due dates, confirmations, reminders",
    pushKey: "push_payments",
    emailKey: "email_payments",
  },
  {
    id: "payouts",
    title: "Payouts",
    description: "When you receive money",
    pushKey: "push_payouts",
    emailKey: "email_payouts",
  },
  {
    id: "circles",
    title: "Circle Activity",
    description: "New members, updates, invites",
    pushKey: "push_circles",
    emailKey: "email_circles",
  },
  {
    id: "loans",
    title: "Loan Updates",
    description: "Loan status and payment reminders",
    pushKey: "push_loans",
    emailKey: "email_loans",
  },
  {
    id: "reminders",
    title: "General Reminders",
    description: "Helpful reminders and tips",
    pushKey: "push_reminders",
    emailKey: "email_reminders",
  },
  {
    id: "security",
    title: "Security Alerts",
    description: "Logins, password changes",
    pushKey: "push_security",
    emailKey: "email_security",
  },
  {
    id: "marketing",
    title: "Promotions & Tips",
    description: "Offers and helpful content",
    pushKey: "push_marketing",
    emailKey: "email_marketing",
  },
];

export default function NotificationPrefsScreen() {
  const navigation = useNavigation<NotificationPrefsNavigationProp>();
  const { preferences, updatePreferences, isLoading } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);

  // Get preference value with fallback
  const getValue = useCallback(
    (key: keyof NotificationPreferences): boolean => {
      return (preferences?.[key] as boolean) ?? true;
    },
    [preferences]
  );

  // Handle toggle with database update
  const handleToggle = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      setIsSaving(true);
      try {
        await updatePreferences({ [key]: value });
      } catch (error) {
        console.error("Failed to update preference:", error);
        Alert.alert("Error", "Failed to save preference. Please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences]
  );

  // Loading state
  if (isLoading || !preferences) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </View>
    );
  }

  const masterPush = getValue("push_enabled");
  const masterEmail = getValue("email_enabled");
  const quietHoursEnabled = getValue("quiet_hours_enabled");

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>
                Control how we reach you
              </Text>
            </View>
            {isSaving && (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Master Toggles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Channels</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={[styles.toggleIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="notifications" size={20} color="#DC2626" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>Push Notifications</Text>
                  <Text style={styles.toggleSubtitle}>Instant alerts on your device</Text>
                </View>
                <Switch
                  value={masterPush}
                  onValueChange={(value) => handleToggle("push_enabled", value)}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="mail" size={20} color="#3B82F6" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>Email Notifications</Text>
                  <Text style={styles.toggleSubtitle}>Summaries and updates</Text>
                </View>
                <Switch
                  value={masterEmail}
                  onValueChange={(value) => handleToggle("email_enabled", value)}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Per-Category Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            <View style={styles.card}>
              {CATEGORIES.map((category, index) => {
                const pushValue = getValue(category.pushKey);
                const emailValue = getValue(category.emailKey);

                return (
                  <View
                    key={category.id}
                    style={[
                      styles.categoryItem,
                      index < CATEGORIES.length - 1 && styles.borderBottom,
                    ]}
                  >
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                      <Text style={styles.categoryDescription}>
                        {category.description}
                      </Text>
                    </View>
                    <View style={styles.channelToggles}>
                      <TouchableOpacity
                        style={[
                          styles.channelChip,
                          pushValue && masterPush && styles.channelChipActive,
                          !masterPush && styles.channelChipDisabled,
                        ]}
                        onPress={() =>
                          masterPush && handleToggle(category.pushKey, !pushValue)
                        }
                        disabled={!masterPush || isSaving}
                      >
                        <Ionicons
                          name="notifications-outline"
                          size={14}
                          color={
                            !masterPush
                              ? "#9CA3AF"
                              : pushValue
                              ? "#00C6AE"
                              : "#6B7280"
                          }
                        />
                        <Text
                          style={[
                            styles.channelChipText,
                            pushValue && masterPush && styles.channelChipTextActive,
                            !masterPush && styles.channelChipTextDisabled,
                          ]}
                        >
                          Push
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.channelChip,
                          emailValue && masterEmail && styles.channelChipActive,
                          !masterEmail && styles.channelChipDisabled,
                        ]}
                        onPress={() =>
                          masterEmail && handleToggle(category.emailKey, !emailValue)
                        }
                        disabled={!masterEmail || isSaving}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={14}
                          color={
                            !masterEmail
                              ? "#9CA3AF"
                              : emailValue
                              ? "#00C6AE"
                              : "#6B7280"
                          }
                        />
                        <Text
                          style={[
                            styles.channelChipText,
                            emailValue && masterEmail && styles.channelChipTextActive,
                            !masterEmail && styles.channelChipTextDisabled,
                          ]}
                        >
                          Email
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Email Digest */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email Digest</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="newspaper" size={20} color="#F59E0B" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>Weekly Summary</Text>
                  <Text style={styles.toggleSubtitle}>
                    Get a weekly email with your activity
                  </Text>
                </View>
                <Switch
                  value={getValue("email_weekly_digest")}
                  onValueChange={(value) => handleToggle("email_weekly_digest", value)}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                  disabled={!masterEmail || isSaving}
                />
              </View>
            </View>
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quiet Hours</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={[styles.toggleIcon, { backgroundColor: "#F5F3FF" }]}>
                  <Ionicons name="moon" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>Do Not Disturb</Text>
                  <Text style={styles.toggleSubtitle}>
                    Pause non-urgent notifications
                  </Text>
                </View>
                <Switch
                  value={quietHoursEnabled}
                  onValueChange={(value) => handleToggle("quiet_hours_enabled", value)}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                  disabled={isSaving}
                />
              </View>

              {quietHoursEnabled && (
                <View style={styles.quietHoursInfo}>
                  <View style={styles.quietTimeRow}>
                    <Text style={styles.quietTimeLabel}>From</Text>
                    <View style={styles.quietTimeValue}>
                      <Text style={styles.quietTimeText}>{preferences.quiet_hours_start}</Text>
                    </View>
                  </View>
                  <View style={styles.quietTimeRow}>
                    <Text style={styles.quietTimeLabel}>Until</Text>
                    <View style={styles.quietTimeValue}>
                      <Text style={styles.quietTimeText}>{preferences.quiet_hours_end}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color="#00897B" />
            <Text style={styles.infoText}>
              Security alerts will always be sent regardless of your notification
              preferences to keep your account safe.
            </Text>
          </View>
        </View>
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
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  toggleSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  categoryItem: {
    padding: 14,
  },
  categoryHeader: {
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  categoryDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  channelToggles: {
    flexDirection: "row",
    gap: 8,
  },
  channelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  channelChipActive: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
  },
  channelChipDisabled: {
    opacity: 0.5,
  },
  channelChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  channelChipTextActive: {
    color: "#00C6AE",
  },
  channelChipTextDisabled: {
    color: "#9CA3AF",
  },
  quietHoursInfo: {
    padding: 14,
    flexDirection: "row",
    gap: 20,
  },
  quietTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quietTimeLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  quietTimeValue: {
    backgroundColor: "#F5F7FA",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  quietTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
});
