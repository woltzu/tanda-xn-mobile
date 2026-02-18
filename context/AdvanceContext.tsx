import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * TANDAXN ADVANCE/LOAN SYSTEM
 *
 * Three loan tiers:
 * 1. Small Advances ($50-$1,000) - Quick advances on circle payouts
 * 2. Medium Loans ($1,000-$10,000) - Business, education, vehicles
 * 3. Mortgage/Large Loans ($10,000-$100,000) - Major purchases like homes
 *
 * Key Terminology:
 * - "Advance" or "Loan" (not "Credit")
 * - "Advance Fee" (not "Interest")
 * - "Withholding" (not "Collection")
 * - "Stable Monthly Contribution" (SMC) - Average monthly contribution
 * - "Debt-to-Contribution Ratio" (DCR) - Risk metric
 */

// ==================== TYPES ====================

export type LoanType = "small" | "medium" | "mortgage";
export type LoanCategory =
  | "payout_advance"      // Advance on upcoming payout
  | "emergency"           // Emergency funds
  | "education"           // School fees, training
  | "medical"             // Medical expenses
  | "business"            // Business expansion
  | "vehicle"             // Car, motorcycle
  | "home_improvement"    // Renovations
  | "mortgage"            // Home purchase
  | "agriculture"         // Farming, livestock
  | "other";

export type LoanStatus =
  | "draft"           // User started application
  | "submitted"       // Submitted for review
  | "under_review"    // Being reviewed
  | "approved"        // Approved, awaiting disbursement
  | "disbursed"       // Money sent to user
  | "active"          // Currently being repaid
  | "completed"       // Fully repaid
  | "cancelled"       // User cancelled
  | "rejected"        // Application rejected
  | "defaulted"       // Failed to repay
  | "in_recovery";    // In collection process

export type RepaymentMethod =
  | "payout_withholding"   // Auto-deduct from circle payouts
  | "wallet_balance"       // Deduct from wallet
  | "hybrid"               // Both methods combined
  | "manual";              // User pays manually

export type DisbursementMethod = "wallet" | "bank_transfer" | "mobile_money";

// ==================== TIER SYSTEM ====================

// XnScore-based eligibility tiers (3-state + active tiers)
export const ELIGIBILITY_TIERS = {
  locked: {
    minScore: 0,
    maxScore: 24,
    status: "locked" as const,
    label: "Locked",
    description: "Build your XnScore to 25+ to preview loan options",
    color: "#6B7280",
    bgColor: "#F3F4F6",
    loanAccess: {
      small: false,
      medium: false,
      mortgage: false,
    },
  },
  preview: {
    minScore: 25,
    maxScore: 44,
    status: "preview" as const,
    label: "Preview",
    description: "Almost there! Reach 45 to start applying for loans",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    loanAccess: {
      small: false,
      medium: false,
      mortgage: false,
    },
  },
  basic: {
    minScore: 45,
    maxScore: 59,
    status: "active" as const,
    label: "Basic",
    description: "Small advances available",
    color: "#10B981",
    bgColor: "#D1FAE5",
    loanAccess: {
      small: true,
      medium: false,
      mortgage: false,
    },
  },
  standard: {
    minScore: 60,
    maxScore: 74,
    status: "active" as const,
    label: "Standard",
    description: "Small & medium loans available",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
    loanAccess: {
      small: true,
      medium: true,
      mortgage: false,
    },
  },
  premium: {
    minScore: 75,
    maxScore: 89,
    status: "active" as const,
    label: "Premium",
    description: "All loan types with better rates",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
    loanAccess: {
      small: true,
      medium: true,
      mortgage: true,
    },
  },
  elite: {
    minScore: 90,
    maxScore: 100,
    status: "active" as const,
    label: "Elite",
    description: "Best rates and highest limits",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    loanAccess: {
      small: true,
      medium: true,
      mortgage: true,
    },
  },
};

export type EligibilityTierKey = keyof typeof ELIGIBILITY_TIERS;

// ==================== LOAN PRODUCTS ====================

export interface LoanProduct {
  id: string;
  type: LoanType;
  name: string;
  description: string;
  icon: string;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  minXnScore: number;
  categories: LoanCategory[];
  // Interest/fee rates by tier (percentage)
  feeRates: {
    basic: number;
    standard: number;
    premium: number;
    elite: number;
  };
  // Max loan-to-SMC ratio
  maxLoanToSMCRatio: number;
  // Processing time
  processingTime: string;
  // Features
  features: string[];
}

// Fee rates are APR (Annual Percentage Rate) - realistic credit union rates
export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: "small_advance",
    type: "small",
    name: "Quick Advance",
    description: "Get cash now against your upcoming circle payout",
    icon: "flash-outline",
    minAmount: 50,
    maxAmount: 1000,
    minTermMonths: 1,
    maxTermMonths: 3,
    minXnScore: 45,
    categories: ["payout_advance", "emergency", "medical"],
    // Short-term advance fees (flat fee, not APR - these are 1-3 month terms)
    feeRates: {
      basic: 3.5,     // 3.5% flat fee
      standard: 2.5,  // 2.5% flat fee
      premium: 1.5,   // 1.5% flat fee
      elite: 1.0,     // 1.0% flat fee
    },
    maxLoanToSMCRatio: 2.0, // Max 2x monthly contribution
    processingTime: "Instant to 4 hours",
    features: [
      "Instant approval for qualified users",
      "Auto-repaid from payout",
      "No collateral required",
      "Builds credit history",
    ],
  },
  {
    id: "education_loan",
    type: "medium",
    name: "Education Loan",
    description: "Invest in your future with affordable education financing",
    icon: "school-outline",
    minAmount: 500,
    maxAmount: 5000,
    minTermMonths: 3,
    maxTermMonths: 24,
    minXnScore: 60,
    categories: ["education"],
    // Credit union education loan APRs: typically 4-8%
    feeRates: {
      basic: 0,
      standard: 7.49,   // 7.49% APR
      premium: 5.99,    // 5.99% APR
      elite: 4.49,      // 4.49% APR
    },
    maxLoanToSMCRatio: 6.0,
    processingTime: "1-3 business days",
    features: [
      "Deferred payments during study",
      "Low interest rates",
      "Flexible repayment terms",
      "Covers tuition & supplies",
    ],
  },
  {
    id: "business_loan",
    type: "medium",
    name: "Business Loan",
    description: "Grow your business with flexible capital",
    icon: "briefcase-outline",
    minAmount: 1000,
    maxAmount: 10000,
    minTermMonths: 6,
    maxTermMonths: 36,
    minXnScore: 60,
    categories: ["business", "agriculture"],
    // Credit union business loan APRs: typically 7-12%
    feeRates: {
      basic: 0,
      standard: 9.99,   // 9.99% APR
      premium: 7.99,    // 7.99% APR
      elite: 6.49,      // 6.49% APR
    },
    maxLoanToSMCRatio: 8.0,
    processingTime: "2-5 business days",
    features: [
      "Working capital & equipment",
      "Inventory financing",
      "Business expansion",
      "Livestock & farming",
    ],
  },
  {
    id: "vehicle_loan",
    type: "medium",
    name: "Vehicle Loan",
    description: "Finance your car, motorcycle, or commercial vehicle",
    icon: "car-outline",
    minAmount: 2000,
    maxAmount: 15000,
    minTermMonths: 12,
    maxTermMonths: 60,
    minXnScore: 65,
    categories: ["vehicle"],
    // Credit union auto loan APRs: typically 4-9% for new, 5-10% for used
    feeRates: {
      basic: 0,
      standard: 7.99,   // 7.99% APR
      premium: 5.99,    // 5.99% APR
      elite: 4.49,      // 4.49% APR
    },
    maxLoanToSMCRatio: 10.0,
    processingTime: "3-7 business days",
    features: [
      "New & used vehicles",
      "Motorcycles & commercial vehicles",
      "Competitive rates",
      "Flexible down payment",
    ],
  },
  {
    id: "home_improvement",
    type: "medium",
    name: "Home Improvement",
    description: "Renovate and improve your home",
    icon: "hammer-outline",
    minAmount: 1000,
    maxAmount: 20000,
    minTermMonths: 6,
    maxTermMonths: 60,
    minXnScore: 65,
    categories: ["home_improvement"],
    // Credit union home improvement loan APRs: typically 6-10%
    feeRates: {
      basic: 0,
      standard: 8.99,   // 8.99% APR
      premium: 6.99,    // 6.99% APR
      elite: 5.49,      // 5.49% APR
    },
    maxLoanToSMCRatio: 12.0,
    processingTime: "3-5 business days",
    features: [
      "Renovations & repairs",
      "Kitchen & bathroom upgrades",
      "Energy efficiency improvements",
      "Security installations",
    ],
  },
  {
    id: "mortgage",
    type: "mortgage",
    name: "Home Mortgage",
    description: "Make your dream of homeownership a reality",
    icon: "home-outline",
    minAmount: 10000,
    maxAmount: 100000,
    minTermMonths: 60,
    maxTermMonths: 360, // 30 years
    minXnScore: 75,
    categories: ["mortgage"],
    // Credit union mortgage APRs: typically 5-8%
    feeRates: {
      basic: 0,
      standard: 0,
      premium: 6.75,    // 6.75% APR
      elite: 5.99,      // 5.99% APR
    },
    maxLoanToSMCRatio: 30.0,
    processingTime: "2-4 weeks",
    features: [
      "Competitive fixed rates",
      "Long-term financing",
      "Primary & secondary homes",
      "Land purchase included",
    ],
  },
];

// ==================== INTERFACES ====================

// Future payout that can be advanced
export interface FuturePayout {
  id: string;
  circleId: string;
  circleName: string;
  expectedDate: string;
  expectedAmount: number;
  currency: string;
  memberPosition: number;
  isAdvanceable: boolean;
  existingLoanId?: string; // If already has a loan against it
}

// Repayment schedule item
export interface RepaymentScheduleItem {
  id: string;
  dueDate: string;
  amount: number;
  principal: number;
  fee: number;
  status: "pending" | "scheduled" | "paid" | "missed" | "partial";
  paidAmount: number;
  paidDate?: string;
  source?: "payout_withholding" | "wallet" | "manual";
  sourceDetails?: string; // e.g., "Circle A payout"
}

// Loan application/request
export interface LoanRequest {
  id: string;
  userId: string;

  // Loan Details
  productId: string;
  loanType: LoanType;
  category: LoanCategory;
  purpose: string;
  purposeDetails?: string;

  // Financial Details
  requestedAmount: number;
  approvedAmount?: number;
  currency: string;
  feeRate: number; // Percentage
  feeAmount: number;
  totalToRepay: number;
  termMonths: number;

  // Source & Repayment
  sourcePayoutId?: string; // For payout advances
  repaymentMethod: RepaymentMethod;
  disbursementMethod: DisbursementMethod;
  disbursementDetails?: {
    accountNumber?: string;
    bankName?: string;
    phoneNumber?: string;
  };

  // Schedule
  repaymentSchedule: RepaymentScheduleItem[];
  nextPaymentDate?: string;
  nextPaymentAmount?: number;

  // Payment Tracking
  amountPaid: number;
  amountRemaining: number;
  paymentsMade: number;
  paymentsRemaining: number;

  // User's Financial Snapshot
  xnScoreAtRequest: number;
  tierAtRequest: EligibilityTierKey;
  smcAtRequest: number; // Stable Monthly Contribution
  dcrAtRequest: number; // Debt-to-Contribution Ratio

  // Status & Workflow
  status: LoanStatus;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  disbursedAt?: string;
  completedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  // Risk Assessment
  riskScore?: number;
  automaticApproval: boolean;
}

// User's loan eligibility
export interface LoanEligibility {
  tier: EligibilityTierKey;
  tierInfo: typeof ELIGIBILITY_TIERS[EligibilityTierKey];
  canApply: boolean;

  // Amounts by loan type
  maxAmounts: {
    small: number;
    medium: number;
    mortgage: number;
  };

  // Fee rates by loan type
  feeRates: {
    small: number;
    medium: number;
    mortgage: number;
  };

  // Current obligations
  currentObligations: {
    activeLoans: number;
    totalOwed: number;
    monthlyPayment: number;
    dcrCurrent: number;
  };

  // Stable Monthly Contribution
  smc: number;

  // Available products
  availableProducts: string[]; // Product IDs user can access

  // Upcoming payouts available for advance
  availablePayouts: FuturePayout[];

  // Reasons if not eligible
  restrictions: string[];
  improvementTips: string[];
}

// Loan calculation result
export interface LoanCalculation {
  eligible: boolean;
  product: LoanProduct;
  requestedAmount: number;
  approvedAmount: number;
  termMonths: number;
  feeRate: number;
  feeAmount: number;
  totalToRepay: number;
  monthlyPayment: number;
  repaymentSchedule: RepaymentScheduleItem[];
  newDCR: number;
  warnings: string[];
  approvalLikelihood: "high" | "medium" | "low";
}

// ==================== CONTEXT ====================

interface LoanContextType {
  // Loans
  loans: LoanRequest[];
  activeLoans: LoanRequest[];
  completedLoans: LoanRequest[];

  // Future payouts
  futurePayouts: FuturePayout[];
  getAdvanceablePayouts: () => FuturePayout[];

  // Products
  loanProducts: LoanProduct[];
  getProductById: (id: string) => LoanProduct | undefined;
  getProductsByType: (type: LoanType) => LoanProduct[];
  getAvailableProducts: (xnScore: number) => LoanProduct[];

  // Eligibility
  getEligibility: (xnScore: number, smc: number) => LoanEligibility;
  getEligibilityTier: (xnScore: number) => EligibilityTierKey;
  getTierInfo: (tier: EligibilityTierKey) => typeof ELIGIBILITY_TIERS[EligibilityTierKey];
  canApplyForLoan: (xnScore: number) => boolean;

  // Calculations
  calculateLoan: (
    productId: string,
    amount: number,
    termMonths: number,
    xnScore: number,
    smc: number,
    sourcePayoutId?: string
  ) => LoanCalculation;

  // Loan operations
  applyForLoan: (application: Omit<LoanRequest,
    "id" | "status" | "createdAt" | "amountPaid" | "amountRemaining" |
    "paymentsMade" | "paymentsRemaining" | "feeAmount" | "totalToRepay" |
    "repaymentSchedule" | "automaticApproval"
  >) => Promise<LoanRequest>;

  cancelLoan: (loanId: string) => Promise<void>;
  makePayment: (loanId: string, amount: number, source: "wallet" | "manual") => Promise<void>;

  // Queries
  getLoanById: (loanId: string) => LoanRequest | undefined;
  getLoansByStatus: (status: LoanStatus) => LoanRequest[];
  getTotalOutstanding: () => number;
  getMonthlyObligations: () => number;

  // For backward compatibility with existing advance system
  checkEligibility: (circleId: string, xnScore: number, expectedPayout: number) => {
    isEligible: boolean;
    canRequest: boolean;
    tier: EligibilityTierKey;
    tierInfo: typeof ELIGIBILITY_TIERS[EligibilityTierKey];
    maxAmount: number;
    availableAmount: number;
    currentAdvances: number;
    activeAdvanceIds: string[];
    reasons: string[];
    improvementTips: string[];
  };
  getAdvanceTier: (xnScore: number) => EligibilityTierKey;
  requestAdvance: (request: any) => Promise<LoanRequest>;

  // Loading
  isLoading: boolean;
}

const LoanContext = createContext<LoanContextType | undefined>(undefined);

const STORAGE_KEY = "@tandaxn_loans";
const PAYOUTS_STORAGE_KEY = "@tandaxn_future_payouts";

const MOCK_USER_ID = "user_1";

export function AdvanceProvider({ children }: { children: ReactNode }) {
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [futurePayouts, setFuturePayouts] = useState<FuturePayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storedLoans, storedPayouts] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(PAYOUTS_STORAGE_KEY),
      ]);

      if (storedLoans) {
        setLoans(JSON.parse(storedLoans));
      }

      if (storedPayouts) {
        setFuturePayouts(JSON.parse(storedPayouts));
      } else {
        const mockPayouts = generateMockFuturePayouts();
        setFuturePayouts(mockPayouts);
        await AsyncStorage.setItem(PAYOUTS_STORAGE_KEY, JSON.stringify(mockPayouts));
      }
    } catch (error) {
      console.error("Error loading loan data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate mock future payouts
  const generateMockFuturePayouts = (): FuturePayout[] => {
    const now = new Date();
    return [
      {
        id: "payout_1",
        circleId: "circle_family_savings",
        circleName: "Family Savings Circle",
        expectedDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        expectedAmount: 2000,
        currency: "USD",
        memberPosition: 3,
        isAdvanceable: true,
      },
      {
        id: "payout_2",
        circleId: "circle_home_buyers",
        circleName: "Home Buyers Circle",
        expectedDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        expectedAmount: 5000,
        currency: "USD",
        memberPosition: 5,
        isAdvanceable: true,
      },
      {
        id: "payout_3",
        circleId: "circle_business",
        circleName: "Business Circle",
        expectedDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        expectedAmount: 3000,
        currency: "USD",
        memberPosition: 2,
        isAdvanceable: true,
      },
    ];
  };

  const saveLoans = async (newLoans: LoanRequest[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newLoans));
      setLoans(newLoans);
    } catch (error) {
      console.error("Error saving loans:", error);
      throw error;
    }
  };

  const saveFuturePayouts = async (newPayouts: FuturePayout[]) => {
    try {
      await AsyncStorage.setItem(PAYOUTS_STORAGE_KEY, JSON.stringify(newPayouts));
      setFuturePayouts(newPayouts);
    } catch (error) {
      console.error("Error saving payouts:", error);
      throw error;
    }
  };

  // ==================== TIER & ELIGIBILITY ====================

  const getEligibilityTier = (xnScore: number): EligibilityTierKey => {
    if (xnScore >= 90) return "elite";
    if (xnScore >= 75) return "premium";
    if (xnScore >= 60) return "standard";
    if (xnScore >= 45) return "basic";
    if (xnScore >= 25) return "preview";
    return "locked";
  };

  const getTierInfo = (tier: EligibilityTierKey) => ELIGIBILITY_TIERS[tier];

  const canApplyForLoan = (xnScore: number): boolean => xnScore >= 45;

  const getAdvanceablePayouts = (): FuturePayout[] => {
    return futurePayouts.filter(p => {
      const existingLoan = loans.find(
        l => l.sourcePayoutId === p.id &&
        ["submitted", "under_review", "approved", "disbursed", "active"].includes(l.status)
      );
      return p.isAdvanceable && !existingLoan;
    });
  };

  // ==================== PRODUCTS ====================

  const getProductById = (id: string) => LOAN_PRODUCTS.find(p => p.id === id);

  const getProductsByType = (type: LoanType) => LOAN_PRODUCTS.filter(p => p.type === type);

  const getAvailableProducts = (xnScore: number): LoanProduct[] => {
    const tier = getEligibilityTier(xnScore);
    const tierInfo = ELIGIBILITY_TIERS[tier];

    if (tierInfo.status !== "active") return [];

    return LOAN_PRODUCTS.filter(p => {
      if (p.type === "small") return tierInfo.loanAccess.small;
      if (p.type === "medium") return tierInfo.loanAccess.medium;
      if (p.type === "mortgage") return tierInfo.loanAccess.mortgage;
      return false;
    }).filter(p => xnScore >= p.minXnScore);
  };

  // ==================== ELIGIBILITY ====================

  const getEligibility = (xnScore: number, smc: number): LoanEligibility => {
    const tier = getEligibilityTier(xnScore);
    const tierInfo = ELIGIBILITY_TIERS[tier];

    const activeUserLoans = loans.filter(
      l => l.userId === MOCK_USER_ID &&
      ["active", "disbursed", "approved"].includes(l.status)
    );

    const totalOwed = activeUserLoans.reduce((sum, l) => sum + l.amountRemaining, 0);
    const monthlyPayment = activeUserLoans.reduce((sum, l) => sum + (l.nextPaymentAmount || 0), 0);
    const dcrCurrent = smc > 0 ? totalOwed / (smc * 12) : 0;

    const restrictions: string[] = [];
    const improvementTips: string[] = [];

    if (tier === "locked") {
      restrictions.push("XnScore must be 25+ to preview loan options");
      improvementTips.push("Make 3 more on-time circle contributions");
    } else if (tier === "preview") {
      restrictions.push("XnScore must be 45+ to apply for loans");
      improvementTips.push(`You need ${45 - xnScore} more points. Keep making on-time payments!`);
    }

    if (dcrCurrent >= 0.5) {
      restrictions.push("Debt-to-contribution ratio too high (max 50%)");
      improvementTips.push("Pay down existing loans to qualify for new ones");
    }

    // Calculate max amounts based on tier and SMC
    const maxAmounts = {
      small: 0,
      medium: 0,
      mortgage: 0,
    };

    const feeRates = {
      small: 0,
      medium: 0,
      mortgage: 0,
    };

    if (tierInfo.loanAccess.small) {
      const smallProduct = LOAN_PRODUCTS.find(p => p.id === "small_advance");
      if (smallProduct) {
        maxAmounts.small = Math.min(smallProduct.maxAmount, smc * smallProduct.maxLoanToSMCRatio);
        feeRates.small = smallProduct.feeRates[tier as keyof typeof smallProduct.feeRates] || 0;
      }
    }

    if (tierInfo.loanAccess.medium) {
      maxAmounts.medium = Math.min(10000, smc * 8);
      // Use realistic credit union-style APRs
      feeRates.medium = tier === "elite" ? 6.49 : tier === "premium" ? 7.99 : 9.99;
    }

    if (tierInfo.loanAccess.mortgage) {
      maxAmounts.mortgage = Math.min(100000, smc * 30);
      // Use realistic credit union-style APRs
      feeRates.mortgage = tier === "elite" ? 5.99 : 6.75;
    }

    const availableProducts = getAvailableProducts(xnScore).map(p => p.id);

    return {
      tier,
      tierInfo,
      canApply: tierInfo.status === "active" && restrictions.length === 0,
      maxAmounts,
      feeRates,
      currentObligations: {
        activeLoans: activeUserLoans.length,
        totalOwed,
        monthlyPayment,
        dcrCurrent,
      },
      smc,
      availableProducts,
      availablePayouts: getAdvanceablePayouts(),
      restrictions,
      improvementTips,
    };
  };

  // ==================== CALCULATIONS ====================

  const calculateLoan = (
    productId: string,
    amount: number,
    termMonths: number,
    xnScore: number,
    smc: number,
    sourcePayoutId?: string
  ): LoanCalculation => {
    const product = getProductById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const tier = getEligibilityTier(xnScore);
    const tierInfo = ELIGIBILITY_TIERS[tier];

    // Check eligibility
    const warnings: string[] = [];
    let eligible = true;

    if (xnScore < product.minXnScore) {
      eligible = false;
      warnings.push(`Requires XnScore ${product.minXnScore}+`);
    }

    if (amount < product.minAmount) {
      warnings.push(`Minimum amount: $${product.minAmount}`);
    }

    if (amount > product.maxAmount) {
      warnings.push(`Maximum amount: $${product.maxAmount}`);
    }

    // Get fee rate for tier
    const feeRate = product.feeRates[tier as keyof typeof product.feeRates] || 0;
    if (feeRate === 0 && tierInfo.status === "active") {
      eligible = false;
      warnings.push("This product requires a higher tier");
    }

    // Calculate amounts
    const approvedAmount = Math.min(amount, product.maxAmount, smc * product.maxLoanToSMCRatio);

    // Calculate interest/fee using proper amortization formula
    // For small advances (1-3 months), use flat fee rate
    // For longer term loans, use APR with monthly compounding (standard loan calculation)
    let feeAmount: number;
    let monthlyPayment: number;
    let totalToRepay: number;

    if (product.type === "small") {
      // Short-term advances use flat fee (not APR)
      feeAmount = approvedAmount * (feeRate / 100);
      totalToRepay = approvedAmount + feeAmount;
      monthlyPayment = totalToRepay / termMonths;
    } else {
      // Standard amortization calculation for longer-term loans
      // Monthly interest rate
      const monthlyRate = feeRate / 100 / 12;

      if (monthlyRate > 0) {
        // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
        const compoundFactor = Math.pow(1 + monthlyRate, termMonths);
        monthlyPayment = approvedAmount * (monthlyRate * compoundFactor) / (compoundFactor - 1);
        totalToRepay = monthlyPayment * termMonths;
        feeAmount = totalToRepay - approvedAmount;
      } else {
        // 0% interest - just divide principal by months
        feeAmount = 0;
        totalToRepay = approvedAmount;
        monthlyPayment = approvedAmount / termMonths;
      }
    }

    // Calculate new DCR
    const currentMonthlyObligation = getMonthlyObligations();
    const newDCR = (currentMonthlyObligation + monthlyPayment) / smc;

    if (newDCR > 0.5) {
      warnings.push(`This would increase your DCR to ${(newDCR * 100).toFixed(0)}% (max: 50%)`);
    }

    // Generate repayment schedule
    const schedule = generateRepaymentSchedule(
      approvedAmount,
      feeAmount,
      totalToRepay,
      termMonths,
      sourcePayoutId
    );

    // Determine approval likelihood
    let approvalLikelihood: "high" | "medium" | "low" = "high";
    if (warnings.length > 0) approvalLikelihood = "medium";
    if (!eligible || newDCR > 0.5) approvalLikelihood = "low";

    return {
      eligible,
      product,
      requestedAmount: amount,
      approvedAmount,
      termMonths,
      feeRate,
      feeAmount,
      totalToRepay,
      monthlyPayment,
      repaymentSchedule: schedule,
      newDCR,
      warnings,
      approvalLikelihood,
    };
  };

  const generateRepaymentSchedule = (
    principal: number,
    feeAmount: number,
    total: number,
    termMonths: number,
    sourcePayoutId?: string
  ): RepaymentScheduleItem[] => {
    const schedule: RepaymentScheduleItem[] = [];
    const monthlyPayment = total / termMonths;
    const monthlyPrincipal = principal / termMonths;
    const monthlyFee = feeAmount / termMonths;
    const now = new Date();

    for (let i = 0; i < termMonths; i++) {
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + i + 1);

      schedule.push({
        id: `payment_${i + 1}`,
        dueDate: dueDate.toISOString(),
        amount: monthlyPayment,
        principal: monthlyPrincipal,
        fee: monthlyFee,
        status: "pending",
        paidAmount: 0,
      });
    }

    // If source payout exists, mark first payment as scheduled from withholding
    if (sourcePayoutId && schedule.length > 0) {
      schedule[0].source = "payout_withholding";
      schedule[0].status = "scheduled";
    }

    return schedule;
  };

  // ==================== LOAN OPERATIONS ====================

  const applyForLoan = async (application: Omit<LoanRequest,
    "id" | "status" | "createdAt" | "amountPaid" | "amountRemaining" |
    "paymentsMade" | "paymentsRemaining" | "feeAmount" | "totalToRepay" |
    "repaymentSchedule" | "automaticApproval"
  >): Promise<LoanRequest> => {
    const product = getProductById(application.productId);
    if (!product) throw new Error("Product not found");

    const tier = getEligibilityTier(application.xnScoreAtRequest);
    const feeRate = product.feeRates[tier as keyof typeof product.feeRates] || application.feeRate;

    // Calculate fee using proper amortization (same logic as calculateLoan)
    let feeAmount: number;
    let totalToRepay: number;

    if (product.type === "small") {
      // Short-term advances use flat fee
      feeAmount = application.requestedAmount * (feeRate / 100);
      totalToRepay = application.requestedAmount + feeAmount;
    } else {
      // Standard amortization for longer-term loans
      const monthlyRate = feeRate / 100 / 12;
      if (monthlyRate > 0) {
        const compoundFactor = Math.pow(1 + monthlyRate, application.termMonths);
        const monthlyPayment = application.requestedAmount * (monthlyRate * compoundFactor) / (compoundFactor - 1);
        totalToRepay = monthlyPayment * application.termMonths;
        feeAmount = totalToRepay - application.requestedAmount;
      } else {
        feeAmount = 0;
        totalToRepay = application.requestedAmount;
      }
    }

    const schedule = generateRepaymentSchedule(
      application.requestedAmount,
      feeAmount,
      totalToRepay,
      application.termMonths,
      application.sourcePayoutId
    );

    // Check for automatic approval
    const automaticApproval =
      application.xnScoreAtRequest >= 70 &&
      application.dcrAtRequest <= 0.4 &&
      application.requestedAmount <= product.maxAmount * 0.8;

    const newLoan: LoanRequest = {
      ...application,
      id: `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: automaticApproval ? "approved" : "submitted",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      approvedAt: automaticApproval ? new Date().toISOString() : undefined,
      feeAmount,
      totalToRepay,
      repaymentSchedule: schedule,
      amountPaid: 0,
      amountRemaining: totalToRepay,
      paymentsMade: 0,
      paymentsRemaining: schedule.length,
      nextPaymentDate: schedule[0]?.dueDate,
      nextPaymentAmount: schedule[0]?.amount,
      automaticApproval,
    };

    // Mark payout as having a loan
    if (application.sourcePayoutId) {
      const updatedPayouts = futurePayouts.map(p =>
        p.id === application.sourcePayoutId
          ? { ...p, existingLoanId: newLoan.id }
          : p
      );
      await saveFuturePayouts(updatedPayouts);
    }

    const updated = [...loans, newLoan];
    await saveLoans(updated);
    return newLoan;
  };

  const cancelLoan = async (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    if (!["draft", "submitted", "under_review"].includes(loan.status)) {
      throw new Error("Cannot cancel loan in current status");
    }

    // Unmark payout
    if (loan.sourcePayoutId) {
      const updatedPayouts = futurePayouts.map(p =>
        p.id === loan.sourcePayoutId
          ? { ...p, existingLoanId: undefined }
          : p
      );
      await saveFuturePayouts(updatedPayouts);
    }

    const updated = loans.map(l =>
      l.id === loanId
        ? { ...l, status: "cancelled" as LoanStatus }
        : l
    );
    await saveLoans(updated);
  };

  const makePayment = async (loanId: string, amount: number, source: "wallet" | "manual") => {
    const updated = loans.map(loan => {
      if (loan.id !== loanId) return loan;
      if (!["disbursed", "active"].includes(loan.status)) return loan;

      const newAmountPaid = loan.amountPaid + amount;
      const newAmountRemaining = Math.max(0, loan.amountRemaining - amount);
      const isCompleted = newAmountRemaining <= 0;

      // Update schedule
      let remainingPayment = amount;
      const newSchedule = loan.repaymentSchedule.map(item => {
        if (remainingPayment <= 0 || item.status === "paid") return item;

        const unpaid = item.amount - item.paidAmount;
        const payment = Math.min(remainingPayment, unpaid);
        remainingPayment -= payment;

        const newPaidAmount = item.paidAmount + payment;
        return {
          ...item,
          paidAmount: newPaidAmount,
          status: newPaidAmount >= item.amount ? "paid" as const : "partial" as const,
          paidDate: new Date().toISOString(),
          source,
        };
      });

      const paidPayments = newSchedule.filter(s => s.status === "paid").length;
      const nextPending = newSchedule.find(s => s.status !== "paid");

      return {
        ...loan,
        status: isCompleted ? "completed" as LoanStatus : "active" as LoanStatus,
        amountPaid: newAmountPaid,
        amountRemaining: newAmountRemaining,
        paymentsMade: paidPayments,
        paymentsRemaining: newSchedule.length - paidPayments,
        repaymentSchedule: newSchedule,
        nextPaymentDate: nextPending?.dueDate,
        nextPaymentAmount: nextPending?.amount,
        completedAt: isCompleted ? new Date().toISOString() : undefined,
      };
    });

    await saveLoans(updated);
  };

  // ==================== QUERIES ====================

  const getLoanById = (loanId: string) => loans.find(l => l.id === loanId);

  const getLoansByStatus = (status: LoanStatus) =>
    loans.filter(l => l.userId === MOCK_USER_ID && l.status === status);

  const getTotalOutstanding = () =>
    loans
      .filter(l => l.userId === MOCK_USER_ID && ["disbursed", "active"].includes(l.status))
      .reduce((sum, l) => sum + l.amountRemaining, 0);

  const getMonthlyObligations = () =>
    loans
      .filter(l => l.userId === MOCK_USER_ID && ["disbursed", "active"].includes(l.status))
      .reduce((sum, l) => sum + (l.nextPaymentAmount || 0), 0);

  // ==================== BACKWARD COMPATIBILITY ====================

  // For existing advance screens
  const checkEligibility = (circleId: string, xnScore: number, expectedPayout: number) => {
    const tier = getEligibilityTier(xnScore);
    const tierInfo = ELIGIBILITY_TIERS[tier];
    const reasons: string[] = [];
    const improvementTips: string[] = [];

    const activeUserLoans = loans.filter(
      l => l.userId === MOCK_USER_ID &&
      ["active", "disbursed", "approved"].includes(l.status)
    );

    const circleLoan = activeUserLoans.find(l =>
      l.sourcePayoutId &&
      futurePayouts.find(p => p.id === l.sourcePayoutId)?.circleId === circleId
    );

    if (circleLoan) {
      reasons.push("You already have an active advance from this circle");
    }

    if (activeUserLoans.length >= 3) {
      reasons.push("Maximum 3 active loans allowed");
    }

    if (tier === "locked") {
      reasons.push("XnScore must be 25+ to view advance options");
      improvementTips.push("Complete 3 more on-time contributions to reach 25");
    } else if (tier === "preview") {
      reasons.push("XnScore must be 45+ to request advances");
      improvementTips.push(`You need ${45 - xnScore} more points. Keep making on-time payments!`);
    }

    const smallProduct = LOAN_PRODUCTS.find(p => p.id === "small_advance");
    const feeRate = smallProduct?.feeRates[tier as keyof typeof smallProduct.feeRates] || 5;
    const maxPercent = tier === "elite" ? 90 : tier === "premium" ? 80 : tier === "standard" ? 65 : 50;

    const maxAmount = (expectedPayout * maxPercent) / 100;
    const totalOutstanding = activeUserLoans.reduce((sum, l) => sum + l.amountRemaining, 0);
    const availableAmount = Math.max(0, maxAmount - totalOutstanding);

    return {
      isEligible: reasons.length === 0 && tierInfo.status === "active" && availableAmount > 0,
      canRequest: tierInfo.status === "active",
      tier,
      tierInfo: {
        ...tierInfo,
        advanceFee: feeRate,
        maxAdvancePercent: maxPercent,
      },
      maxAmount,
      availableAmount,
      currentAdvances: activeUserLoans.length,
      activeAdvanceIds: activeUserLoans.map(l => l.id),
      reasons,
      improvementTips,
    };
  };

  const getAdvanceTier = getEligibilityTier;

  const requestAdvance = async (request: any): Promise<LoanRequest> => {
    return applyForLoan({
      userId: request.userId || MOCK_USER_ID,
      productId: "small_advance",
      loanType: "small",
      category: "payout_advance",
      purpose: request.reason || "payout_advance",
      purposeDetails: request.reason,
      requestedAmount: request.requestedAmount,
      approvedAmount: request.requestedAmount,
      currency: request.currency || "USD",
      feeRate: request.advanceFeePercent,
      termMonths: 1,
      sourcePayoutId: request.payoutId,
      repaymentMethod: request.repaymentMethod || "payout_withholding",
      disbursementMethod: "wallet",
      xnScoreAtRequest: request.xnScoreAtRequest,
      tierAtRequest: request.tierAtRequest,
      smcAtRequest: request.expectedPayoutAmount || 500,
      dcrAtRequest: 0,
    });
  };

  // ==================== COMPUTED VALUES ====================

  const activeLoans = loans.filter(l =>
    l.userId === MOCK_USER_ID &&
    ["submitted", "under_review", "approved", "disbursed", "active"].includes(l.status)
  );

  const completedLoans = loans.filter(l =>
    l.userId === MOCK_USER_ID && l.status === "completed"
  );

  return (
    <LoanContext.Provider
      value={{
        loans,
        activeLoans,
        completedLoans,
        futurePayouts,
        getAdvanceablePayouts,
        loanProducts: LOAN_PRODUCTS,
        getProductById,
        getProductsByType,
        getAvailableProducts,
        getEligibility,
        getEligibilityTier,
        getTierInfo,
        canApplyForLoan,
        calculateLoan,
        applyForLoan,
        cancelLoan,
        makePayment,
        getLoanById,
        getLoansByStatus,
        getTotalOutstanding,
        getMonthlyObligations,
        checkEligibility,
        getAdvanceTier,
        requestAdvance,
        isLoading,
      }}
    >
      {children}
    </LoanContext.Provider>
  );
}

export function useAdvance() {
  const context = useContext(LoanContext);
  if (!context) {
    throw new Error("useAdvance must be used within an AdvanceProvider");
  }
  return context;
}

// Export alias for new screens
export const useLoan = useAdvance;

// Export types for backward compatibility
export const ADVANCE_TIERS = ELIGIBILITY_TIERS;
export type AdvanceTierKey = EligibilityTierKey;
export type AdvanceRequest = LoanRequest;
export type AdvanceStatus = LoanStatus;
