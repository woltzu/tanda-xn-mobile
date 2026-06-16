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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { kycDraft } from "../lib/kycDraft";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const totalInterest = route.params?.totalInterest ?? MOCK_TOTAL_INTEREST;

  const [submitting, setSubmitting] = useState(false);
  const [idType, setIdType] = useState<IdType | null>(null);
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [taxId, setTaxId] = useState("");
  const [confirmTaxId, setConfirmTaxId] = useState("");
  // P1 (kyc-trigger review): the screen pre-fills legal name + DOB
  // from the profile when the draft is empty. We surface a small
  // "pre-filled from your profile" hint when at least one field
  // actually came from the profile fall-through. Edits clear the
  // flag so the hint disappears the moment the user takes ownership.
  const [prefilledFromProfile, setPrefilledFromProfile] = useState(false);
  // Tracks whether we've already applied the profile-fallback so a
  // late-arriving profile fetch can't overwrite user edits.
  const [profileApplied, setProfileApplied] = useState(false);

  const { profile } = useProfile();

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

  // ── Profile pre-fill fallback (P1) ──────────────────────────────
  // Runs once when the profile lands AND the draft fill above has had
  // a chance to run. Only fills empty fields so a hydrated draft
  // value wins over the profile value (the draft is closer to what
  // the user was last working with). DOB normalises to YYYY-MM-DD —
  // matches the format the date input expects.
  useEffect(() => {
    if (profileApplied || !profile) return;
    let didPrefill = false;
    if (!legalName && profile.full_name) {
      setLegalName(profile.full_name);
      didPrefill = true;
    }
    if (!dateOfBirth && profile.date_of_birth) {
      // profiles.date_of_birth is a date column → already YYYY-MM-DD
      // when serialized; slice defensively in case the row carries a
      // timestamp.
      const dob = String(profile.date_of_birth).slice(0, 10);
      if (dob.length === 10) {
        setDateOfBirth(dob);
        didPrefill = true;
      }
    }
    if (didPrefill) setPrefilledFromProfile(true);
    setProfileApplied(true);
    // Intentional dep list — re-running when legalName/dateOfBirth
    // change would defeat the "only fill empty fields" rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, profileApplied]);
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

  const handleContinue = async () => {
    if (!canContinue || submitting) return;
    if (!user?.id) {
      Alert.alert(
        t("tax_id_entry.auth_required_title"),
        t("tax_id_entry.auth_required_body"),
      );
      return;
    }

    // Persist non-sensitive fields to the KYC draft so a user who quits
    // the InterestUnlockedSuccess screen and comes back later can resume
    // with their name/DOB pre-filled. We intentionally do NOT persist
    // taxId / confirmTaxId here — see lib/kycDraft.ts header for the
    // privacy posture. clear() on InterestUnlockedSuccess wipes this on
    // a real terminal success.
    kycDraft.merge({
      taxIdType: idType as "ssn" | "itin",
      legalName,
      dateOfBirth,
    });

    // KYC P0 wiring (2026-06-12): write the tax ID to the live engine
    // table `kyc_verifications` instead of AsyncStorage, where it
    // previously evaporated. We upsert by member_id (the table's
    // natural key from migration 151's unique index) and set status
    // to `provider_pending` so the row is in the right state for the
    // Persona webhook to later flip to `approved` — which fires
    // `trg_sync_kyc_tier_to_profile` and bumps the user's tier.
    setSubmitting(true);
    const { error: dbErr } = await supabase
      .from("kyc_verifications")
      .upsert(
        {
          member_id: user.id,
          kyc_type: "persona",
          provider: "persona",
          provider_reference_id: "manual_tax_id",
          tax_id: rawTaxId,
          status: "provider_pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      );
    setSubmitting(false);

    if (dbErr) {
      Alert.alert(
        t("tax_id_entry.save_failed_title"),
        t("tax_id_entry.save_failed_body"),
      );
      return;
    }

    // Interest-First flow (KYC-2.2): a successful tax-ID submission
    // is the final step in the SSN/ITIN paths. Land the user on
    // InterestUnlockedSuccess with the same amount they saw on
    // UnlockInterestPrompt. The actual tier upgrade happens once
    // the Persona webhook (or admin review) flips status to
    // 'approved' and `trg_sync_kyc_tier_to_profile` fires.
    navigation.navigate(Routes.InterestUnlockedSuccess, {
      unlockedAmount: totalInterest,
      isFullAccess: true,
    });
  };

  const taxIdLabel =
    idType === "ssn"
      ? t("tax_id_entry.label_tax_id_ssn")
      : idType === "itin"
        ? t("tax_id_entry.label_tax_id_itin")
        : t("tax_id_entry.label_tax_id_default");
  const confirmLabel =
    idType === "ssn"
      ? t("tax_id_entry.label_confirm_ssn")
      : idType === "itin"
        ? t("tax_id_entry.label_confirm_itin")
        : t("tax_id_entry.label_confirm_default");

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
                <Text style={styles.headerTitle}>{t("tax_id_entry.header")}</Text>
                <Text style={styles.headerSubtitle}>
                  {t("tax_id_entry.header_subtitle")}
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
                {t("tax_id_entry.field_id_type")}
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
                  <Text style={styles.idTypeName}>{t("tax_id_entry.id_type_ssn_name")}</Text>
                  <Text style={styles.idTypeDesc}>{t("tax_id_entry.id_type_ssn_desc")}</Text>
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
                  <Text style={styles.idTypeName}>{t("tax_id_entry.id_type_itin_name")}</Text>
                  <Text style={styles.idTypeDesc}>{t("tax_id_entry.id_type_itin_desc")}</Text>
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
                    {t("tax_id_entry.itin_note_prefix")}
                    <Text style={{ fontWeight: "700" }}>{t("tax_id_entry.itin_note_digit")}</Text>
                    {t("tax_id_entry.itin_note_suffix")}
                  </Text>
                </View>
              )}
            </View>

            {/* Form Fields */}
            <View style={styles.sectionCard}>
              {/* P1 (kyc-trigger review): "we pre-filled this for you"
                  hint, only when at least one field came from the
                  profile fallback above. Dismisses itself the moment
                  the user edits either field. */}
              {prefilledFromProfile ? (
                <View style={styles.prefillHint}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color="#1E40AF"
                  />
                  <Text style={styles.prefillHintText}>
                    {t("tax_id_entry.prefill_note")}
                  </Text>
                </View>
              ) : null}
              {/* Legal Name */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t("tax_id_entry.label_legal_name")}</Text>
                <TextInput
                  style={styles.input}
                  value={legalName}
                  onChangeText={(v) => {
                    setLegalName(v);
                    if (prefilledFromProfile) setPrefilledFromProfile(false);
                  }}
                  placeholder={t("tax_id_entry.placeholder_legal_name")}
                  placeholderTextColor="#9CA3AF"
                  autoComplete="name"
                />
              </View>

              {/* DOB */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t("tax_id_entry.label_dob")}</Text>
                <TextInput
                  style={styles.input}
                  value={dateOfBirth}
                  onChangeText={(v) => {
                    setDateOfBirth(formatDate(v));
                    if (prefilledFromProfile) setPrefilledFromProfile(false);
                  }}
                  placeholder={t("tax_id_entry.placeholder_dob")}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

              {/* Tax ID — KYC P1 inline validation: 9-digit format check
                  surfaces a red border + helper text when the user has
                  typed digits but not the right count. (?) help icon
                  fires Alert with privacy explainer. */}
              <View style={styles.field}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>{taxIdLabel}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        t("tax_id_entry.help_taxid_title"),
                        t("tax_id_entry.help_taxid_body"),
                      )
                    }
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("tax_id_entry.help_taxid_title")}
                  >
                    <Ionicons
                      name="help-circle-outline"
                      size={16}
                      color={MUTED}
                    />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    { fontFamily: monoFont, letterSpacing: 2 },
                    !!rawTaxId && rawTaxId.length !== 9 && styles.inputError,
                  ]}
                  value={taxId}
                  onChangeText={(v) => setTaxId(formatTaxId(v))}
                  placeholder={t("tax_id_entry.placeholder_tax_id")}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={11}
                  secureTextEntry
                />
                {!!rawTaxId && rawTaxId.length !== 9 ? (
                  <Text style={styles.errorText}>
                    {t("tax_id_entry.error_format")}
                  </Text>
                ) : null}
              </View>

              {/* Confirm Tax ID */}
              <View style={styles.fieldNoMargin}>
                <Text style={styles.fieldLabel}>{t("tax_id_entry.label_confirm_prefix")}{confirmLabel}</Text>
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
                  placeholder={t("tax_id_entry.placeholder_confirm")}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={11}
                  secureTextEntry
                />
                {!!rawTaxId && !!rawConfirm && !idsMatch && (
                  <Text style={styles.errorText}>{t("tax_id_entry.error_no_match")}</Text>
                )}
                {!!rawTaxId &&
                  !!rawConfirm &&
                  idsMatch &&
                  rawTaxId.length === 9 && (
                    <View style={styles.matchRow}>
                      <Ionicons name="checkmark" size={14} color="#059669" />
                      <Text style={styles.matchText}>{t("tax_id_entry.match_confirmed")}</Text>
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
                <Text style={styles.privacyTitle}>{t("tax_id_entry.privacy_title")}</Text>
                <Text style={styles.privacyBody}>
                  {t("tax_id_entry.privacy_body")}
                </Text>
              </View>
            </View>

            {/* Need Help — for users without SSN/ITIN */}
            <TouchableOpacity
              style={styles.needHelpButton}
              onPress={() => navigation.navigate(Routes.KYCHub)}
              accessibilityRole="button"
              accessibilityLabel="Don't have SSN or ITIN, get help"
            >
              <Text style={styles.needHelpEmoji}>🤔</Text>
              <Text style={styles.needHelpText}>
                {t("tax_id_entry.need_help")}
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
              {t("tax_id_entry.btn_verify")}
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
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  field: { marginBottom: 16 },

  // P1 (kyc-trigger review): the "pre-filled from profile" hint
  // banner. Visually distinct from validation errors (info-blue, not
  // amber/red) so the user reads it as a courtesy note rather than a
  // problem.
  prefillHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 14,
  },
  prefillHintText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    fontWeight: "500",
    lineHeight: 16,
  },
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
