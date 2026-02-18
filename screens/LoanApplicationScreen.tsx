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
import {
  useLoan,
  LoanCategory,
  RepaymentMethod,
  DisbursementMethod,
} from "../context/AdvanceContext";
import { useXnScore } from "../context/XnScoreContext";
import { useCurrency } from "../context/CurrencyContext";

type LoanApplicationNavigationProp = StackNavigationProp<RootStackParamList>;
type LoanApplicationRouteProp = RouteProp<RootStackParamList, "LoanApplication">;

const LOAN_PURPOSES: { id: LoanCategory; label: string; icon: string }[] = [
  { id: "emergency", label: "Emergency", icon: "medkit-outline" },
  { id: "education", label: "Education", icon: "school-outline" },
  { id: "medical", label: "Medical", icon: "heart-outline" },
  { id: "business", label: "Business", icon: "briefcase-outline" },
  { id: "vehicle", label: "Vehicle", icon: "car-outline" },
  { id: "home_improvement", label: "Home Improvement", icon: "hammer-outline" },
  { id: "agriculture", label: "Agriculture", icon: "leaf-outline" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-outline" },
];

const REPAYMENT_METHODS: { id: RepaymentMethod; label: string; description: string; icon: string }[] = [
  {
    id: "hybrid",
    label: "Hybrid (Recommended)",
    description: "Auto-deduct from payouts + monthly wallet payments",
    icon: "sync-outline",
  },
  {
    id: "payout_withholding",
    label: "Payout Withholding Only",
    description: "Full amount deducted when payouts arrive",
    icon: "swap-horizontal-outline",
  },
  {
    id: "wallet_balance",
    label: "Monthly Wallet Payments",
    description: "Fixed monthly payments from your wallet",
    icon: "wallet-outline",
  },
];

const DISBURSEMENT_METHODS: { id: DisbursementMethod; label: string; icon: string }[] = [
  { id: "wallet", label: "TandaXn Wallet", icon: "wallet-outline" },
  { id: "bank_transfer", label: "Bank Transfer", icon: "business-outline" },
  { id: "mobile_money", label: "Mobile Money", icon: "phone-portrait-outline" },
];

const TERM_OPTIONS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
  { months: 24, label: "24 months" },
  { months: 36, label: "36 months" },
  { months: 48, label: "48 months" },
  { months: 60, label: "60 months" },
];

export default function LoanApplicationScreen() {
  const navigation = useNavigation<LoanApplicationNavigationProp>();
  const route = useRoute<LoanApplicationRouteProp>();
  const { productId } = route.params;

  const {
    getProductById,
    calculateLoan,
    applyForLoan,
    getEligibilityTier,
    getTierInfo,
    getAdvanceablePayouts,
    getMonthlyObligations,
  } = useLoan();
  const { score } = useXnScore();
  const { formatCurrency } = useCurrency();

  const product = getProductById(productId);
  const tier = getEligibilityTier(score);
  const tierInfo = getTierInfo(tier);
  const advanceablePayouts = getAdvanceablePayouts();

  // Mock SMC (Stable Monthly Contribution) - realistic value for testing larger loans
  // For a $15,000 vehicle loan with 10x SMC ratio, need at least $1,500 SMC
  const mockSMC = 2000;

  // Form state
  const [amount, setAmount] = useState<string>("");
  const [termMonths, setTermMonths] = useState<number>(product?.minTermMonths || 1);
  const [category, setCategory] = useState<LoanCategory | null>(
    product?.categories[0] || null
  );
  const [purposeDetails, setPurposeDetails] = useState<string>("");
  const [repaymentMethod, setRepaymentMethod] = useState<RepaymentMethod>("hybrid");
  const [disbursementMethod, setDisbursementMethod] = useState<DisbursementMethod>("wallet");
  const [sourcePayoutId, setSourcePayoutId] = useState<string | undefined>(
    product?.type === "small" ? advanceablePayouts[0]?.id : undefined
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate loan details
  const requestedAmount = parseFloat(amount) || 0;
  const calculation = useMemo(() => {
    if (requestedAmount <= 0 || !product) return null;
    try {
      return calculateLoan(
        productId,
        requestedAmount,
        termMonths,
        score,
        mockSMC,
        sourcePayoutId
      );
    } catch {
      return null;
    }
  }, [productId, requestedAmount, termMonths, score, mockSMC, sourcePayoutId]);

  // Validation
  const isValidAmount =
    requestedAmount >= (product?.minAmount || 0) &&
    requestedAmount <= (product?.maxAmount || 0);
  const canSubmit =
    isValidAmount &&
    category &&
    termsAccepted &&
    calculation?.eligible &&
    !isProcessing;

  // Filter available term options
  const availableTerms = TERM_OPTIONS.filter(
    (t) =>
      t.months >= (product?.minTermMonths || 1) &&
      t.months <= (product?.maxTermMonths || 60)
  );

  // Filter loan purposes based on product
  const availablePurposes = LOAN_PURPOSES.filter(
    (p) => !product?.categories.length || product.categories.includes(p.id)
  );

  const handleSubmit = async () => {
    if (!canSubmit || !product || !calculation || !category) return;

    setIsProcessing(true);

    try {
      const currentMonthlyObligation = getMonthlyObligations();
      const newDCR =
        (currentMonthlyObligation + calculation.monthlyPayment) / mockSMC;

      const loan = await applyForLoan({
        userId: "user_1",
        productId: product.id,
        loanType: product.type,
        category,
        purpose: category,
        purposeDetails: purposeDetails || undefined,
        requestedAmount,
        approvedAmount: calculation.approvedAmount,
        currency: "USD",
        feeRate: calculation.feeRate,
        termMonths,
        sourcePayoutId,
        repaymentMethod,
        disbursementMethod,
        xnScoreAtRequest: score,
        tierAtRequest: tier,
        smcAtRequest: mockSMC,
        dcrAtRequest: newDCR,
      });

      // Navigate to loan details
      navigation.replace("LoanDetails", { loanId: loan.id });
    } catch (error) {
      Alert.alert("Error", "Failed to submit loan application. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!product) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Product Not Found</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Apply for Loan</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Product Info */}
            <View style={styles.productInfo}>
              <View style={styles.productIconCircle}>
                <Ionicons name={product.icon as any} size={28} color="#00C6AE" />
              </View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productRange}>
                ${product.minAmount.toLocaleString()} - $
                {product.maxAmount.toLocaleString()}
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            {/* Amount Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Loan Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
                <Text style={styles.currencyCode}>USD</Text>
              </View>
              {requestedAmount > 0 && !isValidAmount && (
                <Text style={styles.errorText}>
                  Amount must be between ${product.minAmount.toLocaleString()} and $
                  {product.maxAmount.toLocaleString()}
                </Text>
              )}

              {/* Quick Amount Buttons */}
              <View style={styles.quickAmounts}>
                {[25, 50, 75, 100].map((percent) => {
                  const quickAmount = (product.maxAmount * percent) / 100;
                  return (
                    <TouchableOpacity
                      key={percent}
                      style={styles.quickAmountButton}
                      onPress={() => setAmount(quickAmount.toFixed(0))}
                    >
                      <Text style={styles.quickAmountText}>
                        ${(quickAmount / 1000).toFixed(quickAmount >= 1000 ? 0 : 1)}K
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Loan Term */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Loan Term</Text>
              <View style={styles.termOptions}>
                {availableTerms.map((term) => (
                  <TouchableOpacity
                    key={term.months}
                    style={[
                      styles.termOption,
                      termMonths === term.months && styles.termOptionSelected,
                    ]}
                    onPress={() => setTermMonths(term.months)}
                  >
                    <Text
                      style={[
                        styles.termOptionText,
                        termMonths === term.months && styles.termOptionTextSelected,
                      ]}
                    >
                      {term.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Loan Purpose */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Purpose</Text>
              <View style={styles.purposeGrid}>
                {availablePurposes.map((purpose) => (
                  <TouchableOpacity
                    key={purpose.id}
                    style={[
                      styles.purposeCard,
                      category === purpose.id && styles.purposeCardSelected,
                    ]}
                    onPress={() => setCategory(purpose.id)}
                  >
                    <Ionicons
                      name={purpose.icon as any}
                      size={24}
                      color={category === purpose.id ? "#00C6AE" : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.purposeLabel,
                        category === purpose.id && styles.purposeLabelSelected,
                      ]}
                    >
                      {purpose.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.detailsInput}
                placeholder="Tell us more about how you'll use this loan (optional)..."
                placeholderTextColor="#9CA3AF"
                value={purposeDetails}
                onChangeText={setPurposeDetails}
                multiline
              />
            </View>

            {/* Source Payout (for small advances) */}
            {product.type === "small" && advanceablePayouts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Advance Against Payout</Text>
                {advanceablePayouts.map((payout) => (
                  <TouchableOpacity
                    key={payout.id}
                    style={[
                      styles.payoutCard,
                      sourcePayoutId === payout.id && styles.payoutCardSelected,
                    ]}
                    onPress={() => setSourcePayoutId(payout.id)}
                  >
                    <View style={styles.payoutLeft}>
                      <View style={styles.radioButton}>
                        {sourcePayoutId === payout.id && (
                          <View style={styles.radioButtonInner} />
                        )}
                      </View>
                      <View style={styles.payoutInfo}>
                        <Text style={styles.payoutCircle}>{payout.circleName}</Text>
                        <Text style={styles.payoutDate}>
                          Expected{" "}
                          {new Date(payout.expectedDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.payoutAmount}>
                      ${payout.expectedAmount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Repayment Method */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Repayment Method</Text>
              {REPAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.repaymentCard,
                    repaymentMethod === method.id && styles.repaymentCardSelected,
                  ]}
                  onPress={() => setRepaymentMethod(method.id)}
                >
                  <View
                    style={[
                      styles.repaymentIcon,
                      repaymentMethod === method.id && styles.repaymentIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={method.icon as any}
                      size={20}
                      color={repaymentMethod === method.id ? "#FFFFFF" : "#00C6AE"}
                    />
                  </View>
                  <View style={styles.repaymentInfo}>
                    <Text style={styles.repaymentLabel}>{method.label}</Text>
                    <Text style={styles.repaymentDescription}>{method.description}</Text>
                  </View>
                  <View
                    style={[
                      styles.radioButton,
                      repaymentMethod === method.id && styles.radioButtonSelected,
                    ]}
                  >
                    {repaymentMethod === method.id && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Disbursement Method */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Receive Funds To</Text>
              <View style={styles.disbursementOptions}>
                {DISBURSEMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.disbursementOption,
                      disbursementMethod === method.id && styles.disbursementOptionSelected,
                    ]}
                    onPress={() => setDisbursementMethod(method.id)}
                  >
                    <Ionicons
                      name={method.icon as any}
                      size={20}
                      color={disbursementMethod === method.id ? "#00C6AE" : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.disbursementLabel,
                        disbursementMethod === method.id &&
                          styles.disbursementLabelSelected,
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Loan Summary */}
            {calculation && requestedAmount > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.sectionTitle}>Loan Summary</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Loan Amount</Text>
                  <Text style={styles.summaryValue}>
                    ${formatCurrency(calculation.approvedAmount, "USD")}
                  </Text>
                </View>

                {calculation.approvedAmount < requestedAmount && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: "#F59E0B" }]}>
                      (Reduced from ${formatCurrency(requestedAmount, "USD")})
                    </Text>
                  </View>
                )}

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {product.type === "small"
                      ? `Fee (${calculation.feeRate}% flat)`
                      : `Interest (${calculation.feeRate}% APR)`}
                  </Text>
                  <Text style={styles.summaryValue}>
                    ${formatCurrency(calculation.feeAmount, "USD")}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total to Repay</Text>
                  <Text style={styles.totalValue}>
                    ${formatCurrency(calculation.totalToRepay, "USD")}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Monthly Payment</Text>
                  <Text style={[styles.summaryValue, { color: "#00C6AE", fontWeight: "700" }]}>
                    ${formatCurrency(calculation.monthlyPayment, "USD")}/mo
                  </Text>
                </View>

                {/* Approval Likelihood */}
                <View style={styles.approvalIndicator}>
                  <View
                    style={[
                      styles.approvalBadge,
                      calculation.approvalLikelihood === "high" && styles.approvalBadgeHigh,
                      calculation.approvalLikelihood === "medium" &&
                        styles.approvalBadgeMedium,
                      calculation.approvalLikelihood === "low" && styles.approvalBadgeLow,
                    ]}
                  >
                    <Ionicons
                      name={
                        calculation.approvalLikelihood === "high"
                          ? "checkmark-circle"
                          : calculation.approvalLikelihood === "medium"
                          ? "alert-circle"
                          : "close-circle"
                      }
                      size={14}
                      color="#FFFFFF"
                    />
                    <Text style={styles.approvalBadgeText}>
                      {calculation.approvalLikelihood === "high"
                        ? "Likely Approved"
                        : calculation.approvalLikelihood === "medium"
                        ? "May Need Review"
                        : "Low Chance"}
                    </Text>
                  </View>
                </View>

                {/* Warnings */}
                {calculation.warnings.length > 0 && (
                  <View style={styles.warningsContainer}>
                    {calculation.warnings.map((warning, idx) => (
                      <View key={idx} style={styles.warningRow}>
                        <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                        <Text style={styles.warningText}>{warning}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Terms Acceptance */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                I have read and agree to the{" "}
                <Text style={styles.termsLink}>Loan Agreement</Text> and{" "}
                <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>

      {/* Submit Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || isProcessing) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || isProcessing}
        >
          {isProcessing ? (
            <Text style={styles.submitButtonText}>Submitting...</Text>
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Application</Text>
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
  productInfo: {
    alignItems: "center",
  },
  productIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  productRange: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
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
  termOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  termOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  termOptionSelected: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
  },
  termOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  termOptionTextSelected: {
    color: "#00C6AE",
    fontWeight: "600",
  },
  purposeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  purposeCard: {
    width: "31%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  purposeCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  purposeLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 6,
    textAlign: "center",
  },
  purposeLabelSelected: {
    color: "#00C6AE",
    fontWeight: "600",
  },
  detailsInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    fontSize: 14,
    color: "#0A2342",
    minHeight: 80,
    textAlignVertical: "top",
  },
  payoutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  payoutCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  payoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  payoutInfo: {},
  payoutCircle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  payoutDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  payoutAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
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
    width: 40,
    height: 40,
    borderRadius: 10,
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
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  repaymentDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonSelected: {
    borderColor: "#00C6AE",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00C6AE",
  },
  disbursementOptions: {
    flexDirection: "row",
    gap: 10,
  },
  disbursementOption: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  disbursementOptionSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  disbursementLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  disbursementLabelSelected: {
    color: "#00C6AE",
    fontWeight: "600",
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
  approvalIndicator: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  approvalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  approvalBadgeHigh: {
    backgroundColor: "#10B981",
  },
  approvalBadgeMedium: {
    backgroundColor: "#F59E0B",
  },
  approvalBadgeLow: {
    backgroundColor: "#DC2626",
  },
  approvalBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  warningsContainer: {
    marginTop: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16,
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
  floatingHelp: {
    position: "absolute",
    bottom: 100,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
