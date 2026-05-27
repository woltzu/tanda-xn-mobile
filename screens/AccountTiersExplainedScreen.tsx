// ══════════════════════════════════════════════════════════════════════════════
// screens/AccountTiersExplainedScreen.tsx — KYC-006 tier comparison
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params (optional): { tier?: 1 | 2 | 3 }
//   defaults to 1 ("Basic" — email + phone only). Phase KYC-2 will
//   read the real tier from the user_verification table via context.
//
// Shows three tier cards (Basic / Verified / Full Access), each with
// a feature list rendered as included (✓) or locked-out (✗). The
// current tier card gets a "CURRENT" badge, completed (lower) tiers
// get a "COMPLETE" badge with a green check, and the *next* tier card
// surfaces an Upgrade button that routes per spec:
//
//   - Upgrade to Tier 2 (Verified)    → IDVerificationStart
//   - Upgrade to Tier 3 (Full Access) → TaxIDEntry
//
// Bottom Continue → VerificationHub (which becomes the hub page once
// the user is mid-flow). Label changes to "Done" when already tier 3.
//
// Translated from KYC screens/06_AccountTiersExplained.jsx.
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
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const GREEN = "#059669";

type TierLevel = 1 | 2 | 3;

type Tier = {
  level: TierLevel;
  name: string;
  icon: string;
  requirement: string;
  color: string;
  features: { text: string; included: boolean }[];
};

const TIERS: Tier[] = [
  {
    level: 1,
    name: "Basic",
    icon: "🌱",
    requirement: "Email & Phone",
    color: MUTED,
    features: [
      { text: "Join savings circles", included: true },
      { text: "Contribute to circles", included: true },
      { text: "Track your progress", included: true },
      { text: "Chat with circle members", included: true },
      { text: "Receive payouts up to $600/year", included: false },
      { text: "Earn interest on savings", included: false },
      { text: "Send money internationally", included: false },
    ],
  },
  {
    level: 2,
    name: "Verified",
    icon: "✨",
    requirement: "Any Valid ID",
    color: "#3B82F6",
    features: [
      { text: "Everything in Basic", included: true },
      { text: "Receive payouts up to $600/year", included: true },
      { text: "Create your own circles", included: true },
      { text: "Become an Elder", included: true },
      { text: "Receive unlimited payouts", included: false },
      { text: "Earn interest on savings", included: false },
    ],
  },
  {
    level: 3,
    name: "Full Access",
    icon: "🏆",
    requirement: "Tax ID (SSN or ITIN)",
    color: TEAL,
    features: [
      { text: "Everything in Verified", included: true },
      { text: "Receive unlimited payouts", included: true },
      { text: "Earn interest on savings", included: true },
      { text: "Send money internationally", included: true },
      { text: "Access to TandaXn Credit", included: true },
      { text: "Priority support", included: true },
    ],
  },
];

type AccountTiersParams = { tier?: TierLevel };
type AccountTiersRouteProp = RouteProp<
  { AccountTiersExplained: AccountTiersParams },
  "AccountTiersExplained"
>;

export default function AccountTiersExplainedScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<AccountTiersRouteProp>();
  const currentTier = route.params?.tier ?? 1;
  const currentTierData = TIERS[currentTier - 1];

  const handleUpgrade = (targetLevel: TierLevel) => {
    if (targetLevel === 2) {
      navigation.navigate(Routes.IDVerificationStart);
    } else if (targetLevel === 3) {
      navigation.navigate(Routes.TaxIDEntry);
    }
  };

  const handleContinue = () => {
    navigation.navigate(Routes.VerificationHub);
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
            <Text style={styles.headerTitle}>Account Levels</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={styles.headerSubtitle}>
            Unlock more features as you verify
          </Text>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Current level badge */}
          <View style={styles.currentLevelCard}>
            <View
              style={[
                styles.currentLevelIcon,
                { backgroundColor: currentTierData.color },
              ]}
            >
              <Text style={styles.currentLevelEmoji}>
                {currentTierData.icon}
              </Text>
            </View>
            <View>
              <Text style={styles.currentLevelLabel}>Your current level</Text>
              <Text style={styles.currentLevelName}>
                Tier {currentTier}: {currentTierData.name}
              </Text>
            </View>
          </View>

          {/* Tier cards */}
          <View style={styles.tiersList}>
            {TIERS.map((tier) => {
              const isCurrent = tier.level === currentTier;
              const isLocked = tier.level > currentTier;
              const isCompleted = tier.level < currentTier;
              const isNext = tier.level === currentTier + 1;

              return (
                <View
                  key={tier.level}
                  style={[
                    styles.tierCard,
                    isCurrent && {
                      borderWidth: 2,
                      borderColor: tier.color,
                      margin: -1,
                    },
                    isLocked && { opacity: 0.7 },
                  ]}
                >
                  {/* Status badge */}
                  {isCurrent && (
                    <View
                      style={[
                        styles.tierBadge,
                        { backgroundColor: tier.color },
                      ]}
                    >
                      <Text style={styles.tierBadgeText}>CURRENT</Text>
                    </View>
                  )}
                  {isCompleted && (
                    <View
                      style={[styles.tierBadge, { backgroundColor: GREEN }]}
                    >
                      <Text style={styles.tierBadgeText}>✓ COMPLETE</Text>
                    </View>
                  )}

                  {/* Tier header */}
                  <View style={styles.tierHeader}>
                    <View
                      style={[
                        styles.tierIconBox,
                        {
                          backgroundColor: isLocked
                            ? "#F5F7FA"
                            : `${tier.color}20`,
                        },
                      ]}
                    >
                      <Text style={styles.tierIcon}>
                        {isLocked ? "🔒" : tier.icon}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierName}>
                        Tier {tier.level}: {tier.name}
                      </Text>
                      <Text style={styles.tierRequirement}>
                        Requires: {tier.requirement}
                      </Text>
                    </View>
                  </View>

                  {/* Features */}
                  <View style={styles.featuresList}>
                    {tier.features.map((feature, fIdx) => (
                      <View key={fIdx} style={styles.featureRow}>
                        {feature.included ? (
                          <Ionicons name="checkmark" size={16} color={GREEN} />
                        ) : (
                          <Ionicons
                            name="close-circle-outline"
                            size={16}
                            color="#D1D5DB"
                          />
                        )}
                        <Text
                          style={[
                            styles.featureText,
                            !feature.included && styles.featureTextDisabled,
                          ]}
                        >
                          {feature.text}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Upgrade button for next tier */}
                  {isNext && (
                    <TouchableOpacity
                      style={[styles.upgradeButton, { backgroundColor: tier.color }]}
                      onPress={() => handleUpgrade(tier.level)}
                      accessibilityRole="button"
                      accessibilityLabel={`Upgrade to ${tier.name}`}
                    >
                      <Text style={styles.upgradeButtonText}>
                        Upgrade to {tier.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* ITIN note */}
          <View style={styles.itinCallout}>
            <Text style={styles.itinEmoji}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itinTitle}>
                Don't have a Social Security Number?
              </Text>
              <Text style={styles.itinBody}>
                No problem! You can use an ITIN (Individual Taxpayer ID)
                instead. Anyone can get one, regardless of immigration status.
                We'll help you apply.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel={
            currentTier < 3 ? "Continue to verification" : "Done"
          }
        >
          <Text style={styles.continueButtonText}>
            {currentTier < 3 ? "Continue to Verification" : "Done"}
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
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)" },

  contentWrap: { padding: 20 },

  currentLevelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  currentLevelIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLevelEmoji: { fontSize: 24 },
  currentLevelLabel: { fontSize: 12, color: MUTED },
  currentLevelName: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },

  tiersList: { gap: 16 },

  tierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    position: "relative",
  },
  tierBadge: {
    position: "absolute",
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  tierBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  tierIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tierIcon: { fontSize: 22 },
  tierName: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  tierRequirement: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },

  featuresList: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: {
    fontSize: 13,
    color: "#374151",
    flex: 1,
  },
  featureTextDisabled: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },

  upgradeButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  itinCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  itinEmoji: { fontSize: 18 },
  itinTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E40AF",
  },
  itinBody: {
    fontSize: 12,
    color: "#3B82F6",
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
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
