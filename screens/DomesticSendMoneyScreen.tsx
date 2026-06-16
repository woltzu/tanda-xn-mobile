import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useWallet } from "../context/WalletContext";
import { usePayment } from "../context/PaymentContext";
import { useAuth } from "../context/AuthContext";
import {
  useRecentRecipients,
  saveRecipient,
  bumpRecipientStats,
  topRecipientByFrequency,
  type SavedRecipient,
} from "../hooks/useRecipients";
import NewRecipientModal from "../components/NewRecipientModal";
import ContactPickerModal, {
  type PickedContact,
} from "../components/ContactPickerModal";
import type { RecipientMethod } from "../hooks/useRecipients";
import { useGoalActions } from "../hooks/useGoalActions";
import { showToast } from "../components/Toast";
import { useKYCGate } from "../components/KYCGate";
import { requiredTierForAmountUsd } from "../lib/kycTiers";

type NavProp = StackNavigationProp<RootStackParamList>;

// =============================================================================
// TYPES & DATA
// =============================================================================

type RecentRecipient = {
  id: string;
  name: string;
  method: string;
  identifier: string;
  bank?: string;
  accountNumber?: string;
  network?: string;
  phone?: string;
  location?: string;
  verified?: boolean;
  // P2 (migration 154): drives "Send to {name} again?" prediction +
  // last-amount auto-fill on tap.
  sendCount?: number;
  lastAmountCents?: number | null;
};

// i18n: MethodOption stores translation keys for the user-visible
// strings. Resolved per-render via t() inside the component body.
type MethodOption = {
  id: string;
  nameKey: string;
  fee: number;
  estimateKey: string;
  icon: string;
  descKey: string;
  badgeKey?: string;
};

// RECENT_RECIPIENTS removed \u2014 now sourced from send_money_recipients table
// via useRecentRecipients() (limit 4, ordered by last_sent_at DESC).
// Saved via saveRecipient() on add-new and on successful send.

// Map SavedRecipient (DB shape) \u2192 RecentRecipient (legacy local shape used by
// the existing UI selection logic). Keeps the rest of this screen unchanged.
function toLegacyRecipient(r: SavedRecipient): RecentRecipient {
  return {
    id: r.id,
    name: r.name,
    method: r.method,
    identifier: r.identifier,
    bank: r.bank ?? undefined,
    accountNumber: r.account_number ?? undefined,
    network: r.network ?? undefined,
    phone: r.contact_phone ?? undefined,
    location: r.location ?? undefined,
    verified: r.verified,
    sendCount: r.send_count,
    lastAmountCents: r.last_amount_cents,
  };
}

const BANKS = [
  { id: "access", name: "Access Bank" },
  { id: "gtbank", name: "GTBank" },
  { id: "uba", name: "UBA" },
  { id: "firstbank", name: "First Bank" },
  { id: "zenith", name: "Zenith Bank" },
  { id: "fidelity", name: "Fidelity Bank" },
  { id: "union", name: "Union Bank" },
  { id: "stanbic", name: "Stanbic IBTC" },
];

const MOBILE_NETWORKS = [
  { id: "mtn", name: "MTN", color: "#FFCC00" },
  { id: "glo", name: "Glo", color: "#00A651" },
  { id: "airtel", name: "Airtel", color: "#ED1C24" },
  { id: "9mobile", name: "9mobile", color: "#006B53" },
];

const PICKUP_LOCATIONS = [
  { id: "ikeja", name: "Ikeja", address: "123 Allen Avenue" },
  { id: "vi", name: "Victoria Island", address: "45 Adeola Odeku" },
  { id: "lekki", name: "Lekki", address: "10 Admiralty Way" },
  { id: "ajah", name: "Ajah", address: "Ajah Market Road" },
  { id: "yaba", name: "Yaba", address: "Herbert Macaulay Way" },
];

const METHOD_OPTIONS: Record<string, MethodOption> = {
  wallet: {
    id: "wallet",
    nameKey: "domestic_send.method_wallet_name",
    fee: 0,
    estimateKey: "domestic_send.method_wallet_estimate",
    icon: "\u{1F4B0}",
    descKey: "domestic_send.method_wallet_desc",
    badgeKey: "domestic_send.method_wallet_badge",
  },
  bank: {
    id: "bank",
    nameKey: "domestic_send.method_bank_name",
    fee: 100,
    estimateKey: "domestic_send.method_bank_estimate",
    icon: "\u{1F3E6}",
    descKey: "domestic_send.method_bank_desc",
  },
  mobile: {
    id: "mobile",
    nameKey: "domestic_send.method_mobile_name",
    fee: 75,
    estimateKey: "domestic_send.method_mobile_estimate",
    icon: "\u{1F4F1}",
    descKey: "domestic_send.method_mobile_desc",
  },
  cash: {
    id: "cash",
    nameKey: "domestic_send.method_cash_name",
    fee: 200,
    estimateKey: "domestic_send.method_cash_estimate",
    icon: "\u{1F4B5}",
    descKey: "domestic_send.method_cash_desc",
  },
};

const CURRENCY_SYMBOL = "\u20A6";
const COUNTRY_FLAG = "\u{1F1F3}\u{1F1EC}";

// =============================================================================
// COMPONENT
// =============================================================================

export default function DomesticSendMoneyScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();
  const { balance, sendMoney } = useWallet();
  const { paymentMethods, createDeposit, presentPaymentSheet } = usePayment();
  const { user } = useAuth();
  const { ensureRoundUpGoal, addMoney } = useGoalActions();
  const userBalance = balance;

  // P2 — read the user's round-up preference from profiles. Lazy: only
  // fetched once per mount; refreshed when ProfileScreen writes a new value
  // and the user returns here (re-mount path is fine for an MVP).
  const [roundUpIncrement, setRoundUpIncrement] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("round_up_increment")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setRoundUpIncrement((data.round_up_increment as number) ?? 0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Recent recipients — real data sourced from send_money_recipients table.
  const { recipients: dbRecipients, refetch: refetchRecipients } =
    useRecentRecipients(4);
  const recentRecipients = dbRecipients.map(toLegacyRecipient);
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  // Pre-fill payload passed to NewRecipientModal when a TandaXn contact is
  // picked from the contact picker. Reset to undefined for manual add-new.
  const [recipientPrefill, setRecipientPrefill] = useState<
    { name: string; identifier: string; method: RecipientMethod } | undefined
  >(undefined);

  const handleContactPicked = (contact: PickedContact) => {
    if (!contact.isTandaXn) return; // invite path is handled inside the picker
    setRecipientPrefill({
      name: contact.tandaUserName ?? contact.name,
      identifier: contact.phone,
      method: "mobile",
    });
    setShowAddRecipient(true);
  };

  const openManualAddRecipient = () => {
    setRecipientPrefill(undefined);
    setShowAddRecipient(true);
  };

  // State
  const [recipientTab, setRecipientTab] = useState<"new" | "recent">("new");
  const [selectedRecipient, setSelectedRecipient] = useState<RecentRecipient | null>(null);
  const [selectedMethod, setSelectedMethod] = useState("wallet");
  const [recipientName, setRecipientName] = useState("");

  // Wallet fields — `walletUserFound` is set ONLY when the real
  // search_users_by_phone RPC returns a matching profile. The synthetic
  // "verified" / "@username" fake the previous version produced for any
  // 10+ char string has been deleted.
  const [walletLookup, setWalletLookup] = useState("");
  const [walletUserFound, setWalletUserFound] = useState<{
    id: string;
    name: string;
    phone: string;
  } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupNoMatch, setLookupNoMatch] = useState(false);

  // Bank fields
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Mobile fields
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Cash fields
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Amount
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Funding source
  const [fundingSource, setFundingSource] = useState<"wallet" | string>("wallet");

  // P0 (kyc-trigger review): resume the form state when the KYCHub
  // hands us back via the deferred-action navigate. The snapshot is
  // optional — undefined for the normal entry path. We fire the
  // setters one-shot on mount; we DO NOT keep the params after to
  // avoid re-applying them on every focus.
  const route = useRoute<RouteProp<RootStackParamList, "DomesticSendMoney">>();
  useEffect(() => {
    const r = route.params?.resume;
    if (!r) return;
    if (typeof r.amount === "string") setAmount(r.amount);
    if (r.recipientTab === "new" || r.recipientTab === "recent")
      setRecipientTab(r.recipientTab);
    if (typeof r.selectedMethod === "string") setSelectedMethod(r.selectedMethod);
    if (typeof r.recipientName === "string") setRecipientName(r.recipientName);
    if (typeof r.selectedBank === "string") setSelectedBank(r.selectedBank);
    if (typeof r.accountNumber === "string") setAccountNumber(r.accountNumber);
    if (typeof r.selectedNetwork === "string")
      setSelectedNetwork(r.selectedNetwork);
    if (typeof r.phoneNumber === "string") setPhoneNumber(r.phoneNumber);
    if (typeof r.selectedLocation === "string")
      setSelectedLocation(r.selectedLocation);
    if (typeof r.fundingSource === "string") setFundingSource(r.fundingSource);
    // Intentional one-shot — second arg [] keeps it from re-firing
    // and the form state can diverge from route.params from this
    // point forward without conflict.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // P0 (kyc-trigger review): gate the Send button. ensureVerified is
  // called at the top of handleSend so a blocked user never starts
  // the deposit / debit chain. The snapshot below mirrors the
  // app/RootStackParamList resume shape so the KYCHub redirect lands
  // us back on the same input set.
  //
  // P2 — the required tier scales with the amount. Small sends only
  // need Tier 1 (Basic); larger ones step up. We compute USD-equivalent
  // off the typed amount; until the screen supports multi-currency
  // explicit input with FX, the NGN-tagged numericAmount is treated as
  // the USD-equivalent value for the tier-cap comparison. This
  // approximation tracks the real wallet debit (which is USD-equivalent
  // server-side) close enough for the gate to make a defensible
  // decision; a future FX-aware version will plug into the wallet's
  // currency rate.
  const requiredTier = requiredTierForAmountUsd(numericAmount);
  const { ensureVerified } = useKYCGate({
    resumeRoute: "DomesticSendMoney",
    requiredTier,
  });

  // Derived
  const currentMethod = METHOD_OPTIONS[selectedMethod];
  const currentFee = currentMethod?.fee || 0;
  const numericAmount = parseFloat(amount) || 0;
  const totalToPay = numericAmount + currentFee;

  // Validation
  const validateAccountNumber = (value: string) => /^\d{10}$/.test(value);

  const validatePhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return /^0\d{10}$/.test(cleaned) || /^234\d{10}$/.test(cleaned);
  };

  const isRecipientValid = () => {
    if (recipientTab === "recent" && selectedRecipient) return true;

    if (recipientTab === "new") {
      if (!recipientName || recipientName.length < 2) return false;

      switch (selectedMethod) {
        case "wallet":
          return walletUserFound !== null;
        case "bank":
          return selectedBank !== "" && validateAccountNumber(accountNumber);
        case "mobile":
          return selectedNetwork !== "" && validatePhoneNumber(phoneNumber);
        case "cash":
          return !!selectedLocation;
        default:
          return false;
      }
    }
    return false;
  };

  const isFormValid = () => {
    if (!isRecipientValid()) return false;
    if (numericAmount <= 0) return false;
    if (totalToPay > userBalance) return false;
    return true;
  };

  // Handlers
  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    setWalletLookup("");
    setWalletUserFound(null);
    setSelectedBank("");
    setAccountNumber("");
    setSelectedNetwork("");
    setPhoneNumber("");
    setSelectedLocation("");
  };

  const handleSelectRecipient = (recipient: RecentRecipient) => {
    setSelectedRecipient(recipient);
    setSelectedMethod(recipient.method);
    // P2: auto-fill the amount with the last value sent to this recipient
    // when the user hasn't typed anything yet. They can still override.
    if (
      (!amount || amount === "0" || amount.trim().length === 0) &&
      recipient.lastAmountCents &&
      recipient.lastAmountCents > 0
    ) {
      const dollars = (recipient.lastAmountCents / 100).toFixed(2);
      setAmount(dollars);
    }
  };

  // P2: most-frequent recipient. Drives the "Send to {name} again?" chip
  // that appears above the recipient tabs when an amount is typed but no
  // recipient has been picked yet.
  const topRecipient = useMemo(
    () => topRecipientByFrequency(dbRecipients),
    [dbRecipients],
  );
  const showPredictionChip =
    numericAmount > 0 && !selectedRecipient && topRecipient !== null;
  const handlePredictionChipTap = () => {
    if (!topRecipient) return;
    const legacy = toLegacyRecipient(topRecipient);
    setRecipientTab("recent");
    setSelectedRecipient(legacy);
    setSelectedMethod(legacy.method);
  };

  // Debounced real wallet lookup. Strips formatting from the typed value,
  // normalizes to +E.164, calls the SECURITY DEFINER search_users_by_phone
  // RPC, and only sets walletUserFound when a profile actually matches.
  // The synthetic-match path (any 10+ chars passes) is gone — what users
  // see is the truth.
  useEffect(() => {
    if (selectedMethod !== "wallet") {
      setWalletUserFound(null);
      setIsLookingUp(false);
      setLookupNoMatch(false);
      return;
    }
    const raw = walletLookup.trim();
    if (raw.length === 0) {
      setWalletUserFound(null);
      setIsLookingUp(false);
      setLookupNoMatch(false);
      return;
    }
    const digits = raw.replace(/[\s\-().]/g, "");
    if (!/^\+?\d{7,}$/.test(digits)) {
      // Not yet a plausible phone — wait for more input before hitting
      // the RPC.
      setWalletUserFound(null);
      setIsLookingUp(false);
      setLookupNoMatch(false);
      return;
    }
    const normalized = digits.startsWith("+") ? digits : `+${digits}`;

    setIsLookingUp(true);
    setLookupNoMatch(false);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_users_by_phone", {
          phone_numbers: [normalized],
        });
        if (cancelled) return;
        if (error) {
          setWalletUserFound(null);
          setLookupNoMatch(true);
          return;
        }
        const row = (data ?? [])[0] as
          | { id: string; full_name: string | null; phone: string }
          | undefined;
        if (row?.id) {
          setWalletUserFound({
            id: row.id,
            name: row.full_name ?? raw,
            phone: row.phone,
          });
          setLookupNoMatch(false);
        } else {
          setWalletUserFound(null);
          setLookupNoMatch(true);
        }
      } finally {
        if (!cancelled) setIsLookingUp(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [walletLookup, selectedMethod]);

  // Default the recipient tab to "Recent" once we know the user has
  // existing recipients — but only on the first arrival of that data so
  // we don't fight a user who explicitly switched back to "New".
  const [didSetInitialTab, setDidSetInitialTab] = useState(false);
  useEffect(() => {
    if (didSetInitialTab) return;
    if (dbRecipients.length > 0) {
      setRecipientTab("recent");
      setDidSetInitialTab(true);
    }
  }, [dbRecipients.length, didSetInitialTab]);

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setAmount(cleaned);
  };

  const handleSend = async () => {
    if (!isFormValid()) return;

    // P0 (kyc-trigger review): block unverified users BEFORE any
    // state change. The snapshot captures every typed field so the
    // resume after KYC lands us on the same screen + form. Note we
    // skip selectedRecipient — the recent-recipient row is fetched
    // async on the next visit and rehydrated by the existing
    // recipients hook anyway.
    const gatePassed = await ensureVerified(() => ({
      resume: {
        amount,
        recipientTab,
        selectedMethod,
        recipientName,
        selectedBank,
        accountNumber,
        selectedNetwork,
        phoneNumber,
        selectedLocation,
        fundingSource,
      },
    }));
    if (!gatePassed) return;

    setIsProcessing(true);
    try {
      // Resolve the display name and the canonical method id (one of
      // 'wallet'|'bank'|'mobile'|'cash' — required by the RPC's CHECK
      // constraint). For recent recipients we trust the row's stored
      // method; for new ones we use the user's current selection.
      const name =
        recipientTab === "recent"
          ? selectedRecipient?.name || ""
          : recipientName;
      const canonicalMethod =
        recipientTab === "recent" && selectedRecipient
          ? selectedRecipient.method
          : selectedMethod;

      // Human-readable label for the success screen + saved-recipient row.
      const methodLabel = t("domestic_send.method_label_domestic", {
        name: currentMethod ? t(currentMethod.nameKey) : "",
      });

      // Build the recipient identifier the RPC will try to phone-match.
      // Wallet path prefers the canonical phone returned by the lookup
      // (so the RPC's INNER lookup finds the row), with the raw input
      // as a fallback.
      const recipientIdentifier =
        recipientTab === "recent" && selectedRecipient
          ? selectedRecipient.identifier
          : canonicalMethod === "wallet"
            ? walletUserFound?.phone ?? walletLookup
            : canonicalMethod === "bank"
              ? `${selectedBank}-${accountNumber}`
              : canonicalMethod === "mobile"
                ? `${selectedNetwork}-${phoneNumber}`
                : selectedLocation;

      // Stripe-funded path: charge first, capture the PaymentIntent id so
      // the transfer row can be linked back to the Stripe charge later.
      const isWalletFunded = fundingSource === "wallet";
      let stripePaymentIntentId: string | null = null;
      if (!isWalletFunded) {
        const { clientSecret } = await createDeposit(
          Math.round(numericAmount * 100),
          "NGN"
        );
        const { success, error } = await presentPaymentSheet(clientSecret);
        if (!success) {
          Alert.alert(
            t("domestic_send.alert_payment_failed_title"),
            error || t("domestic_send.alert_payment_failed_body"),
          );
          setIsProcessing(false);
          return;
        }
        // Extract the PaymentIntent id from "pi_XXXX_secret_YYYY".
        stripePaymentIntentId = clientSecret
          ? clientSecret.split("_secret_")[0]
          : null;
      }

      // Real RPC call via WalletContext — debits user_wallets atomically
      // (locked FOR UPDATE), writes the money_transfers row, returns the
      // canonical transfer id and authoritative new balance.
      const transferId = await sendMoney(numericAmount, name, canonicalMethod, {
        currency: "NGN",
        recipientIdentifier,
        fundingSource: isWalletFunded ? "wallet" : "stripe",
        feeCents: Math.round(currentFee * 100),
        stripePaymentIntentId,
      });

      // Persist (or bump last_sent_at on) the recipient so they appear in
      // the recent list next time. Fire-and-forget — UX doesn't depend on
      // this succeeding before navigation. `verified` is true only when
      // the real lookup matched a TandaXn profile.
      //
      // P2 chain: saveRecipient → bumpRecipientStats(send_count + 1,
      // last_amount_cents = this send). Without the awaited save the bump
      // would have nothing to target on the first send to a brand-new
      // recipient.
      if (user?.id && recipientIdentifier) {
        (async () => {
          try {
            const { row } = await saveRecipient(
              {
                name,
                identifier: recipientIdentifier,
                method: canonicalMethod as "wallet" | "bank" | "mobile" | "cash",
                contact_phone: phoneNumber || null,
                bank: selectedBank || null,
                account_number: accountNumber || null,
                network: selectedNetwork || null,
                location: selectedLocation || null,
                verified: walletUserFound !== null,
              },
              user.id,
            );
            if (row?.id) {
              await bumpRecipientStats(row.id, Math.round(numericAmount * 100));
            }
          } catch {
            /* fire-and-forget */
          }
        })();
      }

      // P2 — round-up sweep. After the wallet debit lands, compute the
      // delta to the next round-up multiple and credit the user's
      // dedicated "Round-up Savings" jar. ensureRoundUpGoal creates the
      // jar on first sweep. Fire-and-forget — toast on success, log on
      // failure, never block navigation.
      //
      // Goal P2 (migration 155): the jar itself can opt out via
      // user_savings_goals.round_up_enabled. We honour both:
      // profiles.round_up_increment > 0 AND jar.roundUpEnabled !== false.
      if (roundUpIncrement > 0) {
        const inc = roundUpIncrement;
        const roundedUp = Math.ceil(numericAmount / inc) * inc;
        const delta = +(roundedUp - numericAmount).toFixed(2);
        if (delta > 0) {
          (async () => {
            try {
              const { data: jar } = await ensureRoundUpGoal();
              if (!jar) return;
              if (jar.roundUpEnabled === false) return;
              const { error: depositErr } = await addMoney(jar.id, delta, "wallet");
              if (!depositErr) {
                showToast(
                  t("domestic_send.toast_round_up_saved", {
                    amount: `${CURRENCY_SYMBOL}${delta.toFixed(2)}`,
                  }),
                  "success",
                );
              }
            } catch (e) {
              console.warn("[send-money] round-up sweep failed:", e);
            }
          })();
        }
      }

      navigation.navigate("WalletTransactionSuccess", {
        type: "send",
        amount: numericAmount,
        method: methodLabel,
        recipientName: name,
        transactionId: transferId,
        currency: "NGN",
        feeAmount: currentFee,
        feeCurrency: "NGN",
      });
    } catch (error: any) {
      const code = (error?.message || "").toLowerCase();
      if (code.includes("insufficient_funds")) {
        Alert.alert(
          t("domestic_send.alert_transfer_failed_title"),
          t("domestic_send.alert_insufficient_funds"),
        );
      } else {
        Alert.alert(
          t("domestic_send.alert_transfer_failed_title"),
          t("domestic_send.alert_transfer_failed_body"),
        );
      }
      console.error("Error sending money:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex1}
      >
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <SafeAreaView>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>{t("domestic_send.header")}</Text>
                <Text style={styles.headerSubtitle}>{COUNTRY_FLAG} {t("domestic_send.header_subtitle")}</Text>
              </View>
              <View style={styles.placeholder} />
            </View>

            {/* Balance */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>{t("domestic_send.balance_label")}</Text>
              <Text style={styles.balanceAmount}>
                {CURRENCY_SYMBOL}{formatCurrency(userBalance)}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Content */}
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ============================== */}
          {/* SCOPE TOGGLE                   */}
          {/* ============================== */}
          {/* Replaces the old SendMoneyScreen chooser — one tap saved. */}
          <View style={styles.scopeRow}>
            <View style={[styles.scopeChip, styles.scopeChipActive]}>
              <Text style={[styles.scopeChipText, styles.scopeChipTextActive]}>
                {t("domestic_send.scope_domestic")}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.scopeChip}
              onPress={() => navigation.replace("Remittance")}
              accessibilityRole="button"
            >
              <Text style={styles.scopeChipText}>
                {t("domestic_send.scope_international")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ============================== */}
          {/* P2 — Prediction chip            */}
          {/* ============================== */}
          {/* "Send to {name} again?" — only shown when the user has typed
              an amount but hasn't yet picked a recipient. Picks the most-
              frequent recipient owned by the user. */}
          {showPredictionChip && topRecipient ? (
            <TouchableOpacity
              style={styles.predictionChip}
              onPress={handlePredictionChipTap}
              accessibilityRole="button"
            >
              <Ionicons name="flash-outline" size={14} color="#0A2342" />
              <Text style={styles.predictionChipText}>
                {t("domestic_send.predict_send_to_again", {
                  name: topRecipient.name,
                })}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#0A2342" />
            </TouchableOpacity>
          ) : null}

          {/* ============================== */}
          {/* RECIPIENT SECTION              */}
          {/* ============================== */}
          <View style={styles.card}>
            {/* Tabs: Add New / Recent */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, recipientTab === "new" && styles.tabActive]}
                onPress={() => { setRecipientTab("new"); setSelectedRecipient(null); }}
              >
                <Text style={[styles.tabText, recipientTab === "new" && styles.tabTextActive]}>
                  {t("domestic_send.tab_new")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, recipientTab === "recent" && styles.tabActive]}
                onPress={() => setRecipientTab("recent")}
              >
                <Text style={[styles.tabText, recipientTab === "recent" && styles.tabTextActive]}>
                  {t("domestic_send.tab_recent")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recent Recipients */}
            {recipientTab === "recent" && (
              <View style={styles.recentList}>
                {/* Add new / Import contacts — entry tiles at top of list */}
                <View style={styles.addEntryRow}>
                  <TouchableOpacity
                    style={[styles.addEntryTile, styles.addEntryTilePrimary]}
                    onPress={openManualAddRecipient}
                    accessibilityRole="button"
                  >
                    <View style={styles.addRecipientIcon}>
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.addEntryTileText}>
                      {t("send_money.add_new_recipient")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addEntryTile, styles.addEntryTileSecondary]}
                    onPress={() => setShowContactPicker(true)}
                    accessibilityRole="button"
                  >
                    <View style={styles.importContactsIcon}>
                      <Ionicons
                        name="people"
                        size={18}
                        color={"#FFFFFF"}
                      />
                    </View>
                    <Text style={styles.addEntryTileText}>
                      {t("send_money.contact_picker.import_contacts")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Empty state */}
                {recentRecipients.length === 0 ? (
                  <View style={styles.noRecipientsBox}>
                    <Ionicons
                      name="people-outline"
                      size={28}
                      color="#9CA3AF"
                    />
                    <Text style={styles.noRecipientsText}>
                      {t("send_money.no_recent_recipients")}
                    </Text>
                  </View>
                ) : null}

                {recentRecipients.map((recipient) => (
                  <TouchableOpacity
                    key={recipient.id}
                    style={[
                      styles.recipientOption,
                      selectedRecipient?.id === recipient.id && styles.recipientOptionSelected,
                    ]}
                    onPress={() => handleSelectRecipient(recipient)}
                  >
                    <View
                      style={[
                        styles.recipientAvatar,
                        selectedRecipient?.id === recipient.id && styles.recipientAvatarSelected,
                      ]}
                    >
                      <Text style={styles.recipientAvatarText}>{recipient.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.recipientInfo}>
                      <Text style={styles.recipientName}>{recipient.name}</Text>
                      <Text style={styles.recipientIdentifier}>
                        {METHOD_OPTIONS[recipient.method]?.icon} {recipient.identifier}
                      </Text>
                      {/* P2 — surface the last amount sent so the user
                          can decide whether to tap (auto-fill) at a glance. */}
                      {recipient.lastAmountCents && recipient.lastAmountCents > 0 ? (
                        <Text style={styles.recipientLastAmount}>
                          {t("domestic_send.last_amount", {
                            amount: `${CURRENCY_SYMBOL}${(recipient.lastAmountCents / 100).toFixed(2)}`,
                          })}
                        </Text>
                      ) : null}
                    </View>
                    {selectedRecipient?.id === recipient.id && (
                      <Ionicons name="checkmark" size={20} color="#00C6AE" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Add New Recipient */}
            {recipientTab === "new" && (
              <>
                {/* Send Method Selection */}
                <View style={styles.sectionGroup}>
                  <Text style={styles.label}>{t("domestic_send.send_via")}</Text>
                  <View style={styles.methodGrid}>
                    {Object.values(METHOD_OPTIONS).map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.methodCard,
                          selectedMethod === method.id && styles.methodCardSelected,
                        ]}
                        onPress={() => handleMethodChange(method.id)}
                      >
                        {method.badgeKey && (
                          <View style={styles.methodBadge}>
                            <Text style={styles.methodBadgeText}>{t(method.badgeKey)}</Text>
                          </View>
                        )}
                        <View style={styles.methodCardRow}>
                          <Text style={styles.methodIcon}>{method.icon}</Text>
                          <View style={styles.flex1}>
                            <Text
                              style={[
                                styles.methodName,
                                selectedMethod === method.id && styles.methodNameSelected,
                              ]}
                            >
                              {t(method.nameKey)}
                            </Text>
                            <Text
                              style={[
                                styles.methodFee,
                                method.fee === 0 && styles.methodFeeFree,
                              ]}
                            >
                              {method.fee === 0
                                ? t("domestic_send.fee_free")
                                : t("domestic_send.fee_with_currency", {
                                    symbol: CURRENCY_SYMBOL,
                                    fee: method.fee,
                                  })}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Recipient Name */}
                <View style={styles.sectionGroup}>
                  <Text style={styles.label}>{t("domestic_send.recipient_name")}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    placeholder={t("domestic_send.recipient_name_placeholder")}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* WALLET FIELDS */}
                {selectedMethod === "wallet" && (
                  <View style={styles.sectionGroup}>
                    <Text style={styles.label}>{t("domestic_send.wallet_phone_or_username")}</Text>
                    <View style={styles.lookupRow}>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.flex1,
                          walletUserFound && styles.textInputSuccess,
                        ]}
                        value={walletLookup}
                        onChangeText={setWalletLookup}
                        placeholder={t("domestic_send.wallet_phone_or_username_placeholder")}
                        placeholderTextColor="#9CA3AF"
                      />
                      {isLookingUp && (
                        <View style={styles.lookupIndicator}>
                          <ActivityIndicator size="small" color="#00C6AE" />
                        </View>
                      )}
                      {walletUserFound && (
                        <View style={styles.lookupIndicator}>
                          <Ionicons name="checkmark" size={20} color="#00C6AE" />
                        </View>
                      )}
                    </View>

                    {walletUserFound && (
                      <View style={styles.walletUserCard}>
                        <View style={styles.walletUserAvatar}>
                          <Text style={styles.walletUserAvatarText}>
                            {walletUserFound.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.flex1}>
                          <Text style={styles.walletUserName}>
                            {walletUserFound.name}
                          </Text>
                          <Text style={styles.walletUserUsername}>
                            {walletUserFound.phone}
                          </Text>
                        </View>
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>{t("domestic_send.wallet_verified_badge")}</Text>
                        </View>
                      </View>
                    )}
                    {!walletUserFound && !isLookingUp && lookupNoMatch && (
                      <Text style={styles.lookupNoMatchHint}>
                        {t("domestic_send.lookup_no_match")}
                      </Text>
                    )}
                  </View>
                )}

                {/* BANK FIELDS */}
                {selectedMethod === "bank" && (
                  <>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>{t("domestic_send.bank_label")}</Text>
                      <TouchableOpacity
                        style={[styles.pickerButton, selectedBank && styles.pickerButtonSelected]}
                        onPress={() => setShowBankPicker(true)}
                      >
                        <Text style={[styles.pickerText, !selectedBank && styles.pickerPlaceholder]}>
                          {selectedBank || t("domestic_send.bank_select")}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>{t("domestic_send.account_number_label")}</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.monoInput,
                          accountNumber.length === 10 && styles.textInputSuccess,
                        ]}
                        value={accountNumber}
                        onChangeText={(v) => setAccountNumber(v.replace(/\D/g, "").slice(0, 10))}
                        placeholder={t("domestic_send.account_number_placeholder")}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                      {/* Progress dots */}
                      <View style={styles.progressDots}>
                        {[...Array(10)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.progressPip,
                              i < accountNumber.length && styles.progressPipFilled,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </>
                )}

                {/* MOBILE MONEY FIELDS */}
                {selectedMethod === "mobile" && (
                  <>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>{t("domestic_send.network_label")}</Text>
                      <View style={styles.networkRow}>
                        {MOBILE_NETWORKS.map((network) => (
                          <TouchableOpacity
                            key={network.id}
                            style={[
                              styles.networkCard,
                              selectedNetwork === network.name && styles.networkCardSelected,
                            ]}
                            onPress={() => setSelectedNetwork(network.name)}
                          >
                            <View style={[styles.networkDot, { backgroundColor: network.color }]} />
                            <Text
                              style={[
                                styles.networkName,
                                selectedNetwork === network.name && styles.networkNameSelected,
                              ]}
                            >
                              {network.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>{t("domestic_send.phone_label")}</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.monoInput,
                          validatePhoneNumber(phoneNumber) && styles.textInputSuccess,
                        ]}
                        value={phoneNumber}
                        onChangeText={(v) => setPhoneNumber(v.replace(/[^0-9+]/g, "").slice(0, 14))}
                        placeholder={t("domestic_send.phone_placeholder_ng")}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </>
                )}

                {/* CASH PICKUP FIELDS */}
                {selectedMethod === "cash" && (
                  <View style={styles.sectionGroup}>
                    <Text style={styles.label}>{t("domestic_send.pickup_label")}</Text>
                    <TouchableOpacity
                      style={[styles.pickerButton, selectedLocation && styles.pickerButtonSelected]}
                      onPress={() => setShowLocationPicker(true)}
                    >
                      <View style={styles.pickerLeftRow}>
                        <Text style={styles.pickerEmoji}>{"\u{1F4CD}"}</Text>
                        <Text style={[styles.pickerText, !selectedLocation && styles.pickerPlaceholder]}>
                          {selectedLocation || t("domestic_send.pickup_select")}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ============================== */}
          {/* AMOUNT SECTION                 */}
          {/* ============================== */}
          <View style={[styles.card, numericAmount > userBalance && styles.cardError]}>
            <Text style={styles.cardTitle}>{t("domestic_send.card_amount")}</Text>
            <View style={styles.amountInputRow}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyFlag}>{COUNTRY_FLAG}</Text>
                <Text style={styles.currencySymbolText}>{CURRENCY_SYMBOL}</Text>
              </View>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>

            {numericAmount > userBalance && (
              <View style={styles.errorBar}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorBarText}>
                  {t("domestic_send.exceeds_balance", {
                    symbol: CURRENCY_SYMBOL,
                    balance: formatCurrency(userBalance),
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* ============================== */}
          {/* PAY FROM                       */}
          {/* ============================== */}
          {/* Moved above the Summary so users see the funding source
              before committing — the Stripe path opens a payment sheet
              while the Wallet path doesn't; this is load-bearing context. */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("domestic_send.pay_from")}</Text>

            {/* Wallet option */}
            <TouchableOpacity
              style={[styles.payFromOption, fundingSource === "wallet" && styles.payFromOptionSelected]}
              onPress={() => setFundingSource("wallet")}
              activeOpacity={0.7}
            >
              <View style={[styles.payFromRadio, fundingSource === "wallet" && styles.payFromRadioSelected]}>
                {fundingSource === "wallet" && <View style={styles.payFromRadioDot} />}
              </View>
              <Ionicons name="wallet" size={20} color={fundingSource === "wallet" ? "#00C6AE" : "#6B7280"} />
              <View style={styles.payFromInfo}>
                <Text style={[styles.payFromLabel, fundingSource === "wallet" && styles.payFromLabelSelected]}>{t("domestic_send.tandaxn_wallet")}</Text>
                <Text style={styles.payFromSub}>{CURRENCY_SYMBOL}{formatCurrency(userBalance)} {t("domestic_send.available_suffix")}</Text>
              </View>
            </TouchableOpacity>

            {/* Saved Stripe payment methods */}
            {paymentMethods.map((pm) => (
              <TouchableOpacity
                key={pm.id}
                style={[styles.payFromOption, fundingSource === pm.id && styles.payFromOptionSelected]}
                onPress={() => setFundingSource(pm.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.payFromRadio, fundingSource === pm.id && styles.payFromRadioSelected]}>
                  {fundingSource === pm.id && <View style={styles.payFromRadioDot} />}
                </View>
                <Ionicons name={pm.icon as any} size={20} color={fundingSource === pm.id ? "#00C6AE" : "#6B7280"} />
                <View style={styles.payFromInfo}>
                  <Text style={[styles.payFromLabel, fundingSource === pm.id && styles.payFromLabelSelected]}>{pm.label}</Text>
                  {pm.isDefault && <Text style={styles.payFromDefault}>{t("domestic_send.pm_default")}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ============================== */}
          {/* TRANSFER SUMMARY               */}
          {/* ============================== */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("domestic_send.card_summary")}</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("domestic_send.summary_amount")}</Text>
              <Text style={styles.summaryValue}>
                {CURRENCY_SYMBOL}{numericAmount > 0 ? formatCurrency(numericAmount) : "0.00"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLabelRow}>
                <Text style={styles.summaryLabel}>{t("domestic_send.summary_fee")}</Text>
                <Text style={styles.summaryLabelIcon}>{currentMethod?.icon}</Text>
              </View>
              <Text style={[styles.summaryValue, currentFee === 0 && styles.summaryValueFree]}>
                {currentFee === 0 ? t("domestic_send.summary_free") : `${CURRENCY_SYMBOL}${currentFee.toFixed(2)}`}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>{t("domestic_send.summary_total")}</Text>
              <Text style={styles.summaryTotalValue}>
                {CURRENCY_SYMBOL}{numericAmount > 0 ? formatCurrency(totalToPay) : "0.00"}
              </Text>
            </View>

            {/* Delivery info */}
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryIcon}>{currentMethod?.icon}</Text>
              <Text style={styles.deliveryText}>
                {currentMethod ? t(currentMethod.nameKey) : ""} {"\u2022"} {currentMethod ? t(currentMethod.estimateKey) : ""}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* ============================== */}
        {/* SEND BUTTON                    */}
        {/* ============================== */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.sendButton, (!isFormValid() || isProcessing) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!isFormValid() || isProcessing}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendButtonText, (!isFormValid() || isProcessing) && styles.sendButtonTextDisabled]}>
              {isProcessing
                ? t("domestic_send.btn_sending")
                : numericAmount > 0
                  ? currentFee === 0
                    ? t("domestic_send.btn_send_amount_free", { amount: `${CURRENCY_SYMBOL}${formatCurrency(totalToPay)}` })
                    : t("domestic_send.btn_send_amount", { amount: `${CURRENCY_SYMBOL}${formatCurrency(totalToPay)}` })
                  : t("domestic_send.btn_send_money")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ============================== */}
      {/* ADD NEW RECIPIENT MODAL        */}
      {/* ============================== */}
      <NewRecipientModal
        visible={showAddRecipient}
        userId={user?.id}
        onClose={() => {
          setShowAddRecipient(false);
          setRecipientPrefill(undefined);
        }}
        onSaved={(saved) => {
          refetchRecipients();
          // Auto-select the just-added recipient so the user can proceed.
          setSelectedRecipient(toLegacyRecipient(saved));
          setRecipientTab("recent");
          setRecipientPrefill(undefined);
        }}
        initialName={recipientPrefill?.name}
        initialIdentifier={recipientPrefill?.identifier}
        initialMethod={recipientPrefill?.method}
      />

      {/* ============================== */}
      {/* CONTACT PICKER MODAL           */}
      {/* ============================== */}
      <ContactPickerModal
        visible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onContactPicked={(contact) => {
          setShowContactPicker(false);
          handleContactPicked(contact);
        }}
      />

      {/* ============================== */}
      {/* BANK PICKER MODAL              */}
      {/* ============================== */}
      <Modal visible={showBankPicker} animationType="slide" transparent onRequestClose={() => setShowBankPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("domestic_send.modal_select_bank")}</Text>
              <TouchableOpacity onPress={() => setShowBankPicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {BANKS.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  style={[styles.modalOption, selectedBank === bank.name && styles.modalOptionSelected]}
                  onPress={() => { setSelectedBank(bank.name); setShowBankPicker(false); }}
                >
                  <Text style={styles.modalOptionEmoji}>{"\u{1F3E6}"}</Text>
                  <Text style={styles.modalOptionText}>{bank.name}</Text>
                  {selectedBank === bank.name && <Ionicons name="checkmark" size={18} color="#00C6AE" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================== */}
      {/* LOCATION PICKER MODAL          */}
      {/* ============================== */}
      <Modal visible={showLocationPicker} animationType="slide" transparent onRequestClose={() => setShowLocationPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("domestic_send.modal_select_pickup")}</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {PICKUP_LOCATIONS.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[styles.modalOption, selectedLocation === location.name && styles.modalOptionSelected]}
                  onPress={() => { setSelectedLocation(location.name); setShowLocationPicker(false); }}
                >
                  <Text style={styles.modalOptionEmoji}>{"\u{1F4CD}"}</Text>
                  <View style={styles.flex1}>
                    <Text style={styles.modalOptionText}>{location.name}</Text>
                    <Text style={styles.modalOptionSub}>{location.address}</Text>
                  </View>
                  {selectedLocation === location.name && <Ionicons name="checkmark" size={18} color="#00C6AE" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  flex1: { flex: 1 },

  // Header
  header: { paddingTop: Platform.OS === "android" ? 40 : 0, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  placeholder: { width: 40 },
  balanceCard: { padding: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14 },
  balanceLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  balanceAmount: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginTop: 6 },

  // Scroll
  scrollContent: { padding: 20, paddingBottom: 120 },

  // Scope toggle (Domestic / International) — replaces the old chooser
  // screen. Renders inline at the top of the form so the user can swap
  // scopes without a back+forward navigation.
  scopeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  scopeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  scopeChipActive: { backgroundColor: "#0A2342" },
  scopeChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  scopeChipTextActive: { color: "#FFFFFF" },

  // P2 — "Send to {name} again?" prediction chip. Soft teal background so
  // it reads as an offer, not a primary call to action.
  predictionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#00C6AE",
    marginBottom: 12,
  },
  predictionChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
  },

  // Inline hint shown under the wallet lookup input when the typed
  // phone number didn't match any TandaXn profile.
  lookupNoMatchHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    fontStyle: "italic",
  },

  // Cards
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  cardError: { borderWidth: 2, borderColor: "#DC2626" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 14 },

  // Tabs
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 16, backgroundColor: "#F5F7FA", borderRadius: 10, padding: 4 },
  tab: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#0A2342" },

  // Recent list
  recentList: { gap: 10 },
  addRecipientBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#00C6AE",
    borderStyle: "dashed",
  },
  addEntryRow: {
    flexDirection: "row",
    gap: 8,
  },
  addEntryTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addEntryTilePrimary: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
  },
  addEntryTileSecondary: {
    backgroundColor: "#EEF2FF",
    borderColor: "#0A2342",
  },
  addEntryTileText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
  },
  importContactsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0A2342",
    alignItems: "center",
    justifyContent: "center",
  },
  addRecipientIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  addRecipientText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  noRecipientsBox: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    gap: 8,
  },
  noRecipientsText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  recipientOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#F5F7FA", borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
  recipientOptionSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  recipientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  recipientAvatarSelected: { backgroundColor: "#00C6AE" },
  recipientAvatarText: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },
  recipientInfo: { flex: 1 },
  recipientName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  recipientIdentifier: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  recipientLastAmount: { fontSize: 11, color: "#00897B", marginTop: 2, fontWeight: "600" },

  // Section group
  sectionGroup: { marginBottom: 14 },
  label: { fontSize: 12, color: "#6B7280", marginBottom: 6 },

  // Method grid
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodCard: { width: "48%" as any, padding: 12, backgroundColor: "#F5F7FA", borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  methodCardSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  methodBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "#00C6AE", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  methodBadgeText: { fontSize: 8, fontWeight: "700", color: "#FFFFFF" },
  methodCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  methodIcon: { fontSize: 20 },
  methodName: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  methodNameSelected: { color: "#00897B" },
  methodFee: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  methodFeeFree: { color: "#00C6AE", fontWeight: "600" },

  // Text input
  textInput: { backgroundColor: "#F5F7FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB" },
  textInputSuccess: { borderWidth: 2, borderColor: "#00C6AE", backgroundColor: "#F0FDFB" },
  monoInput: { fontSize: 16, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 2 },

  // Wallet lookup
  lookupRow: { position: "relative" },
  lookupIndicator: { position: "absolute", right: 12, top: 12 },

  // Wallet user found
  walletUserCard: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 12, backgroundColor: "#F0FDFB", borderRadius: 10 },
  walletUserAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#00C6AE", alignItems: "center", justifyContent: "center" },
  walletUserAvatarText: { color: "#FFFFFF", fontWeight: "600" },
  walletUserName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  walletUserUsername: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  verifiedBadge: { backgroundColor: "#D1FAE5", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontSize: 9, fontWeight: "600", color: "#059669" },

  // Picker buttons
  pickerButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F5F7FA", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  pickerButtonSelected: { borderWidth: 2, borderColor: "#00C6AE" },
  pickerText: { fontSize: 14, color: "#0A2342" },
  pickerPlaceholder: { color: "#9CA3AF" },
  pickerLeftRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pickerEmoji: { fontSize: 18 },

  // Account progress dots
  progressDots: { flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 10 },
  progressPip: { width: 18, height: 5, borderRadius: 2.5, backgroundColor: "#E5E7EB" },
  progressPipFilled: { backgroundColor: "#00C6AE" },

  // Network row
  networkRow: { flexDirection: "row", gap: 8 },
  networkCard: { flex: 1, padding: 10, backgroundColor: "#F5F7FA", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  networkCardSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  networkDot: { width: 24, height: 24, borderRadius: 12, marginBottom: 4 },
  networkName: { fontSize: 10, fontWeight: "500", color: "#6B7280" },
  networkNameSelected: { color: "#00897B" },

  // Amount
  amountInputRow: { flexDirection: "row", alignItems: "center", padding: 4, backgroundColor: "#F5F7FA", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  currencyBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#FFFFFF", borderRadius: 8 },
  currencyFlag: { fontSize: 16 },
  currencySymbolText: { fontSize: 18, fontWeight: "700", color: "#0A2342" },
  amountInput: { flex: 1, fontSize: 32, fontWeight: "700", color: "#0A2342", textAlign: "right", paddingHorizontal: 14, paddingVertical: 14 },

  // Error
  errorBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, backgroundColor: "#FEE2E2", borderRadius: 8 },
  errorBarText: { fontSize: 12, color: "#DC2626" },

  // Summary
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryLabelIcon: { fontSize: 16 },
  summaryValue: { fontSize: 13, fontWeight: "500", color: "#0A2342" },
  summaryValueFree: { color: "#00C6AE", fontWeight: "600" },
  summaryDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  summaryTotalLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  summaryTotalValue: { fontSize: 20, fontWeight: "700", color: "#0A2342" },
  deliveryInfo: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, padding: 10, backgroundColor: "#F0FDFB", borderRadius: 8 },
  deliveryIcon: { fontSize: 16 },
  deliveryText: { fontSize: 12, color: "#065F46" },

  // Bottom bar
  bottomBar: { padding: 16, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 34 : 20, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  sendButton: { backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { backgroundColor: "#E5E7EB" },
  sendButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  sendButtonTextDisabled: { color: "#9CA3AF" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(10,35,66,0.8)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "60%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342" },
  modalClose: { padding: 4 },
  modalOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#F5F7FA", borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "transparent" },
  modalOptionSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  modalOptionEmoji: { fontSize: 20 },
  modalOptionText: { flex: 1, fontSize: 14, fontWeight: "500", color: "#0A2342" },
  modalOptionSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  // Pay From
  payFromContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  payFromTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 10 },
  payFromOption: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, padding: 14, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 8 },
  payFromOptionSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  payFromRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center" as const, justifyContent: "center" as const },
  payFromRadioSelected: { borderColor: "#00C6AE" },
  payFromRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#00C6AE" },
  payFromInfo: { flex: 1 },
  payFromLabel: { fontSize: 14, fontWeight: "500" as const, color: "#0A2342" },
  payFromLabelSelected: { fontWeight: "600" as const, color: "#00897B" },
  payFromSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  payFromDefault: { fontSize: 10, fontWeight: "600" as const, color: "#00C6AE", marginTop: 2 },
});
