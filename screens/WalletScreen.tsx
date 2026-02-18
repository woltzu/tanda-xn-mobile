import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useWallet, Transaction } from "../context/WalletContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";
import { RateTicker } from "../components/ExchangeRateDisplay";
import { CurrencySelector } from "../components/CurrencySelector";

type WalletScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function WalletScreen() {
  const navigation = useNavigation<WalletScreenNavigationProp>();
  const { balance, currencies, transactions, addCurrencyWallet } = useWallet();
  const { formatCurrency: formatCurrencyAmount, refreshRates, isLoadingRates, lastUpdated, autoRefreshEnabled, setAutoRefreshEnabled } = useCurrency();
  const [showBalance, setShowBalance] = useState(true);
  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
  const [selectedNewCurrency, setSelectedNewCurrency] = useState<string>("NGN");

  // Spinning animation for globe icon
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoadingRates) {
      // Start spinning animation
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      // Stop and reset animation
      spinValue.setValue(0);
    }
  }, [isLoadingRates, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleGlobePress = () => {
    if (autoRefreshEnabled) {
      // Toggle off auto-refresh and do a manual refresh
      setAutoRefreshEnabled(false);
      refreshRates();
    } else {
      // Toggle on auto-refresh (will refresh immediately)
      setAutoRefreshEnabled(true);
    }
  };

  const rateAlerts = [
    { id: 1, from: "USD", to: "XOF", target: 620, current: 610, direction: "above", active: true },
    { id: 2, from: "EUR", to: "XOF", target: 650, current: 656, direction: "below", active: true },
  ];

  const activeCurrencies = currencies.filter((c) => c.isActive && c.balance > 0);
  const inactiveCurrencies = currencies.filter((c) => !c.isActive || c.balance === 0);

  const formatCurrency = (amount: number, code: string, symbol?: string) => {
    if (code === "XOF" || code === "XAF" || code === "NGN" || code === "KES" || code === "TZS" || code === "UGX") {
      return `${symbol || code} ${Math.abs(amount).toLocaleString()}`;
    }
    return `${symbol || "$"}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const getTransactionStyle = (type: Transaction["type"]) => {
    switch (type) {
      case "received":
      case "added":
      case "payout":
        return { icon: "arrow-down-outline" as const, color: "#00C6AE", bg: "#F0FDFB" };
      case "sent":
      case "withdrawn":
      case "contribution":
        return { icon: "arrow-up-outline" as const, color: "#DC2626", bg: "#FEE2E2" };
      case "converted":
        return { icon: "swap-horizontal-outline" as const, color: "#1565C0", bg: "#E3F2FD" };
      case "remittance":
        return { icon: "paper-plane-outline" as const, color: "#8B5CF6", bg: "#F3E8FF" };
      default:
        return { icon: "swap-horizontal-outline" as const, color: "#6B7280", bg: "#F5F7FA" };
    }
  };

  const getTransactionLabel = (tx: Transaction) => {
    if (tx.type === "remittance" && tx.convertedAmount && tx.convertedCurrency) {
      return `${tx.description} (${CURRENCIES[tx.convertedCurrency]?.symbol}${formatCurrencyAmount(tx.convertedAmount, tx.convertedCurrency)})`;
    }
    if (tx.type === "contribution" && tx.convertedAmount && tx.convertedCurrency) {
      return `${tx.description} → ${tx.convertedCurrency}`;
    }
    return tx.description;
  };

  const handleAddCurrency = async () => {
    try {
      await addCurrencyWallet(selectedNewCurrency);
      setShowAddCurrencyModal(false);
    } catch (error) {
      console.error("Error adding currency:", error);
    }
  };

  // Get currencies that can be added (not already active)
  const addableCurrencies = Object.keys(CURRENCIES).filter(
    code => !currencies.some(c => c.code === code && c.isActive)
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Wallet</Text>
            <TouchableOpacity
              onPress={handleGlobePress}
              disabled={isLoadingRates}
              style={[
                styles.globeButton,
                autoRefreshEnabled && styles.globeButtonActive,
              ]}
            >
              <Animated.View style={{ transform: [{ rotate: isLoadingRates ? spin : "0deg" }] }}>
                <Ionicons
                  name={autoRefreshEnabled ? "globe" : "globe-outline"}
                  size={24}
                  color={autoRefreshEnabled ? "#00C6AE" : "rgba(255,255,255,0.7)"}
                />
              </Animated.View>
              {autoRefreshEnabled && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Total Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.decorativeCircle} />
            <View style={styles.balanceContent}>
              <Text style={styles.balanceLabel}>Total Balance (USD equivalent)</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceAmount}>
                  {showBalance ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "••••••"}
                </Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} style={styles.eyeButton}>
                  <Ionicons
                    name={showBalance ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.currencyCount}>Across {activeCurrencies.length} currencies</Text>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.actionButtonPrimary}
                  onPress={() => navigation.navigate("AddFunds")}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Add Funds</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButtonOutline}
                  onPress={() => navigation.navigate("Withdraw")}
                >
                  <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Remittance Banner */}
          <TouchableOpacity
            style={styles.remittanceBanner}
            onPress={() => navigation.navigate("Remittance" as any)}
          >
            <View style={styles.remittanceLeft}>
              <View style={styles.remittanceIcon}>
                <Ionicons name="paper-plane" size={20} color="#00C6AE" />
              </View>
              <View>
                <Text style={styles.remittanceTitle}>Send Money Abroad</Text>
                <Text style={styles.remittanceSubtitle}>Transfer to family & friends worldwide</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#00C6AE" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Live Rates Ticker */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveRatesHeader}>
                <Text style={styles.sectionTitle}>Live Rates (USD)</Text>
                {autoRefreshEnabled && (
                  <View style={styles.liveTagContainer}>
                    <View style={styles.liveTagDot} />
                    <Text style={styles.liveTagText}>LIVE</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={refreshRates} disabled={isLoadingRates}>
                <View style={styles.refreshTimestamp}>
                  {lastUpdated && (
                    <Text style={styles.ratesTimestamp}>
                      Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  )}
                  <Ionicons
                    name="refresh-outline"
                    size={14}
                    color={isLoadingRates ? "#00C6AE" : "#9CA3AF"}
                    style={isLoadingRates ? { opacity: 0.5 } : undefined}
                  />
                </View>
              </TouchableOpacity>
            </View>
            <RateTicker baseCurrency="USD" currencies={["EUR", "GBP", "XOF", "NGN", "KES"]} />
          </View>

          {/* My Currencies */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Currencies</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddCurrencyModal(true)}
              >
                <Ionicons name="add" size={16} color="#00C6AE" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {activeCurrencies.map((currency) => (
              <TouchableOpacity key={currency.code} style={styles.currencyCard}>
                <View style={styles.currencyLeft}>
                  <View style={styles.flagContainer}>
                    <Text style={styles.flagText}>{currency.flag}</Text>
                  </View>
                  <View>
                    <Text style={styles.currencyCode}>{currency.code}</Text>
                    <Text style={styles.currencyName}>{currency.name}</Text>
                  </View>
                </View>
                <View style={styles.currencyRight}>
                  <View>
                    <Text style={styles.currencyBalance}>
                      {showBalance ? formatCurrency(currency.balance, currency.code, currency.symbol) : "••••"}
                    </Text>
                    {currency.code !== "USD" && currency.usdValue ? (
                      <Text style={styles.currencyUsdValue}>
                        ≈ ${currency.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}

            {activeCurrencies.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No currency wallets yet</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setShowAddCurrencyModal(true)}
                >
                  <Text style={styles.emptyButtonText}>Add a currency</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Rate Alerts */}
          {rateAlerts.filter((a) => a.active).length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Rate Alerts</Text>
                <TouchableOpacity>
                  <Text style={styles.manageText}>Manage</Text>
                </TouchableOpacity>
              </View>

              {rateAlerts
                .filter((a) => a.active)
                .slice(0, 2)
                .map((alert) => (
                  <View key={alert.id} style={styles.alertCard}>
                    <View style={styles.alertLeft}>
                      <Ionicons name="notifications" size={18} color="#1565C0" />
                      <View>
                        <Text style={styles.alertTitle}>
                          {alert.from} → {alert.to}
                        </Text>
                        <Text style={styles.alertSubtitle}>
                          Alert when {alert.direction} {alert.target.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.alertCurrent}>Now: {alert.current.toLocaleString()}</Text>
                  </View>
                ))}
            </View>
          ) : null}

          {/* Recent Activity */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity>
                <Text style={styles.manageText}>See All</Text>
              </TouchableOpacity>
            </View>

            {transactions.slice(0, 5).map((tx) => {
              const txStyle = getTransactionStyle(tx.type);
              const isPositive = tx.amount > 0;

              return (
                <TouchableOpacity key={tx.id} style={styles.transactionCard}>
                  <View style={styles.transactionLeft}>
                    <View style={[styles.transactionIcon, { backgroundColor: txStyle.bg }]}>
                      <Ionicons name={txStyle.icon} size={18} color={txStyle.color} />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionDescription} numberOfLines={1}>
                        {getTransactionLabel(tx)}
                      </Text>
                      <View style={styles.transactionMeta}>
                        <Text style={styles.transactionDate}>{tx.date}</Text>
                        {tx.flag && <Text style={styles.transactionFlag}>{tx.flag}</Text>}
                      </View>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      {
                        color: isPositive ? "#00C6AE" : tx.type === "sent" || tx.type === "withdrawn" || tx.type === "contribution" || tx.type === "remittance" ? "#DC2626" : "#0A2342",
                      },
                    ]}
                  >
                    {isPositive ? "+" : ""}
                    {formatCurrency(tx.amount, tx.currency)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {transactions.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            )}
          </View>
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

      {/* Add Currency Modal */}
      <Modal
        visible={showAddCurrencyModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Currency Wallet</Text>
              <TouchableOpacity onPress={() => setShowAddCurrencyModal(false)}>
                <Ionicons name="close" size={24} color="#0A2342" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select a currency to add to your wallet
            </Text>

            <CurrencySelector
              selectedCurrency={selectedNewCurrency}
              onSelect={setSelectedNewCurrency}
              label="Currency"
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleAddCurrency}
            >
              <Text style={styles.modalButtonText}>Add {selectedNewCurrency} Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 24,
    position: "relative",
    overflow: "hidden",
  },
  decorativeCircle: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    backgroundColor: "rgba(0,198,174,0.1)",
    borderRadius: 75,
  },
  balanceContent: {
    position: "relative",
  },
  balanceLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eyeButton: {
    padding: 4,
  },
  currencyCount: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 20,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButtonOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    backgroundColor: "#00C6AE",
    borderRadius: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  remittanceBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,198,174,0.15)",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.3)",
  },
  remittanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  remittanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  remittanceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  remittanceSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0A2342",
  },
  ratesTimestamp: {
    fontSize: 11,
    color: "#9CA3AF",
    marginRight: 4,
  },
  refreshTimestamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveRatesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveTagContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,198,174,0.15)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    gap: 4,
  },
  liveTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00C6AE",
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#00C6AE",
    letterSpacing: 0.5,
  },
  globeButton: {
    padding: 4,
    position: "relative",
  },
  globeButtonActive: {
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 20,
    padding: 6,
  },
  liveIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00C6AE",
    borderWidth: 1.5,
    borderColor: "#0A2342",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    color: "#00C6AE",
    fontSize: 14,
    fontWeight: "600",
  },
  manageText: {
    color: "#00C6AE",
    fontSize: 14,
    fontWeight: "600",
  },
  currencyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  currencyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flagContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  flagText: {
    fontSize: 22,
  },
  currencyCode: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  currencyName: {
    fontSize: 12,
    color: "#6B7280",
  },
  currencyRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currencyBalance: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    textAlign: "right",
    marginBottom: 2,
  },
  currencyUsdValue: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
  emptyButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#00C6AE",
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  alertCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  alertLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  alertCurrent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1565C0",
  },
  transactionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
    marginBottom: 2,
  },
  transactionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  transactionDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  transactionFlag: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  floatingHelp: {
    position: "absolute",
    bottom: 90,
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
