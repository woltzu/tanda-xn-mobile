// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceSettingsScreen.tsx — ADVANCE-020 advance management hub
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 122-ADVANCE-020-AdvanceSettings.jsx.
//
// Central hub for managing an active advance. Active-advance summary
// card, a 2×2 quick-actions grid, an early-repayment autopay toggle,
// notification toggles (push + email receipts), more-options links
// (history + support), and the closing XnScore card.
//
// Route params (all optional, defaults match canonical mock):
//   user?: { name; xnScore }
//   activeAdvance?: { id; amount; totalDue; withholdingDate; daysUntil }
//   settings?: { earlyPayAutopay; reminderDays; notificationsEnabled;
//                emailReceipts }
//
// Navigation:
//   - back → goBack
//   - "Pay Off Early" → EarlyRepayment { advanceId }
//   - "Withholding Schedule" → AdvanceDetailsV2 { advanceId } (timeline lives there)
//   - "View Agreement" → AdvanceAgreement { advanceId }
//   - "Request Hardship" → HardshipRequest { advanceId }
//   - "Advance History" → AdvanceHistory
//   - "Contact Support" → HelpCenter
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type ActiveAdvance = {
  id: string;
  amount: number;
  totalDue: number;
  withholdingDate: string;
  daysUntil: number;
};

type Settings = {
  earlyPayAutopay: boolean;
  reminderDays: number;
  notificationsEnabled: boolean;
  emailReceipts: boolean;
};

type AdvanceSettingsParams = {
  user?: { name?: string; xnScore?: number };
  activeAdvance?: ActiveAdvance | null;
  settings?: Settings;
};
type AdvanceSettingsRouteProp = RouteProp<
  { AdvanceSettings: AdvanceSettingsParams },
  "AdvanceSettings"
>;

const DEFAULT_ADVANCE: ActiveAdvance = {
  id: "ADV-2025-0120-001",
  amount: 300,
  totalDue: 315,
  withholdingDate: "Feb 15, 2025",
  daysUntil: 25,
};

const DEFAULT_SETTINGS: Settings = {
  earlyPayAutopay: false,
  reminderDays: 3,
  notificationsEnabled: true,
  emailReceipts: true,
};

function Toggle({
  value,
  onToggle,
  accessibilityLabel,
}: {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleOn]}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </TouchableOpacity>
  );
}

export default function AdvanceSettingsScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<AdvanceSettingsRouteProp>();
  const { t } = useTranslation();

  const xnScore = route.params?.user?.xnScore ?? 78;
  const activeAdvance =
    route.params?.activeAdvance === null
      ? null
      : route.params?.activeAdvance ?? DEFAULT_ADVANCE;
  const settings = route.params?.settings ?? DEFAULT_SETTINGS;
  const advanceId = activeAdvance?.id ?? DEFAULT_ADVANCE.id;

  // P2 (autopay review): autopayEnabled state removed — the only
  // surface that read it (the inline Toggle) is gone, replaced by a
  // link to AutopaySetupScreen which owns the real state.
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    settings.notificationsEnabled,
  );
  const [emailReceipts, setEmailReceipts] = useState(settings.emailReceipts);

  const quickActions = [
    {
      id: "early_repay",
      icon: "💰",
      label: "Pay Off Early",
      sublabel: "Save on fees",
      highlight: true,
      onPress: () =>
        navigation.navigate(Routes.EarlyRepayment, { advanceId }),
    },
    {
      id: "schedule",
      icon: "📅",
      label: "Withholding Schedule",
      sublabel: "View timeline",
      highlight: false,
      onPress: () =>
        navigation.navigate(Routes.AdvanceDetailsV2, { advanceId }),
    },
    {
      id: "agreement",
      icon: "📄",
      label: "View Agreement",
      sublabel: "Terms & conditions",
      highlight: false,
      onPress: () =>
        navigation.navigate(Routes.AdvanceDetailsV2, { advanceId }),
    },
    {
      id: "hardship",
      icon: "🤝",
      label: "Request Hardship",
      sublabel: "Get assistance",
      highlight: false,
      onPress: () =>
        navigation.navigate(Routes.HardshipRequest, { advanceId }),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t("advance_settings.header_title")}</Text>
              <Text style={styles.headerSubtitle}>{t("advance_settings.header_subtitle")}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Active advance summary */}
          {activeAdvance && (
            <View style={styles.sectionCard}>
              <View style={styles.activeHeader}>
                <Text style={styles.sectionTitle}>{t("advance_settings.section_active")}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>On Track ✓</Text>
                </View>
              </View>
              <View style={styles.activeRow}>
                <View>
                  <Text style={styles.activeLabel}>{t("advance_settings.label_amount_due")}</Text>
                  <Text style={styles.activeAmount}>
                    ${activeAdvance.totalDue}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.activeLabel}>{t("final_polish.advancesettings_auto_withhold")}</Text>
                  <Text style={styles.activeDate}>
                    {activeAdvance.withholdingDate}
                  </Text>
                  <Text style={styles.activeDays}>
                    {activeAdvance.daysUntil} days
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Quick actions grid */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("advance_settings.section_quick")}</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionTile,
                    action.highlight && styles.actionTileHighlight,
                  ]}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionSublabel}>{action.sublabel}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* P2 (autopay review): the duplicate inline toggle that
              lived here has been removed in favour of a link to
              AutopaySetupScreen, which is now the single source of
              truth for autopay (loads + persists to loan_autopay_configs
              via the useAutopay hook). The Toggle component on this
              screen used to render against ephemeral useState that
              never persisted. */}
          <TouchableOpacity
            style={styles.sectionCard}
            onPress={() => navigation.navigate("AutopaySetup")}
            accessibilityRole="button"
            accessibilityLabel={t(
              "advance_settings.configure_autopay_a11y",
            )}
          >
            <View style={styles.linkRow}>
              <View style={styles.linkIcon}>
                <Ionicons name="repeat-outline" size={20} color="#00897B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>
                  {t("advance_settings.configure_autopay_title")}
                </Text>
                <Text style={styles.linkSubtitle}>
                  {t("advance_settings.configure_autopay_subtitle")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </View>
          </TouchableOpacity>

          {/* Notification settings */}
          <View style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>
              Notifications
            </Text>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.toggleLabel}>{t("advance_settings.toggle_push")}</Text>
                <Text style={styles.toggleHint}>
                  Withholding reminders & updates
                </Text>
              </View>
              <Toggle
                value={notificationsEnabled}
                onToggle={() => setNotificationsEnabled(!notificationsEnabled)}
                accessibilityLabel="Toggle push notifications"
              />
            </View>
            <View style={styles.notifDivider} />
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.toggleLabel}>{t("advance_settings.toggle_email")}</Text>
                <Text style={styles.toggleHint}>
                  Confirmation emails for payments
                </Text>
              </View>
              <Toggle
                value={emailReceipts}
                onToggle={() => setEmailReceipts(!emailReceipts)}
                accessibilityLabel="Toggle email receipts"
              />
            </View>
          </View>

          {/* More options */}
          <View style={styles.moreCard}>
            <TouchableOpacity
              style={styles.moreRow}
              onPress={() => navigation.navigate(Routes.AdvanceHubV2)}
              accessibilityRole="button"
              accessibilityLabel="Advance history"
            >
              <View style={styles.moreLeft}>
                <Ionicons name="time-outline" size={20} color={MUTED} />
                <Text style={styles.moreText}>{t("advance_settings.more_history")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </TouchableOpacity>
            <View style={styles.moreDivider} />
            <TouchableOpacity
              style={styles.moreRow}
              onPress={() => navigation.navigate(Routes.HelpCenter)}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <View style={styles.moreLeft}>
                <Ionicons name="chatbubble-outline" size={20} color={MUTED} />
                <Text style={styles.moreText}>{t("advance_settings.more_support")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </TouchableOpacity>
          </View>

          {/* XnScore card */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreCircleText}>{xnScore}</Text>
            </View>
            <View>
              <Text style={styles.scoreTitle}>{t("advance_settings.score_title")}</Text>
              <Text style={styles.scoreBody}>
                On-time repayment keeps your score healthy
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  contentWrap: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: NAVY },

  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#00897B" },
  activeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeLabel: { fontSize: 12, color: MUTED },
  activeAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  activeDate: {
    fontSize: 14,
    fontWeight: "600",
    color: TEAL,
    marginTop: 2,
  },
  activeDays: { fontSize: 11, color: MUTED, marginTop: 2 },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  actionTile: {
    width: "47%",
    flexGrow: 1,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionTileHighlight: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
  },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    textAlign: "center",
  },
  actionSublabel: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
    textAlign: "center",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { fontSize: 14, fontWeight: "500", color: NAVY },
  toggleHint: { fontSize: 12, color: MUTED, marginTop: 2 },
  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: BORDER,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: TEAL },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: { alignSelf: "flex-end" },

  autopayNote: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
  },
  autopayNoteText: { fontSize: 11, color: "#9CA3AF", lineHeight: 16 },

  // P2 (autopay review) — link row used in place of the removed
  // inline autopay toggle; tapping it routes to AutopaySetupScreen.
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: { fontSize: 14, fontWeight: "700", color: NAVY },
  linkSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },

  notifDivider: {
    height: 1,
    backgroundColor: "#F5F7FA",
    marginVertical: 14,
  },

  moreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  moreLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  moreText: { fontSize: 14, color: NAVY },
  moreDivider: {
    height: 1,
    backgroundColor: "#F5F7FA",
    marginHorizontal: 14,
  },

  scoreCard: {
    backgroundColor: NAVY,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,198,174,0.2)",
    borderWidth: 2,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleText: { fontSize: 18, fontWeight: "700", color: TEAL },
  scoreTitle: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  scoreBody: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
});
