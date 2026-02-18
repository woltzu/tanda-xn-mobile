import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";

interface ExchangeRateDisplayProps {
  fromCurrency: string;
  toCurrency: string;
  amount?: number;
  showInverse?: boolean;
  compact?: boolean;
  onRefresh?: () => void;
}

export function ExchangeRateDisplay({
  fromCurrency,
  toCurrency,
  amount,
  showInverse = false,
  compact = false,
  onRefresh,
}: ExchangeRateDisplayProps) {
  const { getExchangeRate, formatCurrency, convert, isLoadingRates, refreshRates, lastUpdated } = useCurrency();

  const fromInfo = CURRENCIES[fromCurrency];
  const toInfo = CURRENCIES[toCurrency];
  const rateInfo = getExchangeRate(fromCurrency, toCurrency);

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    } else {
      await refreshRates();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactRate}>
          <Text style={styles.compactLabel}>1 {fromCurrency} =</Text>
          <Text style={styles.compactValue}>
            {rateInfo.rate.toFixed(rateInfo.rate < 1 ? 4 : 2)} {toCurrency}
          </Text>
        </View>
        {amount !== undefined && (
          <View style={styles.compactConversion}>
            <Text style={styles.compactConversionLabel}>You'll receive:</Text>
            <Text style={styles.compactConversionValue}>
              {toInfo?.symbol}{formatCurrency(convert(amount, fromCurrency, toCurrency), toCurrency)} {toCurrency}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Rate Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Exchange Rate</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isLoadingRates}
        >
          {isLoadingRates ? (
            <ActivityIndicator size="small" color="#00C6AE" />
          ) : (
            <Ionicons name="refresh" size={18} color="#00C6AE" />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Rate Display */}
      <View style={styles.rateContainer}>
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyFlag}>{fromInfo?.flag}</Text>
          <Text style={styles.currencyCode}>{fromCurrency}</Text>
        </View>

        <View style={styles.rateArrow}>
          <Ionicons name="arrow-forward" size={20} color="#9CA3AF" />
        </View>

        <View style={styles.currencyBadge}>
          <Text style={styles.currencyFlag}>{toInfo?.flag}</Text>
          <Text style={styles.currencyCode}>{toCurrency}</Text>
        </View>
      </View>

      {/* Rate Value */}
      <View style={styles.rateValueContainer}>
        <Text style={styles.ratePrefix}>1 {fromCurrency} =</Text>
        <Text style={styles.rateValue}>
          {toInfo?.symbol}{rateInfo.rate.toFixed(rateInfo.rate < 1 ? 6 : 2)}
        </Text>
        <Text style={styles.rateSuffix}>{toCurrency}</Text>
      </View>

      {/* Inverse Rate */}
      {showInverse && (
        <Text style={styles.inverseRate}>
          1 {toCurrency} = {fromInfo?.symbol}{rateInfo.inverseRate.toFixed(rateInfo.inverseRate < 1 ? 6 : 2)} {fromCurrency}
        </Text>
      )}

      {/* Conversion Preview */}
      {amount !== undefined && amount > 0 && (
        <View style={styles.conversionPreview}>
          <View style={styles.conversionRow}>
            <Text style={styles.conversionLabel}>You send</Text>
            <Text style={styles.conversionAmount}>
              {fromInfo?.symbol}{formatCurrency(amount, fromCurrency)} {fromCurrency}
            </Text>
          </View>
          <View style={styles.conversionDivider}>
            <Ionicons name="swap-vertical" size={16} color="#00C6AE" />
          </View>
          <View style={styles.conversionRow}>
            <Text style={styles.conversionLabel}>They receive</Text>
            <Text style={styles.conversionAmountHighlight}>
              {toInfo?.symbol}{formatCurrency(convert(amount, fromCurrency, toCurrency), toCurrency)} {toCurrency}
            </Text>
          </View>
        </View>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <Text style={styles.timestamp}>
          Rate as of {formatTime(lastUpdated)}
        </Text>
      )}
    </View>
  );
}

// Live Rate Ticker Component
interface RateTickerProps {
  baseCurrency: string;
  currencies?: string[];
}

export function RateTicker({
  baseCurrency,
  currencies = ["EUR", "GBP", "XOF", "NGN", "KES"],
}: RateTickerProps) {
  const { getExchangeRate } = useCurrency();

  return (
    <View style={styles.tickerContainer}>
      {currencies.map((code) => {
        if (code === baseCurrency) return null;
        const rate = getExchangeRate(baseCurrency, code);
        const currency = CURRENCIES[code];

        return (
          <View key={code} style={styles.tickerItem}>
            <Text style={styles.tickerFlag}>{currency?.flag}</Text>
            <Text style={styles.tickerCode}>{code}</Text>
            <Text style={styles.tickerRate}>
              {rate.rate.toFixed(rate.rate < 10 ? 4 : 2)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Conversion Calculator Mini Component
interface ConversionCalculatorProps {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  onAmountChange?: (amount: number) => void;
}

export function ConversionCalculator({
  fromCurrency,
  toCurrency,
  amount,
}: ConversionCalculatorProps) {
  const { convert, formatCurrency, getExchangeRate } = useCurrency();
  const fromInfo = CURRENCIES[fromCurrency];
  const toInfo = CURRENCIES[toCurrency];
  const rateInfo = getExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = convert(amount, fromCurrency, toCurrency);

  return (
    <View style={styles.calculatorContainer}>
      <View style={styles.calculatorRow}>
        <View style={styles.calculatorFrom}>
          <Text style={styles.calculatorFlag}>{fromInfo?.flag}</Text>
          <Text style={styles.calculatorAmount}>
            {fromInfo?.symbol}{formatCurrency(amount, fromCurrency)}
          </Text>
          <Text style={styles.calculatorCode}>{fromCurrency}</Text>
        </View>

        <View style={styles.calculatorArrow}>
          <Ionicons name="arrow-forward" size={24} color="#00C6AE" />
        </View>

        <View style={styles.calculatorTo}>
          <Text style={styles.calculatorFlag}>{toInfo?.flag}</Text>
          <Text style={styles.calculatorAmountLarge}>
            {toInfo?.symbol}{formatCurrency(convertedAmount, toCurrency)}
          </Text>
          <Text style={styles.calculatorCode}>{toCurrency}</Text>
        </View>
      </View>

      <View style={styles.calculatorInfo}>
        <Ionicons name="information-circle" size={14} color="#6B7280" />
        <Text style={styles.calculatorInfoText}>
          Rate: 1 {fromCurrency} = {rateInfo.rate.toFixed(rateInfo.rate < 1 ? 4 : 2)} {toCurrency}
        </Text>
      </View>
    </View>
  );
}

// FX Risk Warning Component
export function FXRiskWarning() {
  return (
    <View style={styles.warningContainer}>
      <Ionicons name="warning" size={20} color="#F59E0B" />
      <View style={styles.warningContent}>
        <Text style={styles.warningTitle}>Exchange Rate Notice</Text>
        <Text style={styles.warningText}>
          The exchange rate at the time of contribution will be applied.
          TandaXn does not carry FX risk - the contributing member bears any
          currency fluctuation between contribution and payout.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Main Container
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,198,174,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Rate Display
  rateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  currencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  currencyFlag: {
    fontSize: 20,
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  rateArrow: {
    paddingHorizontal: 16,
  },

  // Rate Value
  rateValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 8,
  },
  ratePrefix: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 6,
  },
  rateValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0A2342",
  },
  rateSuffix: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 6,
  },
  inverseRate: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 16,
  },

  // Conversion Preview
  conversionPreview: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  conversionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conversionLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  conversionAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  conversionDivider: {
    alignItems: "center",
    paddingVertical: 8,
  },
  conversionAmountHighlight: {
    fontSize: 17,
    fontWeight: "700",
    color: "#00C6AE",
  },

  // Timestamp
  timestamp: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 12,
  },

  // Compact Style
  compactContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
  },
  compactRate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  compactValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  compactConversion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  compactConversionLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  compactConversionValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00C6AE",
  },

  // Ticker
  tickerContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  tickerItem: {
    alignItems: "center",
  },
  tickerFlag: {
    fontSize: 16,
    marginBottom: 4,
  },
  tickerCode: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  tickerRate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A2342",
  },

  // Calculator
  calculatorContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  calculatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calculatorFrom: {
    flex: 1,
    alignItems: "center",
  },
  calculatorTo: {
    flex: 1,
    alignItems: "center",
  },
  calculatorArrow: {
    paddingHorizontal: 16,
  },
  calculatorFlag: {
    fontSize: 32,
    marginBottom: 8,
  },
  calculatorAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  calculatorAmountLarge: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00C6AE",
  },
  calculatorCode: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  calculatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
  },
  calculatorInfoText: {
    fontSize: 12,
    color: "#6B7280",
  },

  // Warning
  warningContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B45309",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
});
