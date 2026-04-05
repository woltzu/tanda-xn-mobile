import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useWallet } from "../context/WalletContext";

type SupportDreamNavigationProp = StackNavigationProp<RootStackParamList>;
type SupportDreamRouteProp = RouteProp<RootStackParamList, "SupportDream">;

type PaymentMethod = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const paymentMethods: PaymentMethod[] = [
  {
    id: "wallet",
    name: "TandaXn Wallet",
    icon: "wallet",
    description: "Pay from your wallet balance",
  },
  {
    id: "bank",
    name: "Bank Transfer",
    icon: "business",
    description: "Transfer from your bank account",
  },
  {
    id: "debit",
    name: "Debit Card",
    icon: "card",
    description: "Pay with your debit card",
  },
  {
    id: "mobile",
    name: "Mobile Money",
    icon: "phone-portrait",
    description: "M-Pesa, MTN Mobile Money, etc.",
  },
];

export default function SupportDreamScreen() {
  const navigation = useNavigation<SupportDreamNavigationProp>();
  const route = useRoute<SupportDreamRouteProp>();
  const {
    authorName,
    goalName,
    goalEmoji,
    targetAmount,
    currentBalance,
  } = route.params;

  const { getCurrencyBalance, sendMoney } = useWallet();

  const [amountText, setAmountText] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("wallet");
  const [isProcessing, setIsProcessing] = useState(false);

  const amount = parseFloat(amountText) || 0;
  const walletBalance = getCurrencyBalance("USD");
  const hasEnoughBalance = selectedMethod !== "wallet" || walletBalance >= amount;
  const remaining = Math.max(0, targetAmount - currentBalance);
  const progress = targetAmount > 0 ? Math.min(1, currentBalance / targetAmount) : 0;

  const canSubmit = amount > 0 && hasEnoughBalance && !isProcessing;

  const handleConfirmPayment = async () => {
    if (amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount greater than $0.");
      return;
    }

    if (selectedMethod === "wallet" && !hasEnoughBalance) {
      Alert.alert(
        "Insufficient Balance",
        "Your wallet balance is not enough. Please add funds or choose a different payment method.",
        [{ text: "OK" }]
      );
      return;
    }

    setIsProcessing(true);

    try {
      const transactionId = await sendMoney(
        amount,
        authorName,
        selectedMethod,
        "USD"
      );

      navigation.navigate("WalletTransactionSuccess", {
        type: "send",
        amount,
        method: selectedMethod === "wallet"
          ? "TandaXn Wallet"
          : selectedMethod === "bank"
          ? "Bank Transfer"
          : selectedMethod === "debit"
          ? "Debit Card"
          : "Mobile Money",
        recipientName: authorName,
        transactionId,
      });
    } catch (error) {
      Alert.alert(
        "Payment Failed",
        "There was an error processing your payment. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAmount = (value: number) => {
    setAmountText(value.toString());
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Support a Dream</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Dream Info */}
          <View style={styles.dreamInfo}>
            <View style={styles.dreamIconContainer}>
              <Text style={styles.dreamEmoji}>{goalEmoji}</Text>
            </View>
            <Text style={styles.dreamName}>{goalName}</Text>
            <Text style={styles.dreamAuthor}>by {authorName}</Text>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Progress Card */}
          {targetAmount > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Dream Progress</Text>
                <Text style={styles.progressPercent}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFill, { width: `${Math.min(100, progress * 100)}%` }]}
                />
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressRaised}>
                  ${currentBalance.toLocaleString()} raised
                </Text>
                <Text style={styles.progressTarget}>
                  of ${targetAmount.toLocaleString()}
                </Text>
              </View>
              {remaining > 0 && (
                <Text style={styles.progressRemaining}>
                  ${remaining.toLocaleString()} still needed
                </Text>
              )}
            </View>
          )}

          {/* Amount Input */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>How much would you like to send?</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.amountDollar}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={setAmountText}
                returnKeyType="done"
              />
            </View>

            {/* Quick Amount Buttons */}
            <View style={styles.quickAmountsRow}>
              {[5, 10, 25, 50].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.quickAmountBtn,
                    amount === val && styles.quickAmountBtnActive,
                  ]}
                  onPress={() => handleQuickAmount(val)}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      amount === val && styles.quickAmountTextActive,
                    ]}
                  >
                    ${val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {remaining > 0 && remaining <= 500 && (
              <TouchableOpacity
                style={styles.remainingBtn}
                onPress={() => handleQuickAmount(remaining)}
              >
                <Ionicons name="star" size={14} color="#00C6AE" />
                <Text style={styles.remainingBtnText}>
                  Fund the remaining ${remaining.toLocaleString()}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Payment Methods */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment Method</Text>

            {paymentMethods.map((method) => {
              const isSelected = selectedMethod === method.id;
              const isWallet = method.id === "wallet";
              const insufficientBalance = isWallet && amount > 0 && walletBalance < amount;

              return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethodCard,
                    isSelected && styles.paymentMethodCardSelected,
                    insufficientBalance && isSelected && styles.paymentMethodCardWarning,
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                >
                  <View
                    style={[
                      styles.paymentMethodIcon,
                      isSelected && styles.paymentMethodIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={method.icon}
                      size={22}
                      color={isSelected ? "#FFFFFF" : "#00C6AE"}
                    />
                  </View>

                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodName}>{method.name}</Text>
                    <Text style={styles.paymentMethodDesc}>
                      {method.description}
                    </Text>
                    {isWallet && (
                      <View style={styles.balanceRow}>
                        <Text
                          style={[
                            styles.balanceText,
                            insufficientBalance && styles.balanceTextInsufficient,
                          ]}
                        >
                          Balance: ${walletBalance.toFixed(2)}
                        </Text>
                        {insufficientBalance && (
                          <View style={styles.insufficientBadge}>
                            <Text style={styles.insufficientText}>
                              Insufficient
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View
                    style={[
                      styles.radioButton,
                      isSelected && styles.radioButtonSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioButtonInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Summary */}
          {amount > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Recipient</Text>
                <Text style={styles.summaryValue}>{authorName}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Dream</Text>
                <Text style={styles.summaryValue}>
                  {goalEmoji} {goalName}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Processing Fee</Text>
                <Text style={[styles.summaryValue, { color: "#00C6AE" }]}>
                  $0.00
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${amount.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Ionicons name="heart" size={18} color="#00897B" />
            <Text style={styles.infoNoteText}>
              Your support goes directly to {authorName} to help them reach
              their dream. Every bit counts!
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomLabel}>You'll Send</Text>
          <Text style={styles.bottomAmount}>
            ${amount > 0 ? amount.toFixed(2) : "0.00"}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            !canSubmit && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmPayment}
          disabled={!canSubmit}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="hand-left" size={18} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>
                {amount > 0
                  ? `Send $${amount.toFixed(2)}`
                  : "Enter Amount"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  dreamInfo: {
    alignItems: "center",
  },
  dreamIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  dreamEmoji: {
    fontSize: 28,
  },
  dreamName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  dreamAuthor: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  content: {
    padding: 20,
    paddingBottom: 180,
  },
  // Progress card
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00C6AE",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressRaised: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  progressTarget: {
    fontSize: 13,
    color: "#6B7280",
  },
  progressRemaining: {
    fontSize: 12,
    color: "#D97706",
    marginTop: 6,
    fontWeight: "500",
  },
  // Amount input
  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 14,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  amountDollar: {
    fontSize: 36,
    fontWeight: "700",
    color: "#0A2342",
    marginRight: 4,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: "700",
    color: "#0A2342",
    minWidth: 100,
    textAlign: "center",
  },
  quickAmountsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  quickAmountBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quickAmountBtnActive: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  quickAmountTextActive: {
    color: "#FFFFFF",
  },
  remainingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#00C6AE",
    marginTop: 4,
  },
  remainingBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  // Payment methods
  paymentSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  paymentMethodCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  paymentMethodCardWarning: {
    borderColor: "#F59E0B",
  },
  paymentMethodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentMethodIconSelected: {
    backgroundColor: "#00C6AE",
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  paymentMethodDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00C6AE",
  },
  balanceTextInsufficient: {
    color: "#F59E0B",
  },
  insufficientBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  insufficientText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#D97706",
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonSelected: {
    borderColor: "#00C6AE",
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00C6AE",
  },
  // Summary
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    fontWeight: "600",
    color: "#0A2342",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  // Info note
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 17,
  },
  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bottomSummary: {
    flex: 1,
  },
  bottomLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  bottomAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    flex: 1.5,
  },
  confirmButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
