import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAdvance, AdvanceRequest } from "../context/AdvanceContext";
import { useWallet } from "../context/WalletContext";
import { useCurrency } from "../context/CurrencyContext";

type AdvanceRepaymentRouteProp = RouteProp<RootStackParamList, "AdvanceRepayment">;
type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function AdvanceRepaymentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AdvanceRepaymentRouteProp>();
  const { advanceId } = route.params;
  const { getAdvanceById, makeRepayment } = useAdvance();
  const { balance } = useWallet();
  const { formatAmount, CURRENCIES } = useCurrency();

  const [advance, setAdvance] = useState<AdvanceRequest | undefined>();
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");

  useEffect(() => {
    const adv = getAdvanceById(advanceId);
    setAdvance(adv);
    if (adv) {
      // Default to remaining amount
      setAmount(adv.remainingAmount.toFixed(2));
    }
  }, [advanceId, getAdvanceById]);

  const parsedAmount = parseFloat(amount) || 0;
  const currencyInfo = advance ? CURRENCIES[advance.currency] : null;
  const walletBalance = currencyInfo
    ? balance.find(b => b.currency === advance?.currency)?.amount || 0
    : 0;

  const isValidAmount = parsedAmount > 0 && parsedAmount <= (advance?.remainingAmount || 0);
  const hasEnoughBalance = paymentMethod === "wallet" ? walletBalance >= parsedAmount : true;

  const handleQuickAmount = (percent: number) => {
    if (!advance) return;
    const quickAmount = (advance.remainingAmount * percent) / 100;
    setAmount(quickAmount.toFixed(2));
  };

  const handlePayFull = () => {
    if (!advance) return;
    setAmount(advance.remainingAmount.toFixed(2));
  };

  const handleSubmitPayment = async () => {
    if (!advance || !isValidAmount || !hasEnoughBalance) return;

    setIsProcessing(true);
    try {
      await makeRepayment(advanceId, parsedAmount);

      const updatedAdvance = getAdvanceById(advanceId);
      const isFullyPaid = updatedAdvance?.status === "completed";

      Alert.alert(
        isFullyPaid ? "Advance Fully Repaid!" : "Payment Successful!",
        isFullyPaid
          ? "Congratulations! You have fully repaid your advance. Your XnScore will be positively affected."
          : `${formatAmount(parsedAmount, advance.currency)} has been applied to your advance.`,
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("AdvanceDetails", { advanceId }),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Payment Failed", "Unable to process your payment. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!advance) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.loadingText}>Loading advance details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const repaymentProgress = advance.totalRepayment > 0
    ? (advance.repaidAmount / advance.totalRepayment) * 100
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Make Repayment</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Advance Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{advance.circleName}</Text>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Repayment Progress</Text>
                <Text style={styles.progressPercent}>{repaymentProgress.toFixed(0)}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${repaymentProgress}%` }]} />
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Total Owed</Text>
                <Text style={styles.summaryItemValue}>
                  {formatAmount(advance.totalRepayment, advance.currency)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Already Paid</Text>
                <Text style={[styles.summaryItemValue, styles.paidValue]}>
                  {formatAmount(advance.repaidAmount, advance.currency)}
                </Text>
              </View>
            </View>

            <View style={styles.remainingBox}>
              <Ionicons name="wallet-outline" size={20} color="#F59E0B" />
              <Text style={styles.remainingLabel}>Remaining Balance:</Text>
              <Text style={styles.remainingValue}>
                {formatAmount(advance.remainingAmount, advance.currency)}
              </Text>
            </View>
          </View>

          {/* Payment Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Amount</Text>
            <View style={styles.amountInputCard}>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencySymbol}>{currencyInfo?.symbol || "$"}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              {parsedAmount > advance.remainingAmount && (
                <Text style={styles.errorText}>
                  Amount exceeds remaining balance
                </Text>
              )}
            </View>

            {/* Quick Amount Buttons */}
            <View style={styles.quickAmountRow}>
              <TouchableOpacity
                style={styles.quickAmountBtn}
                onPress={() => handleQuickAmount(25)}
              >
                <Text style={styles.quickAmountText}>25%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAmountBtn}
                onPress={() => handleQuickAmount(50)}
              >
                <Text style={styles.quickAmountText}>50%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAmountBtn}
                onPress={() => handleQuickAmount(75)}
              >
                <Text style={styles.quickAmountText}>75%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAmountBtn, styles.fullPayBtn]}
                onPress={handlePayFull}
              >
                <Text style={[styles.quickAmountText, styles.fullPayText]}>Pay Full</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === "wallet" && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod("wallet")}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={[styles.paymentIcon, { backgroundColor: "#D1FAE5" }]}>
                  <Ionicons name="wallet" size={20} color="#10B981" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>TandaXn Wallet</Text>
                  <Text style={styles.paymentBalance}>
                    Balance: {formatAmount(walletBalance, advance.currency)}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.radioOuter,
                paymentMethod === "wallet" && styles.radioOuterSelected,
              ]}>
                {paymentMethod === "wallet" && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === "card" && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod("card")}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={[styles.paymentIcon, { backgroundColor: "#DBEAFE" }]}>
                  <Ionicons name="card" size={20} color="#3B82F6" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Debit/Credit Card</Text>
                  <Text style={styles.paymentBalance}>Visa ending in ****4242</Text>
                </View>
              </View>
              <View style={[
                styles.radioOuter,
                paymentMethod === "card" && styles.radioOuterSelected,
              ]}>
                {paymentMethod === "card" && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            {paymentMethod === "wallet" && walletBalance < parsedAmount && parsedAmount > 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color="#F59E0B" />
                <Text style={styles.warningText}>
                  Insufficient wallet balance. Add funds or use a different payment method.
                </Text>
              </View>
            )}
          </View>

          {/* Payment Summary */}
          {parsedAmount > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Summary</Text>
              <View style={styles.paymentSummaryCard}>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Payment Amount</Text>
                  <Text style={styles.paymentSummaryValue}>
                    {formatAmount(parsedAmount, advance.currency)}
                  </Text>
                </View>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Remaining After Payment</Text>
                  <Text style={[styles.paymentSummaryValue, styles.remainingAfter]}>
                    {formatAmount(Math.max(0, advance.remainingAmount - parsedAmount), advance.currency)}
                  </Text>
                </View>
                {parsedAmount >= advance.remainingAmount && (
                  <View style={styles.fullPaymentBanner}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.fullPaymentText}>
                      This will fully repay your advance!
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Benefits of Early Repayment */}
          <View style={styles.section}>
            <View style={styles.benefitsCard}>
              <View style={styles.benefitsHeader}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.benefitsTitle}>Benefits of Early Repayment</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={styles.benefitText}>Boost your XnScore by up to 5 points</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="ribbon" size={16} color="#10B981" />
                <Text style={styles.benefitText}>Unlock higher advance limits</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                <Text style={styles.benefitText}>Build trust within your circles</Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isValidAmount || !hasEnoughBalance) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitPayment}
            disabled={!isValidAmount || !hasEnoughBalance || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  Pay {formatAmount(parsedAmount, advance.currency)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A2342",
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00C6AE",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryItemLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  summaryItemValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  paidValue: {
    color: "#10B981",
  },
  remainingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
  },
  remainingLabel: {
    fontSize: 14,
    color: "#92400E",
    marginLeft: 8,
  },
  remainingValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amountInputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: "700",
    color: "#6B7280",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    color: "#1F2937",
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 8,
  },
  quickAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickAmountBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: "center",
  },
  fullPayBtn: {
    backgroundColor: "#00C6AE",
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  fullPayText: {
    color: "#FFFFFF",
  },
  paymentOption: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  paymentOptionSelected: {
    borderColor: "#00C6AE",
  },
  paymentOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  paymentInfo: {
    justifyContent: "center",
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  paymentBalance: {
    fontSize: 13,
    color: "#6B7280",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
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
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    marginLeft: 8,
  },
  paymentSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  paymentSummaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  remainingAfter: {
    color: "#F59E0B",
  },
  fullPaymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  fullPaymentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46",
    marginLeft: 8,
  },
  benefitsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  benefitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 13,
    color: "#D1D5DB",
    marginLeft: 10,
  },
  bottomPadding: {
    height: 100,
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  submitButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#4B5563",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
