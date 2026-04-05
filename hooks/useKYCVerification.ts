// ═══════════════════════════════════════════════════════════════════════════════
// useKYCVerification.ts — #44 Document Verification AI (Persona) Hooks
// ═══════════════════════════════════════════════════════════════════════════════
//
// 5 hooks:
//   useKYCStatus           — member's current KYC verification status
//   useKYCDocuments        — documents submitted for verification
//   useKYCAdminReviewQueue — admin review queue (pending reviews)
//   useKYCDashboard        — admin dashboard statistics
//   useKYCActions          — all mutation actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KYCVerificationEngine,
  type KYCType,
  type KYCStatus,
  type VerificationMethod,
  type RiskLevel,
  type DocumentType,
  type DocumentStatus,
  type ReviewReason,
  type ReviewPriority,
  type AdminDecision,
  type DeclineCategory,
  type RiskSignals,
  type KYCVerification,
  type KYCDocument,
  type KYCAdminReview,
  type KYCDeclineReason,
  type InitiateVerificationResult,
  type WebhookProcessResult,
  type KYCDashboardStats,
} from '../services/KYCVerificationEngine';

// Re-export types
export type {
  KYCType,
  KYCStatus,
  VerificationMethod,
  RiskLevel,
  DocumentType,
  DocumentStatus,
  ReviewReason,
  ReviewPriority,
  AdminDecision,
  DeclineCategory,
  RiskSignals,
  KYCVerification,
  KYCDocument,
  KYCAdminReview,
  KYCDeclineReason,
  InitiateVerificationResult,
  WebhookProcessResult,
  KYCDashboardStats,
};


// ─────────────────────────────────────────────────────────────────────────────
// Hook 1: useKYCStatus
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCStatus(memberId?: string) {
  const [verification, setVerification] = useState<KYCVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await KYCVerificationEngine.getVerification(memberId);
      setVerification(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Realtime — auto-update when Persona webhook fires
  useEffect(() => {
    if (!memberId) return;
    const channel = KYCVerificationEngine.subscribeToVerification(memberId, fetchStatus);
    return () => { channel.unsubscribe(); };
  }, [memberId, fetchStatus]);

  const computed = useMemo(() => {
    if (!verification) return {
      isVerified: false,
      isPending: false,
      isRejected: false,
      isExpired: false,
      needsReview: false,
      isFallbackOnly: false,
      kycTier: 0,
      canRetry: false,
      attemptsRemaining: 3,
      hasDeadline: false,
      deadlineDays: null as number | null,
    };

    const now = new Date();
    const deadline = verification.fullKycDeadline ? new Date(verification.fullKycDeadline) : null;
    const deadlineDays = deadline
      ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      isVerified: verification.status === 'approved',
      isPending: ['pending', 'provider_pending', 'provider_review', 'admin_review'].includes(verification.status),
      isRejected: verification.status === 'rejected',
      isExpired: verification.status === 'expired',
      needsReview: ['provider_review', 'admin_review'].includes(verification.status),
      isFallbackOnly: verification.kycType === 'fallback',
      kycTier: verification.kycTier,
      canRetry: verification.rejectionCount < verification.maxAttempts && verification.status === 'rejected',
      attemptsRemaining: Math.max(0, verification.maxAttempts - verification.rejectionCount),
      hasDeadline: !!deadline,
      deadlineDays,
    };
  }, [verification]);

  return { verification, loading, error, refresh: fetchStatus, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 2: useKYCDocuments
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCDocuments(verificationId?: string) {
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!verificationId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await KYCVerificationEngine.getDocuments(verificationId);
      setDocuments(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [verificationId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const computed = useMemo(() => ({
    totalDocuments: documents.length,
    verifiedCount: documents.filter(d => d.status === 'verified').length,
    pendingCount: documents.filter(d => d.status === 'pending' || d.status === 'processing').length,
    rejectedCount: documents.filter(d => d.status === 'rejected').length,
    hasSelfie: documents.some(d => d.documentType === 'selfie' || d.documentType === 'liveness_video'),
    hasGovernmentId: documents.some(d =>
      ['passport', 'national_id', 'drivers_license'].includes(d.documentType) && d.status === 'verified'
    ),
  }), [documents]);

  return { documents, loading, error, refresh: fetchDocuments, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 3: useKYCAdminReviewQueue
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCAdminReviewQueue(limit: number = 50) {
  const [reviews, setReviews] = useState<KYCAdminReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await KYCVerificationEngine.getPendingReviews(limit);
      setReviews(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // Realtime
  useEffect(() => {
    const channel = KYCVerificationEngine.subscribeToAdminReviews(fetchReviews);
    return () => { channel.unsubscribe(); };
  }, [fetchReviews]);

  const computed = useMemo(() => {
    const criticalCount = reviews.filter(r => r.priority === 'critical').length;
    const highCount = reviews.filter(r => r.priority === 'high').length;

    return {
      totalPending: reviews.length,
      criticalCount,
      highCount,
      hasCritical: criticalCount > 0,
      byReason: reviews.reduce((acc, r) => {
        acc[r.reviewReason] = (acc[r.reviewReason] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [reviews]);

  return { reviews, loading, error, refresh: fetchReviews, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 4: useKYCDashboard
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCDashboard() {
  const [stats, setStats] = useState<KYCDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await KYCVerificationEngine.getDashboardStats();
      setStats(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const computed = useMemo(() => {
    if (!stats) return {
      hasData: false,
      approvalRateFormatted: '0%',
      firstAttemptRateFormatted: '0%',
      pendingReviewCount: 0,
    };

    return {
      hasData: stats.totalVerifications > 0,
      approvalRateFormatted: `${stats.approvalRate}%`,
      firstAttemptRateFormatted: `${stats.firstAttemptSuccessRate}%`,
      pendingReviewCount: stats.manualReviewCount,
    };
  }, [stats]);

  return { stats, loading, error, refresh: fetchStats, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 5: useKYCActions
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCActions() {
  const [initiating, setInitiating] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const initializeVerification = useCallback(async (
    memberId: string,
    method: VerificationMethod,
    documentCountry?: string,
    experimentId?: string
  ): Promise<InitiateVerificationResult> => {
    setInitiating(true);
    try {
      return await KYCVerificationEngine.initializeVerification(
        memberId, method, documentCountry, experimentId
      );
    } finally {
      setInitiating(false);
    }
  }, []);

  const submitReviewDecision = useCallback(async (
    reviewId: string,
    adminId: string,
    decision: 'approve' | 'reject' | 'request_resubmit' | 'escalate' | 'suspend',
    decisionReason: string,
    adminDecisionLabel?: AdminDecision,
    notes?: string
  ) => {
    setSubmittingReview(true);
    try {
      return await KYCVerificationEngine.submitReviewDecision(
        reviewId, adminId, decision, decisionReason, adminDecisionLabel, notes
      );
    } finally {
      setSubmittingReview(false);
    }
  }, []);

  const upgradeTier = useCallback(async (
    verificationId: string,
    newTier: number,
    adminId: string
  ) => {
    return KYCVerificationEngine.upgradeTier(verificationId, newTier, adminId);
  }, []);

  const getDeclineReasons = useCallback(async (verificationId: string) => {
    return KYCVerificationEngine.getDeclineReasons(verificationId);
  }, []);

  const getWebhookEvents = useCallback(async (inquiryId: string) => {
    return KYCVerificationEngine.getWebhookEvents(inquiryId);
  }, []);

  return {
    initializeVerification,
    submitReviewDecision,
    upgradeTier,
    getDeclineReasons,
    getWebhookEvents,
    initiating,
    submittingReview,
  };
}
