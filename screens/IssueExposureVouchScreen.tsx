// ═══════════════════════════════════════════════════════════════════════════
// screens/IssueExposureVouchScreen.tsx — Phase 2 Bucket A
// ═══════════════════════════════════════════════════════════════════════════
//
// Elder-only form that calls the vouch_member RPC (migration 248) to issue
// a 30-day tier accelerator from exposure_vouches (migration 247). Inputs:
//   • Member UUID (paste from a member detail screen; in Bucket B this will
//     be replaced with a member picker / route param)
//   • Temporary tier (newcomer / established / elder / critical) — matches
//     exposure_vouches.temporary_tier CHECK constraint
//   • Backing amount in cents — elder commits to back the member up to
//     this amount if they default
//
// The RPC handles all validation server-side (elder gate, self-vouch
// block, tier whitelist, soft-expires prior active vouches). Client UI
// only surfaces the form + error messages.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useRoles } from "../hooks/useRoles";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const RED = "#DC2626";
const MUTED = "#6B7280";

const TIER_OPTIONS = ["newcomer", "established", "elder", "critical"] as const;
type TierKey = typeof TIER_OPTIONS[number];

const IssueExposureVouchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isElder, isLoading: roleLoading } = useRoles(user?.id);

  // Route can prefill memberId (when navigated from a member detail surface).
  const [memberId, setMemberId] = useState<string>(
    route.params?.memberId ?? "",
  );
  const [tier, setTier] = useState<TierKey>("established");
  const [backingDollars, setBackingDollars] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const backingDollarsNum = parseFloat(backingDollars) || 0;
  const isValid =
    memberId.trim().length >= 30 && // rough UUID length sanity
    backingDollarsNum > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      setSubmitting(true);
      const { data, error } = await supabase.rpc("vouch_member", {
        p_member_id: memberId.trim(),
        p_temporary_tier: tier,
        p_backing_amount_cents: Math.round(backingDollarsNum * 100),
      });
      if (error) throw new Error(error.message);
      Alert.alert(
        t("role.vouch_success_title"),
        t("role.vouch_success_body"),
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert(t("role.vouch_failed_title"), err?.message ?? t("role.vouch_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t("role.vouch_modal_title_short")}</Text>
      <View style={styles.headerBtn} />
    </View>
  );

  if (roleLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isElder) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        {renderHeader()}
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={36} color={MUTED} />
          <Text style={styles.guardText}>{t("role.elder_only_guard")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t("role.vouch_intro")}</Text>

        <Text style={styles.label}>{t("role.vouch_member_id_label")}</Text>
        <TextInput
          style={styles.input}
          value={memberId}
          onChangeText={setMemberId}
          placeholder={t("role.vouch_member_id_placeholder")}
          placeholderTextColor={MUTED}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t("role.vouch_tier_label")}</Text>
        <View style={styles.tierRow}>
          {TIER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.tierChip,
                tier === opt && styles.tierChipActive,
              ]}
              onPress={() => setTier(opt)}
            >
              <Text
                style={[
                  styles.tierChipText,
                  tier === opt && styles.tierChipTextActive,
                ]}
              >
                {t(`role.${opt}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t("role.vouch_backing_label")}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={[styles.input, styles.amountInput]}
            value={backingDollars}
            onChangeText={setBackingDollars}
            placeholder="500"
            placeholderTextColor={MUTED}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>{t("role.vouch_submit")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default IssueExposureVouchScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: typography.sectionHeader, fontWeight: typography.bold, color: NAVY },
  scroll: { padding: spacing.lg, gap: 12 },
  intro: { fontSize: typography.body, color: NAVY, lineHeight: 20, marginBottom: spacing.sm },
  label: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: NAVY,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: NAVY,
    fontSize: typography.body,
    backgroundColor: "#FFFFFF",
  },
  tierRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tierChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  tierChipActive: { backgroundColor: TEAL, borderColor: TEAL },
  tierChipText: { fontSize: typography.bodySmall, color: NAVY, fontWeight: typography.semibold },
  tierChipTextActive: { color: "#FFFFFF" },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dollarSign: { fontSize: typography.bodyLarge, color: NAVY, fontWeight: typography.bold },
  amountInput: { flex: 1 },
  submitBtn: {
    marginTop: spacing.lg,
    backgroundColor: TEAL,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: "#9CA3AF" },
  submitBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },
  guardText: {
    fontSize: typography.body,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
  },
});
