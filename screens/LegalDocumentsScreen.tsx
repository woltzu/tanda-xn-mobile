// LegalDocumentsScreen — P1 of the Legal documents review.
//
// Per-row state model:
//
//   * accepted              — user has accepted the current version. Show
//                             "Accepted on YYYY-MM-DD (vN)" line.
//   * never accepted        — fresh signup or new doc type. Banner +
//                             auto-expand + amber "What's new" pill is
//                             skipped (no "what's new" without a "what
//                             was" to compare against).
//   * requires reconfirm    — accepted an older version, current is
//                             newer. Auto-expanded; amber "What's new"
//                             pill renders the change_summary bullets
//                             in the member's language.
//
// Pull-to-refresh on the ScrollView and useFocusEffect both call the
// hook's refetch() — which bypasses the 5-min module cache added in P1.
//
// Search filter runs against the translated type label + content
// summary (200ms debounce on input), case-insensitive. Empty input
// short-circuits to the full list.
//
// Banner tap scrolls to the first pending row. We capture per-doc Y
// offsets through onLayout — simpler than converting the ScrollView to
// a FlatList just for scrollToIndex.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import {
  useActiveDocuments,
  useAllAcceptances,
  usePendingAcceptances,
  type LegalDocument,
  type LegalDocumentType,
  type MemberLegalAcceptance,
} from "../hooks/useLegalDocuments";
import { useAuth } from "../context/AuthContext";
import LegalVersionHistoryModal from "../components/LegalVersionHistoryModal";

type NavProp = StackNavigationProp<RootStackParamList>;

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  orange: "#F97316",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  bg: "#F5F7FA",
  muted: "#6B7280",
  border: "#E5E7EB",
  white: "#FFFFFF",
};

const TYPE_LABEL_KEY: Record<LegalDocumentType, string> = {
  terms_of_service: "legal_documents.doc_type_terms_of_service",
  privacy_policy: "legal_documents.doc_type_privacy_policy",
  circle_participation: "legal_documents.doc_type_circle_participation",
  liquidity_advance: "legal_documents.doc_type_liquidity_advance",
  kyc_consent: "legal_documents.doc_type_kyc_consent",
  payout_authorization: "legal_documents.doc_type_payout_authorization",
};

const SEARCH_DEBOUNCE_MS = 200;

// Format an ISO timestamp to "YYYY-MM-DD". Date.now() is forbidden in
// workflows but standard `new Date()` works fine here. Falls back to
// the raw string so a malformed input never crashes the row.
function formatYmd(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function LegalDocumentsScreen() {
  const navigation = useNavigation<NavProp>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const {
    documents,
    loading: docsLoading,
    refetch: refetchDocs,
  } = useActiveDocuments();

  const {
    pending,
    pendingCount,
    hasPending,
    loading: pendingLoading,
    refetch: refetchPending,
  } = usePendingAcceptances(user?.id);

  const {
    byType: acceptanceByType,
    refetch: refetchAcceptances,
  } = useAllAcceptances(user?.id);

  const loading = docsLoading || pendingLoading;

  // Refetch when the screen actually comes into focus. The module
  // cache means this is usually a no-op (hits the 5-min TTL); when
  // it's not, the refresh is silent.
  useFocusEffect(
    useCallback(() => {
      refetchDocs();
      refetchPending();
      refetchAcceptances();
    }, [refetchDocs, refetchPending, refetchAcceptances]),
  );

  const onRefresh = useCallback(() => {
    refetchDocs();
    refetchPending();
    refetchAcceptances();
  }, [refetchDocs, refetchPending, refetchAcceptances]);

  // Map: documentId → pending entry. Empty for "fully accepted".
  const pendingByDocId = useMemo(() => {
    const map = new Map<string, (typeof pending)[number]>();
    for (const p of pending) map.set(p.document.id, p);
    return map;
  }, [pending]);

  // Search input + debounced search term used for filtering. The state
  // split prevents the typing animation from being throttled while
  // still keeping the filter pass cheap.
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const handle = setTimeout(
      () => setSearchTerm(searchInput.trim().toLowerCase()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Per-doc state: whether the "What's new" / change-summary block is
  // expanded. Pending docs default to true; accepted docs default to
  // false. Tapping the pill flips.
  const [expandedByDocId, setExpandedByDocId] = useState<
    Record<string, boolean>
  >({});

  const titleFor = useCallback(
    (doc: LegalDocument) =>
      t(TYPE_LABEL_KEY[doc.documentType] ?? "legal_reader.header_default"),
    [t],
  );

  // Filtered list (after search). Empty searchTerm → identity.
  const visibleDocs = useMemo(() => {
    if (!searchTerm) return documents;
    return documents.filter((doc) => {
      const title = titleFor(doc).toLowerCase();
      if (title.includes(searchTerm)) return true;
      const summary = pendingByDocId
        .get(doc.id)
        ?.content?.summaryText?.toLowerCase();
      if (summary && summary.includes(searchTerm)) return true;
      return false;
    });
  }, [documents, searchTerm, titleFor, pendingByDocId]);

  // ── Scroll-to-pending wiring ──────────────────────────────────────
  const scrollRef = useRef<ScrollView | null>(null);
  // y coordinate per docId, captured via onLayout. We need the layout
  // measurement, not the index, because rows have variable height
  // (expanded vs collapsed, with/without summary).
  const rowYByDocId = useRef<Record<string, number>>({});

  const scrollToFirstPending = useCallback(() => {
    const firstPending = visibleDocs.find((d) => pendingByDocId.has(d.id));
    if (!firstPending) return;
    const y = rowYByDocId.current[firstPending.id];
    if (y == null) return;
    // Offset a bit so the row isn't flush with the search bar.
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, [visibleDocs, pendingByDocId]);

  // ── Version-history modal state ───────────────────────────────────
  const [historyDocType, setHistoryDocType] =
    useState<LegalDocumentType | null>(null);

  // ── Render ────────────────────────────────────────────────────────

  if (loading && documents.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loaderText}>{t("legal_documents.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("legal_documents.header")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("legal_documents.search_placeholder")}
          placeholderTextColor={COLORS.muted}
          value={searchInput}
          onChangeText={setSearchInput}
          accessibilityLabel={t("legal_documents.search_placeholder")}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchInput.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchInput("")}
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={COLORS.teal}
          />
        }
      >
        {hasPending && (
          <TouchableOpacity
            style={styles.actionBanner}
            onPress={scrollToFirstPending}
            accessibilityRole="button"
            accessibilityLabel={t("legal_documents.banner_pending", {
              count: pendingCount,
            })}
          >
            <Ionicons name="alert-circle" size={20} color={COLORS.orange} />
            <Text style={styles.actionBannerText}>
              {t("legal_documents.banner_pending", { count: pendingCount })}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.orange} />
          </TouchableOpacity>
        )}

        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={COLORS.muted}
            />
            <Text style={styles.emptyStateText}>
              {t("legal_documents.empty_body")}
            </Text>
          </View>
        ) : visibleDocs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color={COLORS.muted} />
            <Text style={styles.emptyStateText}>
              {t("legal_documents.no_search_match", { term: searchInput })}
            </Text>
          </View>
        ) : (
          visibleDocs.map((doc) =>
            renderDocCard({
              doc,
              t,
              language: i18n.language,
              pendingItem: pendingByDocId.get(doc.id),
              acceptance: acceptanceByType.get(doc.documentType) ?? null,
              expanded: expandedByDocId[doc.id] ?? !!pendingByDocId.get(doc.id),
              onToggleExpanded: () =>
                setExpandedByDocId((m) => ({
                  ...m,
                  [doc.id]: !(m[doc.id] ?? !!pendingByDocId.get(doc.id)),
                })),
              onReadFull: () =>
                navigation.navigate("LegalDocumentReader", {
                  documentType: doc.documentType,
                }),
              onShowHistory: () => setHistoryDocType(doc.documentType),
              onLayoutY: (y: number) => {
                rowYByDocId.current[doc.id] = y;
              },
              titleFor,
            }),
          )
        )}
      </ScrollView>

      <LegalVersionHistoryModal
        visible={historyDocType !== null}
        documentType={historyDocType}
        title={
          historyDocType
            ? t(TYPE_LABEL_KEY[historyDocType] ?? "legal_reader.header_default")
            : ""
        }
        onClose={() => setHistoryDocType(null)}
        onSelectVersion={(documentId) => {
          if (!historyDocType) return;
          const type = historyDocType;
          setHistoryDocType(null);
          navigation.navigate("LegalDocumentReader", {
            documentType: type,
            documentId,
            readOnly: true,
          });
        }}
      />
    </View>
  );
}

// Card render is split out so the parent body stays readable. Pure
// function of inputs — all callbacks come from the parent.
function renderDocCard(args: {
  doc: LegalDocument;
  t: (k: string, opts?: any) => string;
  language: string;
  pendingItem: ReturnType<
    typeof usePendingAcceptances
  >["pending"][number] | undefined;
  acceptance: MemberLegalAcceptance | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onReadFull: () => void;
  onShowHistory: () => void;
  onLayoutY: (y: number) => void;
  titleFor: (doc: LegalDocument) => string;
}) {
  const {
    doc,
    t,
    language,
    pendingItem,
    acceptance,
    expanded,
    onToggleExpanded,
    onReadFull,
    onShowHistory,
    onLayoutY,
    titleFor,
  } = args;
  const isPending = !!pendingItem;
  const requiresReconfirm = !!pendingItem?.requiresReconfirmation;
  const accepted = !isPending;

  // Pick the change-summary bullets in the member's language with EN
  // fallback (same precedence the engine uses elsewhere).
  const summaryBullets: string[] = (() => {
    if (!pendingItem) return [];
    const raw = doc.changeSummary || {};
    const inLang = raw[language];
    if (Array.isArray(inLang) && inLang.length > 0) return inLang as string[];
    const inEn = raw.en;
    if (Array.isArray(inEn) && inEn.length > 0) return inEn as string[];
    return [];
  })();

  return (
    <View
      key={doc.id}
      style={[styles.docCard, isPending && styles.docCardPending]}
      onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}
    >
      <View style={styles.docRow}>
        <View
          style={[
            styles.docIcon,
            {
              backgroundColor: accepted
                ? `${COLORS.green}20`
                : `${COLORS.orange}20`,
            },
          ]}
        >
          <Ionicons
            name={accepted ? "document-text-outline" : "alert-circle"}
            size={20}
            color={accepted ? COLORS.green : COLORS.orange}
          />
        </View>

        <View style={styles.docInfo}>
          <Text style={styles.docTitle}>{titleFor(doc)}</Text>
          <Text style={styles.docMeta}>
            {t("legal_documents.row_version_meta", {
              version: doc.version,
              date: doc.effectiveDate ?? "",
            })}
          </Text>
        </View>

        {accepted ? (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={COLORS.green}
          />
        ) : (
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>
              {t("legal_documents.review_badge")}
            </Text>
          </View>
        )}
      </View>

      {accepted && acceptance ? (
        <View style={styles.acceptedLine}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
          <Text style={styles.acceptedLineText}>
            {t("legal_documents.accepted_on", {
              date: formatYmd(acceptance.acceptedAt),
              version: acceptance.version,
            })}
          </Text>
        </View>
      ) : null}

      {requiresReconfirm ? (
        <TouchableOpacity
          style={styles.whatsNewPill}
          onPress={onToggleExpanded}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles-outline" size={14} color={COLORS.amber} />
          <Text style={styles.whatsNewPillText}>
            {t("legal_documents.whats_new")}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={COLORS.amber}
          />
        </TouchableOpacity>
      ) : null}

      {isPending && expanded && summaryBullets.length > 0 ? (
        <View style={styles.changesBox}>
          <Text style={styles.changesTitle}>
            {t("legal_documents.whats_new_summary_title")}
          </Text>
          {summaryBullets.map((bullet, i) => (
            <View key={i} style={styles.changeRow}>
              <View style={styles.changeDot} />
              <Text style={styles.changeText}>{bullet}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {isPending && expanded && pendingItem?.content?.summaryText ? (
        <Text style={styles.docSummary} numberOfLines={4}>
          {pendingItem.content.summaryText}
        </Text>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.readButton}
          onPress={onReadFull}
          accessibilityRole="button"
        >
          <Ionicons name="open-outline" size={16} color={COLORS.navy} />
          <Text style={styles.readButtonText}>
            {t("legal_documents.btn_read_full")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.historyLink}
          onPress={onShowHistory}
          accessibilityRole="button"
        >
          <Ionicons name="time-outline" size={14} color={COLORS.muted} />
          <Text style={styles.historyLinkText}>
            {t("legal_documents.view_previous_versions")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
    width: 34,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.white,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.navy,
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  actionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: `${COLORS.orange}15`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  actionBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.orange,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  docCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  docCardPending: {
    borderWidth: 1,
    borderColor: `${COLORS.orange}40`,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
  docMeta: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  reviewBadge: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reviewBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.white,
  },
  acceptedLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  acceptedLineText: {
    fontSize: 12,
    color: COLORS.green,
    fontWeight: "500",
  },
  whatsNewPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: COLORS.amberBg,
  },
  whatsNewPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.amber,
    letterSpacing: 0.3,
  },
  changesBox: {
    backgroundColor: `${COLORS.orange}08`,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  changesTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.orange,
    marginBottom: 8,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  changeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    marginTop: 7,
  },
  changeText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 17,
  },
  docSummary: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 19,
  },
  actionsRow: {
    marginTop: 12,
    gap: 8,
  },
  readButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    paddingVertical: 12,
  },
  readButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  historyLinkText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
