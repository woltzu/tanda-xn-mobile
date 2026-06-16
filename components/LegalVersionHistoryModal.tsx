// LegalVersionHistoryModal — P1 of the Legal documents review.
//
// Bottom-sheet listing of every published version of a single legal
// document type, sourced from LegalDocumentEngine.getDocumentHistory.
// Tapping a row hands the documentId back to the parent screen, which
// navigates to the reader in read-only mode (no Accept button on past
// versions — only the currently-active doc is acceptable).
//
// Closed by default; mounts only when visible flips true via the
// parent's modal-state machine. The hook auto-fetches on documentType
// change, so opening for "terms_of_service" then "privacy_policy"
// refreshes correctly.
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useDocumentHistory,
  type LegalDocument,
  type LegalDocumentType,
} from "../hooks/useLegalDocuments";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F5F7FA",
  white: "#FFFFFF",
  amber: "#D97706",
};

const STATUS_COLOR: Record<string, string> = {
  active: COLORS.green,
  archived: COLORS.muted,
  draft: COLORS.amber,
  review: COLORS.teal,
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

type Props = {
  visible: boolean;
  documentType: LegalDocumentType | null;
  title: string;
  onClose: () => void;
  onSelectVersion: (documentId: string) => void;
};

export default function LegalVersionHistoryModal({
  visible,
  documentType,
  title,
  onClose,
  onSelectVersion,
}: Props) {
  const { t } = useTranslation();
  const { history, loading } = useDocumentHistory(
    visible ? documentType ?? undefined : undefined,
  );

  // Hide draft/review rows by default — the legal team's in-flight
  // edits shouldn't leak to members through this modal.
  const visibleHistory = useMemo(
    () => history.filter((d) => d.status === "active" || d.status === "archived"),
    [history],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t("version_history.header", { title })}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Ionicons name="close" size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color={COLORS.teal} />
            </View>
          ) : visibleHistory.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                {t("version_history.empty_body")}
              </Text>
            </View>
          ) : (
            <FlatList
              data={visibleHistory}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <HistoryRow
                  doc={item}
                  onSelect={() => onSelectVersion(item.id)}
                  t={t}
                />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function HistoryRow({
  doc,
  onSelect,
  t,
}: {
  doc: LegalDocument;
  onSelect: () => void;
  t: (k: string, opts?: any) => string;
}) {
  const statusColor = STATUS_COLOR[doc.status] ?? COLORS.muted;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onSelect}
      accessibilityRole="button"
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowVersion}>
          {t("version_history.row_version_label", { version: doc.version })}
        </Text>
        <Text style={styles.rowDate}>{formatYmd(doc.effectiveDate)}</Text>
      </View>
      <View
        style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}
      >
        <Text style={[styles.statusPillText, { color: statusColor }]}>
          {t(`version_history.status_${doc.status}`)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.navy,
    paddingRight: 12,
  },
  loaderRow: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyRow: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowMain: {
    flex: 1,
  },
  rowVersion: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
  rowDate: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
