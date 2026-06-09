// ══════════════════════════════════════════════════════════════════════════════
// screens/PaymentReminderScreen.tsx — ADVANCE-016 upcoming-withholding notice
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 118-ADVANCE-016-PaymentReminder.jsx.
//
// Reminder screen surfaced before a scheduled withholding. Three
// urgency modes drive the gradient + icon + label tuple:
//   - upcoming   → navy gradient, 📅, "UPCOMING"
//   - due_today  → amber gradient, ⏰, "DUE TODAY"
//   - overdue    → red gradient, 🚨, "OVERDUE"
//
// Top-right close button dismisses the reminder (goBack). The body
// shows a wallet/payout sufficiency check, a withholding breakdown,
// an optional red XnScore-at-risk banner (only when due_today or
// overdue), and a "Pay Early" CTA. The bottom bar carries Remind
// Later + Got It buttons.
//
// Route params (all optional, defaults match canonical mock):
//   reminder?: { advanceId; amountDue; withholdingDate;
//                circleName; payoutAmount; remainingAfter;
//                daysUntil; urgency }
//   walletBalance?: number
//
// Navigation:
//   - close (X) / "Got It" → goBack
//   - "Pay Early & Save" → EarlyRepayment { advanceId }
//   - "View Advance Details" → AdvanceDetailsV2 { advanceId }
//   - "Remind Me Later" → goBack (Phase 3 will persist a snooze
//                                 preference)
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
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
const AMBER = "#D97706";
const RED = "#DC2626";

type Urgency = "upcoming" | "due_today" | "overdue";

type Reminder = {
  advanceId: string;
  amountDue: number;
  withholdingDate: string;
  circleName: string;
  payoutAmount: number;
  remainingAfter: number;
  daysUntil: number;
  urgency: Urgency;
};

type PaymentReminderParams = {
  reminder?: Reminder;
  walletBalance?: number;
};
type PaymentReminderRouteProp = RouteProp<
  { PaymentReminder: PaymentReminderParams },
  "PaymentReminder"
>;

const DEFAULT_REMINDER: Reminder = {
  advanceId: "ADV-2025-0120-001",
  amountDue: 315,
  withholdingDate: "Feb 15, 2025",
  circleName: "Family Circle",
  payoutAmount: 500,
  remainingAfter: 185,
  daysUntil: 3,
  urgency: "upcoming",
};

function urgencyTheme(urgency: Urgency) {
  switch (urgency) {
    case "overdue":
      return {
        gradient: [RED, "#B91C1C"] as const,
        icon: "🚨",
        label: "OVERDUE",
        labelBg: "#FEE2E2",
        labelColor: RED,
      };
    case "due_today":
      return {
        gradient: [AMBER, "#B45309"] as const,
        icon: "⏰",
        label: "DUE TODAY",
        labelBg: "#FEF3C7",
        labelColor: AMBER,
      };
    case "upcoming":
    default:
      return {
        gradient: [NAVY, "#143654"] as const,
        icon: "📅",
        label: "UPCOMING",
        labelBg: "#F0FDFB",
        labelColor: TEAL,
      };
  }
}

export default function PaymentReminderScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<PaymentReminderRouteProp>();
  const { t } = useTranslation();

  const reminder = route.params?.reminder ?? DEFAULT_REMINDER;
  const walletBalance = route.params?.walletBalance ?? 450;
  const theme = urgencyTheme(reminder.urgency);
  const sufficient = walletBalance >= reminder.amountDue;
  const isUrgent =
    reminder.urgency === "overdue" || reminder.urgency === "due_today";

  const handleDismiss = () => navigation.goBack();
  const handleRemindLater = () => navigation.goBack();
  const handlePayNow = () =>
    navigation.navigate(Routes.EarlyRepayment, {
      advanceId: reminder.advanceId,
    });
  const handleViewDetails = () =>
    navigation.navigate(Routes.AdvanceDetailsV2, {
      advanceId: reminder.advanceId,
    });

  const heroTitle =
    reminder.urgency === "due_today"
      ? "Withholding Today"
      : reminder.urgency === "overdue"
        ? "Withholding Overdue"
        : `Withholding in ${reminder.daysUntil} Days`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.gradient[1]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — urgency-keyed gradient */}
        <LinearGradient
          colors={theme.gradient as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Close button in top-right */}
          <View style={styles.closeRow}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroIconRow}>
              <Text style={styles.heroIcon}>{theme.icon}</Text>
              <View
                style={[styles.urgencyBadge, { backgroundColor: theme.labelBg }]}
              >
                <Text
                  style={[
                    styles.urgencyBadgeText,
                    { color: theme.labelColor },
                  ]}
                >
                  {theme.label}
                </Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroAmount}>${reminder.amountDue}</Text>
            <Text style={styles.heroSubtitle}>
              will be withheld from your {reminder.circleName} payout
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Payout sufficiency check */}
          <View style={styles.sufficiencyCard}>
            <View style={styles.sufficiencyLeft}>
              <View
                style={[
                  styles.sufficiencyIconBox,
                  {
                    backgroundColor: sufficient ? "#F0FDFB" : "#FEF3C7",
                  },
                ]}
              >
                <Ionicons
                  name={sufficient ? "checkmark-circle" : "alert-circle"}
                  size={22}
                  color={sufficient ? TEAL : AMBER}
                />
              </View>
              <View>
                <Text style={styles.sufficiencyLabel}>{t("payment_reminder.label_your_payout")}</Text>
                <Text style={styles.sufficiencyAmount}>
                  ${reminder.payoutAmount}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.sufficiencyStatus,
                { color: sufficient ? "#00897B" : AMBER },
              ]}
            >
              {sufficient ? "✓ Sufficient" : "⚠️ Check payout"}
            </Text>
          </View>

          {/* Withholding breakdown — navy */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>
              What happens on {reminder.withholdingDate}
            </Text>
            <View style={styles.breakdownList}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Payout from {reminder.circleName}
                </Text>
                <Text style={styles.breakdownValueWhite}>
                  ${reminder.payoutAmount}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Advance repayment (auto-withheld)
                </Text>
                <Text style={styles.breakdownValueAmber}>
                  -${reminder.amountDue}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelStrong}>{t("payment_reminder.label_youll_receive")}</Text>
                <Text style={styles.breakdownTotal}>
                  ${reminder.remainingAfter}
                </Text>
              </View>
            </View>
          </View>

          {/* XnScore warning (only when urgent) */}
          {isUrgent && (
            <View style={styles.warningCard}>
              <Ionicons
                name="alert-circle"
                size={20}
                color={RED}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>{t("payment_reminder.warning_title")}</Text>
                <Text style={styles.warningBody}>
                  If this withholding fails, your XnScore will drop 20 points
                  and you may be restricted from future advances and circles.
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.sectionCard}>
            <Text style={styles.actionsTitle}>{t("payment_reminder.actions_title")}</Text>
            <Text style={styles.actionsBody}>
              Paying early saves you fees and earns bonus XnScore points. Your
              full payout will then be available on {reminder.withholdingDate}.
            </Text>
            <TouchableOpacity
              style={styles.payEarlyButton}
              onPress={handlePayNow}
              accessibilityRole="button"
              accessibilityLabel="Pay early and save"
            >
              <Text style={styles.payEarlyText}>Pay Early & Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={handleViewDetails}
              accessibilityRole="button"
              accessibilityLabel="View advance details"
            >
              <Text style={styles.viewDetailsText}>{t("payment_reminder.btn_view_details")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action row */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.bottomOutlineButton}
            onPress={handleRemindLater}
            accessibilityRole="button"
            accessibilityLabel="Remind me later"
          >
            <Text style={styles.bottomOutlineText}>{t("payment_reminder.btn_remind_later")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomNavyButton}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.bottomNavyText}>{t("payment_reminder.btn_got_it")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingTop: 20,
    paddingBottom: 80,
    paddingHorizontal: 20,
  },
  closeRow: { flexDirection: "row", justifyContent: "flex-end" },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroBody: { alignItems: "center", marginTop: 20 },
  heroIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  heroIcon: { fontSize: 48 },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyBadgeText: { fontSize: 11, fontWeight: "700" },

  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
    textAlign: "center",
  },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  sufficiencyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sufficiencyLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  sufficiencyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sufficiencyLabel: { fontSize: 13, color: MUTED },
  sufficiencyAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  sufficiencyStatus: { fontSize: 12, fontWeight: "600" },

  breakdownCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
  },
  breakdownList: { gap: 10 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  breakdownLabelStrong: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  breakdownValueWhite: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  breakdownValueAmber: { fontSize: 14, fontWeight: "600", color: AMBER },
  breakdownTotal: { fontSize: 20, fontWeight: "700", color: TEAL },
  breakdownDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: RED,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#991B1B",
  },
  warningBody: {
    fontSize: 12,
    color: RED,
    lineHeight: 18,
    marginTop: 4,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },
  actionsBody: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 18,
    marginBottom: 12,
  },
  payEarlyButton: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
    marginBottom: 10,
  },
  payEarlyText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  viewDetailsButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  viewDetailsText: { fontSize: 14, fontWeight: "600", color: NAVY },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  bottomRow: { flexDirection: "row", gap: 10 },
  bottomOutlineButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  bottomOutlineText: { fontSize: 14, fontWeight: "600", color: NAVY },
  bottomNavyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
  },
  bottomNavyText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
});
