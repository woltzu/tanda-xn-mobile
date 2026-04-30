// ═══════════════════════════════════════════════════════════════════════════════
// StripeConnectEngine.ts — Stripe Connect Integration for TandaXn
// ═══════════════════════════════════════════════════════════════════════════════
//
// Full Stripe Connect lifecycle for tontine/ROSCA payments:
//   A. Types & Interfaces
//   B. Mappers (snake_case DB → camelCase app)
//   C. Customer Management (create/update Stripe customers)
//   D. Connected Accounts (Express accounts for payouts)
//   E. Payment Methods (card, bank, Link, CashApp, Apple/Google Pay)
//   F. Payment Intents (money in — contributions, deposits, fees)
//   G. Transfers (money out — circle payouts, claims, withdrawals)
//   H. Webhook Processing (idempotent event handling, status routing)
//   I. Disputes (evidence submission, admin notes)
//   J. Refunds (full/partial, by PI)
//   K. Payout Schedules (connected account payout config)
//   L. Analytics & Admin (volume stats, dispute rates, revenue)
//   M. Realtime Subscriptions
//
// All Stripe SDK calls are stubbed with TODO placeholders returning
// realistic mock data so the system works end-to-end before stripe-node
// is installed.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';


// ─────────────────────────────────────────────────────────────────────────────
// Section A — Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'requires_capture'
  | 'failed';

export type TransferStatus = 'pending' | 'paid' | 'failed' | 'reversed' | 'canceled';

export type DisputeStatus =
  | 'warning_needs_response'
  | 'warning_under_review'
  | 'warning_closed'
  | 'needs_response'
  | 'under_review'
  | 'charge_refunded'
  | 'won'
  | 'lost';

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_verification'
  | 'verified'
  | 'restricted'
  | 'disabled';

export type PaymentPurpose =
  | 'contribution'
  | 'insurance_premium'
  | 'late_fee'
  | 'loan_repayment'
  | 'wallet_deposit'
  | 'membership_fee';

export type TransferPurpose =
  | 'circle_payout'
  | 'insurance_claim'
  | 'loan_disbursement'
  | 'refund'
  | 'withdrawal';

export type PaymentMethodType =
  | 'card'
  | 'us_bank_account'
  | 'link'
  | 'cashapp'
  | 'apple_pay'
  | 'google_pay';

export interface StripeCustomer {
  id: string;
  memberId: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  defaultPaymentMethodId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedAccount {
  id: string;
  memberId: string;
  stripeAccountId: string;
  email: string;
  country: string;
  onboardingStatus: OnboardingStatus;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  capabilities?: Record<string, string>;
  detailsSubmitted: boolean;
  onboardingUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: string;
  memberId: string;
  stripePaymentMethodId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  status: 'active' | 'expired' | 'removed';
  fingerprint?: string;
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  details?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntent {
  id: string;
  memberId: string;
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountCents: number;
  currency: string;
  status: PaymentIntentStatus;
  purpose: PaymentPurpose;
  circleId?: string;
  cycleId?: string;
  paymentMethodId?: string;
  clientSecret?: string;
  description?: string;
  failureReason?: string;
  applicationFeeCents?: number;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  confirmedAt?: string;
  canceledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StripeTransfer {
  id: string;
  memberId: string;
  stripeTransferId: string;
  connectedAccountId: string;
  amountCents: number;
  currency: string;
  status: TransferStatus;
  purpose: TransferPurpose;
  circleId?: string;
  cycleId?: string;
  description?: string;
  failureReason?: string;
  arrivalDate?: string;
  reversalId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  stripeEventId: string;
  eventType: string;
  apiVersion: string;
  livemode: boolean;
  payload: Record<string, any>;
  processed: boolean;
  processedAt?: string;
  processingResult?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
}

export interface StripeDispute {
  id: string;
  memberId: string;
  stripeDisputeId: string;
  paymentIntentId?: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: DisputeStatus;
  evidenceSubmitted: boolean;
  evidenceDueBy?: string;
  evidence?: Record<string, any>;
  adminNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StripeRefund {
  id: string;
  paymentIntentId: string;
  stripeRefundId: string;
  amountCents: number;
  currency: string;
  status: RefundStatus;
  reason?: string;
  description?: string;
  initiatedBy?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutSchedule {
  id: string;
  memberId: string;
  connectedAccountId: string;
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'manual';
  weeklyAnchor?: string;
  monthlyAnchor?: number;
  delayDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentIntentParams {
  memberId: string;
  amountCents: number;
  currency: string;
  purpose: PaymentPurpose;
  circleId?: string;
  cycleId?: string;
  paymentMethodId?: string;
  description?: string;
  idempotencyKey?: string;
}

export interface CreateTransferParams {
  memberId: string;
  amountCents: number;
  currency: string;
  purpose: TransferPurpose;
  connectedAccountId: string;
  circleId?: string;
  cycleId?: string;
  description?: string;
  idempotencyKey?: string;
}

export interface ProcessWebhookResult {
  success: boolean;
  eventId: string;
  eventType: string;
  processed: boolean;
  message: string;
  error?: string;
}


// ─────────────────────────────────────────────────────────────────────────────
// Section B — Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapCustomer(data: any): StripeCustomer {
  return {
    id: data.id,
    memberId: data.member_id,
    stripeCustomerId: data.stripe_customer_id,
    email: data.email,
    name: data.name,
    defaultPaymentMethodId: data.default_payment_method_id,
    metadata: data.metadata,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapConnectedAccount(data: any): ConnectedAccount {
  return {
    id: data.id,
    memberId: data.member_id,
    stripeAccountId: data.stripe_account_id,
    email: data.email,
    country: data.country,
    onboardingStatus: data.onboarding_status,
    payoutsEnabled: data.payouts_enabled,
    chargesEnabled: data.charges_enabled,
    capabilities: data.capabilities,
    detailsSubmitted: data.details_submitted,
    onboardingUrl: data.onboarding_url,
    metadata: data.metadata,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapPaymentMethod(data: any): PaymentMethod {
  return {
    id: data.id,
    memberId: data.member_id,
    stripePaymentMethodId: data.stripe_payment_method_id,
    type: data.type,
    isDefault: data.is_default,
    status: data.status,
    fingerprint: data.fingerprint,
    last4: data.last4,
    brand: data.brand,
    expMonth: data.exp_month,
    expYear: data.exp_year,
    bankName: data.bank_name,
    details: data.details,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapPaymentIntent(data: any): PaymentIntent {
  return {
    id: data.id,
    memberId: data.member_id,
    stripePaymentIntentId: data.stripe_payment_intent_id,
    stripeCustomerId: data.stripe_customer_id,
    amountCents: data.amount_cents,
    currency: data.currency,
    status: data.status,
    purpose: data.purpose,
    circleId: data.circle_id,
    cycleId: data.cycle_id,
    paymentMethodId: data.payment_method_id,
    clientSecret: data.client_secret,
    description: data.description,
    failureReason: data.failure_reason,
    applicationFeeCents: data.application_fee_cents,
    idempotencyKey: data.idempotency_key,
    metadata: data.metadata,
    confirmedAt: data.confirmed_at,
    canceledAt: data.canceled_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapTransfer(data: any): StripeTransfer {
  return {
    id: data.id,
    memberId: data.member_id,
    stripeTransferId: data.stripe_transfer_id,
    connectedAccountId: data.connected_account_id,
    amountCents: data.amount_cents,
    currency: data.currency,
    status: data.status,
    purpose: data.purpose,
    circleId: data.circle_id,
    cycleId: data.cycle_id,
    description: data.description,
    failureReason: data.failure_reason,
    arrivalDate: data.arrival_date,
    reversalId: data.reversal_id,
    idempotencyKey: data.idempotency_key,
    metadata: data.metadata,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapWebhookEvent(data: any): WebhookEvent {
  return {
    id: data.id,
    stripeEventId: data.stripe_event_id,
    eventType: data.event_type,
    apiVersion: data.api_version,
    livemode: data.livemode,
    payload: data.payload,
    processed: data.processed,
    processedAt: data.processed_at,
    processingResult: data.processing_result,
    errorMessage: data.error_message,
    retryCount: data.retry_count,
    createdAt: data.created_at,
  };
}

function mapDispute(data: any): StripeDispute {
  return {
    id: data.id,
    memberId: data.member_id,
    stripeDisputeId: data.stripe_dispute_id,
    paymentIntentId: data.payment_intent_id,
    amountCents: data.amount_cents,
    currency: data.currency,
    reason: data.reason,
    status: data.status,
    evidenceSubmitted: data.evidence_submitted,
    evidenceDueBy: data.evidence_due_by,
    evidence: data.evidence,
    adminNotes: data.admin_notes,
    resolvedAt: data.resolved_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapRefund(data: any): StripeRefund {
  return {
    id: data.id,
    paymentIntentId: data.payment_intent_id,
    stripeRefundId: data.stripe_refund_id,
    amountCents: data.amount_cents,
    currency: data.currency,
    status: data.status,
    reason: data.reason,
    description: data.description,
    initiatedBy: data.initiated_by,
    failureReason: data.failure_reason,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapPayoutSchedule(data: any): PayoutSchedule {
  return {
    id: data.id,
    memberId: data.member_id,
    connectedAccountId: data.connected_account_id,
    scheduleType: data.schedule_type,
    weeklyAnchor: data.weekly_anchor,
    monthlyAnchor: data.monthly_anchor,
    delayDays: data.delay_days,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE CONNECT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class StripeConnectEngine {

  // ─────────────────────────────────────────────────────────────────────────────
  // Section C — Customer Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create or retrieve a Stripe customer for a TandaXn member.
   * If a record already exists in stripe_customers, returns it.
   * Otherwise creates a new Stripe customer and saves the mapping.
   */
  static async createOrGetCustomer(memberId: string, email: string, name?: string): Promise<StripeCustomer> {
    const existing = await this.getCustomer(memberId);
    if (existing) return existing;

    const stripeCustomerId = await this._createStripeCustomer(email, name, memberId);

    const { data, error } = await supabase
      .from('stripe_customers')
      .insert({
        member_id: memberId,
        stripe_customer_id: stripeCustomerId,
        email,
        name: name || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create customer record: ${error.message}`);
    return mapCustomer(data as any);
  }

  /** Retrieve the Stripe customer record for a member, or null if none exists. */
  static async getCustomer(memberId: string): Promise<StripeCustomer | null> {
    const { data, error } = await supabase
      .from('stripe_customers')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (error || !data) return null;
    return mapCustomer(data as any);
  }

  /** Update the email address on both the Stripe customer and the local DB record. */
  static async updateCustomerEmail(memberId: string, email: string): Promise<StripeCustomer> {
    const customer = await this.getCustomer(memberId);
    if (!customer) throw new Error('Customer not found');

    // TODO: Call Stripe API to update customer email
    // await stripe.customers.update(customer.stripeCustomerId, { email });

    const { data, error } = await supabase
      .from('stripe_customers')
      .update({ email, updated_at: new Date().toISOString() })
      .eq('member_id', memberId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update customer email: ${error.message}`);
    return mapCustomer(data as any);
  }

  /**
   * Private: Create a Stripe customer via the API.
   * @returns The Stripe customer ID (e.g. cus_xxx)
   */
  private static async _createStripeCustomer(email: string, name: string | undefined, memberId: string): Promise<string> {
    // TODO: Replace with real Stripe SDK call
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const customer = await stripe.customers.create({
    //   email,
    //   name,
    //   metadata: { tanda_member_id: memberId },
    // });
    // return customer.id;

    const mockId = 'cus_test_' + Math.random().toString(36).substring(2, 15);
    console.log(`[StripeConnectEngine] Mock: Created Stripe customer ${mockId} for member ${memberId}`);
    return mockId;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section D — Connected Accounts (Express)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a Stripe Express connected account for a member to receive payouts.
   * This is required before a member can receive circle payouts via bank transfer.
   */
  static async createConnectedAccount(memberId: string, email: string, country: string = 'US'): Promise<ConnectedAccount> {
    const existing = await this.getConnectedAccount(memberId);
    if (existing) return existing;

    const stripeAccountId = await this._createStripeExpressAccount(email, country);

    const { data, error } = await supabase
      .from('stripe_connected_accounts')
      .insert({
        member_id: memberId,
        stripe_account_id: stripeAccountId,
        email,
        country,
        onboarding_status: 'not_started',
        payouts_enabled: false,
        charges_enabled: false,
        details_submitted: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create connected account record: ${error.message}`);
    return mapConnectedAccount(data as any);
  }

  /** Get the connected account for a member, or null if none exists. */
  static async getConnectedAccount(memberId: string): Promise<ConnectedAccount | null> {
    const { data, error } = await supabase
      .from('stripe_connected_accounts')
      .select('*')
      .eq('member_id', memberId)
      .maybeSingle();

    if (error || !data) return null;
    return mapConnectedAccount(data as any);
  }

  /**
   * Generate an onboarding link for Stripe Express account setup.
   * The member will be redirected to Stripe's hosted onboarding flow.
   * @param returnUrl Where to redirect after onboarding completes
   * @param refreshUrl Where to redirect if the link expires
   */
  static async generateOnboardingLink(memberId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    const account = await this.getConnectedAccount(memberId);
    if (!account) throw new Error('Connected account not found. Create one first.');

    const url = await this._generateAccountLink(account.stripeAccountId, returnUrl, refreshUrl);

    await supabase
      .from('stripe_connected_accounts')
      .update({
        onboarding_status: 'in_progress',
        onboarding_url: url,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId);

    return url;
  }

  /** Update a connected account's status and capabilities (typically from a webhook). */
  static async updateAccountStatus(
    stripeAccountId: string,
    status: OnboardingStatus,
    capabilities?: Record<string, string>
  ): Promise<ConnectedAccount | null> {
    const updateData: Record<string, any> = {
      onboarding_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'verified') {
      updateData.payouts_enabled = true;
      updateData.charges_enabled = true;
      updateData.details_submitted = true;
    }

    if (capabilities) {
      updateData.capabilities = capabilities;
    }

    const { data, error } = await supabase
      .from('stripe_connected_accounts')
      .update(updateData)
      .eq('stripe_account_id', stripeAccountId)
      .select()
      .single();

    if (error || !data) return null;
    return mapConnectedAccount(data as any);
  }

  private static async _createStripeExpressAccount(email: string, country: string): Promise<string> {
    // TODO: Replace with real Stripe SDK call
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const account = await stripe.accounts.create({
    //   type: 'express',
    //   email,
    //   country,
    //   capabilities: { transfers: { requested: true } },
    //   business_type: 'individual',
    // });
    // return account.id;

    const mockId = 'acct_test_' + Math.random().toString(36).substring(2, 15);
    console.log(`[StripeConnectEngine] Mock: Created Express account ${mockId}`);
    return mockId;
  }

  private static async _generateAccountLink(stripeAccountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    // TODO: Replace with real Stripe SDK call
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const link = await stripe.accountLinks.create({
    //   account: stripeAccountId,
    //   return_url: returnUrl,
    //   refresh_url: refreshUrl,
    //   type: 'account_onboarding',
    // });
    // return link.url;

    const mockUrl = `https://connect.stripe.com/setup/e/test_${Date.now()}`;
    console.log(`[StripeConnectEngine] Mock: Generated onboarding link for ${stripeAccountId}`);
    return mockUrl;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section E — Payment Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Save a payment method after client-side setup (SetupIntent or direct attach).
   * The stripePaymentMethodId comes from the Stripe.js / React Native SDK on the frontend.
   */
  static async addPaymentMethod(
    memberId: string,
    stripePaymentMethodId: string,
    type: PaymentMethodType,
    details?: { last4?: string; brand?: string; expMonth?: number; expYear?: number; bankName?: string; fingerprint?: string }
  ): Promise<PaymentMethod> {
    // Check for existing methods — if none, make this the default
    const existing = await this.getPaymentMethods(memberId);
    const isDefault = existing.length === 0;

    const { data, error } = await supabase
      .from('stripe_payment_methods')
      .insert({
        member_id: memberId,
        stripe_payment_method_id: stripePaymentMethodId,
        type,
        is_default: isDefault,
        status: 'active',
        fingerprint: details?.fingerprint || null,
        last4: details?.last4 || null,
        brand: details?.brand || null,
        exp_month: details?.expMonth || null,
        exp_year: details?.expYear || null,
        bank_name: details?.bankName || null,
        details: details || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add payment method: ${error.message}`);
    return mapPaymentMethod(data as any);
  }

  /** List all active payment methods for a member. */
  static async getPaymentMethods(memberId: string): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('stripe_payment_methods')
      .select('*')
      .eq('member_id', memberId)
      .eq('status', 'active')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return (data as any[]).map(mapPaymentMethod);
  }

  /** Set a payment method as the default for a member. Unsets any previous default. */
  static async setDefaultPaymentMethod(memberId: string, paymentMethodId: string): Promise<void> {
    // Unset all defaults for this member
    await supabase
      .from('stripe_payment_methods')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('member_id', memberId);

    // Set the chosen one as default
    const { error } = await supabase
      .from('stripe_payment_methods')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', paymentMethodId)
      .eq('member_id', memberId);

    if (error) throw new Error(`Failed to set default payment method: ${error.message}`);
  }

  /** Soft-delete a payment method by setting status to 'removed'. */
  static async removePaymentMethod(memberId: string, paymentMethodId: string): Promise<void> {
    const { error } = await supabase
      .from('stripe_payment_methods')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', paymentMethodId)
      .eq('member_id', memberId);

    if (error) throw new Error(`Failed to remove payment method: ${error.message}`);
  }

  /** Check if a card with the same fingerprint is already saved for this member. */
  static async checkDuplicateCard(memberId: string, fingerprint: string): Promise<boolean> {
    const { data } = await supabase
      .from('stripe_payment_methods')
      .select('id')
      .eq('member_id', memberId)
      .eq('fingerprint', fingerprint)
      .eq('status', 'active')
      .limit(1);

    return (data && data.length > 0) || false;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section F — Payment Intents (Money In)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a PaymentIntent for collecting money (contributions, deposits, fees).
   * Returns the client_secret so the frontend can confirm the payment.
   * @param params Payment intent parameters including amount, currency, purpose, etc.
   */
  static async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const customer = await this.getCustomer(params.memberId);
    if (!customer) throw new Error('Stripe customer not found. Call createOrGetCustomer first.');

    const applicationFeeCents = this._calculatePlatformFee(params.amountCents, params.purpose);

    const stripeResult = await this._createStripePaymentIntent(
      params.amountCents,
      params.currency,
      customer.stripeCustomerId,
      params.paymentMethodId,
      params.description,
      params.idempotencyKey,
      applicationFeeCents
    );

    const { data, error } = await supabase
      .from('stripe_payment_intents')
      .insert({
        member_id: params.memberId,
        stripe_payment_intent_id: stripeResult.id,
        stripe_customer_id: customer.stripeCustomerId,
        amount_cents: params.amountCents,
        currency: params.currency,
        status: 'requires_payment_method',
        purpose: params.purpose,
        circle_id: params.circleId || null,
        cycle_id: params.cycleId || null,
        payment_method_id: params.paymentMethodId || null,
        client_secret: stripeResult.clientSecret,
        description: params.description || null,
        application_fee_cents: applicationFeeCents,
        idempotency_key: params.idempotencyKey || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create payment intent record: ${error.message}`);
    return mapPaymentIntent(data as any);
  }

  /** Get a payment intent by its internal UUID. */
  static async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null> {
    const { data, error } = await supabase
      .from('stripe_payment_intents')
      .select('*')
      .eq('id', paymentIntentId)
      .single();

    if (error || !data) return null;
    return mapPaymentIntent(data as any);
  }

  /** Get a payment intent by its Stripe ID (pi_xxx). */
  static async getPaymentIntentByStripeId(stripePaymentIntentId: string): Promise<PaymentIntent | null> {
    const { data, error } = await supabase
      .from('stripe_payment_intents')
      .select('*')
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .single();

    if (error || !data) return null;
    return mapPaymentIntent(data as any);
  }

  /**
   * Get paginated payment history for a member.
   * @param limit Number of records to return (default 20)
   * @param offset Number of records to skip (default 0)
   */
  static async getMemberPaymentHistory(memberId: string, limit: number = 20, offset: number = 0): Promise<PaymentIntent[]> {
    const { data, error } = await supabase
      .from('stripe_payment_intents')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return (data as any[]).map(mapPaymentIntent);
  }

  /** Cancel an unconfirmed payment intent. */
  static async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const pi = await this.getPaymentIntent(paymentIntentId);
    if (!pi) throw new Error('Payment intent not found');
    if (pi.status === 'succeeded') throw new Error('Cannot cancel a succeeded payment intent');

    // TODO: Cancel on Stripe
    // await stripe.paymentIntents.cancel(pi.stripePaymentIntentId);

    const { data, error } = await supabase
      .from('stripe_payment_intents')
      .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', paymentIntentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel payment intent: ${error.message}`);
    return mapPaymentIntent(data as any);
  }

  /** Calculate the platform application fee based on purpose. */
  private static _calculatePlatformFee(amountCents: number, purpose: PaymentPurpose): number {
    const feeRates: Record<PaymentPurpose, number> = {
      contribution: 0.015,       // 1.5% on circle contributions
      insurance_premium: 0.02,   // 2% on insurance
      late_fee: 0.0,             // no fee on late fees (already a penalty)
      loan_repayment: 0.01,      // 1% on loan repayments
      wallet_deposit: 0.005,     // 0.5% on wallet deposits
      membership_fee: 0.0,       // no fee on membership (goes to platform)
    };
    return Math.round(amountCents * (feeRates[purpose] || 0.01));
  }

  private static async _createStripePaymentIntent(
    amountCents: number,
    currency: string,
    customerId: string,
    paymentMethodId?: string,
    description?: string,
    idempotencyKey?: string,
    applicationFeeCents?: number
  ): Promise<{ id: string; clientSecret: string }> {
    // TODO: Replace with real Stripe SDK call
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const pi = await stripe.paymentIntents.create({
    //   amount: amountCents,
    //   currency,
    //   customer: customerId,
    //   payment_method: paymentMethodId,
    //   description,
    //   application_fee_amount: applicationFeeCents,
    //   automatic_payment_methods: { enabled: true },
    // }, { idempotencyKey });
    // return { id: pi.id, clientSecret: pi.client_secret };

    const mockId = 'pi_test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const mockSecret = mockId + '_secret_' + Math.random().toString(36).substring(2, 10);
    console.log(`[StripeConnectEngine] Mock: Created PI ${mockId} for ${amountCents} ${currency}`);
    return { id: mockId, clientSecret: mockSecret };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section G — Transfers (Money Out)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a transfer to a connected account (circle payout, insurance claim, etc.).
   * Funds are moved from the platform's Stripe balance to the connected account.
   */
  static async createTransfer(params: CreateTransferParams): Promise<StripeTransfer> {
    const stripeResult = await this._createStripeTransfer(
      params.amountCents,
      params.currency,
      params.connectedAccountId,
      params.description,
      params.idempotencyKey
    );

    const { data, error } = await supabase
      .from('stripe_transfers')
      .insert({
        member_id: params.memberId,
        stripe_transfer_id: stripeResult.id,
        connected_account_id: params.connectedAccountId,
        amount_cents: params.amountCents,
        currency: params.currency,
        status: 'pending',
        purpose: params.purpose,
        circle_id: params.circleId || null,
        cycle_id: params.cycleId || null,
        description: params.description || null,
        idempotency_key: params.idempotencyKey || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create transfer record: ${error.message}`);
    return mapTransfer(data as any);
  }

  /** Get a transfer by its internal UUID. */
  static async getTransfer(transferId: string): Promise<StripeTransfer | null> {
    const { data, error } = await supabase
      .from('stripe_transfers')
      .select('*')
      .eq('id', transferId)
      .single();

    if (error || !data) return null;
    return mapTransfer(data as any);
  }

  /** Get paginated transfers for a member. */
  static async getMemberTransfers(memberId: string, limit: number = 20, offset: number = 0): Promise<StripeTransfer[]> {
    const { data, error } = await supabase
      .from('stripe_transfers')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return (data as any[]).map(mapTransfer);
  }

  /** Get all transfers associated with a specific circle. */
  static async getCircleTransfers(circleId: string): Promise<StripeTransfer[]> {
    const { data, error } = await supabase
      .from('stripe_transfers')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return (data as any[]).map(mapTransfer);
  }

  /** Cancel a pending transfer. Only pending transfers can be canceled. */
  static async cancelTransfer(transferId: string): Promise<StripeTransfer> {
    const transfer = await this.getTransfer(transferId);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'pending') throw new Error(`Cannot cancel transfer with status: ${transfer.status}`);

    // TODO: Cancel on Stripe if supported
    // await stripe.transfers.createReversal(transfer.stripeTransferId);

    const { data, error } = await supabase
      .from('stripe_transfers')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', transferId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel transfer: ${error.message}`);
    return mapTransfer(data as any);
  }

  private static async _createStripeTransfer(
    amountCents: number,
    currency: string,
    destinationAccountId: string,
    description?: string,
    idempotencyKey?: string
  ): Promise<{ id: string }> {
    // TODO: Replace with real Stripe SDK call
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const transfer = await stripe.transfers.create({
    //   amount: amountCents,
    //   currency,
    //   destination: destinationAccountId,
    //   description,
    // }, { idempotencyKey });
    // return { id: transfer.id };

    const mockId = 'tr_test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    console.log(`[StripeConnectEngine] Mock: Created transfer ${mockId} for ${amountCents} ${currency} → ${destinationAccountId}`);
    return { id: mockId };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section H — Webhook Processing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process an incoming Stripe webhook event.
   * Handles idempotency (skips already-processed events), logs to stripe_webhook_events,
   * routes to the appropriate handler, and marks as processed.
   */
  static async processWebhook(
    stripeEventId: string,
    eventType: string,
    apiVersion: string,
    livemode: boolean,
    payload: Record<string, any>
  ): Promise<ProcessWebhookResult> {
    // Idempotency check — skip if already processed
    const { data: existingEvent } = await supabase
      .from('stripe_webhook_events')
      .select('id, processed')
      .eq('stripe_event_id', stripeEventId)
      .single();

    if (existingEvent && (existingEvent as any).processed) {
      return {
        success: true,
        eventId: stripeEventId,
        eventType,
        processed: false,
        message: 'Event already processed (idempotency skip)',
      };
    }

    // Log the webhook event
    const { data: eventRecord, error: insertError } = await supabase
      .from('stripe_webhook_events')
      .upsert({
        stripe_event_id: stripeEventId,
        event_type: eventType,
        api_version: apiVersion,
        livemode,
        payload,
        processed: false,
        retry_count: existingEvent ? ((existingEvent as any).retry_count || 0) + 1 : 0,
      }, { onConflict: 'stripe_event_id' })
      .select()
      .single();

    if (insertError) {
      return {
        success: false,
        eventId: stripeEventId,
        eventType,
        processed: false,
        message: 'Failed to log webhook event',
        error: insertError.message,
      };
    }

    const webhookId = (eventRecord as any).id;

    try {
      // Route to the appropriate handler
      let result = 'unhandled';
      switch (eventType) {
        case 'payment_intent.succeeded':
          result = await this._handlePaymentSuccess(payload);
          break;
        case 'payment_intent.payment_failed':
          result = await this._handlePaymentFailure(payload);
          break;
        case 'payment_intent.canceled':
          result = await this._handlePaymentCanceled(payload);
          break;
        case 'transfer.paid':
          result = await this._handleTransferPaid(payload);
          break;
        case 'transfer.failed':
          result = await this._handleTransferFailed(payload);
          break;
        case 'transfer.reversed':
          result = await this._handleTransferReversed(payload);
          break;
        case 'account.updated':
          result = await this._handleAccountUpdated(payload);
          break;
        case 'charge.dispute.created':
          result = await this._handleDisputeCreated(payload);
          break;
        case 'charge.dispute.updated':
          result = await this._handleDisputeUpdated(payload);
          break;
        case 'charge.dispute.closed':
          result = await this._handleDisputeClosed(payload);
          break;
        case 'charge.refunded':
          result = await this._handleRefundCompleted(payload);
          break;
        default:
          result = `unhandled_event_type: ${eventType}`;
      }

      // Mark as processed
      await supabase
        .from('stripe_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString(), processing_result: result })
        .eq('id', webhookId);

      return {
        success: true,
        eventId: stripeEventId,
        eventType,
        processed: true,
        message: result,
      };
    } catch (err: any) {
      await supabase
        .from('stripe_webhook_events')
        .update({ error_message: err.message, processing_result: 'error' })
        .eq('id', webhookId);

      return {
        success: false,
        eventId: stripeEventId,
        eventType,
        processed: false,
        message: 'Webhook processing failed',
        error: err.message,
      };
    }
  }

  private static async _handlePaymentSuccess(payload: Record<string, any>): Promise<string> {
    const piId = payload.data?.object?.id;
    if (!piId) return 'no_payment_intent_id';

    await supabase
      .from('stripe_payment_intents')
      .update({
        status: 'succeeded',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', piId);

    // TODO: Trigger contribution credit in ContributionProcessingService
    // await ContributionProcessingService.creditContribution(piId);

    return 'payment_succeeded';
  }

  private static async _handlePaymentFailure(payload: Record<string, any>): Promise<string> {
    const piId = payload.data?.object?.id;
    const failureReason = payload.data?.object?.last_payment_error?.message || 'unknown';

    if (!piId) return 'no_payment_intent_id';

    await supabase
      .from('stripe_payment_intents')
      .update({
        status: 'failed',
        failure_reason: failureReason,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', piId);

    return 'payment_failed';
  }

  private static async _handlePaymentCanceled(payload: Record<string, any>): Promise<string> {
    const piId = payload.data?.object?.id;
    if (!piId) return 'no_payment_intent_id';

    await supabase
      .from('stripe_payment_intents')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', piId);

    return 'payment_canceled';
  }

  private static async _handleTransferPaid(payload: Record<string, any>): Promise<string> {
    const transferId = payload.data?.object?.id;
    if (!transferId) return 'no_transfer_id';

    await supabase
      .from('stripe_transfers')
      .update({
        status: 'paid',
        arrival_date: payload.data?.object?.arrival_date
          ? new Date(payload.data.object.arrival_date * 1000).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_transfer_id', transferId);

    return 'transfer_paid';
  }

  private static async _handleTransferFailed(payload: Record<string, any>): Promise<string> {
    const transferId = payload.data?.object?.id;
    const failureReason = payload.data?.object?.failure_message || 'unknown';

    if (!transferId) return 'no_transfer_id';

    await supabase
      .from('stripe_transfers')
      .update({
        status: 'failed',
        failure_reason: failureReason,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_transfer_id', transferId);

    return 'transfer_failed';
  }

  private static async _handleTransferReversed(payload: Record<string, any>): Promise<string> {
    const transferId = payload.data?.object?.id;
    const reversalId = payload.data?.object?.reversals?.data?.[0]?.id || null;

    if (!transferId) return 'no_transfer_id';

    await supabase
      .from('stripe_transfers')
      .update({
        status: 'reversed',
        reversal_id: reversalId,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_transfer_id', transferId);

    return 'transfer_reversed';
  }

  private static async _handleAccountUpdated(payload: Record<string, any>): Promise<string> {
    const accountId = payload.data?.object?.id;
    if (!accountId) return 'no_account_id';

    const account = payload.data?.object;
    let status: OnboardingStatus = 'in_progress';

    if (account.details_submitted && account.payouts_enabled) {
      status = 'verified';
    } else if (account.requirements?.disabled_reason) {
      status = 'restricted';
    } else if (account.details_submitted) {
      status = 'pending_verification';
    }

    await this.updateAccountStatus(accountId, status, account.capabilities);
    return 'account_updated';
  }

  private static async _handleDisputeCreated(payload: Record<string, any>): Promise<string> {
    const dispute = payload.data?.object;
    if (!dispute) return 'no_dispute_data';

    const chargeId = dispute.charge;
    const piId = dispute.payment_intent;

    // Find the member via the payment intent
    const { data: piRecord } = await supabase
      .from('stripe_payment_intents')
      .select('member_id')
      .eq('stripe_payment_intent_id', piId)
      .single();

    const memberId = (piRecord as any)?.member_id || null;

    await supabase
      .from('stripe_disputes')
      .insert({
        member_id: memberId,
        stripe_dispute_id: dispute.id,
        payment_intent_id: piId,
        amount_cents: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason || 'unknown',
        status: dispute.status || 'needs_response',
        evidence_submitted: false,
        evidence_due_by: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
          : null,
      });

    return 'dispute_created';
  }

  private static async _handleDisputeUpdated(payload: Record<string, any>): Promise<string> {
    const dispute = payload.data?.object;
    if (!dispute) return 'no_dispute_data';

    await supabase
      .from('stripe_disputes')
      .update({
        status: dispute.status,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_dispute_id', dispute.id);

    return 'dispute_updated';
  }

  private static async _handleDisputeClosed(payload: Record<string, any>): Promise<string> {
    const dispute = payload.data?.object;
    if (!dispute) return 'no_dispute_data';

    await supabase
      .from('stripe_disputes')
      .update({
        status: dispute.status,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_dispute_id', dispute.id);

    return 'dispute_closed';
  }

  private static async _handleRefundCompleted(payload: Record<string, any>): Promise<string> {
    const refund = payload.data?.object?.refunds?.data?.[0] || payload.data?.object;
    if (!refund) return 'no_refund_data';

    await supabase
      .from('stripe_refunds')
      .update({
        status: refund.status === 'succeeded' ? 'succeeded' : refund.status,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_refund_id', refund.id);

    return 'refund_completed';
  }

  /**
   * Validate a Stripe webhook signature using HMAC-SHA256.
   * @returns true if the signature is valid
   */
  static async validateWebhookSignature(payload: string, signature: string, webhookSecret: string): Promise<boolean> {
    // TODO: Replace with real Stripe signature verification
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // try {
    //   stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    //   return true;
    // } catch (err) {
    //   console.error('Webhook signature verification failed:', err);
    //   return false;
    // }

    // Mock: accept all signatures in test mode
    console.log('[StripeConnectEngine] Mock: Skipping webhook signature validation');
    return true;
  }

  /** Get unprocessed webhook events for retry processing. */
  static async getUnprocessedWebhooks(limit: number = 50): Promise<WebhookEvent[]> {
    const { data, error } = await supabase
      .from('stripe_webhook_events')
      .select('*')
      .eq('processed', false)
      .lt('retry_count', 5)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) return [];
    return (data as any[]).map(mapWebhookEvent);
  }

  /** Re-process a previously failed webhook event. */
  static async retryFailedWebhook(webhookEventId: string): Promise<ProcessWebhookResult> {
    const { data, error } = await supabase
      .from('stripe_webhook_events')
      .select('*')
      .eq('id', webhookEventId)
      .single();

    if (error || !data) {
      return { success: false, eventId: webhookEventId, eventType: 'unknown', processed: false, message: 'Webhook event not found' };
    }

    const event = mapWebhookEvent(data as any);
    return this.processWebhook(event.stripeEventId, event.eventType, event.apiVersion, event.livemode, event.payload);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section I — Disputes
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all disputes that currently need a response. */
  static async getActiveDisputes(): Promise<StripeDispute[]> {
    const { data, error } = await supabase
      .from('stripe_disputes')
      .select('*')
      .in('status', ['needs_response', 'warning_needs_response'])
      .order('evidence_due_by', { ascending: true });

    if (error || !data) return [];
    return (data as any[]).map(mapDispute);
  }

  /** Get all disputes for a specific member. */
  static async getMemberDisputes(memberId: string): Promise<StripeDispute[]> {
    const { data, error } = await supabase
      .from('stripe_disputes')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return (data as any[]).map(mapDispute);
  }

  /**
   * Submit evidence for a dispute.
   * @param evidence Object containing evidence fields (e.g. customer_email, receipt, etc.)
   */
  static async submitDisputeEvidence(disputeId: string, evidence: Record<string, any>): Promise<StripeDispute> {
    // TODO: Submit evidence to Stripe
    // await stripe.disputes.update(dispute.stripeDisputeId, { evidence, submit: true });

    const { data, error } = await supabase
      .from('stripe_disputes')
      .update({
        evidence,
        evidence_submitted: true,
        status: 'under_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', disputeId)
      .select()
      .single();

    if (error) throw new Error(`Failed to submit dispute evidence: ${error.message}`);
    return mapDispute(data as any);
  }

  /** Add admin notes to a dispute for internal tracking. */
  static async addDisputeNotes(disputeId: string, notes: string): Promise<StripeDispute> {
    const { data, error } = await supabase
      .from('stripe_disputes')
      .update({ admin_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', disputeId)
      .select()
      .single();

    if (error) throw new Error(`Failed to add dispute notes: ${error.message}`);
    return mapDispute(data as any);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section J — Refunds
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a refund for a payment intent.
   * @param paymentIntentId Internal UUID of the payment intent
   * @param amountCents Amount to refund in cents (null for full refund)
   * @param reason Reason for the refund
   * @param initiatedBy ID of the admin/system that initiated the refund
   * @param description Human-readable description
   */
  static async createRefund(
    paymentIntentId: string,
    amountCents: number | null,
    reason: string,
    initiatedBy?: string,
    description?: string
  ): Promise<StripeRefund> {
    const pi = await this.getPaymentIntent(paymentIntentId);
    if (!pi) throw new Error('Payment intent not found');
    if (pi.status !== 'succeeded') throw new Error('Can only refund succeeded payment intents');

    const refundAmount = amountCents || pi.amountCents;

    // TODO: Replace with real Stripe SDK call
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const refund = await stripe.refunds.create({
    //   payment_intent: pi.stripePaymentIntentId,
    //   amount: refundAmount,
    //   reason,
    // });
    const mockRefundId = 're_test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

    const { data, error } = await supabase
      .from('stripe_refunds')
      .insert({
        payment_intent_id: paymentIntentId,
        stripe_refund_id: mockRefundId,
        amount_cents: refundAmount,
        currency: pi.currency,
        status: 'pending',
        reason,
        description: description || null,
        initiated_by: initiatedBy || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create refund record: ${error.message}`);
    return mapRefund(data as any);
  }

  /** Get a refund by its internal UUID. */
  static async getRefund(refundId: string): Promise<StripeRefund | null> {
    const { data, error } = await supabase
      .from('stripe_refunds')
      .select('*')
      .eq('id', refundId)
      .single();

    if (error || !data) return null;
    return mapRefund(data as any);
  }

  /** Get all refunds for a member (by looking up their payment intents). */
  static async getMemberRefunds(memberId: string): Promise<StripeRefund[]> {
    const { data, error } = await supabase
      .from('stripe_refunds')
      .select('*, stripe_payment_intents!inner(member_id)')
      .eq('stripe_payment_intents.member_id', memberId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return (data as any[]).map(mapRefund);
  }

  /** Get all refunds associated with a specific payment intent. */
  static async getRefundsByPaymentIntent(paymentIntentId: string): Promise<StripeRefund[]> {
    const { data, error } = await supabase
      .from('stripe_refunds')
      .select('*')
      .eq('payment_intent_id', paymentIntentId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return (data as any[]).map(mapRefund);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section K — Payout Schedules
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Configure the payout schedule for a member's connected account.
   * @param scheduleType 'daily' | 'weekly' | 'monthly' | 'manual'
   * @param options Additional options like weeklyAnchor, monthlyAnchor, delayDays
   */
  static async setPayoutSchedule(
    memberId: string,
    scheduleType: 'daily' | 'weekly' | 'monthly' | 'manual',
    options?: { weeklyAnchor?: string; monthlyAnchor?: number; delayDays?: number }
  ): Promise<PayoutSchedule> {
    const account = await this.getConnectedAccount(memberId);
    if (!account) throw new Error('Connected account not found');

    // TODO: Update on Stripe
    // await stripe.accounts.update(account.stripeAccountId, {
    //   settings: { payouts: { schedule: { interval: scheduleType, ... } } }
    // });

    const { data, error } = await supabase
      .from('stripe_payout_schedules')
      .upsert({
        member_id: memberId,
        connected_account_id: account.stripeAccountId,
        schedule_type: scheduleType,
        weekly_anchor: options?.weeklyAnchor || null,
        monthly_anchor: options?.monthlyAnchor || null,
        delay_days: options?.delayDays ?? 2,
        is_active: true,
      }, { onConflict: 'member_id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to set payout schedule: ${error.message}`);
    return mapPayoutSchedule(data as any);
  }

  /** Get the current payout schedule for a member. */
  static async getPayoutSchedule(memberId: string): Promise<PayoutSchedule | null> {
    const { data, error } = await supabase
      .from('stripe_payout_schedules')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (error || !data) return null;
    return mapPayoutSchedule(data as any);
  }

  /** Pause payouts for a member's connected account. */
  static async pausePayouts(memberId: string): Promise<PayoutSchedule> {
    const { data, error } = await supabase
      .from('stripe_payout_schedules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('member_id', memberId)
      .select()
      .single();

    if (error) throw new Error(`Failed to pause payouts: ${error.message}`);
    return mapPayoutSchedule(data as any);
  }

  /** Resume payouts for a member's connected account. */
  static async resumePayouts(memberId: string): Promise<PayoutSchedule> {
    const { data, error } = await supabase
      .from('stripe_payout_schedules')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('member_id', memberId)
      .select()
      .single();

    if (error) throw new Error(`Failed to resume payouts: ${error.message}`);
    return mapPayoutSchedule(data as any);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section L — Analytics & Admin
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get aggregate payment statistics for a date range.
   * Returns total volume, success rate, average amount, and breakdown by purpose.
   */
  static async getPaymentStats(dateFrom?: string, dateTo?: string): Promise<{
    totalVolumeCents: number;
    totalCount: number;
    succeededCount: number;
    failedCount: number;
    successRate: number;
    averageAmountCents: number;
    byPurpose: Record<string, { count: number; volumeCents: number }>;
  }> {
    let query = supabase.from('stripe_payment_intents').select('*');

    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query;
    if (error || !data) {
      return { totalVolumeCents: 0, totalCount: 0, succeededCount: 0, failedCount: 0, successRate: 0, averageAmountCents: 0, byPurpose: {} };
    }

    const rows = data as any[];
    const succeeded = rows.filter(r => r.status === 'succeeded');
    const failed = rows.filter(r => r.status === 'failed');
    const totalVolume = succeeded.reduce((sum: number, r: any) => sum + (r.amount_cents || 0), 0);

    const byPurpose: Record<string, { count: number; volumeCents: number }> = {};
    for (const row of succeeded) {
      const purpose = row.purpose || 'unknown';
      if (!byPurpose[purpose]) byPurpose[purpose] = { count: 0, volumeCents: 0 };
      byPurpose[purpose].count++;
      byPurpose[purpose].volumeCents += row.amount_cents || 0;
    }

    return {
      totalVolumeCents: totalVolume,
      totalCount: rows.length,
      succeededCount: succeeded.length,
      failedCount: failed.length,
      successRate: rows.length > 0 ? succeeded.length / rows.length : 0,
      averageAmountCents: succeeded.length > 0 ? Math.round(totalVolume / succeeded.length) : 0,
      byPurpose,
    };
  }

  /** Get dispute statistics: open count, win rate, total disputed amount. */
  static async getDisputeStats(): Promise<{
    totalDisputes: number;
    openDisputes: number;
    wonCount: number;
    lostCount: number;
    winRate: number;
    totalDisputedAmountCents: number;
  }> {
    const { data, error } = await supabase.from('stripe_disputes').select('*');
    if (error || !data) {
      return { totalDisputes: 0, openDisputes: 0, wonCount: 0, lostCount: 0, winRate: 0, totalDisputedAmountCents: 0 };
    }

    const rows = data as any[];
    const open = rows.filter(r => ['needs_response', 'warning_needs_response', 'under_review', 'warning_under_review'].includes(r.status));
    const won = rows.filter(r => r.status === 'won');
    const lost = rows.filter(r => r.status === 'lost');
    const resolved = won.length + lost.length;

    return {
      totalDisputes: rows.length,
      openDisputes: open.length,
      wonCount: won.length,
      lostCount: lost.length,
      winRate: resolved > 0 ? won.length / resolved : 0,
      totalDisputedAmountCents: rows.reduce((sum: number, r: any) => sum + (r.amount_cents || 0), 0),
    };
  }

  /** Get connected account statistics: total, by onboarding status, payout-enabled count. */
  static async getConnectedAccountStats(): Promise<{
    totalAccounts: number;
    byStatus: Record<string, number>;
    payoutsEnabledCount: number;
  }> {
    const { data, error } = await supabase.from('stripe_connected_accounts').select('*');
    if (error || !data) {
      return { totalAccounts: 0, byStatus: {}, payoutsEnabledCount: 0 };
    }

    const rows = data as any[];
    const byStatus: Record<string, number> = {};
    let payoutsEnabled = 0;

    for (const row of rows) {
      const status = row.onboarding_status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (row.payouts_enabled) payoutsEnabled++;
    }

    return {
      totalAccounts: rows.length,
      byStatus,
      payoutsEnabledCount: payoutsEnabled,
    };
  }

  /** Get total platform fee revenue for a date range. */
  static async getRevenueFromFees(dateFrom?: string, dateTo?: string): Promise<{
    totalFeeCents: number;
    feeCount: number;
    averageFeeCents: number;
  }> {
    let query = supabase
      .from('stripe_payment_intents')
      .select('application_fee_cents')
      .eq('status', 'succeeded')
      .not('application_fee_cents', 'is', null);

    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query;
    if (error || !data) return { totalFeeCents: 0, feeCount: 0, averageFeeCents: 0 };

    const rows = data as any[];
    const total = rows.reduce((sum: number, r: any) => sum + (r.application_fee_cents || 0), 0);

    return {
      totalFeeCents: total,
      feeCount: rows.length,
      averageFeeCents: rows.length > 0 ? Math.round(total / rows.length) : 0,
    };
  }

  /**
   * Get a comprehensive payment summary for a single member.
   * Includes total deposited, received, disputed, and refunded amounts.
   */
  static async getMemberPaymentSummary(memberId: string): Promise<{
    totalDepositedCents: number;
    totalReceivedCents: number;
    totalDisputedCents: number;
    totalRefundedCents: number;
    paymentCount: number;
    transferCount: number;
  }> {
    // Parallel queries for all aggregation data
    const [paymentsRes, transfersRes, disputesRes, refundsRes] = await Promise.all([
      supabase.from('stripe_payment_intents').select('amount_cents, status').eq('member_id', memberId),
      supabase.from('stripe_transfers').select('amount_cents, status').eq('member_id', memberId),
      supabase.from('stripe_disputes').select('amount_cents').eq('member_id', memberId),
      supabase.from('stripe_refunds').select('amount_cents, stripe_payment_intents!inner(member_id)').eq('stripe_payment_intents.member_id', memberId),
    ]);

    const payments = (paymentsRes.data as any[]) || [];
    const transfers = (transfersRes.data as any[]) || [];
    const disputes = (disputesRes.data as any[]) || [];
    const refunds = (refundsRes.data as any[]) || [];

    const succeededPayments = payments.filter(p => p.status === 'succeeded');
    const paidTransfers = transfers.filter(t => t.status === 'paid');

    return {
      totalDepositedCents: succeededPayments.reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0),
      totalReceivedCents: paidTransfers.reduce((sum: number, t: any) => sum + (t.amount_cents || 0), 0),
      totalDisputedCents: disputes.reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0),
      totalRefundedCents: refunds.reduce((sum: number, r: any) => sum + (r.amount_cents || 0), 0),
      paymentCount: succeededPayments.length,
      transferCount: paidTransfers.length,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Section M — Realtime Subscriptions
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to realtime changes on a member's payment intents.
   * Useful for updating the UI when a payment status changes (e.g. succeeded after 3DS).
   * @returns An object with an unsubscribe() method
   */
  static subscribeToPaymentIntents(
    memberId: string,
    callback: (payload: { new: PaymentIntent; old: PaymentIntent | null; eventType: string }) => void
  ) {
    const channel = supabase
      .channel(`payment_intents:${memberId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'stripe_payment_intents',
          filter: `member_id=eq.${memberId}`,
        },
        (payload: any) => {
          callback({
            new: mapPaymentIntent(payload.new),
            old: payload.old ? mapPaymentIntent(payload.old) : null,
            eventType: payload.eventType,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  /**
   * Subscribe to realtime changes on a member's transfers.
   * @returns An object with an unsubscribe() method
   */
  static subscribeToTransfers(
    memberId: string,
    callback: (payload: { new: StripeTransfer; old: StripeTransfer | null; eventType: string }) => void
  ) {
    const channel = supabase
      .channel(`transfers:${memberId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'stripe_transfers',
          filter: `member_id=eq.${memberId}`,
        },
        (payload: any) => {
          callback({
            new: mapTransfer(payload.new),
            old: payload.old ? mapTransfer(payload.old) : null,
            eventType: payload.eventType,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  /**
   * Subscribe to realtime changes on a member's connected account status.
   * Useful for updating the UI during onboarding when Stripe sends account.updated webhooks.
   * @returns An object with an unsubscribe() method
   */
  static subscribeToAccountStatus(
    memberId: string,
    callback: (payload: { new: ConnectedAccount; old: ConnectedAccount | null; eventType: string }) => void
  ) {
    const channel = supabase
      .channel(`connected_account:${memberId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'stripe_connected_accounts',
          filter: `member_id=eq.${memberId}`,
        },
        (payload: any) => {
          callback({
            new: mapConnectedAccount(payload.new),
            old: payload.old ? mapConnectedAccount(payload.old) : null,
            eventType: payload.eventType,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
}
