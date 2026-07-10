import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { colors } from "../theme/tokens";
import { useWallet, Transaction } from "../context/WalletContext";
import { usePayment } from "../context/PaymentContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";
import { RateTicker } from "../components/ExchangeRateDisplay";
import { CurrencySelector } from "../components/CurrencySelector";
import {
  useRecentTransfers,
  formatTransferDate,
} from "../hooks/useRecentTransfers";
import { useKYCGate } from "../components/KYCGate";
import { useGoalActions } from "../hooks/useGoalActions";
import { useCircleNetBalance } from "../hooks/useCircleNetBalance";
import { useAuth } from "../context/AuthContext";
// Phase 2 (migration 257) — critical-tier gate for withdraw. The trigger
// tr_block_critical_withdrawal rejects the underlying withdrawal_requests
// INSERT; the imperative hook here intercepts at the navigation entry so
// the user gets the resolution-center prompt before the form.
import { useRestrictedAction } from "../components/RestrictedActionGate";
import { useCircles } from "../context/CirclesContext";
import { supabase } from "../lib/supabase";

// P1 coach-mark gate. v1 because we expect the screen layout to keep
// drifting — a future redesign can bump this to v2 to re-show the tour.
const WALLET_COACH_SEEN_KEY = "@tandaxn_wallet_coach_seen_v1";
// Bucket C of the receive-payout review — distinct gate so the
// payout-specific tip only fires after the user actually has a payout
// to point at.
const WALLET_PAYOUT_COACH_KEY = "@tandaxn_wallet_payout_coach_seen_v1";

type WalletScreenNavigationProp = StackNavigationProp<RootStackParamList>;

// Empty FlatList sentinel — see the identical comment in HomeScreen.
const WALLET_FLAT_DATA: readonly never[] = [];
const renderWalletFlatItem = () => null;

export default function WalletScreen() {
  const navigation = useNavigation<WalletScreenNavigationProp>();
  const { t } = useTranslation();
  const { balance, currencies, addCurrencyWallet, refreshWallet } = useWallet();
  const { fetchGoals } = useGoalActions();
  const { isBlocked: isWithdrawBlocked, showBlockedAlert: showWithdrawBlocked } =
    useRestrictedAction();
  const { totalNet: circleNetTotal } = useCircleNetBalance();
  // Recent Activity now reads from money_transfers via the new hook —
  // the prior local-AsyncStorage list was missing fresh sends because
  // it lived on the same state tree that gets reset by the navigation
  // .reset() out of the success screen. `useFocusEffect` re-runs the
  // query whenever the user returns to this tab.
  const {
    transfers,
    loading: transfersLoading,
    refetch: refetchTransfers,
  } = useRecentTransfers(10);
  useFocusEffect(
    useCallback(() => {
      refetchTransfers();
    }, [refetchTransfers]),
  );
  const { paymentMethods, isOnboarded, isLoadingMethods } = usePayment();
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

  // P0 (Access Wallet review): gate the inbound + outbound money
  // surfaces. Add-funds and Remittance both route to KYCHub when the
  // user is unverified; the deferred-action snapshot sends them back
  // to the action they wanted after the verification flow completes.
  // Send-money (DomesticSendMoney) has its own gate at submit time
  // (added in the KYC trigger review) so we don't double-gate here.
  const addFundsGate = useKYCGate({ resumeRoute: "AddFunds" });
  const remittanceGate = useKYCGate({ resumeRoute: "Remittance" });

  const handleSendMoney = () => {
    navigation.navigate("DomesticSendMoney" as never);
  };
  const handleAddFunds = async () => {
    const passed = await addFundsGate.ensureVerified();
    if (!passed) return;
    navigation.navigate("AddFunds");
  };
  const handleRemittance = async () => {
    const passed = await remittanceGate.ensureVerified();
    if (!passed) return;
    navigation.navigate("Remittance" as never);
  };

  // ── P1.1 Pull-to-refresh ────────────────────────────────────────
  // Three things can have moved while the user was off-screen: the
  // wallet balances (a contribution debited, a send completed), the
  // recent transfers list, and the live FX rates. Refresh in parallel
  // so the spinner reflects the slowest, not the sum. Errors from any
  // one slot are isolated so a flaky rate provider doesn't cancel the
  // wallet/transfers refresh.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshWallet().catch(() => null),
        refetchTransfers().catch(() => null),
        refreshRates().catch(() => null),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshWallet, refetchTransfers, refreshRates]);

  // ── P1.3 FX accordion ───────────────────────────────────────────
  // Open by default when the user holds more than one currency
  // (active FX usage); closed by default for USD-only users (the
  // common case — cuts the section's vertical footprint). null means
  // "follow the auto rule"; once the user manually toggles, the
  // explicit boolean wins so the auto rule can't clobber their pick.
  const [fxOpenUser, setFxOpenUser] = useState<boolean | null>(null);
  const fxOpen = fxOpenUser ?? currencies.length > 1;
  const toggleFx = () => {
    setFxOpenUser((prev) => (prev === null ? !(currencies.length > 1) : !prev));
  };

  // ── P1.5 First-visit coach mark ─────────────────────────────────
  // Three-step bottom-sheet tour, gated on AsyncStorage. We check on
  // mount and reveal only if the seen flag is missing. Steps cover
  // the balance card, the actions row, and the recent activity list.
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachStep, setCoachStep] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(WALLET_COACH_SEEN_KEY);
        if (cancelled) return;
        if (!seen) setCoachVisible(true);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissCoach = async () => {
    setCoachVisible(false);
    try {
      await AsyncStorage.setItem(WALLET_COACH_SEEN_KEY, "1");
    } catch {
      /* best-effort */
    }
  };

  // Payout-specific coach mark. Only fires when (a) the user has at
  // least one completed circle_payouts row AND (b) they haven't seen
  // the tip yet. Auto-dismiss after 4 s or on tap. The lookup query is
  // bounded to limit(1) so it's cheap.
  const { user } = useAuth();
  const { myCircles } = useCircles();
  const [payoutCoachVisible, setPayoutCoachVisible] = useState(false);
  const [payoutCoachCircleName, setPayoutCoachCircleName] = useState<string>("");
  const payoutCoachCheckedRef = useRef(false);
  useEffect(() => {
    if (payoutCoachCheckedRef.current) return;
    if (!user?.id) return;
    payoutCoachCheckedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(WALLET_PAYOUT_COACH_KEY);
        if (cancelled || seen) return;
        const { data, error } = await supabase
          .from("circle_payouts")
          .select("id, circle_id")
          .eq("recipient_id", user.id)
          .eq("status", "completed")
          .order("actual_date", { ascending: false })
          .limit(1);
        if (cancelled || error || !data || data.length === 0) return;
        const row = data[0] as { id: string; circle_id: string };
        const matchingCircle = myCircles.find((c) => c.id === row.circle_id);
        setPayoutCoachCircleName(matchingCircle?.name ?? "");
        setPayoutCoachVisible(true);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, myCircles]);
  useEffect(() => {
    if (!payoutCoachVisible) return;
    const tid = setTimeout(() => dismissPayoutCoach(), 4000);
    return () => clearTimeout(tid);
    // dismissPayoutCoach is stable; intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutCoachVisible]);
  const dismissPayoutCoach = () => {
    setPayoutCoachVisible(false);
    AsyncStorage.setItem(WALLET_PAYOUT_COACH_KEY, "1").catch(() => undefined);
  };
  const handleCoachNext = () => {
    if (coachStep >= 2) {
      dismissCoach();
    } else {
      setCoachStep((s) => s + 1);
    }
  };

  // ── P1.6 Balance breakdown sheet ────────────────────────────────
  // Same three components as Home's total-net tile: Wallet + Goals +
  // Circle Net. Wallet comes from useWallet() and circle net from the
  // shared cached hook. Goals total is fetched lazily on first sheet
  // open so the cost (one extra Supabase round-trip) is only paid by
  // users who actually tap the (?) icon.
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [goalsTotal, setGoalsTotal] = useState<number | null>(null);
  const handleOpenBreakdown = async () => {
    setBreakdownVisible(true);
    if (goalsTotal === null) {
      try {
        const { data } = await fetchGoals();
        const sum = (data ?? []).reduce(
          (acc, g) => acc + (g.currentBalance ?? 0),
          0,
        );
        setGoalsTotal(sum);
      } catch {
        setGoalsTotal(0);
      }
    }
  };
  const breakdownTotal = balance + (goalsTotal ?? 0) + circleNetTotal;

  // ── P1.2 Skeleton pulse animation ───────────────────────────────
  // One shared Animated.Value drives the opacity loop for every
  // skeleton row. Lighter than animating each row independently and
  // keeps the pulses in sync visually.
  const skeletonPulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!transfersLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(skeletonPulse, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [transfersLoading, skeletonPulse]);

  const activeCurrencies = currencies.filter((c) => c.isActive && c.balance > 0);
  const inactiveCurrencies = currencies.filter((c) => !c.isActive || c.balance === 0);

  // Map RecentTransfer rows from money_transfers → the same Transaction
  // shape the existing renderer below expects. Sign convention: sent is
  // negative (red, "−"), received is positive (green, "+").
  const transferRows: Transaction[] = useMemo(
    () =>
      transfers.map((r) => {
        const dollars = r.amount_cents / 100;
        const isSent = r.direction === "sent";
        return {
          id: r.id,
          type: isSent ? "sent" : "received",
          description: isSent
            ? `To ${r.recipient_external_identifier}`
            : t("wallet.transfer_received_label", {
                defaultValue: "Money received",
              }),
          amount: isSent ? -dollars : dollars,
          currency: r.currency,
          date: formatTransferDate(r.created_at),
          method: r.method,
          flag: undefined,
        };
      }),
    [transfers, t],
  );

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
        return { icon: "arrow-down-outline" as const, color: colors.accentTeal, bg: colors.tealTintBg };
      case "sent":
      case "withdrawn":
      case "contribution":
        return { icon: "arrow-up-outline" as const, color: colors.errorText, bg: colors.errorBg };
      case "converted":
        return { icon: "swap-horizontal-outline" as const, color: "#1565C0", bg: "#E3F2FD" };
      case "remittance":
        return { icon: "paper-plane-outline" as const, color: "#8B5CF6", bg: "#F3E8FF" };
      default:
        return { icon: "swap-horizontal-outline" as const, color: colors.textSecondary, bg: colors.screenBg };
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
      {/* Outer surface converted from ScrollView → FlatList for the
          smoother gesture-handling path. Screen carries no rows;
          everything sits in ListHeaderComponent. */}
      <FlatList
        data={WALLET_FLAT_DATA}
        renderItem={renderWalletFlatItem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentTeal}
            colors={[colors.accentTeal]}
          />
        }
        ListHeaderComponent={
          <View>
        {/* Header */}
        <LinearGradient colors={[colors.primaryNavy, "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>{t("wallet.header")}</Text>
            {/* P1.4: globe auto-refresh chip moved into the FX section
                header so the main header reads as money-first, not FX-first. */}
          </View>

          {/* Total Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.decorativeCircle} />
            <View style={styles.balanceContent}>
              <Text style={styles.balanceLabel}>{t("wallet.balance_label")}</Text>
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
                {/* P1.6: tap to open the Wallet + Goals + Circle Net
                    breakdown that mirrors Home's total-net tile. */}
                <TouchableOpacity
                  onPress={handleOpenBreakdown}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("wallet.breakdown_a11y")}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.currencyCount}>
                {t("wallet.currency_count", { count: activeCurrencies.length })}
              </Text>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.actionButtonPrimary}
                  onPress={handleSendMoney}
                >
                  <Ionicons name="paper-plane" size={16} color={colors.cardBg} />
                  <Text style={styles.actionButtonText}>{t("wallet.send")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButtonOutline}
                  onPress={handleAddFunds}
                >
                  <Ionicons name="add" size={16} color={colors.cardBg} />
                  <Text style={styles.actionButtonText}>{t("wallet.action_add_funds")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButtonOutline}
                  onPress={() => {
                    if (isWithdrawBlocked) return showWithdrawBlocked();
                    navigation.navigate("Withdraw");
                  }}
                >
                  <Ionicons name="arrow-up" size={16} color={colors.cardBg} />
                  <Text style={styles.actionButtonText}>{t("wallet.action_withdraw")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* P2 (Access Wallet review): empty-wallet nudge. Renders
              when the USD balance is below $1 to give a clear next
              step. Add Funds reuses handleAddFunds — the KYCGate
              from P0 still wraps that path, so unverified users are
              still routed to KYCHub before reaching AddFunds. */}
          {balance < 1 ? (
            <TouchableOpacity
              style={styles.emptyBanner}
              onPress={handleAddFunds}
              accessibilityRole="button"
            >
              <View style={styles.emptyBannerIcon}>
                <Ionicons name="cash-outline" size={20} color={colors.accentTeal} />
              </View>
              <View style={styles.emptyBannerTextWrap}>
                <Text style={styles.emptyBannerTitle}>{t("wallet.empty_title")}</Text>
                <Text style={styles.emptyBannerBody}>{t("wallet.empty_body")}</Text>
              </View>
              <View style={styles.emptyBannerCta}>
                <Text style={styles.emptyBannerCtaText}>{t("wallet.empty_cta")}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Remittance Banner */}
          <TouchableOpacity
            style={styles.remittanceBanner}
            onPress={handleRemittance}
          >
            <View style={styles.remittanceLeft}>
              <View style={styles.remittanceIcon}>
                <Ionicons name="paper-plane" size={20} color={colors.accentTeal} />
              </View>
              <View>
                <Text style={styles.remittanceTitle}>{t("wallet.remittance_title")}</Text>
                <Text style={styles.remittanceSubtitle}>{t("wallet.remittance_subtitle")}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.accentTeal} />
          </TouchableOpacity>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* P1.3 Currencies & FX (collapsible) */}
          {/*   Combines the prior Live Rates ticker and My Currencies sections
                into a single accordion. Open by default for users with more
                than one currency (active FX usage); closed by default for
                USD-only users to cut visual clutter. P1.4: the globe
                auto-refresh control moved into the header row as a
                compact chip with the same spinning animation. */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={toggleFx}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: fxOpen }}
            >
              <Text style={styles.sectionTitle}>{t("wallet.fx_section_title")}</Text>
              <View style={styles.fxHeaderRight}>
                <TouchableOpacity
                  onPress={(e) => {
                    // Stop the outer accordion toggle from firing when the
                    // user just wants to flip auto-refresh on/off.
                    e.stopPropagation?.();
                    handleGlobePress();
                  }}
                  disabled={isLoadingRates}
                  style={[
                    styles.fxRefreshChip,
                    autoRefreshEnabled && styles.fxRefreshChipActive,
                  ]}
                >
                  <Animated.View style={{ transform: [{ rotate: isLoadingRates ? spin : "0deg" }] }}>
                    <Ionicons
                      name={autoRefreshEnabled ? "refresh" : "refresh-outline"}
                      size={14}
                      color={autoRefreshEnabled ? colors.accentTeal : colors.textSecondary}
                    />
                  </Animated.View>
                  {autoRefreshEnabled && (
                    <Text style={styles.fxRefreshChipText}>{t("wallet.live_tag")}</Text>
                  )}
                </TouchableOpacity>
                <Ionicons
                  name={fxOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            {fxOpen ? (
              <View>
                {/* Live rates ticker */}
                <View style={styles.fxSubHeader}>
                  <Text style={styles.fxSubLabel}>{t("wallet.section_live_rates")}</Text>
                  {lastUpdated && (
                    <Text style={styles.ratesTimestamp}>
                      {t("wallet.rates_updated", {
                        time: lastUpdated.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        }),
                      })}
                    </Text>
                  )}
                </View>
                <RateTicker baseCurrency="USD" currencies={["EUR", "GBP", "XOF", "NGN", "KES"]} />

                {/* My currencies header + Add button */}
                <View style={[styles.fxSubHeader, { marginTop: 16 }]}>
                  <Text style={styles.fxSubLabel}>{t("wallet.section_my_currencies")}</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddCurrencyModal(true)}
                  >
                    <Ionicons name="add" size={16} color={colors.accentTeal} />
                    <Text style={styles.addButtonText}>{t("wallet.add_button")}</Text>
                  </TouchableOpacity>
                </View>

                {activeCurrencies.map((currency) => (
                  // P0: cards no longer pretend to be tappable — there is no
                  // per-currency detail screen wired up. Render as a plain
                  // View so the chevron + active state don't suggest a
                  // destination that doesn't exist.
                  <View key={currency.code} style={styles.currencyCard}>
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
                    </View>
                  </View>
                ))}

                {activeCurrencies.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="wallet-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>{t("wallet.empty_currencies")}</Text>
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={() => setShowAddCurrencyModal(true)}
                    >
                      <Text style={styles.emptyButtonText}>{t("wallet.empty_currencies_cta")}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}
          </View>

          {/* Payment Methods */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("wallet.section_payment_methods")}</Text>
              <TouchableOpacity onPress={() => navigation.navigate("LinkedAccounts" as any)}>
                <Text style={styles.manageText}>{t("wallet.manage")}</Text>
              </TouchableOpacity>
            </View>

            {!isOnboarded && (
              <TouchableOpacity
                style={styles.payoutBanner}
                onPress={() => navigation.navigate("LinkedAccounts" as any)}
              >
                <View style={styles.payoutBannerLeft}>
                  <Ionicons name="flash" size={18} color={colors.cardBg} />
                  <Text style={styles.payoutBannerText}>{t("wallet.payout_banner")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.cardBg} />
              </TouchableOpacity>
            )}

            {paymentMethods.length > 0 ? (
              paymentMethods.slice(0, 3).map((method) => (
                <View key={method.id} style={styles.pmCard}>
                  <View style={styles.pmCardLeft}>
                    <View style={styles.pmIconContainer}>
                      <Ionicons name={method.icon as any} size={20} color={colors.primaryNavy} />
                    </View>
                    <Text style={styles.pmLabel}>{method.label}</Text>
                    {method.isDefault && (
                      <View style={styles.pmDefaultBadge}>
                        <Text style={styles.pmDefaultText}>{t("wallet.pm_default")}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              ))
            ) : (
              <View style={styles.pmEmptyState}>
                <Ionicons name="card-outline" size={36} color="#D1D5DB" />
                <Text style={styles.pmEmptyText}>{t("wallet.empty_pm")}</Text>
                <TouchableOpacity
                  style={styles.pmAddButton}
                  onPress={() => navigation.navigate("LinkedAccounts" as any)}
                >
                  <Ionicons name="add" size={16} color={colors.cardBg} />
                  <Text style={styles.pmAddButtonText}>{t("wallet.pm_add_card")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("wallet.section_recent_activity")}</Text>
            </View>

            {/* Payout-specific coach mark. Surfaces once after the user
                receives their first payout. Tap dismisses; otherwise
                auto-fades after 4 s (handled in the useEffect). */}
            {payoutCoachVisible ? (
              <TouchableOpacity
                style={styles.payoutCoachTip}
                onPress={dismissPayoutCoach}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.payout_coach_tip", {
                  circle_name: payoutCoachCircleName || "your circle",
                })}
              >
                <Ionicons name="information-circle" size={16} color={colors.successLabel} />
                <Text style={styles.payoutCoachTipText}>
                  {t("wallet.payout_coach_tip", {
                    circle_name: payoutCoachCircleName || "your circle",
                  })}
                </Text>
                <Ionicons name="close" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}

            {/* P1.2 skeleton loader. Three placeholder rows fill the
                space while the first useRecentTransfers fetch is in
                flight. Once data lands (or we hit the empty-state),
                the skeletons are dropped. We only show skeletons on
                first load — subsequent refetches keep the prior list
                visible to avoid a jarring blank flash. */}
            {transfersLoading && transferRows.length === 0
              ? [0, 1, 2].map((i) => (
                  <Animated.View
                    key={`sk-${i}`}
                    style={[
                      styles.transactionCard,
                      { backgroundColor: "#F9FAFB", borderColor: "#F3F4F6", opacity: skeletonPulse },
                    ]}
                  >
                    <View style={styles.transactionLeft}>
                      <View style={[styles.transactionIcon, { backgroundColor: colors.border }]} />
                      <View style={styles.transactionInfo}>
                        <View style={styles.skeletonLineWide} />
                        <View style={styles.skeletonLineNarrow} />
                      </View>
                    </View>
                    <View style={styles.skeletonAmount} />
                  </Animated.View>
                ))
              : null}

            {transferRows.slice(0, 5).map((tx) => {
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
                        color: isPositive ? colors.accentTeal : tx.type === "sent" || tx.type === "withdrawn" || tx.type === "contribution" || tx.type === "remittance" ? colors.errorText : colors.primaryNavy,
                      },
                    ]}
                  >
                    {isPositive ? "+" : ""}
                    {formatCurrency(tx.amount, tx.currency)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {transferRows.length === 0 && !transfersLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>{t("wallet.empty_transactions")}</Text>
              </View>
            )}
          </View>

          {/* Withdraw to bank — user-facing entry for the withdrawal
              flow. Stripe/Connect terminology is deliberately hidden;
              the underlying provider is chosen server-side later. */}
          <TouchableOpacity
            style={styles.payoutHistoryRow}
            onPress={() => navigation.navigate("WithdrawToBank")}
            accessibilityRole="button"
            accessibilityLabel={t("withdraw.title")}
          >
            <View style={styles.payoutHistoryIcon}>
              <Ionicons name="arrow-up-circle-outline" size={20} color="#059669" />
            </View>
            <Text style={styles.payoutHistoryText}>{t("withdraw.title")}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Payout history row — entry into the dedicated
              PayoutHistoryScreen (Bucket B of receive-payout review). */}
          <TouchableOpacity
            style={styles.payoutHistoryRow}
            onPress={() => navigation.navigate("PayoutHistory")}
            accessibilityRole="button"
            accessibilityLabel={t("payout_history.entry")}
          >
            <View style={styles.payoutHistoryIcon}>
              <Ionicons name="cash-outline" size={20} color="#059669" />
            </View>
            <Text style={styles.payoutHistoryText}>
              {t("payout_history.entry")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
          </View>
        }
      />

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={colors.cardBg} />
        <Text style={styles.floatingHelpText}>{t("common.help")}</Text>
      </TouchableOpacity>

      {/* P1.6 Balance breakdown sheet — same components as Home's
          total-net tile (Wallet + Goals + Circle Net). */}
      <Modal
        visible={breakdownVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBreakdownVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setBreakdownVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("wallet.breakdown_title")}</Text>
              <TouchableOpacity onPress={() => setBreakdownVisible(false)}>
                <Ionicons name="close" size={24} color={colors.primaryNavy} />
              </TouchableOpacity>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{t("wallet.breakdown_wallet")}</Text>
              <Text style={styles.breakdownValue}>
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{t("wallet.breakdown_goals")}</Text>
              <Text style={styles.breakdownValue}>
                {goalsTotal === null
                  ? "…"
                  : `$${goalsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{t("wallet.breakdown_circle_net")}</Text>
              <Text
                style={[
                  styles.breakdownValue,
                  circleNetTotal < 0 ? { color: colors.errorText } : null,
                ]}
              >
                {circleNetTotal < 0 ? "−" : ""}$
                {Math.abs(circleNetTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
              <Text style={styles.breakdownTotalLabel}>{t("wallet.breakdown_total")}</Text>
              <Text style={styles.breakdownTotalValue}>
                ${breakdownTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* P1.5 First-visit coach mark — three steps over the balance
          card, actions row, and recent activity. Gated by AsyncStorage
          so it shows only once per device. */}
      {coachVisible ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={dismissCoach}
        >
          <Pressable style={styles.coachBackdrop} onPress={dismissCoach}>
            <Pressable style={styles.coachSheet} onPress={() => {}}>
              <View style={styles.coachHandle} />
              <View style={styles.coachDots}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.coachDot,
                      i === coachStep ? styles.coachDotActive : null,
                      i < coachStep ? styles.coachDotDone : null,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.coachEmoji}>
                {["💰", "⚡", "📋"][coachStep]}
              </Text>
              <Text style={styles.coachTitle}>
                {t(`wallet.coach.step${coachStep + 1}_title`)}
              </Text>
              <Text style={styles.coachBody}>
                {t(`wallet.coach.step${coachStep + 1}_body`)}
              </Text>
              <View style={styles.coachActions}>
                <TouchableOpacity style={styles.coachSkipBtn} onPress={dismissCoach}>
                  <Text style={styles.coachSkipText}>{t("wallet.coach.skip")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.coachNextBtn} onPress={handleCoachNext}>
                  <Text style={styles.coachNextText}>
                    {coachStep >= 2 ? t("wallet.coach.finish") : t("wallet.coach.next")}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Add Currency Modal */}
      <Modal
        visible={showAddCurrencyModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("wallet.modal_add_currency_title")}</Text>
              <TouchableOpacity onPress={() => setShowAddCurrencyModal(false)}>
                <Ionicons name="close" size={24} color={colors.primaryNavy} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {t("wallet.modal_add_currency_subtitle")}
            </Text>

            <CurrencySelector
              selectedCurrency={selectedNewCurrency}
              onSelect={setSelectedNewCurrency}
              label={t("wallet.modal_currency_label")}
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleAddCurrency}
            >
              <Text style={styles.modalButtonText}>
                {t("wallet.modal_add_wallet", { currency: selectedNewCurrency })}
              </Text>
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
    backgroundColor: colors.screenBg,
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
    color: colors.cardBg,
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
    color: colors.cardBg,
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
    backgroundColor: colors.accentTeal,
    borderRadius: 12,
  },
  actionButtonText: {
    color: colors.cardBg,
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
    color: colors.cardBg,
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
    color: colors.primaryNavy,
  },
  ratesTimestamp: {
    fontSize: 11,
    color: colors.textSecondary,
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
    backgroundColor: colors.accentTeal,
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accentTeal,
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
    backgroundColor: colors.accentTeal,
    borderWidth: 1.5,
    borderColor: colors.primaryNavy,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    color: colors.accentTeal,
    fontSize: 14,
    fontWeight: "600",
  },
  manageText: {
    color: colors.accentTeal,
    fontSize: 14,
    fontWeight: "600",
  },
  currencyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  flagText: {
    fontSize: 22,
  },
  currencyCode: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primaryNavy,
    marginBottom: 2,
  },
  currencyName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  currencyRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currencyBalance: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primaryNavy,
    textAlign: "right",
    marginBottom: 2,
  },
  currencyUsdValue: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  payoutCoachTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 12,
  },
  payoutCoachTipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.successLabel,
  },
  payoutHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutHistoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  payoutHistoryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptyButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.accentTeal,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.cardBg,
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
    color: colors.primaryNavy,
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  alertCurrent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1565C0",
  },
  transactionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.primaryNavy,
    marginBottom: 2,
  },
  transactionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
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
    backgroundColor: colors.cardBg,
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
    color: colors.primaryNavy,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: colors.accentTeal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.cardBg,
  },
  floatingHelp: {
    position: "absolute",
    bottom: 90,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentTeal,
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
    color: colors.cardBg,
  },
  payoutBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accentTeal,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  payoutBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  payoutBannerText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.cardBg,
  },
  pmCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pmCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pmIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  pmLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.primaryNavy,
  },
  pmDefaultBadge: {
    backgroundColor: "rgba(0,198,174,0.15)",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pmDefaultText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accentTeal,
  },
  pmEmptyState: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pmEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 12,
  },
  pmAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accentTeal,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  pmAddButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.cardBg,
  },

  // ── P2 empty-wallet banner ──────────────────────────────────────
  emptyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  emptyBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBannerTextWrap: { flex: 1 },
  emptyBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginBottom: 2,
  },
  emptyBannerBody: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyBannerCta: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.accentTeal,
  },
  emptyBannerCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.cardBg,
  },

  // ── P1 additions ────────────────────────────────────────────────
  fxHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fxRefreshChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fxRefreshChipActive: {
    backgroundColor: "rgba(0,198,174,0.10)",
    borderColor: "rgba(0,198,174,0.40)",
  },
  fxRefreshChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accentTeal,
    letterSpacing: 0.5,
  },
  fxSubHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fxSubLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  skeletonLineWide: {
    height: 12,
    width: "60%",
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonLineNarrow: {
    height: 10,
    width: "40%",
    backgroundColor: colors.border,
    borderRadius: 4,
  },
  skeletonAmount: {
    height: 14,
    width: 60,
    backgroundColor: colors.border,
    borderRadius: 4,
  },

  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.accentTeal,
  },

  coachBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  coachSheet: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  coachHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 18,
  },
  coachDots: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
    marginBottom: 20,
  },
  coachDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  coachDotActive: { backgroundColor: colors.primaryNavy, width: 24 },
  coachDotDone: { backgroundColor: colors.accentTeal },
  coachEmoji: { fontSize: 48, alignSelf: "center", marginBottom: 12 },
  coachTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primaryNavy,
    textAlign: "center",
    marginBottom: 8,
  },
  coachBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  coachActions: { flexDirection: "row", gap: 12 },
  coachSkipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  coachSkipText: { fontSize: 14, color: colors.textSecondary, fontWeight: "700" },
  coachNextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
  },
  coachNextText: { fontSize: 14, color: colors.cardBg, fontWeight: "800" },
});
