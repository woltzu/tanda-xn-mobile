import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  useActiveDocuments,
  usePendingAcceptances,
  useLegalDocumentActions,
  type LegalDocument,
} from "../hooks/useLegalDocuments";
import { useAuth } from "../context/AuthContext";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  orange: "#F97316",
  red: "#EF4444",
  bg: "#F5F7FA",
  muted: "#6B7280",
  border: "#E5E7EB",
  white: "#FFFFFF",
};

const DATA_RIGHTS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
}[] = [
  { icon: "download-outline", label: "Download My Data", desc: "Get a copy of all your data" },
  { icon: "trash-outline", label: "Delete My Data", desc: "Request account & data deletion" },
  { icon: "eye-off-outline", label: "Opt Out of AI", desc: "Disable mood & stress analysis" },
  { icon: "hand-left-outline", label: "Withdraw Consent", desc: "Revoke specific data consents" },
];

export default function LegalDocumentsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const {
    documents, loading: docsLoading, refetch: refetchDocs,
  } = useActiveDocuments();

  const {
    pending, pendingCount, hasPending, loading: pendingLoading, refetch: refetchPending,
  } = usePendingAcceptances(user?.id);

  const {
    acceptDocument, accepting, error: actionError,
  } = useLegalDocumentActions();

  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const loading = docsLoading || pendingLoading;

  const onRefresh = useCallback(() => {
    refetchDocs();
    refetchPending();
  }, [refetchDocs, refetchPending]);

  // Check if a document needs re-acceptance
  const needsReaccept = (doc: LegalDocument) => {
    return pending.some((p) => p.documentId === doc.id);
  };

  const isAccepted = (doc: LegalDocument) => {
    return !needsReaccept(doc);
  };

  const handleAccept = async (docId: string) => {
    if (!user?.id) return;
    const result = await acceptDocument(user.id, docId);
    if (result) {
      Alert.alert("Accepted", "You have accepted the updated terms.");
      refetchPending();
    }
  };

  if (loading && documents.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loaderText}>Loading documents...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal & Policies</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.teal} />
        }
      >
        {/* Action Required Banner */}
        {hasPending && (
          <View style={styles.actionBanner}>
            <Ionicons name="alert-circle" size={20} color={COLORS.orange} />
            <Text style={styles.actionBannerText}>
              {pendingCount} document{pendingCount > 1 ? "s" : ""} need
              {pendingCount === 1 ? "s" : ""} your review
            </Text>
          </View>
        )}

        {/* Documents List */}
        {documents.map((doc) => {
          const isExpanded = expandedDoc === doc.id;
          const accepted = isAccepted(doc);
          const pendingItem = pending.find((p) => p.documentId === doc.id);

          return (
            <TouchableOpacity
              key={doc.id}
              style={[styles.docCard, !accepted && styles.docCardPending]}
              onPress={() => setExpandedDoc(isExpanded ? null : doc.id)}
              activeOpacity={0.7}
            >
              <View style={styles.docRow}>
                <View
                  style={[
                    styles.docIcon,
                    { backgroundColor: accepted ? `${COLORS.green}20` : `${COLORS.orange}20` },
                  ]}
                >
                  {accepted ? (
                    <Ionicons name="document-text-outline" size={20} color={COLORS.green} />
                  ) : (
                    <Ionicons name="alert-circle" size={20} color={COLORS.orange} />
                  )}
                </View>

                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docMeta}>
                    v{doc.version} - Updated {doc.effectiveDate ?? ""}
                  </Text>
                </View>

                {accepted ? (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
                ) : (
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>Review</Text>
                  </View>
                )}

                <Ionicons
                  name={isExpanded ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={COLORS.muted}
                  style={{ marginLeft: 6 }}
                />
              </View>

              {isExpanded && (
                <View style={styles.docExpanded}>
                  <Text style={styles.docSummary}>
                    {doc.description ?? "No description available."}
                  </Text>

                  {pendingItem?.changeSummary && pendingItem.changeSummary.length > 0 && (
                    <View style={styles.changesBox}>
                      <Text style={styles.changesTitle}>What Changed:</Text>
                      {pendingItem.changeSummary.map((change, i) => (
                        <View key={i} style={styles.changeRow}>
                          <View style={styles.changeDot} />
                          <Text style={styles.changeText}>{change.description}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity style={styles.readButton}>
                    <Ionicons name="open-outline" size={16} color={COLORS.navy} />
                    <Text style={styles.readButtonText}>Read Full Document</Text>
                  </TouchableOpacity>

                  {!accepted && (
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAccept(doc.id)}
                      disabled={accepting}
                    >
                      {accepting ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.acceptButtonText}>Accept Updated Terms</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Data Rights */}
        <View style={styles.card}>
          <Text style={styles.rightsTitle}>Your Data Rights</Text>
          {DATA_RIGHTS.map((right, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.rightRow, i < DATA_RIGHTS.length - 1 && styles.rightRowBorder]}
            >
              <Ionicons name={right.icon} size={20} color={COLORS.teal} />
              <View style={styles.rightInfo}>
                <Text style={styles.rightLabel}>{right.label}</Text>
                <Text style={styles.rightDesc}>{right.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.orange,
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
  docExpanded: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  docSummary: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 12,
  },
  changesBox: {
    backgroundColor: `${COLORS.orange}08`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  changesTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.orange,
    marginBottom: 8,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  changeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
  },
  changeText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  readButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 8,
  },
  readButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
  },
  acceptButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  rightsTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.navy,
    padding: 16,
    paddingBottom: 8,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  rightRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rightInfo: {
    flex: 1,
  },
  rightLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
  rightDesc: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
});
