import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, typography, spacing } from "../theme/tokens";

const ORANGE = "#F97316";
const ORANGE_TINT = "rgba(249,115,22,0.08)";

type ProviderType = "organizer" | "catering" | "photography" | "professional";

const providerTypes: { key: ProviderType; emoji: string; title: string; desc: string }[] = [
  { key: "organizer", emoji: "\u2708\uFE0F", title: "Trip Organizer", desc: "Homeland & leisure group travel" },
  { key: "catering", emoji: "\u{1F372}", title: "Catering", desc: "Food for community events" },
  { key: "photography", emoji: "\u{1F4F8}", title: "Photography", desc: "Events & portraits" },
  { key: "professional", emoji: "\u2696\uFE0F", title: "Professional", desc: "Legal, finance, health" },
];

export default function ProviderProfileSetupScreen() {
  const navigation = useNavigation<any>();
  const [selectedType, setSelectedType] = useState<ProviderType>("organizer");
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [yearsOperating, setYearsOperating] = useState("");
  const [avgGroupSize, setAvgGroupSize] = useState("");

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.primaryNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Profile</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>1/3</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Provider Type */}
        <Text style={styles.sectionLabel}>What best describes your business?</Text>

        <View style={styles.typeGrid}>
          {providerTypes.map((t) => {
            const selected = selectedType === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typeCard,
                  selected && styles.typeCardSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedType(t.key)}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeTitle, selected && { color: ORANGE }]}>
                  {t.title}
                </Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Business / organizer name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your business name"
            placeholderTextColor={colors.textSecondary}
            value={businessName}
            onChangeText={setBusinessName}
          />

          <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Short bio</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Tell the community about your trips..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={bio}
            onChangeText={setBio}
          />

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.inputLabel}>Years operating</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={yearsOperating}
                onChangeText={setYearsOperating}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.inputLabel}>Avg group size</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 20"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={avgGroupSize}
                onChangeText={setAvgGroupSize}
              />
            </View>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ProviderVerification")}
        >
          <Text style={styles.ctaText}>Save Profile {"\u2192"} Verification</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  stepBadge: {
    backgroundColor: colors.navyTintBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stepBadgeText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },

  /* Section Label */
  sectionLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    marginBottom: spacing.md,
  },

  /* Type Grid */
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  typeCard: {
    width: "47.5%" as any,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  typeCardSelected: {
    borderColor: ORANGE,
    backgroundColor: ORANGE_TINT,
  },
  typeEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  typeTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  /* Card */
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  /* Inputs */
  inputLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  rowFields: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  halfField: {
    flex: 1,
  },

  /* CTA */
  ctaButton: {
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
});
