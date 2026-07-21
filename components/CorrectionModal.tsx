// ═══════════════════════════════════════════════════════════════════════════
// components/CorrectionModal.tsx — Doc 38 admin correction flow
// ═══════════════════════════════════════════════════════════════════════════
//
// Admin-only modal. Presents an event picker (from list_circle_ledger_events),
// reason-code dropdown, justification textarea (min 20 chars), and signed
// amount input (in dollars → converted to cents). Calls apply_correction
// on Confirm.
//
// If the circle has zero ledger_events, the picker shows an empty state
// and Confirm is disabled — corrections require an original event to
// link to (Doc 38 §2.2). Test circles without Stripe events are stuck
// there until the ledger evolves to log per-circle events (out of scope
// for this migration).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/tokens";
import {
  applyCorrection,
  listCircleLedgerEvents,
  type CorrectionReasonCode,
  type LedgerEvent,
} from "../hooks/useCorrectionAndClose";

const REASON_CODES: { value: CorrectionReasonCode; label: string }[] = [
  { value: "webhook_duplicate", label: "Webhook duplicate" },
  { value: "stripe_refund", label: "Stripe refund" },
  { value: "bug_reconciliation", label: "Bug reconciliation" },
  { value: "member_dispute_resolved", label: "Member dispute resolved" },
  { value: "other_documented", label: "Other (documented)" },
];

interface Props {
  visible: boolean;
  circleId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CorrectionModal({ visible, circleId, onClose, onSuccess }: Props) {
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<CorrectionReasonCode>("bug_reconciliation");
  const [justification, setJustification] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedEventId(null);
    setReasonCode("bug_reconciliation");
    setJustification("");
    setAmountDollars("");
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    resetForm();
    setLoadingEvents(true);
    setEventsError(null);
    listCircleLedgerEvents(circleId)
      .then((rows) => setEvents(rows))
      .catch((err) => setEventsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingEvents(false));
  }, [visible, circleId, resetForm]);

  const justificationLen = justification.trim().length;
  const amountCents = (() => {
    const n = Number(amountDollars);
    if (!isFinite(n)) return NaN;
    return Math.round(n * 100);
  })();
  const amountValid = isFinite(amountCents) && amountCents !== 0;

  const canConfirm =
    !!selectedEventId &&
    justificationLen >= 20 &&
    amountValid &&
    !submitting;

  const handleConfirm = async () => {
    if (!canConfirm || !selectedEventId) return;
    Alert.alert(
      "Apply correction?",
      `Delta: ${amountCents > 0 ? "+" : ""}$${(amountCents / 100).toFixed(2)}\nReason: ${reasonCode}\n\nThis writes a compensating ledger event. The original is not modified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            setSubmitError(null);
            try {
              await applyCorrection({
                originalEventId: selectedEventId,
                reasonCode,
                justification: justification.trim(),
                amountCentsDelta: amountCents,
              });
              onSuccess();
              onClose();
            } catch (err) {
              setSubmitError(err instanceof Error ? err.message : String(err));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Apply correction</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={styles.sectionTitle}>Event to correct</Text>
            {loadingEvents ? (
              <ActivityIndicator size="small" color={colors.accentTeal} style={{ marginVertical: 12 }} />
            ) : eventsError ? (
              <Text style={styles.errorText}>{eventsError}</Text>
            ) : events.length === 0 ? (
              <Text style={styles.emptyText}>
                No ledger events for this circle. Corrections require a linked original event (Doc 38 §2.2).
              </Text>
            ) : (
              events.map((ev) => (
                <TouchableOpacity
                  key={ev.id}
                  style={[
                    styles.eventRow,
                    selectedEventId === ev.id && styles.eventRowSelected,
                    ev.is_correction && styles.eventRowMuted,
                  ]}
                  onPress={() => setSelectedEventId(ev.id)}
                  disabled={ev.is_correction}
                >
                  <Text style={styles.eventType}>
                    {ev.event_type}
                    {ev.is_correction ? " (already a correction)" : ""}
                  </Text>
                  <Text style={styles.eventMeta}>
                    ${(ev.amount_cents / 100).toFixed(2)} · {new Date(ev.created_at).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.sectionTitle}>Reason</Text>
            <View style={styles.chipRow}>
              {REASON_CODES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.chip, reasonCode === r.value && styles.chipActive]}
                  onPress={() => setReasonCode(r.value)}
                >
                  <Text
                    style={[styles.chipText, reasonCode === r.value && styles.chipTextActive]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>
              Justification ({justificationLen}/20 min)
            </Text>
            <TextInput
              style={styles.textArea}
              value={justification}
              onChangeText={setJustification}
              placeholder="Describe why this correction is needed (min 20 chars)…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <Text style={styles.sectionTitle}>Amount ($, signed)</Text>
            <TextInput
              style={styles.input}
              value={amountDollars}
              onChangeText={setAmountDollars}
              placeholder="e.g. 225.00 or -50.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
            />
            {isFinite(amountCents) && amountCents !== 0 ? (
              <Text style={styles.hint}>
                Will write {amountCents > 0 ? "+" : ""}${(amountCents / 100).toFixed(2)} as a compensating entry.
              </Text>
            ) : null}

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
              style={[styles.btnPrimary, !canConfirm && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Apply correction</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    maxHeight: "90%",
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
  eventRow: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    backgroundColor: colors.screenBg,
  },
  eventRowSelected: {
    borderColor: colors.accentTeal,
    borderWidth: 2,
    backgroundColor: colors.tealTintBg,
  },
  eventRowMuted: { opacity: 0.5 },
  eventType: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  eventMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  chipActive: { backgroundColor: colors.primaryNavy, borderColor: colors.primaryNavy },
  chipText: { fontSize: 12, color: colors.textPrimary },
  chipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
    textAlignVertical: "top",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
  },
  hint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    padding: 10,
    fontStyle: "italic",
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
    backgroundColor: colors.errorText,
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700" },
});
