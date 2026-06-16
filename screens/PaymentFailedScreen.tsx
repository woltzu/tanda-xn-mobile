// ══════════════════════════════════════════════════════════════════════════════
// screens/PaymentFailedScreen.tsx — ADVANCE-014 payment failure recovery
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 116-ADVANCE-014-PaymentFailed.jsx.
//
// Reached when an automatic withholding fails. Carries:
//   - Red-gradient hero with a failure-reason-specific title + body
//   - Amber grace-period warning with the XnScore penalty preview
//   - Payment-details list (advance ID, amount, method, failed-at,
//     and conditional wallet/shortfall rows when reason is
//     insufficient_funds)
//   - Recovery options card (Add Funds / Try Different Method / Retry)
//   - Help row (Request Hardship / Contact Support)
//   - Bottom CTA dynamically labelled per reason
//
// Route params (all optional, defaults match canonical mock):
//   failureDetails?: FailureDetails
//   gracePeriod?: GracePeriod
//
// Navigation:
//   - "Add Funds" / bottom CTA when insufficient_funds → AddFunds
//   - "Try Different Method" → AdvanceDisbursement
//   - "Retry Payment" / bottom CTA otherwise → EarlyRepayment
//                                              { advanceId }
//   - "Request Hardship" → HardshipRequest { advanceId }
//   - "Contact Support" → HelpCenter
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
const RED_DARK = "#B91C1C";

type FailureReason =
  | "insufficient_funds"
  | "card_declined"
  | "bank_error"
  | "network_error";

type FailureDetails = {
  advanceId: string;
  attemptedAmount: number;
  paymentMethod: string;
  failureReason: FailureReason;
  failedAt: string;
  walletBalance: number;
  shortfall: number;
};

type GracePeriod = {
  daysRemaining: number;
  deadline: string;
  penaltyIfMissed: number;
};

type PaymentFailedParams = {
  failureDetails?: FailureDetails;
  gracePeriod?: GracePeriod;
};
type PaymentFailedRouteProp = RouteProp<
  { PaymentFailed: PaymentFailedParams },
  "PaymentFailed"
>;

const DEFAULT_FAILURE: FailureDetails = {
  advanceId: "ADV-2025-0120-001",
  attemptedAmount: 315,
  paymentMethod: "TandaXn Wallet",
  failureReason: "insufficient_funds",
  failedAt: "Feb 15, 2025 at 9:00 AM",
  walletBalance: 180,
  shortfall: 135,
};

const DEFAULT_GRACE: GracePeriod = {
  daysRemaining: 3,
  deadline: "Feb 18, 2025",
  penaltyIfMissed: 20,
};

function failureMessage(failure: FailureDetails) {
  switch (failure.failureReason) {
    case "insufficient_funds":
      return {
        title: "Insufficient Wallet Balance",
        description: `Your wallet has $${failure.walletBalance}, but $${failure.attemptedAmount} is needed. You're short $${failure.shortfall}.`,
      };
    case "card_declined":
      return {
        title: "Card Declined",
        description:
          "Your bank declined the transaction. This could be due to insufficient funds or security restrictions.",
      };
    case "bank_error":
      return {
        title: "Bank Connection Error",
        description:
          "We couldn't connect to your bank. This may be a temporary issue.",
      };
    case "network_error":
      return {
        title: "Network Error",
        description:
          "The payment couldn't be processed due to a connection issue. Please try again.",
      };
  }
}

export default function PaymentFailedScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<PaymentFailedRouteProp>();
  const { t } = useTranslation();
  const failure = route.params?.failureDetails ?? DEFAULT_FAILURE;
  const grace = route.params?.gracePeriod ?? DEFAULT_GRACE;
  const message = failureMessage(failure);
  const isInsufficient = failure.failureReason === "insufficient_funds";

  const handleAddFunds = () => navigation.navigate(Routes.AddFunds);
  const handleChangeMethod = () =>
    navigation.navigate(Routes.AdvanceDetailsV2, {
      advanceId: failure.advanceId,
    });
  const handleRetry = () =>
    navigation.navigate(Routes.EarlyRepayment, {
      advanceId: failure.advanceId,
    });
  const handleHardship = () =>
    navigation.navigate(Routes.HardshipRequest, {
      advanceId: failure.advanceId,
    });
  const handleSupport = () => navigation.navigate(Routes.HelpCenter);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={RED_DARK} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Red-gradient error hero */}
        <LinearGradient
          colors={[RED, RED_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIconBox}>
            <Ionicons name="close" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{message.title}</Text>
          <Text style={styles.heroBody}>{message.description}</Text>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Grace period warning */}
          <View style={styles.graceCard}>
            <View style={styles.graceHeader}>
              <View style={styles.graceIconBox}>
                <Ionicons name="time-outline" size={24} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.graceTitle}>
                  {grace.daysRemaining} Days Grace Period
                </Text>
                <Text style={styles.graceBody}>
                  Resolve by {grace.deadline} to avoid penalties
                </Text>
              </View>
            </View>
            <View style={styles.gracePenalty}>
              <Text style={styles.gracePenaltyText}>
                ⚠️ If not resolved: Your XnScore will drop by{" "}
                <Text style={styles.gracePenaltyStrong}>
                  {grace.penaltyIfMissed} points
                </Text>{" "}
                and you may be restricted from future advances and circles.
              </Text>
            </View>
          </View>

          {/* Payment details */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("payment_failed.section_details")}</Text>
            <View style={styles.detailsList}>
              <DetailRow label="Advance ID" value={failure.advanceId} />
              <DetailRow
                label="Amount due"
                value={`$${failure.attemptedAmount}`}
                valueStyle={styles.amountDue}
              />
              <DetailRow label="Payment method" value={failure.paymentMethod} />
              <DetailRow label="Failed at" value={failure.failedAt} />
              {isInsufficient && (
                <>
                  <View style={styles.divider} />
                  <DetailRow
                    label="Wallet balance"
                    value={`$${failure.walletBalance}`}
                    valueStyle={{ color: AMBER }}
                  />
                  <DetailRow
                    label="Shortfall"
                    value={`$${failure.shortfall}`}
                    valueStyle={styles.shortfall}
                  />
                </>
              )}
            </View>
          </View>

          {/* Recovery options */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("payment_failed.section_how_fix")}</Text>
            <View style={styles.optionsList}>
              {isInsufficient && (
                <TouchableOpacity
                  style={styles.primaryRow}
                  onPress={handleAddFunds}
                  accessibilityRole="button"
                  accessibilityLabel={`Add $${failure.shortfall} to wallet`}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryRowText}>
                    Add ${failure.shortfall} to Wallet
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.outlineRow}
                onPress={handleChangeMethod}
                accessibilityRole="button"
                accessibilityLabel="Try different payment method"
              >
                <Ionicons name="card-outline" size={18} color={NAVY} />
                <Text style={styles.outlineRowText}>
                  Try Different Payment Method
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outlineRow}
                onPress={handleRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry payment"
              >
                <Ionicons name="refresh" size={18} color={NAVY} />
                <Text style={styles.outlineRowText}>{t("payment_failed.btn_retry")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Help row */}
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>{t("payment_failed.help_title")}</Text>
            <View style={styles.helpRow}>
              <TouchableOpacity
                style={styles.helpButton}
                onPress={handleHardship}
                accessibilityRole="button"
                accessibilityLabel="Request hardship"
              >
                <Text style={styles.helpButtonText}>{t("payment_failed.btn_hardship")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.helpButton}
                onPress={handleSupport}
                accessibilityRole="button"
                accessibilityLabel="Contact support"
              >
                <Text style={styles.helpButtonText}>{t("payment_failed.btn_contact_support")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={isInsufficient ? handleAddFunds : handleRetry}
          accessibilityRole="button"
          accessibilityLabel={
            isInsufficient
              ? `Add ${failure.shortfall} dollars and pay now`
              : "Retry payment"
          }
        >
          <Text style={styles.primaryButtonText}>
            {isInsufficient
              ? `Add $${failure.shortfall} & Pay Now`
              : "Retry Payment"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 280,
    textAlign: "center",
    lineHeight: 22,
  },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  graceCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: AMBER,
  },
  graceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  graceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  graceTitle: { fontSize: 16, fontWeight: "700", color: "#92400E" },
  graceBody: { fontSize: 12, color: "#B45309", marginTop: 2 },
  gracePenalty: {
    backgroundColor: "rgba(217,119,6,0.1)",
    borderRadius: 8,
    padding: 10,
  },
  gracePenaltyText: { fontSize: 12, color: "#92400E", lineHeight: 18 },
  gracePenaltyStrong: { fontWeight: "700" },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  detailsList: { gap: 6 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: { fontSize: 13, color: MUTED },
  detailValue: { fontSize: 13, fontWeight: "600", color: NAVY },
  amountDue: { fontSize: 16, fontWeight: "700", color: RED },
  shortfall: { fontSize: 14, fontWeight: "700", color: RED },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },

  optionsList: { gap: 10 },
  primaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TEAL,
  },
  primaryRowText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  outlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  outlineRowText: { fontSize: 14, fontWeight: "600", color: NAVY },

  helpCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 10,
  },
  helpRow: { flexDirection: "row", gap: 10 },
  helpButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  helpButtonText: { fontSize: 12, fontWeight: "600", color: NAVY },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
