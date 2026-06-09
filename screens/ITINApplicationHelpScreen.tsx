// ══════════════════════════════════════════════════════════════════════════════
// screens/ITINApplicationHelpScreen.tsx — KYC-003 ITIN application guide
// ══════════════════════════════════════════════════════════════════════════════
//
// Guides users through two ITIN application paths:
//
//   1. Certified Acceptance Agent (recommended)
//      → "Find an Agent Near Me" opens
//        https://www.irs.gov/tin/itin/itin-acceptance-agents in the
//        existing WebView screen.
//   2. Apply by mail
//      → "Download Form W-7" opens
//        https://www.irs.gov/forms-pubs/about-form-w-7 in WebView.
//
// Plus a list of accepted documents and collapsible FAQs, then a
// "Continue with limited features" footer button → LimitedMode.
//
// Translated from KYC screens/03_ITINApplicationHelp.jsx. FAQ
// expand/collapse uses local state; rotation transform on the chevron
// matches the original animation.
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
const RED = "#DC2626";

const IRS_CAA_URL = "https://www.irs.gov/tin/itin/itin-acceptance-agents";
const IRS_W7_URL = "https://www.irs.gov/forms-pubs/about-form-w-7";

// i18n: nameKey/noteKey/qKey/aKey resolved per-render via t() at call site.
const DOCUMENTS_ACCEPTED = [
  { icon: "🛂", nameKey: "itin_application_help.doc_passport_name", noteKey: "itin_application_help.doc_passport_note" },
  { icon: "🪪", nameKey: "itin_application_help.doc_national_name", noteKey: "itin_application_help.doc_national_note" },
  { icon: "🚗", nameKey: "itin_application_help.doc_drivers_name", noteKey: "itin_application_help.doc_drivers_note" },
  { icon: "📄", nameKey: "itin_application_help.doc_birth_name", noteKey: "itin_application_help.doc_birth_note" },
  { icon: "🏥", nameKey: "itin_application_help.doc_medical_name", noteKey: "itin_application_help.doc_medical_note" },
  { icon: "🎓", nameKey: "itin_application_help.doc_school_name", noteKey: "itin_application_help.doc_school_note" },
];

const FAQS = [
  { qKey: "itin_application_help.faq_time_q", aKey: "itin_application_help.faq_time_a" },
  { qKey: "itin_application_help.faq_mail_q", aKey: "itin_application_help.faq_mail_a" },
  { qKey: "itin_application_help.faq_cost_q", aKey: "itin_application_help.faq_cost_a" },
  { qKey: "itin_application_help.faq_immigration_q", aKey: "itin_application_help.faq_immigration_a" },
];

export default function ITINApplicationHelpScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

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
            <Text style={styles.headerTitle}>{t("itin_application_help.header")}</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={styles.headerSubtitle}>
            {t("itin_application_help.header_subtitle")}
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.contentWrap}>
          {/* Two options card */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("itin_application_help.section_apply")}</Text>

            {/* Option 1: CAA (Recommended) */}
            <View style={styles.optionCAA}>
              <View style={styles.recommendedTag}>
                <Text style={styles.recommendedTagText}>{t("itin_application_help.recommended_tag")}</Text>
              </View>
              <View style={styles.optionInner}>
                <View style={[styles.optionIconBox, { backgroundColor: TEAL }]}>
                  <Text style={styles.optionIcon}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>
                    {t("itin_application_help.option_caa_title")}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {t("itin_application_help.option_caa_desc")}
                  </Text>
                  <View style={styles.optionBenefits}>
                    <Text style={styles.optionBenefitText}>
                      {t("itin_application_help.benefit_keep_docs")}
                    </Text>
                    <Text style={styles.optionBenefitText}>
                      {t("itin_application_help.benefit_faster")}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.optionCtaPrimary}
                onPress={() =>
                  navigation.navigate(Routes.WebView, {
                    url: IRS_CAA_URL,
                    title: t("itin_application_help.webview_title_agent"),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Find an agent near me"
              >
                <Text style={styles.optionCtaPrimaryText}>
                  {t("itin_application_help.btn_find_agent")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Option 2: Mail */}
            <View style={styles.optionMail}>
              <View style={styles.optionInner}>
                <View style={[styles.optionIconBox, { backgroundColor: BORDER }]}>
                  <Text style={styles.optionIcon}>📬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{t("itin_application_help.option_mail_title")}</Text>
                  <Text style={styles.optionDesc}>
                    {t("itin_application_help.option_mail_desc")}
                  </Text>
                  <View style={styles.optionBenefits}>
                    <Text style={[styles.optionBenefitText, { color: RED }]}>
                      {t("itin_application_help.mail_warn_passport")}
                    </Text>
                    <Text
                      style={[styles.optionBenefitText, { color: MUTED }]}
                    >
                      {t("itin_application_help.mail_warn_time")}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.optionCtaSecondary}
                onPress={() =>
                  navigation.navigate(Routes.WebView, {
                    url: IRS_W7_URL,
                    title: t("itin_application_help.webview_title_w7"),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Download Form W-7"
              >
                <Text style={styles.optionCtaSecondaryText}>
                  {t("itin_application_help.btn_download_w7")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Documents you can use */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("itin_application_help.section_docs")}</Text>
            <View style={styles.docsList}>
              {DOCUMENTS_ACCEPTED.map((doc, idx) => (
                <View key={idx} style={styles.docRow}>
                  <Text style={styles.docIcon}>{doc.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>{t(doc.nameKey)}</Text>
                    <Text style={styles.docNote}>{t(doc.noteKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* FAQs */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("itin_application_help.section_faqs")}</Text>
            <View style={styles.faqsList}>
              {FAQS.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <View key={idx}>
                    <TouchableOpacity
                      style={[
                        styles.faqHeader,
                        isOpen && styles.faqHeaderOpen,
                      ]}
                      onPress={() =>
                        setExpandedFaq(isOpen ? null : idx)
                      }
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                    >
                      <Text style={styles.faqQuestion}>{t(faq.qKey)}</Text>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={NAVY}
                      />
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={styles.faqAnswerWrap}>
                        <Text style={styles.faqAnswer}>{t(faq.aKey)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Help row */}
          <View style={styles.helpCard}>
            <View style={styles.helpLeft}>
              <Text style={styles.helpEmoji}>💬</Text>
              <Text style={styles.helpText}>{t("itin_application_help.help_chat_text")}</Text>
            </View>
            <TouchableOpacity
              style={styles.helpButton}
              accessibilityRole="button"
              accessibilityLabel="Open support chat"
            >
              <Text style={styles.helpButtonText}>{t("itin_application_help.help_chat_btn")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.continueLaterButton}
          onPress={() => navigation.navigate(Routes.LimitedMode)}
          accessibilityRole="button"
          accessibilityLabel="Continue with limited features"
        >
          <Text style={styles.continueLaterText}>
            {t("itin_application_help.btn_skip")}
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
    marginBottom: 16,
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
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },

  contentWrap: { padding: 20 },

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

  optionCAA: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    position: "relative",
  },
  optionMail: {
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
  },
  recommendedTag: {
    position: "absolute",
    top: -10,
    right: 12,
    backgroundColor: TEAL,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  recommendedTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  optionInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionIcon: { fontSize: 22 },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  optionDesc: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 20,
    marginTop: 6,
  },
  optionBenefits: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
    flexWrap: "wrap",
  },
  optionBenefitText: {
    fontSize: 12,
    color: "#059669",
  },
  optionCtaPrimary: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  optionCtaPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  optionCtaSecondary: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  optionCtaSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },

  docsList: { gap: 10 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  docIcon: { fontSize: 20 },
  docName: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
  docNote: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },

  faqsList: { gap: 8 },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  faqHeaderOpen: {
    backgroundColor: "#F0FDFB",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
  faqAnswerWrap: {
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  faqAnswer: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 22,
  },

  helpCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 14,
  },
  helpLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  helpEmoji: { fontSize: 20 },
  helpText: { fontSize: 13, color: MUTED },
  helpButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: NAVY,
    borderRadius: 8,
  },
  helpButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  continueLaterButton: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  continueLaterText: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED,
  },
});
