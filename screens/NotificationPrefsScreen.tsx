import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform as RNPlatform } from "react-native";
import { RootStackParamList } from "../App";
import {
  useNotifications,
  NotificationPreferences,
} from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";

// P2 (autopay review): chip values for the advance-reminder picker.
// Mirrors the row that used to live on AutopaySetupScreen (P1 removed
// it; P2 surfaces it here as a *global* default that cascades to all
// of the user's existing autopay configs on change).
const ADVANCE_REMINDER_OPTIONS = [1, 3, 5, 7];
const ADVANCE_REMINDER_DEFAULT = 3;

type NotificationPrefsNavigationProp = StackNavigationProp<RootStackParamList>;

// P0 (notification-prefs review): titles + descriptions moved to i18n.
// We keep just the id + DB-column wiring here; the screen looks up
// `notification_prefs.cat_${id}_title` and `_desc` at render time so
// language switches reflect without a re-mount.
interface NotificationCategory {
  id: string;
  pushKey: keyof NotificationPreferences;
  emailKey: keyof NotificationPreferences;
}

const CATEGORIES: NotificationCategory[] = [
  { id: "payments",  pushKey: "push_payments",  emailKey: "email_payments"  },
  { id: "payouts",   pushKey: "push_payouts",   emailKey: "email_payouts"   },
  { id: "circles",   pushKey: "push_circles",   emailKey: "email_circles"   },
  { id: "loans",     pushKey: "push_loans",     emailKey: "email_loans"     },
  { id: "reminders", pushKey: "push_reminders", emailKey: "email_reminders" },
  { id: "security",  pushKey: "push_security",  emailKey: "email_security"  },
  { id: "marketing", pushKey: "push_marketing", emailKey: "email_marketing" },
];

// P1 (notification-prefs review): logical groupings. Renders one
// section per group with its own title + description so the user
// has 3 chunks of 1–4 categories instead of one flat list of 7.
const CATEGORY_GROUPS: Array<{ id: string; ids: string[] }> = [
  { id: "money",     ids: ["payments", "payouts", "circles", "loans"] },
  { id: "app",       ids: ["reminders", "security"] },
  { id: "marketing", ids: ["marketing"] },
];

// P0 (notification-prefs review): "HH:MM" / "HH:MM:SS" → Date helpers
// for the time picker. The DB stores TIME WITHOUT TIME ZONE; we parse
// to a Date anchored at today so DateTimePicker can render, then format
// the picked Date back to "HH:MM:SS" before sending to the column.
function parseTimeToDate(value: string | null | undefined): Date {
  const d = new Date();
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) {
    const [hStr, mStr] = value.split(":");
    d.setHours(Number(hStr) || 0, Number(mStr) || 0, 0, 0);
  }
  return d;
}

function formatDateToTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function formatTimeDisplay(value: string | null | undefined): string {
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5); // strip seconds
  }
  return "--:--";
}

// P1 (notification-prefs review): countdown formatter for the
// "Pause all for 24h" chip. Returns "Xh Ym" or "Xm" if < 1h.
function formatRemaining(untilIso: string | null | undefined): string | null {
  if (!untilIso) return null;
  const ms = new Date(untilIso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }
  return `${totalMin}m`;
}

// P2 (autopay review): chip styles for the Advance reminders picker.
// Defined as a separate StyleSheet so the existing `styles` object
// stays readable without a big diff at the bottom of the file.
const advanceChipStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  chipSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
  },
  chipValue: { fontSize: 15, fontWeight: "700", color: "#0A2342" },
  chipValueSelected: { color: "#00897B" },
  chipUnit: { fontSize: 10, color: "#6B7280", marginTop: 1 },
  chipUnitSelected: { color: "#00897B" },
});

export default function NotificationPrefsScreen() {
  const navigation = useNavigation<NotificationPrefsNavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    preferences,
    updatePreferences,
    isLoading,
    snoozePush,
    resumePush,
    sendTestNotification,
  } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);
  // P1 (notification-prefs review): which category's example is open.
  // null = all collapsed.
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  // P1: re-render once a minute to keep the snooze countdown fresh
  // without re-firing other effects.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  // Read here so JSX both keys on `nowTick` (silences eslint) and on
  // the persisted preference snapshot.
  const snoozeRemainingLabel = (() => {
    void nowTick;
    return formatRemaining(preferences?.push_snooze_until);
  })();
  const isSnoozed = !!snoozeRemainingLabel;

  // P2 (autopay review): user_preferences.advance_reminder_days. Lives
  // on a different table from the NotificationContext's per-channel
  // toggles, so we manage it locally rather than threading it through
  // the context. Cascades to loan_autopay_configs on change.
  const [advanceReminderDays, setAdvanceReminderDays] = useState<number>(
    ADVANCE_REMINDER_DEFAULT,
  );

  // P0 (notification-prefs review): time-picker visibility flags.
  // DateTimePicker renders inline on iOS and as a system dialog on
  // Android — same `mode='time'` API, just different UX. We toggle
  // showStartPicker / showEndPicker independently.
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // P0 (notification-prefs review): persist a quiet-hours edit. Caller
  // passes which side changed; we validate (start !== end) and write
  // through updatePreferences for the optimistic UI + DB hit.
  // P1 — send-test handler. Falls back to a "go to settings" toast
  // when the OS has push permissions disabled — keeps the user one
  // tap away from re-enabling them without leaving the app stack.
  const handleSendTest = useCallback(async () => {
    try {
      const { granted } = await sendTestNotification();
      if (!granted) {
        Alert.alert(
          t("notification_prefs.test_permission_title"),
          t("notification_prefs.test_permission_body"),
          [
            {
              text: t("notification_prefs.test_open_settings"),
              onPress: () => Linking.openSettings(),
            },
            { text: t("notification_prefs.action_cancel"), style: "cancel" },
          ],
        );
        return;
      }
      showToast(t("notification_prefs.toast_test_sent"), "success");
    } catch {
      showToast(t("notification_prefs.toast_test_failed"), "error");
    }
  }, [sendTestNotification, t]);

  // P1 — snooze handlers.
  const handleSnoozeToggle = useCallback(async () => {
    try {
      if (isSnoozed) {
        await resumePush();
        showToast(t("notification_prefs.toast_resumed"), "success");
      } else {
        await snoozePush(24);
        showToast(t("notification_prefs.toast_snoozed"), "success");
      }
    } catch {
      showToast(t("notification_prefs.alert_save_failed"), "error");
    }
  }, [isSnoozed, snoozePush, resumePush, t]);

  const handleQuietTimeChange = useCallback(
    async (which: "start" | "end", picked: Date) => {
      const newTime = formatDateToTime(picked);
      const otherValue =
        which === "start"
          ? preferences?.quiet_hours_end
          : preferences?.quiet_hours_start;
      if (otherValue && newTime === otherValue) {
        showToast(
          t("notification_prefs.toast_quiet_times_equal"),
          "error",
        );
        return;
      }
      try {
        await updatePreferences(
          which === "start"
            ? { quiet_hours_start: newTime }
            : { quiet_hours_end: newTime },
        );
        showToast(t("notification_prefs.toast_quiet_saved"), "success");
      } catch {
        showToast(t("notification_prefs.alert_save_failed"), "error");
      }
    },
    [preferences?.quiet_hours_end, preferences?.quiet_hours_start, t, updatePreferences],
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("advance_reminder_days")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || error) return;
      if (typeof data?.advance_reminder_days === "number") {
        setAdvanceReminderDays(data.advance_reminder_days);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handlePickAdvanceReminder = useCallback(
    async (days: number) => {
      if (!user?.id || days === advanceReminderDays) return;
      const prev = advanceReminderDays;
      setAdvanceReminderDays(days);
      try {
        // 1. Persist the global default. Upsert handles the "no row
        // yet" case for users whose user_preferences was lazily
        // seeded by a different code path.
        const { error: upErr } = await supabase
          .from("user_preferences")
          .upsert(
            { user_id: user.id, advance_reminder_days: days },
            { onConflict: "user_id" },
          );
        if (upErr) throw upErr;
        // 2. Cascade to every existing autopay config so the next
        // cron run uses the new lead time. Best-effort — a failure
        // here doesn't reset the default (the user-facing state is
        // already saved).
        await supabase
          .from("loan_autopay_configs")
          .update({ days_before_due: days })
          .eq("user_id", user.id);
        showToast(
          t("notification_prefs.toast_advance_reminder_saved"),
          "success",
        );
      } catch (err: any) {
        console.warn(
          "[NotificationPrefs] save advance reminder failed:",
          err?.message,
        );
        setAdvanceReminderDays(prev);
        showToast(t("notification_prefs.alert_save_failed"), "error");
      }
    },
    [user?.id, advanceReminderDays, t],
  );

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
        Alert.alert(t("notification_prefs.alert_error_title"), t("notification_prefs.alert_save_failed"));
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
              <Text style={styles.headerTitle}>{t("notification_prefs.header")}</Text>
              <Text style={styles.headerSubtitle}>{t("notification_prefs.loading_subtitle")}</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.loadingText}>{t("notification_prefs.loading_text")}</Text>
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
              <Text style={styles.headerTitle}>{t("notification_prefs.header")}</Text>
              <Text style={styles.headerSubtitle}>
                {t("notification_prefs.master_subtitle")}
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
            <Text style={styles.sectionTitle}>{t("notification_prefs.section_channels")}</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={[styles.toggleIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="notifications" size={20} color="#DC2626" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("notification_prefs.toggle_push_title")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("notification_prefs.toggle_push_subtitle")}</Text>
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
                  <Text style={styles.toggleTitle}>{t("notification_prefs.toggle_email_title")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("notification_prefs.toggle_email_subtitle")}</Text>
                </View>
                <Switch
                  value={masterEmail}
                  onValueChange={(value) => handleToggle("email_enabled", value)}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* P1 — test notification + 24h snooze. Sit right under
                the master toggles so users discover them quickly. */}
            <View style={styles.utilityRow}>
              <TouchableOpacity
                style={styles.utilityChip}
                onPress={handleSendTest}
                disabled={!masterPush}
                accessibilityRole="button"
              >
                <Ionicons name="paper-plane-outline" size={14} color={!masterPush ? "#9CA3AF" : "#00C6AE"} />
                <Text style={[
                  styles.utilityChipText,
                  !masterPush && styles.utilityChipTextDisabled,
                ]}>
                  {t("notification_prefs.test_send_button")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.utilityChip,
                  isSnoozed && styles.utilityChipActive,
                ]}
                onPress={handleSnoozeToggle}
                accessibilityRole="button"
              >
                <Ionicons
                  name={isSnoozed ? "play-outline" : "pause-outline"}
                  size={14}
                  color={isSnoozed ? "#92400E" : "#0A2342"}
                />
                <Text style={[
                  styles.utilityChipText,
                  isSnoozed && styles.utilityChipTextActive,
                ]}>
                  {isSnoozed
                    ? t("notification_prefs.snooze_resume_chip", { time: snoozeRemainingLabel })
                    : t("notification_prefs.snooze_pause_chip")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* P1 — Per-Category Settings, grouped into 3 sections:
              Money / App / Marketing. The CATEGORY_GROUPS lookup
              keeps the DB-column wiring on CATEGORIES while letting
              each group own its own section card + i18n header. */}
          {CATEGORY_GROUPS.map((group) => {
            const groupCats = group.ids
              .map((id) => CATEGORIES.find((c) => c.id === id))
              .filter(Boolean) as NotificationCategory[];
            return (
              <View key={group.id} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t(`notification_prefs.group_${group.id}_title`)}
                </Text>
                <Text style={styles.groupDescription}>
                  {t(`notification_prefs.group_${group.id}_desc`)}
                </Text>
                <View style={styles.card}>
                  {groupCats.map((category, index) => {
                    const pushValue = getValue(category.pushKey);
                    const emailValue = getValue(category.emailKey);
                    const isLocked = category.id === "security";
                    const isExpanded = expandedCatId === category.id;
                    return (
                      <View
                        key={category.id}
                        style={[
                          styles.categoryItem,
                          index < groupCats.length - 1 && styles.borderBottom,
                        ]}
                      >
                        <View style={styles.categoryHeader}>
                          <Text style={styles.categoryTitle}>
                            {t(`notification_prefs.cat_${category.id}_title`)}
                          </Text>
                          <Text style={styles.categoryDescription}>
                            {t(`notification_prefs.cat_${category.id}_desc`)}
                          </Text>
                          {/* P1 — Example accordion. Hidden for the
                              security row (already self-explanatory
                              "Always on"); shown for everything else. */}
                          {!isLocked && (
                            <TouchableOpacity
                              style={styles.exampleToggle}
                              onPress={() =>
                                setExpandedCatId((cur) =>
                                  cur === category.id ? null : category.id,
                                )
                              }
                              accessibilityRole="button"
                            >
                              <Ionicons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={12}
                                color="#00C6AE"
                              />
                              <Text style={styles.exampleToggleText}>
                                {isExpanded
                                  ? t("notification_prefs.example_hide")
                                  : t("notification_prefs.example_show")}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {!isLocked && isExpanded && (
                            <Text style={styles.exampleText}>
                              {t(`notification_prefs.cat_${category.id}_example`)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.channelToggles}>
                          <TouchableOpacity
                            style={[
                              styles.channelChip,
                              (pushValue && masterPush) && styles.channelChipActive,
                              !masterPush && !isLocked && styles.channelChipDisabled,
                              isLocked && styles.channelChipActive,
                            ]}
                            onPress={() => {
                              if (isLocked) {
                                showToast(
                                  t("notification_prefs.toast_security_locked"),
                                  "info",
                                );
                                return;
                              }
                              if (masterPush) {
                                handleToggle(category.pushKey, !pushValue);
                              }
                            }}
                            disabled={!isLocked && (!masterPush || isSaving)}
                          >
                            <Ionicons
                              name={isLocked ? "lock-closed" : "notifications-outline"}
                              size={14}
                              color={
                                isLocked
                                  ? "#00C6AE"
                                  : !masterPush
                                  ? "#9CA3AF"
                                  : pushValue
                                  ? "#00C6AE"
                                  : "#6B7280"
                              }
                            />
                            <Text
                              style={[
                                styles.channelChipText,
                                (pushValue && masterPush) && styles.channelChipTextActive,
                                !masterPush && !isLocked && styles.channelChipTextDisabled,
                                isLocked && styles.channelChipTextActive,
                              ]}
                            >
                              {t("notification_prefs.chip_push")}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.channelChip,
                              (emailValue && masterEmail) && styles.channelChipActive,
                              !masterEmail && !isLocked && styles.channelChipDisabled,
                              isLocked && styles.channelChipActive,
                            ]}
                            onPress={() => {
                              if (isLocked) {
                                showToast(
                                  t("notification_prefs.toast_security_locked"),
                                  "info",
                                );
                                return;
                              }
                              if (masterEmail) {
                                handleToggle(category.emailKey, !emailValue);
                              }
                            }}
                            disabled={!isLocked && (!masterEmail || isSaving)}
                          >
                            <Ionicons
                              name={isLocked ? "lock-closed" : "mail-outline"}
                              size={14}
                              color={
                                isLocked
                                  ? "#00C6AE"
                                  : !masterEmail
                                  ? "#9CA3AF"
                                  : emailValue
                                  ? "#00C6AE"
                                  : "#6B7280"
                              }
                            />
                            <Text
                              style={[
                                styles.channelChipText,
                                (emailValue && masterEmail) && styles.channelChipTextActive,
                                !masterEmail && !isLocked && styles.channelChipTextDisabled,
                                isLocked && styles.channelChipTextActive,
                              ]}
                            >
                              {t("notification_prefs.chip_email")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Email Digest */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("notification_prefs.section_digest")}</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="newspaper" size={20} color="#F59E0B" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("notification_prefs.toggle_weekly_title")}</Text>
                  <Text style={styles.toggleSubtitle}>
                    {t("notification_prefs.digest_weekly_subtitle")}
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

          {/* P2 (autopay review): Advance reminders. Chip row that
              sets user_preferences.advance_reminder_days and cascades
              to every existing autopay config. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("notification_prefs.section_advance_reminders")}
            </Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, { alignItems: "flex-start" }]}>
                <View
                  style={[styles.toggleIcon, { backgroundColor: "#F0FDFB" }]}
                >
                  <Ionicons name="alarm" size={20} color="#00897B" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>
                    {t("notification_prefs.advance_reminder_title")}
                  </Text>
                  <Text style={styles.toggleSubtitle}>
                    {t("notification_prefs.advance_reminder_subtitle")}
                  </Text>
                  <View style={advanceChipStyles.row}>
                    {ADVANCE_REMINDER_OPTIONS.map((d) => {
                      const selected = advanceReminderDays === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[
                            advanceChipStyles.chip,
                            selected && advanceChipStyles.chipSelected,
                          ]}
                          onPress={() => handlePickAdvanceReminder(d)}
                          disabled={isSaving}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              advanceChipStyles.chipValue,
                              selected && advanceChipStyles.chipValueSelected,
                            ]}
                          >
                            {d}
                          </Text>
                          <Text
                            style={[
                              advanceChipStyles.chipUnit,
                              selected && advanceChipStyles.chipUnitSelected,
                            ]}
                          >
                            {t("notification_prefs.advance_reminder_unit", {
                              count: d,
                            })}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("notification_prefs.section_quiet")}</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={[styles.toggleIcon, { backgroundColor: "#F5F3FF" }]}>
                  <Ionicons name="moon" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("notification_prefs.toggle_dnd_title")}</Text>
                  <Text style={styles.toggleSubtitle}>
                    {t("notification_prefs.dnd_subtitle")}
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
                  {/* P0 — tap to edit. DateTimePicker is inline on iOS,
                      modal on Android; visibility flags handle both. */}
                  <View style={styles.quietTimeRow}>
                    <Text style={styles.quietTimeLabel}>
                      {t("final_polish.notificationprefs_from")}
                    </Text>
                    <TouchableOpacity
                      style={styles.quietTimeValue}
                      onPress={() => setShowStartPicker(true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.quietTimeText}>
                        {formatTimeDisplay(preferences.quiet_hours_start)}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.quietTimeRow}>
                    <Text style={styles.quietTimeLabel}>
                      {t("notification_prefs.quiet_until")}
                    </Text>
                    <TouchableOpacity
                      style={styles.quietTimeValue}
                      onPress={() => setShowEndPicker(true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.quietTimeText}>
                        {formatTimeDisplay(preferences.quiet_hours_end)}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>

                  {showStartPicker && (
                    <DateTimePicker
                      value={parseTimeToDate(preferences.quiet_hours_start)}
                      mode="time"
                      is24Hour
                      display={
                        RNPlatform.OS === "ios" ? "spinner" : "default"
                      }
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        if (RNPlatform.OS !== "ios") {
                          setShowStartPicker(false);
                        }
                        if (event.type === "set" && date) {
                          handleQuietTimeChange("start", date);
                          if (RNPlatform.OS === "ios") {
                            setShowStartPicker(false);
                          }
                        } else if (event.type === "dismissed") {
                          setShowStartPicker(false);
                        }
                      }}
                    />
                  )}
                  {showEndPicker && (
                    <DateTimePicker
                      value={parseTimeToDate(preferences.quiet_hours_end)}
                      mode="time"
                      is24Hour
                      display={
                        RNPlatform.OS === "ios" ? "spinner" : "default"
                      }
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        if (RNPlatform.OS !== "ios") {
                          setShowEndPicker(false);
                        }
                        if (event.type === "set" && date) {
                          handleQuietTimeChange("end", date);
                          if (RNPlatform.OS === "ios") {
                            setShowEndPicker(false);
                          }
                        } else if (event.type === "dismissed") {
                          setShowEndPicker(false);
                        }
                      }}
                    />
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Info Note — copy now matches behaviour (Security row is
              locked above; this footer just explains why). */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color="#00897B" />
            <Text style={styles.infoText}>
              {t("notification_prefs.security_always_sent_note")}
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
  // P1 — under each section title sits a one-line explainer.
  groupDescription: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  // P1 — test-notification + 24h snooze affordances. Sit below the
  // master push/email card so users find them fast.
  utilityRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  utilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  utilityChipActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
  },
  utilityChipText: { fontSize: 12, fontWeight: "700", color: "#0A2342" },
  utilityChipTextActive: { color: "#92400E" },
  utilityChipTextDisabled: { color: "#9CA3AF" },
  // P1 — Example accordion. Tiny teal link + expanded body.
  exampleToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  exampleToggleText: { fontSize: 11, fontWeight: "600", color: "#00C6AE" },
  exampleText: {
    fontSize: 11,
    color: "#374151",
    marginTop: 4,
    lineHeight: 16,
    fontStyle: "italic",
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
