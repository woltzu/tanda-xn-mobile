import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { showToast } from "../components/Toast";
import { WALLET_NUDGE_THRESHOLD_USD } from "../lib/kycTiers";

export type Transaction = {
  id: string;
  type: "received" | "sent" | "converted" | "added" | "withdrawn" | "contribution" | "payout" | "remittance";
  description: string;
  amount: number;
  currency: string;
  date: string;
  flag?: string;
  recipientName?: string;
  method?: string;
  // Cross-border specific fields
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  convertedAmount?: number;
  convertedCurrency?: string;
  circleId?: string;
  circleName?: string;
};

export type WalletCurrency = {
  code: string;
  name: string;
  flag: string;
  symbol: string;
  balance: number;
  usdValue?: number;
  rate?: number;
  change?: number;
  isActive: boolean;
};

type WalletContextType = {
  balance: number;
  currencies: WalletCurrency[];
  transactions: Transaction[];
  isLoading: boolean;
  // Funds management
  addFunds: (amount: number, method: string, currency?: string) => Promise<string>;
  withdraw: (amount: number, method: string, currency?: string) => Promise<string>;
  sendMoney: (
    amount: number,
    recipientName: string,
    method: string,
    options: {
      currency: string;
      recipientIdentifier: string;
      fundingSource: "wallet" | "stripe";
      feeCents?: number;
      stripePaymentIntentId?: string | null;
    }
  ) => Promise<string>;
  // Multi-currency operations
  addCurrencyWallet: (currencyCode: string) => Promise<void>;
  removeCurrencyWallet: (currencyCode: string) => Promise<void>;
  convertBetweenWallets: (amount: number, fromCurrency: string, toCurrency: string, rate: number) => Promise<string>;
  getCurrencyBalance: (currencyCode: string) => number;
  // Circle contributions
  makeContribution: (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string,
    targetCurrency?: string,
    exchangeRate?: number
  ) => Promise<string>;
  receivePayout: (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string
  ) => Promise<string>;
  // Remittance
  sendRemittance: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    recipientName: string,
    recipientCountry: string,
    exchangeRate: number,
    fee: number
  ) => Promise<string>;
  refreshWallet: () => Promise<void>;
};

// New users start with $0 across all default wallets
const DEFAULT_CURRENCIES: WalletCurrency[] = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$", balance: 0, change: 0, isActive: true },
];

// No default transactions for new users
const DEFAULT_TRANSACTIONS: Transaction[] = [];

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};

const STORAGE_KEY = "@tandaxn_wallet";

// Currency info for adding new wallets
const CURRENCY_INFO: Record<string, { name: string; flag: string; symbol: string }> = {
  USD: { name: "US Dollar", flag: "🇺🇸", symbol: "$" },
  EUR: { name: "Euro", flag: "🇪🇺", symbol: "€" },
  GBP: { name: "British Pound", flag: "🇬🇧", symbol: "£" },
  CAD: { name: "Canadian Dollar", flag: "🇨🇦", symbol: "C$" },
  XOF: { name: "West African CFA", flag: "🇸🇳", symbol: "CFA" },
  XAF: { name: "Central African CFA", flag: "🇨🇲", symbol: "FCFA" },
  NGN: { name: "Nigerian Naira", flag: "🇳🇬", symbol: "₦" },
  GHS: { name: "Ghanaian Cedi", flag: "🇬🇭", symbol: "GH₵" },
  KES: { name: "Kenyan Shilling", flag: "🇰🇪", symbol: "KSh" },
  TZS: { name: "Tanzanian Shilling", flag: "🇹🇿", symbol: "TSh" },
  UGX: { name: "Ugandan Shilling", flag: "🇺🇬", symbol: "USh" },
  ZAR: { name: "South African Rand", flag: "🇿🇦", symbol: "R" },
  JMD: { name: "Jamaican Dollar", flag: "🇯🇲", symbol: "J$" },
  TTD: { name: "Trinidad Dollar", flag: "🇹🇹", symbol: "TT$" },
  HTG: { name: "Haitian Gourde", flag: "🇭🇹", symbol: "G" },
  MXN: { name: "Mexican Peso", flag: "🇲🇽", symbol: "MX$" },
  CHF: { name: "Swiss Franc", flag: "🇨🇭", symbol: "CHF" },
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [currencies, setCurrencies] = useState<WalletCurrency[]>(DEFAULT_CURRENCIES);
  const [transactions, setTransactions] = useState<Transaction[]>(DEFAULT_TRANSACTIONS);
  const [isLoading, setIsLoading] = useState(true);

  // P0 (kyc-trigger review): read the auth-level kyc projection. The
  // KYCGate components on each money screen are the primary defense;
  // this closure is a server-side safety net inside sendMoney for
  // any future call site that bypasses the screen (deep link,
  // automation, retry from a notification handler, etc.).
  const { user } = useAuth();

  // P2 (kyc-trigger review): one-time threshold nudge. When the user's
  // USD-equivalent wallet balance crosses the nudge threshold AND they
  // haven't been nudged in the last 7 days AND they're not approved,
  // we fire a non-modal toast. The persistent Home banner from P1
  // still owns the actionable "Verify now" tap; this toast is just the
  // wake-up that draws the user's attention to it.
  //
  // initialBalanceSettleRef gates the first useEffect run so the
  // 0 → real-balance cold-start jump doesn't fire a phantom nudge
  // for users who already had funds in their wallet.
  const initialBalanceSettleRef = useRef(true);

  // Calculate total balance in USD
  const balance = currencies.reduce((total, curr) => {
    if (!curr.isActive) return total;
    if (curr.code === "USD") return total + curr.balance;
    return total + (curr.usdValue || 0);
  }, 0);

  // P2 (kyc-trigger review): threshold-crossing nudge. Runs whenever
  // balance / user / kyc.status changes. Each branch short-circuits
  // so the common case (verified user, low balance, recently nudged)
  // is two reads against AuthContext and one ref read.
  useEffect(() => {
    if (initialBalanceSettleRef.current) {
      initialBalanceSettleRef.current = false;
      return;
    }
    if (!user?.id) return;
    if (user.kyc?.status === "approved") return;
    if (balance < WALLET_NUDGE_THRESHOLD_USD) return;

    const NUDGE_KEY = "@tandaxn_kyc_nudge_last_shown";
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    let cancelled = false;
    (async () => {
      try {
        const lastRaw = await AsyncStorage.getItem(NUDGE_KEY);
        const lastMs = lastRaw ? new Date(lastRaw).getTime() : 0;
        const now = new Date();
        if (now.getTime() - lastMs < SEVEN_DAYS_MS) return;
        if (cancelled) return;
        await AsyncStorage.setItem(NUDGE_KEY, now.toISOString());
        showToast(i18n.t("kyc_nudge.toast"), "info", 5000);
      } catch (e) {
        console.warn(
          "[WalletContext] kyc threshold nudge skipped:",
          (e as Error)?.message ?? "unknown",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, user?.id, user?.kyc?.status]);

  // Load wallet data from storage on mount, then reconcile USD balance
  // against the user's Supabase user_wallets row so the UI reflects
  // authoritative server state (and not just a stale AsyncStorage snapshot).
  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      // 1. Seed from AsyncStorage for instant first render
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      let seedCurrencies: WalletCurrency[] | null = null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.currencies) {
          seedCurrencies = parsed.currencies;
          setCurrencies(parsed.currencies);
        }
        if (parsed.transactions) setTransactions(parsed.transactions);
      }

      // 2. Reconcile USD balance from user_wallets in Supabase.
      //    maybeSingle() so a missing row doesn't 406 the console.
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      console.log("[WalletContext] loadWalletData", { hasSession: !!uid, userId: uid });
      if (!uid) return;

      const { data: walletRow, error: walletErr } = await supabase
        .from("user_wallets")
        .select("main_balance_cents, reserved_balance_cents, available_balance_cents")
        .eq("user_id", uid)
        .maybeSingle();

      console.log("[WalletContext] user_wallets fetch", {
        userId: uid,
        hasRow: !!walletRow,
        main_balance_cents: walletRow?.main_balance_cents,
        error: walletErr
          ? { code: walletErr.code, message: walletErr.message, details: walletErr.details, hint: walletErr.hint }
          : null,
      });

      if (walletErr || !walletRow) return;

      const mainDollars = (walletRow.main_balance_cents ?? 0) / 100;
      const base = seedCurrencies ?? DEFAULT_CURRENCIES;
      const hasUSD = base.some((c) => c.code === "USD");
      const nextCurrencies: WalletCurrency[] = hasUSD
        ? base.map((c) => (c.code === "USD" ? { ...c, balance: mainDollars } : c))
        : [{ code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$", balance: mainDollars, change: 0, isActive: true }, ...base];
      setCurrencies(nextCurrencies);
    } catch (error) {
      console.error("Error loading wallet data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWalletData = async (newCurrencies: WalletCurrency[], newTransactions: Transaction[]) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currencies: newCurrencies, transactions: newTransactions })
      );
      setCurrencies(newCurrencies);
      setTransactions(newTransactions);
    } catch (error) {
      console.error("Error saving wallet data:", error);
      throw error;
    }
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const generateTransactionId = () => `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addFunds = async (amount: number, method: string, currency: string = "USD"): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    const newTransaction: Transaction = {
      id: transactionId,
      type: "added",
      description: `Added via ${method}`,
      amount: amount,
      currency: currency,
      date: formatDate(),
      method,
      flag: currencyInfo.flag,
    };

    // Update currency balance
    let newCurrencies = [...currencies];
    const currencyIndex = newCurrencies.findIndex(c => c.code === currency);

    if (currencyIndex >= 0) {
      newCurrencies[currencyIndex] = {
        ...newCurrencies[currencyIndex],
        balance: newCurrencies[currencyIndex].balance + amount,
      };
    } else {
      // Add new currency wallet if doesn't exist
      const info = CURRENCY_INFO[currency];
      if (info) {
        newCurrencies.push({
          code: currency,
          name: info.name,
          flag: info.flag,
          symbol: info.symbol,
          balance: amount,
          isActive: true,
        });
      }
    }

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);

    // Credit user_wallets.main_balance_cents so the DB balance moves
    // with the UI. Previously addFunds only touched AsyncStorage — the
    // Home + Wallet screens both reconcile against user_wallets on
    // focus via loadWalletData(), so the DB's stale row snapped the
    // balance back to the pre-deposit value the moment the user
    // returned from the receipt screen. Mirrors makeContribution's
    // debit pattern below (line 700+): read current cents, add, write.
    // USD-only for now; the DB balance is a single main_balance_cents
    // column and doesn't carry non-USD ledgers.
    try {
      if (currency === "USD") {
        const amountCents = Math.round(amount * 100);
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (uid) {
          const { data: walletRow, error: readErr } = await supabase
            .from("user_wallets")
            .select("main_balance_cents")
            .eq("user_id", uid)
            .maybeSingle();
          if (readErr || !walletRow) {
            console.warn("[WalletContext.addFunds] wallet read failed", readErr);
          } else {
            const newBalanceCents = (walletRow.main_balance_cents ?? 0) + amountCents;
            const { error: updErr } = await supabase
              .from("user_wallets")
              .update({ main_balance_cents: newBalanceCents })
              .eq("user_id", uid);
            if (updErr) {
              console.error("[WalletContext.addFunds] wallet update failed", updErr);
            } else {
              console.log("[WalletContext.addFunds] wallet credited", {
                before: walletRow.main_balance_cents, after: newBalanceCents,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[WalletContext.addFunds] server credit error", err);
      // Local state already reflects the deposit; the periodic
      // loadWalletData reconcile will surface any drift.
    }

    // Reconcile from the server so the UI shows the authoritative
    // credited balance right away (also picks up any concurrent
    // webhook credits when we later wire one up).
    try { await loadWalletData(); } catch {}
    return transactionId;
  };

  const withdraw = async (amount: number, method: string, currency: string = "USD"): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    const newTransaction: Transaction = {
      id: transactionId,
      type: "withdrawn",
      description: `Withdrawn to ${method}`,
      amount: -amount,
      currency: currency,
      date: formatDate(),
      method,
      flag: currencyInfo.flag,
    };

    // Update currency balance
    const newCurrencies = currencies.map((c) =>
      c.code === currency ? { ...c, balance: c.balance - amount } : c
    );

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  // Send money — calls the server-side process_send_money RPC (migration 140)
  // which atomically debits user_wallets, resolves the recipient on TandaXn,
  // and records a money_transfers row. Returns the canonical transfer id.
  //
  // The local AsyncStorage transaction list is updated optimistically for
  // a snappy UI, but the authoritative balance comes back from the RPC's
  // new_balance_cents — no drift between client and server.
  const sendMoney = async (
    amount: number,
    recipientName: string,
    method: string,
    options: {
      currency: string;
      recipientIdentifier: string;
      fundingSource: "wallet" | "stripe";
      feeCents?: number;
      stripePaymentIntentId?: string | null;
    }
  ): Promise<string> => {
    // Defensive: if a caller still uses the legacy signature
    // sendMoney(amount, name, method, "USD"), the 4th arg arrives as a
    // STRING instead of an options object. Destructuring it would silently
    // produce undefined for every field — JSON.stringify then drops those
    // keys from the RPC body, and PostgREST fails with PGRST202 because
    // the resulting (4-key) call doesn't match any function signature.
    // Treat a non-object `options` as empty and use ?? fallbacks below.
    const opts =
      options && typeof options === "object" ? options : ({} as typeof options);

    // P0 (kyc-trigger review): defensive gate. KYCGate on the screen
    // is the primary guard; this throw closes the loophole where a
    // call site bypasses the UI (e.g. background retry, deep link).
    // The error code is the contract: any caller that catches this
    // can route the user to the KYCHub instead of surfacing a raw
    // RPC error. Plain text message is intentional — the screens
    // typically translate this themselves before showing the user.
    if (user?.kyc?.status !== "approved") {
      const err = new Error("KYC_REQUIRED") as Error & { code?: string };
      err.code = "KYC_REQUIRED";
      throw err;
    }

    const {
      currency,
      recipientIdentifier,
      fundingSource,
      feeCents = 0,
      stripePaymentIntentId = null,
    } = opts;

    const amountCents = Math.round(amount * 100);

    // Surface incomplete payloads early — easier to debug than chasing
    // PGRST202 in the Metro console.
    if (!currency || !recipientIdentifier || !fundingSource) {
      console.warn("[WalletContext.sendMoney] incomplete options", {
        gotOptionsType: typeof options,
        currency,
        recipientIdentifier,
        fundingSource,
      });
    }

    // 1. Call the RPC — single source of truth. ALL 7 keys must be present
    //    in the JSON body or PostgREST can't resolve the overload. Hence
    //    the `??` fallbacks: the RPC's own input validation then raises a
    //    typed exception (`missing_recipient`, `invalid_method`, etc.)
    //    that surfaces in the catch below — much clearer than PGRST202.
    const { data, error } = await supabase.rpc("process_send_money", {
      p_amount_cents: amountCents,
      p_currency: currency ?? "USD",
      p_recipient_identifier: recipientIdentifier ?? "",
      p_method: method ?? "wallet",
      p_funding_source: fundingSource ?? "wallet",
      p_fee_cents: feeCents ?? 0,
      p_stripe_intent_id: stripePaymentIntentId ?? null,
    });

    if (error) {
      console.error("[WalletContext.sendMoney] RPC failed", error);
      // Surface a human-readable message for known failure codes that the
      // RPC raises. Falls back to the generic error.message.
      const code = (error.message || "").toLowerCase();
      if (code.includes("insufficient_funds")) {
        throw new Error("insufficient_funds");
      }
      if (code.includes("auth_required")) {
        throw new Error("auth_required");
      }
      throw new Error(error.message || "send_failed");
    }

    const row = Array.isArray(data) ? data[0] : data;
    const transferId: string = row?.transfer_id ?? generateTransactionId();
    const newBalanceCents: number | null =
      typeof row?.new_balance_cents === "number" ? row.new_balance_cents : null;

    console.log("[WalletContext.sendMoney] RPC returned", {
      transferId,
      newBalanceCents,
      recipientMatched: row?.recipient_matched,
      currency,
      fundingSource,
    });

    // 2. Update the USD row from the RPC's authoritative balance.
    //    `user_wallets.main_balance_cents` IS the USD wallet — the RPC's
    //    new_balance_cents is therefore always the new USD balance,
    //    regardless of the SEND currency. Failing to update USD here is
    //    what caused the "balance unchanged after send" bug — the prior
    //    code keyed the local update on `c.code === currency`, so an
    //    NGN-denominated send never updated the USD row the user actually
    //    sees on screen.
    //
    //    Non-USD rows (when multi-currency lands) get an optimistic local
    //    debit for fast UI feedback; loadWalletData() at the end is the
    //    safety net.
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };
    const newCurrencies = currencies.map((c) => {
      if (c.code === "USD") {
        if (newBalanceCents !== null) {
          return { ...c, balance: newBalanceCents / 100 };
        }
        if (fundingSource === "wallet" && currency === "USD") {
          return { ...c, balance: c.balance - amount - feeCents / 100 };
        }
        return c;
      }
      if (c.code === currency && fundingSource === "wallet" && currency !== "USD") {
        return {
          ...c,
          balance: Math.max(0, c.balance - amount - feeCents / 100),
        };
      }
      return c;
    });

    // 3. Append the local transaction record for the activity log.
    const newTransaction: Transaction = {
      id: transferId,
      type: "sent",
      description: `To ${recipientName}`,
      amount: -amount,
      currency,
      date: formatDate(),
      recipientName,
      method,
      flag: currencyInfo.flag,
    };

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);

    // Phase 2 of Circle Contribution Autopay — round-up sweep. After
    // a successful wallet-funded send, hand the cents-to-next-dollar
    // delta to apply_round_up_to_circle_autopay (migration 173) so it
    // credits the soonest active autopay config that has round_up
    // enabled. Best-effort: any failure here is non-fatal — the send
    // already succeeded.
    if (fundingSource === "wallet") {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (uid) {
          await supabase.rpc("apply_round_up_to_circle_autopay", {
            p_user_id: uid,
            p_debit_amount_cents: amountCents + (feeCents ?? 0),
          });
        }
      } catch (err) {
        console.warn(
          "[WalletContext.sendMoney] round-up sweep failed (continuing)",
          err,
        );
      }
    }

    // 4. Server reconciliation — guarantees the on-screen balance matches
    //    what the DB now holds. Idempotent and cheap; mirrors the pattern
    //    in makeContribution(). Without this, any RPC that returns an
    //    unexpected shape (or a NULL new_balance_cents) leaves the UI
    //    stale. Best-effort — a reconciliation failure must not fail the
    //    send.
    try {
      await loadWalletData();
    } catch (err) {
      console.warn("[WalletContext.sendMoney] post-send reconcile failed", err);
    }

    return transferId;
  };

  const addCurrencyWallet = async (currencyCode: string): Promise<void> => {
    // Check if already exists
    if (currencies.some(c => c.code === currencyCode)) {
      // Just activate it if it exists
      const newCurrencies = currencies.map(c =>
        c.code === currencyCode ? { ...c, isActive: true } : c
      );
      await saveWalletData(newCurrencies, transactions);
      return;
    }

    const info = CURRENCY_INFO[currencyCode];
    if (!info) {
      throw new Error(`Currency ${currencyCode} not supported`);
    }

    const newWallet: WalletCurrency = {
      code: currencyCode,
      name: info.name,
      flag: info.flag,
      symbol: info.symbol,
      balance: 0,
      isActive: true,
    };

    const newCurrencies = [...currencies, newWallet];
    await saveWalletData(newCurrencies, transactions);
  };

  const removeCurrencyWallet = async (currencyCode: string): Promise<void> => {
    // Don't allow removing USD
    if (currencyCode === "USD") {
      throw new Error("Cannot remove primary USD wallet");
    }

    // Just deactivate, don't delete (to preserve history)
    const newCurrencies = currencies.map(c =>
      c.code === currencyCode ? { ...c, isActive: false } : c
    );
    await saveWalletData(newCurrencies, transactions);
  };

  const convertBetweenWallets = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rate: number
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const convertedAmount = amount * rate;

    const newTransaction: Transaction = {
      id: transactionId,
      type: "converted",
      description: `${fromCurrency} → ${toCurrency}`,
      amount: convertedAmount,
      currency: toCurrency,
      date: formatDate(),
      originalAmount: amount,
      originalCurrency: fromCurrency,
      exchangeRate: rate,
      convertedAmount: convertedAmount,
      convertedCurrency: toCurrency,
    };

    // Update both currency balances
    const newCurrencies = currencies.map((c) => {
      if (c.code === fromCurrency) {
        return { ...c, balance: c.balance - amount };
      }
      if (c.code === toCurrency) {
        return { ...c, balance: c.balance + convertedAmount };
      }
      return c;
    });

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const getCurrencyBalance = (currencyCode: string): number => {
    const currency = currencies.find(c => c.code === currencyCode);
    return currency?.balance || 0;
  };

  const makeContribution = async (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string,
    targetCurrency?: string,
    exchangeRate?: number
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    // Handle cross-border contribution with conversion
    let convertedAmount = amount;
    let finalCurrency = currency;

    if (targetCurrency && targetCurrency !== currency && exchangeRate) {
      convertedAmount = amount * exchangeRate;
      finalCurrency = targetCurrency;
    }

    const newTransaction: Transaction = {
      id: transactionId,
      type: "contribution",
      description: `Circle: ${circleName}`,
      amount: -amount,
      currency: currency,
      date: formatDate(),
      flag: currencyInfo.flag,
      circleId,
      circleName,
      ...(targetCurrency && targetCurrency !== currency ? {
        originalAmount: amount,
        originalCurrency: currency,
        exchangeRate,
        convertedAmount,
        convertedCurrency: targetCurrency,
      } : {}),
    };

    // 1. Optimistic local update — keep the UI snappy and write
    //    AsyncStorage transaction history
    const newCurrencies = currencies.map((c) =>
      c.code === currency ? { ...c, balance: c.balance - amount } : c
    );
    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);

    // 2. Persist the deduction to user_wallets on the server so that
    //    loadWalletData() (which reconciles USD against the DB on mount
    //    or refreshWallet) doesn't snap the balance back to the pre-
    //    contribution value. USD amounts only — non-USD contributions
    //    skip server reconciliation since the DB only tracks USD cents.
    try {
      if (currency === "USD") {
        const amountCents = Math.round(amount * 100);
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        console.log("[WalletContext.makeContribution] deducting", {
          amountCents, circleId, userId: uid,
        });
        if (uid) {
          const { data: walletRow, error: readErr } = await supabase
            .from("user_wallets")
            .select("main_balance_cents")
            .eq("user_id", uid)
            .maybeSingle();
          if (readErr || !walletRow) {
            console.warn("[WalletContext.makeContribution] wallet read failed", readErr);
          } else {
            const newBalanceCents = (walletRow.main_balance_cents ?? 0) - amountCents;
            const { error: updErr } = await supabase
              .from("user_wallets")
              .update({ main_balance_cents: newBalanceCents })
              .eq("user_id", uid);
            if (updErr) {
              console.error("[WalletContext.makeContribution] wallet update failed", updErr);
            } else {
              console.log("[WalletContext.makeContribution] wallet updated", {
                before: walletRow.main_balance_cents, after: newBalanceCents,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[WalletContext.makeContribution] server deduction error", err);
      // Intentionally don't throw — the local state already shows the
      // deduction and the contribution record is what the screen cares
      // about. A follow-up refreshWallet will reconcile if needed.
    }

    // 3. Reconcile from the server so the UI shows the authoritative new
    //    balance (protects against drift between local + server state).
    try { await loadWalletData(); } catch {}

    return transactionId;
  };

  const receivePayout = async (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    const newTransaction: Transaction = {
      id: transactionId,
      type: "payout",
      description: `Payout: ${circleName}`,
      amount: amount,
      currency: currency,
      date: formatDate(),
      flag: currencyInfo.flag,
      circleId,
      circleName,
    };

    // Add to currency wallet
    let newCurrencies = [...currencies];
    const currencyIndex = newCurrencies.findIndex(c => c.code === currency);

    if (currencyIndex >= 0) {
      newCurrencies[currencyIndex] = {
        ...newCurrencies[currencyIndex],
        balance: newCurrencies[currencyIndex].balance + amount,
      };
    } else {
      // Create new wallet for this currency
      const info = CURRENCY_INFO[currency];
      if (info) {
        newCurrencies.push({
          code: currency,
          name: info.name,
          flag: info.flag,
          symbol: info.symbol,
          balance: amount,
          isActive: true,
        });
      }
    }

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const sendRemittance = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    recipientName: string,
    recipientCountry: string,
    exchangeRate: number,
    fee: number
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const fromInfo = CURRENCY_INFO[fromCurrency] || { flag: "🏳️" };
    const toInfo = CURRENCY_INFO[toCurrency] || { flag: "🏳️" };

    const convertedAmount = amount * exchangeRate;
    const totalDeducted = amount + fee;

    const newTransaction: Transaction = {
      id: transactionId,
      type: "remittance",
      description: `Remittance to ${recipientName}`,
      amount: -totalDeducted,
      currency: fromCurrency,
      date: formatDate(),
      flag: toInfo.flag,
      recipientName,
      originalAmount: amount,
      originalCurrency: fromCurrency,
      exchangeRate,
      convertedAmount,
      convertedCurrency: toCurrency,
    };

    // Deduct from source currency wallet (amount + fee)
    const newCurrencies = currencies.map((c) =>
      c.code === fromCurrency ? { ...c, balance: c.balance - totalDeducted } : c
    );

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const refreshWallet = async () => {
    await loadWalletData();
  };

  // ── P2 (Access Wallet review): realtime balance subscription ─────
  //
  // Subscribes to postgres_changes on the user's own user_wallets row.
  // Server-side filter (`user_id=eq.${uid}`) means Realtime only
  // pushes the user's own mutations — debits from autopay, credits
  // from incoming transfers, payouts from a circle cycle. A 300 ms
  // trailing-edge debounce coalesces tx-internal bursts (e.g. a
  // contribution that debits and immediately credits the recipient
  // in the same transaction would otherwise fire twice).
  //
  // We only sync the USD balance — the other currency rows in
  // `currencies` are local-only state with no server counterpart.
  // The applyMainBalanceCents helper preserves the existing row
  // shape (flag, symbol, isActive) so a realtime update never
  // re-orders or resets the rest of the array.
  //
  // Failures surface in the channel-status callback; the
  // `useFocusEffect`-backed `refreshWallet()` consumers (HomeScreen
  // tile, Wallet pull-to-refresh) remain the documented fallback.
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const applyMainBalanceCents = (cents: unknown) => {
      const n = typeof cents === "number" ? cents : Number(cents);
      if (!Number.isFinite(n)) return;
      const dollars = n / 100;
      setCurrencies((prev) => {
        const hasUSD = prev.some((c) => c.code === "USD");
        if (!hasUSD) {
          return [
            {
              code: "USD",
              name: "US Dollar",
              flag: "🇺🇸",
              symbol: "$",
              balance: dollars,
              change: 0,
              isActive: true,
            },
            ...prev,
          ];
        }
        // No-op when the cents value matches — avoids a re-render
        // for events that don't move our main balance.
        const current = prev.find((c) => c.code === "USD");
        if (current && current.balance === dollars) return prev;
        return prev.map((c) => (c.code === "USD" ? { ...c, balance: dollars } : c));
      });
    };

    type ChannelRef = ReturnType<typeof supabase.channel> | null;
    let channel: ChannelRef = null;

    try {
      channel = supabase
        .channel(`user-wallets-${uid}`)
        .on(
          // @ts-expect-error supabase-js types narrow event to a literal but
          // accept "*" at runtime to subscribe to all change events.
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_wallets",
            filter: `user_id=eq.${uid}`,
          },
          (payload: { new?: { main_balance_cents?: unknown } | null; old?: { main_balance_cents?: unknown } | null }) => {
            if (realtimeDebounceRef.current) {
              clearTimeout(realtimeDebounceRef.current);
            }
            realtimeDebounceRef.current = setTimeout(() => {
              realtimeDebounceRef.current = null;
              const cents =
                payload.new?.main_balance_cents ??
                payload.old?.main_balance_cents;
              applyMainBalanceCents(cents);
            }, 300);
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[WalletContext] user_wallets channel status:", status);
          }
        });
    } catch (e) {
      console.warn(
        "[WalletContext] realtime subscribe failed; falling back to focus refresh:",
        (e as Error)?.message ?? "unknown",
      );
    }

    return () => {
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* best-effort */
        }
      }
    };
  }, [user?.id]);

  return (
    <WalletContext.Provider
      value={{
        balance,
        currencies,
        transactions,
        isLoading,
        addFunds,
        withdraw,
        sendMoney,
        addCurrencyWallet,
        removeCurrencyWallet,
        convertBetweenWallets,
        getCurrencyBalance,
        makeContribution,
        receivePayout,
        sendRemittance,
        refreshWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
