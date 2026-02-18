import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useLoan, LOAN_PRODUCTS, LoanProduct, LoanType } from "../context/AdvanceContext";
import { useXnScore } from "../context/XnScoreContext";
import { useCurrency } from "../context/CurrencyContext";

type LoanCalculatorNavigationProp = StackNavigationProp<RootStackParamList>;

const TERM_OPTIONS = [
  { months: 1, label: "1 mo" },
  { months: 3, label: "3 mo" },
  { months: 6, label: "6 mo" },
  { months: 12, label: "1 yr" },
  { months: 24, label: "2 yr" },
  { months: 36, label: "3 yr" },
  { months: 48, label: "4 yr" },
  { months: 60, label: "5 yr" },
];

export default function LoanCalculatorScreen() {
  const navigation = useNavigation<LoanCalculatorNavigationProp>();
  const { calculateLoan, getAvailableProducts, getEligibility, getEligibilityTier } = useLoan();
  const { score } = useXnScore();
  const { formatCurrency } = useCurrency();

  // Mock SMC (Stable Monthly Contribution) - realistic value for testing larger loans
  const mockSMC = 2000;

  const [selectedProductId, setSelectedProductId] = useState<string>("small_advance");
  const [amount, setAmount] = useState<string>("500");
  const [termMonths, setTermMonths] = useState<number>(3);

  const selectedProduct = LOAN_PRODUCTS.find(p => p.id === selectedProductId);
  const tier = getEligibilityTier(score);
  const eligibility = getEligibility(score, mockSMC);
  const availableProducts = getAvailableProducts(score);

  const isProductAvailable = (product: LoanProduct) => {
    return availableProducts.some(p => p.id === product.id);
  };

  // Calculate loan
  const calculation = useMemo(() => {
    const requestedAmount = parseFloat(amount) || 0;
    if (requestedAmount <= 0 || !selectedProduct) return null;

    try {
      return calculateLoan(selectedProductId, requestedAmount, termMonths, score, mockSMC);
    } catch {
      return null;
    }
  }, [selectedProductId, amount, termMonths, score, mockSMC]);

  // Filter available terms for selected product
  const availableTerms = TERM_OPTIONS.filter(
    t => t.months >= (selectedProduct?.minTermMonths || 1) &&
         t.months <= (selectedProduct?.maxTermMonths || 60)
  );

  // Comparison with other tiers
  const tierComparison = useMemo(() => {
    if (!calculation || !selectedProduct) return [];

    const tiers = ["basic", "standard", "premium", "elite"] as const;
    return tiers
      .filter(t => selectedProduct.feeRates[t] > 0)
      .map(t => {
        const feeRate = selectedProduct.feeRates[t];
        let feeAmount: number;
        let totalToRepay: number;
        let monthlyPayment: number;

        if (selectedProduct.type === "small") {
          // Short-term advances use flat fee
          feeAmount = calculation.approvedAmount * (feeRate / 100);
          totalToRepay = calculation.approvedAmount + feeAmount;
          monthlyPayment = totalToRepay / termMonths;
        } else {
          // Standard amortization for longer-term loans
          const monthlyRate = feeRate / 100 / 12;
          if (monthlyRate > 0) {
            const compoundFactor = Math.pow(1 + monthlyRate, termMonths);
            monthlyPayment = calculation.approvedAmount * (monthlyRate * compoundFactor) / (compoundFactor - 1);
            totalToRepay = monthlyPayment * termMonths;
            feeAmount = totalToRepay - calculation.approvedAmount;
          } else {
            feeAmount = 0;
            totalToRepay = calculation.approvedAmount;
            monthlyPayment = calculation.approvedAmount / termMonths;
          }
        }

        const savings = calculation.totalToRepay - totalToRepay;

        return {
          tier: t,
          feeRate,
          totalToRepay,
          monthlyPayment,
          savings,
          isCurrent: t === tier,
        };
      });
  }, [calculation, tier, termMonths, selectedProduct]);

  const handleApply = () => {
    if (selectedProduct && isProductAvailable(selectedProduct)) {
      navigation.navigate("LoanApplication", { productId: selectedProductId });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Loan Calculator</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.headerSubtitle}>
            See how much you could borrow and what it would cost
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Product Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loan Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productsScroll}>
              <View style={styles.productsRow}>
                {LOAN_PRODUCTS.map(product => {
                  const available = isProductAvailable(product);
                  const isSelected = selectedProductId === product.id;

                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[
                        styles.productPill,
                        isSelected && styles.productPillSelected,
                        !available && styles.productPillLocked,
                      ]}
                      onPress={() => {
                        setSelectedProductId(product.id);
                        // Reset amount to product min
                        setAmount(product.minAmount.toString());
                        // Reset term to product min
                        setTermMonths(product.minTermMonths);
                      }}
                    >
                      <Ionicons
                        name={product.icon as any}
                        size={18}
                        color={isSelected ? "#FFFFFF" : available ? "#0A2342" : "#9CA3AF"}
                      />
                      <Text style={[
                        styles.productPillText,
                        isSelected && styles.productPillTextSelected,
                        !available && styles.productPillTextLocked,
                      ]}>
                        {product.name}
                      </Text>
                      {!available && (
                        <Ionicons name="lock-closed" size={12} color="#9CA3AF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Amount Slider */}
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
            </View>
            {selectedProduct && (
              <View style={styles.amountRange}>
                <Text style={styles.amountRangeText}>
                  Min: ${selectedProduct.minAmount.toLocaleString()}
                </Text>
                <Text style={styles.amountRangeText}>
                  Max: ${selectedProduct.maxAmount.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Quick Amount Buttons */}
            {selectedProduct && (
              <View style={styles.quickAmounts}>
                {[25, 50, 75, 100].map(percent => {
                  const quickAmount = (selectedProduct.maxAmount * percent) / 100;
                  return (
                    <TouchableOpacity
                      key={percent}
                      style={styles.quickAmountButton}
                      onPress={() => setAmount(quickAmount.toFixed(0))}
                    >
                      <Text style={styles.quickAmountText}>
                        ${quickAmount >= 1000
                          ? `${(quickAmount / 1000).toFixed(0)}K`
                          : quickAmount.toFixed(0)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Term Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loan Term</Text>
            <View style={styles.termOptions}>
              {availableTerms.map(term => (
                <TouchableOpacity
                  key={term.months}
                  style={[
                    styles.termOption,
                    termMonths === term.months && styles.termOptionSelected,
                  ]}
                  onPress={() => setTermMonths(term.months)}
                >
                  <Text style={[
                    styles.termOptionText,
                    termMonths === term.months && styles.termOptionTextSelected,
                  ]}>
                    {term.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Calculation Results */}
          {calculation && (
            <View style={styles.resultsCard}>
              <Text style={styles.cardTitle}>Your Estimate</Text>

              {/* Main Result */}
              <View style={styles.mainResult}>
                <View style={styles.mainResultItem}>
                  <Text style={styles.mainResultLabel}>Monthly Payment</Text>
                  <Text style={styles.mainResultValue}>
                    ${formatCurrency(calculation.monthlyPayment, "USD")}
                  </Text>
                </View>
                <View style={styles.resultDivider} />
                <View style={styles.mainResultItem}>
                  <Text style={styles.mainResultLabel}>Total to Repay</Text>
                  <Text style={styles.mainResultValue}>
                    ${formatCurrency(calculation.totalToRepay, "USD")}
                  </Text>
                </View>
              </View>

              {/* Breakdown */}
              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Principal</Text>
                  <Text style={styles.breakdownValue}>
                    ${formatCurrency(calculation.approvedAmount, "USD")}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {selectedProduct?.type === "small"
                      ? `Fee (${calculation.feeRate}% flat)`
                      : `Interest (${calculation.feeRate}% APR)`}
                  </Text>
                  <Text style={styles.breakdownValue}>
                    ${formatCurrency(calculation.feeAmount, "USD")}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Term</Text>
                  <Text style={styles.breakdownValue}>{termMonths} months</Text>
                </View>
              </View>

              {/* Approval Indicator */}
              <View style={[
                styles.approvalIndicator,
                calculation.approvalLikelihood === "high" && styles.approvalHigh,
                calculation.approvalLikelihood === "medium" && styles.approvalMedium,
                calculation.approvalLikelihood === "low" && styles.approvalLow,
              ]}>
                <Ionicons
                  name={calculation.approvalLikelihood === "high" ? "checkmark-circle" :
                        calculation.approvalLikelihood === "medium" ? "alert-circle" : "close-circle"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.approvalText}>
                  {calculation.approvalLikelihood === "high"
                    ? "Likely to be approved"
                    : calculation.approvalLikelihood === "medium"
                    ? "May require review"
                    : "Unlikely to be approved"}
                </Text>
              </View>

              {/* Warnings */}
              {calculation.warnings.length > 0 && (
                <View style={styles.warningsContainer}>
                  {calculation.warnings.map((warning, idx) => (
                    <View key={idx} style={styles.warningRow}>
                      <Ionicons name="information-circle" size={14} color="#F59E0B" />
                      <Text style={styles.warningText}>{warning}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Tier Comparison */}
          {tierComparison.length > 1 && calculation && (
            <View style={styles.comparisonCard}>
              <Text style={styles.cardTitle}>Rates by Tier</Text>
              <Text style={styles.comparisonSubtitle}>
                Better XnScore = Lower fees
              </Text>

              {tierComparison.map(comp => (
                <View
                  key={comp.tier}
                  style={[
                    styles.comparisonRow,
                    comp.isCurrent && styles.comparisonRowCurrent,
                  ]}
                >
                  <View style={styles.comparisonLeft}>
                    <Text style={[
                      styles.comparisonTier,
                      comp.isCurrent && styles.comparisonTierCurrent,
                    ]}>
                      {comp.tier.charAt(0).toUpperCase() + comp.tier.slice(1)}
                    </Text>
                    <Text style={styles.comparisonRate}>{comp.feeRate}% fee</Text>
                  </View>
                  <View style={styles.comparisonRight}>
                    <Text style={[
                      styles.comparisonTotal,
                      comp.isCurrent && styles.comparisonTotalCurrent,
                    ]}>
                      ${formatCurrency(comp.totalToRepay, "USD")}
                    </Text>
                    {comp.savings > 0 && !comp.isCurrent && (
                      <Text style={styles.savingsText}>
                        Save ${formatCurrency(comp.savings, "USD")}
                      </Text>
                    )}
                    {comp.isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Your Rate</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.improveScoreLink}
                onPress={() => navigation.navigate("XnScoreDashboard")}
              >
                <Ionicons name="trending-up" size={16} color="#00C6AE" />
                <Text style={styles.improveScoreLinkText}>
                  Improve your XnScore for better rates
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Product Info */}
          {selectedProduct && (
            <View style={styles.productInfoCard}>
              <View style={styles.productInfoHeader}>
                <Ionicons name={selectedProduct.icon as any} size={24} color="#00C6AE" />
                <Text style={styles.productInfoTitle}>{selectedProduct.name}</Text>
              </View>
              <Text style={styles.productInfoDescription}>
                {selectedProduct.description}
              </Text>
              <View style={styles.featuresList}>
                {selectedProduct.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.productMeta}>
                <Text style={styles.productMetaText}>
                  Processing: {selectedProduct.processingTime}
                </Text>
                <Text style={styles.productMetaText}>
                  Min XnScore: {selectedProduct.minXnScore}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>

      {/* Apply Button */}
      {selectedProduct && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.applyButton,
              !isProductAvailable(selectedProduct) && styles.applyButtonDisabled,
            ]}
            onPress={handleApply}
            disabled={!isProductAvailable(selectedProduct)}
          >
            {isProductAvailable(selectedProduct) ? (
              <>
                <Text style={styles.applyButtonText}>Apply for {selectedProduct.name}</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                <Text style={styles.applyButtonText}>
                  Requires XnScore {selectedProduct.minXnScore}+
                </Text>
              </>
            )}
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
    marginBottom: 12,
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
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
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
  productsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  productsRow: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 20,
  },
  productPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productPillSelected: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  productPillLocked: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  productPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  productPillTextSelected: {
    color: "#FFFFFF",
  },
  productPillTextLocked: {
    color: "#9CA3AF",
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
  amountRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  amountRangeText: {
    fontSize: 12,
    color: "#6B7280",
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
  resultsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 16,
  },
  mainResult: {
    flexDirection: "row",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  mainResultItem: {
    flex: 1,
    alignItems: "center",
  },
  mainResultLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  mainResultValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
  },
  resultDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },
  breakdown: {
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  approvalIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  approvalHigh: {
    backgroundColor: "#10B981",
  },
  approvalMedium: {
    backgroundColor: "#F59E0B",
  },
  approvalLow: {
    backgroundColor: "#DC2626",
  },
  approvalText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  warningsContainer: {
    marginTop: 16,
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
  comparisonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  comparisonSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
    marginTop: -8,
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  comparisonRowCurrent: {
    backgroundColor: "#F0FDFB",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  comparisonLeft: {},
  comparisonTier: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  comparisonTierCurrent: {
    color: "#00C6AE",
  },
  comparisonRate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  comparisonRight: {
    alignItems: "flex-end",
  },
  comparisonTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  comparisonTotalCurrent: {
    color: "#00C6AE",
  },
  savingsText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
    marginTop: 2,
  },
  currentBadge: {
    backgroundColor: "#00C6AE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  improveScoreLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  improveScoreLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  productInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  productInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  productInfoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  productInfoDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 16,
  },
  featuresList: {
    gap: 10,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: "#4B5563",
  },
  productMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  productMetaText: {
    fontSize: 12,
    color: "#6B7280",
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
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  applyButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  applyButtonText: {
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
