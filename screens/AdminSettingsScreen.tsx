import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useTranslation } from "react-i18next";
import { useCircleGovernance } from "../hooks/useCircleDemocracy";
import { Routes } from "../lib/routes";
interface AdminSettingsParams {
  circleName?: string;
  circleId?: string;
}

export default function AdminSettingsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const route = useRoute();
  const params = (route.params as AdminSettingsParams) || {};
  const circleName = params.circleName || "Family Savings Circle";
  const circleId = params.circleId;

  // Bucket C — pull governance so we can hydrate the
  // "Require approval for new members" toggle from the real
  // require_member_approval column and write changes back.
  const { settings: governanceSettings, updateSettings } = useCircleGovernance(circleId);

  // Permission Settings
  const [permissions, setPermissions] = useState({
    membersCanInvite: false,
    membersCanSeeOthersPayments: true,
    membersCanSeeFullHistory: true,
    requireApprovalForNewMembers: true,
    allowEarlyWithdrawal: false,
    requireTwoAdminApproval: false,
  });

  // Notification Settings
  const [notifications, setNotifications] = useState({
    paymentReminders: true,
    reminderDaysBefore: "3",
    payoutNotifications: true,
    memberJoinLeave: true,
    disputeAlerts: true,
    weeklyDigest: false,
  });

  // Payment Rules
  const [paymentRules, setPaymentRules] = useState({
    latePenaltyEnabled: true,
    latePenaltyPercent: "5",
    gracePeriodDays: "3",
    autoRemoveAfterMissed: "3",
    requireConfirmation: true,
  });

  // Circle Rules
  const [circleRules, setCircleRules] = useState({
    minMembers: "3",
    maxMembers: "12",
    allowMidCycleJoin: false,
    requireElderApproval: true,
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Bucket C — baseline snapshot so handleSave can detect what changed.
  // gracePeriodBaselineRef captures the initial-state value on mount;
  // requireApprovalBaselineRef hydrates from governance when it loads.
  const gracePeriodBaselineRef = useRef<string>(paymentRules.gracePeriodDays);
  const requireApprovalBaselineRef = useRef<boolean>(
    permissions.requireApprovalForNewMembers,
  );

  // Hydrate the "Require approval" toggle from the governance row once it
  // arrives. Falls back to the local-state default if no row exists yet.
  useEffect(() => {
    if (!governanceSettings) return;
    const fromDb = governanceSettings.requireMemberApproval;
    requireApprovalBaselineRef.current = fromDb;
    setPermissions((prev) => ({
      ...prev,
      requireApprovalForNewMembers: fromDb,
    }));
  }, [governanceSettings]);

  const updatePermission = (key: keyof typeof permissions) => {
    setPermissions({ ...permissions, [key]: !permissions[key] });
    setHasChanges(true);
  };

  const updateNotification = (key: keyof typeof notifications, value: any) => {
    setNotifications({ ...notifications, [key]: value });
    setHasChanges(true);
  };

  const updatePaymentRule = (key: keyof typeof paymentRules, value: any) => {
    setPaymentRules({ ...paymentRules, [key]: value });
    setHasChanges(true);
  };

  const updateCircleRule = (key: keyof typeof circleRules, value: any) => {
    setCircleRules({ ...circleRules, [key]: value });
    setHasChanges(true);
  };

  // Bucket C — replaces the prior `setTimeout` mock. Two real paths:
  //   1. Governance-only changes (require_member_approval) write directly
  //      via updateSettings — these are platform-level rules, not
  //      member-facing votes.
  //   2. Circle-rule changes (grace period today; contribution amount and
  //      frequency in future passes) route through a `change_rules`
  //      proposal so members can vote. We navigate to CircleVoting with a
  //      preset payload; the screen opens the create sheet pre-filled.
  // If a circleId is missing (legacy callers), we surface a clear notice
  // instead of pretending to save.
  const handleSave = async () => {
    if (!circleId) {
      Alert.alert(
        t("admin_settings_v2.alert_no_circle_title"),
        t("admin_settings_v2.alert_no_circle_body"),
      );
      return;
    }

    // ── Governance-only direct writes ──────────────────────────────────────
    const requireApprovalChanged =
      permissions.requireApprovalForNewMembers !== requireApprovalBaselineRef.current;
    if (requireApprovalChanged) {
      const updated = await updateSettings({
        requireMemberApproval: permissions.requireApprovalForNewMembers,
      });
      if (updated) {
        requireApprovalBaselineRef.current = permissions.requireApprovalForNewMembers;
      } else {
        Alert.alert(
          t("admin_settings_v2.alert_save_failed_title"),
          t("admin_settings_v2.alert_save_failed_body"),
        );
        return;
      }
    }

    // ── Vote-routed rule changes ──────────────────────────────────────────
    const gracePeriodChanged =
      paymentRules.gracePeriodDays.trim() !== gracePeriodBaselineRef.current.trim();
    if (gracePeriodChanged) {
      // Reset baseline so subsequent saves don't re-prompt the same change.
      gracePeriodBaselineRef.current = paymentRules.gracePeriodDays;
      setHasChanges(false);
      navigation.navigate(Routes.CircleVoting, {
        circleId,
        presetType: "change_rules",
        presetPayload: {
          rule: "grace_period",
          value: paymentRules.gracePeriodDays,
        },
      });
      return;
    }

    if (requireApprovalChanged) {
      setHasChanges(false);
      Alert.alert(
        t("admin_settings_v2.alert_saved_title"),
        t("admin_settings_v2.alert_saved_body"),
      );
    } else {
      Alert.alert(
        t("admin_settings_v2.alert_no_changes_title"),
        t("admin_settings_v2.alert_no_changes_body"),
      );
    }
  };

  const renderToggleRow = (
    label: string,
    description: string,
    value: boolean,
    onToggle: () => void,
    icon: string
  ) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={20} color="#6B7280" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
        thumbColor={value ? "#2563EB" : "#F3F4F6"}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (hasChanges) {
              Alert.alert(
                "Unsaved Changes",
                "You have unsaved changes. Do you want to discard them?",
                [
                  { text: "Stay", style: "cancel" },
                  { text: "Discard", onPress: () => navigation.goBack() },
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t("screen_headers.admin_settings")}</Text>
          <Text style={styles.headerSubtitle}>{circleName}</Text>
        </View>
        {hasChanges && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{t("admin_settings_v2.btn_save")}</Text>
          </TouchableOpacity>
        )}
        {!hasChanges && <View style={styles.headerPlaceholder} />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Member Permissions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={22} color="#2563EB" />
            <Text style={styles.sectionTitle}>{t("admin_settings_v2.section_member_permissions")}</Text>
          </View>

          {renderToggleRow(
            "Allow Members to Invite",
            "Members can send circle invitations",
            permissions.membersCanInvite,
            () => updatePermission("membersCanInvite"),
            "person-add-outline"
          )}

          {renderToggleRow(
            "View Others' Payments",
            "Members can see other members' payment status",
            permissions.membersCanSeeOthersPayments,
            () => updatePermission("membersCanSeeOthersPayments"),
            "eye-outline"
          )}

          {renderToggleRow(
            "View Full History",
            "Members can access complete transaction history",
            permissions.membersCanSeeFullHistory,
            () => updatePermission("membersCanSeeFullHistory"),
            "time-outline"
          )}

          {renderToggleRow(
            "Require Approval for New Members",
            "Admin must approve all new member requests",
            permissions.requireApprovalForNewMembers,
            () => updatePermission("requireApprovalForNewMembers"),
            "shield-checkmark-outline"
          )}

          {renderToggleRow(
            "Allow Early Withdrawal",
            "Members can request early payout (with conditions)",
            permissions.allowEarlyWithdrawal,
            () => updatePermission("allowEarlyWithdrawal"),
            "cash-outline"
          )}

          {renderToggleRow(
            "Two Admin Approval",
            "Major changes require approval from two admins",
            permissions.requireTwoAdminApproval,
            () => updatePermission("requireTwoAdminApproval"),
            "checkmark-done-outline"
          )}
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={22} color="#2563EB" />
            <Text style={styles.sectionTitle}>{t("admin_settings_v2.section_notifications")}</Text>
          </View>

          {renderToggleRow(
            "Payment Reminders",
            "Send reminders before payment due dates",
            notifications.paymentReminders,
            () => updateNotification("paymentReminders", !notifications.paymentReminders),
            "alarm-outline"
          )}

          {notifications.paymentReminders && (
            <View style={styles.subSettingRow}>
              <Text style={styles.subSettingLabel}>Days before due date:</Text>
              <View style={styles.numberInputContainer}>
                <TextInput
                  style={styles.numberInput}
                  value={notifications.reminderDaysBefore}
                  onChangeText={(v) => updateNotification("reminderDaysBefore", v)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.numberUnit}>days</Text>
              </View>
            </View>
          )}

          {renderToggleRow(
            "Payout Notifications",
            "Notify when payouts are processed",
            notifications.payoutNotifications,
            () =>
              updateNotification("payoutNotifications", !notifications.payoutNotifications),
            "cash-outline"
          )}

          {renderToggleRow(
            "Member Join/Leave",
            "Notify when members join or leave",
            notifications.memberJoinLeave,
            () => updateNotification("memberJoinLeave", !notifications.memberJoinLeave),
            "people-outline"
          )}

          {renderToggleRow(
            "Dispute Alerts",
            "Immediate alerts for new disputes",
            notifications.disputeAlerts,
            () => updateNotification("disputeAlerts", !notifications.disputeAlerts),
            "alert-circle-outline"
          )}

          {renderToggleRow(
            "Weekly Digest",
            "Summary email every week",
            notifications.weeklyDigest,
            () => updateNotification("weeklyDigest", !notifications.weeklyDigest),
            "mail-outline"
          )}
        </View>

        {/* Payment Rules */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card-outline" size={22} color="#2563EB" />
            <Text style={styles.sectionTitle}>{t("admin_settings_v2.section_payment_rules")}</Text>
          </View>

          {renderToggleRow(
            "Late Payment Penalty",
            "Charge penalty for late payments",
            paymentRules.latePenaltyEnabled,
            () =>
              updatePaymentRule("latePenaltyEnabled", !paymentRules.latePenaltyEnabled),
            "warning-outline"
          )}

          {paymentRules.latePenaltyEnabled && (
            <>
              <View style={styles.subSettingRow}>
                <Text style={styles.subSettingLabel}>Penalty percentage:</Text>
                <View style={styles.numberInputContainer}>
                  <TextInput
                    style={styles.numberInput}
                    value={paymentRules.latePenaltyPercent}
                    onChangeText={(v) => updatePaymentRule("latePenaltyPercent", v)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.numberUnit}>%</Text>
                </View>
              </View>

              <View style={styles.subSettingRow}>
                <Text style={styles.subSettingLabel}>Grace period:</Text>
                <View style={styles.numberInputContainer}>
                  <TextInput
                    style={styles.numberInput}
                    value={paymentRules.gracePeriodDays}
                    onChangeText={(v) => updatePaymentRule("gracePeriodDays", v)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.numberUnit}>days</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.subSettingRow}>
            <Text style={styles.subSettingLabel}>Auto-remove after missed:</Text>
            <View style={styles.numberInputContainer}>
              <TextInput
                style={styles.numberInput}
                value={paymentRules.autoRemoveAfterMissed}
                onChangeText={(v) => updatePaymentRule("autoRemoveAfterMissed", v)}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.numberUnit}>payments</Text>
            </View>
          </View>

          {renderToggleRow(
            "Require Payment Confirmation",
            "Members must confirm payment was sent",
            paymentRules.requireConfirmation,
            () =>
              updatePaymentRule("requireConfirmation", !paymentRules.requireConfirmation),
            "checkmark-circle-outline"
          )}
        </View>

        {/* Circle Rules */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={22} color="#2563EB" />
            <Text style={styles.sectionTitle}>{t("admin_settings_v2.section_circle_rules")}</Text>
          </View>

          <View style={styles.subSettingRow}>
            <Text style={styles.subSettingLabel}>Minimum members:</Text>
            <View style={styles.numberInputContainer}>
              <TextInput
                style={styles.numberInput}
                value={circleRules.minMembers}
                onChangeText={(v) => updateCircleRule("minMembers", v)}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>

          <View style={styles.subSettingRow}>
            <Text style={styles.subSettingLabel}>Maximum members:</Text>
            <View style={styles.numberInputContainer}>
              <TextInput
                style={styles.numberInput}
                value={circleRules.maxMembers}
                onChangeText={(v) => updateCircleRule("maxMembers", v)}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>

          {renderToggleRow(
            "Allow Mid-Cycle Join",
            "New members can join during an active cycle",
            circleRules.allowMidCycleJoin,
            () => updateCircleRule("allowMidCycleJoin", !circleRules.allowMidCycleJoin),
            "enter-outline"
          )}

          {renderToggleRow(
            "Require Elder Approval",
            "Elders must approve major circle changes",
            circleRules.requireElderApproval,
            () =>
              updateCircleRule("requireElderApproval", !circleRules.requireElderApproval),
            "ribbon-outline"
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning-outline" size={22} color="#DC2626" />
            <Text style={[styles.sectionTitle, { color: "#DC2626" }]}>
              Danger Zone
            </Text>
          </View>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => Alert.alert(t("admin_settings_v2.alert_reset_title"), t("admin_settings_v2.alert_reset_body"))}
          >
            <Ionicons name="refresh-outline" size={20} color="#DC2626" />
            <Text style={styles.dangerButtonText}>{t("admin_settings_v2.btn_reset_default")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => Alert.alert(t("admin_settings_v2.alert_transfer_title"), t("admin_settings_v2.alert_transfer_body"))}
          >
            <Ionicons name="swap-horizontal-outline" size={20} color="#DC2626" />
            <Text style={styles.dangerButtonText}>{t("admin_settings_v2.btn_transfer_admin")}</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button (shown at bottom when there are changes) */}
        {hasChanges && (
          <TouchableOpacity style={styles.saveButtonLarge} onPress={handleSave}>
            <Ionicons name="save-outline" size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonLargeText}>{t("admin_settings_v2.btn_save_all")}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerPlaceholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
  },
  settingDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  subSettingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 64,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#F9FAFB",
  },
  subSettingLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  numberInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  numberInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
    minWidth: 50,
    textAlign: "center",
  },
  numberUnit: {
    fontSize: 14,
    color: "#6B7280",
  },
  dangerSection: {
    backgroundColor: "#FEF2F2",
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
    gap: 12,
  },
  dangerButtonText: {
    fontSize: 15,
    color: "#DC2626",
    fontWeight: "500",
  },
  saveButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonLargeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  bottomPadding: {
    height: 40,
  },
});
