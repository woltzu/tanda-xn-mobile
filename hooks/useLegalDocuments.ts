/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LEGAL DOCUMENT HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the Legal Document engine.
 *
 * P1 (legal-docs review) changes:
 *   - Module-scope caches with a 5-minute TTL. Legal documents change on
 *     the order of months, not minutes, so refetching on every mount is
 *     pure waste. Consumers call refetch() inside a useFocusEffect to
 *     get fresh data when the screen actually becomes visible.
 *   - Realtime subscriptions removed from the hooks. The cost of three
 *     WebSocket channels per mount (active docs, pending acceptances,
 *     and the inner acceptance channel) was not worth the rarity of
 *     updates. The engine's subscribeToDocumentUpdates and
 *     subscribeToAcceptances helpers are still exported for the
 *     occasional admin / background use case.
 *   - New useAllAcceptances hook surfaces the full audit trail so the
 *     list screen can render "Accepted on YYYY-MM-DD (vX)" lines without
 *     per-row queries.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
// P1 — Module-scope cache
// ═══════════════════════════════════════════════════════════════════════════════
//
// One Map per fetcher, keyed by the arguments that influence the result.
// Entries expire after CACHE_TTL_MS; an explicit refetch() invalidates
// the matching entry so consumers get fresh data on demand.
//
// Lives at module scope so it survives unmount/remount, which is the
// common case when a user taps into the reader screen and back. Without
// this, the list refetches every time.
//
// The cache is INTENTIONALLY not per-React-hook. Multiple components
// requesting the same data share the same in-flight result.

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { data: T; ts: number };

const activeDocsCache: { entry: CacheEntry<LegalDocument[]> | null } = {
  entry: null,
};
const pendingCache = new Map<string, CacheEntry<PendingAcceptance[]>>();
const acceptanceRecordCache = new Map<
  string,
  CacheEntry<MemberLegalAcceptance | null>
>();
const allAcceptancesCache = new Map<
  string,
  CacheEntry<MemberLegalAcceptance[]>
>();
const documentCache = new Map<
  string,
  CacheEntry<{ document: LegalDocument | null; content: LegalDocumentContent | null }>
>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined): boolean {
  return !!entry && Date.now() - entry.ts < CACHE_TTL_MS;
}


// ═══════════════════════════════════════════════════════════════════════════════
// useActiveDocuments — All currently active legal documents
// ═══════════════════════════════════════════════════════════════════════════════

export function useActiveDocuments() {
  const [documents, setDocuments] = useState<LegalDocument[]>(
    () => activeDocsCache.entry?.data ?? [],
  );
  const [loading, setLoading] = useState(!isFresh(activeDocsCache.entry));
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (force = false) => {
    if (!force && isFresh(activeDocsCache.entry)) {
      setDocuments(activeDocsCache.entry!.data);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await LegalDocumentEngine.getAllActiveDocuments();
      activeDocsCache.entry = { data, ts: Date.now() };
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

  const documentCount = useMemo(() => documents.length, [documents]);
  const hasDocuments = useMemo(() => documents.length > 0, [documents]);

  return {
    documents,
    loading,
    error,
    refetch: () => fetchDocuments(true),
    documentCount,
    hasDocuments,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useLegalDocument — Single active document with content in member's language
// ═══════════════════════════════════════════════════════════════════════════════

export function useLegalDocument(
  documentType?: LegalDocumentType,
  language?: SupportedLanguage,
) {
  const cacheKey = `${documentType ?? ''}:${language ?? 'en'}`;
  const [document, setDocument] = useState<LegalDocument | null>(
    () => documentCache.get(cacheKey)?.data?.document ?? null,
  );
  const [content, setContent] = useState<LegalDocumentContent | null>(
    () => documentCache.get(cacheKey)?.data?.content ?? null,
  );
  const [loading, setLoading] = useState(
    !isFresh(documentCache.get(cacheKey)),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async (force = false) => {
    if (!documentType) {
      setDocument(null);
      setContent(null);
      setLoading(false);
      return;
    }

    const cached = documentCache.get(cacheKey);
    if (!force && isFresh(cached)) {
      setDocument(cached!.data.document);
      setContent(cached!.data.content);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const doc = await LegalDocumentEngine.getActiveDocument(documentType);
      const docContent = doc
        ? await LegalDocumentEngine.getContentWithFallback(
            doc.id,
            language || 'en',
          )
        : null;

      documentCache.set(cacheKey, {
        data: { document: doc, content: docContent },
        ts: Date.now(),
      });
      setDocument(doc);
      setContent(docContent);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch legal document');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, documentType, language]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const hasSummary = useMemo(
    () => content?.summaryText !== null && content?.summaryText !== undefined,
    [content],
  );
  const summaryText = useMemo(() => content?.summaryText || null, [content]);
  const fullText = useMemo(() => content?.fullText || null, [content]);
  const isAiApproved = useMemo(() => content?.aiApproved ?? false, [content]);

  return {
    document,
    content,
    loading,
    error,
    refetch: () => fetchDocument(true),
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
  const key = userId ?? '';
  const [pending, setPending] = useState<PendingAcceptance[]>(
    () => (key ? pendingCache.get(key)?.data ?? [] : []),
  );
  const [loading, setLoading] = useState(
    !!key && !isFresh(pendingCache.get(key)),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async (force = false) => {
    if (!userId) {
      setPending([]);
      setLoading(false);
      return;
    }

    const cached = pendingCache.get(userId);
    if (!force && isFresh(cached)) {
      setPending(cached!.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await LegalDocumentEngine.getPendingAcceptances(userId);
      pendingCache.set(userId, { data, ts: Date.now() });
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

  const pendingCount = useMemo(() => pending.length, [pending]);
  const hasPending = useMemo(() => pending.length > 0, [pending]);
  const requiresReconfirmation = useMemo(
    () => pending.filter((p) => p.requiresReconfirmation),
    [pending],
  );

  return {
    pending,
    loading,
    error,
    refetch: () => fetchPending(true),
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
  documentType?: LegalDocumentType,
) {
  const cacheKey = userId && documentType ? `${userId}:${documentType}` : '';
  const initial = cacheKey ? acceptanceRecordCache.get(cacheKey) : null;
  const [acceptance, setAcceptance] = useState<MemberLegalAcceptance | null>(
    () => initial?.data ?? null,
  );
  const [hasAcceptedLatest, setHasAcceptedLatest] = useState(false);
  const [loading, setLoading] = useState(!isFresh(initial));
  const [error, setError] = useState<string | null>(null);

  const fetchAcceptance = useCallback(async (force = false) => {
    if (!userId || !documentType) {
      setAcceptance(null);
      setHasAcceptedLatest(false);
      setLoading(false);
      return;
    }

    const cached = acceptanceRecordCache.get(cacheKey);
    if (!force && isFresh(cached)) {
      setAcceptance(cached!.data);
      // hasAcceptedLatest is cheaper to recompute than to cache —
      // depends on the active doc version which has its own cache.
      const accepted = await LegalDocumentEngine.hasAcceptedLatest(
        userId,
        documentType,
      );
      setHasAcceptedLatest(accepted);
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

      acceptanceRecordCache.set(cacheKey, { data: record, ts: Date.now() });
      setAcceptance(record);
      setHasAcceptedLatest(accepted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch acceptance status');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, userId, documentType]);

  useEffect(() => {
    fetchAcceptance();
  }, [fetchAcceptance]);

  const acceptedAt = useMemo(
    () => acceptance?.acceptedAt || null,
    [acceptance],
  );
  const acceptedVersion = useMemo(
    () => acceptance?.version || null,
    [acceptance],
  );
  const needsReconfirmation = useMemo(
    () => !hasAcceptedLatest && acceptance !== null,
    [hasAcceptedLatest, acceptance],
  );

  return {
    acceptance,
    hasAcceptedLatest,
    loading,
    error,
    refetch: () => fetchAcceptance(true),
    acceptedAt,
    acceptedVersion,
    needsReconfirmation,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useAllAcceptances — Full audit list + Map keyed by document_type
// ═══════════════════════════════════════════════════════════════════════════════
//
// P1 — surfaces every acceptance the member has on file so the list
// screen can show "Accepted on …" lines without a per-row query.
// The Map is keyed by the latest-version acceptance per type, which is
// what the list cards care about.

export function useAllAcceptances(userId?: string) {
  const key = userId ?? '';
  const [acceptances, setAcceptances] = useState<MemberLegalAcceptance[]>(
    () => (key ? allAcceptancesCache.get(key)?.data ?? [] : []),
  );
  const [loading, setLoading] = useState(
    !!key && !isFresh(allAcceptancesCache.get(key)),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (force = false) => {
    if (!userId) {
      setAcceptances([]);
      setLoading(false);
      return;
    }

    const cached = allAcceptancesCache.get(userId);
    if (!force && isFresh(cached)) {
      setAcceptances(cached!.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await LegalDocumentEngine.getAllAcceptances(userId);
      allAcceptancesCache.set(userId, { data, ts: Date.now() });
      setAcceptances(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch acceptances');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Latest acceptance per document type. getAllAcceptances orders by
  // accepted_at DESC so the first hit per type is the most recent.
  const byType = useMemo(() => {
    const map = new Map<LegalDocumentType, MemberLegalAcceptance>();
    for (const a of acceptances) {
      const type = a.documentType as LegalDocumentType;
      if (!map.has(type)) map.set(type, a);
    }
    return map;
  }, [acceptances]);

  return {
    acceptances,
    byType,
    loading,
    error,
    refetch: () => fetchAll(true),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useDocumentHistory — All versions of a given document type
// ═══════════════════════════════════════════════════════════════════════════════
//
// P1 — feeds the "View previous versions" modal. Not cached (rare call;
// the modal mounts on demand) and not realtime.

export function useDocumentHistory(documentType?: LegalDocumentType) {
  const [history, setHistory] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTypeRef = useRef<LegalDocumentType | undefined>(undefined);

  const fetchHistory = useCallback(async () => {
    if (!documentType) {
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await LegalDocumentEngine.getDocumentHistory(documentType);
      setHistory(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch document history');
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    if (lastTypeRef.current !== documentType) {
      lastTypeRef.current = documentType;
      fetchHistory();
    }
  }, [documentType, fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
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
    },
  ): Promise<AcceptDocumentResult | null> => {
    try {
      setAccepting(true);
      setError(null);
      const result = await LegalDocumentEngine.acceptDocument(
        userId,
        documentId,
        options,
      );
      // Invalidate caches that just went stale. The list screen will
      // refetch on next focus; the reader uses its own state.
      pendingCache.delete(userId);
      allAcceptancesCache.delete(userId);
      // Drop any per-type acceptance cache rows for this user.
      for (const k of acceptanceRecordCache.keys()) {
        if (k.startsWith(`${userId}:`)) acceptanceRecordCache.delete(k);
      }
      return result;
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
    fullText: string,
  ): Promise<AiSimplificationJob | null> => {
    try {
      setSimplifying(true);
      setError(null);
      return await LegalDocumentEngine.requestSimplification(
        documentId, language, fullText,
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
    approvedBy: string,
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
    jobId: string,
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
