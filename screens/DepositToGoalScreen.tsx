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
type DepositRouteProp = RouteProp<RootStackParamList, "DepositToGoal">;

const QUICK_AMOUNTS = [25, 50, 100, 250, 500, 1000];

export default function DepositToGoalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DepositRouteProp>();
  const { goalId } = route.params;

  const { getGoalById, getActiveGoals, deposit } = useSavings();
  const goal = getGoalById(goalId);
  const activeGoals = getActiveGoals();

  const [selectedGoalId, setSelectedGoalId] = useState(goalId);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedGoal = getGoalById(selectedGoalId);
  const typeConfig = selectedGoal ? GOAL_TYPES[selectedGoal.type] : null;

  const depositAmount = parseFloat(amount) || 0;
  const minDeposit = typeConfig?.minDeposit || 5;
  const isValidAmount = depositAmount >= minDeposit;
  const remainingToTarget = selectedGoal
    ? selectedGoal.targetAmount - selectedGoal.currentBalance
    : 0;

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleDeposit = async () => {
    if (!selectedGoal || !isValidAmount) return;

    setIsProcessing(true);
    try {
      await deposit(selectedGoalId, depositAmount, note || "Deposit");
      Alert.alert(
        "Deposit Successful!",
        `${formatCurrency(depositAmount)} has been added to "${selectedGoal.name}"`,
        [
          {
            text: "View Goal",
            onPress: () => navigation.replace("GoalDetails", { goalId: selectedGoalId }),
          },
          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to make deposit");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!selectedGoal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Goal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>Add to Goal</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Goal Selector */}
          {activeGoals.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT GOAL</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {activeGoals.map((g) => {
                  const config = GOAL_TYPES[g.type];
                  const isSelected = g.id === selectedGoalId;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        styles.goalOption,
                        isSelected && { borderColor: config.color },
                      ]}
                      onPress={() => setSelectedGoalId(g.id)}
                    >
                      <View style={[styles.goalOptionIcon, { backgroundColor: config.bgColor }]}>
                        <Text style={styles.goalOptionEmoji}>{g.emoji}</Text>
                      </View>
                      <Text style={styles.goalOptionName} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text style={styles.goalOptionBalance}>
                        {formatCurrency(g.currentBalance)}
                      </Text>
                      {isSelected && (
                        <View style={[styles.selectedIndicator, { backgroundColor: config.color }]}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Selected Goal Card */}
          <View style={[styles.selectedGoalCard, { borderColor: typeConfig?.color }]}>
            <View style={[styles.selectedGoalIcon, { backgroundColor: typeConfig?.bgColor }]}>
              <Text style={styles.selectedGoalEmoji}>{selectedGoal.emoji}</Text>
            </View>
            <View style={styles.selectedGoalInfo}>
              <Text style={styles.selectedGoalName}>{selectedGoal.name}</Text>
              <View style={styles.selectedGoalProgress}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((selectedGoal.currentBalance / selectedGoal.targetAmount) * 100, 100)}%`,
                        backgroundColor: typeConfig?.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {formatCurrency(selectedGoal.currentBalance)} of {formatCurrency(selectedGoal.targetAmount)}
                </Text>
              </View>
            </View>
          </View>

          {/* Amount Input */}
          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>AMOUNT</Text>
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
            {depositAmount > 0 && depositAmount < minDeposit && (
              <Text style={styles.minAmountWarning}>
                Minimum deposit: {formatCurrency(minDeposit)}
              </Text>
            )}
            {remainingToTarget > 0 && (
              <Text style={styles.remainingText}>
                {formatCurrency(remainingToTarget)} remaining to reach target
              </Text>
            )}
          </View>

          {/* Quick Amounts */}
          <View style={styles.quickAmountsSection}>
            <View style={styles.quickAmountsGrid}>
              {QUICK_AMOUNTS.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.quickAmountButton,
                    parseFloat(amount) === value && styles.quickAmountButtonSelected,
                  ]}
                  onPress={() => handleQuickAmount(value)}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      parseFloat(amount) === value && styles.quickAmountTextSelected,
                    ]}
                  >
                    ${value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {remainingToTarget > 0 && remainingToTarget < 10000 && (
              <TouchableOpacity
                style={styles.fillRemainingButton}
                onPress={() => setAmount(remainingToTarget.toFixed(2))}
              >
                <Text style={styles.fillRemainingText}>
                  Fill remaining ({formatCurrency(remainingToTarget)})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Note */}
          <View style={styles.noteSection}>
            <Text style={styles.sectionLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="e.g., Birthday money, Tax refund"
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Interest Preview */}
          {depositAmount > 0 && (
            <View style={styles.interestPreview}>
              <Ionicons name="trending-up" size={18} color="#10B981" />
              <Text style={styles.interestText}>
                This deposit will earn approximately{" "}
                <Text style={styles.interestAmount}>
                  {formatCurrency(depositAmount * (selectedGoal.interestRate || 0))}
                </Text>{" "}
                in interest per year ({((selectedGoal.interestRate || 0) * 100).toFixed(1)}% APY)
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.depositButton,
              (!isValidAmount || isProcessing) && styles.depositButtonDisabled,
            ]}
            onPress={handleDeposit}
            disabled={!isValidAmount || isProcessing}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.depositButtonText}>
              {isProcessing
                ? "Processing..."
                : `Deposit ${depositAmount > 0 ? formatCurrency(depositAmount) : ""}`}
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
    fontSize: 16,
    color: "#6B7280",
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
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  goalOption: {
    width: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  goalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  goalOptionEmoji: {
    fontSize: 18,
  },
  goalOptionName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
    textAlign: "center",
    marginBottom: 2,
  },
  goalOptionBalance: {
    fontSize: 11,
    color: "#6B7280",
  },
  selectedIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedGoalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
  },
  selectedGoalIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  selectedGoalEmoji: {
    fontSize: 24,
  },
  selectedGoalInfo: {
    flex: 1,
  },
  selectedGoalName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  selectedGoalProgress: {},
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
  },
  amountSection: {
    marginBottom: 20,
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
  minAmountWarning: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 8,
  },
  remainingText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },
  quickAmountsSection: {
    marginBottom: 20,
  },
  quickAmountsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickAmountButton: {
    width: "31%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quickAmountButtonSelected: {
    backgroundColor: "#0A2342",
    borderColor: "#0A2342",
  },
  quickAmountText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  quickAmountTextSelected: {
    color: "#FFFFFF",
  },
  fillRemainingButton: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  fillRemainingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  noteSection: {
    marginBottom: 20,
  },
  noteInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 60,
    textAlignVertical: "top",
  },
  interestPreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 14,
  },
  interestText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
    lineHeight: 18,
  },
  interestAmount: {
    fontWeight: "600",
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  depositButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
  },
  depositButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  depositButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
