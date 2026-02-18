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

type AddFundsNavigationProp = StackNavigationProp<RootStackParamList>;

type FundingMethod = {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  available: boolean;
  fee?: string;
  processingTime?: string;
  recommended?: boolean;
  color?: string;
};

const FUNDING_METHODS: FundingMethod[] = [
  {
    id: "bank",
    name: "Bank Transfer (ACH)",
    description: "Link your bank account for free transfers",
    icon: "business-outline",
    available: true,
    fee: "Free",
    processingTime: "1-3 business days",
    recommended: true,
    color: "#10B981",
  },
  {
    id: "debit",
    name: "Debit Card",
    description: "Instant funding with Visa or Mastercard",
    icon: "card-outline",
    available: true,
    fee: "1.5%",
    processingTime: "Instant",
    color: "#3B82F6",
  },
  {
    id: "mobile",
    name: "Mobile Money",
    description: "M-Pesa, Orange Money, Wave, MTN",
    icon: "phone-portrait-outline",
    available: true,
    fee: "1.5%",
    processingTime: "Instant",
    color: "#F59E0B",
  },
  {
    id: "apple_pay",
    name: "Apple Pay / Google Pay",
    description: "Quick payment with your phone",
    icon: "wallet-outline",
    available: true,
    fee: "1.5%",
    processingTime: "Instant",
    color: "#6B7280",
  },
];

const QUICK_AMOUNTS = [25, 50, 100, 250, 500];

export default function AddFundsScreen() {
  const navigation = useNavigation<AddFundsNavigationProp>();
  const { addFunds } = useWallet();
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const selectedMethodData = FUNDING_METHODS.find((m) => m.id === selectedMethod);

  const getFee = () => {
    if (!selectedMethodData) return 0;
    if (selectedMethodData.fee === "Free") return 0;
    const feePercent = parseFloat(selectedMethodData.fee?.replace("%", "") || "0");
    return (numericAmount * feePercent) / 100;
  };

  const fee = getFee();
  const totalAmount = numericAmount + fee;
  const canContinue = numericAmount >= 10 && selectedMethod !== null;

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsProcessing(true);
    try {
      // Add funds to wallet context
      await addFunds(numericAmount, selectedMethodData?.name || "");

      // Navigate to success screen
      navigation.navigate("WalletTransactionSuccess", {
        type: "add",
        amount: numericAmount,
        method: selectedMethodData?.name || "",
        transactionId: `TXN${Date.now()}`,
      });
    } catch (error) {
      console.error("Error adding funds:", error);
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
            <Text style={styles.headerTitle}>Add Funds</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Amount Display in Header */}
          <View style={styles.amountDisplay}>
            <Text style={styles.amountDisplayLabel}>Amount to add</Text>
            <View style={styles.amountDisplayRow}>
              <Text style={styles.amountDisplayCurrency}>$</Text>
              <TextInput
                style={styles.amountDisplayInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="decimal-pad"
              />
            </View>
            {numericAmount > 0 && numericAmount < 10 && (
              <Text style={styles.amountWarning}>Minimum amount is $10</Text>
            )}
          </View>

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.quickAmountButton,
                  amount === value.toString() && styles.quickAmountButtonActive,
                ]}
                onPress={() => handleQuickAmount(value)}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    amount === value.toString() && styles.quickAmountTextActive,
                  ]}
                >
                  ${value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Funding Methods */}
          <View style={styles.methodsSection}>
            <Text style={styles.sectionTitle}>How would you like to add funds?</Text>
            {FUNDING_METHODS.map((method) => (
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
                      { backgroundColor: `${method.color}15` },
                      selectedMethod === method.id && styles.methodIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={method.icon}
                      size={22}
                      color={selectedMethod === method.id ? "#00C6AE" : method.color}
                    />
                  </View>
                  <View style={styles.methodInfo}>
                    <View style={styles.methodNameRow}>
                      <Text style={styles.methodName}>{method.name}</Text>
                      {method.recommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedText}>Best Value</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.methodDescription}>{method.description}</Text>
                    <View style={styles.methodMeta}>
                      <View style={[styles.methodMetaItem, method.fee === "Free" && styles.freeTag]}>
                        <Text style={[styles.methodFee, method.fee === "Free" && styles.freeText]}>
                          {method.fee}
                        </Text>
                      </View>
                      <Text style={styles.methodDot}>•</Text>
                      <Text style={styles.methodTime}>{method.processingTime}</Text>
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    selectedMethod === method.id && styles.radioOuterSelected,
                  ]}
                >
                  {selectedMethod === method.id && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          {numericAmount >= 10 && selectedMethod && (
            <View style={styles.summarySection}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Ionicons name="receipt-outline" size={18} color="#00C6AE" />
                  <Text style={styles.summaryHeaderText}>Transaction Summary</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount to add</Text>
                  <Text style={styles.summaryValue}>${numericAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Processing fee {selectedMethodData?.fee !== "Free" && `(${selectedMethodData?.fee})`}
                  </Text>
                  <Text style={[styles.summaryValue, fee === 0 && styles.freeValue]}>
                    {fee === 0 ? "Free" : `$${fee.toFixed(2)}`}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>You'll pay</Text>
                  <Text style={styles.summaryTotalValue}>${totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.walletReceiveRow}>
                  <View style={styles.walletIcon}>
                    <Ionicons name="wallet" size={16} color="#00C6AE" />
                  </View>
                  <Text style={styles.walletReceiveText}>
                    ${numericAmount.toFixed(2)} will be added to your wallet
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark" size={18} color="#10B981" />
            <Text style={styles.securityNoteText}>
              All transactions are secured with bank-level encryption
            </Text>
          </View>
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
                <Text style={styles.continueButtonText}>
                  {numericAmount >= 10 && selectedMethod
                    ? `Add $${numericAmount.toFixed(2)} to Wallet`
                    : "Enter amount & select method"
                  }
                </Text>
                {canContinue && <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
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
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
  amountDisplay: {
    alignItems: "center",
    marginBottom: 20,
  },
  amountDisplayLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  amountDisplayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  amountDisplayCurrency: {
    fontSize: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 4,
    marginRight: 4,
  },
  amountDisplayInput: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
    minWidth: 60,
    textAlign: "center",
  },
  amountWarning: {
    fontSize: 12,
    color: "#F59E0B",
    marginTop: 8,
  },
  quickAmounts: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  quickAmountButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  quickAmountButtonActive: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  quickAmountTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  methodsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 14,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    alignItems: "flex-start",
    flex: 1,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
    flexWrap: "wrap",
    marginBottom: 4,
  },
  methodName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginRight: 8,
  },
  recommendedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065F46",
  },
  methodDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
  },
  methodMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  methodMetaItem: {
    marginRight: 4,
  },
  freeTag: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  methodFee: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  freeText: {
    color: "#065F46",
  },
  methodDot: {
    fontSize: 12,
    color: "#9CA3AF",
    marginHorizontal: 6,
  },
  methodTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  summarySection: {
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  summaryHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginLeft: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
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
  freeValue: {
    color: "#10B981",
    fontWeight: "600",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 10,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  walletReceiveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  walletIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  walletReceiveText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#00C6AE",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  securityNoteText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 8,
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
