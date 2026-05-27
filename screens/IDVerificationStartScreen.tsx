// ══════════════════════════════════════════════════════════════════════════════
// screens/IDVerificationStartScreen.tsx — KYC-007 ID type picker (Tier 2)
// ══════════════════════════════════════════════════════════════════════════════
//
// First step of Tier 2 verification — pick which government ID you'll
// use. Same selectable-card pattern as VerificationOptions, but with
// four options and an optional "Popular" tag.
//
// Translated from KYC screens/07_IDVerificationStart.jsx.
//
// On Continue → DocumentUpload with `{ idType, side: 'front' }`. The
// DocumentUpload screen (built in commit 3/4) handles the front/back
// capture flow internally and stamps the per-side result.
//
// Skip → LimitedMode.
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

export type IDDocType =
  | "passport"
  | "national-id"
  | "drivers-license"
  | "residence-permit";

type IDOption = {
  id: IDDocType;
  icon: string;
  title: string;
  desc: string;
  popular: boolean;
};

const ID_TYPES: IDOption[] = [
  {
    id: "passport",
    icon: "🛂",
    title: "Passport",
    desc: "From any country",
    popular: true,
  },
  {
    id: "national-id",
    icon: "🪪",
    title: "National ID Card",
    desc: "Government-issued ID",
    popular: true,
  },
  {
    id: "drivers-license",
    icon: "🚗",
    title: "Driver's License",
    desc: "From any country",
    popular: false,
  },
  {
    id: "residence-permit",
    icon: "📄",
    title: "Residence Permit",
    desc: "Green card, visa, etc.",
    popular: false,
  },
];

const WHAT_YOU_NEED = [
  { icon: "📸", text: "Your ID document (not expired)" },
  { icon: "💡", text: "Good lighting" },
  { icon: "🤳", text: "A quick selfie to match your ID" },
];

export default function IDVerificationStartScreen() {
  const navigation = useTypedNavigation();
  const [selectedID, setSelectedID] = useState<IDDocType | null>(null);

  const handleContinue = () => {
    if (!selectedID) return;
    navigation.navigate(Routes.DocumentUpload, {
      idType: selectedID,
      side: "front",
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
              <Text style={styles.headerTitle}>Verify Your Identity</Text>
              <Text style={styles.headerSubtitle}>Tier 2 Verification</Text>
            </View>
          </View>

          {/* Progress (1/3) */}
          <View style={styles.progressRow}>
            <View style={[styles.progressSeg, styles.progressSegActive]} />
            <View style={styles.progressSeg} />
            <View style={styles.progressSeg} />
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Welcome banner */}
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeEmoji}>🌍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>
                We accept IDs from any country
              </Text>
              <Text style={styles.welcomeBody}>
                No SSN required for this step
              </Text>
            </View>
          </View>

          {/* ID Selection */}
          <Text style={styles.sectionLabel}>What ID will you use?</Text>
          <View style={styles.idList}>
            {ID_TYPES.map((idOption) => {
              const isSelected = selectedID === idOption.id;
              return (
                <TouchableOpacity
                  key={idOption.id}
                  style={[styles.idCard, isSelected && styles.idCardSelected]}
                  onPress={() => setSelectedID(idOption.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={idOption.title}
                >
                  <View style={styles.idIconBox}>
                    <Text style={styles.idIcon}>{idOption.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.idTitle}>{idOption.title}</Text>
                    <Text style={styles.idDesc}>{idOption.desc}</Text>
                  </View>
                  {idOption.popular && (
                    <View style={styles.popularTag}>
                      <Text style={styles.popularTagText}>Popular</Text>
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

          {/* What you'll need */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What you'll need</Text>
            <View style={styles.needsList}>
              {WHAT_YOU_NEED.map((item, idx) => (
                <View key={idx} style={styles.needRow}>
                  <Text style={styles.needIcon}>{item.icon}</Text>
                  <Text style={styles.needText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Privacy note */}
          <View style={styles.privacyCard}>
            <Ionicons
              name="shield-outline"
              size={18}
              color={MUTED}
              style={{ marginTop: 2 }}
            />
            <Text style={styles.privacyText}>
              Your ID is used only for verification. We don't check immigration
              status or share your information with any government agency.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedID && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedID}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedID }}
          accessibilityLabel="Continue"
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedID && styles.continueButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.navigate(Routes.LimitedMode)}
          accessibilityRole="button"
          accessibilityLabel="Verify later"
        >
          <Text style={styles.skipButtonText}>I'll verify later</Text>
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
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  progressRow: { flexDirection: "row", gap: 8 },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressSegActive: { backgroundColor: TEAL },

  contentWrap: { padding: 20 },

  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
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

  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  idList: { gap: 10, marginBottom: 20 },
  idCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    position: "relative",
  },
  idCardSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  idIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  idIcon: { fontSize: 24 },
  idTitle: { fontSize: 15, fontWeight: "600", color: NAVY },
  idDesc: { fontSize: 12, color: MUTED, marginTop: 2 },
  popularTag: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularTagText: {
    color: "#4338CA",
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
  },
  selectionDotSelected: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
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
  needsList: { gap: 10 },
  needRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  needIcon: { fontSize: 18 },
  needText: { fontSize: 13, color: MUTED },

  privacyCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: MUTED,
    lineHeight: 18,
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
    marginBottom: 10,
  },
  continueButtonDisabled: { backgroundColor: BORDER },
  continueButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  continueButtonTextDisabled: { color: "#9CA3AF" },
  skipButton: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: MUTED,
  },
});
