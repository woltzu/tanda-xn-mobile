// LegalDocumentReaderScreen — P1 of the Legal documents review.
//
// Reads either:
//   1. the currently active document of a given type (default, the
//      P0 behaviour), OR
//   2. a specific historical document by id when route.params.documentId
//      is supplied. Used by LegalVersionHistoryModal so members can
//      read what they signed last year. Past-version views are
//      always read-only — only the active doc is acceptable, and the
//      Accept button gets suppressed via route.params.readOnly.
//
// P1 additions:
//   - "Last updated" chip pinned above the full text.
//   - Share button in the header. RN Share API; payload is the title
//     + version + effectiveDate + a public URL stub so the recipient
//     has a place to read the full doc themselves.
//   - Optional table of contents. We parse the markdown headings
//     (^#{1,3} (.+)$) from fullText, render them as taps inside a
//     collapsible card, and capture each heading's Y via onLayout so
//     tap-to-scroll lands accurately even when the summary card or
//     ToC are open above. If the doc has no headings we skip the ToC
//     entirely — a 30-section terms doc gets a real ToC, a one-page
//     consent form doesn't see the noise.
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
  Alert,
  Platform,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import {
  useLegalDocument,
  useDocumentAcceptance,
  useLegalDocumentActions,
  type LegalDocument,
  type LegalDocumentContent,
  type LegalDocumentType,
  type SupportedLanguage,
} from "../hooks/useLegalDocuments";
import {
  LegalDocumentEngine,
} from "../services/LegalDocumentEngine";
import { useAuth } from "../context/AuthContext";

type NavProp = StackNavigationProp<RootStackParamList, "LegalDocumentReader">;
type RouteParams = RouteProp<RootStackParamList, "LegalDocumentReader">;

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  bg: "#F5F7FA",
  muted: "#6B7280",
  border: "#E5E7EB",
  white: "#FFFFFF",
  summaryBg: "#F0FDFB",
  summaryBorder: "#A7F3D0",
  tocBg: "#EFF6FF",
  tocBorder: "#BFDBFE",
  tocText: "#1E40AF",
  chipBg: "#F3F4F6",
  chipText: "#374151",
};

const TYPE_LABEL_KEY: Record<LegalDocumentType, string> = {
  terms_of_service: "legal_documents.doc_type_terms_of_service",
  privacy_policy: "legal_documents.doc_type_privacy_policy",
  circle_participation: "legal_documents.doc_type_circle_participation",
  liquidity_advance: "legal_documents.doc_type_liquidity_advance",
  kyc_consent: "legal_documents.doc_type_kyc_consent",
  payout_authorization: "legal_documents.doc_type_payout_authorization",
};

function formatYmd(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Block type returned by the simple markdown parser.
type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string; id: string }
  | { kind: "p"; text: string };

// Parse a markdown-ish string into a flat list of blocks. Headings up
// to depth 3 only — the legal docs we're dealing with don't go deeper.
// Returns block list AND a heading list for the ToC. Heading ids are
// stable string indexes so the ToC tap can look up the captured Y.
function parseMarkdown(text: string): { blocks: Block[]; headings: { id: string; text: string; level: 1 | 2 | 3 }[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  const headings: { id: string; text: string; level: 1 | 2 | 3 }[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    const joined = buffer.join(" ").trim();
    if (joined) blocks.push({ kind: "p", text: joined });
    buffer = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length as 1 | 2 | 3;
      const id = `h-${headings.length}`;
      const t = m[2].trim();
      blocks.push({ kind: "h", level, text: t, id });
      headings.push({ id, text: t, level });
    } else if (line.trim() === "") {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return { blocks, headings };
}

// Direct fetch for a specific historical document by id — used when
// the version-history modal hands us a documentId. Mirrors what
// useLegalDocument does for the active-type path but skips the
// type-based lookup. Returns { document, content } in one go.
async function fetchSpecificDocument(
  documentId: string,
  language: SupportedLanguage,
): Promise<{ document: LegalDocument | null; content: LegalDocumentContent | null }> {
  const { supabase } = await import("../lib/supabase");
  const { data, error } = await supabase
    .from("legal_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { document: null, content: null };
  const document: LegalDocument = {
    id: data.id,
    documentType: data.document_type,
    version: data.version,
    status: data.status,
    effectiveDate: data.effective_date,
    requiresReconfirmation: data.requires_reconfirmation,
    changeSummary: data.change_summary || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
  const content = await LegalDocumentEngine.getContentWithFallback(
    document.id,
    language,
  );
  return { document, content };
}

export default function LegalDocumentReaderScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const documentType = route.params?.documentType as LegalDocumentType;
  const overrideDocumentId = route.params?.documentId;
  const forceReadOnly = !!route.params?.readOnly;
  const language = i18n.language as SupportedLanguage;

  // Active-type path. Skip the hook entirely when an override id is
  // present — we don't want the type-based fetch racing the direct one.
  const {
    document: activeDoc,
    content: activeContent,
    loading: activeLoading,
    error: activeError,
  } = useLegalDocument(
    overrideDocumentId ? undefined : documentType,
    language,
  );

  // Direct-fetch path for the overrideDocumentId case.
  const [overrideDoc, setOverrideDoc] = useState<LegalDocument | null>(null);
  const [overrideContent, setOverrideContent] =
    useState<LegalDocumentContent | null>(null);
  const [overrideLoading, setOverrideLoading] = useState<boolean>(
    !!overrideDocumentId,
  );
  const [overrideError, setOverrideError] = useState<string | null>(null);
  useEffect(() => {
    if (!overrideDocumentId) return;
    let cancelled = false;
    setOverrideLoading(true);
    fetchSpecificDocument(overrideDocumentId, language)
      .then((res) => {
        if (cancelled) return;
        setOverrideDoc(res.document);
        setOverrideContent(res.content);
      })
      .catch((e) => {
        if (cancelled) return;
        setOverrideError((e as Error)?.message ?? "Failed to load document");
      })
      .finally(() => {
        if (!cancelled) setOverrideLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [overrideDocumentId, language]);

  const document = overrideDocumentId ? overrideDoc : activeDoc;
  const content = overrideDocumentId ? overrideContent : activeContent;
  const docLoading = overrideDocumentId ? overrideLoading : activeLoading;
  const docError = overrideDocumentId ? overrideError : activeError;

  const {
    hasAcceptedLatest,
    loading: acceptanceLoading,
  } = useDocumentAcceptance(
    forceReadOnly ? undefined : user?.id,
    forceReadOnly ? undefined : documentType,
  );

  const { acceptDocument, accepting } = useLegalDocumentActions();

  const handleAccept = async () => {
    if (!user?.id || !document?.id) return;
    const result = await acceptDocument(user.id, document.id, {
      languageViewed: language,
      deviceInfo: `${Platform.OS} ${Platform.Version}`,
    });
    if (result) {
      Alert.alert(
        t("legal_documents.alert_accepted_title"),
        t("legal_documents.alert_accepted_body"),
        [{ text: t("common.ok"), onPress: () => navigation.goBack() }],
      );
    } else {
      Alert.alert(
        t("legal_reader.err_accept_title"),
        t("legal_reader.err_accept_body"),
      );
    }
  };

  const titleText = documentType
    ? t(TYPE_LABEL_KEY[documentType] ?? "legal_reader.header_default")
    : t("legal_reader.header_default");

  const handleShare = useCallback(async () => {
    if (!document) return;
    try {
      const message = t("legal_reader.share_message", {
        title: titleText,
        version: document.version,
        date: formatYmd(document.effectiveDate),
        url: "https://tandaxn.com/legal",
      });
      await Share.share({
        title: titleText,
        message,
      });
    } catch (e) {
      // User dismissal or permission errors — not actionable.
      console.warn("[LegalReader] share failed", (e as Error)?.message);
    }
  }, [document, t, titleText]);

  // Past versions are ALWAYS read-only. The active version becomes
  // read-only too if the user already accepted the current revision.
  const showAccept =
    !forceReadOnly &&
    !!user?.id &&
    !!document?.id &&
    !acceptanceLoading &&
    !hasAcceptedLatest;

  const loading = docLoading;
  const hasContent = !!content?.fullText;

  // Parsed markdown: stable reference per fullText change. The parser
  // is intentionally cheap so this can re-run on every content swap
  // without memoisation gymnastics.
  const parsed = useMemo(
    () => (content?.fullText ? parseMarkdown(content.fullText) : null),
    [content?.fullText],
  );

  const [tocOpen, setTocOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const headingYByIdRef = useRef<Record<string, number>>({});

  const handleJumpToHeading = (id: string) => {
    const y = headingYByIdRef.current[id];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.navy, "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {titleText}
          </Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleShare}
            disabled={!document}
            accessibilityRole="button"
            accessibilityLabel={t("legal_reader.share_label")}
          >
            <Ionicons
              name="share-outline"
              size={22}
              color={document ? COLORS.white : "rgba(255,255,255,0.4)"}
            />
          </TouchableOpacity>
        </View>
        {document?.version != null && (
          <Text style={styles.headerMeta}>
            {t("legal_reader.version_meta", {
              version: document.version,
              date: formatYmd(document.effectiveDate),
            })}
            {forceReadOnly ? ` — ${t("legal_reader.read_only_chip")}` : ""}
          </Text>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.centeredFillText}>
            {t("legal_documents.loading")}
          </Text>
        </View>
      ) : !hasContent ? (
        <View style={styles.centeredFill}>
          <Ionicons
            name="document-text-outline"
            size={48}
            color={COLORS.muted}
          />
          <Text style={styles.centeredFillText}>
            {docError ?? t("legal_reader.empty_body")}
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          {content?.summaryText ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={COLORS.teal}
                />
                <Text style={styles.summaryLabel}>
                  {t("legal_reader.summary_label")}
                </Text>
              </View>
              <Text style={styles.summaryBody}>{content.summaryText}</Text>
            </View>
          ) : null}

          {parsed && parsed.headings.length > 0 ? (
            <View style={styles.tocCard}>
              <TouchableOpacity
                onPress={() => setTocOpen((v) => !v)}
                style={styles.tocHeader}
                accessibilityRole="button"
              >
                <Ionicons
                  name="list-outline"
                  size={16}
                  color={COLORS.tocText}
                />
                <Text style={styles.tocLabel}>
                  {t("legal_reader.toc_label", {
                    count: parsed.headings.length,
                  })}
                </Text>
                <Ionicons
                  name={tocOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={COLORS.tocText}
                />
              </TouchableOpacity>
              {tocOpen ? (
                <View style={styles.tocList}>
                  {parsed.headings.map((h) => (
                    <TouchableOpacity
                      key={h.id}
                      onPress={() => handleJumpToHeading(h.id)}
                      style={styles.tocRow}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.tocRowText,
                          h.level === 2 && styles.tocRowTextIndent1,
                          h.level === 3 && styles.tocRowTextIndent2,
                        ]}
                        numberOfLines={2}
                      >
                        {h.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.fullHeaderRow}>
            <Text style={styles.fullLabel}>
              {t("legal_reader.full_text_label")}
            </Text>
            {document?.updatedAt ? (
              <View style={styles.chip}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={COLORS.chipText}
                />
                <Text style={styles.chipText}>
                  {t("legal_reader.last_updated_chip", {
                    date: formatYmd(document.updatedAt),
                  })}
                </Text>
              </View>
            ) : null}
          </View>

          {parsed ? (
            parsed.blocks.map((block, idx) => {
              if (block.kind === "p") {
                return (
                  <Text key={idx} style={styles.fullBody} selectable>
                    {block.text}
                  </Text>
                );
              }
              const headingStyle =
                block.level === 1
                  ? styles.h1
                  : block.level === 2
                    ? styles.h2
                    : styles.h3;
              return (
                <View
                  key={idx}
                  onLayout={(e) => {
                    headingYByIdRef.current[block.id] =
                      e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={headingStyle} selectable>
                    {block.text}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.fullBody} selectable>
              {content!.fullText}
            </Text>
          )}

          {showAccept ? (
            <TouchableOpacity
              style={[styles.acceptBtn, accepting && styles.acceptBtnDisabled]}
              onPress={handleAccept}
              disabled={accepting}
              accessibilityRole="button"
            >
              {accepting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.acceptBtnText}>
                  {t("legal_reader.btn_accept")}
                </Text>
              )}
            </TouchableOpacity>
          ) : hasAcceptedLatest && !forceReadOnly ? (
            <View style={styles.acceptedRow}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={styles.acceptedRowText}>
                {t("legal_reader.already_accepted")}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.white,
    paddingHorizontal: 8,
  },
  headerMeta: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  centeredFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  centeredFillText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  summaryCard: {
    backgroundColor: COLORS.summaryBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.summaryBorder,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.teal,
    letterSpacing: 0.5,
  },
  summaryBody: {
    fontSize: 14,
    color: "#065F46",
    lineHeight: 21,
  },
  tocCard: {
    backgroundColor: COLORS.tocBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.tocBorder,
    marginBottom: 16,
    overflow: "hidden",
  },
  tocHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  tocLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.tocText,
    letterSpacing: 0.4,
  },
  tocList: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  tocRow: {
    paddingVertical: 6,
  },
  tocRowText: {
    fontSize: 13,
    color: COLORS.tocText,
  },
  tocRowTextIndent1: {
    paddingLeft: 12,
    fontSize: 12,
  },
  tocRowTextIndent2: {
    paddingLeft: 24,
    fontSize: 12,
    opacity: 0.85,
  },
  fullHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  fullLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    color: COLORS.chipText,
    fontWeight: "600",
  },
  fullBody: {
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 22,
    marginBottom: 12,
  },
  h1: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.navy,
    marginTop: 18,
    marginBottom: 10,
  },
  h2: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
    marginTop: 14,
    marginBottom: 8,
  },
  h3: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.navy,
    marginTop: 12,
    marginBottom: 6,
  },
  acceptBtn: {
    marginTop: 24,
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  acceptedRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  acceptedRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
  },
});
