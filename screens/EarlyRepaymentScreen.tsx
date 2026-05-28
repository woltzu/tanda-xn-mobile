// ══════════════════════════════════════════════════════════════════════════════
// screens/EarlyRepaymentScreen.tsx — ADVANCE-012 pay off advance early
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 114-ADVANCE-012-EarlyRepayment.jsx.
//
// Reached from AdvanceDetailsV2 or AdvanceStatusDashboard's
// "Repay Early" button. Surfaces savings (fee reduction + XnScore
// bonus), an option comparison (wait vs pay today), a payment-method
// picker, a required acknowledgment checkbox, and a benefits list.
//
// Route params (all optional, defaults match canonical mock):
//   advanceId?: string                ← lookup key (forwarded by
//                                       caller)
//   advance?: EarlyRepayDetails       ← pre-resolved object
//   walletBalance?: number
//   paymentMethods?: PaymentMethod[]
//
// Navigation:
//   - back → goBack
//   - "Pay $X & Close Advance" → RepaymentConfirm
//     { advanceId, amountPaid, paidFrom }
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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";

type EarlyRepayDetails = {
  id: string;
  originalAmount: number;
  originalFee: number;
  originalTotal: number;
  currentBalance: number;
  feeIfPaidNow: number;
  feeSavings: number;
  daysRemaining: number;
  withholdingDate: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  balance?: number;
  type?: string;
  icon: string;
};

type EarlyRepaymentParams = {
  advanceId?: string;
  advance?: EarlyRepayDetails;
  walletBalance?: number;
  paymentMethods?: PaymentMethod[];
};
type EarlyRepaymentRouteProp = RouteProp<
  { EarlyRepayment: EarlyRepaymentParams },
  "EarlyRepayment"
>;

const DEFAULT_ADVANCE: EarlyRepayDetails = {
  id: "ADV-2025-0120-001",
  originalAmount: 300,
  originalFee: 15,
  originalTotal: 315,
  currentBalance: 310,
  feeIfPaidNow: 10,
  feeSavings: 5,
  daysRemaining: 20,
  withholdingDate: "Feb 15, 2025",
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "wallet", name: "TandaXn Wallet", balance: 450, icon: "💳" },
  { id: "bank", name: "Chase ••••4521", type: "Bank", icon: "🏦" },
];

const BENEFITS = [
  { icon: "💰", textTemplate: (savings: number) => `Save $${savings} in advance fees` },
  { icon: "⭐", textTemplate: () => "+2 bonus XnScore points" },
  { icon: "🔓", textTemplate: () => "Free up your payout for other uses" },
  { icon: "📈", textTemplate: () => "Improve eligibility for larger advances" },
];

export default function EarlyRepaymentScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<EarlyRepaymentRouteProp>();

  const advance = route.params?.advance ?? DEFAULT_ADVANCE;
  const advanceId = route.params?.advanceId ?? advance.id;
  const walletBalance = route.params?.walletBalance ?? 450;
  const paymentMethods =
    route.params?.paymentMethods ?? DEFAULT_PAYMENT_METHODS;

  const [selectedMethod, setSelectedMethod] = useState<string>(
    paymentMethods[0]?.id ?? "wallet",
  );
  const [confirmed, setConfirmed] = useState(false);

  const payoffAmount = advance.originalAmount + advance.feeIfPaidNow;
  const hasEnoughBalance =
    selectedMethod !== "wallet" || walletBalance >= payoffAmount;
  const canSubmit = confirmed && hasEnoughBalance;

  const handleConfirm = () => {
    if (!canSubmit) return;
    const selected = paymentMethods.find((m) => m.id === selectedMethod);
    navigation.navigate(Routes.RepaymentConfirm, {
      advanceId,
      amountPaid: payoffAmount,
      feeSaved: advance.feeSavings,
      paidFrom: selected?.name ?? "TandaXn Wallet",
    });
  };

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
              <Text style={styles.headerTitle}>Early Repayment</Text>
              <Text style={styles.headerSubtitle}>
                Pay off your advance today
              </Text>
            </View>
          </View>

          <View style={styles.payoffBlock}>
            <Text style={styles.payoffLabel}>Pay off amount</Text>
            <Text style={styles.payoffAmount}>${payoffAmount}</Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Savings highlight */}
          <View style={styles.savingsCard}>
            <View style={styles.savingsIcon}>
              <Ionicons name="cash" size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savingsTitle}>
                Save ${advance.feeSavings} in fees!
              </Text>
              <Text style={styles.savingsBody}>
                Plus earn +2 bonus XnScore points for early repayment
              </Text>
            </View>
          </View>

          {/* Comparison */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Compare Your Options</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.compChip}>
                <Text style={styles.compEyebrow}>WAIT FOR PAYOUT</Text>
                <Text style={styles.compHint}>
                  Pay on {advance.withholdingDate}
                </Text>
                <Text style={styles.compAmountGrey}>
                  ${advance.originalTotal}
                </Text>
                <Text style={styles.compFooter}>
                  Full fee: ${advance.originalFee}
                </Text>
              </View>
              <View style={styles.compChipWin}>
                <Text style={styles.compEyebrowWin}>PAY TODAY ✓</Text>
                <Text style={styles.compHintWin}>
                  Save ${advance.feeSavings}
                </Text>
                <Text style={styles.compAmountTeal}>${payoffAmount}</Text>
                <Text style={styles.compFooterWin}>
                  Reduced fee: ${advance.feeIfPaidNow}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment method */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Pay From</Text>
            <View style={styles.methodsList}>
              {paymentMethods.map((method) => (
                <MethodRow
                  key={method.id}
                  method={method}
                  selected={selectedMethod === method.id}
                  payoffAmount={payoffAmount}
                  onPress={() => setSelectedMethod(method.id)}
                />
              ))}
            </View>
            {selectedMethod === "wallet" && !hasEnoughBalance && (
              <View style={styles.insufficientBox}>
                <Text style={styles.insufficientText}>
                  ⚠️ Insufficient wallet balance. Add $
                  {(payoffAmount - walletBalance).toFixed(2)} or choose another
                  payment method.
                </Text>
              </View>
            )}
          </View>

          {/* Confirmation checkbox */}
          <TouchableOpacity
            style={[
              styles.confirmRow,
              confirmed && styles.confirmRowChecked,
            ]}
            onPress={() => setConfirmed(!confirmed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
            accessibilityLabel="Confirm early repayment"
          >
            <View
              style={[
                styles.confirmBox,
                confirmed && styles.confirmBoxChecked,
              ]}
            >
              {confirmed && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.confirmText}>
              I understand that paying ${payoffAmount} today will close this
              advance immediately and I will save ${advance.feeSavings} in fees.
            </Text>
          </TouchableOpacity>

          {/* Benefits */}
          <View style={styles.sectionCard}>
            <Text style={styles.benefitsTitle}>
              Benefits of early repayment:
            </Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((b, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{b.icon}</Text>
                  <Text style={styles.benefitText}>
                    {b.textTemplate(advance.feeSavings)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            !canSubmit && styles.primaryButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          accessibilityLabel={`Pay ${payoffAmount} and close advance`}
        >
          <Text
            style={[
              styles.primaryButtonText,
              !canSubmit && styles.primaryButtonTextDisabled,
            ]}
          >
            Pay ${payoffAmount} & Close Advance
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function MethodRow({
  method,
  selected,
  payoffAmount,
  onPress,
}: {
  method: PaymentMethod;
  selected: boolean;
  payoffAmount: number;
  onPress: () => void;
}) {
  const insufficient =
    method.balance !== undefined && method.balance < payoffAmount;
  return (
    <TouchableOpacity
      style={[styles.methodRow, selected && styles.methodRowSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={method.name}
    >
      <View style={styles.methodLeft}>
        <Text style={styles.methodIcon}>{method.icon}</Text>
        <View>
          <Text style={styles.methodName}>{method.name}</Text>
          {method.balance !== undefined && (
            <Text
              style={[
                styles.methodSub,
                { color: insufficient ? RED : TEAL },
              ]}
            >
              Balance: ${method.balance.toFixed(2)}
              {insufficient && " (insufficient)"}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
        {selected && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 80, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
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

  payoffBlock: { alignItems: "center" },
  payoffLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  payoffAmount: { fontSize: 42, fontWeight: "700", color: "#FFFFFF" },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  savingsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: TEAL,
  },
  savingsIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  savingsTitle: { fontSize: 18, fontWeight: "700", color: "#065F46" },
  savingsBody: { fontSize: 13, color: "#047857", marginTop: 4 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  comparisonRow: { flexDirection: "row", gap: 12 },
  compChip: {
    flex: 1,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    alignItems: "center",
  },
  compChipWin: {
    flex: 1,
    padding: 14,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: TEAL,
    alignItems: "center",
  },
  compEyebrow: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
    marginBottom: 8,
  },
  compEyebrowWin: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
    marginBottom: 8,
  },
  compHint: { fontSize: 11, color: MUTED, marginBottom: 4 },
  compHintWin: { fontSize: 11, color: "#00897B", marginBottom: 4 },
  compAmountGrey: {
    fontSize: 22,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 8,
  },
  compAmountTeal: {
    fontSize: 22,
    fontWeight: "700",
    color: TEAL,
    marginBottom: 8,
  },
  compFooter: { fontSize: 11, color: MUTED },
  compFooterWin: { fontSize: 11, color: "#00897B" },

  methodsList: { gap: 8 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  methodRowSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  methodLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  methodIcon: { fontSize: 20 },
  methodName: { fontSize: 14, fontWeight: "600", color: NAVY },
  methodSub: { fontSize: 12, marginTop: 2 },

  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: { backgroundColor: TEAL, borderColor: TEAL },

  insufficientBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  insufficientText: { fontSize: 12, color: RED },

  confirmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  confirmRowChecked: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  confirmBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  confirmBoxChecked: {
    backgroundColor: TEAL,
    borderWidth: 0,
  },
  confirmText: {
    flex: 1,
    fontSize: 13,
    color: NAVY,
    lineHeight: 20,
  },

  benefitsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 10,
  },
  benefitsList: { gap: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitIcon: { fontSize: 16 },
  benefitText: { flex: 1, fontSize: 12, color: "#4B5563" },

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
  primaryButtonDisabled: { backgroundColor: BORDER },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  primaryButtonTextDisabled: { color: "#9CA3AF" },
});
