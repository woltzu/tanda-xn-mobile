// ══════════════════════════════════════════════════════════════════════════════
// STRIPE CONNECT PAYMENT HOOKS - React hooks for Stripe Connect payment system
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  StripeConnectEngine,
  StripeCustomer,
  ConnectedAccount,
  PaymentIntent,
  PaymentMethod,
  PaymentPurpose,
  StripeTransfer,
  TransferPurpose,
  StripeDispute,
  StripeRefund,
} from '../services/StripeConnectEngine';

// ══════════════════════════════════════════════════════════════════════════════
// 1. useStripeAccount — Customer + Connected Account management
// ══════════════════════════════════════════════════════════════════════════════

export function useStripeAccount(memberId?: string) {
  const { user } = useAuth();
  const id = memberId || user?.id;

  const [customer, setCustomer] = useState<StripeCustomer | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [cust, acct] = await Promise.all([
        StripeConnectEngine.getCustomer(id),
        StripeConnectEngine.getConnectedAccount(id),
      ]);
      setCustomer(cust);
      setConnectedAccount(acct);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: connected account status changes
  useEffect(() => {
    if (!id) return;
    const subscription = supabase
      .channel(`stripe_account:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stripe_connected_accounts',
        filter: `member_id=eq.${id}`,
      }, () => { fetchData(); })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [id, fetchData]);

  const hasCustomer = useMemo(() => !!customer, [customer]);
  const hasConnectedAccount = useMemo(() => !!connectedAccount, [connectedAccount]);
  const isOnboarded = useMemo(() => connectedAccount?.onboardingStatus === 'complete', [connectedAccount]);
  const canReceivePayouts = useMemo(() => connectedAccount?.payoutsEnabled === true, [connectedAccount]);
  const needsOnboarding = useMemo(() => hasConnectedAccount && !isOnboarded, [hasConnectedAccount, isOnboarded]);
  const onboardingProgress = useMemo((): 'not_started' | 'pending' | 'in_progress' | 'complete' | 'restricted' => {
    if (!connectedAccount) return 'not_started';
    return connectedAccount.onboardingStatus ?? 'not_started';
  }, [connectedAccount]);
  const accountCountry = useMemo(() => connectedAccount?.country, [connectedAccount]);
  const defaultCurrency = useMemo(() => connectedAccount?.defaultCurrency, [connectedAccount]);

  const createCustomer = useCallback(async (email: string, name: string) => {
    try {
      const result = await StripeConnectEngine.createOrGetCustomer(id!, email, name);
      setCustomer(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [id]);

  const createConnectedAccount = useCallback(async (email: string, country?: string) => {
    try {
      const result = await StripeConnectEngine.createConnectedAccount(id!, email, country);
      setConnectedAccount(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [id]);

  const getOnboardingLink = useCallback(async (returnUrl: string, refreshUrl: string) => {
    try {
      return await StripeConnectEngine.generateOnboardingLink(id!, returnUrl, refreshUrl);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [id]);

  return {
    customer, connectedAccount, loading, error,
    hasCustomer, hasConnectedAccount, isOnboarded, canReceivePayouts,
    needsOnboarding, onboardingProgress, accountCountry, defaultCurrency,
    createCustomer, createConnectedAccount, getOnboardingLink,
    refresh: fetchData,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. useStripePayments — Payment intents + payment methods
// ══════════════════════════════════════════════════════════════════════════════

export function useStripePayments(memberId?: string) {
  const { user } = useAuth();
  const id = memberId || user?.id;

  const [payments, setPayments] = useState<PaymentIntent[]>([]);
  const [currentPayment, setCurrentPayment] = useState<PaymentIntent | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [history, methods] = await Promise.all([
        StripeConnectEngine.getMemberPaymentHistory(id, 50),
        StripeConnectEngine.getPaymentMethods(id),
      ]);
      setPayments(history);
      setPaymentMethods(methods);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: payment intent status changes
  useEffect(() => {
    if (!id) return;
    const subscription = supabase
      .channel(`stripe_payments:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stripe_payment_intents',
        filter: `member_id=eq.${id}`,
      }, () => { fetchData(); })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [id, fetchData]);

  const totalDeposited = useMemo(() => {
    return payments.filter(p => p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0) / 100;
  }, [payments]);

  const totalDepositedFormatted = useMemo(() => {
    return `$${totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [totalDeposited]);

  const pendingPayments = useMemo(() => {
    const terminal = ['succeeded', 'failed', 'canceled'];
    return payments.filter(p => !terminal.includes(p.status));
  }, [payments]);

  const successfulPayments = useMemo(() => payments.filter(p => p.status === 'succeeded'), [payments]);
  const failedPayments = useMemo(() => payments.filter(p => p.status === 'failed'), [payments]);
  const hasPaymentMethods = useMemo(() => paymentMethods.length > 0, [paymentMethods]);
  const defaultPaymentMethod = useMemo(() => paymentMethods.find(pm => pm.isDefault) ?? null, [paymentMethods]);

  const paymentsByPurpose = useMemo(() => {
    return payments.reduce<Record<string, PaymentIntent[]>>((acc, p) => {
      const key = p.purpose ?? 'unknown';
      (acc[key] = acc[key] || []).push(p);
      return acc;
    }, {});
  }, [payments]);

  const recentPayments = useMemo(() => payments.slice(0, 10), [payments]);

  const successRate = useMemo(() => {
    if (payments.length === 0) return 0;
    return (successfulPayments.length / payments.length) * 100;
  }, [payments, successfulPayments]);

  const createPayment = useCallback(async (
    amountCents: number, currency: string, purpose: PaymentPurpose, options?: Record<string, any>
  ) => {
    try {
      const result = await StripeConnectEngine.createPaymentIntent(id!, amountCents, currency, purpose, options);
      setCurrentPayment(result);
      return result.clientSecret;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [id]);

  const cancelPayment = useCallback(async (paymentIntentId: string) => {
    try {
      return await StripeConnectEngine.cancelPaymentIntent(paymentIntentId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const addPaymentMethod = useCallback(async (
    stripePaymentMethodId: string, type: string, details: Record<string, any>
  ) => {
    try {
      const result = await StripeConnectEngine.addPaymentMethod(id!, stripePaymentMethodId, type, details);
      await fetchData();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [id, fetchData]);

  const removePaymentMethod = useCallback(async (paymentMethodId: string) => {
    try {
      const result = await StripeConnectEngine.removePaymentMethod(paymentMethodId);
      await fetchData();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchData]);

  const setDefaultMethod = useCallback(async (paymentMethodId: string) => {
    try {
      const result = await StripeConnectEngine.setDefaultPaymentMethod(id!, paymentMethodId);
      await fetchData();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [id, fetchData]);

  return {
    payments, currentPayment, paymentMethods, loading, error,
    totalDeposited, totalDepositedFormatted, pendingPayments, successfulPayments,
    failedPayments, hasPaymentMethods, defaultPaymentMethod, paymentsByPurpose,
    recentPayments, successRate,
    createPayment, cancelPayment, addPaymentMethod, removePaymentMethod, setDefaultMethod,
    refresh: fetchData,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. useStripeTransfers — Transfers / payouts (money out)
// ══════════════════════════════════════════════════════════════════════════════

export function useStripeTransfers(memberId?: string) {
  const { user } = useAuth();
  const id = memberId || user?.id;

  const [transfers, setTransfers] = useState<StripeTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await StripeConnectEngine.getMemberTransfers(id, 50);
      setTransfers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: transfer status changes
  useEffect(() => {
    if (!id) return;
    const subscription = supabase
      .channel(`stripe_transfers:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stripe_transfers',
        filter: `member_id=eq.${id}`,
      }, () => { fetchData(); })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [id, fetchData]);

  const totalReceived = useMemo(() => {
    return transfers.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0) / 100;
  }, [transfers]);

  const totalReceivedFormatted = useMemo(() => {
    return `$${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [totalReceived]);

  const pendingTransfers = useMemo(() => transfers.filter(t => t.status === 'pending'), [transfers]);
  const completedTransfers = useMemo(() => transfers.filter(t => t.status === 'paid'), [transfers]);
  const failedTransfers = useMemo(() => transfers.filter(t => t.status === 'failed'), [transfers]);

  const transfersByPurpose = useMemo(() => {
    return transfers.reduce<Record<string, StripeTransfer[]>>((acc, t) => {
      const key = t.purpose ?? 'unknown';
      (acc[key] = acc[key] || []).push(t);
      return acc;
    }, {});
  }, [transfers]);

  const recentTransfers = useMemo(() => transfers.slice(0, 10), [transfers]);
  const hasTransfers = useMemo(() => transfers.length > 0, [transfers]);

  const nextArrival = useMemo(() => {
    const pending = pendingTransfers.filter(t => t.arrivalDate);
    if (pending.length === 0) return null;
    return pending.reduce((earliest, t) =>
      new Date(t.arrivalDate!) < new Date(earliest.arrivalDate!) ? t : earliest
    ).arrivalDate;
  }, [pendingTransfers]);

  const createTransfer = useCallback(async (
    amountCents: number, currency: string, purpose: TransferPurpose,
    connectedAccountId: string, options?: Record<string, any>
  ) => {
    try {
      return await StripeConnectEngine.createTransfer(id!, amountCents, currency, purpose, connectedAccountId, options);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [id]);

  const cancelTransfer = useCallback(async (transferId: string) => {
    try {
      return await StripeConnectEngine.cancelTransfer(transferId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    transfers, loading, error,
    totalReceived, totalReceivedFormatted, pendingTransfers, completedTransfers,
    failedTransfers, transfersByPurpose, recentTransfers, hasTransfers, nextArrival,
    createTransfer, cancelTransfer,
    refresh: fetchData,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. useStripeDisputes — Disputes + refunds
// ══════════════════════════════════════════════════════════════════════════════

export function useStripeDisputes(memberId?: string) {
  const { user } = useAuth();
  const id = memberId || user?.id;

  const [disputes, setDisputes] = useState<StripeDispute[]>([]);
  const [refunds, setRefunds] = useState<StripeRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [d, r] = await Promise.all([
        StripeConnectEngine.getMemberDisputes(id),
        StripeConnectEngine.getMemberRefunds(id),
      ]);
      setDisputes(d);
      setRefunds(r);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeDisputes = useMemo(() => {
    return disputes.filter(d => d.status === 'needs_response' || d.status === 'warning_needs_response');
  }, [disputes]);

  const totalDisputedAmount = useMemo(() => {
    return disputes.reduce((sum, d) => sum + d.amount, 0) / 100;
  }, [disputes]);

  const totalDisputedFormatted = useMemo(() => {
    return `$${totalDisputedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [totalDisputedAmount]);

  const totalRefunded = useMemo(() => {
    return refunds.filter(r => r.status === 'succeeded').reduce((sum, r) => sum + r.amount, 0) / 100;
  }, [refunds]);

  const totalRefundedFormatted = useMemo(() => {
    return `$${totalRefunded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [totalRefunded]);

  const hasActiveDisputes = useMemo(() => activeDisputes.length > 0, [activeDisputes]);

  const disputeWinRate = useMemo(() => {
    const closed = disputes.filter(d => d.status === 'won' || d.status === 'lost');
    if (closed.length === 0) return null;
    const won = closed.filter(d => d.status === 'won').length;
    return (won / closed.length) * 100;
  }, [disputes]);

  const urgentDisputes = useMemo(() => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return activeDisputes.filter(d =>
      d.evidenceDueBy && new Date(d.evidenceDueBy).getTime() - now <= threeDaysMs
    );
  }, [activeDisputes]);

  const disputesByStatus = useMemo(() => {
    return disputes.reduce<Record<string, StripeDispute[]>>((acc, d) => {
      (acc[d.status] = acc[d.status] || []).push(d);
      return acc;
    }, {});
  }, [disputes]);

  const submitEvidence = useCallback(async (disputeId: string, evidence: Record<string, any>) => {
    try {
      return await StripeConnectEngine.submitDisputeEvidence(disputeId, evidence);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const requestRefund = useCallback(async (
    paymentIntentId: string, amountCents: number, reason: string, description?: string
  ) => {
    try {
      const result = await StripeConnectEngine.createRefund(paymentIntentId, amountCents, reason, description);
      await fetchData();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchData]);

  return {
    disputes, refunds, loading, error,
    activeDisputes, totalDisputedAmount, totalDisputedFormatted,
    totalRefunded, totalRefundedFormatted, hasActiveDisputes,
    disputeWinRate, urgentDisputes, disputesByStatus,
    submitEvidence, requestRefund,
    refresh: fetchData,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. useStripeAdmin — Admin dashboard for payment operations
// ══════════════════════════════════════════════════════════════════════════════

export function useStripeAdmin() {
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [disputeStats, setDisputeStats] = useState<any>(null);
  const [accountStats, setAccountStats] = useState<any>(null);
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payments, disputes, accounts, revenue] = await Promise.all([
        StripeConnectEngine.getPaymentVolumeStats(),
        StripeConnectEngine.getDisputeStats(),
        StripeConnectEngine.getConnectedAccountStats(),
        StripeConnectEngine.getFeeRevenueStats(),
      ]);
      setPaymentStats(payments);
      setDisputeStats(disputes);
      setAccountStats(accounts);
      setRevenueStats(revenue);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasData = useMemo(() => {
    return !!(paymentStats || disputeStats || accountStats || revenueStats);
  }, [paymentStats, disputeStats, accountStats, revenueStats]);

  const totalVolumeFormatted = useMemo(() => {
    if (!paymentStats?.totalVolume) return '$0.00';
    const vol = paymentStats.totalVolume / 100;
    return `$${vol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [paymentStats]);

  const platformRevenueFormatted = useMemo(() => {
    if (!revenueStats?.totalFeeRevenue) return '$0.00';
    const rev = revenueStats.totalFeeRevenue / 100;
    return `$${rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [revenueStats]);

  const disputeRate = useMemo(() => {
    if (!paymentStats?.totalPayments || paymentStats.totalPayments === 0) return 0;
    return ((disputeStats?.totalDisputes ?? 0) / paymentStats.totalPayments) * 100;
  }, [paymentStats, disputeStats]);

  const averagePaymentFormatted = useMemo(() => {
    if (!paymentStats?.averagePayment) return '$0.00';
    const avg = paymentStats.averagePayment / 100;
    return `$${avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [paymentStats]);

  const onboardingCompletionRate = useMemo(() => {
    if (!accountStats?.totalAccounts || accountStats.totalAccounts === 0) return 0;
    return ((accountStats.completeAccounts ?? 0) / accountStats.totalAccounts) * 100;
  }, [accountStats]);

  const getActiveDisputes = useCallback(async () => {
    try {
      return await StripeConnectEngine.getActiveDisputes();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getUnprocessedWebhooks = useCallback(async () => {
    try {
      return await StripeConnectEngine.getUnprocessedWebhooks();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const retryWebhook = useCallback(async (webhookEventId: string) => {
    try {
      return await StripeConnectEngine.retryFailedWebhook(webhookEventId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getMemberSummary = useCallback(async (memberId: string) => {
    try {
      return await StripeConnectEngine.getMemberPaymentSummary(memberId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    paymentStats, disputeStats, accountStats, revenueStats, loading, error,
    hasData, totalVolumeFormatted, platformRevenueFormatted,
    disputeRate, averagePaymentFormatted, onboardingCompletionRate,
    getActiveDisputes, getUnprocessedWebhooks, retryWebhook, getMemberSummary,
    refresh: fetchData,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS — All hooks + re-exported types
// ══════════════════════════════════════════════════════════════════════════════

export type {
  StripeCustomer,
  ConnectedAccount,
  PaymentIntent,
  PaymentMethod,
  PaymentPurpose,
  StripeTransfer,
  TransferPurpose,
  StripeDispute,
  StripeRefund,
} from '../services/StripeConnectEngine';
