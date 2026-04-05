/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LEGAL DOCUMENT ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Every legal document gets a plain-language summary in the member's preferred
 * language (15 languages). Two-layer display: summary on top, full text below.
 * Members sign the full document; the summary ensures informed consent.
 * AI simplification pipeline drafts summaries; legal team approves.
 *
 * Sections:
 *   A — Document Management          D — Change Detection & Notification
 *   B — Content Management            E — AI Simplification
 *   C — Acceptance Flow               F — Realtime
 */

import { supabase } from '@/lib/supabase';


// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type LegalDocumentType =
  | 'terms_of_service'
  | 'privacy_policy'
  | 'circle_participation'
  | 'liquidity_advance'
  | 'kyc_consent'
  | 'payout_authorization';

export type LegalDocumentStatus = 'draft' | 'review' | 'active' | 'archived';

export type SimplificationJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'approved'
  | 'rejected';

export type SupportedLanguage =
  | 'en' | 'fr' | 'es' | 'pt' | 'hi' | 'tl' | 'zh'
  | 'vi' | 'ko' | 'ar' | 'am' | 'sw' | 'yo' | 'ha' | 'ht';

export interface LegalDocument {
  id: string;
  documentType: LegalDocumentType;
  version: number;
  status: LegalDocumentStatus;
  effectiveDate: string | null;
  requiresReconfirmation: boolean;
  changeSummary: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface LegalDocumentContent {
  id: string;
  documentId: string;
  language: SupportedLanguage;
  fullText: string;
  summaryText: string | null;
  aiGenerated: boolean;
  aiApproved: boolean;
  aiApprovedBy: string | null;
  aiApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberLegalAcceptance {
  id: string;
  memberId: string;
  documentId: string;
  documentType: LegalDocumentType;
  version: number;
  acceptedAt: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  languageViewed: string;
  createdAt: string;
}

export interface AiSimplificationJob {
  id: string;
  documentId: string;
  language: string;
  sourceText: string;
  promptUsed: string;
  aiOutput: string | null;
  status: SimplificationJobStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptDocumentResult {
  acceptance: MemberLegalAcceptance;
  documentType: LegalDocumentType;
  version: number;
}

export interface PendingAcceptance {
  document: LegalDocument;
  content: LegalDocumentContent | null;
  requiresReconfirmation: boolean;
  previousVersion: number | null;
}

export interface ChangeSummaryItem {
  language: string;
  bullets: string[];
}


// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE NAMES — used in AI simplification prompts
// ═══════════════════════════════════════════════════════════════════════════════

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'French (Ivorian register, not Parisian formal)',
  es: 'Spanish',
  pt: 'Portuguese (Brazilian)',
  hi: 'Hindi (Romanized Hinglish acceptable)',
  tl: 'Tagalog',
  zh: 'Chinese (Simplified)',
  vi: 'Vietnamese',
  ko: 'Korean',
  ar: 'Arabic',
  am: 'Amharic',
  sw: 'Swahili',
  yo: 'Yoruba',
  ha: 'Hausa',
  ht: 'Haitian Creole',
};

const DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  circle_participation: 'Circle Participation Agreement',
  liquidity_advance: 'Liquidity Advance Agreement',
  kyc_consent: 'KYC Consent',
  payout_authorization: 'Payout Authorization',
};

const ALL_DOCUMENT_TYPES: LegalDocumentType[] = [
  'terms_of_service', 'privacy_policy', 'circle_participation',
  'liquidity_advance', 'kyc_consent', 'payout_authorization',
];


// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS — snake_case (DB) → camelCase (app)
// ═══════════════════════════════════════════════════════════════════════════════

function mapDocument(row: any): LegalDocument {
  return {
    id: row.id,
    documentType: row.document_type,
    version: row.version,
    status: row.status,
    effectiveDate: row.effective_date,
    requiresReconfirmation: row.requires_reconfirmation,
    changeSummary: row.change_summary || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContent(row: any): LegalDocumentContent {
  return {
    id: row.id,
    documentId: row.document_id,
    language: row.language,
    fullText: row.full_text,
    summaryText: row.summary_text,
    aiGenerated: row.ai_generated,
    aiApproved: row.ai_approved,
    aiApprovedBy: row.ai_approved_by,
    aiApprovedAt: row.ai_approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAcceptance(row: any): MemberLegalAcceptance {
  return {
    id: row.id,
    memberId: row.member_id,
    documentId: row.document_id,
    documentType: row.document_type,
    version: row.version,
    acceptedAt: row.accepted_at,
    ipAddress: row.ip_address,
    deviceInfo: row.device_info,
    languageViewed: row.language_viewed,
    createdAt: row.created_at,
  };
}

function mapSimplificationJob(row: any): AiSimplificationJob {
  return {
    id: row.id,
    documentId: row.document_id,
    language: row.language,
    sourceText: row.source_text,
    promptUsed: row.prompt_used,
    aiOutput: row.ai_output,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class LegalDocumentEngine {

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION A — Document Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new legal document version in draft status.
   */
  static async createDocument(
    type: LegalDocumentType,
    version: number,
    options?: {
      effectiveDate?: string;
      requiresReconfirmation?: boolean;
      changeSummary?: Record<string, string[]>;
    }
  ): Promise<LegalDocument> {
    const { data, error } = await supabase
      .from('legal_documents')
      .insert({
        document_type: type,
        version,
        status: 'draft',
        effective_date: options?.effectiveDate || null,
        requires_reconfirmation: options?.requiresReconfirmation ?? false,
        change_summary: options?.changeSummary || {},
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create document: ${error.message}`);
    return mapDocument(data);
  }

  /**
   * Publish a document: set to 'active' and archive previous active of same type.
   */
  static async publishDocument(documentId: string): Promise<LegalDocument> {
    // Get the document to publish
    const { data: doc, error: fetchErr } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchErr || !doc) throw new Error(`Document not found: ${fetchErr?.message}`);

    // Archive the currently active document of same type (if any)
    await supabase
      .from('legal_documents')
      .update({ status: 'archived' })
      .eq('document_type', doc.document_type)
      .eq('status', 'active');

    // Set this document to active
    const { data: published, error: pubErr } = await supabase
      .from('legal_documents')
      .update({
        status: 'active',
        effective_date: doc.effective_date || new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single();

    if (pubErr) throw new Error(`Failed to publish document: ${pubErr.message}`);
    return mapDocument(published);
  }

  /**
   * Archive a document.
   */
  static async archiveDocument(documentId: string): Promise<LegalDocument> {
    const { data, error } = await supabase
      .from('legal_documents')
      .update({ status: 'archived' })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to archive document: ${error.message}`);
    return mapDocument(data);
  }

  /**
   * Get the currently active document for a given type.
   */
  static async getActiveDocument(type: LegalDocumentType): Promise<LegalDocument | null> {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('document_type', type)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch active document: ${error.message}`);
    }
    return data ? mapDocument(data) : null;
  }

  /**
   * Get all active documents (up to 6, one per type).
   */
  static async getAllActiveDocuments(): Promise<LegalDocument[]> {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('status', 'active')
      .order('document_type');

    if (error) throw new Error(`Failed to fetch active documents: ${error.message}`);
    return (data || []).map(mapDocument);
  }

  /**
   * Get version history for a document type.
   */
  static async getDocumentHistory(type: LegalDocumentType): Promise<LegalDocument[]> {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('document_type', type)
      .order('version', { ascending: false });

    if (error) throw new Error(`Failed to fetch document history: ${error.message}`);
    return (data || []).map(mapDocument);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION B — Content Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Upsert content for a document in a specific language.
   */
  static async upsertContent(
    documentId: string,
    language: SupportedLanguage,
    fullText: string,
    summaryText?: string
  ): Promise<LegalDocumentContent> {
    const { data, error } = await supabase
      .from('legal_document_content')
      .upsert(
        {
          document_id: documentId,
          language,
          full_text: fullText,
          summary_text: summaryText || null,
        },
        { onConflict: 'document_id,language' }
      )
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert content: ${error.message}`);
    return mapContent(data);
  }

  /**
   * Get content for a specific document and language.
   */
  static async getContent(
    documentId: string,
    language: SupportedLanguage
  ): Promise<LegalDocumentContent | null> {
    const { data, error } = await supabase
      .from('legal_document_content')
      .select('*')
      .eq('document_id', documentId)
      .eq('language', language)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch content: ${error.message}`);
    }
    return data ? mapContent(data) : null;
  }

  /**
   * Get content with language fallback to English.
   */
  static async getContentWithFallback(
    documentId: string,
    language: SupportedLanguage
  ): Promise<LegalDocumentContent | null> {
    // Try the requested language first
    const content = await this.getContent(documentId, language);
    if (content) return content;

    // Fallback to English
    if (language !== 'en') {
      return this.getContent(documentId, 'en');
    }

    return null;
  }

  /**
   * Get all language variants for a document.
   */
  static async getAllContentForDocument(
    documentId: string
  ): Promise<LegalDocumentContent[]> {
    const { data, error } = await supabase
      .from('legal_document_content')
      .select('*')
      .eq('document_id', documentId)
      .order('language');

    if (error) throw new Error(`Failed to fetch all content: ${error.message}`);
    return (data || []).map(mapContent);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION C — Acceptance Flow
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record a member's acceptance of a legal document.
   * Denormalizes document_type and version for fast queries.
   */
  static async acceptDocument(
    userId: string,
    documentId: string,
    options?: {
      ipAddress?: string;
      deviceInfo?: string;
      languageViewed?: SupportedLanguage;
    }
  ): Promise<AcceptDocumentResult> {
    // Lookup document to denormalize type + version
    const { data: doc, error: docErr } = await supabase
      .from('legal_documents')
      .select('document_type, version')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) throw new Error(`Document not found: ${docErr?.message}`);

    const { data, error } = await supabase
      .from('member_legal_acceptances')
      .insert({
        member_id: userId,
        document_id: documentId,
        document_type: doc.document_type,
        version: doc.version,
        ip_address: options?.ipAddress || null,
        device_info: options?.deviceInfo || null,
        language_viewed: options?.languageViewed || 'en',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record acceptance: ${error.message}`);

    return {
      acceptance: mapAcceptance(data),
      documentType: doc.document_type,
      version: doc.version,
    };
  }

  /**
   * Get the most recent acceptance for a member + document type.
   */
  static async getAcceptanceRecord(
    userId: string,
    documentType: LegalDocumentType
  ): Promise<MemberLegalAcceptance | null> {
    const { data, error } = await supabase
      .from('member_legal_acceptances')
      .select('*')
      .eq('member_id', userId)
      .eq('document_type', documentType)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch acceptance: ${error.message}`);
    }
    return data ? mapAcceptance(data) : null;
  }

  /**
   * Check if member has accepted the latest active version of a document type.
   */
  static async hasAcceptedLatest(
    userId: string,
    documentType: LegalDocumentType
  ): Promise<boolean> {
    const activeDoc = await this.getActiveDocument(documentType);
    if (!activeDoc) return true; // No active document = nothing to accept

    const acceptance = await this.getAcceptanceRecord(userId, documentType);
    if (!acceptance) return false; // Never accepted

    return acceptance.version >= activeDoc.version;
  }

  /**
   * Get all documents pending acceptance or reconfirmation for a member.
   * Returns documents with content resolved in the member's language.
   */
  static async getPendingAcceptances(
    userId: string,
    language?: SupportedLanguage
  ): Promise<PendingAcceptance[]> {
    const memberLang = language || await this._getMemberLanguage(userId);

    // Fetch all active documents
    const activeDocs = await this.getAllActiveDocuments();
    if (activeDocs.length === 0) return [];

    // Fetch all member's acceptances (most recent per type)
    const { data: acceptances, error } = await supabase
      .from('member_legal_acceptances')
      .select('*')
      .eq('member_id', userId)
      .order('version', { ascending: false });

    if (error) throw new Error(`Failed to fetch acceptances: ${error.message}`);

    // Build a map of latest acceptance per document type
    const latestAcceptance: Record<string, MemberLegalAcceptance> = {};
    for (const row of acceptances || []) {
      const mapped = mapAcceptance(row);
      if (!latestAcceptance[mapped.documentType]) {
        latestAcceptance[mapped.documentType] = mapped;
      }
    }

    // Determine which documents need action
    const pending: PendingAcceptance[] = [];

    for (const doc of activeDocs) {
      const acceptance = latestAcceptance[doc.documentType];
      let needsAction = false;
      let previousVersion: number | null = null;

      if (!acceptance) {
        // Never accepted
        needsAction = true;
      } else if (acceptance.version < doc.version) {
        // Newer version exists
        if (doc.requiresReconfirmation) {
          needsAction = true;
          previousVersion = acceptance.version;
        }
      }

      if (needsAction) {
        const content = await this.getContentWithFallback(doc.id, memberLang);
        pending.push({
          document: doc,
          content,
          requiresReconfirmation: previousVersion !== null,
          previousVersion,
        });
      }
    }

    return pending;
  }

  /**
   * Get full acceptance audit trail for a member.
   */
  static async getAllAcceptances(userId: string): Promise<MemberLegalAcceptance[]> {
    const { data, error } = await supabase
      .from('member_legal_acceptances')
      .select('*')
      .eq('member_id', userId)
      .order('accepted_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch acceptances: ${error.message}`);
    return (data || []).map(mapAcceptance);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION D — Change Detection & Notification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get documents requiring reconfirmation for a member.
   */
  static async getDocumentsRequiringReconfirmation(
    userId: string
  ): Promise<PendingAcceptance[]> {
    const pending = await this.getPendingAcceptances(userId);
    return pending.filter((p) => p.requiresReconfirmation);
  }

  /**
   * Queue notifications for all members who need to reconfirm a changed document.
   * Queries all members who previously accepted this document type.
   */
  static async notifyMembersOfChange(documentId: string): Promise<number> {
    // Get the document
    const { data: doc, error: docErr } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) throw new Error(`Document not found: ${docErr?.message}`);

    const mapped = mapDocument(doc);

    // Find all members who previously accepted this document type
    // (distinct member_ids with an acceptance for this document_type)
    const { data: members, error: memErr } = await supabase
      .from('member_legal_acceptances')
      .select('member_id')
      .eq('document_type', mapped.documentType);

    if (memErr) throw new Error(`Failed to query members: ${memErr.message}`);

    // Deduplicate member IDs
    const uniqueMembers = [...new Set((members || []).map((m: any) => m.member_id))];
    if (uniqueMembers.length === 0) return 0;

    // Build notification rows
    const label = DOCUMENT_TYPE_LABELS[mapped.documentType];
    const changeBullets = mapped.changeSummary['en'] || ['Terms have been updated.'];
    const bodyText = `We updated our ${label}. Here's what changed: ${changeBullets.join('. ')}. Tap to review and re-confirm.`;

    const notificationRows = uniqueMembers.map((memberId) => ({
      member_id: memberId,
      notification_type: 'platform_community',
      title: `${label} Updated`,
      body: bodyText.substring(0, 200),
      data: {
        document_id: documentId,
        document_type: mapped.documentType,
        version: mapped.version,
        change_summary: mapped.changeSummary,
      },
      status: 'pending',
    }));

    // Insert in batches of 100
    let notified = 0;
    for (let i = 0; i < notificationRows.length; i += 100) {
      const batch = notificationRows.slice(i, i + 100);
      const { error: insertErr } = await supabase
        .from('notification_queue')
        .insert(batch);

      if (insertErr) {
        console.warn('[LegalDocument] Failed to queue notification batch:', insertErr);
      } else {
        notified += batch.length;
      }
    }

    return notified;
  }

  /**
   * Get change summary bullets for a document in a specific language.
   * Falls back to English.
   */
  static getChangeSummary(
    document: LegalDocument,
    language: SupportedLanguage
  ): string[] {
    const summary = document.changeSummary;
    if (summary[language] && summary[language].length > 0) {
      return summary[language];
    }
    if (summary['en'] && summary['en'].length > 0) {
      return summary['en'];
    }
    return [];
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION E — AI Simplification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Request an AI simplification of a legal document for a specific language.
   * Creates a job record; a backend Edge Function processes pending jobs.
   */
  static async requestSimplification(
    documentId: string,
    language: SupportedLanguage,
    fullText: string
  ): Promise<AiSimplificationJob> {
    const prompt = this.buildSimplificationPrompt(fullText, language);

    const { data, error } = await supabase
      .from('ai_simplification_jobs')
      .insert({
        document_id: documentId,
        language,
        source_text: fullText,
        prompt_used: prompt,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create simplification job: ${error.message}`);
    return mapSimplificationJob(data);
  }

  /**
   * Get a simplification job by ID.
   */
  static async getSimplificationJob(
    jobId: string
  ): Promise<AiSimplificationJob | null> {
    const { data, error } = await supabase
      .from('ai_simplification_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch simplification job: ${error.message}`);
    }
    return data ? mapSimplificationJob(data) : null;
  }

  /**
   * Get all simplification jobs for a document.
   */
  static async getJobsForDocument(
    documentId: string
  ): Promise<AiSimplificationJob[]> {
    const { data, error } = await supabase
      .from('ai_simplification_jobs')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);
    return (data || []).map(mapSimplificationJob);
  }

  /**
   * Approve an AI simplification: copy output to legal_document_content.summary_text.
   */
  static async approveSimplification(
    jobId: string,
    approvedBy: string
  ): Promise<AiSimplificationJob> {
    // Get the job
    const job = await this.getSimplificationJob(jobId);
    if (!job) throw new Error('Simplification job not found');
    if (job.status !== 'completed') throw new Error(`Cannot approve job in status: ${job.status}`);
    if (!job.aiOutput) throw new Error('Job has no AI output to approve');

    // Update job status
    const { data: updatedJob, error: jobErr } = await supabase
      .from('ai_simplification_jobs')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (jobErr) throw new Error(`Failed to approve job: ${jobErr.message}`);

    // Copy AI output to legal_document_content as the approved summary
    const { error: contentErr } = await supabase
      .from('legal_document_content')
      .update({
        summary_text: job.aiOutput,
        ai_generated: true,
        ai_approved: true,
        ai_approved_by: approvedBy,
        ai_approved_at: new Date().toISOString(),
      })
      .eq('document_id', job.documentId)
      .eq('language', job.language);

    if (contentErr) {
      console.warn('[LegalDocument] Failed to update content with approved summary:', contentErr);
    }

    return mapSimplificationJob(updatedJob);
  }

  /**
   * Reject an AI simplification.
   */
  static async rejectSimplification(jobId: string): Promise<AiSimplificationJob> {
    const { data, error } = await supabase
      .from('ai_simplification_jobs')
      .update({ status: 'rejected' })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reject job: ${error.message}`);
    return mapSimplificationJob(data);
  }

  /**
   * Build the Claude API prompt for simplifying legal text.
   * Pure function — returns the prompt string.
   */
  static buildSimplificationPrompt(
    fullText: string,
    language: SupportedLanguage
  ): string {
    const langName = LANGUAGE_NAMES[language] || 'English';

    return `You are a legal simplification assistant for TandaXn, a diaspora community financial platform.

Simplify the following legal document into plain language in ${langName}.

Rules:
- Write at a 7th grade reading level
- Use short sentences (max 15 words per sentence where possible)
- Use active voice throughout
- Explain every technical or legal term the first time it appears
- Format as bullet points where appropriate
- The audience is a diaspora community member who may not be familiar with US or French legal terminology
- Maintain all legal meaning — simplify the language, not the obligations
- Do not add information that is not in the original document
- Do not remove any material obligations or rights

Document to simplify:
---
${fullText}
---

Output the simplified version only, no preamble or explanation.`;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION F — Realtime
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to legal document updates (new versions published, status changes).
   */
  static subscribeToDocumentUpdates(callback: () => void) {
    return supabase
      .channel('legal-documents-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'legal_documents' },
        () => callback()
      )
      .subscribe();
  }

  /**
   * Subscribe to a member's legal acceptances.
   */
  static subscribeToAcceptances(userId: string, callback: () => void) {
    return supabase
      .channel(`legal-acceptances-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'member_legal_acceptances',
          filter: `member_id=eq.${userId}`,
        },
        () => callback()
      )
      .subscribe();
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE — Language Resolution
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve a member's preferred language. Falls back to 'en'.
   * Same pattern as ExplainableAIEngine.getMemberLanguage.
   */
  private static async _getMemberLanguage(
    userId: string
  ): Promise<SupportedLanguage> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', userId)
        .single();

      if (!error && data?.preferred_language) {
        return data.preferred_language as SupportedLanguage;
      }
    } catch {
      // Fall through to default
    }
    return 'en';
  }
}
