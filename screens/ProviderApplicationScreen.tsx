// ══════════════════════════════════════════════════════════════════════════════
// ProviderApplicationScreen — "Become a provider" multi-step form
// ══════════════════════════════════════════════════════════════════════════════
// 3-step wizard:
//   1. Business info  (name, category, country, city, phone, email, years,
//                      description)
//   2. Verification selection — Phase 1A only ships Elder endorsement
//   3. Submit → insert provider row + elder_endorsement step + notify
//      admin_users
// Confirmation pane appears in place of step 3 once the insert succeeds.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  ProviderCategory,
  useProviderApplication,
} from "../hooks/useProviders";

const CATEGORIES: ProviderCategory[] = [
  "construction",
  "education",
  "healthcare",
  "agriculture",
  "retail",
  "legal_finance",
  "services",
  "other",
];

type Step = 1 | 2 | 3 | 4;

export default function ProviderApplicationScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { submit, submitting } = useProviderApplication();

  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<ProviderCategory | null>(null);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [description, setDescription] = useState("");

  const step1Valid =
    businessName.trim().length >= 2 && category !== null && country.trim() && city.trim();

  const goNext = () => {
    if (step === 1 && !step1Valid) {
      Alert.alert(
        t("provider_application.alert_incomplete_title"),
        t("provider_application.alert_incomplete_body"),
      );
      return;
    }
    setStep((s) => (s === 4 ? s : ((s + 1) as Step)));
  };

  const goBack = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep((s) => (s === 1 ? s : ((s - 1) as Step)));
  };

  const handleSubmit = async () => {
    if (!category) return;
    const yrs = parseInt(yearsExperience, 10);
    const result = await submit({
      business_name: businessName.trim(),
      category,
      country: country.trim(),
      city: city.trim(),
      description: description.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      years_experience: Number.isFinite(yrs) ? yrs : undefined,
    });
    if (result) {
      setStep(4);
    } else {
      Alert.alert(
        t("provider_application.alert_failed_title"),
        t("provider_application.alert_failed_body"),
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("provider_application.title")}</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>

        {/* Step indicator (hidden on confirmation) */}
        {step !== 4 ? (
          <View style={styles.stepperWrap}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={styles.stepperItem}>
                <View
                  style={[
                    styles.stepperCircle,
                    step >= n ? styles.stepperCircleActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepperCircleText,
                      step >= n ? styles.stepperCircleTextActive : null,
                    ]}
                  >
                    {n}
                  </Text>
                </View>
                {n < 3 ? (
                  <View
                    style={[
                      styles.stepperBar,
                      step > n ? styles.stepperBarActive : null,
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>{t("provider_application.step1_title")}</Text>
              <Text style={styles.stepSubtitle}>
                {t("provider_application.step1_subtitle")}
              </Text>

              <Field
                label={t("provider_application.field_business_name")}
                required
                value={businessName}
                onChangeText={setBusinessName}
                placeholder={t("provider_application.placeholder_business_name")}
              />

              <Text style={styles.fieldLabel}>
                {t("provider_application.field_category")}
                <Text style={styles.req}> *</Text>
              </Text>
              <View style={styles.chipWrap}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, category === c && styles.chipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                      {t(`provider_category.${c}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t("provider_application.field_country")}
                    required
                    value={country}
                    onChangeText={setCountry}
                    placeholder={t("provider_application.placeholder_country")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t("provider_application.field_city")}
                    required
                    value={city}
                    onChangeText={setCity}
                    placeholder={t("provider_application.placeholder_city")}
                  />
                </View>
              </View>

              <Field
                label={t("provider_application.field_phone")}
                value={phone}
                onChangeText={setPhone}
                placeholder={t("provider_application.placeholder_phone")}
                keyboardType="phone-pad"
              />
              <Field
                label={t("provider_application.field_email")}
                value={email}
                onChangeText={setEmail}
                placeholder={t("provider_application.placeholder_email")}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label={t("provider_application.field_years")}
                value={yearsExperience}
                onChangeText={setYearsExperience}
                placeholder={t("provider_application.placeholder_years")}
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>{t("provider_application.field_description")}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder={t("provider_application.placeholder_description")}
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>{t("provider_application.step2_title")}</Text>
              <Text style={styles.stepSubtitle}>
                {t("provider_application.step2_subtitle")}
              </Text>

              <View style={styles.verificationOption}>
                <View style={styles.verificationLeft}>
                  <View style={styles.verificationBadge}>
                    <Ionicons name="people-outline" size={20} color="#00C6AE" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verificationTitle}>
                      {t("provider_application.verif_elder_title")}
                    </Text>
                    <Text style={styles.verificationDesc}>
                      {t("provider_application.verif_elder_desc")}
                    </Text>
                  </View>
                </View>
                <View style={styles.verificationSelected}>
                  <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                </View>
              </View>

              <View style={[styles.verificationOption, styles.verificationDisabled]}>
                <View style={styles.verificationLeft}>
                  <View style={[styles.verificationBadge, { backgroundColor: "#F3F4F6" }]}>
                    <Ionicons name="document-text-outline" size={20} color="#9CA3AF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.verificationTitle, { color: "#9CA3AF" }]}>
                      {t("provider_application.verif_docs_title")}
                    </Text>
                    <Text style={styles.verificationDesc}>
                      {t("provider_application.verif_phase_pending")}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.verificationOption, styles.verificationDisabled]}>
                <View style={styles.verificationLeft}>
                  <View style={[styles.verificationBadge, { backgroundColor: "#F3F4F6" }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#9CA3AF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.verificationTitle, { color: "#9CA3AF" }]}>
                      {t("provider_application.verif_premium_title")}
                    </Text>
                    <Text style={styles.verificationDesc}>
                      {t("provider_application.verif_phase_pending")}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>{t("provider_application.step3_title")}</Text>
              <Text style={styles.stepSubtitle}>
                {t("provider_application.step3_subtitle")}
              </Text>

              <SummaryRow label={t("provider_application.field_business_name")} value={businessName} />
              <SummaryRow
                label={t("provider_application.field_category")}
                value={category ? t(`provider_category.${category}`) : "—"}
              />
              <SummaryRow
                label={t("provider_application.field_country")}
                value={`${city}, ${country}`.replace(/^, |, $/g, "")}
              />
              {phone ? <SummaryRow label={t("provider_application.field_phone")} value={phone} /> : null}
              {email ? <SummaryRow label={t("provider_application.field_email")} value={email} /> : null}
              {yearsExperience ? (
                <SummaryRow label={t("provider_application.field_years")} value={yearsExperience} />
              ) : null}
              <SummaryRow
                label={t("provider_application.field_verification")}
                value={t("provider_application.verif_elder_title")}
              />
            </View>
          )}

          {step === 4 && (
            <View style={styles.card}>
              <View style={styles.confirmEmoji}>
                <Text style={{ fontSize: 48 }}>🎉</Text>
              </View>
              <Text style={styles.confirmTitle}>
                {t("provider_application.confirm_title")}
              </Text>
              <Text style={styles.confirmBody}>
                {t("provider_application.confirm_body")}
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { marginTop: 18 }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.btnPrimaryText}>
                  {t("provider_application.confirm_done")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {step !== 4 ? (
          <View style={styles.bottomBar}>
            {step > 1 ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { flex: 1, marginRight: 8 }]}
                onPress={goBack}
                disabled={submitting}
              >
                <Text style={styles.btnSecondaryText}>
                  {t("provider_application.btn_back")}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
              onPress={step === 3 ? handleSubmit : goNext}
              disabled={submitting || (step === 1 && !step1Valid)}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {step === 3
                    ? t("provider_application.btn_submit")
                    : t("provider_application.btn_next")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  required,
  ...inputProps
}: {
  label: string;
  required?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#9CA3AF"
        {...inputProps}
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  stepperItem: { flexDirection: "row", alignItems: "center" },
  stepperCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperCircleActive: { backgroundColor: "#00C6AE" },
  stepperCircleText: { color: "#0A2342", fontSize: 12, fontWeight: "700" },
  stepperCircleTextActive: { color: "#FFFFFF" },
  stepperBar: { width: 32, height: 2, backgroundColor: "#E5E7EB", marginHorizontal: 4 },
  stepperBarActive: { backgroundColor: "#00C6AE" },

  scrollContent: { padding: 16, paddingBottom: 96 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stepTitle: { fontSize: 17, fontWeight: "800", color: "#0A2342" },
  stepSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 16 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#0A2342", marginBottom: 6 },
  req: { color: "#EF4444" },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0A2342",
    backgroundColor: "#FFFFFF",
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },

  row2: { flexDirection: "row", gap: 10 },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  chipTextActive: { color: "#FFFFFF" },

  verificationOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  verificationDisabled: { opacity: 0.55 },
  verificationLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  verificationBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  verificationTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  verificationDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  verificationSelected: { paddingLeft: 8 },

  summaryRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  summaryLabel: { flex: 1, fontSize: 13, color: "#6B7280" },
  summaryValue: { flex: 2, fontSize: 13, fontWeight: "600", color: "#0A2342" },

  confirmEmoji: { alignItems: "center", marginTop: 12 },
  confirmTitle: { fontSize: 18, fontWeight: "800", color: "#0A2342", textAlign: "center", marginTop: 12 },
  confirmBody: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  bottomBar: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  btnSecondary: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  btnSecondaryText: { color: "#0A2342", fontSize: 14, fontWeight: "700" },
});
