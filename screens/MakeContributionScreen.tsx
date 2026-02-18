import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";
import { useXnScore } from "../context/XnScoreContext";
import { useWallet } from "../context/WalletContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";
import { CurrencySelector, QuickCurrencyPicker } from "../components/CurrencySelector";
import { ExchangeRateDisplay, FXRiskWarning } from "../components/ExchangeRateDisplay";

type MakeContributionNavigationProp = StackNavigationProp<RootStackParamList>;
type MakeContributionRouteProp = RouteProp<RootStackParamList, "MakeContribution">;

type PaymentMethod = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  available: boolean;
};

const paymentMethods: PaymentMethod[] = [
  {
    id: "wallet",
    name: "TandaXn Wallet",
    icon: "wallet",
    description: "Pay from your wallet balance",
    available: true,
  },
  {
    id: "bank",
    name: "Bank Transfer",
    icon: "business",
    description: "Transfer from your bank account",
    available: true,
  },
  {
    id: "debit",
    name: "Debit Card",
    icon: "card",
    description: "Pay with your debit card",
    available: true,
  },
  {
    id: "mobile",
    name: "Mobile Money",
    icon: "phone-portrait",
    description: "M-Pesa, MTN Mobile Money, etc.",
    available: true,
  },
];

const getFrequencyLabel = (frequency: string): string => {
  switch (frequency) {
    case "daily":
      return "daily";
    case "weekly":
      return "weekly";
    case "biweekly":
      return "bi-weekly";
    case "monthly":
      return "monthly";
    case "one-time":
      return "one-time";
    default:
      return frequency;
  }
};

export default function MakeContributionScreen() {
  const navigation = useNavigation<MakeContributionNavigationProp>();
  const route = useRoute<MakeContributionRouteProp>();
  const { circleId } = route.params;
  const { circles, browseCircles, myCircles } = useCircles();
  const { user } = useAuth();
  const { processContribution } = useXnScore();
  const { currencies, getCurrencyBalance, makeContribution } = useWallet();
  const { primaryCurrency, convert, getExchangeRate, formatCurrency } = useCurrency();

  const [selectedMethod, setSelectedMethod] = useState<string>("wallet");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState<string>(primaryCurrency);
  const [showCurrencyOptions, setShowCurrencyOptions] = useState(false);

  // Find the circle
  const circle = [...circles, ...myCircles, ...browseCircles].find((c) => c.id === circleId);

  // Circle's base currency (default to USD if not specified)
  const circleCurrency = (circle as any)?.currency || "USD";
  const isCrossBorder = paymentCurrency !== circleCurrency;

  // Get exchange rate info
  const exchangeInfo = useMemo(() => {
    if (!isCrossBorder) return null;
    return getExchangeRate(paymentCurrency, circleCurrency);
  }, [paymentCurrency, circleCurrency, isCrossBorder]);

  // Calculate amount in payment currency
  const circleAmount = circle?.amount || 0;
  const paymentAmount = useMemo(() => {
    if (!isCrossBorder) return circleAmount;
    // Convert from circle currency to payment currency
    const reverseRate = getExchangeRate(circleCurrency, paymentCurrency);
    return convert(circleAmount, circleCurrency, paymentCurrency);
  }, [circleAmount, circleCurrency, paymentCurrency, isCrossBorder]);

  // Get wallet balance for selected currency
  const walletBalance = getCurrencyBalance(paymentCurrency);
  const hasEnoughBalance = walletBalance >= paymentAmount;

  // Available currencies from user's wallets
  const availableCurrencies = currencies
    .filter(c => c.isActive && c.balance > 0)
    .map(c => c.code);

  if (!circle) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circle Not Found</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.errorText}>This circle could not be found.</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const amount = circle.amount;
  const hasBeneficiary = circle.beneficiaryName;
  const isOneTime = circle.frequency === "one-time";

  const getCurrentCycleInfo = () => {
    const startDate = new Date(circle.startDate);
    const now = new Date();
    let cycleNumber = 1;
    let cycleStart = new Date(startDate);
    let cycleEnd = new Date(startDate);

    while (cycleEnd <= now) {
      cycleStart = new Date(cycleEnd);
      switch (circle.frequency) {
        case "daily":
          cycleEnd.setDate(cycleEnd.getDate() + 1);
          break;
        case "weekly":
          cycleEnd.setDate(cycleEnd.getDate() + 7);
          break;
        case "biweekly":
          cycleEnd.setDate(cycleEnd.getDate() + 14);
          break;
        case "monthly":
          cycleEnd.setMonth(cycleEnd.getMonth() + 1);
          break;
        default:
          break;
      }
      if (cycleEnd <= now) {
        cycleNumber++;
      }
    }

    return {
      cycleNumber,
      dueDate: cycleEnd,
    };
  };

  const cycleInfo = getCurrentCycleInfo();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysUntilDue = () => {
    const now = new Date();
    const due = cycleInfo.dueDate;
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue();

  const handleConfirmPayment = async () => {
    if (selectedMethod === "wallet" && !hasEnoughBalance) {
      Alert.alert(
        "Insufficient Balance",
        `Your ${paymentCurrency} wallet balance is not enough for this contribution. Please add funds or choose a different payment method.`,
        [{ text: "OK" }]
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Process the contribution with currency conversion if cross-border
      const transactionId = await makeContribution(
        paymentAmount,
        paymentCurrency,
        circleId,
        circle.name,
        isCrossBorder ? circleCurrency : undefined,
        isCrossBorder ? exchangeInfo?.rate : undefined
      );

      // Determine if payment is on time or early
      const isEarly = daysUntilDue > 2;
      const isOnTime = daysUntilDue >= 0;

      // Process contribution for XnScore
      await processContribution(circleId, isOnTime, isEarly);

      // Navigate to success screen
      navigation.navigate("ContributionSuccess", {
        circleId,
        amount: isCrossBorder ? paymentAmount : amount,
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

  const currencyInfo = CURRENCIES[paymentCurrency];
  const circleCurrencyInfo = CURRENCIES[circleCurrency];

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
            <Text style={styles.headerTitle}>Make Contribution</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Circle Info */}
          <View style={styles.circleInfo}>
            <View style={styles.circleIconContainer}>
              <Text style={styles.circleEmoji}>{circle.emoji}</Text>
            </View>
            <Text style={styles.circleName}>{circle.name}</Text>
            {(circle as any)?.currency && (
              <View style={styles.circleCurrencyBadge}>
                <Text style={styles.circleCurrencyText}>
                  {circleCurrencyInfo?.flag} {circleCurrency} Circle
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Contribution Amount</Text>
            <Text style={styles.amountValue}>
              {circleCurrencyInfo?.symbol}{formatCurrency(amount, circleCurrency)}
            </Text>
            <Text style={styles.amountSubtext}>
              {isOneTime ? "One-time contribution" : `${getFrequencyLabel(circle.frequency)} contribution`}
            </Text>
          </View>

          {/* Currency Selection for Cross-Border */}
          <View style={styles.currencySection}>
            <View style={styles.currencySectionHeader}>
              <Text style={styles.sectionTitle}>Pay With</Text>
              <TouchableOpacity onPress={() => setShowCurrencyOptions(!showCurrencyOptions)}>
                <Text style={styles.changeCurrency}>
                  {showCurrencyOptions ? "Hide options" : "Change currency"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Currency Picker */}
            {showCurrencyOptions && (
              <QuickCurrencyPicker
                selectedCurrency={paymentCurrency}
                onSelect={setPaymentCurrency}
                currencies={availableCurrencies.length > 0 ? availableCurrencies : ["USD", "EUR", "GBP", "XOF", "NGN", "KES"]}
              />
            )}

            {/* Selected Currency Display */}
            <View style={styles.selectedCurrencyCard}>
              <View style={styles.selectedCurrencyInfo}>
                <Text style={styles.selectedCurrencyFlag}>{currencyInfo?.flag}</Text>
                <View>
                  <Text style={styles.selectedCurrencyCode}>{paymentCurrency}</Text>
                  <Text style={styles.selectedCurrencyName}>{currencyInfo?.name}</Text>
                </View>
              </View>
              <View style={styles.selectedCurrencyAmount}>
                <Text style={styles.selectedCurrencyValue}>
                  {currencyInfo?.symbol}{formatCurrency(paymentAmount, paymentCurrency)}
                </Text>
                {selectedMethod === "wallet" && (
                  <Text style={[
                    styles.walletBalanceSmall,
                    !hasEnoughBalance && styles.walletBalanceInsufficient
                  ]}>
                    Balance: {currencyInfo?.symbol}{formatCurrency(walletBalance, paymentCurrency)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Exchange Rate Display for Cross-Border */}
          {isCrossBorder && (
            <View style={styles.exchangeSection}>
              <ExchangeRateDisplay
                fromCurrency={paymentCurrency}
                toCurrency={circleCurrency}
                amount={paymentAmount}
                showInverse
              />
              <View style={styles.fxWarningContainer}>
                <FXRiskWarning />
              </View>
            </View>
          )}

          {/* Cycle Info */}
          {!isOneTime && (
            <View style={styles.cycleCard}>
              <View style={styles.cycleHeader}>
                <Text style={styles.cycleTitle}>Cycle #{cycleInfo.cycleNumber}</Text>
                <View style={[
                  styles.dueBadge,
                  daysUntilDue <= 2 ? styles.dueBadgeUrgent : null,
                ]}>
                  <Text style={[
                    styles.dueBadgeText,
                    daysUntilDue <= 2 ? styles.dueBadgeTextUrgent : null,
                  ]}>
                    {daysUntilDue <= 0 ? "Due Today!" : `${daysUntilDue} days left`}
                  </Text>
                </View>
              </View>
              <View style={styles.cycleDetail}>
                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                <Text style={styles.cycleDetailText}>
                  Due by {formatDate(cycleInfo.dueDate)}
                </Text>
              </View>
            </View>
          )}

          {/* Beneficiary Info */}
          {hasBeneficiary && (
            <View style={styles.beneficiaryCard}>
              <View style={styles.beneficiaryIcon}>
                <Ionicons name="heart" size={20} color="#00C6AE" />
              </View>
              <View style={styles.beneficiaryContent}>
                <Text style={styles.beneficiaryLabel}>Supporting</Text>
                <Text style={styles.beneficiaryName}>{circle.beneficiaryName}</Text>
              </View>
            </View>
          )}

          {/* Payment Methods */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment Method</Text>

            {paymentMethods.map((method) => {
              const isSelected = selectedMethod === method.id;
              const isWallet = method.id === "wallet";
              const insufficientBalance = isWallet && !hasEnoughBalance;

              return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethodCard,
                    isSelected && styles.paymentMethodCardSelected,
                    insufficientBalance && styles.paymentMethodCardWarning,
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                  disabled={!method.available}
                >
                  <View style={[
                    styles.paymentMethodIcon,
                    isSelected && styles.paymentMethodIconSelected,
                  ]}>
                    <Ionicons
                      name={method.icon}
                      size={22}
                      color={isSelected ? "#FFFFFF" : "#00C6AE"}
                    />
                  </View>

                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodName}>{method.name}</Text>
                    <Text style={styles.paymentMethodDesc}>{method.description}</Text>
                    {isWallet && (
                      <View style={styles.balanceRow}>
                        <Text style={[
                          styles.balanceText,
                          insufficientBalance && styles.balanceTextInsufficient,
                        ]}>
                          {paymentCurrency} Balance: {currencyInfo?.symbol}{formatCurrency(walletBalance, paymentCurrency)}
                        </Text>
                        {insufficientBalance && (
                          <View style={styles.insufficientBadge}>
                            <Text style={styles.insufficientText}>Insufficient</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={[
                    styles.radioButton,
                    isSelected && styles.radioButtonSelected,
                  ]}>
                    {isSelected && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Payment Summary</Text>

            {isCrossBorder && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Circle Contribution</Text>
                  <Text style={styles.summaryValue}>
                    {circleCurrencyInfo?.symbol}{formatCurrency(amount, circleCurrency)} {circleCurrency}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Exchange Rate</Text>
                  <Text style={styles.summaryValue}>
                    1 {paymentCurrency} = {exchangeInfo?.rate.toFixed(4)} {circleCurrency}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You Pay</Text>
              <Text style={styles.summaryValue}>
                {currencyInfo?.symbol}{formatCurrency(paymentAmount, paymentCurrency)} {paymentCurrency}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Processing Fee</Text>
              <Text style={[styles.summaryValue, { color: "#00C6AE" }]}>
                {currencyInfo?.symbol}0.00
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {currencyInfo?.symbol}{formatCurrency(paymentAmount, paymentCurrency)} {paymentCurrency}
              </Text>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Ionicons name="shield-checkmark" size={18} color="#00897B" />
            <Text style={styles.infoNoteText}>
              Your payment is secure and will be held until the payout is triggered.
              {isCrossBorder && " The exchange rate is locked at the time of contribution."}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomLabel}>Total Amount</Text>
          <Text style={styles.bottomAmount}>
            {currencyInfo?.symbol}{formatCurrency(paymentAmount, paymentCurrency)}
          </Text>
          {isCrossBorder && (
            <Text style={styles.bottomConversion}>
              = {circleCurrencyInfo?.symbol}{formatCurrency(amount, circleCurrency)} {circleCurrency}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            isProcessing && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmPayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Text style={styles.confirmButtonText}>Processing...</Text>
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>Confirm Payment</Text>
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
  circleInfo: {
    alignItems: "center",
  },
  circleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  circleEmoji: {
    fontSize: 28,
  },
  circleName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  circleCurrencyBadge: {
    marginTop: 8,
    backgroundColor: "rgba(0,198,174,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  circleCurrencyText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00C6AE",
  },
  content: {
    padding: 20,
    paddingBottom: 180,
  },
  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  amountLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 40,
    fontWeight: "700",
    color: "#0A2342",
    letterSpacing: -1,
  },
  amountSubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  currencySection: {
    marginBottom: 16,
  },
  currencySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  changeCurrency: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  selectedCurrencyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
  },
  selectedCurrencyInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedCurrencyFlag: {
    fontSize: 28,
  },
  selectedCurrencyCode: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  selectedCurrencyName: {
    fontSize: 12,
    color: "#6B7280",
  },
  selectedCurrencyAmount: {
    alignItems: "flex-end",
  },
  selectedCurrencyValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  walletBalanceSmall: {
    fontSize: 11,
    color: "#00C6AE",
    marginTop: 2,
  },
  walletBalanceInsufficient: {
    color: "#F59E0B",
  },
  exchangeSection: {
    marginBottom: 16,
  },
  fxWarningContainer: {
    marginTop: 12,
  },
  cycleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cycleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cycleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  dueBadge: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dueBadgeUrgent: {
    backgroundColor: "#FEF2F2",
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00897B",
  },
  dueBadgeTextUrgent: {
    color: "#DC2626",
  },
  cycleDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cycleDetailText: {
    fontSize: 13,
    color: "#6B7280",
  },
  beneficiaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  beneficiaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  beneficiaryContent: {
    flex: 1,
  },
  beneficiaryLabel: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  beneficiaryName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginTop: 2,
  },
  paymentSection: {
    marginBottom: 16,
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
  bottomConversion: {
    fontSize: 11,
    color: "#00C6AE",
    marginTop: 2,
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
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  errorButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#0A2342",
    borderRadius: 10,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
