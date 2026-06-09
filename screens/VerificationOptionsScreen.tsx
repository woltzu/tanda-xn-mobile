// ══════════════════════════════════════════════════════════════════════════════
// screens/VerificationOptionsScreen.tsx — Interest-First ID picker
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: none.
//
// Reached from UnlockInterestPromptScreen in the new Interest-First
// flow (KYC-2.2). The header carries a single motivation line —
// "Unlock your interest — it's easy and required by law." — rather
// than the prior payout-preview card, since verification is now
// positioned as "claim the interest you've earned" rather than
// "unlock a specific circle payout."
//
// User picks one of four ID paths:
//   - ssn          → TaxIDEntry
//   - itin         → TaxIDEntry
//   - no-itin      → ITINEducation (we'll help)
//   - international→ InternationalVerification
//
// Originally translated from KYC screens/01_VerificationOptions.jsx;
// adapted to the Interest-First flow per KYC_FLOW_GUIDE.md.
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

import { useTranslation } from "react-i18next";
const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type OptionId = "ssn" | "itin" | "no-itin" | "international";

type Option = {
  id: OptionId;
  icon: string;
  title: string;
  desc: string;
  tag: string | null;
};

const OPTIONS: Option[] = [
  {
    id: "ssn",
    icon: "🇺🇸",
    title: "I have a Social Security Number",
    desc: "US citizens and authorized workers",
    tag: null,
  },
  {
    id: "itin",
    icon: "📋",
    title: "I have an ITIN",
    desc: "Individual Taxpayer Identification Number",
    tag: null,
  },
  {
    id: "no-itin",
    icon: "🆕",
    title: "I don't have SSN or ITIN yet",
    desc: "We'll help you get an ITIN - it's easy!",
    tag: "We'll help",
  },
  {
    id: "international",
    icon: "🌍",
    title: "I'm outside the United States",
    desc: "Use your country's tax ID or passport",
    tag: null,
  },
];

export default function VerificationOptionsScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<OptionId | null>(null);

  const handleContinue = () => {
    if (!selectedOption) return;
    switch (selectedOption) {
      case "ssn":
      case "itin":
        navigation.navigate(Routes.TaxIDEntry);
        break;
      case "no-itin":
        navigation.navigate(Routes.ITINEducation);
        break;
      case "international":
        navigation.navigate(Routes.InternationalVerification);
        break;
    }
  };

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
            <Text style={styles.headerTitle}>{t("screen_headers.verification_options")}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Interest-First motivation line (KYC-2.2). Replaces the
              prior payout-preview card since the new flow positions
              verification as "claim the interest you already earned"
              rather than "unlock a circle payout." */}
          <Text style={styles.headerMotivation}>
            Unlock your interest — it's easy and required by law.
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.contentWrap}>
          {/* Welcoming message card */}
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeText}>
              <Text style={styles.welcomeStrong}>{t("final_polish.verificationoptions_we_welcome_everyone")}</Text>{" "}
              Choose the option that fits your situation — we accept many forms
              of identification.
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {OPTIONS.map((option) => {
              const isSelected = selectedOption === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                  onPress={() => setSelectedOption(option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.title}
                >
                  <View style={styles.optionIconBox}>
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionDesc}>{option.desc}</Text>
                  </View>
                  {option.tag && (
                    <View style={styles.optionTag}>
                      <Text style={styles.optionTagText}>{option.tag}</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.selectionDot,
                      isSelected && styles.selectionDotSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Privacy & safety note */}
          <View style={styles.privacyCard}>
            <Ionicons
              name="shield-checkmark"
              size={18}
              color="#00897B"
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>{t("final_polish.verificationoptions_your_privacy_is_protected")}</Text>
              <Text style={styles.privacyBody}>
                We only use your information for tax reporting as required by
                law. We never share data with immigration authorities.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedOption && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedOption}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedOption }}
          accessibilityLabel="Continue"
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedOption && styles.continueButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
        </TouchableOpacity>
        <Text style={styles.helpText}>
          Need help?{" "}
          <Text style={styles.helpLink}>{t("final_polish.verificationoptions_chat_with_us")}</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: {
    paddingTop: 20,
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
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
  headerMotivation: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    lineHeight: 20,
  },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  welcomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 15,
    color: NAVY,
    lineHeight: 24,
    textAlign: "center",
  },
  welcomeStrong: { fontWeight: "700" },

  optionsList: {
    gap: 12,
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    position: "relative",
  },
  optionCardSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    // Offset padding to compensate for 1px → 2px border so cards don't shift
    margin: -1,
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionIcon: { fontSize: 24 },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  optionDesc: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
  },
  optionTag: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: TEAL,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  selectionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectionDotSelected: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },

  privacyCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
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
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  continueButtonTextDisabled: { color: "#9CA3AF" },
  helpText: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    marginTop: 12,
  },
  helpLink: {
    color: TEAL,
    fontWeight: "600",
  },
});
