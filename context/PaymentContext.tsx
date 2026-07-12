import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';

// Stripe is loaded via the platform-resolved shim. On iOS / Android,
// `lib/stripeShim.ts` re-exports the real API from
// @stripe/stripe-react-native. On web, Metro picks `lib/stripeShim.web.ts`
// which exports stubs — so the native-only `codegenNativeCommands`
// reference that the package ships with never enters the web bundle.
//
// The prior `if (Platform.OS !== 'web') require('@stripe/...')` pattern
// in this file did not work: Metro statically resolves every reachable
// require() regardless of runtime guards.
import { StripeProvider, useStripe } from '../lib/stripeShim';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  StripeConnectEngine,
  PaymentMethod as DBPaymentMethod,
  PaymentMethodType,
} from '../services/StripeConnectEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  'pk_test_51TEzlc0J4hVutKjskEZCfrgtJ14jhj2Gw0NSVj98K6SThSL8pF7NTDbSPkZx3lL91SDyuIZZ3NUTLBammc3OFqZb08zau4oo5H';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SavedPaymentMethod = {
  id: string;
  stripePaymentMethodId: string;
  type: 'card' | 'us_bank_account' | 'link' | 'cashapp' | 'apple_pay' | 'google_pay';
  isDefault: boolean;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  bankName?: string;
  bankLast4?: string;
  label: string;
  icon: string;
};

export type PaymentContextType = {
  // Stripe initialization status
  isStripeReady: boolean;

  // Customer & account
  stripeCustomerId: string | null;
  connectedAccountId: string | null;
  isOnboarded: boolean;

  // Saved payment methods
  paymentMethods: SavedPaymentMethod[];
  defaultPaymentMethod: SavedPaymentMethod | null;
  isLoadingMethods: boolean;

  // Actions
  initializeCustomer: () => Promise<void>;
  setupConnectedAccount: (returnUrl: string) => Promise<string>;

  // Payment method management
  // P2 (payment-methods review): syncRemote=true asks the
  // sync-stripe-methods Edge Function to first fetch the Stripe
  // Customer's PaymentMethod list and upsert any rows our DB hasn't
  // seen yet (cards added on web, dashboard, etc.) before reading the
  // local table. Default false so the on-focus refresh stays cheap.
  refreshPaymentMethods: (opts?: { syncRemote?: boolean }) => Promise<void>;
  addPaymentMethodFromToken: (paymentMethodId: string, type: string, details: any) => Promise<void>;
  removePaymentMethod: (paymentMethodId: string) => Promise<void>;
  setDefaultPaymentMethod: (paymentMethodId: string) => Promise<void>;

  // Payment flows
  createDeposit: (
    amountCents: number,
    currency: string,
    paymentMethodId?: string,
  ) => Promise<{ clientSecret: string; paymentIntentId: string }>;
  createContribution: (
    amountCents: number,
    currency: string,
    circleId: string,
    cycleId?: string,
    paymentMethodId?: string,
  ) => Promise<{
    clientSecret: string;
    paymentIntentId: string;
    // Stripe PaymentIntent status right after the EF's create. When
    // paymentMethodId was passed, the EF confirms server-side, so
    // this can arrive as 'succeeded' or 'requires_action' — the
    // client uses it to decide whether to skip PaymentSheet.
    status?: string;
    contributionCents: number;
    platformFeeCents: number;
    platformFeeBps: number;
    chargeCents: number;
  }>;
  // Runs Stripe SDK's handleNextAction for a PI that came back as
  // 'requires_action' (usually 3-D Secure). No visible UI unless a
  // challenge is required.
  handleNextActionForIntent: (
    clientSecret: string,
  ) => Promise<{ success: boolean; error?: string }>;
  createWithdrawal: (
    amountCents: number,
    currency: string,
  ) => Promise<{ transferId: string }>;

  // Payment sheet
  presentPaymentSheet: (clientSecret: string) => Promise<{ success: boolean; error?: string }>;

  // P0 (payment-methods review): save a card without charging. Creates a
  // SetupIntent via the create-setup-intent Edge Function, presents the
  // Stripe PaymentSheet in setup mode (so the user enters card details
  // but no money moves), then refreshes the list. Returns
  // { success, error?, paymentMethodId? } so the caller can toast.
  setupCardForLater: () => Promise<{ success: boolean; error?: string }>;

  // DEV-only smoke test (Path A) — bypasses StripeConnectEngine stubs
  makeTestCharge: (
    amountCents?: number,
  ) => Promise<{ ok: boolean; error?: string; paymentIntentId?: string }>;

  // Error state
  paymentError: string | null;
  clearError: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getMethodIcon(type: PaymentMethodType, brand?: string): string {
  switch (type) {
    case 'card':
      return 'card';
    case 'us_bank_account':
      return 'business';
    case 'apple_pay':
      return 'logo-apple';
    case 'google_pay':
      return 'logo-google';
    case 'cashapp':
      return 'phone-portrait';
    case 'link':
      return 'link';
    default:
      return 'wallet';
  }
}

function getMethodLabel(method: DBPaymentMethod): string {
  switch (method.type) {
    case 'card': {
      const brand = (method.brand || 'Card').charAt(0).toUpperCase() + (method.brand || 'card').slice(1);
      return `${brand} \u2022\u2022\u2022\u2022 ${method.last4 || '****'}`;
    }
    case 'us_bank_account':
      return `${method.bankName || 'Bank'} \u2022\u2022\u2022\u2022 ${method.last4 || '****'}`;
    case 'apple_pay':
      return 'Apple Pay';
    case 'google_pay':
      return 'Google Pay';
    case 'cashapp':
      return 'Cash App';
    case 'link':
      return 'Link';
    default:
      return 'Payment Method';
  }
}

function mapToSavedMethod(dbMethod: DBPaymentMethod): SavedPaymentMethod {
  return {
    id: dbMethod.id,
    stripePaymentMethodId: dbMethod.stripePaymentMethodId,
    type: dbMethod.type,
    isDefault: dbMethod.isDefault,
    cardBrand: dbMethod.brand,
    cardLast4: dbMethod.type === 'card' ? dbMethod.last4 : undefined,
    cardExpMonth: dbMethod.expMonth,
    cardExpYear: dbMethod.expYear,
    bankName: dbMethod.bankName,
    bankLast4: dbMethod.type === 'us_bank_account' ? dbMethod.last4 : undefined,
    label: getMethodLabel(dbMethod),
    icon: getMethodIcon(dbMethod.type, dbMethod.brand),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

// Unwrap an EF failure into the most specific message we can find.
// supabase-js returns a FunctionsHttpError on non-2xx; the response body
// carries the EF's `{ error: "…" }` payload but only surfaces via
// error.context.text() (or already-parsed on data when 2xx). Fall through
// to whatever textual signal exists so the user sees "Stripe Connect not
// enabled" instead of "Edge Function returned a non-2xx status code".
// Combine `error` + `detail` fields — most of our EFs return that shape
// (see create-connect-account, create-setup-intent). Without `detail`
// the user sees a useless "Stripe error" instead of the actual reason
// like "Currency USD is not supported for country CI".
function combineErrorAndDetail(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const err = typeof payload.error === "string" ? payload.error : "";
  const detail = typeof payload.detail === "string" ? payload.detail : "";
  if (!err && !detail) return null;
  if (err && detail) return `${err}: ${detail}`;
  return err || detail;
}

async function extractEfErrorMessage(
  error: unknown,
  data: unknown,
): Promise<string> {
  // If the EF returned 2xx with `{ error }` — happens on our few EFs that
  // don't use HTTP status for control flow.
  const fromData = combineErrorAndDetail(data);
  if (fromData) return fromData;
  // FunctionsHttpError carries the response on .context. Try to parse it.
  const anyErr = error as any;
  try {
    const ctx = anyErr?.context;
    if (ctx && typeof ctx.text === "function") {
      const body = await ctx.text();
      if (body) {
        try {
          const parsed = JSON.parse(body);
          const combined = combineErrorAndDetail(parsed);
          if (combined) {
            console.log("[extractEfErrorMessage] parsed body:", parsed);
            return combined;
          }
        } catch {
          // Non-JSON body — return the raw text if it's short enough to
          // display without dumping a stack trace.
          if (body.length < 300) return body;
        }
      }
    }
  } catch {
    // ignore — fall through
  }
  return anyErr?.message || "Edge Function failed. Please try again.";
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Inner provider (must be inside StripeProvider to use useStripe)
// ─────────────────────────────────────────────────────────────────────────────

function PaymentProviderInner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    initPaymentSheet,
    presentPaymentSheet: stripePresent,
    handleNextAction,
  } = useStripe();

  // Stripe readiness
  const [isStripeReady, setIsStripeReady] = useState(false);

  // Customer & account
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);

  // Error
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const clearError = useCallback(() => setPaymentError(null), []);

  const defaultPaymentMethod = paymentMethods.find((m) => m.isDefault) || paymentMethods[0] || null;

  // ── Refresh payment methods ───────────────────────────────────────────────

  const refreshPaymentMethods = useCallback(async (
    opts?: { syncRemote?: boolean },
  ) => {
    console.log("[PaymentContext] refreshPaymentMethods called", { syncRemote: !!opts?.syncRemote, hasUser: !!user });
    if (!user) return;
    setIsLoadingMethods(true);
    try {
      // P2 (payment-methods review): optional remote sync. Best-effort —
      // any failure here falls through to a plain local read so the
      // user still gets *something*. Pull-to-refresh enables this; the
      // useFocusEffect / realtime path does not.
      if (opts?.syncRemote) {
        try {
          console.log("[PaymentContext] invoking sync-stripe-methods EF");
          const { data: syncData, error: syncErr } = await supabase.functions.invoke('sync-stripe-methods', { body: {} });
          console.log("[PaymentContext] sync-stripe-methods returned:", {
            hasData: !!syncData,
            data: syncData,
            errorMessage: (syncErr as any)?.message,
          });
        } catch (syncErr: any) {
          console.warn(
            '[PaymentContext] sync-stripe-methods failed (continuing):',
            syncErr?.message,
          );
        }
      }
      console.log("[PaymentContext] reading stripe_payment_methods via engine");
      const methods = await StripeConnectEngine.getPaymentMethods(user.id);
      const active = methods.filter((m) => m.status === 'active');
      console.log("[PaymentContext] payment_methods loaded:", {
        total: methods.length,
        active: active.length,
        firstBrand: active[0]?.brand,
        firstLast4: active[0]?.last4,
      });
      setPaymentMethods(active.map(mapToSavedMethod));
    } catch (err: any) {
      // Preserve the previously-loaded list on failure rather than
      // wiping state to []. A transient network / RLS blip
      // shouldn't blank the whole screen — the user's existing
      // methods should keep rendering until the next successful
      // fetch replaces them.
      console.warn('[PaymentContext] Failed to load payment methods (preserving prior state):', err.message);
      setPaymentError(err.message);
    } finally {
      setIsLoadingMethods(false);
    }
  }, [user]);

  // P2 (payment-methods review): realtime subscription. Mirrors the
  // useStripePayments hook's channel pattern (hooks/useStripePayments.ts).
  // Coalesces every event to a single refresh — payment-method changes
  // are infrequent, so we don't bother diffing the payload.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`payment_context_methods:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stripe_payment_methods',
          filter: `member_id=eq.${user.id}`,
        },
        () => {
          // Local read only — the webhook is the source-of-truth, so a
          // remote re-sync here would just churn the cache.
          refreshPaymentMethods();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshPaymentMethods]);

  // ── Initialize on mount when authenticated ────────────────────────────────

  useEffect(() => {
    if (!user) {
      setStripeCustomerId(null);
      setConnectedAccountId(null);
      setIsOnboarded(false);
      setPaymentMethods([]);
      setIsStripeReady(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        // Ensure Stripe customer exists
        const customer = await StripeConnectEngine.createOrGetCustomer(
          user.id,
          user.email,
          user.name,
        );
        if (cancelled) return;
        setStripeCustomerId(customer.stripeCustomerId);

        // Check connected account status
        const account = await StripeConnectEngine.getConnectedAccount(user.id);
        if (cancelled) return;
        if (account) {
          setConnectedAccountId(account.stripeAccountId);
          setIsOnboarded(account.onboardingStatus === 'verified' && account.payoutsEnabled);
        }

        // Load saved payment methods
        const methods = await StripeConnectEngine.getPaymentMethods(user.id);
        if (cancelled) return;
        setPaymentMethods(methods.filter((m) => m.status === 'active').map(mapToSavedMethod));

        setIsStripeReady(true);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[PaymentContext] Bootstrap failed:', err.message);
          setPaymentError(err.message);
          setIsStripeReady(true); // still ready so UI can show error state
        }
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [user]);

  // ── Initialize customer (manual trigger) ──────────────────────────────────

  const initializeCustomer = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');
    try {
      const customer = await StripeConnectEngine.createOrGetCustomer(
        user.id,
        user.email,
        user.name,
      );
      setStripeCustomerId(customer.stripeCustomerId);
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user]);

  // ── Connected account setup ───────────────────────────────────────────────

  const setupConnectedAccount = useCallback(async (returnUrl: string): Promise<string> => {
    // Stage 1: routes through the create-connect-account Edge Function
    // (bypassing StripeConnectEngine's stubs). The returnUrl parameter is
    // preserved for caller compatibility but unused — the EF hardcodes the
    // tandaxn://linked-accounts deep-link return/refresh URLs.
    if (!user) throw new Error('User not authenticated');
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: {},
      });
      if (error) {
        // Unpack the EF's specific error before falling back to the
        // generic supabase-js "non-2xx status code". The audit at
        // docs/audit/33_currency_and_payment_button_bugs.md documented
        // the eight known failure modes — surfacing the specific
        // message tells the user which one hit.
        const specific = await extractEfErrorMessage(error, data);
        console.error('[PaymentContext] create-connect-account failed:', specific);
        throw new Error(specific);
      }
      if (!data) {
        throw new Error('No response from create-connect-account');
      }
      if ((data as any).error) {
        console.error('[PaymentContext] create-connect-account returned error:', (data as any).error);
        throw new Error(String((data as any).error));
      }

      const { onboardingUrl, stripeAccountId, accountStatus } = data as {
        onboardingUrl: string | null;
        stripeAccountId: string;
        accountStatus: 'complete' | 'in_progress' | 'restricted' | 'disabled';
      };

      setConnectedAccountId(stripeAccountId);

      if (accountStatus === 'complete') {
        setIsOnboarded(true);
        throw new Error('Connected account already onboarded.');
      }
      if (!onboardingUrl) {
        throw new Error('Stripe did not return an onboarding URL.');
      }
      return onboardingUrl;
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user]);

  // ── Payment method management ─────────────────────────────────────────────

  const addPaymentMethodFromToken = useCallback(async (
    paymentMethodId: string,
    type: string,
    details: any,
  ) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await StripeConnectEngine.addPaymentMethod(user.id, paymentMethodId, type as PaymentMethodType, details);
      await refreshPaymentMethods();
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user, refreshPaymentMethods]);

  const removePaymentMethod = useCallback(async (paymentMethodId: string) => {
    if (!user) throw new Error('User not authenticated');
    try {
      // Route through the detach-payment-method EF instead of the
      // engine's soft-remove. The engine only set status='removed' on
      // the row, which sync-stripe-methods reset to 'active' on the
      // next focus refresh — making the "delete" feel broken. The EF
      // detaches from Stripe first, then hard-deletes the row.
      const { data, error } = await supabase.functions.invoke(
        'detach-payment-method',
        { body: { paymentMethodId } },
      );
      if (error) {
        const msg = await extractEfErrorMessage(error, data);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(String(data.error));
      // Optimistic local prune so the row disappears immediately —
      // the state re-syncs on the next refreshPaymentMethods anyway.
      setPaymentMethods((prev) => prev.filter((m) => m.id !== paymentMethodId));
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user]);

  const setDefaultPaymentMethodAction = useCallback(async (paymentMethodId: string) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await StripeConnectEngine.setDefaultPaymentMethod(user.id, paymentMethodId);
      setPaymentMethods((prev) =>
        prev.map((m) => ({ ...m, isDefault: m.id === paymentMethodId })),
      );
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user]);

  // ── Payment flows ─────────────────────────────────────────────────────────

  const createDeposit = useCallback(async (
    amountCents: number,
    currency: string,
    paymentMethodId?: string,
  ) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const pi = await StripeConnectEngine.createPaymentIntent({
        memberId: user.id,
        amountCents,
        currency,
        purpose: 'wallet_deposit',
        paymentMethodId,
      });
      return { clientSecret: pi.clientSecret!, paymentIntentId: pi.stripePaymentIntentId };
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user]);

  const createContribution = useCallback(async (
    amountCents: number,
    currency: string,
    circleId: string,
    cycleId?: string,
    paymentMethodId?: string,
  ) => {
    if (!user) throw new Error('User not authenticated');
    // Stage 2 Bucket A — route through the real create-circle-contribution-intent
    // EF instead of StripeConnectEngine._createStripePaymentIntent (which is a
    // mock returning `pi_test_*`). The EF:
    //   - validates the caller is an active circle member
    //   - writes a pending_intents row before calling Stripe (forensic trail)
    //   - resolves cycle_id from circle_cycles when cycle_number is provided
    //   - returns a real client_secret for PaymentSheet
    //
    // The legacy `cycleId` string param from the screen is the "cycle-N"
    // synthetic id; we parse the integer back out so the EF can resolve a
    // real circle_cycles UUID. Empty / malformed values are passed as null.
    let cycleNumber: number | null = null;
    if (typeof cycleId === 'string') {
      const m = cycleId.match(/(\d+)/);
      if (m) {
        const parsed = parseInt(m[1], 10);
        if (Number.isFinite(parsed) && parsed > 0) cycleNumber = parsed;
      }
    }
    try {
      const { data, error } = await supabase.functions.invoke('create-circle-contribution-intent', {
        body: {
          circle_id: circleId,
          amount_cents: amountCents,
          currency,
          cycle_number: cycleNumber,
          payment_method_id: paymentMethodId ?? null,
        },
      });
      if (error) {
        // Unwrap FunctionsHttpError so 409s (e.g. duplicate contribution
        // for this cycle) surface with the EF's actual message instead
        // of "Edge Function returned a non-2xx status code".
        const msg = await extractEfErrorMessage(error, data);
        throw new Error(msg);
      }
      if (!data?.clientSecret) {
        throw new Error('Edge function did not return a clientSecret');
      }
      return {
        clientSecret: data.clientSecret as string,
        paymentIntentId: data.paymentIntentId as string,
        status: typeof data.status === "string" ? data.status : undefined,
        // Stage 2 Bucket C — fee breakdown from the EF response. The
        // screen uses these to render the "Processing fee — covered by
        // TandaXn" line and the optional Platform fee row.
        contributionCents: Number(data.contribution_cents) || amountCents,
        platformFeeCents: Number(data.platform_fee_cents) || 0,
        platformFeeBps: Number(data.platform_fee_bps) || 0,
        chargeCents: Number(data.charge_cents) || amountCents,
      };
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user]);

  // Thin wrapper around Stripe SDK's handleNextAction so callers can
  // resolve a server-confirmed PI that came back requires_action
  // (usually 3-D Secure). Presents the challenge natively; no UI when
  // no action is required. Kept generic so future flows can reuse it.
  const handleNextActionForIntent = useCallback(
    async (clientSecret: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { paymentIntent, error } = await handleNextAction(clientSecret);
        if (error) {
          return { success: false, error: error.message || "Payment authentication failed" };
        }
        if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "requires_capture") {
          return { success: true };
        }
        if (paymentIntent?.status === "requires_confirmation") {
          // Extremely rare — SDK returns here when the challenge
          // resolves but the intent still needs a client-side confirm.
          // Not the shape we want; surface as an error so the caller
          // shows a retry rather than a silent failure.
          return { success: false, error: "Payment requires an additional step. Please try again." };
        }
        return {
          success: false,
          error: `Payment did not complete (status: ${paymentIntent?.status ?? "unknown"}).`,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "Payment failed" };
      }
    },
    [handleNextAction],
  );

  const createWithdrawal = useCallback(async (amountCents: number, currency: string) => {
    if (!user) throw new Error('User not authenticated');
    if (!connectedAccountId) throw new Error('Connected account not set up');
    if (!isOnboarded) throw new Error('Account onboarding not complete');

    try {
      const transfer = await StripeConnectEngine.createTransfer({
        memberId: user.id,
        amountCents,
        currency,
        purpose: 'withdrawal',
        connectedAccountId,
      });
      return { transferId: transfer.stripeTransferId };
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user, connectedAccountId, isOnboarded]);

  // ── Payment sheet (Stripe built-in UI) ────────────────────────────────────

  const presentPaymentSheetAction = useCallback(async (
    clientSecret: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'TandaXn',
        allowsDelayedPaymentMethods: false,
        // Return URL for redirect-based payment methods (Klarna, Cash App
        // Pay, iDEAL, etc.) and for the 3DS challenge sheet on iOS. The
        // scheme "tandaxn" is registered in app.json.
        returnURL: 'tandaxn://stripe-redirect',
      });

      if (initError) {
        const msg = initError.message || 'Failed to initialize payment sheet';
        setPaymentError(msg);
        return { success: false, error: msg };
      }

      const { error: presentError } = await stripePresent();

      if (presentError) {
        // User cancellation is not a real error
        if (presentError.code === 'Canceled') {
          return { success: false, error: 'Payment canceled' };
        }
        const msg = presentError.message || 'Payment failed';
        setPaymentError(msg);
        return { success: false, error: msg };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Unexpected payment error';
      setPaymentError(msg);
      return { success: false, error: msg };
    }
  }, [initPaymentSheet, stripePresent]);

  // ── Setup a card for future charges (P0, payment-methods review) ──────────
  // Calls the create-setup-intent EF to get a clientSecret for a SetupIntent
  // attached to the user's Stripe customer, then uses the PaymentSheet in
  // setup mode. After success the card lives on the Stripe customer and
  // appears in stripe_payment_methods once payment_method.attached fires.
  // We refresh here so the LinkedAccountsScreen list updates without
  // waiting for the webhook + realtime path.

  const setupCardForLater = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    // [debug create-setup-intent] Temporary trace: which branch does the
    // flow take, and does the invoke actually fire? Remove once the
    // "EF logs are empty" investigation is closed.
    console.log("[PaymentContext] setupCardForLater called", {
      hasUser: !!user,
      userId: user?.id,
      platform: Platform.OS,
    });
    if (!user) {
      console.log("[PaymentContext] setupCardForLater: early return — no user");
      return { success: false, error: "Not authenticated" };
    }
    if (Platform.OS === "web") {
      // Stripe RN PaymentSheet is native-only — match the pattern used in
      // makeTestCharge so the caller can show a clean error.
      console.log("[PaymentContext] setupCardForLater: early return — web platform");
      return {
        success: false,
        error: "Adding a card requires the iOS or Android app.",
      };
    }
    // Snapshot the current card-list brand+last4+expiry so we can
    // detect if the sheet ends up attaching a duplicate. State
    // (paymentMethods) isn't captured in this useCallback closure, so
    // we read directly from the engine. Best-effort — a lookup
    // failure just skips the dedupe pass rather than blocking a
    // genuine add. Expiry is included in the key so a re-issued
    // card (new expiry, same last4) isn't flagged as a duplicate of
    // its predecessor — that's a legitimate replacement, not a
    // double-tap.
    const cardKey = (m: {
      brand?: string | null;
      last4?: string | null;
      expMonth?: number | null;
      expYear?: number | null;
    }) =>
      `${(m.brand || "").toLowerCase()}::${m.last4 || ""}::${m.expMonth ?? ""}::${m.expYear ?? ""}`;
    let preKeys = new Set<string>();
    let preIds = new Set<string>();
    // A row with no brand + no last4 has nothing to dedupe against —
    // skip so an empty stripe_payment_methods row doesn't collide
    // with a legit new card whose fields haven't rendered yet.
    const hasIdentity = (m: { brand?: string | null; last4?: string | null }) =>
      !!(m.brand || m.last4);
    try {
      const preList = await StripeConnectEngine.getPaymentMethods(user.id);
      for (const m of preList) {
        if (m.type !== "card" || m.status !== "active") continue;
        preIds.add(m.id);
        if (hasIdentity(m)) preKeys.add(cardKey(m));
      }
    } catch (snapErr) {
      console.warn(
        "[PaymentContext] pre-setup snapshot failed (continuing):",
        snapErr,
      );
    }

    try {
      // 1. Get the SetupIntent clientSecret from our EF.
      console.log("[PaymentContext] invoking EF 'create-setup-intent'");
      const { data, error } = await supabase.functions.invoke(
        "create-setup-intent",
        { body: {} },
      );
      console.log("[PaymentContext] create-setup-intent returned:", {
        hasData: !!data,
        dataKeys: data && typeof data === "object" ? Object.keys(data) : null,
        hasError: !!error,
        errorMessage: (error as any)?.message,
        errorName: (error as any)?.name,
      });
      // The EF returns a JSON body with a specific `error` field on any
      // handled failure (Stripe rejection, missing customer row, bad
      // country, etc.). supabase-js only unpacks that body when the HTTP
      // status is 2xx; on 4xx/5xx the raw body arrives on FunctionsHttpError,
      // which we surface via error.context.text() when available. Prefer
      // the specific message, fall back to the generic HTTP error.
      if (error) {
        const specific = await extractEfErrorMessage(error, data);
        console.error("[PaymentContext] create-setup-intent failed:", specific);
        return { success: false, error: specific };
      }
      if (data?.error) {
        console.error("[PaymentContext] create-setup-intent returned error:", data.error);
        return { success: false, error: String(data.error) };
      }
      if (!data?.clientSecret) {
        return { success: false, error: "No clientSecret returned" };
      }

      // 2. Initialise the PaymentSheet in setup mode. Note the key is
      // `setupIntentClientSecret` (not `paymentIntentClientSecret`) — the
      // RN SDK switches its UI to "save card" wording when this is set.
      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: data.clientSecret,
        merchantDisplayName: "TandaXn",
        allowsDelayedPaymentMethods: false,
        // Return URL for redirect-based save-card methods and the 3DS
        // challenge sheet on iOS. Silences the SDK's runtime warning
        // and enables the fuller list of payment methods on both
        // platforms. Scheme "tandaxn" is registered in app.json.
        returnURL: "tandaxn://stripe-redirect",
      });
      if (initError) {
        const msg = initError.message || "Failed to initialise card setup";
        setPaymentError(msg);
        return { success: false, error: msg };
      }

      // 3. Present.
      const { error: presentError } = await stripePresent();
      if (presentError) {
        if (presentError.code === "Canceled") {
          return { success: false, error: "Canceled" };
        }
        const msg = presentError.message || "Card setup failed";
        setPaymentError(msg);
        return { success: false, error: msg };
      }

      // 4. Refresh with syncRemote so we don't wait on the webhook. A
      // plain local read here often runs microseconds before the
      // payment_method.attached webhook lands, so the freshly saved
      // card is missing on first render and the user thinks nothing
      // happened. Pulling from Stripe direct via sync-stripe-methods
      // guarantees the new card shows up.
      console.log("[PaymentContext] calling refreshPaymentMethods(syncRemote=true)");
      await refreshPaymentMethods({ syncRemote: true });
      console.log("[PaymentContext] refreshPaymentMethods returned");

      // 5. Duplicate detection. Compare the freshly-attached card(s)
      // against the pre-setup brand+last4 snapshot. Stripe attaches
      // per payment_method id, so a re-entered physical card lands as
      // a distinct row we can identify by matching brand+last4. On
      // hit, soft-remove the copy so it doesn't linger in the UI, then
      // return { error: "Duplicate" } for the caller to surface a
      // targeted alert. Best-effort — if the post-list read fails we
      // fall through to the success path rather than fail-closed on a
      // legitimate add.
      try {
        const postList = await StripeConnectEngine.getPaymentMethods(user.id);
        const newCards = postList.filter(
          (m) => m.type === "card" && m.status === "active" && !preIds.has(m.id),
        );
        for (const c of newCards) {
          if (!hasIdentity(c)) continue;
          const key = cardKey(c);
          if (preKeys.has(key)) {
            console.warn("[PaymentContext] duplicate card detected, removing:", c.id);
            try {
              await StripeConnectEngine.removePaymentMethod(user.id, c.id);
              await refreshPaymentMethods({ syncRemote: false });
            } catch (rmErr) {
              console.warn(
                "[PaymentContext] duplicate soft-remove failed (continuing):",
                rmErr,
              );
            }
            return { success: false, error: "Duplicate" };
          }
        }
      } catch (dedupErr) {
        console.warn(
          "[PaymentContext] post-setup dedupe check failed (continuing):",
          dedupErr,
        );
      }
      return { success: true };
    } catch (err: any) {
      const msg = err?.message ?? "Unexpected card setup error";
      console.error("[PaymentContext] setupCardForLater failed:", msg);
      setPaymentError(msg);
      return { success: false, error: msg };
    }
  }, [user, initPaymentSheet, stripePresent, refreshPaymentMethods]);

  // ── Test charge (DEV only) — Path A smoke test ────────────────────────────
  // Calls the create-payment-intent Edge Function directly, bypassing
  // StripeConnectEngine's stubs, then presents the Stripe PaymentSheet via
  // the existing presentPaymentSheetAction helper. Gated by __DEV__ in the
  // calling screen — this method itself does no env gating so it can be
  // exercised from anywhere during smoke testing.

  const makeTestCharge = useCallback(async (
    amountCents: number = 50,
  ): Promise<{ ok: boolean; error?: string; paymentIntentId?: string }> => {
    if (!user) return { ok: false, error: 'Not signed in' };
    if (Platform.OS === 'web') {
      return { ok: false, error: 'Test charge requires a native build (iOS or Android)' };
    }

    try {
      // 1. Edge function creates the PI and returns the clientSecret
      const { data, error } = await supabase.functions.invoke(
        'create-payment-intent',
        { body: { amount: amountCents, currency: 'usd' } },
      );
      if (error) return { ok: false, error: `Edge function error: ${error.message}` };
      if (!data?.clientSecret) return { ok: false, error: 'No clientSecret returned' };

      const paymentIntentId = data.paymentIntentId as string | undefined;

      // 2. Present the Stripe PaymentSheet
      const sheet = await presentPaymentSheetAction(data.clientSecret);
      if (!sheet.success) return { ok: false, error: sheet.error, paymentIntentId };

      return { ok: true, paymentIntentId };
    } catch (err: any) {
      const msg = err?.message ?? 'Unexpected error';
      console.error('[PaymentContext] makeTestCharge failed:', msg);
      return { ok: false, error: msg };
    }
  }, [user, presentPaymentSheetAction]);

  // ── Context value ─────────────────────────────────────────────────────────

  const value: PaymentContextType = {
    isStripeReady,
    stripeCustomerId,
    connectedAccountId,
    isOnboarded,
    paymentMethods,
    defaultPaymentMethod,
    isLoadingMethods,
    initializeCustomer,
    setupConnectedAccount,
    refreshPaymentMethods,
    addPaymentMethodFromToken,
    removePaymentMethod,
    setDefaultPaymentMethod: setDefaultPaymentMethodAction,
    createDeposit,
    createContribution,
    createWithdrawal,
    presentPaymentSheet: presentPaymentSheetAction,
    handleNextActionForIntent,
    setupCardForLater,
    makeTestCharge,
    paymentError,
    clearError,
  };

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported provider (wraps StripeProvider around inner provider)
// ─────────────────────────────────────────────────────────────────────────────

export function PaymentProvider({ children }: { children: ReactNode }) {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <PaymentProviderInner>{children}</PaymentProviderInner>
    </StripeProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const usePayment = (): PaymentContextType => {
  const ctx = useContext(PaymentContext);
  if (!ctx) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return ctx;
};

export default PaymentContext;
