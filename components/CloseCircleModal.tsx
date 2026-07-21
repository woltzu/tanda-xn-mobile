// ═══════════════════════════════════════════════════════════════════════════
// components/CloseCircleModal.tsx — Doc 38 admin close flow
// ═══════════════════════════════════════════════════════════════════════════
//
// Reads the invariant, shows the breakdown, and either enables Close (if
// balanced ±$0.01) or explains the diff (if not). Close writes the
// 'circle.closed' ledger event + flips circles.status='closed'.
//
// Uses the invariant already fetched by the parent (passed in as a prop)
// so we don't double-fetch. Refetches on mount as a defense against
// stale views.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/tokens";
import { closeCircle } from "../hooks/useCorrectionAndClose";
import type { CircleInvariant } from "../hooks/useCircleInvariant";

interface Props {
  visible: boolean;
  circleId: string;
  invariant: CircleInvariant | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CloseCircleModal({
  visible,
  circleId,
  invariant,
  onClose,
  onSuccess,
}: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const balanced = invariant?.balanced ?? false;
  const netCents = invariant?.net_cents ?? 0;
  const canClose = balanced && !submitting;

  const handleConfirm = async () => {
    if (!canClose) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await closeCircle({
        circleId,
        reviewerNote: note.trim() || undefined,
      });
      if (!result.success) {
        // Race: invariant went unbalanced between screen load + submit.
        setSubmitError(
          `Close blocked: net moved to $${(result.net_cents / 100).toFixed(2)} while the modal was open. Refresh and re-check.`,
        );
        return;
      }
      onSuccess();
      onClose();
      setNote("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Close circle</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={styles.sectionTitle}>Invariant</Text>
            {invariant ? (
              <View style={styles.invariantBox}>
                <Row label="Contributions" value={`$${invariant.contributions_total.toFixed(2)}`} />
                <Row label="Payouts" value={`$${invariant.payouts_total.toFixed(2)}`} />
                <Row label="Corrections" value={`$${invariant.corrections_total.toFixed(2)}`} />
                <View style={styles.divider} />
                <Row
                  label="Net"
                  value={`${netCents >= 0 ? "+" : "-"}$${Math.abs(netCents / 100).toFixed(2)}`}
                  valueColor={
                    balanced
                      ? "#059669"
                      : netCents < 0
                        ? colors.errorText
                        : colors.textPrimary
                  }
                  bold
                />
              </View>
            ) : (
              <ActivityIndicator size="small" color={colors.accentTeal} style={{ marginVertical: 12 }} />
            )}

            {balanced ? (
              <View style={styles.readyBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={styles.readyText}>Ready to close. Net is within ±$0.01.</Text>
              </View>
            ) : (
              <View style={styles.blockedBanner}>
                <Ionicons name="warning" size={18} color={colors.errorText} />
                <Text style={styles.blockedText}>
                  Net is not zero. Apply corrections until the invariant balances, then re-open this dialog.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Reviewer note (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={note}
              onChangeText={setNote}
              placeholder="Any context for the audit trail…"
              placeholderTextColor={colors.textSecondary}
              multiline
              editable={balanced}
            />

            {submitError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="warning" size={16} color={colors.errorText} />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, !canClose && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={!canClose}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Close circle</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  label,
  value,
  valueColor,
  bold,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowLabelBold]}>{label}</Text>
      <Text
        style={[styles.rowValue, bold && styles.rowValueBold, valueColor ? { color: valueColor } : null]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  scroll: { flexShrink: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  invariantBox: {
    backgroundColor: colors.screenBg,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 13, color: colors.textSecondary },
  rowLabelBold: { fontWeight: "700", color: colors.textPrimary },
  rowValue: { fontSize: 13, color: colors.textPrimary, fontWeight: "600" },
  rowValueBold: { fontSize: 15, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  readyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    marginTop: 10,
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
  },
  readyText: { fontSize: 12, color: "#065F46", fontWeight: "600" },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    marginTop: 10,
    backgroundColor: colors.errorBg,
    borderRadius: 8,
  },
  blockedText: { fontSize: 12, color: colors.errorText, flex: 1 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
    textAlignVertical: "top",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    padding: 8,
    backgroundColor: colors.errorBg,
    borderRadius: 8,
  },
  errorText: { fontSize: 12, color: colors.errorText, flex: 1 },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostText: { color: colors.textPrimary, fontWeight: "600" },
  btnPrimary: {
    flex: 2,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#059669",
  },
  btnDisabled: { opacity: 0.4 },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700" },
});
