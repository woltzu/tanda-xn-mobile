// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalAddMoneyScreen.tsx — GOALS-007
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 158-GOALS-007-GoalAddMoney.jsx.
//
// Fund a goal from one of four sources: TandaXn Wallet, a linked bank
// account, a saved debit card (1.5% fee), or set up auto-deposit. Amount
// input with quick-select chips ($100/$250/$500/$1000) + "Fill to Target".
//
// NAVIGATION — onBack → goBack(). Source-aware submit:
//   wallet → useGoalActions.addMoney (atomic via transfer_to_goal RPC).
//   card   → create-payment-intent (goal_deposit, applyCardFee=true) +
//            Stripe PaymentSheet via PaymentContext. Goal balance is
//            credited asynchronously by the credit_goal_external RPC
//            (migration 074) when the payment_intent.succeeded webhook
//            arrives; GoalDetailV2's useFocusEffect refetches on return.
//   bank   → stripe-create-bank-session → collectFinancialConnectionsAccounts
//            (Stripe FC sheet) → stripe-attach-bank-payment-method →
//            create-payment-intent (goal_deposit, us_bank_account,
//            paymentMethodId). The backend creates the PaymentIntent with
//            confirm: true + mandate_data so ACH is initiated immediately;
//            the goal is credited 3-5 business days later when the
//            payment_intent.succeeded webhook fires.
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useFormDraft } from "../hooks/useFormDraft";
import { useGoalActions } from "../hooks/useGoalActions";
import { usePayment } from "../context/PaymentContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// ─── Stripe Financial Connections — lazy-require web-safe wrapper ────────────
// PaymentContext already does this dance for initPaymentSheet/presentPaymentSheet
// but does not expose collectFinancialConnectionsAccounts. Rather than touch
// PaymentContext (which carries an unrelated work-in-progress diff), mirror
// the same pattern locally for just the FC method we need.
//
// On native, we destructure useStripe from the real package and call
// collectFinancialConnectionsAccounts(clientSecret) — the SDK method that
// opens the FC sheet and returns the linked-accounts session.
//
// On web (and any environment where the package fails to load), we fall
// back to a mock that returns a friendly error so the bank flow surfaces
// "not available on web" instead of a crash.
type CollectFCAccounts = (
  clientSecret: string
) => Promise<{
  session?: { id: string };
  error?: { message?: string; code?: string };
}>;
let useStripeFC: () => { collectFinancialConnectionsAccounts: CollectFCAccounts } =
  () => ({
    collectFinancialConnectionsAccounts: async () => ({
      error: { message: "Bank linking is not available on this platform" },
    }),
  });
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const stripeMod = require("@stripe/stripe-react-native");
    if (stripeMod?.useStripe) {
      useStripeFC = stripeMod.useStripe;
    }
  } catch {
    // Module not available — keep the mock so the screen still loads.
  }
}

// UUID guard — sub-screens can be reached with mock defaults that use ids
// like "g1"; the hook will reject those with a 22P02 from Postgres.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type SourceKind = "wallet" | "bank" | "card";

type AddMoneyGoal = {
  id: string;
  name: string;
  emoji: string;
  balance: number;
  target: number;
};

type BankAccount = {
  id: string;
  name: string;
  last4: string;
  type: string;
};

// Row shape we read from stripe_bank_accounts. stripe_payment_method_id is
// the key we need to charge an ACH PI directly without re-running the FC
// sheet.
type SavedBank = {
  id: string;
  stripe_payment_method_id: string;
  bank_name: string | null;
  last4: string | null;
  account_holder_name: string | null;
};

type SavedCard = {
  id: string;
  name: string;
  last4: string;
  type: string;
};

type GoalAddMoneyParams = {
  // goalId is forwarded from GoalDetailV2 alongside goal. Prefer goalId when
  // present so a malformed goal object can't poison the FK.
  goalId?: string;
  goal?: AddMoneyGoal;
  walletBalance?: number;
  linkedBankAccounts?: BankAccount[];
  savedCards?: SavedCard[];
};
type GoalAddMoneyRouteProp = RouteProp<
  { GoalAddMoney: GoalAddMoneyParams },
  "GoalAddMoney"
>;

const DEFAULT_GOAL: AddMoneyGoal = {
  id: "g1",
  name: "First Home in Atlanta",
  emoji: "🏠",
  balance: 8500.0,
  target: 25000.0,
};

// DEFAULT_BANKS removed — bank list now comes from stripe_bank_accounts.
// The route.params.linkedBankAccounts override is still honored for
// preview / snapshot testing (see bankRowsForRender below).

const DEFAULT_CARDS: SavedCard[] = [
  { id: "c1", name: "Visa", last4: "1234", type: "debit" },
];

const SUGGESTED_AMOUNTS = [100, 250, 500, 1000];

/** Radio indicator: filled teal + check when selected, hollow ring otherwise. */
function Radio({ selected, size = 22 }: { selected: boolean; size?: number }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
        },
        selected
          ? { backgroundColor: TEAL }
          : { borderWidth: 2, borderColor: "#D1D5DB" },
      ]}
    >
      {selected && (
        <Ionicons name="checkmark" size={Math.round(size * 0.55)} color="#FFFFFF" />
      )}
    </View>
  );
}

export default function GoalAddMoneyScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalAddMoneyRouteProp>();
  const { t } = useTranslation();
  const { addMoney } = useGoalActions();
  const { presentPaymentSheet } = usePayment();
  const { user } = useAuth();
  // Hoist the FC method to component-top per React Hook rules; we'll call
  // the returned function from inside the async bank handler below.
  const { collectFinancialConnectionsAccounts } = useStripeFC();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const goalId = route.params?.goalId ?? goal.id;
  const walletBalance = route.params?.walletBalance ?? 1250.0;
  const savedCards = route.params?.savedCards ?? DEFAULT_CARDS;

  // ── Real saved banks (replaces DEFAULT_BANKS) ────────────────────────────
  // Fetched from stripe_bank_accounts (populated by the FC attach flow in
  // migration 075). When the user picks one of these rows, the bank deposit
  // handler skips the FC sheet entirely and uses the stored
  // stripe_payment_method_id directly. route.params.linkedBankAccounts is
  // still honored as an override so the screen stays previewable in
  // isolation with a synthetic bank list.
  const [savedBanks, setSavedBanks] = useState<SavedBank[]>([]);
  const fetchSavedBanks = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("stripe_bank_accounts")
      .select(
        "id, stripe_payment_method_id, bank_name, last4, account_holder_name"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[GoalAddMoneyScreen] saved banks fetch failed:", error.message);
      setSavedBanks([]);
      return;
    }
    setSavedBanks((data ?? []) as SavedBank[]);
  }, [user?.id]);
  useEffect(() => {
    fetchSavedBanks();
  }, [fetchSavedBanks]);

  // Optional preview-mode override (e.g. snapshot test fixtures). Maps the
  // legacy BankAccount shape onto our render shape so existing test data
  // keeps working.
  const previewBanks = route.params?.linkedBankAccounts ?? null;
  const bankRowsForRender: SavedBank[] = previewBanks
    ? previewBanks.map((b) => ({
        id: b.id,
        stripe_payment_method_id: "", // preview-only; can't actually charge
        bank_name: b.name,
        last4: b.last4 ?? null,
        account_holder_name: null,
      }))
    : savedBanks;

  const [selectedSource, setSelectedSource] = useState<SourceKind | null>(null);
  const [amount, setAmount] = useState("");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    savedCards[0]?.id || null
  );
  const [submitting, setSubmitting] = useState(false);
  // Separate state for the bank flow because its lifecycle is much
  // longer (multi-step FC sheet + 3 edge function calls) and the UI
  // needs to disable interactions throughout.
  const [linkingBank, setLinkingBank] = useState(false);

  // ── Auto-save draft ──────────────────────────────────────────────────────
  // Per-goal key so two different goals don't share a draft. With the
  // legacy mock fallback goalId='g1' the key becomes "goal-add-money-g1"
  // — harmless, just sits unused in storage if no real edits are made.
  type GoalAddMoneyDraft = {
    amount: string;
    selectedSource: SourceKind | null;
    selectedBankId: string | null;
    selectedCardId: string | null;
  };
  const { saveDraft, restoreDraft, clearDraft } = useFormDraft<GoalAddMoneyDraft>(
    `goal-add-money-${goalId}`,
    {
      amount: "",
      selectedSource: null,
      selectedBankId: null,
      selectedCardId: savedCards[0]?.id || null,
    }
  );
  const isFirstDraftRender = useRef(true);
  // One-shot restore. WITHOUT this guard, the restore effect would re-fire
  // every time saveDraft updates the hook's internal draft state (since
  // restoreDraft's callback identity depends on the loaded draft). That
  // would clobber live keystrokes mid-typing — every save would echo
  // back the just-saved snapshot over the user's input. With the ref, we
  // pull from AsyncStorage exactly once and then let React state own the
  // form for the rest of the session.
  const hasRestoredDraft = useRef(false);
  useEffect(() => {
    if (hasRestoredDraft.current) return;
    const d = restoreDraft();
    if (d) {
      setAmount(d.amount);
      if (d.selectedSource) setSelectedSource(d.selectedSource);
      if (d.selectedBankId) setSelectedBankId(d.selectedBankId);
      if (d.selectedCardId) setSelectedCardId(d.selectedCardId);
      hasRestoredDraft.current = true;
    }
  }, [restoreDraft]);

  // Debounced save on every change. Skip first render so default values
  // don't clobber a freshly loaded draft before restore fires.
  useEffect(() => {
    if (isFirstDraftRender.current) {
      isFirstDraftRender.current = false;
      return;
    }
    saveDraft({
      amount,
      selectedSource,
      selectedBankId,
      selectedCardId,
    });
  }, [amount, selectedSource, selectedBankId, selectedCardId, saveDraft]);
  // ──────────────────────────────────────────────────────────────────────────

  const remainingToTarget = goal.target - goal.balance;
  const numAmount = Number(amount) || 0;
  const canSubmit =
    !submitting &&
    !linkingBank &&
    amount.length > 0 &&
    numAmount > 0 &&
    !!selectedSource;

  const comingSoon = (label: string) =>
    Alert.alert(label, t("goal_add_money.alert_coming_soon_body"));

  // ── Card deposit path (migration 074 + extended create-payment-intent) ─────
  // 1. Convert dollars → cents and call our edge function with
  //    purpose='goal_deposit'. The function charges amount + 1.5% on the card,
  //    stamps the PI metadata with goal_id + deposit_amount_cents + fee_cents,
  //    and persists a row in stripe_payment_intents.
  // 2. Open the Stripe PaymentSheet via PaymentContext (which already wraps
  //    StripeProvider in App.tsx, so this works on native; web returns a mock
  //    error which we surface as a friendly Alert).
  // 3. When the user confirms, Stripe charges the card and fires the
  //    payment_intent.succeeded webhook → our handler calls the
  //    credit_goal_external RPC → goal balance is credited.
  // 4. The credit is ASYNC vs the PaymentSheet dismissal. We Alert
  //    ("will be added shortly") so the user knows the balance update is in
  //    flight, then goBack(). GoalDetailV2's useFocusEffect refetches on
  //    return — by the time the user lands there the webhook has typically
  //    fired (~1-2s on test mode) and the new balance is visible.
  const handleCardDeposit = async () => {
    if (!UUID_RE.test(goalId)) {
      Alert.alert(
        t("goal_add_money.alert_goal_not_loaded_title"),
        t("goal_add_money.alert_goal_not_loaded_body")
      );
      return;
    }

    // Edge function takes amount in CENTS (≥ 50). Convert dollars → cents
    // with Math.round to avoid float precision issues.
    const amountCents = Math.round(numAmount * 100);
    if (amountCents < 50) {
      Alert.alert(
        t("goal_add_money.alert_amount_too_small_title"),
        t("goal_add_money.alert_amount_too_small_card_body")
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the PaymentIntent via our extended edge function.
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "create-payment-intent",
        {
          body: {
            amount: amountCents,
            purpose: "goal_deposit",
            goalId,
            applyCardFee: true,
          },
        }
      );
      if (invokeErr) {
        throw new Error(invokeErr.message ?? "Failed to create payment intent");
      }
      const clientSecret = (data as { clientSecret?: string })?.clientSecret;
      if (!clientSecret) {
        throw new Error("No client secret returned by server");
      }

      // 2. Open the Stripe PaymentSheet (wrapped by PaymentContext).
      const sheet = await presentPaymentSheet(clientSecret);
      if (!sheet.success) {
        // User cancellation surfaces as an error message too; treat both
        // the same — bail without crediting and without surfacing as a
        // failure scarier than it is. The Stripe SDK distinguishes
        // "Canceled" vs other errors in the error.message — surface as-is.
        if (sheet.error) {
          Alert.alert(t("goal_add_money.alert_payment_not_completed_title"), sheet.error);
        }
        return;
      }

      // 3. Charge succeeded. Webhook is in flight; credit lands async.
      // Wipe the draft now so a fresh entry starts clean next time.
      clearDraft();
      Alert.alert(
        t("goal_add_money.alert_deposit_on_way_title"),
        t("goal_add_money.alert_deposit_on_way_body"),
        [{ text: t("common.ok"), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert(
        t("goal_add_money.alert_payment_failed_title"),
        err?.message ?? t("goal_add_money.alert_default_retry")
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Bank (ACH) deposit path — Stripe Financial Connections + ACH ──────────
  // Four-step flow keyed on the backend shipped in commit 7701feb / migration
  // 075:
  //   1. stripe-create-bank-session       → FC session client_secret + sessionId.
  //   2. collectFinancialConnectionsAccounts(clientSecret)  → open FC sheet.
  //   3. stripe-attach-bank-payment-method → convert linked FC accounts to
  //      Stripe PaymentMethods, attach to customer, persist in
  //      stripe_bank_accounts. Returns accounts[0].paymentMethodId.
  //   4. create-payment-intent             → PI is created server-side with
  //      payment_method=pmId, confirm:true, mandate_data (from request
  //      headers on the server). For ACH the PI moves directly to
  //      'processing' on Stripe's side; the credit_goal_external RPC fires
  //      from the payment_intent.succeeded webhook 3-5 business days later
  //      when ACH settles.
  //
  // Why NOT call confirmPayment client-side here: the backend already
  // confirmed the PaymentIntent with the attached PM. A second confirm
  // would error out ("PaymentIntent already in processing").
  const handleBankDeposit = async () => {
    if (!UUID_RE.test(goalId)) {
      Alert.alert(
        t("goal_add_money.alert_goal_not_loaded_title"),
        t("goal_add_money.alert_goal_not_loaded_body")
      );
      return;
    }
    const amountCents = Math.round(numAmount * 100);
    if (amountCents < 50) {
      Alert.alert(
        t("goal_add_money.alert_amount_too_small_title"),
        t("goal_add_money.alert_amount_too_small_bank_body")
      );
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert(
        t("goal_add_money.alert_not_available_web_title"),
        t("goal_add_money.alert_not_available_web_body")
      );
      return;
    }

    setLinkingBank(true);
    try {
      // ── Resolve a paymentMethodId for the ACH charge ─────────────────
      // If the user picked one of their saved banks, use that PM directly
      // and skip the FC sheet entirely — they've already linked this bank.
      // Otherwise (no saved bank selected, or the user has zero saved
      // banks) run the full FC link+attach flow inline.
      const selectedSavedBank = bankRowsForRender.find(
        (b) => b.id === selectedBankId && b.stripe_payment_method_id
      );

      let paymentMethodId: string | null =
        selectedSavedBank?.stripe_payment_method_id ?? null;

      if (!paymentMethodId) {
        // 1. Create the Financial Connections session (creates-or-gets the
        //    Stripe customer behind the scenes; we don't need the customerId
        //    on the client).
        const { data: sessionData, error: sessionErr } =
          await supabase.functions.invoke("stripe-create-bank-session", {
            body: {},
          });
        if (sessionErr) {
          throw new Error(sessionErr.message ?? "Failed to start bank linking");
        }
        const fcClientSecret = (sessionData as { clientSecret?: string })?.clientSecret;
        const sessionId = (sessionData as { sessionId?: string })?.sessionId;
        if (!fcClientSecret || !sessionId) {
          throw new Error("Bank session response missing clientSecret/sessionId");
        }

        // 2. Open the FC sheet. User picks a bank, authenticates, picks
        //    accounts. Cancellation surfaces as { error: { code: 'Canceled' } }
        //    — treat quietly (no scary alert).
        const fcResult = await collectFinancialConnectionsAccounts(fcClientSecret);
        if (fcResult.error) {
          if (fcResult.error.code === "Canceled") return; // user backed out
          throw new Error(fcResult.error.message ?? "Bank linking failed");
        }
        if (!fcResult.session) {
          throw new Error("No bank account was linked");
        }

        // 3. Convert linked FC accounts → Stripe PaymentMethods on the server.
        //    The function upserts into stripe_bank_accounts and returns the
        //    PM id (first account if multiple were linked).
        const { data: attachData, error: attachErr } =
          await supabase.functions.invoke("stripe-attach-bank-payment-method", {
            body: { sessionId },
          });
        if (attachErr) {
          throw new Error(attachErr.message ?? "Failed to attach bank account");
        }
        const accounts =
          (attachData as { accounts?: Array<{ paymentMethodId: string }> })?.accounts;
        paymentMethodId = accounts?.[0]?.paymentMethodId ?? null;
        if (!paymentMethodId) {
          throw new Error("No bank payment method returned by server");
        }

        // Refresh the saved-banks list in the background so the next
        // deposit can reuse this bank without re-running the FC sheet.
        fetchSavedBanks();
      }

      // 4. Create + confirm the PaymentIntent on the server. No fee for
      //    ACH (the screen advertises "Bank transfers are free"); the
      //    backend computes everything from amountCents and stamps
      //    metadata.source='bank' for the webhook.
      const { data: piData, error: piErr } = await supabase.functions.invoke(
        "create-payment-intent",
        {
          body: {
            amount: amountCents,
            purpose: "goal_deposit",
            goalId,
            paymentMethodType: "us_bank_account",
            paymentMethodId,
            // applyCardFee intentionally omitted/false
          },
        }
      );
      if (piErr) {
        throw new Error(piErr.message ?? "Failed to create bank payment intent");
      }
      if (!(piData as { paymentIntentId?: string })?.paymentIntentId) {
        throw new Error("Payment intent creation returned no id");
      }

      // ACH takes days to settle; webhook is what credits the goal. Set
      // expectations clearly so the user doesn't refresh hoping for an
      // instant balance change.
      // Wipe the draft now so a fresh entry starts clean next time.
      clearDraft();
      Alert.alert(
        t("goal_add_money.alert_bank_transfer_initiated_title"),
        t("goal_add_money.alert_bank_transfer_initiated_body"),
        [{ text: t("common.ok"), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert(
        t("goal_add_money.alert_bank_deposit_failed_title"),
        err?.message ?? t("goal_add_money.alert_bank_deposit_failed_body")
      );
    } finally {
      setLinkingBank(false);
    }
  };

  // ── Link a new bank for FUTURE use (no immediate charge) ─────────────────
  // Powers the "+ Link a bank account" affordance. Runs the same FC link
  // flow as handleBankDeposit's path-when-no-saved-bank, but stops before
  // create-payment-intent so the user can link ahead of time and pick the
  // bank later when they have an amount entered.
  const linkBankOnly = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        t("goal_add_money.alert_not_available_web_title"),
        t("goal_add_money.alert_not_available_web_body")
      );
      return;
    }
    setLinkingBank(true);
    try {
      const { data: sessionData, error: sessionErr } =
        await supabase.functions.invoke("stripe-create-bank-session", {
          body: {},
        });
      if (sessionErr) {
        throw new Error(sessionErr.message ?? "Failed to start bank linking");
      }
      const fcClientSecret = (sessionData as { clientSecret?: string })?.clientSecret;
      const sessionId = (sessionData as { sessionId?: string })?.sessionId;
      if (!fcClientSecret || !sessionId) {
        throw new Error("Bank session response missing clientSecret/sessionId");
      }

      const fcResult = await collectFinancialConnectionsAccounts(fcClientSecret);
      if (fcResult.error) {
        if (fcResult.error.code === "Canceled") return;
        throw new Error(fcResult.error.message ?? "Bank linking failed");
      }
      if (!fcResult.session) {
        throw new Error("No bank account was linked");
      }

      const { data: attachData, error: attachErr } =
        await supabase.functions.invoke("stripe-attach-bank-payment-method", {
          body: { sessionId },
        });
      if (attachErr) {
        throw new Error(attachErr.message ?? "Failed to attach bank account");
      }
      const accounts =
        (attachData as { accounts?: Array<{ paymentMethodId: string; bankName?: string | null; last4?: string | null }> })?.accounts;
      if (!accounts || accounts.length === 0) {
        throw new Error("Server returned no linked accounts");
      }

      await fetchSavedBanks();
      Alert.alert(
        t("goal_add_money.alert_bank_linked_title"),
        t("goal_add_money.alert_bank_linked_body", {
          bank: accounts[0].bankName ?? t("goal_add_money.default_bank_name"),
          last4: accounts[0].last4 ?? t("goal_add_money.default_bank_last4"),
        })
      );
    } catch (err: any) {
      Alert.alert(
        t("goal_add_money.alert_bank_linking_failed_title"),
        err?.message ?? t("goal_add_money.alert_default_retry")
      );
    } finally {
      setLinkingBank(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (selectedSource === "card") {
      await handleCardDeposit();
      return;
    }

    if (selectedSource === "bank") {
      await handleBankDeposit();
      return;
    }

    if (!UUID_RE.test(goalId)) {
      Alert.alert(
        t("goal_add_money.alert_goal_not_loaded_title"),
        t("goal_add_money.alert_goal_not_loaded_body")
      );
      return;
    }

    // Atomic via the transfer_to_goal RPC (migration 073) — wallet debit
    // and goal credit happen in one transaction inside useGoalActions.
    setSubmitting(true);
    const { error } = await addMoney(goalId, numAmount, "wallet");
    setSubmitting(false);

    if (error) {
      Alert.alert(
        t("goal_add_money.alert_deposit_failed_title"),
        error.message ?? t("goal_add_money.alert_default_retry")
      );
      return;
    }

    // GoalDetailV2 refetches on focus, so a bare goBack() is enough —
    // the new balance will appear when the user lands back on detail.
    clearDraft();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ===== HEADER ===== */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("goal_add_money.header")}</Text>
          </View>

          {/* Goal summary */}
          <View style={styles.goalSummary}>
            <View style={styles.goalEmojiBox}>
              <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalMeta}>
                {t("goal_add_money.summary_meta", {
                  saved: goal.balance.toLocaleString(),
                  remaining: remainingToTarget.toLocaleString(),
                })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Amount input */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t("goal_add_money.amount_label")}</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.amountCurrency}>$</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                style={styles.amountInput}
              />
            </View>

            {/* Quick select */}
            <View style={styles.quickRow}>
              {SUGGESTED_AMOUNTS.map((amt) => {
                const isActive = amount === String(amt);
                return (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setAmount(String(amt))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={[styles.quickPill, isActive && styles.quickPillActive]}
                  >
                    <Text
                      style={[
                        styles.quickPillText,
                        isActive && styles.quickPillTextActive,
                      ]}
                    >
                      ${amt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => setAmount(String(remainingToTarget))}
                accessibilityRole="button"
                style={styles.fillPill}
              >
                <Text style={styles.fillPillText}>{t("goal_add_money.fill_to_target")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Funding source */}
          <View style={styles.card}>
            <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>{t("goal_add_money.fund_from")}</Text>

            {/* Wallet */}
            <TouchableOpacity
              onPress={() => setSelectedSource("wallet")}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedSource === "wallet" }}
              style={[
                styles.sourceRow,
                selectedSource === "wallet" && styles.sourceRowSelected,
              ]}
            >
              <View style={styles.sourceLeft}>
                <View style={[styles.sourceIconBox, { backgroundColor: TEAL }]}>
                  <Text style={styles.sourceIconEmoji}>💵</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceName}>{t("goal_add_money.source_wallet_name")}</Text>
                  <Text style={styles.sourceMeta}>
                    {t("goal_add_money.source_wallet_balance", { amount: walletBalance.toLocaleString() })}
                  </Text>
                </View>
              </View>
              <Radio selected={selectedSource === "wallet"} />
            </TouchableOpacity>

            {/* Saved bank accounts (real rows from stripe_bank_accounts;
                preview-mode override still honored). Picking one here makes
                handleBankDeposit skip the FC sheet on submit. When the list
                is empty we render a friendly placeholder pointing at the
                "+ Link a bank account" affordance below. */}
            {bankRowsForRender.length === 0 ? (
              <View style={[styles.sourceRow, { justifyContent: "center" }]}>
                <Text style={styles.sourceMeta}>
                  {t("goal_add_money.no_banks_linked")}
                </Text>
              </View>
            ) : (
              bankRowsForRender.map((bank) => {
                const isSel = selectedSource === "bank" && selectedBankId === bank.id;
                const displayName = bank.bank_name ?? t("goal_add_money.source_bank_default_name");
                const last4 = bank.last4 ?? t("goal_add_money.default_bank_last4");
                return (
                  <TouchableOpacity
                    key={bank.id}
                    onPress={() => {
                      setSelectedSource("bank");
                      setSelectedBankId(bank.id);
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    style={[styles.sourceRow, isSel && styles.sourceRowSelected]}
                  >
                    <View style={styles.sourceLeft}>
                      <View
                        style={[styles.sourceIconBox, { backgroundColor: "#1D4ED8" }]}
                      >
                        <Text style={styles.sourceIconEmoji}>🏦</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sourceName}>{displayName}</Text>
                        <Text style={styles.sourceMeta}>
                          {t("goal_add_money.source_bank_meta", { last4 })}
                        </Text>
                      </View>
                    </View>
                    <Radio selected={isSel} />
                  </TouchableOpacity>
                );
              })
            )}

            {/* Debit cards */}
            {savedCards.map((card) => {
              const isSel = selectedSource === "card" && selectedCardId === card.id;
              return (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => {
                    setSelectedSource("card");
                    setSelectedCardId(card.id);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  style={[styles.sourceRow, isSel && styles.sourceRowSelected]}
                >
                  <View style={styles.sourceLeft}>
                    <View
                      style={[styles.sourceIconBox, { backgroundColor: "#7C3AED" }]}
                    >
                      <Text style={styles.sourceIconEmoji}>💳</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sourceName}>
                        {card.name} ••••{card.last4}
                      </Text>
                      <Text style={styles.sourceMeta}>{t("goal_add_money.source_card_meta")}</Text>
                    </View>
                  </View>
                  <Radio selected={isSel} />
                </TouchableOpacity>
              );
            })}

            {/* Add new */}
            <View style={styles.addNewRow}>
              <TouchableOpacity
                onPress={linkBankOnly}
                disabled={linkingBank}
                accessibilityRole="button"
                accessibilityState={{ disabled: linkingBank }}
                style={[styles.addNewButton, linkingBank && { opacity: 0.5 }]}
              >
                <Text style={styles.addNewText}>
                  {linkingBank ? t("goal_add_money.linking") : t("goal_add_money.link_bank")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => comingSoon(t("goal_add_money.alert_add_card_label"))}
                accessibilityRole="button"
                style={styles.addNewButton}
              >
                <Text style={styles.addNewText}>{t("goal_add_money.add_card")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Auto-deposit upsell */}
          <TouchableOpacity
            onPress={() => comingSoon(t("goal_add_money.alert_setup_autodeposit_label"))}
            activeOpacity={0.9}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[NAVY, "#143654"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upsellCard}
            >
              <Text style={styles.upsellEmoji}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.upsellTitle}>{t("goal_add_money.upsell_title")}</Text>
                <Text style={styles.upsellBody}>{t("goal_add_money.upsell_body")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Fee notice (card + amount) */}
          {selectedSource === "card" && amount.length > 0 && (
            <View style={styles.feeNotice}>
              <Text style={styles.feeEmoji}>💡</Text>
              <Text style={styles.feeText}>
                {t("goal_add_money.fee_card_text", { fee: (numAmount * 0.015).toFixed(2) })}
              </Text>
            </View>
          )}

          {/* Timing notice (bank) — ACH settles in 3-5 business days */}
          {selectedSource === "bank" && amount.length > 0 && (
            <View style={styles.feeNotice}>
              <Text style={styles.feeEmoji}>🕒</Text>
              <Text style={styles.feeText}>
                {t("goal_add_money.fee_bank_text")}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ===== BOTTOM CTA ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{
            disabled: !canSubmit,
            busy: submitting || linkingBank,
          }}
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        >
          {submitting || linkingBank ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.primaryButtonText,
                !canSubmit && styles.primaryButtonTextDisabled,
              ]}
            >
              {amount.length > 0
                ? selectedSource === "bank"
                  ? t("goal_add_money.cta_link_bank_send", { amount: numAmount.toLocaleString() })
                  : t("goal_add_money.cta_add_to_goal", { amount: numAmount.toLocaleString() })
                : t("goal_add_money.cta_enter_amount")}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 50, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },

  goalSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
  },
  goalEmojiBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  goalEmoji: { fontSize: 26 },
  goalName: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  goalMeta: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 },

  contentWrap: { marginTop: -25, paddingHorizontal: 16 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: MUTED },

  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  amountCurrency: { fontSize: 32, fontWeight: "700", color: NAVY },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: "700",
    color: NAVY,
    marginLeft: 4,
    padding: 0,
  },

  quickRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  quickPill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  quickPillActive: { borderWidth: 2, borderColor: TEAL, backgroundColor: "#F0FDFB" },
  quickPillText: { fontSize: 14, fontWeight: "600", color: MUTED },
  quickPillTextActive: { color: GREEN },
  fillPill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TEAL,
    backgroundColor: "#FFFFFF",
  },
  fillPillText: { fontSize: 12, fontWeight: "600", color: TEAL },

  // Funding source rows
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
    marginBottom: 10,
  },
  sourceRowSelected: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
    margin: -1,
    marginBottom: 9,
  },
  sourceLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  sourceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceIconEmoji: { fontSize: 20 },
  sourceName: { fontSize: 14, fontWeight: "600", color: NAVY },
  sourceMeta: { fontSize: 12, color: MUTED, marginTop: 2 },

  addNewRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  addNewButton: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  addNewText: { fontSize: 12, fontWeight: "500", color: MUTED },

  // Auto-deposit upsell
  upsellCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  upsellEmoji: { fontSize: 28 },
  upsellTitle: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  upsellBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },

  // Fee notice
  feeNotice: {
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  feeEmoji: { fontSize: 16 },
  feeText: { fontSize: 12, color: "#92400E", flex: 1 },

  // Bottom CTA
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: BORDER },
  primaryButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  primaryButtonTextDisabled: { color: "#9CA3AF" },
});
