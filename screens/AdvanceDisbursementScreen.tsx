// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceDisbursementScreen.tsx — ADVANCE-008 funds destination picker
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 110-ADVANCE-008-AdvanceDisbursement.jsx.
//
// Lets the user choose where to receive their approved advance:
//   - TandaXn Wallet (instant, no fee — recommended)
//   - Bank Transfer (1-3 days, no fee)
//   - Instant Bank Transfer (minutes, $2.99 fee)
//
// When a bank method is selected, a sub-section appears with the
// user's linked bank accounts. If no banks are linked, an
// "Add Bank Account" placeholder is shown (the Alert wires to a real
// linking flow in Phase 3).
//
// Route params (all optional, defaults match canonical mock):
//   advanceAmount?: number
//   userBankAccounts?: BankAccount[]
//   walletBalance?: number
//
// Navigation:
//   - back → goBack
//   - "Confirm & Receive $X" → AdvanceApproval { advanceId? amount? }
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
  Alert,
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
const AMBER = "#D97706";

type MethodId = "wallet" | "bank_standard" | "bank_instant";

type BankAccount = {
  id: string;
  name: string;
  last4: string;
  type: string;
};

type AdvanceDisbursementParams = {
  advanceAmount?: number;
  userBankAccounts?: BankAccount[];
  walletBalance?: number;
};
type AdvanceDisbursementRouteProp = RouteProp<
  { AdvanceDisbursement: AdvanceDisbursementParams },
  "AdvanceDisbursement"
>;

const DEFAULT_BANKS: BankAccount[] = [
  { id: "bank1", name: "Chase Checking", last4: "4521", type: "checking" },
  { id: "bank2", name: "Bank of America", last4: "7892", type: "savings" },
];

type Option = {
  id: MethodId;
  icon: string;
  name: string;
  description: string;
  fee: number;
  time: string;
  recommended?: boolean;
};

const OPTIONS: Option[] = [
  {
    id: "wallet",
    icon: "💳",
    name: "TandaXn Wallet",
    description: "Instant • No fee",
    fee: 0,
    time: "Instant",
    recommended: true,
  },
  {
    id: "bank_standard",
    icon: "🏦",
    name: "Bank Transfer",
    description: "1-3 business days • No fee",
    fee: 0,
    time: "1-3 days",
  },
  {
    id: "bank_instant",
    icon: "⚡",
    name: "Instant Bank Transfer",
    description: "Within minutes • $2.99 fee",
    fee: 2.99,
    time: "Minutes",
  },
];

export default function AdvanceDisbursementScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<AdvanceDisbursementRouteProp>();
  const advanceAmount = route.params?.advanceAmount ?? 300;
  const userBankAccounts = route.params?.userBankAccounts ?? DEFAULT_BANKS;
  const walletBalance = route.params?.walletBalance ?? 125.5;

  const [selectedMethod, setSelectedMethod] = useState<MethodId>("wallet");
  const [selectedBank, setSelectedBank] = useState<string | null>(
    userBankAccounts[0]?.id ?? null,
  );

  const selectedOption = OPTIONS.find((o) => o.id === selectedMethod);
  const fee = selectedOption?.fee ?? 0;
  const totalReceived = advanceAmount - fee;
  const isBankMethod =
    selectedMethod === "bank_standard" || selectedMethod === "bank_instant";

  const handleConfirm = () => {
    navigation.navigate(Routes.AdvanceApproval, {
      amount: totalReceived,
      total: advanceAmount,
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
              <Text style={styles.headerTitle}>Where to Send Funds</Text>
              <Text style={styles.headerSubtitle}>
                Choose your disbursement method
              </Text>
            </View>
          </View>

          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Advance Amount</Text>
            <Text style={styles.amountValue}>${advanceAmount}</Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Method picker */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Select Disbursement Method</Text>
            <View style={styles.optionsList}>
              {OPTIONS.map((option) => (
                <MethodOption
                  key={option.id}
                  option={option}
                  selected={selectedMethod === option.id}
                  onPress={() => setSelectedMethod(option.id)}
                />
              ))}
            </View>
          </View>

          {/* Bank picker (only when bank method selected) */}
          {isBankMethod && (
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>Select Bank Account</Text>
              {userBankAccounts.length > 0 ? (
                <View style={styles.bankList}>
                  {userBankAccounts.map((bank) => (
                    <BankRow
                      key={bank.id}
                      bank={bank}
                      selected={selectedBank === bank.id}
                      onPress={() => setSelectedBank(bank.id)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyBank}>
                  <Text style={styles.emptyBankText}>
                    No bank accounts linked
                  </Text>
                  <TouchableOpacity
                    style={styles.addBankButton}
                    onPress={() =>
                      Alert.alert(
                        "Add Bank Account",
                        "Bank-linking flow will be implemented in Phase 3.",
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Add bank account"
                  >
                    <Text style={styles.addBankText}>+ Add Bank Account</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Disbursement Summary</Text>
            <View style={styles.summaryList}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Advance amount</Text>
                <Text style={styles.summaryValue}>${advanceAmount}</Text>
              </View>
              {fee > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Instant transfer fee</Text>
                  <Text style={styles.summaryFee}>-${fee.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryStrong}>You'll receive</Text>
                <Text style={styles.summaryTotal}>
                  ${totalReceived.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.deliveryRow}>
              <Ionicons name="time-outline" size={16} color={TEAL} />
              <Text style={styles.deliveryText}>
                Delivery:{" "}
                <Text style={styles.deliveryStrong}>{selectedOption?.time}</Text>
                {selectedMethod === "wallet" &&
                  ` to your TandaXn Wallet (Balance: $${walletBalance.toFixed(2)})`}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel={`Confirm and receive ${totalReceived.toFixed(2)} dollars`}
        >
          <Text style={styles.primaryButtonText}>
            Confirm & Receive ${totalReceived.toFixed(2)}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function MethodOption({
  option,
  selected,
  onPress,
}: {
  option: Option;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.name}
    >
      {option.recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
        </View>
      )}
      <View style={styles.optionLeft}>
        <View
          style={[
            styles.optionIconBox,
            { backgroundColor: selected ? TEAL : BORDER },
          ]}
        >
          <Text style={styles.optionIcon}>{option.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionName}>{option.name}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
      </View>
      <View
        style={[styles.radioDot, selected && styles.radioDotSelected]}
      >
        {selected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
  );
}

function BankRow({
  bank,
  selected,
  onPress,
}: {
  bank: BankAccount;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.bankRow, selected && styles.bankRowSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${bank.name} ending in ${bank.last4}`}
    >
      <View style={styles.bankLeft}>
        <Ionicons
          name="card-outline"
          size={20}
          color={selected ? TEAL : MUTED}
        />
        <View>
          <Text style={styles.bankName}>{bank.name}</Text>
          <Text style={styles.bankSub}>
            ••••{bank.last4} • {bank.type}
          </Text>
        </View>
      </View>
      <View style={[styles.radioDotSmall, selected && styles.radioDotSelected]}>
        {selected && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
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

  amountCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  amountValue: { fontSize: 32, fontWeight: "700", color: "#FFFFFF" },

  contentWrap: { padding: 20 },

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

  optionsList: { gap: 10 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
  },
  optionRowSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  recommendedBadge: {
    position: "absolute",
    top: -8,
    right: 12,
    backgroundColor: TEAL,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 1,
  },
  recommendedBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIcon: { fontSize: 20 },
  optionName: { fontSize: 14, fontWeight: "600", color: NAVY },
  optionDescription: { fontSize: 12, color: MUTED, marginTop: 2 },

  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },

  bankList: { gap: 8 },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  bankRowSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  bankLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  bankName: { fontSize: 14, fontWeight: "600", color: NAVY },
  bankSub: { fontSize: 12, color: MUTED, marginTop: 2 },

  emptyBank: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  emptyBankText: { fontSize: 13, color: MUTED, marginBottom: 8 },
  addBankButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: TEAL,
    borderRadius: 8,
  },
  addBankText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },

  summaryCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
  },
  summaryList: { gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  summaryStrong: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  summaryFee: { fontSize: 14, fontWeight: "600", color: AMBER },
  summaryTotal: { fontSize: 20, fontWeight: "700", color: TEAL },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
  },
  deliveryText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  deliveryStrong: { color: TEAL, fontWeight: "600" },

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
