// ══════════════════════════════════════════════════════════════════════════════
// screens/TaxIDEntryScreen.tsx — KYC-005 inclusive tax-ID entry
// ══════════════════════════════════════════════════════════════════════════════
//
// Tax ID entry treating SSN and ITIN as equally valid. User picks one,
// then fills legal name, DOB, masked tax ID, and confirms it. Translated
// from KYC screens/05_TaxIDEntry.jsx.
//
// Web specifics adapted:
//   - <input type="password"> + custom format → <TextInput secureTextEntry>
//     with onChangeText running the original formatTaxId / formatDate
//   - "monospace" font / letter-spacing — RN's monospace is platform-
//     specific; using fontFamily: "Courier" works on iOS and falls
//     back to default on Android. letterSpacing maps 1:1.
//   - The 3-segment progress bar in the header is rendered as flex Views.
//
// On "Verify & Unlock Interest" → InterestUnlockedSuccess (the
// Interest-First flow's celebration terminus) with params
// { unlockedAmount, isFullAccess: true }. The unlockedAmount is
// forwarded from the UnlockInterestPrompt route param chain; the
// `isFullAccess: true` reflects that completing tax-ID verification
// grants Tier 3.
//
// "Don't have SSN or ITIN?" help link → ITINEducation.
//
// All four form values stay in local state for now; Phase KYC-3 will
// route them through a KYC context's `submitTaxId(...)` that talks
// to the verification edge function.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { kycDraft } from "../lib/kycDraft";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";

type IdType = "ssn" | "itin";

function formatTaxId(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 9);
  if (v.length >= 5) return `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}`;
  if (v.length >= 3) return `${v.slice(0, 3)}-${v.slice(3)}`;
  return v;
}

function formatDate(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 8);
  if (v.length >= 4) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
  if (v.length >= 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return v;
}

// Optional `totalInterest` is forwarded from UnlockInterestPromptScreen
// when the user enters the verification flow from the Dashboard
// interest card. It's later passed straight through to
// InterestUnlockedSuccess so the celebration screen shows the same
// amount the user was promised. Falls back to a mock $47.83 (the
// canonical guide value) for direct/test entry.
type TaxIDEntryParams = { totalInterest?: number };
type TaxIDEntryRouteProp = RouteProp<
  { TaxIDEntry: TaxIDEntryParams },
  "TaxIDEntry"
>;
const MOCK_TOTAL_INTEREST = 47.83;

export default function TaxIDEntryScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<TaxIDEntryRouteProp>();
  const totalInterest = route.params?.totalInterest ?? MOCK_TOTAL_INTEREST;

  const [idType, setIdType] = useState<IdType | null>(null);
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [taxId, setTaxId] = useState("");
  const [confirmTaxId, setConfirmTaxId] = useState("");

  // ── KYC draft hydrate ────────────────────────────────────────────────────
  // Restore non-sensitive fields from the persisted draft on mount. The
  // tax ID digits are NEVER persisted (see lib/kycDraft.ts header) so the
  // user always re-keys those — even on Restore from the welcome banner.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await kycDraft.get();
      if (cancelled || !d) return;
      if (d.taxIdType) setIdType(d.taxIdType as IdType);
      if (d.legalName) setLegalName(d.legalName);
      if (d.dateOfBirth) setDateOfBirth(d.dateOfBirth);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const rawTaxId = taxId.replace(/\D/g, "");
  const rawConfirm = confirmTaxId.replace(/\D/g, "");
  const idsMatch = rawTaxId === rawConfirm;
  const canContinue =
    !!idType &&
    rawTaxId.length === 9 &&
    idsMatch &&
    legalName.length >= 2 &&
    dateOfBirth.length === 10;

  const handleContinue = () => {
    if (!canContinue) return;
    // Persist non-sensitive fields to the KYC draft so a user who quits
    // the InterestUnlockedSuccess screen and comes back later can resume
    // with their name/DOB pre-filled. We intentionally do NOT persist
    // taxId / confirmTaxId — see lib/kycDraft.ts header for the privacy
    // posture. clear() on InterestUnlockedSuccess wipes this on a real
    // terminal success.
    kycDraft.merge({
      taxIdType: idType as "ssn" | "itin",
      legalName,
      dateOfBirth,
    });
    // Interest-First flow (KYC-2.2): a successful tax-ID submission
    // is the final step in the SSN/ITIN paths. Land the user on
    // InterestUnlockedSuccess with the same amount they saw on
    // UnlockInterestPrompt. isFullAccess: true because tax-ID
    // verification grants Tier 3.
    //
    // Phase KYC-2 / KYC-3 will replace the synchronous navigate with
    // an actual submitTaxId() context call → backend verification →
    // success navigation on response.
    navigation.navigate(Routes.InterestUnlockedSuccess, {
      unlockedAmount: totalInterest,
      isFullAccess: true,
    });
  };

  const taxIdLabel =
    idType === "ssn"
      ? "Social Security Number"
      : idType === "itin"
        ? "ITIN"
        : "Tax ID";
  const confirmLabel =
    idType === "ssn"
      ? "SSN"
      : idType === "itin"
        ? "ITIN"
        : "Tax ID";

  const monoFont = Platform.OS === "ios" ? "Courier" : "monospace";

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
                <Text style={styles.headerTitle}>Tax Information</Text>
                <Text style={styles.headerSubtitle}>
                  Required for payouts over $600
                </Text>
              </View>
            </View>

            {/* Progress (2/3 segments filled) */}
            <View style={styles.progressRow}>
              <View style={[styles.progressSeg, styles.progressSegActive]} />
              <View style={[styles.progressSeg, styles.progressSegActive]} />
              <View style={styles.progressSeg} />
            </View>
          </LinearGradient>

          <View style={styles.contentWrap}>
            {/* ID Type Selection */}
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>
                What type of Tax ID do you have?
              </Text>
              <View style={styles.idTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.idTypeButton,
                    idType === "ssn" && styles.idTypeButtonSelected,
                  ]}
                  onPress={() => setIdType("ssn")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: idType === "ssn" }}
                >
                  <Text style={styles.idTypeFlag}>🇺🇸</Text>
                  <Text style={styles.idTypeName}>SSN</Text>
                  <Text style={styles.idTypeDesc}>Social Security</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.idTypeButton,
                    idType === "itin" && styles.idTypeButtonSelected,
                  ]}
                  onPress={() => setIdType("itin")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: idType === "itin" }}
                >
                  <Text style={styles.idTypeFlag}>📋</Text>
                  <Text style={styles.idTypeName}>ITIN</Text>
                  <Text style={styles.idTypeDesc}>Individual Taxpayer ID</Text>
                </TouchableOpacity>
              </View>

              {idType === "itin" && (
                <View style={styles.itinNoteCallout}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color="#3B82F6"
                  />
                  <Text style={styles.itinNoteText}>
                    ITINs always start with{" "}
                    <Text style={{ fontWeight: "700" }}>9</Text> (e.g.,
                    9XX-XX-XXXX)
                  </Text>
                </View>
              )}
            </View>

            {/* Form Fields */}
            <View style={styles.sectionCard}>
              {/* Legal Name */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Legal Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="As it appears on your tax documents"
                  placeholderTextColor="#9CA3AF"
                  autoComplete="name"
                />
              </View>

              {/* DOB */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <TextInput
                  style={styles.input}
                  value={dateOfBirth}
                  onChangeText={(v) => setDateOfBirth(formatDate(v))}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

              {/* Tax ID */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{taxIdLabel}</Text>
                <TextInput
                  style={[
                    styles.input,
                    { fontFamily: monoFont, letterSpacing: 2 },
                  ]}
                  value={taxId}
                  onChangeText={(v) => setTaxId(formatTaxId(v))}
                  placeholder="XXX-XX-XXXX"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={11}
                  secureTextEntry
                />
              </View>

              {/* Confirm Tax ID */}
              <View style={styles.fieldNoMargin}>
                <Text style={styles.fieldLabel}>Confirm {confirmLabel}</Text>
                <TextInput
                  style={[
                    styles.input,
                    { fontFamily: monoFont, letterSpacing: 2 },
                    !!rawTaxId &&
                      !!rawConfirm &&
                      !idsMatch &&
                      styles.inputError,
                  ]}
                  value={confirmTaxId}
                  onChangeText={(v) => setConfirmTaxId(formatTaxId(v))}
                  placeholder="Re-enter to confirm"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={11}
                  secureTextEntry
                />
                {!!rawTaxId && !!rawConfirm && !idsMatch && (
                  <Text style={styles.errorText}>Numbers don't match</Text>
                )}
                {!!rawTaxId &&
                  !!rawConfirm &&
                  idsMatch &&
                  rawTaxId.length === 9 && (
                    <View style={styles.matchRow}>
                      <Ionicons name="checkmark" size={14} color="#059669" />
                      <Text style={styles.matchText}>Numbers match</Text>
                    </View>
                  )}
              </View>
            </View>

            {/* Privacy & Security */}
            <View style={styles.privacyCard}>
              <Ionicons
                name="lock-closed"
                size={18}
                color="#00897B"
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyTitle}>Bank-level security</Text>
                <Text style={styles.privacyBody}>
                  Your information is encrypted and only used for IRS tax
                  reporting. We never share it with anyone else.
                </Text>
              </View>
            </View>

            {/* Need Help — for users without SSN/ITIN */}
            <TouchableOpacity
              style={styles.needHelpButton}
              onPress={() => navigation.navigate(Routes.ITINEducation)}
              accessibilityRole="button"
              accessibilityLabel="Don't have SSN or ITIN, get help"
            >
              <Text style={styles.needHelpEmoji}>🤔</Text>
              <Text style={styles.needHelpText}>
                Don't have SSN or ITIN? We can help
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !canContinue && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            accessibilityLabel="Verify and unlock interest"
          >
            <Text
              style={[
                styles.continueButtonText,
                !canContinue && styles.continueButtonTextDisabled,
              ]}
            >
              Verify & Unlock Interest
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  progressRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressSegActive: { backgroundColor: TEAL },

  contentWrap: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 8,
  },
  field: { marginBottom: 16 },
  fieldNoMargin: {},

  input: {
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    fontSize: 16,
    color: NAVY,
    backgroundColor: "#FFFFFF",
  },
  inputError: { borderWidth: 2, borderColor: RED },
  errorText: { marginTop: 8, fontSize: 12, color: RED },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  matchText: { fontSize: 12, color: "#059669" },

  idTypeRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  idTypeButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    alignItems: "center",
  },
  idTypeButtonSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  idTypeFlag: { fontSize: 24 },
  idTypeName: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginTop: 8,
  },
  idTypeDesc: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  itinNoteCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  itinNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
  },

  privacyCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
  },
  privacyBody: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 18,
    marginTop: 4,
  },

  needHelpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
  },
  needHelpEmoji: { fontSize: 14 },
  needHelpText: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  continueButtonDisabled: { backgroundColor: BORDER },
  continueButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  continueButtonTextDisabled: { color: "#9CA3AF" },
});
