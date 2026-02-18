import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAdvance, ADVANCE_TIERS, RepaymentMethod, FuturePayout, AdvanceTierKey } from "../context/AdvanceContext";
import { useXnScore } from "../context/XnScoreContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";

type RequestAdvanceNavigationProp = StackNavigationProp<RootStackParamList>;
type RequestAdvanceRouteProp = RouteProp<RootStackParamList, "RequestAdvance">;

// Helper to get advance tier config with fee and percent
const getAdvanceTierConfig = (tier: AdvanceTierKey) => {
  const tierConfig: Record<AdvanceTierKey, { maxAdvancePercent: number; advanceFee: number }> = {
    locked: { maxAdvancePercent: 0, advanceFee: 0 },
    preview: { maxAdvancePercent: 0, advanceFee: 0 },
    basic: { maxAdvancePercent: 50, advanceFee: 3.5 },
    standard: { maxAdvancePercent: 65, advanceFee: 2.5 },
    premium: { maxAdvancePercent: 80, advanceFee: 1.5 },
    elite: { maxAdvancePercent: 90, advanceFee: 1.0 },
  };
  return tierConfig[tier] || { maxAdvancePercent: 0, advanceFee: 0 };
};

const ADVANCE_REASONS = [
  { id: "emergency", label: "Emergency", icon: "medkit-outline" },
  { id: "education", label: "Education", icon: "school-outline" },
  { id: "medical", label: "Medical", icon: "heart-outline" },
  { id: "business", label: "Business", icon: "briefcase-outline" },
  { id: "family", label: "Family Support", icon: "people-outline" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-outline" },
];

// Only show payout_offset as primary since that's the core mechanic
const REPAYMENT_OPTIONS: { id: RepaymentMethod; label: string; description: string; icon: string }[] = [
  {
    id: "payout_offset",
    label: "Auto-Withhold from Payout",
    description: "Automatically deducted when you receive your payout (recommended)",
    icon: "swap-horizontal-outline",
  },
  {
    id: "manual",
    label: "Early Repayment",
    description: "Pay back early to close the advance before payout date",
    icon: "hand-right-outline",
  },
];

export default function RequestAdvanceScreen() {
  const navigation = useNavigation<RequestAdvanceNavigationProp>();
  const route = useRoute<RequestAdvanceRouteProp>();
  const { payoutId } = route.params;

  const {
    futurePayouts,
    checkEligibility,
    requestAdvance,
    getAdvanceTier,
    getTierInfo,
    canApplyForLoan,
    getLoanById,
  } = useAdvance();
  const { score } = useXnScore();
  const { formatCurrency } = useCurrency();

  // Find the payout
  const payout = futurePayouts.find((p) => p.id === payoutId);
  const existingAdvance = payout?.existingLoanId ? getLoanById(payout.existingLoanId) : undefined;

  // Currency info
  const payoutCurrency = payout?.currency || "USD";
  const currencyInfo = CURRENCIES[payoutCurrency];

  const [amount, setAmount] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [repaymentMethod, setRepaymentMethod] = useState<RepaymentMethod>("payout_offset");
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Check eligibility
  const eligibility = useMemo(() => {
    if (!payout) return null;
    return checkEligibility(payout.circleId, score, payout.expectedAmount);
  }, [payout, score]);

  const tier = getAdvanceTier(score);
  const tierInfo = getTierInfo(tier);
  const tierConfig = getAdvanceTierConfig(tier);
  const canRequest = canApplyForLoan(score);

  // Calculate fee and total
  const requestedAmount = parseFloat(amount) || 0;
  const feePercent = tierConfig.advanceFee || 0;
  const maxAdvancePercent = tierConfig.maxAdvancePercent || 0;
  const fee = (requestedAmount * feePercent) / 100;
  const totalRepayment = requestedAmount + fee;

  // Validation
  const isValidAmount = requestedAmount > 0 && eligibility && requestedAmount <= eligibility.availableAmount;
  const canSubmit = isValidAmount && selectedReason && termsAccepted && eligibility?.isEligible && canRequest;

  // Due date is the payout date
  const dueDate = payout ? new Date(payout.expectedDate) : new Date();
  const daysUntilPayout = payout
    ? Math.ceil((new Date(payout.expectedDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;

  const handleSubmit = async () => {
    if (!canSubmit || !payout) return;

    setIsProcessing(true);

    try {
      const advance = await requestAdvance({
        payoutId: payout.id,
        circleId: payout.circleId,
        circleName: payout.circleName,
        userId: "user_1", // Mock user
        requestedAmount,
        currency: payoutCurrency,
        advanceFeePercent: feePercent,
        repaymentMethod,
        reason: selectedReason === "other" ? customReason : selectedReason,
        expectedPayoutDate: payout.expectedDate,
        expectedPayoutAmount: payout.expectedAmount,
        memberPosition: payout.memberPosition,
        xnScoreAtRequest: score,
        tierAtRequest: tier,
      });

      // Navigate to details screen
      navigation.navigate("AdvanceDetails", { advanceId: advance.id });
    } catch (error) {
      Alert.alert("Error", "Failed to submit advance request. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Payout not found
  if (!payout) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payout Not Found</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyStateText}>This payout could not be found</Text>
          <TouchableOpacity style={styles.backToHubButton} onPress={() => navigation.navigate("AdvanceHub")}>
            <Text style={styles.backToHubText}>Back to Advance Hub</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Already has advance
  if (existingAdvance) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Already Advanced</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#00C6AE" />
          <Text style={styles.emptyStateText}>You already have an advance for this payout</Text>
          <TouchableOpacity
            style={styles.viewAdvanceButton}
            onPress={() => navigation.navigate("AdvanceDetails", { advanceId: existingAdvance.id })}
          >
            <Text style={styles.viewAdvanceText}>View Advance Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Request Advance</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Payout Info */}
            <View style={styles.payoutInfo}>
              <View style={styles.payoutIconCircle}>
                <Ionicons name="calendar-outline" size={28} color="#00C6AE" />
              </View>
              <Text style={styles.payoutCircleName}>{payout.circleName}</Text>
              <Text style={styles.payoutAmount}>
                {currencyInfo?.symbol}
                {formatCurrency(payout.expectedAmount, payoutCurrency)} payout
              </Text>
              <View style={styles.payoutDateBadge}>
                <Ionicons name="time-outline" size={14} color="#F59E0B" />
                <Text style={styles.payoutDateText}>In {daysUntilPayout} days</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            {/* Eligibility Card */}
            <View style={[styles.eligibilityCard, !eligibility?.isEligible && styles.eligibilityCardIneligible]}>
              <View style={styles.eligibilityHeader}>
                <View style={[styles.tierBadge, { backgroundColor: tierInfo.color }]}>
                  <Ionicons
                    name={eligibility?.isEligible ? "checkmark-circle" : tierInfo.status === "preview" ? "eye" : "lock-closed"}
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.tierBadgeText}>{tierInfo.label}</Text>
                </View>
                <View style={styles.scoreDisplay}>
                  <Text style={styles.scoreLabel}>XnScore</Text>
                  <Text style={styles.scoreValue}>{score}</Text>
                </View>
              </View>

              {eligibility?.isEligible ? (
                <View style={styles.eligibilityDetails}>
                  <View style={styles.eligibilityRow}>
                    <Text style={styles.eligibilityLabel}>Max advance ({maxAdvancePercent}%)</Text>
                    <Text style={styles.eligibilityValue}>
                      {currencyInfo?.symbol}
                      {formatCurrency(eligibility.maxAmount, payoutCurrency)}
                    </Text>
                  </View>
                  <View style={styles.eligibilityRow}>
                    <Text style={styles.eligibilityLabel}>Available now</Text>
                    <Text style={[styles.eligibilityValue, styles.highlightValue]}>
                      {currencyInfo?.symbol}
                      {formatCurrency(eligibility.availableAmount, payoutCurrency)}
                    </Text>
                  </View>
                  <View style={styles.eligibilityRow}>
                    <Text style={styles.eligibilityLabel}>Advance fee</Text>
                    <Text style={styles.eligibilityValue}>{feePercent}%</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.ineligibleReasons}>
                  {tierInfo.status === "locked" && (
                    <View style={styles.reasonRow}>
                      <Ionicons name="lock-closed" size={16} color="#6B7280" />
                      <Text style={styles.reasonTextGray}>
                        Advance feature is locked. Build your XnScore to 25+ to preview.
                      </Text>
                    </View>
                  )}
                  {tierInfo.status === "preview" && (
                    <View style={styles.previewBox}>
                      <Ionicons name="eye" size={20} color="#F59E0B" />
                      <View style={styles.previewContent}>
                        <Text style={styles.previewTitle}>Preview Mode</Text>
                        <Text style={styles.previewText}>
                          You can see your potential advance amount, but you need XnScore 45+ to request.
                          You're {45 - score} points away!
                        </Text>
                      </View>
                    </View>
                  )}
                  {eligibility?.reasons.map((reason, idx) => (
                    <View key={idx} style={styles.reasonRow}>
                      <Ionicons name="alert-circle" size={16} color="#DC2626" />
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {canRequest && eligibility?.isEligible && (
              <>
                {/* Amount Input */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>How much do you need?</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>{currencyInfo?.symbol}</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                    />
                    <Text style={styles.currencyCode}>{payoutCurrency}</Text>
                  </View>
                  {requestedAmount > eligibility.availableAmount && (
                    <Text style={styles.errorText}>
                      Amount exceeds available limit ({currencyInfo?.symbol}
                      {formatCurrency(eligibility.availableAmount, payoutCurrency)})
                    </Text>
                  )}

                  {/* Quick Amount Buttons */}
                  <View style={styles.quickAmounts}>
                    {[25, 50, 75, 100].map((percent) => {
                      const quickAmount = (eligibility.availableAmount * percent) / 100;
                      return (
                        <TouchableOpacity
                          key={percent}
                          style={styles.quickAmountButton}
                          onPress={() => setAmount(quickAmount.toFixed(2))}
                        >
                          <Text style={styles.quickAmountText}>{percent}%</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Reason Selection */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>What's this for?</Text>
                  <View style={styles.reasonsGrid}>
                    {ADVANCE_REASONS.map((reason) => (
                      <TouchableOpacity
                        key={reason.id}
                        style={[styles.reasonCard, selectedReason === reason.id && styles.reasonCardSelected]}
                        onPress={() => setSelectedReason(reason.id)}
                      >
                        <Ionicons
                          name={reason.icon as any}
                          size={24}
                          color={selectedReason === reason.id ? "#00C6AE" : "#6B7280"}
                        />
                        <Text style={[styles.reasonLabel, selectedReason === reason.id && styles.reasonLabelSelected]}>
                          {reason.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedReason === "other" && (
                    <TextInput
                      style={styles.customReasonInput}
                      placeholder="Please specify your reason..."
                      placeholderTextColor="#9CA3AF"
                      value={customReason}
                      onChangeText={setCustomReason}
                      multiline
                    />
                  )}
                </View>

                {/* Repayment Method */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>How will you repay?</Text>
                  {REPAYMENT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.repaymentCard, repaymentMethod === option.id && styles.repaymentCardSelected]}
                      onPress={() => setRepaymentMethod(option.id)}
                    >
                      <View style={[styles.repaymentIcon, repaymentMethod === option.id && styles.repaymentIconSelected]}>
                        <Ionicons
                          name={option.icon as any}
                          size={22}
                          color={repaymentMethod === option.id ? "#FFFFFF" : "#00C6AE"}
                        />
                      </View>
                      <View style={styles.repaymentInfo}>
                        <Text style={styles.repaymentLabel}>{option.label}</Text>
                        <Text style={styles.repaymentDescription}>{option.description}</Text>
                      </View>
                      <View style={[styles.radioButton, repaymentMethod === option.id && styles.radioButtonSelected]}>
                        {repaymentMethod === option.id && <View style={styles.radioButtonInner} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Summary */}
                {requestedAmount > 0 && (
                  <View style={styles.summaryCard}>
                    <Text style={styles.sectionTitle}>Advance Summary</Text>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Advance amount</Text>
                      <Text style={styles.summaryValue}>
                        {currencyInfo?.symbol}
                        {formatCurrency(requestedAmount, payoutCurrency)}
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Advance fee ({feePercent}%)</Text>
                      <Text style={styles.summaryValue}>
                        {currencyInfo?.symbol}
                        {formatCurrency(fee, payoutCurrency)}
                      </Text>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.summaryRow}>
                      <Text style={styles.totalLabel}>Total to repay</Text>
                      <Text style={styles.totalValue}>
                        {currencyInfo?.symbol}
                        {formatCurrency(totalRepayment, payoutCurrency)}
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Auto-withheld on</Text>
                      <Text style={styles.summaryValue}>
                        {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>You'll receive</Text>
                      <Text style={[styles.summaryValue, { color: "#00C6AE", fontWeight: "700" }]}>
                        {currencyInfo?.symbol}
                        {formatCurrency(payout.expectedAmount - totalRepayment, payoutCurrency)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* How it works reminder */}
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle" size={20} color="#00C6AE" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>How it works</Text>
                    <Text style={styles.infoText}>
                      When your payout arrives on{" "}
                      {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, we'll automatically
                      withhold {currencyInfo?.symbol}
                      {formatCurrency(totalRepayment, payoutCurrency)} and send you the rest.
                    </Text>
                  </View>
                </View>

                {/* Terms Acceptance */}
                <TouchableOpacity style={styles.termsRow} onPress={() => setTermsAccepted(!termsAccepted)}>
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                    {termsAccepted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.termsText}>
                    I understand this advance will be withheld from my payout and agree to the{" "}
                    <Text style={styles.termsLink}>terms & conditions</Text>
                  </Text>
                </TouchableOpacity>

                {/* Warning */}
                <View style={styles.warningCard}>
                  <Ionicons name="warning" size={20} color="#F59E0B" />
                  <Text style={styles.warningText}>
                    If your payout doesn't occur (e.g., you leave the circle), you'll need to repay manually. This would
                    negatively affect your XnScore.
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Action */}
      {canRequest && eligibility?.isEligible && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.submitButton, (!canSubmit || isProcessing) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || isProcessing}
          >
            {isProcessing ? (
              <Text style={styles.submitButtonText}>Processing...</Text>
            ) : (
              <>
                <Ionicons name="flash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Get Advance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Preview state - show CTA to improve score */}
      {tierInfo.status === "preview" && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.improveScoreButton}
            onPress={() => navigation.navigate("XnScoreDashboard")}
          >
            <Ionicons name="trending-up" size={20} color="#00C6AE" />
            <Text style={styles.improveScoreText}>Improve Your XnScore</Text>
          </TouchableOpacity>
        </View>
      )}
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
  payoutInfo: {
    alignItems: "center",
  },
  payoutIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  payoutCircleName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  payoutAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  payoutDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  payoutDateText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F59E0B",
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  backToHubButton: {
    backgroundColor: "#00C6AE",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backToHubText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  viewAdvanceButton: {
    backgroundColor: "#00C6AE",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  viewAdvanceText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  eligibilityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  eligibilityCardIneligible: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  eligibilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scoreDisplay: {
    alignItems: "flex-end",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  eligibilityDetails: {
    gap: 12,
  },
  eligibilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eligibilityLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  eligibilityValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  highlightValue: {
    color: "#00C6AE",
    fontSize: 16,
  },
  ineligibleReasons: {
    gap: 10,
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  previewContent: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B45309",
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    color: "#B45309",
    lineHeight: 18,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reasonText: {
    fontSize: 13,
    color: "#DC2626",
    flex: 1,
  },
  reasonTextGray: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: "600",
    color: "#6B7280",
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    color: "#0A2342",
    paddingVertical: 16,
    textAlign: "center",
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 8,
    textAlign: "center",
  },
  quickAmounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  reasonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reasonCard: {
    width: "31%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reasonCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  reasonLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 6,
    textAlign: "center",
  },
  reasonLabelSelected: {
    color: "#00C6AE",
    fontWeight: "600",
  },
  customReasonInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginTop: 12,
    fontSize: 14,
    color: "#0A2342",
    minHeight: 80,
    textAlignVertical: "top",
  },
  repaymentCard: {
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
  repaymentCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  repaymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  repaymentIconSelected: {
    backgroundColor: "#00C6AE",
  },
  repaymentInfo: {
    flex: 1,
  },
  repaymentLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  repaymentDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
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
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.2)",
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
  termsLink: {
    color: "#00C6AE",
    fontWeight: "600",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#B45309",
    lineHeight: 18,
  },
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
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  improveScoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  improveScoreText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00C6AE",
  },
});
