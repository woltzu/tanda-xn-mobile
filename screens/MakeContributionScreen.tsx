// ═══════════════════════════════════════════════════════════════════════════
// MakeContributionScreen — member-facing contribution UI.
//
// Stage 2 note on Stripe Connect: this screen is invisible to the
// payment processor in the user-visible sense. Stripe Connect onboarding
// is an ORGANIZER concern — when a circle creator goes through the
// StripeConnectScreen flow to enable payouts. Members contributing into
// a circle never sign up for Stripe; they pay via wallet or via a saved
// payment method (PaymentSheet handles card / ACH on the platform's
// own Stripe account, NOT via the organizer's connected account on the
// contribution path — only the payout side transfers to the connected
// account).
//
// Trust signal: we deliberately keep "Powered by Stripe" copy on the
// TRIP buyer flow (different screen) because diaspora users benefit
// from seeing a known processor name. On the circle path, we don't
// mention Stripe at all — the wallet / "saved card" abstraction is
// enough.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
// Bucket D — legacy useXnScore.processContribution removed. The real
// backend now credits the score from a Postgres trigger on the
// contributions table (migration 020 → tr_contribution_activity →
// update_financial_activity → apply_xnscore_adjustment). The two
// processContribution() calls below are gone; the score lands
// server-side once the contribution row exists.
import { useWallet } from "../context/WalletContext";
import { usePayment } from "../context/PaymentContext";
import { invalidateCircleDetailCache } from "../hooks/useCircleDetail";
import { useEventTracker } from "../hooks/useEventTracker";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";
import { CurrencySelector, QuickCurrencyPicker } from "../components/CurrencySelector";
import { ExchangeRateDisplay, FXRiskWarning } from "../components/ExchangeRateDisplay";
import TestModeBadge from "../components/TestModeBadge";

type MakeContributionNavigationProp = StackNavigationProp<RootStackParamList>;
type MakeContributionRouteProp = RouteProp<RootStackParamList, "MakeContribution">;

type PaymentMethod = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  available: boolean;
};

const WALLET_METHOD: PaymentMethod = {
  id: "wallet",
  name: "TandaXn Wallet",
  icon: "wallet",
  description: "Pay from your wallet balance",
  available: true,
};

const getStripeMethodIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "card": return "card";
    case "us_bank_account": return "business";
    case "link": return "link";
    case "cashapp": return "cash";
    case "apple_pay": return "logo-apple";
    case "google_pay": return "logo-google";
    default: return "card";
  }
};

const formatStripeMethodName = (pm: any): string => {
  // SavedPaymentMethod uses card* / bank* prefixes; the pre-fix
  // shape (flat brand / last4) is dead — mapToSavedMethod hasn't
  // returned those fields in months.
  const last4 = pm.cardLast4 ?? pm.bankLast4;
  if (pm.cardBrand && last4) {
    const brand = pm.cardBrand.charAt(0).toUpperCase() + pm.cardBrand.slice(1);
    return `${brand} •••• ${last4}`;
  }
  if (pm.bankName && last4) {
    return `${pm.bankName} •••• ${last4}`;
  }
  if (last4) return `•••• ${last4}`;
  return pm.type === "us_bank_account" ? "Bank Account" : "Card";
};

const formatStripeMethodDescription = (pm: any): string => {
  if (pm.cardExpMonth && pm.cardExpYear) {
    return `Expires ${String(pm.cardExpMonth).padStart(2, "0")}/${pm.cardExpYear}`;
  }
  if (pm.bankName) return pm.bankName;
  return pm.type === "us_bank_account" ? "Bank account" : "Saved payment method";
};

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
  const { t } = useTranslation();
  const { circleId } = route.params;
  const { circles, browseCircles, myCircles } = useCircles();
  const { user } = useAuth();
  // Bucket D — score side-effect handled by server trigger; no client hook.
  const { currencies, getCurrencyBalance, makeContribution } = useWallet();
  const {
    paymentMethods: stripePaymentMethods,
    createContribution,
    presentPaymentSheet,
    handleNextActionForIntent,
    isStripeReady,
    refreshPaymentMethods,
  } = usePayment();
  const { primaryCurrency, convert, getExchangeRate, formatCurrency } = useCurrency();

  const [selectedMethod, setSelectedMethod] = useState<string>("wallet");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState<string>(primaryCurrency);
  const [showCurrencyOptions, setShowCurrencyOptions] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // Stage 2 Bucket C — circle fee config loaded from the DB once on
  // mount. Ordinary circles default to is_premium=false / fee=0 so the
  // initial render of premium-only UI is empty until the row arrives.
  const [circleFee, setCircleFee] = useState<{
    isPremium: boolean;
    platformFeeBps: number;
  }>({ isPremium: false, platformFeeBps: 0 });

  // Has the user manually changed the payment method this session?
  // If so, the auto-selector below stops overriding their choice when
  // the amount changes (e.g. tapping a partial chip).
  const userPickedMethodRef = useRef(false);
  // AsyncStorage keys — kept at module-scope-ish for the cache busts.
  const LAST_METHOD_KEY = "@tandaxn_last_used_payment_method";
  const lastPartialKey = `@tandaxn_last_contribution_amount_${circleId}`;
  const COACH_KEY = "@tandaxn_make_contribution_coach_seen_v1";

  // Telemetry tracker. opened event is ref-guarded so StrictMode double-
  // mount doesn't double-emit; the other events fire on their natural
  // interaction triggers.
  //
  // Partial Contribution Bucket C — TODO: when a contribution succeeds
  // and the underlying cycle_contributions row has contribution_type =
  // 'catch_up' (set by the activate_partial_contribution RPC at plan
  // creation time), fire:
  //   track({
  //     eventType: "partial_pool.catch_up_paid",
  //     eventCategory: "circle",
  //     eventAction: "click",
  //     eventLabel: circleId,
  //     eventValue: { circle_id, plan_id, contribution_id, amount_cents },
  //   });
  // Wiring it cleanly needs a SELECT on cycle_contributions to discover
  // the type + partial_plan_id around the success handler — left as a
  // follow-up so we don't risk a half-wired telemetry path now.
  const { track } = useEventTracker();
  const openedTrackedRef = useRef(false);

  // Re-sync the payment-methods list whenever this screen comes back
  // into focus — covers the case where the user tapped "Add a card",
  // went to LinkedAccounts, added one, and returned. syncRemote stays
  // false to avoid spamming Stripe; the local realtime channel in
  // PaymentContext + the cached list handle freshness.
  // B.5 note: the View-Circle-Details `useCircleDetail` hook caches
  // *members + activities*, not circle metadata. Circle data lives in
  // CirclesContext, which is already shared across the app and busted
  // post-success via invalidateCircleDetailCache (Bucket A). So the
  // "30 s cache for contribution data" item is N/A here.
  useFocusEffect(
    useCallback(() => {
      // syncRemote so the DB is guaranteed populated before the local
      // read — otherwise a card just saved from another screen may
      // not appear in the list yet and the contribution flow only
      // offers "Add a card" even though methods exist. Cheap: one EF
      // call per focus, versus the confusion of an empty list.
      refreshPaymentMethods({ syncRemote: true }).catch(() => undefined);
    }, [refreshPaymentMethods])
  );

  // Pick up the id passed back by LinkedAccountsScreen's select flow.
  // useFocusEffect is safer than a plain useEffect here because a
  // navigation.navigate onto an already-mounted MakeContribution
  // re-focuses without re-running mount effects — the focus callback
  // does fire, and route.params is fresh at that point. Consuming
  // the param clears it so a subsequent re-focus doesn't clobber a
  // manual selection.
  useFocusEffect(
    useCallback(() => {
      const picked = route.params?.selectedPaymentMethodId;
      if (!picked) return;
      setSelectedMethod(picked);
      navigation.setParams({ selectedPaymentMethodId: undefined } as any);
    }, [route.params?.selectedPaymentMethodId, navigation])
  );

  // First-visit coach mark. AsyncStorage-gated per user. Auto-dismiss
  // after 4 s. The interaction with the Confirm button (handleConfirm
  // Payment) also clears the tip — see the wrapped onPress below.
  const [showCoach, setShowCoach] = useState(false);
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    let cancelled = false;
    AsyncStorage.getItem(COACH_KEY)
      .then((v) => {
        if (!cancelled && !v) setShowCoach(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!showCoach) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
    // dismissCoach is stable in practice; omit from deps to avoid restarting the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoach]);
  const dismissCoach = () => {
    setShowCoach(false);
    AsyncStorage.setItem(COACH_KEY, "1").catch(() => undefined);
  };

  // C.2 — Hydrate the partial amount from the user's last contribution
  // to this circle, when partial contributions are allowed. Skipped
  // silently if the flag is off, the circle isn't found, or no prior
  // value was saved.
  const partialHydratedRef = useRef(false);
  useEffect(() => {
    if (partialHydratedRef.current) return;
    if (!circle) return;
    const allows =
      !!(circle as any)?.allowPartialContributions && !circle.beneficiaryName;
    if (!allows) {
      partialHydratedRef.current = true;
      return;
    }
    partialHydratedRef.current = true;
    let cancelled = false;
    AsyncStorage.getItem(lastPartialKey)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = Number(raw);
        const full = circle.amount || 0;
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= full) {
          // 100 % stays as null (the "no override" state) so the chip
          // for 100 % stays the visible active default.
          setCustomAmount(parsed === full ? null : parsed);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // We only hydrate once per mount; circle.id is stable for the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle?.id]);

  // Merge wallet option with saved Stripe payment methods.
  // SavedPaymentMethod has no `status` field — mapToSavedMethod
  // already dropped it because refreshPaymentMethods pre-filters by
  // status='active' at the engine layer. Filtering here on pm.status
  // therefore matched nothing and the map returned only the wallet
  // row. Drop the filter. Use pm.id (DB uuid) as the local id so it
  // lines up with what LinkedAccountsScreen sends back in the
  // select-flow (route.params.selectedPaymentMethodId).
  const paymentMethods: PaymentMethod[] = useMemo(() => {
    const stripeMapped: PaymentMethod[] = (stripePaymentMethods || []).map(
      (pm: any) => ({
        id: pm.id,
        name: formatStripeMethodName(pm),
        icon: getStripeMethodIcon(pm.type),
        description: formatStripeMethodDescription(pm),
        available: true,
      }),
    );
    return [WALLET_METHOD, ...stripeMapped];
  }, [stripePaymentMethods]);

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

  // Stage 2 Bucket C — fetch the circle's fee config so the summary
  // card can show the platform-fee line BEFORE the user taps Confirm.
  // Server-side recomputes from the same circles columns on PI create,
  // so this client read is purely cosmetic. Fire-and-forget; silent
  // fallback to "no premium fee" if the row can't be read.
  useEffect(() => {
    if (!circleId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("circles")
        .select("is_premium, platform_fee_bps")
        .eq("id", circleId)
        .maybeSingle();
      if (cancelled || !data) return;
      setCircleFee({
        isPremium: !!data.is_premium,
        platformFeeBps: Number(data.platform_fee_bps) || 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId]);

  // C.1 — Auto-select the best payment method on mount and whenever
  // the wallet's covered-status changes (e.g. user picked a smaller
  // partial chip). Manual user picks win — `userPickedMethodRef`
  // freezes the auto-selector after the first user-driven setSelectedMethod.
  // Wallet > last-used card > wallet fallback. The wallet fallback
  // path intentionally re-selects wallet even when it's short — the
  // insufficient-funds warning chip surfaces the issue.
  useEffect(() => {
    if (userPickedMethodRef.current) return;
    // `hasEnoughBalance` and `stripePaymentMethods` referenced here are
    // closed over the most recent render — the dep array re-runs the
    // effect when either changes.
    let cancelled = false;
    (async () => {
      if (hasEnoughBalance) {
        if (!cancelled) setSelectedMethod("wallet");
        return;
      }
      // SavedPaymentMethod has no status field; the context state
      // is already scoped to active by refreshPaymentMethods, so any
      // row in stripePaymentMethods is fair game.
      const activeCards = stripePaymentMethods || [];
      if (activeCards.length === 0) {
        if (!cancelled) setSelectedMethod("wallet");
        return;
      }
      try {
        const lastId = await AsyncStorage.getItem(LAST_METHOD_KEY);
        if (cancelled) return;
        // Match against pm.id (DB uuid) — that's what LinkedAccounts's
        // select flow and the local paymentMethods array both use.
        const lastStillActive = lastId
          ? activeCards.find((pm: any) => pm.id === lastId)
          : null;
        const pick = lastStillActive ?? activeCards[0];
        setSelectedMethod(pick.id);
      } catch {
        if (!cancelled) {
          setSelectedMethod(activeCards[0].id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasEnoughBalance, stripePaymentMethods]);

  // Partial-contribution support. Gated on a per-circle flag; the
  // backend hasn't shipped this column yet, so the gate is currently
  // always false in prod and the UI is inert. When the column lands as
  // `allowPartialContributions` (or similar) on the Circle type, the
  // chip row renders above the amount card and `customAmount` becomes
  // the source of truth for what the user pays. The existing
  // PartialContribution route (50/25/25 schedule) is a separate flow
  // and unaffected by this.
  const allowsPartial =
    !!(circle as any)?.allowPartialContributions && !!circle && !circle.beneficiaryName;
  const fullCircleAmount = circle?.amount || 0;
  const [customAmount, setCustomAmount] = useState<number | null>(null);
  const partialChips = [0.25, 0.5, 0.75, 1.0];

  // Calculate amount in payment currency. `effectiveCircleAmount` is
  // either the full amount or the partial slice the user picked.
  const effectiveCircleAmount = customAmount ?? fullCircleAmount;

  // `opened` telemetry — ref-guarded against StrictMode double-mount.
  // Fires once per real screen open; circle metadata may be present
  // immediately (cached) or arrive on a later render.
  useEffect(() => {
    if (openedTrackedRef.current) return;
    if (!circle) return;
    openedTrackedRef.current = true;
    track({
      eventType: "contribution_opened",
      eventCategory: "savings",
      eventAction: "opened",
      eventLabel: circleId,
      eventValue: {
        circleId,
        amount: fullCircleAmount,
        hasPartial: allowsPartial,
      },
    });
  }, [track, circle, circleId, fullCircleAmount, allowsPartial]);

  // Wrapper around setSelectedMethod that flags user-driven selection
  // (suppresses the auto-selector on subsequent amount changes) and
  // emits the `payment_method_selected` event.
  const onUserPickMethod = (methodId: string) => {
    userPickedMethodRef.current = true;
    const isWallet = methodId === "wallet";
    track({
      eventType: "contribution_payment_method_selected",
      eventCategory: "savings",
      eventAction: "payment_method_selected",
      eventLabel: isWallet ? "wallet" : "card",
      eventValue: {
        circleId,
        methodId,
        type: isWallet ? "wallet" : "card",
      },
    });
    setSelectedMethod(methodId);
  };

  // `partial_used` telemetry — fires on each chip tap that selects a
  // non-100 % slice.
  const onPickPartialChip = (pct: number) => {
    const sliceAmount =
      pct === 1 ? null : Math.round(fullCircleAmount * pct * 100) / 100;
    setCustomAmount(sliceAmount);
    if (pct !== 1) {
      track({
        eventType: "contribution_partial_used",
        eventCategory: "savings",
        eventAction: "partial_used",
        eventLabel: `${Math.round(pct * 100)}%`,
        eventValue: {
          circleId,
          percentage: Math.round(pct * 100),
          amount: sliceAmount,
        },
      });
    }
  };
  const paymentAmount = useMemo(() => {
    if (!isCrossBorder) return effectiveCircleAmount;
    return convert(effectiveCircleAmount, circleCurrency, paymentCurrency);
  }, [effectiveCircleAmount, circleCurrency, paymentCurrency, isCrossBorder]);

  // Stage 2 Bucket C — platform fee (on top of paymentAmount when the
  // circle is premium). Computed client-side from circleFee state so the
  // summary card can show the breakdown before the user confirms.
  // Server recomputes from circles row on PI creation — this is purely
  // for display.
  const platformFeeAmount = useMemo(() => {
    if (!circleFee.isPremium || circleFee.platformFeeBps <= 0) return 0;
    return Math.round((paymentAmount * circleFee.platformFeeBps) / 100) / 100;
  }, [paymentAmount, circleFee.isPremium, circleFee.platformFeeBps]);

  // Stage 2 Bucket C — Stripe processing-fee ESTIMATE (2.9% + $0.30 of
  // the total charge). Shown on the summary as "covered by TandaXn"
  // because the platform absorbs until $200K GTV (doc 35). Real fee
  // comes from balance_transaction on the webhook; this is just the
  // pre-charge display so users see what TandaXn covers on their
  // behalf. The "+ 0.30" applies once per charge regardless of
  // payment currency — we treat it as a flat 0.30 of the payment
  // currency for display simplicity.
  const totalChargeAmount = paymentAmount + platformFeeAmount;
  const estimatedStripeFee = useMemo(() => {
    if (totalChargeAmount <= 0) return 0;
    return Math.round((totalChargeAmount * 0.029 + 0.30) * 100) / 100;
  }, [totalChargeAmount]);

  // Get wallet balance for selected currency
  const walletBalance = getCurrencyBalance(paymentCurrency);
  const hasEnoughBalance = walletBalance >= paymentAmount;
  // At least one non-wallet (Stripe) method active? Drives the amber-vs-
  // red insufficient-balance warning and prevents disabling Contribute
  // when a card could still cover the payment.
  const hasCardAlternative = useMemo(
    // No .status field on SavedPaymentMethod — the context state is
    // already active-only, so any entry counts as an alternative.
    () => (stripePaymentMethods || []).length > 0,
    [stripePaymentMethods],
  );
  // Contribute disables only when the wallet is selected AND short. If
  // the user has a card and picks it, the button re-enables; the warning
  // becomes amber rather than red.
  const isWalletBlocked = selectedMethod === "wallet" && !hasEnoughBalance;

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
          <Text style={styles.headerTitle}>{t("make_contribution.not_found_header")}</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.errorText}>{t("make_contribution.not_found_body")}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>{t("make_contribution.btn_go_back")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // For non-cross-border flows, `amount` is what we hand the success
  // screen. Use the partial slice when the user chose one, so the
  // success screen reflects the actual paid amount instead of the
  // full cycle amount.
  const amount = effectiveCircleAmount;
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
    setPaymentError(null);

    if (selectedMethod === "wallet") {
      // Wallet payment path
      if (!hasEnoughBalance) {
        Alert.alert(
          "Insufficient Balance",
          `Your ${paymentCurrency} wallet balance is not enough for this contribution. Add funds, pick a different payment method, or use Flexible Payment to pay 50% now and split the rest over the next two cycles.`,
          [
            { text: "OK", style: "cancel" },
            {
              // Phase D2 of feat(partial). The Partial route's cycleId is
              // optional — the screen resolves the active cycle from
              // circle_cycles on mount, so we only need to pass circleId.
              text: "Use Flexible Payment",
              onPress: () =>
                navigation.navigate("PartialContribution", { circleId }),
            },
          ],
        );
        return;
      }

      setIsProcessing(true);
      try {
        const transactionId = await makeContribution(
          paymentAmount,
          paymentCurrency,
          circleId,
          circle.name,
          isCrossBorder ? circleCurrency : undefined,
          isCrossBorder ? exchangeInfo?.rate : undefined
        );

        // Bucket D — score adjustment happens server-side via the
        // tr_contribution_activity trigger; we no longer fire a client
        // processContribution() call.

        // Bust the View-Circle-Details 30 s cache so when the user
        // returns from the success screen the balance, contribution
        // count, and activity feed are immediately fresh — the realtime
        // INSERT will overlap, but the cache invalidation is the cheap
        // belt-and-suspenders guarantee.
        invalidateCircleDetailCache(circleId);

        // Persist last-used method + last partial amount so the next
        // visit can pre-select them. Fire-and-forget — never blocks the
        // navigation the user just earned.
        AsyncStorage.setItem(LAST_METHOD_KEY, "wallet").catch(() => undefined);
        if (allowsPartial) {
          AsyncStorage.setItem(
            lastPartialKey,
            String(effectiveCircleAmount),
          ).catch(() => undefined);
        }
        track({
          eventType: "contribution_completed",
          eventCategory: "savings",
          eventAction: "completed",
          eventLabel: "wallet",
          eventValue: {
            circleId,
            amount: effectiveCircleAmount,
            paymentMethodType: "wallet",
            wasPartial: customAmount !== null,
          },
        });

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
    } else {
      // Stripe payment method path
      setIsProcessing(true);
      try {
        const amountCents = Math.round(paymentAmount * 100);
        const currency = paymentCurrency.toLowerCase();
        const cycleId = `cycle-${cycleInfo.cycleNumber}`;

        // selectedMethod is the local id used by the UI: "wallet" or
        // a DB uuid. The Stripe intent EF expects the Stripe pm id
        // (pm_...) — look it up from the context list. If the selected
        // row disappears mid-flow (rare, remote sync ran), fall
        // through with undefined so the EF picks the customer's
        // default rather than a stale mismatch.
        const stripePmId =
          selectedMethod === "wallet"
            ? undefined
            : (stripePaymentMethods || []).find(
                (pm: any) => pm.id === selectedMethod,
              )?.stripePaymentMethodId;

        const { clientSecret, status } = await createContribution(
          amountCents,
          currency,
          circleId,
          cycleId,
          stripePmId,
        );

        // Server-confirmed with the saved card path:
        //   status='succeeded'          → done, no client Stripe call
        //   status='requires_action'    → run handleNextAction (3DS)
        //   status='requires_capture'   → done (manual-capture flows)
        // Fall through to PaymentSheet only when the EF returned an
        // unconfirmed intent (e.g. no paymentMethodId was passed).
        if (status === "succeeded" || status === "requires_capture") {
          // Payment already went through on the server. Nothing to do.
        } else if (status === "requires_action" && clientSecret) {
          const { success, error } = await handleNextActionForIntent(clientSecret);
          if (!success) {
            setPaymentError(error || "Your payment could not be processed.");
            return;
          }
        } else if (clientSecret) {
          const { error } = await presentPaymentSheet(clientSecret);
          if (error) {
            setPaymentError(error.message || "Your payment could not be processed.");
            return;
          }
        }

        // Bucket D — score adjustment handled server-side; no client call.

        invalidateCircleDetailCache(circleId);

        // Persist last-used method (the actual Stripe id) + last
        // partial amount for the auto-selector / pre-fill on next visit.
        AsyncStorage.setItem(LAST_METHOD_KEY, selectedMethod).catch(
          () => undefined,
        );
        if (allowsPartial) {
          AsyncStorage.setItem(
            lastPartialKey,
            String(effectiveCircleAmount),
          ).catch(() => undefined);
        }
        track({
          eventType: "contribution_completed",
          eventCategory: "savings",
          eventAction: "completed",
          eventLabel: "card",
          eventValue: {
            circleId,
            amount: effectiveCircleAmount,
            paymentMethodType: "card",
            wasPartial: customAmount !== null,
          },
        });

        navigation.navigate("ContributionSuccess", {
          circleId,
          amount: isCrossBorder ? paymentAmount : amount,
          transactionId: clientSecret || "stripe-pending",
        });
      } catch (error: any) {
        const message = error?.message || "There was an error processing your payment. Please try again.";
        setPaymentError(message);
      } finally {
        setIsProcessing(false);
      }
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
            <Text style={styles.headerTitle}>{t("make_contribution.header_title")}</Text>
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
          {/* TEST MODE badge — renders null in real prod builds with
              prod Stripe keys. Sits at the top of content so any tester
              sees it before they tap "Pay". */}
          <TestModeBadge />

          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>{t("make_contribution.amount_label")}</Text>
            <Text style={styles.amountValue}>
              {circleCurrencyInfo?.symbol}{formatCurrency(effectiveCircleAmount, circleCurrency)}
            </Text>
            <Text style={styles.amountSubtext}>
              {isOneTime ? "One-time contribution" : `${getFrequencyLabel(circle.frequency)} contribution`}
            </Text>

            {/* Partial-amount quick chips — only rendered when the
                circle's `allowPartialContributions` flag is set. Tapping
                a chip seeds customAmount which drives every downstream
                derived value (paymentAmount, wallet check, FX). 100 % is
                the default reset path. */}
            {allowsPartial ? (
              <View style={styles.partialChipsRow}>
                {partialChips.map((pct) => {
                  const sliceAmount = Math.round(fullCircleAmount * pct * 100) / 100;
                  const isActive =
                    (customAmount ?? fullCircleAmount) === sliceAmount;
                  return (
                    <TouchableOpacity
                      key={pct}
                      style={[
                        styles.partialChip,
                        isActive && styles.partialChipActive,
                      ]}
                      onPress={() => onPickPartialChip(pct)}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.partialChipText,
                          isActive && styles.partialChipTextActive,
                        ]}
                      >
                        {Math.round(pct * 100)}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.fixedAmountHint}>
                {t("make_contribution.fixed_amount_hint", {
                  amount: formatCurrency(fullCircleAmount, circleCurrency),
                })}
              </Text>
            )}
          </View>

          {/* Currency Selection for Cross-Border */}
          <View style={styles.currencySection}>
            <View style={styles.currencySectionHeader}>
              <Text style={styles.sectionTitle}>{t("make_contribution.section_pay_with")}</Text>
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

          {/* Cycle Info — answers "where am I in the schedule?" and
              "when is this due?" in one card. Uses the circle's
              memberCount as the total-cycles denominator (rotating
              circles) and falls back to the existing computed cycle
              number when circle.currentCycle isn't populated. */}
          {!isOneTime && (
            <View style={styles.cycleCard}>
              <View style={styles.cycleHeader}>
                <Text style={styles.cycleTitle}>
                  {t("make_contribution.cycle_info", {
                    cycle: circle.currentCycle ?? cycleInfo.cycleNumber,
                    total: circle.memberCount,
                    dueDate: formatDate(cycleInfo.dueDate),
                  })}
                </Text>
                <View style={[
                  styles.dueBadge,
                  daysUntilDue <= 2 ? styles.dueBadgeUrgent : null,
                ]}>
                  <Text style={[
                    styles.dueBadgeText,
                    daysUntilDue <= 2 ? styles.dueBadgeTextUrgent : null,
                  ]}>
                    {daysUntilDue <= 0
                      ? t("make_contribution.cycle_due_today")
                      : t("make_contribution.cycle_days_left", { count: daysUntilDue })}
                  </Text>
                </View>
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
                <Text style={styles.beneficiaryLabel}>{t("make_contribution.beneficiary_supporting")}</Text>
                <Text style={styles.beneficiaryName}>{circle.beneficiaryName}</Text>
              </View>
            </View>
          )}

          {/* Payment Error Banner */}
          {paymentError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorBannerText}>{paymentError}</Text>
              <TouchableOpacity onPress={() => setPaymentError(null)}>
                <Ionicons name="close-circle" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}

          {/* Payment Methods */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>{t("make_contribution.section_payment_method")}</Text>

            {/* "Add a card" is rendered AFTER the map so it always sits
                below whatever cards the user already has. Drops the user
                onto LinkedAccounts; useFocusEffect below picks up the new
                card on return. */}
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
                  onPress={() => onUserPickMethod(method.id)}
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
                            <Text style={styles.insufficientText}>{t("make_contribution.tag_insufficient")}</Text>
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

            <TouchableOpacity
              style={styles.addCardLink}
              onPress={() =>
                navigation.navigate("LinkedAccounts", {
                  // Ask LinkedAccounts to show Select pills on the
                  // existing rows and return the chosen card back to
                  // this screen. If the user adds a new card instead
                  // they can then tap Select on the new row.
                  selectMode: true,
                  returnScreen: "MakeContribution",
                  returnParams: { circleId },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("make_contribution.add_card")}
            >
              <Ionicons name="add-circle-outline" size={18} color="#00C6AE" />
              <Text style={styles.addCardLinkText}>
                {t("make_contribution.add_card")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>{t("make_contribution.section_payment_summary")}</Text>

            {isCrossBorder && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t("make_contribution.summary_circle_contribution")}</Text>
                  <Text style={styles.summaryValue}>
                    {circleCurrencyInfo?.symbol}{formatCurrency(amount, circleCurrency)} {circleCurrency}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t("make_contribution.summary_exchange_rate")}</Text>
                  <Text style={styles.summaryValue}>
                    1 {paymentCurrency} = {exchangeInfo?.rate.toFixed(4)} {circleCurrency}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("make_contribution.summary_you_pay")}</Text>
              <Text style={styles.summaryValue}>
                {currencyInfo?.symbol}{formatCurrency(paymentAmount, paymentCurrency)} {paymentCurrency}
              </Text>
            </View>

            {/* Platform fee row (Stage 2 Bucket C) — only rendered when
                the circle is premium and a fee is set. Ordinary circles
                stay free (no row). Amount is computed client-side using
                the circle's platform_fee_bps so the user sees what
                they'll pay BEFORE confirming. Source-of-truth still
                lives server-side; the EF recomputes from the DB. */}
            {platformFeeAmount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {t("fee.platform_fee", {
                    amount: `${currencyInfo?.symbol}${formatCurrency(platformFeeAmount, paymentCurrency)}`,
                  })}
                </Text>
                <Text style={styles.summaryValue}>
                  {currencyInfo?.symbol}{formatCurrency(platformFeeAmount, paymentCurrency)}
                </Text>
              </View>
            ) : null}

            {/* Processing fee (Stripe) — estimated at 2.9% + $0.30 of the
                charge, shown ALWAYS even when absorbed by the platform.
                "Covered by TandaXn" copy stays through the $200K GTV cap
                per doc 35; the line item remains familiar when we later
                stop absorbing — no surprise new fee appears. */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {t("fee.processing_fee_covered", {
                  amount: `${currencyInfo?.symbol}${formatCurrency(estimatedStripeFee, paymentCurrency)}`,
                })}
              </Text>
              <Text style={[styles.summaryValue, { color: "#00C6AE" }]}>
                {currencyInfo?.symbol}{formatCurrency(estimatedStripeFee, paymentCurrency)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>{t("make_contribution.summary_total")}</Text>
              <Text style={styles.totalValue}>
                {currencyInfo?.symbol}{formatCurrency(totalChargeAmount, paymentCurrency)} {paymentCurrency}
              </Text>
            </View>
          </View>

          {/* Wallet-balance warning. Two flavors:
              - Red (insufficient_funds): user has wallet selected AND
                the balance is short. Disables the Confirm button.
              - Amber (wallet_low): user has wallet selected, balance is
                short, but at least one Stripe payment method is also
                available so the user can switch and still pay. */}
          {selectedMethod === "wallet" && !hasEnoughBalance ? (
            <View
              style={[
                styles.balanceWarning,
                hasCardAlternative
                  ? styles.balanceWarningAmber
                  : styles.balanceWarningRed,
              ]}
            >
              <Ionicons
                name={hasCardAlternative ? "alert-circle-outline" : "alert-circle"}
                size={18}
                color={hasCardAlternative ? "#92400E" : "#DC2626"}
              />
              <Text
                style={[
                  styles.balanceWarningText,
                  { color: hasCardAlternative ? "#92400E" : "#7F1D1D" },
                ]}
              >
                {hasCardAlternative
                  ? t("make_contribution.wallet_low")
                  : t("make_contribution.insufficient_funds", {
                      balance: formatCurrency(walletBalance, paymentCurrency),
                    })}
              </Text>
            </View>
          ) : null}

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
        {/* First-visit coach mark — points down at the Confirm button.
            AsyncStorage-gated so it only ever shows once per user.
            Tapping either the tip or the Confirm button dismisses it. */}
        {showCoach ? (
          <TouchableOpacity
            style={styles.coachTip}
            onPress={dismissCoach}
            accessibilityRole="button"
            accessibilityLabel={t("make_contribution.coach_tip")}
          >
            <Ionicons name="arrow-down" size={14} color="#0A2342" />
            <Text style={styles.coachTipText}>
              {t("make_contribution.coach_tip")}
            </Text>
            <Ionicons name="close" size={14} color="#6B7280" />
          </TouchableOpacity>
        ) : null}
        <View style={styles.bottomBarRow}>
          <View style={styles.bottomSummary}>
            <Text style={styles.bottomLabel}>{t("make_contribution.bottom_total_amount")}</Text>
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
              (isProcessing || isWalletBlocked) && styles.confirmButtonDisabled,
            ]}
            onPress={() => {
              if (showCoach) dismissCoach();
              handleConfirmPayment();
            }}
            disabled={isProcessing || isWalletBlocked}
          >
            {isProcessing ? (
              <Text style={styles.confirmButtonText}>{t("make_contribution.btn_processing")}</Text>
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>{t("make_contribution.btn_confirm_payment")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tertiary Flexible Payment entry. Phase D2 of feat(partial).
            Discreet link so members can opt for 50/25/25 proactively,
            not only when they hit the insufficient-balance wall. */}
        <TouchableOpacity
          style={styles.flexiblePaymentLink}
          onPress={() =>
            navigation.navigate("PartialContribution", { circleId })
          }
          disabled={isProcessing}
          accessibilityRole="button"
          accessibilityLabel="Use Flexible Payment instead"
        >
          <Text style={styles.flexiblePaymentLinkText}>
            Need more time? Use Flexible Payment →
          </Text>
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
  partialChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  partialChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  partialChipActive: {
    backgroundColor: "#0A2342",
    borderColor: "#0A2342",
  },
  partialChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
  },
  partialChipTextActive: {
    color: "#FFFFFF",
  },
  fixedAmountHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
  addCardLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  addCardLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00C6AE",
  },
  coachTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    alignSelf: "center",
    marginBottom: 8,
  },
  coachTipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
  },
  balanceWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  balanceWarningRed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  balanceWarningAmber: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  balanceWarningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
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
  },
  bottomBarRow: {
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
  flexiblePaymentLink: {
    width: "100%",
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: "center",
  },
  flexiblePaymentLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
    letterSpacing: 0.2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    lineHeight: 17,
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
