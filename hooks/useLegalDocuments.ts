/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LEGAL DOCUMENT HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the Legal Document engine.
 * 5 hooks: useActiveDocuments, useLegalDocument, usePendingAcceptances,
 *          useDocumentAcceptance, useLegalDocumentActions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LegalDocumentEngine,
  type LegalDocumentType,
  type LegalDocumentStatus,
  type SupportedLanguage,
  type SimplificationJobStatus,
  type LegalDocument,
  type LegalDocumentContent,
  type MemberLegalAcceptance,
  type AiSimplificationJob,
  type AcceptDocumentResult,
  type PendingAcceptance,
  type ChangeSummaryItem,
} from '@/services/LegalDocumentEngine';

// Re-export all types for consumer convenience
export type {
  LegalDocumentType,
  LegalDocumentStatus,
  SupportedLanguage,
  SimplificationJobStatus,
  LegalDocument,
  LegalDocumentContent,
  MemberLegalAcceptance,
  AiSimplificationJob,
  AcceptDocumentResult,
  PendingAcceptance,
  ChangeSummaryItem,
};


// ═══════════════════════════════════════════════════════════════════════════════
// useActiveDocuments — All currently active legal documents
// ═══════════════════════════════════════════════════════════════════════════════

export function useActiveDocuments() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await LegalDocumentEngine.getAllActiveDocuments();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch active documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Realtime subscription
  useEffect(() => {
    const channel = LegalDocumentEngine.subscribeToDocumentUpdates(() => {
      fetchDocuments();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDocuments]);

  // Computed
  const documentCount = useMemo(() => documents.length, [documents]);
  const hasDocuments = useMemo(() => documents.length > 0, [documents]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    documentCount,
    hasDocuments,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useLegalDocument — Single active document with content in member's language
// ═══════════════════════════════════════════════════════════════════════════════

export function useLegalDocument(
  documentType?: LegalDocumentType,
  language?: SupportedLanguage
) {
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [content, setContent] = useState<LegalDocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    if (!documentType) {
      setDocument(null);
      setContent(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const doc = await LegalDocumentEngine.getActiveDocument(documentType);
      setDocument(doc);

      if (doc) {
        const lang = language || 'en';
        const docContent = await LegalDocumentEngine.getContentWithFallback(
          doc.id,
          lang
        );
        setContent(docContent);
      } else {
        setContent(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch legal document');
    } finally {
      setLoading(false);
    }
  }, [documentType, language]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Realtime subscription
  useEffect(() => {
    const channel = LegalDocumentEngine.subscribeToDocumentUpdates(() => {
      fetchDocument();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDocument]);

  // Computed
  const hasSummary = useMemo(
    () => content?.summaryText !== null && content?.summaryText !== undefined,
    [content]
  );
  const summaryText = useMemo(
    () => content?.summaryText || null,
    [content]
  );
  const fullText = useMemo(
    () => content?.fullText || null,
    [content]
  );
  const isAiApproved = useMemo(
    () => content?.aiApproved ?? false,
    [content]
  );

  return {
    document,
    content,
    loading,
    error,
    refetch: fetchDocument,
    hasSummary,
    summaryText,
    fullText,
    isAiApproved,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// usePendingAcceptances — Documents needing acceptance or reconfirmation
// ═══════════════════════════════════════════════════════════════════════════════

export function usePendingAcceptances(userId?: string) {
  const [pending, setPending] = useState<PendingAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!userId) {
      setPending([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await LegalDocumentEngine.getPendingAcceptances(userId);
      setPending(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pending acceptances');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Realtime: refresh on document changes or new acceptances
  useEffect(() => {
    if (!userId) return;

    const docChannel = LegalDocumentEngine.subscribeToDocumentUpdates(() => {
      fetchPending();
    });

    const acceptChannel = LegalDocumentEngine.subscribeToAcceptances(userId, () => {
      fetchPending();
    });

    return () => {
      supabase.removeChannel(docChannel);
      supabase.removeChannel(acceptChannel);
    };
  }, [userId, fetchPending]);

  // Computed
  const pendingCount = useMemo(() => pending.length, [pending]);
  const hasPending = useMemo(() => pending.length > 0, [pending]);
  const requiresReconfirmation = useMemo(
    () => pending.filter((p) => p.requiresReconfirmation),
    [pending]
  );

  return {
    pending,
    loading,
    error,
    refetch: fetchPending,
    pendingCount,
    hasPending,
    requiresReconfirmation,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useDocumentAcceptance — Acceptance status for a single document type
// ═══════════════════════════════════════════════════════════════════════════════

export function useDocumentAcceptance(
  userId?: string,
  documentType?: LegalDocumentType
) {
  const [acceptance, setAcceptance] = useState<MemberLegalAcceptance | null>(null);
  const [hasAcceptedLatest, setHasAcceptedLatest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAcceptance = useCallback(async () => {
    if (!userId || !documentType) {
      setAcceptance(null);
      setHasAcceptedLatest(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [record, accepted] = await Promise.all([
        LegalDocumentEngine.getAcceptanceRecord(userId, documentType),
        LegalDocumentEngine.hasAcceptedLatest(userId, documentType),
      ]);

      setAcceptance(record);
      setHasAcceptedLatest(accepted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch acceptance status');
    } finally {
      setLoading(false);
    }
  }, [userId, documentType]);

  useEffect(() => {
    fetchAcceptance();
  }, [fetchAcceptance]);

  // Realtime
  useEffect(() => {
    if (!userId) return;

    const channel = LegalDocumentEngine.subscribeToAcceptances(userId, () => {
      fetchAcceptance();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAcceptance]);

  // Computed
  const acceptedAt = useMemo(
    () => acceptance?.acceptedAt || null,
    [acceptance]
  );
  const acceptedVersion = useMemo(
    () => acceptance?.version || null,
    [acceptance]
  );
  const needsReconfirmation = useMemo(
    () => !hasAcceptedLatest && acceptance !== null,
    [hasAcceptedLatest, acceptance]
  );

  return {
    acceptance,
    hasAcceptedLatest,
    loading,
    error,
    refetch: fetchAcceptance,
    acceptedAt,
    acceptedVersion,
    needsReconfirmation,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useLegalDocumentActions — Action callbacks
// ═══════════════════════════════════════════════════════════════════════════════

export function useLegalDocumentActions() {
  const [accepting, setAccepting] = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptDocument = useCallback(async (
    userId: string,
    documentId: string,
    options?: {
      ipAddress?: string;
      deviceInfo?: string;
      languageViewed?: SupportedLanguage;
    }
  ): Promise<AcceptDocumentResult | null> => {
    try {
      setAccepting(true);
      setError(null);
      return await LegalDocumentEngine.acceptDocument(userId, documentId, options);
    } catch (err: any) {
      setError(err.message || 'Failed to accept document');
      return null;
    } finally {
      setAccepting(false);
    }
  }, []);

  const requestSimplification = useCallback(async (
    documentId: string,
    language: SupportedLanguage,
    fullText: string
  ): Promise<AiSimplificationJob | null> => {
    try {
      setSimplifying(true);
      setError(null);
      return await LegalDocumentEngine.requestSimplification(
        documentId, language, fullText
      );
    } catch (err: any) {
      setError(err.message || 'Failed to request simplification');
      return null;
    } finally {
      setSimplifying(false);
    }
  }, []);

  const approveSimplification = useCallback(async (
    jobId: string,
    approvedBy: string
  ): Promise<AiSimplificationJob | null> => {
    try {
      setSimplifying(true);
      setError(null);
      return await LegalDocumentEngine.approveSimplification(jobId, approvedBy);
    } catch (err: any) {
      setError(err.message || 'Failed to approve simplification');
      return null;
    } finally {
      setSimplifying(false);
    }
  }, []);

  const rejectSimplification = useCallback(async (
    jobId: string
  ): Promise<AiSimplificationJob | null> => {
    try {
      setSimplifying(true);
      setError(null);
      return await LegalDocumentEngine.rejectSimplification(jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to reject simplification');
      return null;
    } finally {
      setSimplifying(false);
    }
  }, []);

  return {
    acceptDocument,
    requestSimplification,
    approveSimplification,
    rejectSimplification,
    accepting,
    simplifying,
    error,
  };
}
