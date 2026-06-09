// ══════════════════════════════════════════════════════════════════════════════
// screens/ITINEducationScreen.tsx — KYC-002 ITIN explainer
// ══════════════════════════════════════════════════════════════════════════════
//
// Reassuring explanation of what an ITIN is, why anyone can apply
// regardless of immigration status, and the four-step path to getting
// one. Three CTAs:
//
//   - "Help Me Get an ITIN" (primary) → ITINApplicationHelp
//   - "I already have an ITIN"        → TaxIDEntry
//   - "I'll do this later …"          → LimitedMode
//
// Translated from KYC screens/02_ITINEducation.jsx.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

// i18n: textKey/titleKey/descKey resolved per-render via t() at call site.
const BENEFITS = [
  { icon: "✅", textKey: "itin_education.benefit_available" },
  { icon: "🔒", textKey: "itin_education.benefit_irs_no_share" },
  { icon: "📈", textKey: "itin_education.benefit_history" },
  { icon: "💳", textKey: "itin_education.benefit_credit" },
  { icon: "🏠", textKey: "itin_education.benefit_property" },
];

const STEPS = [
  { num: 1, titleKey: "itin_education.step_1_title", descKey: "itin_education.step_1_desc" },
  { num: 2, titleKey: "itin_education.step_2_title", descKey: "itin_education.step_2_desc" },
  { num: 3, titleKey: "itin_education.step_3_title", descKey: "itin_education.step_3_desc" },
  { num: 4, titleKey: "itin_education.step_4_title", descKey: "itin_education.step_4_desc" },
];

export default function ITINEducationScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header gradient */}
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
            <Text style={styles.headerTitle}>{t("itin_education.header")}</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.contentWrap}>
          {/* Hero teal card */}
          <LinearGradient
            colors={[TEAL, "#00A896"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIconBox}>
              <Text style={styles.heroIcon}>📋</Text>
            </View>
            <Text style={styles.heroTitle}>
              {t("itin_education.hero_title")}
            </Text>
            <Text style={styles.heroBody}>
              {t("itin_education.hero_body_prefix")}
              <Text style={styles.heroBodyStrong}>
                {t("itin_education.hero_body_strong")}
              </Text>
              {t("itin_education.hero_body_suffix")}
            </Text>
          </LinearGradient>

          {/* Why get an ITIN? */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("itin_education.section_why")}</Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((item, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{item.icon}</Text>
                  <Text style={styles.benefitText}>{t(item.textKey)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Privacy callout */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyIconBox}>
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>
                {t("itin_education.privacy_title")}
              </Text>
              <Text style={styles.privacyBody}>
                {t("itin_education.privacy_body_prefix")}
                <Text style={styles.privacyBodyStrong}>{t("itin_education.privacy_body_strong")}</Text>
                {t("itin_education.privacy_body_suffix")}
              </Text>
            </View>
          </View>

          {/* Steps */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("itin_education.section_how")}</Text>
            <View style={styles.stepsList}>
              {STEPS.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <View style={styles.stepNumBox}>
                    <Text style={styles.stepNumText}>{step.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{t(step.titleKey)}</Text>
                    <Text style={styles.stepDesc}>{t(step.descKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* I already have an ITIN — secondary button */}
          <TouchableOpacity
            style={styles.haveItinButton}
            onPress={() => navigation.navigate(Routes.TaxIDEntry)}
            accessibilityRole="button"
            accessibilityLabel="I already have an ITIN"
          >
            <Text style={styles.haveItinText}>{t("itin_education.have_itin")}</Text>
            <Ionicons name="arrow-forward" size={16} color={NAVY} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate(Routes.ITINApplicationHelp)}
          accessibilityRole="button"
          accessibilityLabel="Help me get an ITIN"
        >
          <Text style={styles.primaryButtonText}>{t("itin_education.btn_help_get")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.navigate(Routes.LimitedMode)}
          accessibilityRole="button"
          accessibilityLabel="Continue with limited features"
        >
          <Text style={styles.skipButtonText}>
            {t("itin_education.btn_skip")}
          </Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  contentWrap: { padding: 20 },

  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroIcon: { fontSize: 32 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
  },
  heroBodyStrong: { fontWeight: "700" },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 14,
  },

  benefitsList: { gap: 12 },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  benefitIcon: { fontSize: 16 },
  benefitText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
  },

  privacyCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  privacyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
  privacyBody: {
    fontSize: 13,
    color: "#3B82F6",
    lineHeight: 20,
    marginTop: 6,
  },
  privacyBodyStrong: { fontWeight: "700" },

  stepsList: { gap: 12 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNumBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  stepDesc: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },

  haveItinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
  },
  haveItinText: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  skipButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: MUTED,
  },
});
