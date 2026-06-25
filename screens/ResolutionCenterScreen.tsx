// ═══════════════════════════════════════════════════════════════════════════
// screens/ResolutionCenterScreen.tsx — Phase 2 Bucket B
// ═══════════════════════════════════════════════════════════════════════════
//
// The destination of CriticalBanner taps. Three states render in order:
//   1. Loading skeleton while get_demotion_details fires
//   2. "Cleared" success card if tier != 'critical' AND reviewed_at is
//      recent (last 7 days) — gives the just-cleared member feedback
//   3. Full detail view: reason + path-back + status indicator + (if
//      no pending request) a Request Review CTA
//
// Critical-tier members who have already submitted a request see the
// pending status. Resolved/rejected members see the elder comment if
// present and an option to submit a follow-up (only after rejection).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useResolutionStatus } from "../hooks/useResolutionStatus";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const RED = "#DC2626";
const GREEN = "#047857";
const AMBER = "#B45309";
const MUTED = "#6B7280";

const ResolutionCenterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { details, isCritical, isLoading, refresh } = useResolutionStatus(user?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Re-fetch when the screen regains focus (covers the case where a
  // member submits a request, navigates away, then back).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const submitRequest = async () => {
    try {
      setSubmitting(true);
      const { error: e } = await supabase.rpc("request_resolution_review", {
        p_comment: comment.trim() || null,
      });
      if (e) throw new Error(e.message);
      setModalOpen(false);
      setComment("");
      await refresh();
    } catch (err: any) {
      Alert.alert(
        t("resolution_center.request_failed_title"),
        err?.message ?? t("resolution_center.request_failed_body"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t("resolution_center.title")}</Text>
      <View style={styles.headerBtn} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  // Cleared state — recently restored (reviewed_at within last 7 days
  // and not critical). Show success card + return-home CTA.
  const reviewedRecently =
    !!details?.reviewed_at &&
    Date.now() - new Date(details.reviewed_at).getTime() <
      7 * 24 * 60 * 60 * 1000;
  if (!isCritical && reviewedRecently) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.statusCard, { borderColor: GREEN }]}>
            <Ionicons name="checkmark-circle" size={48} color={GREEN} />
            <Text style={styles.statusTitle}>
              {t("resolution_center.resolved_title")}
            </Text>
            <Text style={styles.statusBody}>
              {t("resolution_center.resolved_status")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.primaryBtnText}>
              {t("resolution_center.return_home")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No restriction + no recent review — should not normally land here.
  if (!isCritical) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <Ionicons name="shield-checkmark-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            {t("resolution_center.no_restriction")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Critical state — show reason + path back + request CTA / status.
  const pendingRequest = details?.has_pending_review;
  const latest = details?.latest_request;
  const lastWasRejected = latest?.status === "rejected" && !pendingRequest;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Reason card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="alert-circle" size={20} color={RED} />
            <Text style={styles.cardLabel}>
              {t("resolution_center.reason_label")}
            </Text>
          </View>
          <Text style={styles.cardBody}>
            {details?.demotion_reason || t("resolution_center.reason_unknown")}
          </Text>
        </View>

        {/* Path back card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="trending-up" size={20} color={GREEN} />
            <Text style={styles.cardLabel}>
              {t("resolution_center.path_back_label")}
            </Text>
          </View>
          <Text style={styles.cardBody}>
            {details?.demotion_path_back ||
              t("resolution_center.path_back_unknown")}
          </Text>
        </View>

        {/* Status / CTA block */}
        {pendingRequest ? (
          <View style={[styles.statusCard, { borderColor: AMBER }]}>
            <Ionicons name="time-outline" size={36} color={AMBER} />
            <Text style={styles.statusTitle}>
              {t("resolution_center.pending_title")}
            </Text>
            <Text style={styles.statusBody}>
              {t("resolution_center.pending_status")}
            </Text>
          </View>
        ) : lastWasRejected ? (
          <>
            <View style={[styles.statusCard, { borderColor: RED }]}>
              <Ionicons name="close-circle" size={36} color={RED} />
              <Text style={styles.statusTitle}>
                {t("resolution_center.rejected_title")}
              </Text>
              <Text style={styles.statusBody}>
                {t("resolution_center.rejected_status")}
              </Text>
              {latest?.elder_comment ? (
                <Text style={styles.elderComment}>
                  &ldquo;{latest.elder_comment}&rdquo;
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setModalOpen(true)}
            >
              <Text style={styles.primaryBtnText}>
                {t("resolution_center.request_review_button")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setModalOpen(true)}
          >
            <Text style={styles.primaryBtnText}>
              {t("resolution_center.request_review_button")}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Request review modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t("resolution_center.request_review_modal_title")}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t("resolution_center.request_review_comment_placeholder")}
              placeholderTextColor={MUTED}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setModalOpen(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalBtnText, { color: NAVY }]}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={submitRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                    {t("resolution_center.request_review_submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ResolutionCenterScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: 10 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: typography.sectionHeader, fontWeight: typography.bold, color: NAVY },

  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardLabel: { fontSize: typography.label, fontWeight: typography.bold, color: NAVY, textTransform: "uppercase", letterSpacing: 0.3 },
  cardBody: { fontSize: typography.body, color: NAVY, lineHeight: 20 },

  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    borderWidth: 2,
    padding: spacing.lg,
    alignItems: "center",
    gap: 8,
    marginTop: spacing.sm,
  },
  statusTitle: { fontSize: typography.bodyLarge, fontWeight: typography.bold, color: NAVY, textAlign: "center" },
  statusBody: { fontSize: typography.body, color: NAVY, textAlign: "center", lineHeight: 20 },
  elderComment: { fontSize: typography.bodySmall, color: MUTED, fontStyle: "italic", marginTop: 8, textAlign: "center" },

  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },

  emptyText: { fontSize: typography.body, color: MUTED, textAlign: "center", marginTop: 8 },

  modalScrim: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: "100%", maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { fontSize: typography.sectionHeader, fontWeight: typography.bold, color: NAVY },
  modalInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.small,
    paddingHorizontal: 12, paddingVertical: 10,
    color: NAVY, fontSize: typography.body,
    minHeight: 100, textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  modalBtn: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.pill, minWidth: 90, alignItems: "center", justifyContent: "center",
  },
  modalBtnGhost: { backgroundColor: "#F3F4F6" },
  modalBtnPrimary: { backgroundColor: TEAL },
  modalBtnText: { fontSize: typography.body, fontWeight: typography.bold },
});
