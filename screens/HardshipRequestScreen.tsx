// ══════════════════════════════════════════════════════════════════════════════
// screens/HardshipRequestScreen.tsx — ADVANCE-017 hardship assistance form
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 119-ADVANCE-017-HardshipRequest.jsx.
//
// Form-based intake for users requesting hardship help with an
// active advance. Reached from AdvanceDetailsV2 or PaymentFailed.
//
// Form state:
//   - selectedOption: which type of accommodation (defer/reduce/extend)
//   - selectedReason: why hardship (job_loss/medical/family/disaster/other)
//   - additionalInfo: free-text textarea (optional)
//
// Submit is gated on both selectedOption AND selectedReason. Phase 3
// will replace the placeholder Alert with a real submission to a
// supabase table; for now we Alert success and goBack so the user
// returns to the advance they were viewing.
//
// Route params (all optional, defaults match canonical mock):
//   advanceId?: string
//   advance?: { id; amountDue; withholdingDate; daysUntil }
//
// Navigation:
//   - back → goBack
//   - "Submit Hardship Request" → Alert success → goBack
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";

type HardshipOptionId = "defer" | "reduce" | "extend";
type HardshipReasonId =
  | "job_loss"
  | "medical"
  | "family"
  | "disaster"
  | "other";

type HardshipOption = {
  id: HardshipOptionId;
  icon: string;
  title: string;
  description: string;
  detail: string;
};

type HardshipReason = {
  id: HardshipReasonId;
  icon: string;
  label: string;
};

type AdvanceSummary = {
  id: string;
  amountDue: number;
  withholdingDate: string;
  daysUntil: number;
};

type HardshipRequestParams = {
  advanceId?: string;
  advance?: AdvanceSummary;
};
type HardshipRequestRouteProp = RouteProp<
  { HardshipRequest: HardshipRequestParams },
  "HardshipRequest"
>;

const DEFAULT_ADVANCE: AdvanceSummary = {
  id: "ADV-2025-0120-001",
  amountDue: 315,
  withholdingDate: "Feb 15, 2025",
  daysUntil: 10,
};

const HARDSHIP_OPTIONS: HardshipOption[] = [
  {
    id: "defer",
    icon: "📅",
    title: "Defer Payment",
    description: "Push withholding to your next payout cycle",
    detail: "Extends by 1 payout cycle (typically 2-4 weeks)",
  },
  {
    id: "reduce",
    icon: "📉",
    title: "Reduced Payment",
    description: "Split across multiple payouts",
    detail: "Pay 50% now, 50% next payout",
  },
  {
    id: "extend",
    icon: "⏳",
    title: "Extend Term",
    description: "Smaller amounts over longer period",
    detail: "Spread repayment across 2-3 payouts",
  },
];

const HARDSHIP_REASONS: HardshipReason[] = [
  { id: "job_loss", icon: "💼", label: "Job loss or reduced income" },
  { id: "medical", icon: "🏥", label: "Medical emergency or illness" },
  { id: "family", icon: "👨‍👩‍👧", label: "Family emergency" },
  { id: "disaster", icon: "🌪️", label: "Natural disaster" },
  { id: "other", icon: "📝", label: "Other circumstances" },
];

const WHAT_NEXT = [
  { icon: "📨", text: "We'll review your request within 24 hours" },
  { icon: "🛡️", text: "Your XnScore won't be affected during review" },
  { icon: "📱", text: "We'll notify you of our decision via app & email" },
  { icon: "💬", text: "Our support team may reach out for more info" },
];

export default function HardshipRequestScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<HardshipRequestRouteProp>();
  const { t } = useTranslation();

  const advance = route.params?.advance ?? {
    ...DEFAULT_ADVANCE,
    id: route.params?.advanceId ?? DEFAULT_ADVANCE.id,
  };

  const [selectedOption, setSelectedOption] = useState<HardshipOptionId | null>(
    null,
  );
  const [selectedReason, setSelectedReason] = useState<HardshipReasonId | null>(
    null,
  );
  const [additionalInfo, setAdditionalInfo] = useState("");

  const canSubmit = !!selectedOption && !!selectedReason;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Phase 3: real submission to a hardship_requests supabase table.
    Alert.alert(
      "Request Submitted",
      "We received your hardship request and will review it within 24 hours. We'll notify you of our decision via app and email. Your XnScore is protected during the review.",
      [{ text: "OK", onPress: () => navigation.goBack() }],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <LinearGradient
            colors={[NAVY, "#143654"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{t("hardship_request.header_title")}</Text>
                <Text style={styles.headerSubtitle}>{t("hardship_request.header_subtitle")}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.contentWrap}>
            {/* Empathy message */}
            <View style={styles.empathyCard}>
              <Text style={styles.empathyEmoji}>💚</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.empathyTitle}>
                  We understand life happens
                </Text>
                <Text style={styles.empathyBody}>
                  If you're experiencing financial difficulty, we want to work
                  with you. Your request will be reviewed within 24 hours, and
                  your XnScore won't be affected during review.
                </Text>
              </View>
            </View>

            {/* Current advance */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("hardship_request.section_current")}</Text>
              <View style={styles.advanceRow}>
                <View>
                  <Text style={styles.advanceLabel}>{t("hardship_request.label_amount_due")}</Text>
                  <Text style={styles.advanceAmount}>${advance.amountDue}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.advanceLabel}>{t("hardship_request.label_due_date")}</Text>
                  <Text style={styles.advanceDate}>
                    {advance.withholdingDate}
                  </Text>
                  <Text style={styles.advanceDays}>
                    {advance.daysUntil} days
                  </Text>
                </View>
              </View>
            </View>

            {/* Hardship options */}
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>
                What type of assistance do you need?
              </Text>
              <View style={styles.optionsList}>
                {HARDSHIP_OPTIONS.map((option) => (
                  <OptionRow
                    key={option.id}
                    option={option}
                    selected={selectedOption === option.id}
                    onPress={() => setSelectedOption(option.id)}
                  />
                ))}
              </View>
            </View>

            {/* Reason chips */}
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>
                What's causing your hardship?
              </Text>
              <View style={styles.chipsWrap}>
                {HARDSHIP_REASONS.map((reason) => {
                  const selected = selectedReason === reason.id;
                  return (
                    <TouchableOpacity
                      key={reason.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setSelectedReason(reason.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={reason.label}
                    >
                      <Text style={styles.chipIcon}>{reason.icon}</Text>
                      <Text style={styles.chipLabel}>{reason.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Additional info textarea */}
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>
                Additional details (optional)
              </Text>
              <TextInput
                style={styles.textarea}
                value={additionalInfo}
                onChangeText={setAdditionalInfo}
                placeholder={t("hardship_request.placeholder_context")}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* What happens next */}
            <View style={styles.nextCard}>
              <Text style={styles.nextTitle}>{t("hardship_request.next_title")}</Text>
              <View style={styles.nextList}>
                {WHAT_NEXT.map((item, idx) => (
                  <View key={idx} style={styles.nextRow}>
                    <Text style={styles.nextIcon}>{item.icon}</Text>
                    <Text style={styles.nextText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            accessibilityLabel="Submit hardship request"
          >
            <Text
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              Submit Hardship Request
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OptionRow({
  option,
  selected,
  onPress,
}: {
  option: HardshipOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.title}
    >
      <Text style={styles.optionIcon}>{option.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text style={styles.optionDescription}>{option.description}</Text>
        <Text style={styles.optionDetail}>{option.detail}</Text>
      </View>
      <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
        {selected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  contentWrap: { padding: 20 },

  empathyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TEAL,
  },
  empathyEmoji: { fontSize: 24 },
  empathyTitle: { fontSize: 13, fontWeight: "600", color: "#065F46" },
  empathyBody: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 18,
    marginTop: 6,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  advanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  advanceLabel: { fontSize: 12, color: MUTED },
  advanceAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  advanceDate: {
    fontSize: 14,
    fontWeight: "600",
    color: AMBER,
    marginTop: 2,
  },
  advanceDays: { fontSize: 11, color: MUTED, marginTop: 2 },

  optionsList: { gap: 10 },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionRowSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  optionIcon: { fontSize: 24 },
  optionTitle: { fontSize: 14, fontWeight: "600", color: NAVY },
  optionDescription: { fontSize: 12, color: MUTED, marginTop: 2 },
  optionDetail: {
    fontSize: 11,
    color: TEAL,
    fontWeight: "500",
    marginTop: 4,
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioDotSelected: { backgroundColor: TEAL, borderColor: TEAL },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  chipIcon: { fontSize: 14 },
  chipLabel: { fontSize: 12, fontWeight: "500", color: NAVY },

  textarea: {
    width: "100%",
    minHeight: 100,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    fontSize: 14,
    color: NAVY,
    backgroundColor: "#FFFFFF",
  },

  nextCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 14,
  },
  nextTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 10,
  },
  nextList: { gap: 8 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nextIcon: { fontSize: 14 },
  nextText: { flex: 1, fontSize: 12, color: "#4B5563" },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  submitButtonDisabled: { backgroundColor: BORDER },
  submitButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  submitButtonTextDisabled: { color: "#9CA3AF" },
});
