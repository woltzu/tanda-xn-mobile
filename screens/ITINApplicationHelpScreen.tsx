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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";

const IRS_CAA_URL = "https://www.irs.gov/tin/itin/itin-acceptance-agents";
const IRS_W7_URL = "https://www.irs.gov/forms-pubs/about-form-w-7";

const DOCUMENTS_ACCEPTED = [
  { icon: "🛂", name: "Valid Passport", note: "Most common - standalone document" },
  { icon: "🪪", name: "National ID Card", note: "With photo, name, DOB, expiration" },
  { icon: "🚗", name: "Foreign Driver's License", note: "Must show photo and DOB" },
  { icon: "📄", name: "Birth Certificate", note: "Required for dependents under 18" },
  { icon: "🏥", name: "Medical Records", note: "For dependents under 6" },
  { icon: "🎓", name: "School Records", note: "For dependents under 18" },
];

const FAQS = [
  {
    q: "How long does it take to get an ITIN?",
    a: "Usually 7-11 weeks if you apply by mail. If you use a Certified Acceptance Agent (CAA), it can be faster and you don't have to mail your original documents.",
  },
  {
    q: "Do I need to mail my original passport?",
    a: "If you apply by mail directly to IRS, yes. But if you use a Certified Acceptance Agent, they can verify your documents in person and you keep your passport.",
  },
  {
    q: "How much does it cost?",
    a: "The IRS doesn't charge for ITINs. However, Certified Acceptance Agents may charge $50-$100 for their services. We recommend using a CAA for convenience.",
  },
  {
    q: "Will this affect my immigration status?",
    a: "No. The IRS is legally prohibited from sharing your information with immigration agencies. Getting an ITIN has no effect on your immigration status.",
  },
];

export default function ITINApplicationHelpScreen() {
  const navigation = useTypedNavigation();
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
            <Text style={styles.headerTitle}>Get Your ITIN</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={styles.headerSubtitle}>
            We'll guide you through the process
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.contentWrap}>
          {/* Two options card */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Choose how to apply</Text>

            {/* Option 1: CAA (Recommended) */}
            <View style={styles.optionCAA}>
              <View style={styles.recommendedTag}>
                <Text style={styles.recommendedTagText}>RECOMMENDED</Text>
              </View>
              <View style={styles.optionInner}>
                <View style={[styles.optionIconBox, { backgroundColor: TEAL }]}>
                  <Text style={styles.optionIcon}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>
                    Use a Certified Acceptance Agent
                  </Text>
                  <Text style={styles.optionDesc}>
                    Faster, easier, and you keep your passport. We'll help you
                    find one near you.
                  </Text>
                  <View style={styles.optionBenefits}>
                    <Text style={styles.optionBenefitText}>
                      ✓ Keep documents
                    </Text>
                    <Text style={styles.optionBenefitText}>
                      ✓ Faster processing
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.optionCtaPrimary}
                onPress={() =>
                  navigation.navigate(Routes.WebView, {
                    url: IRS_CAA_URL,
                    title: "Find a Certified Acceptance Agent",
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Find an agent near me"
              >
                <Text style={styles.optionCtaPrimaryText}>
                  Find an Agent Near Me
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
                  <Text style={styles.optionTitle}>Apply by Mail</Text>
                  <Text style={styles.optionDesc}>
                    Fill out Form W-7 and mail it with your original documents
                    to the IRS.
                  </Text>
                  <View style={styles.optionBenefits}>
                    <Text style={[styles.optionBenefitText, { color: RED }]}>
                      ⚠ Mail original passport
                    </Text>
                    <Text
                      style={[styles.optionBenefitText, { color: MUTED }]}
                    >
                      7-11 weeks
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.optionCtaSecondary}
                onPress={() =>
                  navigation.navigate(Routes.WebView, {
                    url: IRS_W7_URL,
                    title: "Form W-7",
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Download Form W-7"
              >
                <Text style={styles.optionCtaSecondaryText}>
                  Download Form W-7
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Documents you can use */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Documents you can use</Text>
            <View style={styles.docsList}>
              {DOCUMENTS_ACCEPTED.map((doc, idx) => (
                <View key={idx} style={styles.docRow}>
                  <Text style={styles.docIcon}>{doc.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>{doc.name}</Text>
                    <Text style={styles.docNote}>{doc.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* FAQs */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Common Questions</Text>
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
                      <Text style={styles.faqQuestion}>{faq.q}</Text>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={NAVY}
                      />
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={styles.faqAnswerWrap}>
                        <Text style={styles.faqAnswer}>{faq.a}</Text>
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
              <Text style={styles.helpText}>Need help? Chat with us</Text>
            </View>
            <TouchableOpacity
              style={styles.helpButton}
              accessibilityRole="button"
              accessibilityLabel="Open support chat"
            >
              <Text style={styles.helpButtonText}>Chat</Text>
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
            I'll apply later — continue with limited features
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
