import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useSavings, GOAL_TYPES } from "../context/SavingsContext";

type NavigationProp = StackNavigationProp<RootStackParamList>;
type WithdrawRouteProp = RouteProp<RootStackParamList, "WithdrawFromGoal">;

export default function WithdrawFromGoalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<WithdrawRouteProp>();
  const { goalId } = route.params;

  const { getGoalById, withdraw } = useSavings();
  const goal = getGoalById(goalId);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Goal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = GOAL_TYPES[goal.type];
  const withdrawAmount = parseFloat(amount) || 0;
  const availableBalance = goal.currentBalance;
  const isValidAmount = withdrawAmount > 0 && withdrawAmount <= availableBalance;

  // Check if early withdrawal from locked goal
  const isLockedGoal = goal.type === "locked";
  const isBeforeMaturity = goal.maturityDate && new Date(goal.maturityDate) > new Date();
  const penaltyRate = isLockedGoal && isBeforeMaturity ? (goal.earlyWithdrawalPenalty || 0.10) : 0;
  const penaltyAmount = withdrawAmount * penaltyRate;
  const netAmount = withdrawAmount - penaltyAmount;

  // Emergency fund delay
  const isEmergencyFund = goal.type === "emergency";
  const withdrawalDelay = isEmergencyFund ? "24-48 hours" : "Instant";

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDaysUntilMaturity = () => {
    if (!goal.maturityDate) return null;
    const diff = new Date(goal.maturityDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleQuickAmount = (percent: number) => {
    const value = (availableBalance * percent) / 100;
    setAmount(value.toFixed(2));
  };

  const handleWithdraw = async () => {
    if (!isValidAmount) return;

    // Confirm if there's a penalty
    if (penaltyAmount > 0) {
      Alert.alert(
        "Early Withdrawal Penalty",
        `A 10% early withdrawal penalty of ${formatCurrency(penaltyAmount)} will be applied.\n\nYou will receive: ${formatCurrency(netAmount)}\n\nDo you want to proceed?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Proceed",
            style: "destructive",
            onPress: processWithdrawal,
          },
        ]
      );
    } else if (isEmergencyFund) {
      Alert.alert(
        "Emergency Withdrawal",
        `Your withdrawal request will be processed within 24-48 hours.\n\nAmount: ${formatCurrency(withdrawAmount)}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: processWithdrawal,
          },
        ]
      );
    } else {
      processWithdrawal();
    }
  };

  const processWithdrawal = async () => {
    setIsProcessing(true);
    try {
      await withdraw(goalId, withdrawAmount, reason || "Withdrawal");
      Alert.alert(
        "Withdrawal Successful!",
        isEmergencyFund
          ? `Your withdrawal of ${formatCurrency(withdrawAmount)} is being processed. Funds will be available within 24-48 hours.`
          : `${formatCurrency(netAmount)} has been withdrawn from "${goal.name}"`,
        [
          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to process withdrawal");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#0A2342" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Withdraw</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Goal Card */}
          <View style={[styles.goalCard, { borderColor: typeConfig.color }]}>
            <View style={[styles.goalIcon, { backgroundColor: typeConfig.bgColor }]}>
              <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            </View>
            <View style={styles.goalInfo}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalType}>{typeConfig.name}</Text>
            </View>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Available</Text>
              <Text style={styles.balanceValue}>{formatCurrency(availableBalance)}</Text>
            </View>
          </View>

          {/* Warning for Locked Goals */}
          {isLockedGoal && isBeforeMaturity && (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color="#EF4444" />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Early Withdrawal Penalty</Text>
                <Text style={styles.warningText}>
                  This goal matures in {getDaysUntilMaturity()} days. Withdrawing early
                  will incur a {(penaltyRate * 100).toFixed(0)}% penalty.
                </Text>
              </View>
            </View>
          )}

          {/* Info for Emergency Fund */}
          {isEmergencyFund && (
            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Processing Time</Text>
                <Text style={styles.infoText}>
                  Emergency fund withdrawals are processed within 24-48 hours
                  to ensure you have time to consider the withdrawal.
                </Text>
              </View>
            </View>
          )}

          {/* Amount Input */}
          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>WITHDRAWAL AMOUNT</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
            {withdrawAmount > availableBalance && (
              <Text style={styles.errorText}>
                Amount exceeds available balance
              </Text>
            )}
          </View>

          {/* Quick Amounts */}
          <View style={styles.quickAmountsSection}>
            <View style={styles.quickAmountsRow}>
              {[25, 50, 75, 100].map((percent) => (
                <TouchableOpacity
                  key={percent}
                  style={styles.quickAmountButton}
                  onPress={() => handleQuickAmount(percent)}
                >
                  <Text style={styles.quickAmountText}>
                    {percent === 100 ? "All" : `${percent}%`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Reason */}
          <View style={styles.reasonSection}>
            <Text style={styles.sectionLabel}>REASON (OPTIONAL)</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Why are you withdrawing?"
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Summary */}
          {withdrawAmount > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Withdrawal Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Withdrawal Amount</Text>
                <Text style={styles.summaryValue}>{formatCurrency(withdrawAmount)}</Text>
              </View>

              {penaltyAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: "#EF4444" }]}>
                    Early Withdrawal Penalty ({(penaltyRate * 100).toFixed(0)}%)
                  </Text>
                  <Text style={[styles.summaryValue, { color: "#EF4444" }]}>
                    -{formatCurrency(penaltyAmount)}
                  </Text>
                </View>
              )}

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>You'll Receive</Text>
                <Text style={styles.summaryTotalValue}>{formatCurrency(netAmount)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Processing Time</Text>
                <Text style={styles.summaryValue}>{withdrawalDelay}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Remaining Balance</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(availableBalance - withdrawAmount)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.withdrawButton,
              (!isValidAmount || isProcessing) && styles.withdrawButtonDisabled,
            ]}
            onPress={handleWithdraw}
            disabled={!isValidAmount || isProcessing}
          >
            <Ionicons name="arrow-up-circle" size={20} color="#FFFFFF" />
            <Text style={styles.withdrawButtonText}>
              {isProcessing
                ? "Processing..."
                : `Withdraw ${withdrawAmount > 0 ? formatCurrency(netAmount) : ""}`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0A2342",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  goalEmoji: {
    fontSize: 22,
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  goalType: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  balanceInfo: {
    alignItems: "flex-end",
  },
  balanceLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#7F1D1D",
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#78350F",
    lineHeight: 18,
  },
  amountSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: "700",
    color: "#0A2342",
    paddingVertical: 8,
  },
  quickAmountsSection: {
    marginBottom: 20,
  },
  quickAmountsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  reasonSection: {
    marginBottom: 20,
  },
  reasonInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 80,
    textAlignVertical: "top",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
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
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10B981",
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 16,
  },
  withdrawButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
