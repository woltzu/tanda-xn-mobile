// ══════════════════════════════════════════════════════════════════════════════
// screens/InternationalVerificationScreen.tsx — KYC-004 international users
// ══════════════════════════════════════════════════════════════════════════════
//
// Simpler verification path for users outside the United States:
// country, ID type, optional foreign tax ID. Translated from
// KYC screens/04_InternationalVerification.jsx.
//
// Web version used a native <select> for the country picker. RN has
// no equivalent so we use a Modal containing a FlatList of countries.
//
// On Continue → IDVerificationStart. The form state (country, idType,
// hasTaxId, taxId) is kept local for now; Phase KYC-2 will wire it
// into a KYC context so the IRS / international verification step
// downstream knows what was submitted.
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
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { kycDraft } from "../lib/kycDraft";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type Country = { code: string; name: string; flag: string };
type IdType = "passport" | "national-id" | "drivers";

const COUNTRIES: Country[] = [
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "OTHER", name: "Other country...", flag: "🌍" },
];

// i18n: nameKey/textKey resolved per-render via t() at call site.
const ID_TYPES: { id: IdType; icon: string; nameKey: string }[] = [
  { id: "passport", icon: "🛂", nameKey: "international_verification.id_passport" },
  { id: "national-id", icon: "🪪", nameKey: "international_verification.id_national" },
  { id: "drivers", icon: "🚗", nameKey: "international_verification.id_drivers" },
];

const NEXT_STEPS = [
  { num: 1, textKey: "international_verification.step_1_text" },
  { num: 2, textKey: "international_verification.step_2_text" },
  { num: 3, textKey: "international_verification.step_3_text" },
];

export default function InternationalVerificationScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();

  const [country, setCountry] = useState<Country | null>(null);
  const [idType, setIdType] = useState<IdType | null>(null);
  const [hasTaxId, setHasTaxId] = useState<boolean | null>(null);
  const [taxId, setTaxId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── KYC draft hydrate ────────────────────────────────────────────────────
  // Restore country / idType / hasTaxId from the persisted draft on mount.
  // The international tax-ID digits are NEVER persisted (see lib/kycDraft.ts
  // header) so the user always re-keys those — even on Restore from the
  // welcome banner.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await kycDraft.get();
      if (cancelled || !d) return;
      if (d.country) setCountry(d.country as Country);
      if (d.internationalIdType) setIdType(d.internationalIdType as IdType);
      if (typeof d.hasTaxId === "boolean") setHasTaxId(d.hasTaxId);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const canContinue = !!country && !!idType && hasTaxId !== null;

  const handleContinue = () => {
    if (!canContinue) return;
    // Persist non-sensitive fields to the KYC draft so a user who quits
    // mid-flow (between this screen and Tier2Success) can resume with
    // country / ID type / hasTaxId pre-filled. We intentionally do NOT
    // persist taxId — see lib/kycDraft.ts header. clear() on
    // Tier2SuccessScreen wipes this on a real terminal success.
    kycDraft.merge({
      country,
      internationalIdType: idType,
      hasTaxId,
    });
    // KYC P1 (2026-06-12): IDVerificationStart folded into KYCDocument
    // (single-screen front + back + selfie). Route directly.
    navigation.navigate(Routes.KYCDocument);
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
                <Text style={styles.headerTitle}>
                  {t("international_verification.header")}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {t("international_verification.header_subtitle")}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.contentWrap}>
            {/* Welcome */}
            <View style={styles.welcomeBanner}>
              <Text style={styles.welcomeEmoji}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeTitle}>{t("international_verification.welcome_title")}</Text>
                <Text style={styles.welcomeBody}>
                  {t("international_verification.welcome_body")}
                </Text>
              </View>
            </View>

            {/* Country Selection */}
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>{t("international_verification.field_country")}</Text>
              <TouchableOpacity
                style={styles.pickerInput}
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Select country"
              >
                {country ? (
                  <Text style={styles.pickerInputText}>
                    {country.flag} {country.name}
                  </Text>
                ) : (
                  <Text style={styles.pickerInputPlaceholder}>
                    {t("international_verification.placeholder_country")}
                  </Text>
                )}
                <Ionicons name="chevron-down" size={18} color={MUTED} />
              </TouchableOpacity>
            </View>

            {/* ID Type Selection */}
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>{t("international_verification.field_id_type")}</Text>
              <View style={styles.idList}>
                {ID_TYPES.map((type) => {
                  const isSelected = idType === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.idOption,
                        isSelected && styles.idOptionSelected,
                      ]}
                      onPress={() => setIdType(type.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={styles.idIcon}>{type.icon}</Text>
                      <Text style={styles.idName}>{t(type.nameKey)}</Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={TEAL}
                          style={{ marginLeft: "auto" }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Tax ID Question */}
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>
                {t("international_verification.field_tax_id")}
              </Text>
              <Text style={styles.fieldHint}>
                {t("international_verification.field_tax_id_hint")}
              </Text>
              <View style={styles.yesNoRow}>
                <TouchableOpacity
                  style={[
                    styles.yesNoButton,
                    hasTaxId === true && styles.yesNoButtonSelected,
                  ]}
                  onPress={() => setHasTaxId(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Yes, I have a tax ID"
                >
                  <Text style={styles.yesNoText}>{t("international_verification.btn_yes")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.yesNoButton,
                    hasTaxId === false && styles.yesNoButtonSelected,
                  ]}
                  onPress={() => setHasTaxId(false)}
                  accessibilityRole="button"
                  accessibilityLabel="No or not sure"
                >
                  <Text style={styles.yesNoText}>{t("international_verification.btn_no")}</Text>
                </TouchableOpacity>
              </View>

              {/* Tax ID Input */}
              {hasTaxId === true && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.fieldLabelSmall}>
                    {t("international_verification.label_tax_id_optional")}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={taxId}
                    onChangeText={setTaxId}
                    placeholder={t("international_verification.placeholder_tax_id")}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              )}

              {/* No tax ID — that's OK */}
              {hasTaxId === false && (
                <View style={styles.tealCallout}>
                  <Text style={styles.tealCalloutEmoji}>✅</Text>
                  <Text style={styles.tealCalloutText}>
                    <Text style={styles.tealCalloutStrong}>{t("international_verification.no_tax_callout_strong")}</Text>
                    {t("international_verification.no_tax_callout_body")}
                  </Text>
                </View>
              )}
            </View>

            {/* Next steps */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("international_verification.section_next_steps")}</Text>
              <View style={styles.stepsList}>
                {NEXT_STEPS.map((step) => (
                  <View key={step.num} style={styles.stepRow}>
                    <View style={styles.stepNumBox}>
                      <Text style={styles.stepNumText}>{step.num}</Text>
                    </View>
                    <Text style={styles.stepText}>{t(step.textKey)}</Text>
                  </View>
                ))}
              </View>
            </View>
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
            accessibilityLabel="Continue to ID verification"
          >
            <Text
              style={[
                styles.continueButtonText,
                !canContinue && styles.continueButtonTextDisabled,
              ]}
            >
              {t("international_verification.btn_continue")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Country picker modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("international_verification.modal_title")}</Text>
              <TouchableOpacity
                onPress={() => setPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close country picker"
              >
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => {
                    setCountry(item);
                    setPickerOpen(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>
                    {item.code === "OTHER" ? t("international_verification.country_other") : item.name}
                  </Text>
                  {country?.code === item.code && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={TEAL}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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

  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  welcomeEmoji: { fontSize: 32 },
  welcomeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46",
  },
  welcomeBody: {
    fontSize: 12,
    color: "#047857",
    marginTop: 4,
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
  fieldLabelSmall: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: MUTED,
    marginTop: -8,
    marginBottom: 12,
  },

  pickerInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  pickerInputText: { flex: 1, fontSize: 16, color: NAVY },
  pickerInputPlaceholder: { flex: 1, fontSize: 16, color: "#9CA3AF" },

  idList: { gap: 10 },
  idOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
  },
  idOptionSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  idIcon: { fontSize: 24 },
  idName: { fontSize: 14, fontWeight: "600", color: NAVY },

  yesNoRow: { flexDirection: "row", gap: 10 },
  yesNoButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    alignItems: "center",
  },
  yesNoButtonSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  yesNoText: { fontSize: 14, fontWeight: "600", color: NAVY },

  textInput: {
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

  tealCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
  },
  tealCalloutEmoji: { fontSize: 18 },
  tealCalloutText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
  },
  tealCalloutStrong: { fontWeight: "700" },

  stepsList: { gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNumBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  stepText: { fontSize: 13, color: "#4B5563" },

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

  // Country picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingTop: 8,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: NAVY },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  countryFlag: { fontSize: 22 },
  countryName: { fontSize: 15, color: NAVY },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginLeft: 56 },
});
