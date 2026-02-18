import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useWallet } from "../context/WalletContext";

type WithdrawNavigationProp = StackNavigationProp<RootStackParamList>;

type WithdrawMethod = {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  available: boolean;
  fee?: string;
  processingTime?: string;
  lastUsed?: string;
};

const WITHDRAW_METHODS: WithdrawMethod[] = [
  {
    id: "bank",
    name: "Bank Account",
    description: "Chase Bank ****4521",
    icon: "business-outline",
    available: true,
    fee: "Free",
    processingTime: "1-3 business days",
    lastUsed: "Dec 15",
  },
  {
    id: "debit",
    name: "Debit Card",
    description: "Visa ****8847",
    icon: "card-outline",
    available: true,
    fee: "$1.50",
    processingTime: "Instant",
  },
  {
    id: "mobile",
    name: "Mobile Money",
    description: "Orange Money +221 77 XXX XX42",
    icon: "phone-portrait-outline",
    available: true,
    fee: "2%",
    processingTime: "Instant",
  },
  {
    id: "cash",
    name: "Cash Pickup",
    description: "Pick up at partner locations",
    icon: "cash-outline",
    available: true,
    fee: "1%",
    processingTime: "Same day",
  },
];

export default function WithdrawScreen() {
  const navigation = useNavigation<WithdrawNavigationProp>();
  const { balance, withdraw } = useWallet();
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const selectedMethodData = WITHDRAW_METHODS.find((m) => m.id === selectedMethod);

  const getFee = () => {
    if (!selectedMethodData || !selectedMethodData.fee) return 0;
    if (selectedMethodData.fee === "Free") return 0;
    if (selectedMethodData.fee.startsWith("$")) {
      return parseFloat(selectedMethodData.fee.replace("$", ""));
    }
    const feePercent = parseFloat(selectedMethodData.fee.replace("%", "") || "0");
    return (numericAmount * feePercent) / 100;
  };

  const fee = getFee();
  const youReceive = numericAmount - fee;
  const canContinue = numericAmount >= 10 && numericAmount <= balance && selectedMethod !== null;

  const handleWithdrawAll = () => {
    setAmount(balance.toString());
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsProcessing(true);
    try {
      // Withdraw from wallet context
      await withdraw(numericAmount, selectedMethodData?.name || "");

      // Navigate to success screen
      navigation.navigate("WalletTransactionSuccess", {
        type: "withdraw",
        amount: numericAmount,
        method: selectedMethodData?.name || "",
        transactionId: `TXN${Date.now()}`,
      });
    } catch (error) {
      console.error("Error withdrawing:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Withdraw</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Available Balance */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Amount Input */}
          <View style={styles.amountSection}>
            <View style={styles.amountHeader}>
              <Text style={styles.sectionTitle}>Withdraw Amount</Text>
              <TouchableOpacity onPress={handleWithdrawAll}>
                <Text style={styles.withdrawAllText}>Withdraw All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>
            {numericAmount > balance && (
              <Text style={styles.errorText}>Insufficient balance</Text>
            )}
            {numericAmount > 0 && numericAmount < 10 && (
              <Text style={styles.errorText}>Minimum withdrawal is $10.00</Text>
            )}
          </View>

          {/* Withdraw Methods */}
          <View style={styles.methodsSection}>
            <Text style={styles.sectionTitle}>Withdraw To</Text>
            {WITHDRAW_METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  selectedMethod === method.id && styles.methodCardSelected,
                  !method.available && styles.methodCardDisabled,
                ]}
                onPress={() => method.available && setSelectedMethod(method.id)}
                disabled={!method.available}
              >
                <View style={styles.methodLeft}>
                  <View
                    style={[
                      styles.methodIcon,
                      selectedMethod === method.id && styles.methodIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={method.icon}
                      size={22}
                      color={selectedMethod === method.id ? "#00C6AE" : "#6B7280"}
                    />
                  </View>
                  <View style={styles.methodInfo}>
                    <View style={styles.methodNameRow}>
                      <Text style={styles.methodName}>{method.name}</Text>
                      {method.lastUsed && (
                        <View style={styles.lastUsedBadge}>
                          <Text style={styles.lastUsedText}>Last used</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.methodDescription}>{method.description}</Text>
                  </View>
                </View>
                <View style={styles.methodRight}>
                  <View style={styles.methodDetails}>
                    <Text style={styles.methodFee}>{method.fee}</Text>
                    <Text style={styles.methodTime}>{method.processingTime}</Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedMethod === method.id && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedMethod === method.id && <View style={styles.radioInner} />}
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add New Method */}
            <TouchableOpacity style={styles.addMethodButton}>
              <Ionicons name="add-circle-outline" size={22} color="#00C6AE" />
              <Text style={styles.addMethodText}>Add New Withdrawal Method</Text>
            </TouchableOpacity>
          </View>

          {/* Summary */}
          {numericAmount > 0 && selectedMethod && numericAmount <= balance && (
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Withdrawal Amount</Text>
                  <Text style={styles.summaryValue}>${numericAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Fee ({selectedMethodData?.fee})
                  </Text>
                  <Text style={styles.summaryValueNegative}>-${fee.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>You Receive</Text>
                  <Text style={styles.summaryTotalValue}>${youReceive.toFixed(2)}</Text>
                </View>
              </View>

              {/* Processing Time Notice */}
              <View style={styles.noticeCard}>
                <Ionicons name="time-outline" size={18} color="#1565C0" />
                <Text style={styles.noticeText}>
                  Processing time: {selectedMethodData?.processingTime}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue || isProcessing}
          >
            {isProcessing ? (
              <Text style={styles.continueButtonText}>Processing...</Text>
            ) : (
              <>
                <Ionicons name="arrow-up-circle" size={20} color="#FFFFFF" />
                <Text style={styles.continueButtonText}>
                  Withdraw ${numericAmount > 0 ? numericAmount.toFixed(2) : "0.00"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  amountSection: {
    marginBottom: 24,
  },
  amountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  withdrawAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0A2342",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    color: "#0A2342",
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    marginTop: 8,
  },
  methodsSection: {
    marginBottom: 24,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  methodCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  methodCardDisabled: {
    opacity: 0.5,
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  methodIconSelected: {
    backgroundColor: "#E0F7F4",
  },
  methodInfo: {
    flex: 1,
  },
  methodNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  methodName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  lastUsedBadge: {
    backgroundColor: "#E0F7F4",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lastUsedText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#00C6AE",
  },
  methodDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  methodRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  methodDetails: {
    alignItems: "flex-end",
  },
  methodFee: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  methodTime: {
    fontSize: 11,
    color: "#6B7280",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#00C6AE",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00C6AE",
  },
  addMethodButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#00C6AE",
    borderRadius: 12,
    borderStyle: "dashed",
    marginTop: 6,
  },
  addMethodText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  summaryValueNegative: {
    fontSize: 14,
    fontWeight: "500",
    color: "#DC2626",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginTop: 12,
  },
  noticeText: {
    fontSize: 13,
    color: "#1565C0",
    flex: 1,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  continueButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
