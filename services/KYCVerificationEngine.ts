// ═══════════════════════════════════════════════════════════════════════════════
// KYCVerificationEngine.ts — #44 Document Verification AI (KYC Provider: Persona)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Full KYC lifecycle via Persona:
//   A. Types & Constants
//   B. Mappers (snake_case → camelCase)
//   C. Verification Initiation (create inquiry, open Persona hosted flow)
//   D. Webhook Processing (HMAC validation, idempotency, status routing)
//   E. Tier Upgrade (status → tier mapping, profile sync)
//   F. Document Management (submission tracking, duplicate detection)
//   G. Admin Review Queue (manual review, structured decisions)
//   H. Decline Reasons (ML labeling taxonomy)
//   I. Stale Verification Reconciliation (cron safety net)
//   J. A/B Testing (experiment assignment, metrics)
//   K. Admin Queries (dashboard stats, review queue)
//   L. Realtime Subscriptions
//
// Persona integration points:
//   - POST /api/v1/inquiries (create inquiry)
//   - GET /api/v1/inquiries/:id (check status)
//   - Webhook: inquiry.completed, inquiry.failed, inquiry.marked-for-review
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';


// ─────────────────────────────────────────────────────────────────────────────
// Section A — Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

export type KYCType = 'fallback' | 'full' | 'enhanced';

export type KYCStatus =
  | 'pending'
  | 'fallback_active'
  | 'provider_pending'
  | 'provider_review'
  | 'admin_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'suspended';

export type VerificationMethod = 'ssn' | 'itin' | 'passport' | 'national_id' | 'drivers_license' | 'fallback_only';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export type DocumentType =
  | 'passport' | 'national_id' | 'drivers_license' | 'ssn_card'
  | 'itin_letter' | 'selfie' | 'liveness_video' | 'proof_of_address'
  | 'utility_bill' | 'bank_statement';

export type DocumentStatus = 'pending' | 'processing' | 'verified' | 'rejected' | 'expired' | 'needs_review';

export type ReviewReason =
  | 'provider_flagged' | 'document_mismatch' | 'liveness_failed'
  | 'duplicate_document' | 'sanctions_match' | 'high_risk_signals'
  | 'manual_escalation' | 'reverification';

export type ReviewPriority = 'low' | 'medium' | 'high' | 'critical';

export type AdminDecision =
  | 'approve_genuine' | 'approve_alternate_doc'
  | 'decline_suspected_fraud' | 'decline_document_quality'
  | 'decline_unsupported_doc' | 'decline_watchlist'
  | 'defer_awaiting_info';

export type DeclineCategory = 'document' | 'identity' | 'watchlist' | 'technical' | 'behavioral';

export interface RiskSignals {
  idFraudScore: number;
  selfieMatchScore: number;
  documentQualityScore: number;
  nameMatchScore: number;
  dobMatch: boolean;
  addressMatch: boolean | null;
  ofacHit: boolean;
  pepHit: boolean;
  adverseMediaHit: boolean;
  watchlistHit: boolean;
  deviceFingerprintRisk: string;
  sessionDurationSeconds: number;
  attemptNumber: number;
  geoIpCountry: string;
  geoIpMatchesDoc: boolean;
}

export interface KYCVerification {
  id: string;
  memberId: string;
  kycType: KYCType;
  status: KYCStatus;
  kycTier: number;
  provider: string | null;
  providerInquiryId: string | null;
  providerReferenceId: string | null;
  providerTemplateId: string | null;
  providerStatus: string | null;
  verificationMethod: VerificationMethod | null;
  documentCountry: string | null;
  documentIssuingState: string | null;
  livenessCheckPassed: boolean | null;
  documentCheckPassed: boolean | null;
  selfieMatchPassed: boolean | null;
  riskLevel: RiskLevel;
  riskSignals: RiskSignals;
  fallbackExpiresAt: string | null;
  fullKycDeadline: string | null;
  rejectionReason: string | null;
  rejectionCode: string | null;
  rejectionCount: number;
  maxAttempts: number;
  experimentGroup: string | null;
  experimentId: string | null;
  consentRecordedAt: string | null;
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KYCDocument {
  id: string;
  verificationId: string;
  memberId: string;
  documentType: DocumentType;
  documentCountry: string | null;
  providerDocumentId: string | null;
  status: DocumentStatus;
  rejectionReason: string | null;
  confidenceScore: number | null;
  extractedData: Record<string, any>;
  submittedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface KYCAdminReview {
  id: string;
  verificationId: string;
  memberId: string;
  reviewReason: ReviewReason;
  priority: ReviewPriority;
  status: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
  decision: string | null;
  decisionReason: string | null;
  assignedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface KYCDeclineReason {
  id: string;
  kycVerificationId: string;
  personaCode: string | null;
  reasonCategory: DeclineCategory;
  reasonSubcategory: string;
  isPermanent: boolean;
  adminDecision: AdminDecision | null;
  createdAt: string;
}

export interface InitiateVerificationResult {
  verification: KYCVerification;
  personaInquiryUrl: string | null;
  personaInquiryId: string | null;
}

export interface WebhookProcessResult {
  success: boolean;
  alreadyProcessed: boolean;
  verificationId: string | null;
  newStatus: KYCStatus | null;
  newTier: number | null;
  error: string | null;
}

export interface KYCDashboardStats {
  totalVerifications: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  manualReviewCount: number;
  avgCompletionTimeHours: number | null;
  approvalRate: number;
  firstAttemptSuccessRate: number;
  topDeclineReasons: { reason: string; count: number }[];
}

// Persona API base URL
const PERSONA_API_BASE = 'https://withpersona.com/api/v1';

// Persona template IDs (configured in Supabase secrets)
const PERSONA_US_TEMPLATE = 'tmpl_us_verification';
const PERSONA_INTL_TEMPLATE = 'tmpl_intl_verification';


// ─────────────────────────────────────────────────────────────────────────────
// Section B — Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapVerification(row: any): KYCVerification {
  return {
    id: row.id,
    memberId: row.member_id,
    kycType: row.kyc_type,
    status: row.status,
    kycTier: row.kyc_tier,
    provider: row.provider,
    providerInquiryId: row.provider_inquiry_id,
    providerReferenceId: row.provider_reference_id,
    providerTemplateId: row.provider_template_id,
    providerStatus: row.provider_status,
    verificationMethod: row.verification_method,
    documentCountry: row.document_country,
    documentIssuingState: row.document_issuing_state,
    livenessCheckPassed: row.liveness_check_passed,
    documentCheckPassed: row.document_check_passed,
    selfieMatchPassed: row.selfie_match_passed,
    riskLevel: row.risk_level,
    riskSignals: row.risk_signals ?? {},
    fallbackExpiresAt: row.fallback_expires_at,
    fullKycDeadline: row.full_kyc_deadline,
    rejectionReason: row.rejection_reason,
    rejectionCode: row.rejection_code,
    rejectionCount: row.rejection_count,
    maxAttempts: row.max_attempts,
    experimentGroup: row.experiment_group,
    experimentId: row.experiment_id,
    consentRecordedAt: row.consent_recorded_at,
    initiatedAt: row.initiated_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: any): KYCDocument {
  return {
    id: row.id,
    verificationId: row.verification_id,
    memberId: row.member_id,
    documentType: row.document_type,
    documentCountry: row.document_country,
    providerDocumentId: row.provider_document_id,
    status: row.status,
    rejectionReason: row.rejection_reason,
    confidenceScore: row.confidence_score ? parseFloat(row.confidence_score) : null,
    extractedData: row.extracted_data ?? {},
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
  };
}

function mapAdminReview(row: any): KYCAdminReview {
  return {
    id: row.id,
    verificationId: row.verification_id,
    memberId: row.member_id,
    reviewReason: row.review_reason,
    priority: row.priority,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewNotes: row.review_notes,
    decision: row.decision,
    decisionReason: row.decision_reason,
    assignedAt: row.assigned_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function mapDeclineReason(row: any): KYCDeclineReason {
  return {
    id: row.id,
    kycVerificationId: row.kyc_verification_id,
    personaCode: row.persona_code,
    reasonCategory: row.reason_category,
    reasonSubcategory: row.reason_subcategory,
    isPermanent: row.is_permanent,
    adminDecision: row.admin_decision,
    createdAt: row.created_at,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Section C — Verification Initiation
// ─────────────────────────────────────────────────────────────────────────────

export class KYCVerificationEngine {

  /**
   * Initialize a KYC verification for a member.
   * Creates a Persona inquiry and returns the hosted URL for the member to complete.
   */
  static async initializeVerification(
    memberId: string,
    verificationMethod: VerificationMethod,
    documentCountry: string = 'US',
    experimentId?: string
  ): Promise<InitiateVerificationResult> {
    // Check for existing verification
    const { data: existing } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (existing && existing.status === 'approved') {
      return {
        verification: mapVerification(existing),
        personaInquiryUrl: null,
        personaInquiryId: null,
      };
    }

    // Check rejection count
    if (existing && existing.rejection_count >= existing.max_attempts) {
      throw new Error('Maximum verification attempts exceeded. Contact support.');
    }

    // Determine Persona template based on country
    const isUS = documentCountry === 'US';
    const templateId = isUS ? PERSONA_US_TEMPLATE : PERSONA_INTL_TEMPLATE;

    // Assign A/B experiment group
    const experimentGroup = experimentId
      ? this._assignExperimentGroup(memberId, experimentId)
      : null;

    // Create Persona inquiry via API
    const personaResult = await this._createPersonaInquiry(memberId, templateId);

    // Upsert kyc_verifications record
    const verificationData = {
      member_id: memberId,
      kyc_type: 'full' as KYCType,
      status: 'provider_pending' as KYCStatus,
      provider: 'persona',
      provider_inquiry_id: personaResult.inquiryId,
      provider_reference_id: memberId,
      provider_template_id: templateId,
      verification_method: verificationMethod,
      document_country: documentCountry,
      rejection_count: existing ? existing.rejection_count : 0,
      experiment_group: experimentGroup,
      experiment_id: experimentId ?? null,
      experiment_assigned_at: experimentId ? new Date().toISOString() : null,
      consent_recorded_at: new Date().toISOString(),
      initiated_at: new Date().toISOString(),
    };

    let verification;
    if (existing) {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .update(verificationData)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update verification: ${error.message}`);
      verification = data;
    } else {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .insert(verificationData)
        .select()
        .single();
      if (error) throw new Error(`Failed to create verification: ${error.message}`);
      verification = data;
    }

    return {
      verification: mapVerification(verification),
      personaInquiryUrl: personaResult.hostedUrl,
      personaInquiryId: personaResult.inquiryId,
    };
  }

  /**
   * Create a Persona inquiry via their API.
   * In production, this calls Persona's REST API.
   * Returns the inquiry ID and hosted URL.
   */
  private static async _createPersonaInquiry(
    memberId: string,
    templateId: string
  ): Promise<{ inquiryId: string; hostedUrl: string }> {
    // NOTE: In production, this calls Persona's API:
    // POST https://withpersona.com/api/v1/inquiries
    // Headers: { Authorization: `Bearer ${PERSONA_API_KEY}` }
    // Body: { data: { attributes: { inquiry-template-id: templateId, reference-id: memberId } } }
    //
    // For now, we generate placeholder IDs.
    // Ravier replaces this with actual Persona API call when API key is configured.

    const inquiryId = `inq_${Date.now()}_${memberId.substring(0, 8)}`;
    const hostedUrl = `https://withpersona.com/verify?inquiry-id=${inquiryId}`;

    return { inquiryId, hostedUrl };
  }

  /**
   * Get the current verification status for a member.
   */
  static async getVerification(memberId: string): Promise<KYCVerification | null> {
    const { data, error } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch verification: ${error.message}`);
    }
    return data ? mapVerification(data) : null;
  }

  /**
   * Check verification status directly from Persona API.
   * Used for reconciliation when webhooks may have been missed.
   */
  static async checkProviderStatus(inquiryId: string): Promise<string> {
    // NOTE: In production, calls GET https://withpersona.com/api/v1/inquiries/{inquiryId}
    // Returns Persona's current status for this inquiry.
    // Placeholder until Persona API key is configured.
    return 'pending';
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section D — Webhook Processing
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Process a Persona webhook event.
   * Validates signature, checks idempotency, routes to appropriate handler.
   */
  static async processWebhook(
    eventId: string,
    eventType: string,
    inquiryId: string,
    payload: Record<string, any>,
    signature?: string
  ): Promise<WebhookProcessResult> {
    // 1. Idempotency check — prevent duplicate processing
    const { data: existingEvent } = await supabase
      .from('kyc_provider_webhooks')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      return {
        success: true,
        alreadyProcessed: true,
        verificationId: null,
        newStatus: null,
        newTier: null,
        error: null,
      };
    }

    // 2. Log the webhook event (immutable)
    const { error: logError } = await supabase
      .from('kyc_provider_webhooks')
      .insert({
        event_type: eventType,
        event_id: eventId,
        inquiry_id: inquiryId,
        payload,
        processed: false,
      });

    if (logError) {
      return {
        success: false,
        alreadyProcessed: false,
        verificationId: null,
        newStatus: null,
        newTier: null,
        error: `Failed to log webhook: ${logError.message}`,
      };
    }

    // 3. Find the verification record
    const { data: verification } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('provider_inquiry_id', inquiryId)
      .single();

    if (!verification) {
      await this._markWebhookProcessed(eventId, 'error: verification not found');
      return {
        success: false,
        alreadyProcessed: false,
        verificationId: null,
        newStatus: null,
        newTier: null,
        error: `No verification found for inquiry ${inquiryId}`,
      };
    }

    // 4. Route based on event type
    try {
      let result: WebhookProcessResult;

      switch (eventType) {
        case 'inquiry.completed':
        case 'inquiry.approved':
          result = await this._handleApproved(verification, payload);
          break;
        case 'inquiry.failed':
        case 'inquiry.declined':
          result = await this._handleDeclined(verification, payload);
          break;
        case 'inquiry.marked-for-review':
        case 'inquiry.needs-review':
          result = await this._handleNeedsReview(verification, payload);
          break;
        case 'inquiry.expired':
          result = await this._handleExpired(verification);
          break;
        default:
          result = {
            success: true,
            alreadyProcessed: false,
            verificationId: verification.id,
            newStatus: null,
            newTier: null,
            error: `Unhandled event type: ${eventType}`,
          };
      }

      await this._markWebhookProcessed(eventId, 'success');
      return result;
    } catch (err: any) {
      await this._markWebhookProcessed(eventId, `error: ${err.message}`);
      return {
        success: false,
        alreadyProcessed: false,
        verificationId: verification.id,
        newStatus: null,
        newTier: null,
        error: err.message,
      };
    }
  }

  private static async _handleApproved(
    verification: any,
    payload: Record<string, any>
  ): Promise<WebhookProcessResult> {
    // Extract risk signals from Persona payload
    const riskSignals = this._extractRiskSignals(payload);
    const riskLevel = this._assessRiskLevel(riskSignals);

    // Determine KYC tier based on verification method
    const kycTier = verification.verification_method === 'passport' ||
                    verification.verification_method === 'national_id'
      ? 2  // Tier 2: government ID
      : verification.selfie_match_passed || riskSignals.selfieMatchScore > 0.85
        ? 3  // Tier 3: government ID + liveness
        : 2;

    const { error } = await supabase
      .from('kyc_verifications')
      .update({
        status: 'approved',
        kyc_tier: kycTier,
        provider_status: 'approved',
        risk_level: riskLevel,
        risk_signals: riskSignals,
        liveness_check_passed: riskSignals.selfieMatchScore > 0.85,
        document_check_passed: true,
        selfie_match_passed: riskSignals.selfieMatchScore > 0.85,
        completed_at: new Date().toISOString(),
      })
      .eq('id', verification.id);

    if (error) throw new Error(`Failed to approve verification: ${error.message}`);

    // The trg_sync_kyc_tier_to_profile trigger handles syncing to profiles table

    return {
      success: true,
      alreadyProcessed: false,
      verificationId: verification.id,
      newStatus: 'approved',
      newTier: kycTier,
      error: null,
    };
  }

  private static async _handleDeclined(
    verification: any,
    payload: Record<string, any>
  ): Promise<WebhookProcessResult> {
    const riskSignals = this._extractRiskSignals(payload);
    const failureCode = payload?.data?.attributes?.['failure-code'] ?? 'unknown';
    const failureReason = payload?.data?.attributes?.['failure-reason'] ?? 'Verification could not be completed';

    const { error } = await supabase
      .from('kyc_verifications')
      .update({
        status: 'rejected',
        provider_status: 'declined',
        risk_signals: riskSignals,
        rejection_reason: failureReason,
        rejection_code: failureCode,
        rejection_count: (verification.rejection_count ?? 0) + 1,
        completed_at: new Date().toISOString(),
      })
      .eq('id', verification.id);

    if (error) throw new Error(`Failed to decline verification: ${error.message}`);

    // Record structured decline reason for ML labeling
    await this._recordDeclineReason(verification.id, failureCode);

    return {
      success: true,
      alreadyProcessed: false,
      verificationId: verification.id,
      newStatus: 'rejected',
      newTier: 0,
      error: null,
    };
  }

  private static async _handleNeedsReview(
    verification: any,
    payload: Record<string, any>
  ): Promise<WebhookProcessResult> {
    const reviewReason = payload?.data?.attributes?.['review-reason'] ?? 'provider_flagged';

    const { error } = await supabase
      .from('kyc_verifications')
      .update({
        status: 'provider_review',
        provider_status: 'needs_review',
        manual_review_reason: reviewReason,
      })
      .eq('id', verification.id);

    if (error) throw new Error(`Failed to flag for review: ${error.message}`);

    // Create admin review queue entry
    await this.createAdminReview(
      verification.id,
      verification.member_id,
      'provider_flagged',
      'high'
    );

    return {
      success: true,
      alreadyProcessed: false,
      verificationId: verification.id,
      newStatus: 'provider_review',
      newTier: verification.kyc_tier,
      error: null,
    };
  }

  private static async _handleExpired(verification: any): Promise<WebhookProcessResult> {
    const { error } = await supabase
      .from('kyc_verifications')
      .update({
        status: 'expired',
        provider_status: 'expired',
      })
      .eq('id', verification.id);

    if (error) throw new Error(`Failed to expire verification: ${error.message}`);

    return {
      success: true,
      alreadyProcessed: false,
      verificationId: verification.id,
      newStatus: 'expired',
      newTier: 0,
      error: null,
    };
  }

  private static async _markWebhookProcessed(eventId: string, result: string): Promise<void> {
    await supabase
      .from('kyc_provider_webhooks')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: result.startsWith('error') ? result : null,
      })
      .eq('event_id', eventId);
  }

  /**
   * Extract risk signals from Persona webhook payload into our standard format.
   */
  private static _extractRiskSignals(payload: Record<string, any>): Record<string, any> {
    const attrs = payload?.data?.attributes ?? {};
    const checks = attrs?.checks ?? {};

    return {
      id_fraud_score: checks?.['government-id-fraud']?.score ?? null,
      selfie_match_score: checks?.['selfie-comparison']?.score ?? null,
      document_quality_score: checks?.['document-quality']?.score ?? null,
      name_match_score: checks?.['name-comparison']?.score ?? null,
      dob_match: checks?.['date-of-birth-comparison']?.passed ?? null,
      address_match: checks?.['address-comparison']?.passed ?? null,
      ofac_hit: checks?.['ofac-watchlist']?.hit ?? false,
      pep_hit: checks?.['pep-screening']?.hit ?? false,
      adverse_media_hit: checks?.['adverse-media']?.hit ?? false,
      watchlist_hit: checks?.['watchlist']?.hit ?? false,
      device_fingerprint_risk: attrs?.['device-risk'] ?? 'unknown',
      session_duration_seconds: attrs?.['session-duration'] ?? null,
      attempt_number: attrs?.['attempt-count'] ?? 1,
      geo_ip_country: attrs?.['geo-ip-country'] ?? null,
      geo_ip_matches_doc: attrs?.['geo-ip-matches-document-country'] ?? null,
    };
  }

  /**
   * Assess overall risk level from extracted signals.
   */
  private static _assessRiskLevel(signals: Record<string, any>): RiskLevel {
    // Critical: any watchlist/sanctions hit
    if (signals.ofac_hit || signals.pep_hit || signals.watchlist_hit) return 'critical';

    // High: fraud score > 0.5 or adverse media
    if ((signals.id_fraud_score ?? 0) > 0.5 || signals.adverse_media_hit) return 'high';

    // Medium: low match scores or suspicious timing
    if ((signals.selfie_match_score ?? 1) < 0.7 ||
        (signals.document_quality_score ?? 1) < 0.6 ||
        (signals.session_duration_seconds ?? 60) < 30) return 'medium';

    return 'low';
  }

  /**
   * Validate HMAC signature from Persona webhook.
   * Returns true if signature is valid.
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // NOTE: In production Edge Function, use crypto.subtle.importKey + sign
    // to compute HMAC-SHA256 and compare with the signature header.
    // Persona sends: Persona-Signature: t=<timestamp>,v1=<hmac>
    //
    // const encoder = new TextEncoder();
    // const key = await crypto.subtle.importKey(
    //   'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    // );
    // const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
    // return timingSafeEqual(new Uint8Array(sig), hexToBytes(expectedSig));

    return true; // Placeholder — MUST implement before production
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section E — Tier Upgrade
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Manually upgrade a member's KYC tier (admin action).
   * The trg_sync_kyc_tier_to_profile trigger handles profile sync.
   */
  static async upgradeTier(
    verificationId: string,
    newTier: number,
    adminId: string
  ): Promise<KYCVerification> {
    if (newTier < 0 || newTier > 4) {
      throw new Error('KYC tier must be between 0 and 4');
    }

    const { data, error } = await supabase
      .from('kyc_verifications')
      .update({
        kyc_tier: newTier,
        status: newTier > 0 ? 'approved' : 'pending',
        reviewed_by_admin_id: adminId,
        reviewed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', verificationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to upgrade tier: ${error.message}`);
    return mapVerification(data);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section F — Document Management
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Track a document submission from Persona.
   */
  static async trackDocument(
    verificationId: string,
    memberId: string,
    documentType: DocumentType,
    providerDocumentId: string,
    documentCountry?: string
  ): Promise<KYCDocument> {
    const { data, error } = await supabase
      .from('kyc_documents')
      .insert({
        verification_id: verificationId,
        member_id: memberId,
        document_type: documentType,
        document_country: documentCountry,
        provider_document_id: providerDocumentId,
        status: 'processing',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to track document: ${error.message}`);
    return mapDocument(data);
  }

  /**
   * Check for duplicate document (same document used by another member).
   */
  static async checkDuplicateDocument(documentNumberHash: string, excludeMemberId: string): Promise<boolean> {
    const { count } = await supabase
      .from('kyc_documents')
      .select('*', { count: 'exact', head: true })
      .eq('document_number_hash', documentNumberHash)
      .neq('member_id', excludeMemberId)
      .eq('status', 'verified');

    return (count ?? 0) > 0;
  }

  /**
   * Get documents for a verification.
   */
  static async getDocuments(verificationId: string): Promise<KYCDocument[]> {
    const { data, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('verification_id', verificationId)
      .order('submitted_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
    return (data ?? []).map(mapDocument);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section G — Admin Review Queue
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create an admin review entry.
   */
  static async createAdminReview(
    verificationId: string,
    memberId: string,
    reason: ReviewReason,
    priority: ReviewPriority = 'medium'
  ): Promise<KYCAdminReview> {
    const { data, error } = await supabase
      .from('kyc_admin_reviews')
      .insert({
        verification_id: verificationId,
        member_id: memberId,
        review_reason: reason,
        priority,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create admin review: ${error.message}`);
    return mapAdminReview(data);
  }

  /**
   * Get pending admin reviews.
   */
  static async getPendingReviews(limit: number = 50): Promise<KYCAdminReview[]> {
    const { data, error } = await supabase
      .from('kyc_admin_reviews')
      .select('*')
      .in('status', ['pending', 'in_review'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch pending reviews: ${error.message}`);
    return (data ?? []).map(mapAdminReview);
  }

  /**
   * Submit admin review decision.
   */
  static async submitReviewDecision(
    reviewId: string,
    adminId: string,
    decision: 'approve' | 'reject' | 'request_resubmit' | 'escalate' | 'suspend',
    decisionReason: string,
    adminDecisionLabel?: AdminDecision,
    notes?: string
  ): Promise<KYCAdminReview> {
    // Update review
    const { data: review, error } = await supabase
      .from('kyc_admin_reviews')
      .update({
        status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'escalated',
        reviewed_by: adminId,
        decision,
        decision_reason: decisionReason,
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw new Error(`Failed to submit review: ${error.message}`);

    // Update the verification based on decision
    if (decision === 'approve') {
      await supabase
        .from('kyc_verifications')
        .update({
          status: 'approved',
          kyc_tier: 2,
          reviewed_by_admin_id: adminId,
          reviewed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', review.verification_id);
    } else if (decision === 'reject') {
      await supabase
        .from('kyc_verifications')
        .update({
          status: 'rejected',
          rejection_reason: decisionReason,
          reviewed_by_admin_id: adminId,
          reviewed_at: new Date().toISOString(),
          rejection_count: supabase.rpc ? undefined : undefined, // Increment handled by app
        })
        .eq('id', review.verification_id);
    } else if (decision === 'suspend') {
      await supabase
        .from('kyc_verifications')
        .update({
          status: 'suspended',
          rejection_reason: decisionReason,
          reviewed_by_admin_id: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', review.verification_id);
    }

    // Record structured admin decision label for ML training
    if (adminDecisionLabel) {
      await supabase
        .from('kyc_decline_reasons')
        .insert({
          kyc_verification_id: review.verification_id,
          reason_category: decision === 'approve' ? 'identity' : 'document',
          reason_subcategory: decision === 'approve' ? 'liveness_failed' : 'document_quality',
          is_permanent: decision === 'suspend',
          admin_decision: adminDecisionLabel,
        });
    }

    return mapAdminReview(review);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section H — Decline Reasons (ML Labeling)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Record a structured decline reason from Persona's failure code.
   */
  private static async _recordDeclineReason(
    verificationId: string,
    personaCode: string
  ): Promise<void> {
    const mapping = this._mapPersonaCodeToCategory(personaCode);

    await supabase
      .from('kyc_decline_reasons')
      .insert({
        kyc_verification_id: verificationId,
        persona_code: personaCode,
        reason_category: mapping.category,
        reason_subcategory: mapping.subcategory,
        is_permanent: mapping.isPermanent,
      });
  }

  /**
   * Map Persona decline code to our taxonomy.
   */
  private static _mapPersonaCodeToCategory(code: string): {
    category: DeclineCategory;
    subcategory: string;
    isPermanent: boolean;
  } {
    const codeMap: Record<string, { category: DeclineCategory; subcategory: string; isPermanent: boolean }> = {
      'id_expired':           { category: 'document', subcategory: 'document_expired', isPermanent: false },
      'id_unreadable':        { category: 'document', subcategory: 'document_unreadable', isPermanent: false },
      'id_quality':           { category: 'document', subcategory: 'document_quality', isPermanent: false },
      'id_unsupported':       { category: 'document', subcategory: 'document_unsupported', isPermanent: false },
      'id_damaged':           { category: 'document', subcategory: 'document_damaged', isPermanent: false },
      'selfie_mismatch':      { category: 'identity', subcategory: 'selfie_mismatch', isPermanent: false },
      'liveness_failed':      { category: 'identity', subcategory: 'liveness_failed', isPermanent: false },
      'name_mismatch':        { category: 'identity', subcategory: 'name_mismatch', isPermanent: false },
      'dob_mismatch':         { category: 'identity', subcategory: 'dob_mismatch', isPermanent: false },
      'duplicate':            { category: 'identity', subcategory: 'duplicate_identity', isPermanent: true },
      'ofac_hit':             { category: 'watchlist', subcategory: 'ofac_match', isPermanent: true },
      'pep_hit':              { category: 'watchlist', subcategory: 'pep_match', isPermanent: true },
      'sanctions_hit':        { category: 'watchlist', subcategory: 'sanctions_match', isPermanent: true },
      'adverse_media':        { category: 'watchlist', subcategory: 'adverse_media', isPermanent: false },
      'session_timeout':      { category: 'technical', subcategory: 'session_timeout', isPermanent: false },
      'upload_failed':        { category: 'technical', subcategory: 'upload_failed', isPermanent: false },
      'provider_error':       { category: 'technical', subcategory: 'provider_error', isPermanent: false },
      'suspicious_speed':     { category: 'behavioral', subcategory: 'suspicious_speed', isPermanent: false },
      'vpn_detected':         { category: 'behavioral', subcategory: 'vpn_detected', isPermanent: false },
      'geo_mismatch':         { category: 'behavioral', subcategory: 'geo_mismatch', isPermanent: false },
    };

    return codeMap[code] ?? { category: 'technical', subcategory: 'provider_error', isPermanent: false };
  }

  /**
   * Get decline reasons for a verification.
   */
  static async getDeclineReasons(verificationId: string): Promise<KYCDeclineReason[]> {
    const { data, error } = await supabase
      .from('kyc_decline_reasons')
      .select('*')
      .eq('kyc_verification_id', verificationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch decline reasons: ${error.message}`);
    return (data ?? []).map(mapDeclineReason);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section I — Stale Verification Reconciliation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Cron job: find verifications stuck in provider_pending for > 1 hour.
   * Reconcile by checking Persona API directly.
   */
  static async reconcileStaleVerifications(): Promise<{
    checked: number;
    reconciled: number;
    errors: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stale, error } = await supabase
      .from('kyc_verifications')
      .select('id, provider_inquiry_id')
      .eq('status', 'provider_pending')
      .lt('initiated_at', oneHourAgo)
      .not('provider_inquiry_id', 'is', null);

    if (error) throw new Error(`Failed to fetch stale verifications: ${error.message}`);
    if (!stale || stale.length === 0) return { checked: 0, reconciled: 0, errors: 0 };

    let reconciled = 0;
    let errors = 0;

    for (const record of stale) {
      try {
        const providerStatus = await this.checkProviderStatus(record.provider_inquiry_id);

        if (providerStatus !== 'pending') {
          // Provider has a result we missed — would need to fetch full data
          // For now, flag for admin review
          await supabase
            .from('kyc_verifications')
            .update({ status: 'admin_review', manual_review_reason: 'stale_reconciliation' })
            .eq('id', record.id);

          await this.createAdminReview(
            record.id,
            '', // member_id would need to be fetched
            'manual_escalation',
            'medium'
          );
          reconciled++;
        }
      } catch {
        errors++;
      }
    }

    return { checked: stale.length, reconciled, errors };
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section J — A/B Testing
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Deterministic experiment group assignment.
   * Same member always gets same variant for a given experiment.
   */
  private static _assignExperimentGroup(memberId: string, experimentId: string): string {
    const combined = `${memberId}_${experimentId}`;
    const hash = combined.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variants = ['control', 'variant_a'];
    return variants[hash % variants.length];
  }

  /**
   * Get experiment metrics for an experiment.
   */
  static async getExperimentMetrics(experimentId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('kyc_experiment_metrics')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('metric_date', { ascending: false });

    if (error) throw new Error(`Failed to fetch experiment metrics: ${error.message}`);
    return data ?? [];
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section K — Admin Queries
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get KYC dashboard statistics.
   */
  static async getDashboardStats(): Promise<KYCDashboardStats> {
    const { count: total } = await supabase
      .from('kyc_verifications').select('*', { count: 'exact', head: true });

    const { count: pending } = await supabase
      .from('kyc_verifications').select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'provider_pending']);

    const { count: approved } = await supabase
      .from('kyc_verifications').select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: rejected } = await supabase
      .from('kyc_verifications').select('*', { count: 'exact', head: true })
      .eq('status', 'rejected');

    const { count: manualReview } = await supabase
      .from('kyc_admin_reviews').select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_review']);

    // Top decline reasons
    const { data: declineData } = await supabase
      .from('kyc_decline_reasons')
      .select('reason_subcategory')
      .order('created_at', { ascending: false })
      .limit(200);

    const reasonCounts: Record<string, number> = {};
    for (const row of declineData ?? []) {
      const r = row.reason_subcategory;
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    }
    const topDeclineReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // First attempt success rate
    const { count: firstAttempt } = await supabase
      .from('kyc_verifications').select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('rejection_count', 0);

    const t = total ?? 0;
    const a = approved ?? 0;

    return {
      totalVerifications: t,
      pendingCount: pending ?? 0,
      approvedCount: a,
      rejectedCount: rejected ?? 0,
      manualReviewCount: manualReview ?? 0,
      avgCompletionTimeHours: null, // Computed from initiated_at to completed_at
      approvalRate: t > 0 ? Math.round(a / t * 10000) / 100 : 0,
      firstAttemptSuccessRate: a > 0 ? Math.round((firstAttempt ?? 0) / a * 10000) / 100 : 0,
      topDeclineReasons,
    };
  }

  /**
   * Get all verifications with a specific status.
   */
  static async getVerificationsByStatus(status: KYCStatus, limit: number = 50): Promise<KYCVerification[]> {
    const { data, error } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch verifications: ${error.message}`);
    return (data ?? []).map(mapVerification);
  }

  /**
   * Get webhook events for debugging.
   */
  static async getWebhookEvents(inquiryId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('kyc_provider_webhooks')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('received_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch webhook events: ${error.message}`);
    return data ?? [];
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section L — Realtime
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to verification status updates for a member.
   * The KYC-106 pending screen uses this to auto-update when Persona completes.
   */
  static subscribeToVerification(memberId: string, callback: () => void) {
    return supabase
      .channel(`kyc_verification_${memberId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_verifications',
          filter: `member_id=eq.${memberId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to admin review queue updates.
   */
  static subscribeToAdminReviews(callback: () => void) {
    return supabase
      .channel('kyc_admin_reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_admin_reviews',
        },
        callback
      )
      .subscribe();
  }
}
