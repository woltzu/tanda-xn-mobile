import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

type ReportIssueNavigationProp = StackNavigationProp<RootStackParamList>;
type ReportIssueRouteProp = RouteProp<RootStackParamList, "ReportIssue">;

// Dispute types as specified by the issue spec. Stored as plain text in
// `dispute_cases.dispute_type` (varchar, no check constraint).
type DisputeType =
  | "missed_payment"
  | "unauthorized_transaction"
  | "payout_delay"
  | "position_swap"
  | "other";

const DISPUTE_TYPES: { id: DisputeType; label: string; icon: string; description: string }[] = [
  {
    id: "missed_payment",
    label: "Missed payment",
    icon: "card-outline",
    description: "A member hasn't paid their contribution",
  },
  {
    id: "unauthorized_transaction",
    label: "Unauthorized transaction",
    icon: "warning-outline",
    description: "A charge or transfer you didn't approve",
  },
  {
    id: "payout_delay",
    label: "Payout delay",
    icon: "time-outline",
    description: "A scheduled payout is late or missing",
  },
  {
    id: "position_swap",
    label: "Position swap dispute",
    icon: "swap-horizontal-outline",
    description: "Disagreement over rotation position",
  },
  {
    id: "other",
    label: "Other",
    icon: "ellipsis-horizontal-outline",
    description: "Something else not listed above",
  },
];

export default function ReportIssueScreen() {
  const { t } = useTranslation();

  const navigation = useNavigation<ReportIssueNavigationProp>();
  const route = useRoute<ReportIssueRouteProp>();
  const { circleId, circleName } = route.params || {};
  const { user } = useAuth();

  const [disputeType, setDisputeType] = useState<DisputeType | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    !!disputeType && description.trim().length > 0 && !!circleId && !!user?.id && !isSubmitting;

  const handleSubmit = async () => {
    if (!disputeType) {
      Alert.alert("Pick a dispute type", "Please choose what kind of issue you're reporting.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Add a description", "Please describe the issue so the elders can review it.");
      return;
    }
    if (!circleId) {
      Alert.alert("Missing circle", "We couldn't determine which circle this issue is about. Go back and try again.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Not signed in", "You need to be signed in to file a dispute.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Insert into dispute_cases. Real schema differs slightly from the spec:
      //   - `complainant_id` (not `created_by`) is the filer's user_id (NOT NULL)
      //   - `assigned_elder_id` is not a column on this table; assignment happens elsewhere
      //   - `status` defaults to 'open' (USER-DEFINED enum); we don't need to pass it
      // RLS: dispute_cases_member_modify (Tier 4 Batch 1, 2026-05-20) requires the
      // filer to be a member of the circle (EXISTS on circle_members).
      const { error } = await supabase.from("dispute_cases").insert({
        circle_id: circleId,
        complainant_id: user.id,
        dispute_type: disputeType,
        description: description.trim(),
        status: "open",
      });

      if (error) {
        console.error("[ReportIssueScreen] insert failed:", error);
        Alert.alert("Couldn't submit", error.message);
        return;
      }

      Alert.alert(
        "Dispute filed",
        "Your report has been submitted. Circle elders will review it shortly.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      console.error("[ReportIssueScreen] unexpected error:", e);
      Alert.alert("Couldn't submit", e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("screen_headers.report_issue")}</Text>
          <View style={{ width: 40 }} />
        </View>
        {circleName && (
          <View style={styles.circleInfo}>
            <Text style={styles.circleLabel}>Circle</Text>
            <Text style={styles.circleName} numberOfLines={1}>
              {circleName}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Dispute type selector */}
        <Text style={styles.sectionTitle}>What's the issue?</Text>
        <Text style={styles.sectionSubtitle}>Pick the type that best describes it.</Text>
        {DISPUTE_TYPES.map((t) => {
          const selected = disputeType === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.typeCard, selected && styles.typeCardSelected]}
              onPress={() => setDisputeType(t.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={[styles.typeIcon, selected && styles.typeIconSelected]}>
                <Ionicons
                  name={t.icon as any}
                  size={22}
                  color={selected ? "#FFFFFF" : "#6B7280"}
                />
              </View>
              <View style={styles.typeContent}>
                <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                  {t.label}
                </Text>
                <Text style={styles.typeDescription}>{t.description}</Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={22} color="#00C6AE" />}
            </TouchableOpacity>
          );
        })}

        {/* Description */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Description</Text>
        <Text style={styles.sectionSubtitle}>
          Describe what happened — when, who's involved, and any context an elder needs to resolve it.
        </Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="The contribution due on May 15 was never received…"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          editable={!isSubmitting}
        />

        {/* Privacy notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#6366F1" />
          <Text style={styles.privacyText}>
            Visible only to members of this circle and assigned elders. Your identity will be shown to those parties.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit dispute</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },
  circleInfo: { marginTop: 14, alignItems: "center" },
  circleLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 0.5 },
  circleName: { fontSize: 16, color: "#FFFFFF", fontWeight: "600", marginTop: 2 },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: "#6B7280", marginBottom: 12 },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  typeCardSelected: { borderColor: "#00C6AE", backgroundColor: "#F0FDFB" },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  typeIconSelected: { backgroundColor: "#00C6AE" },
  typeContent: { flex: 1 },
  typeLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  typeLabelSelected: { color: "#00C6AE" },
  typeDescription: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  descriptionInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 140,
  },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  privacyText: { flex: 1, fontSize: 12, color: "#4B5563", lineHeight: 17 },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  submitButtonDisabled: { backgroundColor: "#D1D5DB" },
  submitButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
