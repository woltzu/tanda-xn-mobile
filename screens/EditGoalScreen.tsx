import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useSavings, GOAL_TYPES, GoalType } from "../context/SavingsContext";

type NavigationProp = StackNavigationProp<RootStackParamList>;
type EditGoalRouteProp = RouteProp<RootStackParamList, "EditGoal">;

const UPGRADE_PATHS: Record<GoalType, GoalType[]> = {
  flexible: ["emergency", "locked"],
  emergency: ["locked"],
  locked: [], // Cannot upgrade from locked
};

export default function EditGoalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditGoalRouteProp>();
  const { goalId } = route.params;

  const { getGoalById, updateGoal } = useSavings();
  const goal = getGoalById(goalId);

  // Auto-save settings
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSavePercent, setAutoSavePercent] = useState(10);
  const [autoReplenish, setAutoReplenish] = useState(false);
  const [autoSavePriority, setAutoSavePriority] = useState(1);

  // Goal details
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");

  // Upgrade
  const [showUpgradeSection, setShowUpgradeSection] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<GoalType | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize state from goal
  useEffect(() => {
    if (goal) {
      setGoalName(goal.name);
      setTargetAmount(goal.targetAmount.toString());
      setSelectedEmoji(goal.emoji);
      setAutoSaveEnabled(goal.autoSaveEnabled);
      setAutoSavePercent(goal.autoSavePercent || 10);
      setAutoReplenish(goal.autoReplenish || false);
      setAutoSavePriority(goal.autoSavePriority || 1);
    }
  }, [goal]);

  // Track changes
  useEffect(() => {
    if (goal) {
      const changed =
        goalName !== goal.name ||
        parseFloat(targetAmount) !== goal.targetAmount ||
        selectedEmoji !== goal.emoji ||
        autoSaveEnabled !== goal.autoSaveEnabled ||
        autoSavePercent !== (goal.autoSavePercent || 10) ||
        autoReplenish !== (goal.autoReplenish || false) ||
        autoSavePriority !== (goal.autoSavePriority || 1) ||
        selectedUpgrade !== null;
      setHasChanges(changed);
    }
  }, [
    goal,
    goalName,
    targetAmount,
    selectedEmoji,
    autoSaveEnabled,
    autoSavePercent,
    autoReplenish,
    autoSavePriority,
    selectedUpgrade,
  ]);

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Goal not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = GOAL_TYPES[goal.type];
  const upgradableTo = UPGRADE_PATHS[goal.type];

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsProcessing(true);
    try {
      const updates: any = {
        name: goalName,
        emoji: selectedEmoji,
        targetAmount: parseFloat(targetAmount) || goal.targetAmount,
        autoSaveEnabled,
        autoSavePercent: autoSaveEnabled ? autoSavePercent : 0,
        autoReplenish: autoSaveEnabled && autoReplenish,
        autoSavePriority: autoSaveEnabled ? autoSavePriority : 99,
      };

      // Handle upgrade
      if (selectedUpgrade) {
        const newTypeConfig = GOAL_TYPES[selectedUpgrade];
        updates.type = selectedUpgrade;
        updates.interestRate = newTypeConfig.interestRate;

        // If upgrading to locked, set maturity date
        if (selectedUpgrade === "locked") {
          const maturityDate = new Date();
          maturityDate.setMonth(maturityDate.getMonth() + 6); // Default 6 months
          updates.maturityDate = maturityDate.toISOString();
          updates.lockDurationMonths = 6;
          updates.earlyWithdrawalPenalty = 0.10;
        }
      }

      await updateGoal(goalId, updates);

      Alert.alert(
        "Changes Saved",
        selectedUpgrade
          ? `Goal upgraded to ${GOAL_TYPES[selectedUpgrade].name}!`
          : "Your goal settings have been updated.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save changes");
    } finally {
      setIsProcessing(false);
    }
  };

  const EMOJIS = ["🎯", "🏠", "✈️", "🚗", "💼", "🎓", "🛡️", "💒", "🏖️", "💰", "📚", "🎁"];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#0A2342" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Goal</Text>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isProcessing}
        >
          <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
            {isProcessing ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Goal Info */}
        <View style={[styles.currentGoalCard, { borderColor: typeConfig.color }]}>
          <View style={[styles.currentGoalIcon, { backgroundColor: typeConfig.bgColor }]}>
            <Text style={styles.currentGoalEmoji}>{goal.emoji}</Text>
          </View>
          <View style={styles.currentGoalInfo}>
            <Text style={styles.currentGoalName}>{goal.name}</Text>
            <View style={styles.goalTypeBadge}>
              <Text style={[styles.goalTypeText, { color: typeConfig.color }]}>
                {typeConfig.name}
              </Text>
              <Text style={styles.goalRateText}>
                {(goal.interestRate * 100).toFixed(1)}% APY
              </Text>
            </View>
          </View>
        </View>

        {/* Goal Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Goal Name</Text>
            <TextInput
              style={styles.textInput}
              value={goalName}
              onChangeText={setGoalName}
              placeholder="Enter goal name"
              placeholderTextColor="#9CA3AF"
              maxLength={30}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Target Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.currentBalanceText}>
              Current balance: {formatCurrency(goal.currentBalance)}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Icon</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiOption,
                    selectedEmoji === emoji && styles.emojiOptionSelected,
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Auto-Save Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-Save Settings</Text>

          <View style={styles.autoSaveCard}>
            <View style={styles.autoSaveHeader}>
              <View style={styles.autoSaveInfo}>
                <Ionicons name="sync" size={20} color="#F59E0B" />
                <Text style={styles.autoSaveTitle}>Auto-Save from Payouts</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, autoSaveEnabled && styles.toggleEnabled]}
                onPress={() => setAutoSaveEnabled(!autoSaveEnabled)}
              >
                <View style={[styles.toggleKnob, autoSaveEnabled && styles.toggleKnobEnabled]} />
              </TouchableOpacity>
            </View>

            {autoSaveEnabled && (
              <View style={styles.autoSaveConfig}>
                <Text style={styles.autoSaveLabel}>
                  Save {autoSavePercent}% of circle payouts
                </Text>

                {/* First row: 10-50% */}
                <View style={styles.percentOptions}>
                  {[10, 20, 30, 40, 50].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[
                        styles.percentOption,
                        autoSavePercent === pct && styles.percentOptionSelected,
                      ]}
                      onPress={() => setAutoSavePercent(pct)}
                    >
                      <Text
                        style={[
                          styles.percentText,
                          autoSavePercent === pct && styles.percentTextSelected,
                        ]}
                      >
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Second row: 60-100% */}
                <View style={[styles.percentOptions, { marginTop: 8 }]}>
                  {[60, 70, 80, 90, 100].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[
                        styles.percentOption,
                        autoSavePercent === pct && styles.percentOptionSelected,
                      ]}
                      onPress={() => setAutoSavePercent(pct)}
                    >
                      <Text
                        style={[
                          styles.percentText,
                          autoSavePercent === pct && styles.percentTextSelected,
                        ]}
                      >
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Auto-Replenish */}
                <View style={styles.replenishSection}>
                  <View style={styles.replenishHeader}>
                    <View style={styles.replenishInfo}>
                      <Ionicons name="refresh-circle" size={18} color="#10B981" />
                      <View style={styles.replenishTextContainer}>
                        <Text style={styles.replenishTitle}>Auto-Replenish (Priority)</Text>
                        <Text style={styles.replenishDesc}>
                          Automatically refill this goal first when below target
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.miniToggle, autoReplenish && styles.miniToggleEnabled]}
                      onPress={() => setAutoReplenish(!autoReplenish)}
                    >
                      <View style={[styles.miniToggleKnob, autoReplenish && styles.miniToggleKnobEnabled]} />
                    </TouchableOpacity>
                  </View>
                  {autoReplenish && (
                    <View style={styles.priorityNote}>
                      <Ionicons name="information-circle" size={14} color="#059669" />
                      <Text style={styles.priorityNoteText}>
                        This goal will be replenished first from payouts until it reaches the target
                      </Text>
                    </View>
                  )}
                </View>

                {/* Priority */}
                {!autoReplenish && (
                  <View style={styles.prioritySection}>
                    <Text style={styles.priorityLabel}>Savings Priority</Text>
                    <View style={styles.priorityOptions}>
                      {[
                        { value: 1, label: "High", desc: "Save first" },
                        { value: 2, label: "Medium", desc: "Save second" },
                        { value: 3, label: "Low", desc: "Save last" },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.priorityOption,
                            autoSavePriority === opt.value && styles.priorityOptionSelected,
                          ]}
                          onPress={() => setAutoSavePriority(opt.value)}
                        >
                          <Text
                            style={[
                              styles.priorityOptionLabel,
                              autoSavePriority === opt.value && styles.priorityOptionLabelSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={[
                              styles.priorityOptionDesc,
                              autoSavePriority === opt.value && styles.priorityOptionDescSelected,
                            ]}
                          >
                            {opt.desc}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Upgrade Section */}
        {upgradableTo.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.upgradeToggle}
              onPress={() => setShowUpgradeSection(!showUpgradeSection)}
            >
              <View style={styles.upgradeToggleLeft}>
                <Ionicons name="arrow-up-circle" size={22} color="#6366F1" />
                <Text style={styles.upgradeToggleText}>Upgrade Goal Type</Text>
              </View>
              <Ionicons
                name={showUpgradeSection ? "chevron-up" : "chevron-down"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {showUpgradeSection && (
              <View style={styles.upgradeContent}>
                <View style={styles.upgradeNote}>
                  <Ionicons name="information-circle" size={16} color="#6366F1" />
                  <Text style={styles.upgradeNoteText}>
                    You can upgrade to a higher tier for better interest rates. Downgrading is not allowed.
                  </Text>
                </View>

                {upgradableTo.map((upgradeType) => {
                  const upgradeConfig = GOAL_TYPES[upgradeType];
                  const isSelected = selectedUpgrade === upgradeType;
                  return (
                    <TouchableOpacity
                      key={upgradeType}
                      style={[
                        styles.upgradeOption,
                        isSelected && { borderColor: upgradeConfig.color },
                      ]}
                      onPress={() => setSelectedUpgrade(isSelected ? null : upgradeType)}
                    >
                      <View style={[styles.upgradeOptionIcon, { backgroundColor: upgradeConfig.bgColor }]}>
                        <Text style={styles.upgradeOptionEmoji}>{upgradeConfig.emoji}</Text>
                      </View>
                      <View style={styles.upgradeOptionInfo}>
                        <Text style={styles.upgradeOptionName}>{upgradeConfig.name}</Text>
                        <Text style={styles.upgradeOptionDesc}>{upgradeConfig.description}</Text>
                        <View style={styles.upgradeRateBadge}>
                          <Ionicons name="trending-up" size={12} color="#10B981" />
                          <Text style={styles.upgradeRateText}>
                            {(upgradeConfig.interestRate * 100).toFixed(1)}% APY
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.upgradeRadio,
                          isSelected && { borderColor: upgradeConfig.color, backgroundColor: upgradeConfig.color },
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {selectedUpgrade === "locked" && (
                  <View style={styles.lockedWarning}>
                    <Ionicons name="warning" size={16} color="#D97706" />
                    <Text style={styles.lockedWarningText}>
                      Upgrading to Locked Savings will set a 6-month lock period. Early withdrawals will incur a 10% penalty.
                    </Text>
                  </View>
                )}

                {selectedUpgrade === "emergency" && (
                  <View style={styles.emergencyInfo}>
                    <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                    <Text style={styles.emergencyInfoText}>
                      Emergency Fund has a 24-48hr withdrawal delay for better security.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Interest Comparison */}
        {selectedUpgrade && (
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonTitle}>Interest Rate Comparison</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Current</Text>
                <Text style={styles.comparisonValue}>{(goal.interestRate * 100).toFixed(1)}%</Text>
                <Text style={styles.comparisonType}>{typeConfig.name}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#6B7280" />
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>New</Text>
                <Text style={[styles.comparisonValue, { color: "#10B981" }]}>
                  {(GOAL_TYPES[selectedUpgrade].interestRate * 100).toFixed(1)}%
                </Text>
                <Text style={styles.comparisonType}>{GOAL_TYPES[selectedUpgrade].name}</Text>
              </View>
            </View>
            <Text style={styles.comparisonBonus}>
              +{((GOAL_TYPES[selectedUpgrade].interestRate - goal.interestRate) * 100).toFixed(1)}% more interest!
            </Text>
          </View>
        )}
      </ScrollView>
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#00C6AE",
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  saveButtonTextDisabled: {
    color: "#9CA3AF",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  currentGoalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
  },
  currentGoalIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  currentGoalEmoji: {
    fontSize: 24,
  },
  currentGoalInfo: {
    flex: 1,
  },
  currentGoalName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  goalTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goalTypeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  goalRateText: {
    fontSize: 12,
    color: "#6B7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    paddingVertical: 12,
  },
  currentBalanceText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emojiOptionSelected: {
    borderColor: "#00C6AE",
    borderWidth: 2,
    backgroundColor: "#F0FDFB",
  },
  emojiText: {
    fontSize: 22,
  },
  autoSaveCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  autoSaveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  autoSaveInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  autoSaveTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    padding: 3,
  },
  toggleEnabled: {
    backgroundColor: "#00C6AE",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobEnabled: {
    marginLeft: "auto",
  },
  autoSaveConfig: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  autoSaveLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  percentOptions: {
    flexDirection: "row",
    gap: 8,
  },
  percentOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  percentOptionSelected: {
    backgroundColor: "#0A2342",
  },
  percentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  percentTextSelected: {
    color: "#FFFFFF",
  },
  replenishSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  replenishHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  replenishInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 10,
  },
  replenishTextContainer: {
    flex: 1,
  },
  replenishTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  replenishDesc: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 15,
  },
  miniToggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E5E7EB",
    padding: 2,
    marginLeft: 10,
  },
  miniToggleEnabled: {
    backgroundColor: "#10B981",
  },
  miniToggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  miniToggleKnobEnabled: {
    marginLeft: "auto",
  },
  priorityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
    padding: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
  },
  priorityNoteText: {
    flex: 1,
    fontSize: 11,
    color: "#059669",
    lineHeight: 15,
  },
  prioritySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  priorityLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
  },
  priorityOptions: {
    flexDirection: "row",
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  priorityOptionSelected: {
    backgroundColor: "#0A2342",
  },
  priorityOptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  priorityOptionLabelSelected: {
    color: "#FFFFFF",
  },
  priorityOptionDesc: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  priorityOptionDescSelected: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  upgradeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  upgradeToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  upgradeToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  upgradeContent: {
    marginTop: 12,
  },
  upgradeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    marginBottom: 12,
  },
  upgradeNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#4338CA",
    lineHeight: 18,
  },
  upgradeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  upgradeOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  upgradeOptionEmoji: {
    fontSize: 22,
  },
  upgradeOptionInfo: {
    flex: 1,
  },
  upgradeOptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  upgradeOptionDesc: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 6,
  },
  upgradeRateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  upgradeRateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  upgradeRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    marginBottom: 12,
  },
  lockedWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  emergencyInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    marginBottom: 12,
  },
  emergencyInfoText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  comparisonCard: {
    backgroundColor: "#0A2342",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 12,
  },
  comparisonItem: {
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  comparisonType: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 2,
  },
  comparisonBonus: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
    textAlign: "center",
  },
});
