// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminKYCReviewDetailScreen.tsx — admin KYC review detail + actions
// ═══════════════════════════════════════════════════════════════════════════
//
// Loads one kyc_verifications row + the submitter's profile. Shows the
// three document images (front / back / selfie), lets an admin capture
// the four extracted_* fields off the ID, and calls approve/reject
// RPCs from mig 360.
//
// On approve, the mig 359 AFTER UPDATE trigger fires and auto-populates
// profiles.full_name / date_of_birth / address (COALESCE-guarded so
// existing values aren't overwritten). Nothing to do client-side beyond
// calling the RPC.
//
// UI strings are inline English for the first pass — same rationale as
// AdminKYCReviewQueueScreen.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";

type Params = { AdminKYCReviewDetail: { verificationId: string } };

interface Verification {
  id: string;
  member_id: string;
  status: string;
  kyc_tier: number | null;
  id_type: string | null;
  id_document_front_url: string | null;
  id_document_back_url: string | null;
  selfie_url: string | null;
  extracted_full_name: string | null;
  extracted_dob: string | null;
  extracted_address: string | null;
  extracted_document_number: string | null;
  admin_notes: string | null;
  rejection_code: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
  kyc_level: number | null;
}

export default function AdminKYCReviewDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, "AdminKYCReviewDetail">>();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const verificationId = route.params?.verificationId;

  const [verification, setVerification] = useState<Verification | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft form values — pre-filled from the verification's extracted_*
  // columns so an admin can edit them before approving.
  const [draftFullName, setDraftFullName] = useState("");
  const [draftDob, setDraftDob] = useState(""); // YYYY-MM-DD
  const [draftAddress, setDraftAddress] = useState("");
  const [draftDocNumber, setDraftDocNumber] = useState("");
  const [draftTier, setDraftTier] = useState<number>(1);
  const [draftNotes, setDraftNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!verificationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: verRow, error: verErr } = await supabase
        .from("kyc_verifications")
        .select(
          "id, member_id, status, kyc_tier, id_type, id_document_front_url, id_document_back_url, selfie_url, extracted_full_name, extracted_dob, extracted_address, extracted_document_number, admin_notes, rejection_code, reviewed_by, reviewed_at, created_at, updated_at",
        )
        .eq("id", verificationId)
        .maybeSingle();
      if (verErr) throw new Error(verErr.message);
      if (!verRow) throw new Error("Verification not found");
      const v = verRow as Verification;
      setVerification(v);
      setDraftFullName(v.extracted_full_name ?? "");
      setDraftDob(v.extracted_dob ?? "");
      setDraftAddress(v.extracted_address ?? "");
      setDraftDocNumber(v.extracted_document_number ?? "");
      setDraftTier(v.kyc_tier ?? 1);

      const { data: profRow } = await supabase
        .from("profiles")
        .select("id, full_name, email, kyc_status, kyc_level")
        .eq("id", v.member_id)
        .maybeSingle();
      setProfile((profRow as Profile | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [verificationId]);

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  const isReviewable = useMemo(
    () =>
      verification !== null &&
      ["pending", "provider_pending", "rejected"].includes(verification.status),
    [verification],
  );

  const isRejectable = useMemo(
    () =>
      verification !== null &&
      ["pending", "provider_pending"].includes(verification.status),
    [verification],
  );

  const doApprove = async () => {
    if (!verification) return;
    if (draftTier < 0 || draftTier > 4) {
      Alert.alert("Invalid tier", "Tier must be between 0 and 4.");
      return;
    }
    // Basic date shape check — RPC will accept null, but sending a
    // malformed string would 400. Empty stays null.
    if (draftDob && !/^\d{4}-\d{2}-\d{2}$/.test(draftDob)) {
      Alert.alert("Invalid date of birth", "Expected format YYYY-MM-DD.");
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase.rpc("approve_kyc_verification", {
      p_verification_id: verification.id,
      p_extracted_full_name: draftFullName.trim() || null,
      p_extracted_dob: draftDob.trim() || null,
      p_extracted_address: draftAddress.trim() || null,
      p_extracted_document_number: draftDocNumber.trim() || null,
      p_kyc_tier: draftTier,
      p_notes: draftNotes.trim() || null,
    });
    setSaving(false);
    if (err) {
      Alert.alert("Approve failed", err.message);
      return;
    }
    Alert.alert("Approved", "Profile fields have been auto-populated.");
    navigation.goBack();
  };

  const doReject = () => {
    if (!verification) return;
    Alert.prompt(
      "Reject KYC",
      "Enter a short reason (e.g. blurry, id_expired, face_mismatch).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async (reason?: string) => {
            const r = (reason ?? "").trim();
            if (!r) {
              Alert.alert("Reason required");
              return;
            }
            setSaving(true);
            const { error: err } = await supabase.rpc("reject_kyc_verification", {
              p_verification_id: verification.id,
              p_reason: r,
            });
            setSaving(false);
            if (err) {
              Alert.alert("Reject failed", err.message);
              return;
            }
            Alert.alert("Rejected");
            navigation.goBack();
          },
        },
      ],
      "plain-text",
    );
  };

  if (adminLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accentTeal} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.blockedText}>Admin only</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!verification) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2342" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KYC Review</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Submitter</Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Name: </Text>
            {profile?.full_name ?? "(none)"}
          </Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Email: </Text>
            {profile?.email ?? "(none)"}
          </Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Member ID: </Text>
            {verification.member_id}
          </Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Current status: </Text>
            {profile?.kyc_status ?? "unknown"} (level {profile?.kyc_level ?? 0})
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <DocPreview label="Front of ID" uri={verification.id_document_front_url} />
          <DocPreview label="Back of ID" uri={verification.id_document_back_url} />
          <DocPreview label="Selfie" uri={verification.selfie_url} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Extracted fields</Text>
          <Text style={styles.hint}>
            Populate these from what you read on the ID. Empty stays empty.
          </Text>
          <LabeledInput label="Full name" value={draftFullName} onChangeText={setDraftFullName} />
          <LabeledInput
            label="Date of birth (YYYY-MM-DD)"
            value={draftDob}
            onChangeText={setDraftDob}
            placeholder="1990-01-15"
          />
          <LabeledInput label="Address" value={draftAddress} onChangeText={setDraftAddress} multiline />
          <LabeledInput
            label="Document number"
            value={draftDocNumber}
            onChangeText={setDraftDocNumber}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tier</Text>
          <View style={styles.tierRow}>
            {[1, 2].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tierChip, draftTier === t && styles.tierChipActive]}
                onPress={() => setDraftTier(t)}
              >
                <Text style={[styles.tierChipText, draftTier === t && styles.tierChipTextActive]}>
                  Tier {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={draftNotes}
            onChangeText={setDraftNotes}
            placeholder="Anything else future reviewers should know…"
            multiline
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {verification.admin_notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prior notes</Text>
            <Text style={styles.priorNotes}>{verification.admin_notes}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, (!isRejectable || saving) && styles.actionDisabled]}
            onPress={doReject}
            disabled={!isRejectable || saving}
          >
            <Ionicons name="close-outline" size={16} color="#FFFFFF" />
            <Text style={styles.actionText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, (!isReviewable || saving) && styles.actionDisabled]}
            onPress={doApprove}
            disabled={!isReviewable || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocPreview({ label, uri }: { label: string; uri: string | null }) {
  return (
    <View style={styles.docBlock}>
      <Text style={styles.docLabel}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.docImage} resizeMode="cover" />
      ) : (
        <View style={styles.docPlaceholder}>
          <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
          <Text style={styles.docPlaceholderText}>Not provided</Text>
        </View>
      )}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: "#0A2342",
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  field: { fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  fieldLabel: { fontWeight: "700", color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, fontStyle: "italic" },
  docBlock: { marginBottom: 12 },
  docLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 6,
  },
  docImage: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
  },
  docPlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  docPlaceholderText: { fontSize: 11, color: colors.textSecondary },
  inputBlock: { marginBottom: 10 },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  notesInput: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
    textAlignVertical: "top",
  },
  priorNotes: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: "monospace",
  },
  tierRow: { flexDirection: "row", gap: 8 },
  tierChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  tierChipActive: { backgroundColor: colors.primaryNavy, borderColor: colors.primaryNavy },
  tierChipText: { color: colors.textPrimary, fontWeight: "600" },
  tierChipTextActive: { color: "#FFFFFF" },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
  },
  approveBtn: { backgroundColor: colors.accentTeal },
  rejectBtn: { backgroundColor: colors.errorText },
  actionDisabled: { opacity: 0.5 },
  actionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  blockedText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
  errorText: { marginTop: 12, color: colors.errorText, textAlign: "center", fontSize: 13 },
});
