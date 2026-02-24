import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  PanResponder,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import {
  useSavings,
  GOAL_TYPES,
  GOAL_CATEGORIES,
  LOCKED_TERM_OPTIONS,
  GoalType,
} from "../context/SavingsContext";
import { showToast } from "../components/Toast";

type NavigationProp = StackNavigationProp<RootStackParamList>;
type CreateGoalRouteProp = RouteProp<RootStackParamList, "CreateGoal">;

export default function CreateGoalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CreateGoalRouteProp>();
  const { createGoal, deposit } = useSavings();

  const preselectedType = route.params?.goalType;

  // Form state
  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState<GoalType | null>(preselectedType || null);
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState("🎯");
  const [lockTerm, setLockTerm] = useState(6); // months
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSavePercent, setAutoSavePercent] = useState(10);
  const [autoReplenish, setAutoReplenish] = useState(false);
  const [autoSavePriority, setAutoSavePriority] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const typeConfig = goalType ? GOAL_TYPES[goalType] : null;
  const selectedLockOption = LOCKED_TERM_OPTIONS.find(o => o.months === lockTerm);

  const getInterestRate = () => {
    if (!goalType) return 0;
    if (goalType === "locked" && selectedLockOption) {
      return selectedLockOption.interestRate;
    }
    return GOAL_TYPES[goalType].interestRate;
  };

  const calculateProjectedEarnings = () => {
    const target = parseFloat(targetAmount) || 0;
    const rate = getInterestRate();
    const years = goalType === "locked" ? lockTerm / 12 : 1;
    return target * rate * years;
  };

  const handleNext = () => {
    if (step === 1 && !goalType) {
      Alert.alert("Select Goal Type", "Please select a savings type to continue");
      return;
    }
    if (step === 2 && (!goalName || !targetAmount)) {
      Alert.alert("Missing Information", "Please enter a name and target amount");
      return;
    }
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleCreateGoal();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleCreateGoal = async () => {
    if (!goalType) return;

    setIsProcessing(true);
    try {
      const maturityDate = goalType === "locked"
        ? new Date(Date.now() + lockTerm * 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const newGoal = await createGoal({
        userId: "user_001",
        name: goalName,
        emoji: selectedEmoji,
        type: goalType,
        currency: "USD",
        currentBalance: 0,
        targetAmount: parseFloat(targetAmount) || 0,
        interestRate: getInterestRate(),
        lockDurationMonths: goalType === "locked" ? lockTerm : undefined,
        maturityDate,
        earlyWithdrawalPenalty: goalType === "locked" ? 0.10 : undefined,
        autoSaveEnabled,
        autoSavePercent: autoSaveEnabled ? autoSavePercent : 0,
        autoSaveFromCircles: [],
        autoSavePriority: autoSaveEnabled ? autoSavePriority : 99,
        autoReplenish: autoSaveEnabled && autoReplenish,
      });

      // Make initial deposit if provided
      const depositAmount = parseFloat(initialDeposit);
      if (depositAmount > 0) {
        await deposit(newGoal.id, depositAmount, "Initial deposit");
      }

      Alert.alert(
        "Goal Created!",
        `Your "${goalName}" goal has been created successfully.`,
        [
          {
            text: "View Goal",
            onPress: () => navigation.replace("GoalDetails", { goalId: newGoal.id }),
          },
          {
            text: "Done",
            onPress: () => navigation.navigate("GoalsHub"),
          },
        ]
      );
    } catch (error) {
      console.error("[CreateGoal] Error:", error);
      Alert.alert("Error", "Failed to create goal. Please try again.");
      showToast("Failed to create goal", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Choose Savings Type</Text>
      <Text style={styles.stepSubtitle}>
        Select the type of savings that fits your goal
      </Text>

      {Object.values(GOAL_TYPES).map((type) => (
        <TouchableOpacity
          key={type.type}
          style={[
            styles.typeOption,
            goalType === type.type && styles.typeOptionSelected,
            { borderColor: goalType === type.type ? type.color : "#E5E7EB" },
          ]}
          onPress={() => setGoalType(type.type)}
        >
          <View style={[styles.typeOptionIcon, { backgroundColor: type.bgColor }]}>
            <Text style={styles.typeOptionEmoji}>{type.emoji}</Text>
          </View>
          <View style={styles.typeOptionContent}>
            <View style={styles.typeOptionHeader}>
              <Text style={styles.typeOptionName}>{type.name}</Text>
              <View style={[styles.rateBadge, { backgroundColor: type.bgColor }]}>
                <Text style={[styles.rateText, { color: type.color }]}>
                  {(type.interestRate * 100).toFixed(1)}% APY
                </Text>
              </View>
            </View>
            <Text style={styles.typeOptionDesc}>{type.description}</Text>
            <View style={styles.typeOptionFeatures}>
              {type.features.map((feature, idx) => (
                <View key={idx} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={14} color={type.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
          {goalType === type.type && (
            <View style={[styles.selectedCheck, { backgroundColor: type.color }]}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Goal Details</Text>
      <Text style={styles.stepSubtitle}>
        Tell us about your savings goal
      </Text>

      {/* Category Selection */}
      <Text style={styles.inputLabel}>Category (Optional)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {GOAL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipSelected,
            ]}
            onPress={() => {
              setSelectedCategory(cat.id);
              setSelectedEmoji(cat.emoji);
            }}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text
              style={[
                styles.categoryText,
                selectedCategory === cat.id && styles.categoryTextSelected,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Goal Name */}
      <Text style={styles.inputLabel}>Goal Name</Text>
      <TextInput
        style={styles.textInput}
        value={goalName}
        onChangeText={setGoalName}
        placeholder="e.g., First Home, Emergency Fund"
        placeholderTextColor="#9CA3AF"
      />

      {/* Target Amount */}
      <Text style={styles.inputLabel}>Target Amount</Text>
      <View style={styles.amountInputContainer}>
        <Text style={styles.currencyPrefix}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={targetAmount}
          onChangeText={setTargetAmount}
          placeholder="0.00"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
        />
      </View>

      {/* Initial Deposit */}
      <Text style={styles.inputLabel}>Initial Deposit (Optional)</Text>
      <View style={styles.amountInputContainer}>
        <Text style={styles.currencyPrefix}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={initialDeposit}
          onChangeText={setInitialDeposit}
          placeholder="0.00"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
        />
      </View>

      {/* Lock Term (for locked goals) */}
      {goalType === "locked" && (
        <>
          <Text style={styles.inputLabel}>Lock Period</Text>
          <View style={styles.lockTermOptions}>
            {LOCKED_TERM_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.months}
                style={[
                  styles.lockTermOption,
                  lockTerm === option.months && styles.lockTermOptionSelected,
                ]}
                onPress={() => setLockTerm(option.months)}
              >
                <Text
                  style={[
                    styles.lockTermLabel,
                    lockTerm === option.months && styles.lockTermLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.lockTermRate,
                    lockTerm === option.months && styles.lockTermRateSelected,
                  ]}
                >
                  {option.bonus}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review & Confirm</Text>
      <Text style={styles.stepSubtitle}>
        Make sure everything looks right
      </Text>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryIcon, { backgroundColor: typeConfig?.bgColor }]}>
            <Text style={styles.summaryEmoji}>{selectedEmoji}</Text>
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryName}>{goalName || "My Goal"}</Text>
            <View style={styles.summaryTypeBadge}>
              <View style={[styles.typeDot, { backgroundColor: typeConfig?.color }]} />
              <Text style={styles.summaryTypeText}>{typeConfig?.name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Target Amount</Text>
          <Text style={styles.summaryValue}>
            ${parseFloat(targetAmount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Initial Deposit</Text>
          <Text style={styles.summaryValue}>
            ${parseFloat(initialDeposit || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Interest Rate</Text>
          <Text style={[styles.summaryValue, { color: "#10B981" }]}>
            {(getInterestRate() * 100).toFixed(1)}% APY
          </Text>
        </View>

        {goalType === "locked" && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Lock Period</Text>
            <Text style={styles.summaryValue}>{lockTerm} months</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Projected Interest</Text>
          <Text style={[styles.summaryValue, { color: "#10B981" }]}>
            +${calculateProjectedEarnings().toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Auto-Save Toggle */}
      <View style={styles.autoSaveSection}>
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

            {/* Custom Percentage Input */}
            <View style={styles.percentInputRow}>
              <View style={styles.percentInputContainer}>
                <TextInput
                  style={styles.percentInput}
                  value={autoSavePercent.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setAutoSavePercent(Math.min(100, Math.max(1, num)));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={styles.percentSymbol}>%</Text>
              </View>
              <View style={styles.percentButtons}>
                <TouchableOpacity
                  style={styles.percentAdjustButton}
                  onPress={() => setAutoSavePercent(Math.max(1, autoSavePercent - 5))}
                >
                  <Ionicons name="remove" size={18} color="#0A2342" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.percentAdjustButton}
                  onPress={() => setAutoSavePercent(Math.min(100, autoSavePercent + 5))}
                >
                  <Ionicons name="add" size={18} color="#0A2342" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Slider Bar */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${autoSavePercent}%` },
                  ]}
                />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1%</Text>
                <Text style={styles.sliderLabel}>50%</Text>
                <Text style={styles.sliderLabel}>100%</Text>
              </View>
            </View>

            {/* Quick Select Buttons */}
            <View style={styles.quickSelectRow}>
              {[10, 25, 50, 75, 100].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[
                    styles.quickSelectButton,
                    autoSavePercent === pct && styles.quickSelectButtonActive,
                  ]}
                  onPress={() => setAutoSavePercent(pct)}
                >
                  <Text
                    style={[
                      styles.quickSelectText,
                      autoSavePercent === pct && styles.quickSelectTextActive,
                    ]}
                  >
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Auto-Replenish Option (especially for emergency funds) */}
            <View style={styles.replenishSection}>
              <View style={styles.replenishHeader}>
                <View style={styles.replenishInfo}>
                  <Ionicons name="refresh-circle" size={18} color="#10B981" />
                  <View style={styles.replenishTextContainer}>
                    <Text style={styles.replenishTitle}>Auto-Replenish (Priority)</Text>
                    <Text style={styles.replenishDesc}>
                      Automatically refill this goal first when it falls below target
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
                    This goal will be replenished first from payouts until it reaches the target amount
                  </Text>
                </View>
              )}
            </View>

            {/* Priority Selector (when replenish is off) */}
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

      {/* Warnings */}
      {goalType === "locked" && (
        <View style={styles.warningBox}>
          <Ionicons name="information-circle" size={20} color="#6366F1" />
          <Text style={styles.warningText}>
            Locked savings have a 10% early withdrawal penalty. Your funds will
            be available after {lockTerm} months.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#0A2342" />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  s <= step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.nextButton, isProcessing && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={isProcessing}
          >
            <Text style={styles.nextButtonText}>
              {step === 3 ? (isProcessing ? "Creating..." : "Create Goal") : "Continue"}
            </Text>
            {step < 3 && (
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
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
    backgroundColor: "#F5F7FA",
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  progressDotActive: {
    backgroundColor: "#00C6AE",
    width: 24,
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
  stepContent: {},
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  typeOption: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  typeOptionSelected: {
    backgroundColor: "#F0FDFB",
  },
  typeOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  typeOptionEmoji: {
    fontSize: 22,
  },
  typeOptionContent: {
    flex: 1,
  },
  typeOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  typeOptionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  rateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  rateText: {
    fontSize: 11,
    fontWeight: "600",
  },
  typeOptionDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
  },
  typeOptionFeatures: {
    gap: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    color: "#6B7280",
  },
  selectedCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 16,
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: "#0A2342",
    borderColor: "#0A2342",
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 13,
    color: "#6B7280",
  },
  categoryTextSelected: {
    color: "#FFFFFF",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "600",
    color: "#0A2342",
    paddingVertical: 14,
  },
  lockTermOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  lockTermOption: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  lockTermOptionSelected: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  lockTermLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  lockTermLabelSelected: {
    color: "#6366F1",
  },
  lockTermRate: {
    fontSize: 12,
    color: "#6B7280",
  },
  lockTermRateSelected: {
    color: "#6366F1",
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  summaryEmoji: {
    fontSize: 26,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  summaryTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryTypeText: {
    fontSize: 13,
    color: "#6B7280",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
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
  autoSaveSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    padding: 2,
  },
  toggleEnabled: {
    backgroundColor: "#00C6AE",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobEnabled: {
    marginLeft: "auto",
  },
  autoSaveConfig: {
    marginTop: 16,
  },
  autoSaveLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  percentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  percentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#00C6AE",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  percentInput: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0A2342",
    minWidth: 60,
    textAlign: "center",
  },
  percentSymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 4,
  },
  percentButtons: {
    flexDirection: "row",
    gap: 8,
  },
  percentAdjustButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  sliderFill: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sliderLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  quickSelectRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  quickSelectButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  quickSelectButtonActive: {
    backgroundColor: "#0A2342",
  },
  quickSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  quickSelectTextActive: {
    color: "#FFFFFF",
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
    fontSize: 13,
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
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#4338CA",
    lineHeight: 18,
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
