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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

const BENEFITS = [
  { icon: "✅", text: "Available to anyone, regardless of immigration status" },
  { icon: "🔒", text: "IRS doesn't share info with immigration authorities" },
  { icon: "📈", text: "Helps you build a financial history in the US" },
  { icon: "💳", text: "Can help you get credit cards and loans" },
  { icon: "🏠", text: "Needed for buying property or starting a business" },
];

const STEPS = [
  { num: 1, title: "Fill out Form W-7", desc: "We'll help you complete it" },
  { num: 2, title: "Gather documents", desc: "Passport or national ID" },
  { num: 3, title: "Submit application", desc: "By mail or through an agent" },
  { num: 4, title: "Receive your ITIN", desc: "Usually 7-11 weeks" },
];

export default function ITINEducationScreen() {
  const navigation = useTypedNavigation();

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
            <Text style={styles.headerTitle}>What is an ITIN?</Text>
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
              Individual Taxpayer Identification Number
            </Text>
            <Text style={styles.heroBody}>
              An ITIN is a tax ID number issued by the IRS. It lets you pay
              taxes and access financial services —{" "}
              <Text style={styles.heroBodyStrong}>
                no matter your immigration status
              </Text>
              .
            </Text>
          </LinearGradient>

          {/* Why get an ITIN? */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Why get an ITIN?</Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((item, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{item.icon}</Text>
                  <Text style={styles.benefitText}>{item.text}</Text>
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
                Your privacy is protected by law
              </Text>
              <Text style={styles.privacyBody}>
                The IRS is{" "}
                <Text style={styles.privacyBodyStrong}>legally prohibited</Text>{" "}
                from sharing your information with immigration agencies
                (Section 6103 of the Internal Revenue Code). Getting an ITIN
                does not affect your immigration status.
              </Text>
            </View>
          </View>

          {/* Steps */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>How to get an ITIN</Text>
            <View style={styles.stepsList}>
              {STEPS.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <View style={styles.stepNumBox}>
                    <Text style={styles.stepNumText}>{step.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
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
            <Text style={styles.haveItinText}>I already have an ITIN</Text>
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
          <Text style={styles.primaryButtonText}>Help Me Get an ITIN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.navigate(Routes.LimitedMode)}
          accessibilityRole="button"
          accessibilityLabel="Continue with limited features"
        >
          <Text style={styles.skipButtonText}>
            I'll do this later — continue with limited features
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
