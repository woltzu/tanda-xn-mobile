// ══════════════════════════════════════════════════════════════════════════════
// CREDITWORTHINESS ENGINE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
// Behavioral-based lending for the credit invisible.
// Transforms XnScore + behavioral data into creditworthiness assessments.
//
// THE FIVE PILLARS:
// 1. XnScore (40%) - Trust foundation → Credit Score 300-850
// 2. Circle Health (15%) - Quality of circles
// 3. Loan History (20%) - Previous loan performance
// 4. Capacity (Amount) - Contribution history, wallet, savings
// 5. Community Collateral (APR) - Vouches, guarantees, co-signers
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPES                                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'E';
export type LoanPurpose = 'emergency' | 'circle_contribution' | 'education' | 'business' | 'medical' | 'other';
export type LoanApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'accepted' | 'disbursed' | 'cancelled' | 'expired';
export type LoanStatus = 'active' | 'paid_off' | 'defaulted' | 'written_off' | 'in_collections';
export type PaymentScheduleStatus = 'scheduled' | 'partial' | 'paid' | 'late' | 'missed' | 'waived';
export type CreditRecommendation = 'approve' | 'approve_with_conditions' | 'manual_review' | 'reject';
export type GuaranteeStatus = 'pending' | 'active' | 'released' | 'called' | 'paid';

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  min_xnscore: number;
  min_account_age_days: number;
  min_completed_circles: number;
  min_amount_cents: number;
  max_amount_cents: number;
  min_term_months: number;
  max_term_months: number;
  allowed_terms: number[];
  base_apr_min: number;
  base_apr_max: number;
  origination_fee_percent: number;
  late_fee_flat_cents: number;
  late_fee_percent: number;
  grace_period_days: number;
  allowed_purposes: LoanPurpose[];
  requires_elder_guarantee: boolean;
  requires_cosigner: boolean;
  is_active: boolean;
}

export interface CreditworthinessAssessment {
  id: string;
  user_id: string;
  loan_product_id: string | null;
  requested_amount_cents: number;
  requested_term_months: number;
  loan_purpose: LoanPurpose;

  // Pillar 1: XnScore
  xnscore_at_assessment: number;
  xnscore_base_credit_score: number;

  // Pillar 2: Circle Health
  circle_health_score: number;
  circle_health_adjustment: number;
  avg_circle_risk_score: number | null;
  circles_assessed: number;

  // Pillar 3: Loan History
  loan_history_score: number;
  loan_history_adjustment: number;
  loans_repaid_count: number;
  loans_defaulted_count: number;
  total_late_payments: number;
  has_active_delinquency: boolean;

  // Final Credit Score
  raw_credit_score: number;
  final_credit_score: number;
  risk_grade: RiskGrade;

  // Pillar 4: Capacity
  contribution_capacity_cents: number;
  wallet_capacity_cents: number;
  savings_capacity_cents: number;
  total_capacity_cents: number;
  existing_obligations_cents: number;
  score_based_limit_cents: number;
  final_max_amount_cents: number;

  // Pillar 5: Community Collateral
  vouch_count: number;
  vouch_discount_percent: number;
  elder_guarantee_user_id: string | null;
  elder_guarantee_coverage_percent: number | null;
  elder_guarantee_discount_percent: number;
  co_signer_user_id: string | null;
  co_signer_xnscore: number | null;
  co_signer_discount_percent: number;
  total_community_discount_percent: number;

  // Rates
  base_apr: number;
  final_apr: number;

  // Decision
  is_eligible: boolean;
  rejection_reasons: string[] | null;
  approved_amount_cents: number | null;

  // Repayment
  monthly_payment_cents: number | null;
  total_interest_cents: number | null;
  total_repayment_cents: number | null;

  // Recommendation
  system_recommendation: CreditRecommendation;
  recommended_conditions: string[] | null;

  // Metadata
  expires_at: string;
  factor_breakdown: Record<string, any>;
  calculated_at: string;
}

export interface LoanApplication {
  id: string;
  user_id: string;
  assessment_id: string;
  loan_product_id: string;
  requested_amount_cents: number;
  approved_amount_cents: number | null;
  term_months: number;
  purpose: LoanPurpose;
  purpose_description: string | null;
  apr: number;
  origination_fee_cents: number;
  monthly_payment_cents: number;
  total_interest_cents: number;
  total_repayment_cents: number;
  status: LoanApplicationStatus;
  status_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  terms_accepted_at: string | null;
  disbursed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  application_id: string;
  loan_product_id: string;
  principal_cents: number;
  apr: number;
  term_months: number;
  origination_fee_cents: number;
  first_payment_date: string;
  final_payment_date: string;
  monthly_payment_cents: number;
  outstanding_principal_cents: number;
  outstanding_interest_cents: number;
  outstanding_fees_cents: number;
  total_outstanding_cents: number;
  payments_made: number;
  payments_total: number;
  next_payment_date: string | null;
  next_payment_amount_cents: number | null;
  days_past_due: number;
  is_delinquent: boolean;
  delinquent_since: string | null;
  status: LoanStatus;
  closed_at: string | null;
  closed_reason: string | null;
  elder_guarantee_id: string | null;
  co_signer_id: string | null;
  created_at: string;
}

export interface PaymentScheduleEntry {
  id: string;
  loan_id: string;
  payment_number: number;
  due_date: string;
  principal_due_cents: number;
  interest_due_cents: number;
  fees_due_cents: number;
  total_due_cents: number;
  principal_paid_cents: number;
  interest_paid_cents: number;
  fees_paid_cents: number;
  total_paid_cents: number;
  status: PaymentScheduleStatus;
  paid_at: string | null;
  late_fee_cents: number;
  late_fee_waived: boolean;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  user_id: string;
  schedule_id: string | null;
  amount_cents: number;
  principal_cents: number;
  interest_cents: number;
  fees_cents: number;
  payment_method: string;
  payment_source_id: string | null;
  was_on_time: boolean;
  days_late: number;
  status: string;
  processed_at: string | null;
  created_at: string;
}

export interface LoanGuarantee {
  id: string;
  guarantor_user_id: string;
  guarantor_xnscore_at_guarantee: number;
  borrower_user_id: string;
  loan_application_id: string | null;
  loan_id: string | null;
  coverage_percent: number;
  max_liability_cents: number;
  status: GuaranteeStatus;
  called_at: string | null;
  called_amount_cents: number | null;
  accepted_at: string | null;
  released_at: string | null;
  release_reason: string | null;
}

export interface LoanCoSigner {
  id: string;
  co_signer_user_id: string;
  co_signer_xnscore_at_signing: number;
  borrower_user_id: string;
  loan_application_id: string | null;
  loan_id: string | null;
  relationship_to_borrower: string | null;
  shared_circle_id: string | null;
  liability_type: string;
  max_liability_cents: number | null;
  status: string;
  accepted_at: string | null;
  released_at: string | null;
}

export interface AssessmentParams {
  userId: string;
  requestedAmountCents: number;
  requestedTermMonths: number;
  loanPurpose: LoanPurpose;
  loanProductCode?: string;
  elderGuaranteeUserId?: string;
  coSignerUserId?: string;
}

export interface AssessmentResult {
  assessmentId: string;
  userId: string;
  eligible: boolean;
  creditScore: number | null;
  riskGrade: RiskGrade | null;
  maxAmount: number;
  approvedAmount: number;
  baseApr: number;
  communityDiscount: number;
  finalApr: number;
  monthlyPayment: number | null;
  totalInterest: number | null;
  totalRepayment: number | null;
  termMonths: number;
  factors: {
    xnscore: { score: number; contribution: number };
    circleHealth: { score: number; adjustment: number; circlesAssessed: number };
    loanHistory: { score: number; adjustment: number; loansRepaid: number; note: string };
    capacity: { calculated: number; utilized: number; remaining: number };
    communityCollateral: {
      vouchDiscount: number;
      elderGuaranteeDiscount: number;
      coSignerDiscount: number;
      totalDiscount: number;
    };
  };
  recommendation: CreditRecommendation;
  conditions: string[];
  expiresAt: string;
  rejectionReasons: string[] | null;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CONFIGURATION                                                               │
// └─────────────────────────────────────────────────────────────────────────────┘

export const CREDIT_CONFIG = {
  // XnScore to Credit Score mapping
  xnscoreMultiplier: 5.5,
  creditScoreBase: 300,
  creditScoreMax: 850,
  creditScoreMin: 300,

  // Risk grades
  riskGrades: {
    A: { minScore: 740, maxScore: 850, label: 'Low Risk', color: '#22c55e' },
    B: { minScore: 630, maxScore: 739, label: 'Moderate Risk', color: '#84cc16' },
    C: { minScore: 520, maxScore: 629, label: 'Acceptable Risk', color: '#eab308' },
    D: { minScore: 410, maxScore: 519, label: 'High Risk', color: '#f97316' },
    E: { minScore: 0, maxScore: 409, label: 'Ineligible', color: '#ef4444' },
  },

  // Score-based limits
  scoreLimits: {
    740: 1000000, // $10,000
    630: 500000,  // $5,000
    520: 200000,  // $2,000
    410: 50000,   // $500
    0: 0,
  },

  // APR limits
  aprFloor: 5.0,
  maxCommunityDiscount: 7.0,

  // Minimum requirements
  minXnscoreForAnyLoan: 40,
  minAccountAgeDaysForAnyLoan: 90,

  // Assessment validity
  assessmentValidityHours: 48,
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CREDITWORTHINESS ENGINE CLASS                                               │
// └─────────────────────────────────────────────────────────────────────────────┘

export class CreditworthinessEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // LOAN PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all active loan products
   */
  async getLoanProducts(): Promise<LoanProduct[]> {
    const { data, error } = await supabase
      .from('loan_products')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific loan product by code
   */
  async getLoanProductByCode(code: string): Promise<LoanProduct | null> {
    const { data, error } = await supabase
      .from('loan_products')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get eligible loan products for a user based on XnScore
   */
  async getEligibleProducts(userId: string): Promise<LoanProduct[]> {
    const { data: xnScore } = await supabase
      .from('xn_scores')
      .select('total_score, account_age_days')
      .eq('user_id', userId)
      .single();

    if (!xnScore) return [];

    const { data: products, error } = await supabase
      .from('loan_products')
      .select('*')
      .eq('is_active', true)
      .lte('min_xnscore', xnScore.total_score)
      .lte('min_account_age_days', xnScore.account_age_days)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return products || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDITWORTHINESS ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Assess creditworthiness for a loan request
   */
  async assessCreditworthiness(params: AssessmentParams): Promise<string> {
    const { data, error } = await supabase.rpc('assess_creditworthiness', {
      p_user_id: params.userId,
      p_requested_amount_cents: params.requestedAmountCents,
      p_requested_term_months: params.requestedTermMonths,
      p_loan_purpose: params.loanPurpose,
      p_loan_product_code: params.loanProductCode || null,
      p_elder_guarantee_user_id: params.elderGuaranteeUserId || null,
      p_cosigner_user_id: params.coSignerUserId || null,
    });

    if (error) throw error;
    return data as string; // Returns assessment ID
  }

  /**
   * Get a specific assessment
   */
  async getAssessment(assessmentId: string): Promise<CreditworthinessAssessment | null> {
    const { data, error } = await supabase
      .from('creditworthiness_assessments')
      .select('*')
      .eq('id', assessmentId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get user's recent assessments
   */
  async getUserAssessments(userId: string, limit: number = 10): Promise<CreditworthinessAssessment[]> {
    const { data, error } = await supabase
      .from('creditworthiness_assessments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's latest valid assessment
   */
  async getLatestValidAssessment(userId: string): Promise<CreditworthinessAssessment | null> {
    const { data, error } = await supabase
      .from('creditworthiness_assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('is_eligible', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAN APPLICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create loan application from assessment
   */
  async createLoanApplication(
    assessmentId: string,
    userId: string,
    purposeDescription?: string
  ): Promise<string> {
    const { data, error } = await supabase.rpc('create_loan_application', {
      p_assessment_id: assessmentId,
      p_user_id: userId,
      p_purpose_description: purposeDescription || null,
    });

    if (error) throw error;
    return data as string;
  }

  /**
   * Get a loan application
   */
  async getLoanApplication(applicationId: string): Promise<LoanApplication | null> {
    const { data, error } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get user's loan applications
   */
  async getUserLoanApplications(userId: string): Promise<LoanApplication[]> {
    const { data, error } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Accept loan terms
   */
  async acceptLoanTerms(applicationId: string, userIp?: string): Promise<boolean> {
    const { error } = await supabase
      .from('loan_applications')
      .update({
        status: 'accepted',
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_ip: userIp || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .eq('status', 'approved');

    if (error) throw error;
    return true;
  }

  /**
   * Cancel loan application
   */
  async cancelLoanApplication(applicationId: string, reason?: string): Promise<boolean> {
    const { error } = await supabase
      .from('loan_applications')
      .update({
        status: 'cancelled',
        status_reason: reason || 'User cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .in('status', ['pending', 'approved']);

    if (error) throw error;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOANS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Disburse an accepted loan
   */
  async disburseLoan(applicationId: string): Promise<string> {
    const { data, error } = await supabase.rpc('disburse_loan', {
      p_application_id: applicationId,
    });

    if (error) throw error;
    return data as string;
  }

  /**
   * Get a loan
   */
  async getLoan(loanId: string): Promise<Loan | null> {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get user's loans
   */
  async getUserLoans(userId: string): Promise<Loan[]> {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's active loans
   */
  async getUserActiveLoans(userId: string): Promise<Loan[]> {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get loan with full details
   */
  async getLoanWithDetails(loanId: string): Promise<Loan & {
    application: LoanApplication;
    product: LoanProduct;
    schedule: PaymentScheduleEntry[];
    payments: LoanPayment[];
  } | null> {
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .single();

    if (loanError || !loan) return null;

    const [
      { data: application },
      { data: product },
      { data: schedule },
      { data: payments },
    ] = await Promise.all([
      supabase.from('loan_applications').select('*').eq('id', loan.application_id).single(),
      supabase.from('loan_products').select('*').eq('id', loan.loan_product_id).single(),
      supabase.from('loan_payment_schedule').select('*').eq('loan_id', loanId).order('payment_number'),
      supabase.from('loan_payments').select('*').eq('loan_id', loanId).order('created_at', { ascending: false }),
    ]);

    return {
      ...loan,
      application: application!,
      product: product!,
      schedule: schedule || [],
      payments: payments || [],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a loan payment
   */
  async recordPayment(
    loanId: string,
    amountCents: number,
    paymentMethod: string,
    paymentSourceId?: string
  ): Promise<string> {
    const { data, error } = await supabase.rpc('record_loan_payment', {
      p_loan_id: loanId,
      p_amount_cents: amountCents,
      p_payment_method: paymentMethod,
      p_payment_source_id: paymentSourceId || null,
    });

    if (error) throw error;
    return data as string;
  }

  /**
   * Get payment schedule for a loan
   */
  async getPaymentSchedule(loanId: string): Promise<PaymentScheduleEntry[]> {
    const { data, error } = await supabase
      .from('loan_payment_schedule')
      .select('*')
      .eq('loan_id', loanId)
      .order('payment_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get payment history for a loan
   */
  async getLoanPayments(loanId: string): Promise<LoanPayment[]> {
    const { data, error } = await supabase
      .from('loan_payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get upcoming payment for a loan
   */
  async getUpcomingPayment(loanId: string): Promise<PaymentScheduleEntry | null> {
    const { data, error } = await supabase
      .from('loan_payment_schedule')
      .select('*')
      .eq('loan_id', loanId)
      .in('status', ['scheduled', 'partial', 'late'])
      .order('payment_number', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARANTEES & CO-SIGNERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check Elder guarantee capacity
   */
  async checkElderGuaranteeCapacity(elderUserId: string): Promise<{
    canGuarantee: boolean;
    activeGuarantees: number;
    totalGuaranteedCents: number;
    remainingCapacityCents: number;
    reason: string;
  }> {
    const { data, error } = await supabase.rpc('check_elder_guarantee_capacity', {
      p_elder_user_id: elderUserId,
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    return {
      canGuarantee: result.can_guarantee,
      activeGuarantees: result.active_guarantees,
      totalGuaranteedCents: result.total_guaranteed_cents,
      remainingCapacityCents: result.remaining_capacity_cents,
      reason: result.reason,
    };
  }

  /**
   * Check co-signer capacity
   */
  async checkCoSignerCapacity(coSignerUserId: string): Promise<{
    canCoSign: boolean;
    activeCoSigns: number;
    reason: string;
  }> {
    const { data, error } = await supabase.rpc('check_cosigner_capacity', {
      p_cosigner_user_id: coSignerUserId,
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    return {
      canCoSign: result.can_cosign,
      activeCoSigns: result.active_cosigns,
      reason: result.reason,
    };
  }

  /**
   * Get user's guarantees (as guarantor)
   */
  async getUserGuarantees(userId: string): Promise<LoanGuarantee[]> {
    const { data, error } = await supabase
      .from('loan_guarantees')
      .select('*')
      .eq('guarantor_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's co-sign agreements
   */
  async getUserCoSigns(userId: string): Promise<LoanCoSigner[]> {
    const { data, error } = await supabase
      .from('loan_co_signers')
      .select('*')
      .eq('co_signer_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS & SUMMARIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get loan portfolio summary
   */
  async getLoanPortfolioSummary(): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_loan_portfolio_summary')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get active loans dashboard
   */
  async getActiveLoanssDashboard(): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_active_loans_dashboard')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get guarantor exposure
   */
  async getGuarantorExposure(guarantorUserId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('v_guarantor_exposure')
      .select('*')
      .eq('guarantor_user_id', guarantorUserId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate credit score from XnScore
   */
  calculateCreditScore(xnScore: number): number {
    return Math.min(850, Math.max(300, Math.round(300 + (xnScore * 5.5))));
  }

  /**
   * Get risk grade from credit score
   */
  getRiskGrade(creditScore: number): RiskGrade {
    if (creditScore >= 740) return 'A';
    if (creditScore >= 630) return 'B';
    if (creditScore >= 520) return 'C';
    if (creditScore >= 410) return 'D';
    return 'E';
  }

  /**
   * Get risk grade info
   */
  getRiskGradeInfo(grade: RiskGrade): { label: string; color: string; minScore: number; maxScore: number } {
    return CREDIT_CONFIG.riskGrades[grade];
  }

  /**
   * Get score-based limit
   */
  getScoreBasedLimit(creditScore: number): number {
    if (creditScore >= 740) return 1000000;
    if (creditScore >= 630) return 500000;
    if (creditScore >= 520) return 200000;
    if (creditScore >= 410) return 50000;
    return 0;
  }

  /**
   * Format currency from cents
   */
  formatCurrency(cents: number): string {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Calculate monthly payment
   */
  calculateMonthlyPayment(principalCents: number, apr: number, termMonths: number): number {
    const monthlyRate = apr / 100 / 12;

    if (monthlyRate === 0) {
      return Math.round(principalCents / termMonths);
    }

    const payment = principalCents *
      (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    return Math.round(payment);
  }

  /**
   * Get assessment expiry status
   */
  isAssessmentValid(assessment: CreditworthinessAssessment): boolean {
    return new Date(assessment.expires_at) > new Date();
  }

  /**
   * Get loan health status
   */
  getLoanHealthStatus(loan: Loan): {
    status: 'healthy' | 'warning' | 'critical';
    label: string;
    color: string;
  } {
    if (loan.status !== 'active') {
      return { status: 'healthy', label: loan.status, color: '#6b7280' };
    }

    if (loan.days_past_due > 30) {
      return { status: 'critical', label: 'Severely Delinquent', color: '#ef4444' };
    }

    if (loan.days_past_due > 0) {
      return { status: 'warning', label: 'Past Due', color: '#f97316' };
    }

    return { status: 'healthy', label: 'Current', color: '#22c55e' };
  }
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SINGLETON EXPORT                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

export const creditworthinessEngine = new CreditworthinessEngine();
