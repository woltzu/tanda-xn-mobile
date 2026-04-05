import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';

// Stripe React Native is native-only — stub on web
let StripeProvider: any = ({ children }: any) => children;
let useStripe: any = () => ({
  confirmPayment: async () => ({ error: { message: 'Stripe not available on web' } }),
  initPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
  presentPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
});

if (Platform.OS !== 'web') {
  try {
    const stripe = require('@stripe/stripe-react-native');
    StripeProvider = stripe.StripeProvider;
    useStripe = stripe.useStripe;
  } catch (e) {
    // Stripe native not available
  }
}

import { useAuth } from '../context/AuthContext';
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
  refreshPaymentMethods: () => Promise<void>;
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
  ) => Promise<{ clientSecret: string; paymentIntentId: string }>;
  createWithdrawal: (
    amountCents: number,
    currency: string,
  ) => Promise<{ transferId: string }>;

  // Payment sheet
  presentPaymentSheet: (clientSecret: string) => Promise<{ success: boolean; error?: string }>;

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

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Inner provider (must be inside StripeProvider to use useStripe)
// ─────────────────────────────────────────────────────────────────────────────

function PaymentProviderInner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet: stripePresent } = useStripe();

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

  const refreshPaymentMethods = useCallback(async () => {
    if (!user) return;
    setIsLoadingMethods(true);
    try {
      const methods = await StripeConnectEngine.getPaymentMethods(user.id);
      const active = methods.filter((m) => m.status === 'active');
      setPaymentMethods(active.map(mapToSavedMethod));
    } catch (err: any) {
      console.warn('[PaymentContext] Failed to load payment methods:', err.message);
      setPaymentError(err.message);
    } finally {
      setIsLoadingMethods(false);
    }
  }, [user]);

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
    if (!user) throw new Error('User not authenticated');
    try {
      const account = await StripeConnectEngine.createConnectedAccount(user.id, user.email);
      setConnectedAccountId(account.stripeAccountId);

      const onboardingUrl = await StripeConnectEngine.generateOnboardingLink(
        user.id,
        returnUrl,
        returnUrl,
      );
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
      await StripeConnectEngine.removePaymentMethod(user.id, paymentMethodId);
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
    try {
      const pi = await StripeConnectEngine.createPaymentIntent({
        memberId: user.id,
        amountCents,
        currency,
        purpose: 'contribution',
        circleId,
        cycleId,
        paymentMethodId,
      });
      return { clientSecret: pi.clientSecret!, paymentIntentId: pi.stripePaymentIntentId };
    } catch (err: any) {
      setPaymentError(err.message);
      throw err;
    }
  }, [user]);

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
