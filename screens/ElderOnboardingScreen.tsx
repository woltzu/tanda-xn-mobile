// ══════════════════════════════════════════════════════════════════════════════
// screens/ElderOnboardingScreen.tsx — Conflict P1 merged elder funnel
// ══════════════════════════════════════════════════════════════════════════════
//
// Replaces `BecomeElderScreen` (751 LoC, apply form) and `ElderTrainingHubScreen`
// (994 LoC, training FAQ + modules). One screen with two sections:
//
//   • Apply — eligibility checklist + benefits + tier ladder + Apply CTA.
//             If already approved, swap the apply CTA for an elder-status card.
//   • FAQ   — accordion of training questions that previously lived inside the
//             training hub. No standalone "modules" — the FAQ is the surface.
//
// Status copy and elder eligibility still flow through `useElder()` per the
// P0 universe-B contract — see docs/architecture/conflict_resolution.md.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useElder } from "../context/ElderContext";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const TEXT = "#111827";
const GREEN = "#10B981";

type SectionKey = "apply" | "faq";

export default function ElderOnboardingScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const {
    isElder,
    elderProfile,
    isLoading,
    getElderRequirements,
    checkEligibility,
    applyToBecomeElder,
  } = useElder();

  const [section, setSection] = useState<SectionKey>("apply");
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const requirements = getElderRequirements();
  const eligible = checkEligibility();
  const metCount = requirements.filter((r) => r.met).length;
  const alreadyApproved = isElder && elderProfile?.status === "approved";
  const pendingApplication = elderProfile?.status === "pending";

  const handleApply = async () => {
    if (!eligible) {
      Alert.alert(
        t("elder_onboarding.alert_not_eligible_title"),
        t("elder_onboarding.alert_not_eligible_body"),
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await applyToBecomeElder();
      Alert.alert(
        result.success
          ? t("elder_onboarding.alert_submitted_title")
          : t("elder_onboarding.alert_failed_title"),
        result.message,
        [
          {
            text: t("elder_onboarding.alert_ok"),
            onPress: () =>
              result.success ? navigation.goBack() : undefined,
          },
        ],
      );
    } catch {
      Alert.alert(
        t("elder_onboarding.alert_error_title"),
        t("elder_onboarding.alert_error_body"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    "responsibilities",
    "case_load",
    "training_path",
    "earnings",
    "removal",
    "appeals",
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[NAVY, "#143654"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("elder_onboarding.back")}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("elder_onboarding.header_title")}
        </Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Section pill switcher */}
      <View style={styles.tabsBar}>
        <SectionPill
          label={t("elder_onboarding.section_apply")}
          active={section === "apply"}
          onPress={() => setSection("apply")}
        />
        <SectionPill
          label={t("elder_onboarding.section_faq")}
          active={section === "faq"}
          onPress={() => setSection("faq")}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {section === "apply" ? (
          <>
            {/* Status card */}
            {alreadyApproved ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusEmoji}>
                  {elderProfile?.tier === "Grand"
                    ? "🌳"
                    : elderProfile?.tier === "Senior"
                    ? "🌿"
                    : "🌱"}
                </Text>
                <Text style={styles.statusTitle}>
                  {t("elder_onboarding.status_approved_title", {
                    tier: elderProfile?.tier ?? "",
                  })}
                </Text>
                <View style={styles.statusStats}>
                  <Stat
                    value={elderProfile?.totalCasesResolved ?? 0}
                    label={t("elder_onboarding.stat_cases")}
                  />
                  <Stat
                    value={`${elderProfile?.successRate ?? 0}%`}
                    label={t("elder_onboarding.stat_success")}
                  />
                  <Stat
                    value={elderProfile?.trainingCredits ?? 0}
                    label={t("elder_onboarding.stat_credits")}
                  />
                </View>
              </View>
            ) : pendingApplication ? (
              <View style={styles.pendingCard}>
                <Ionicons name="time-outline" size={20} color={NAVY} />
                <Text style={styles.pendingTitle}>
                  {t("elder_onboarding.status_pending_title")}
                </Text>
                <Text style={styles.pendingBody}>
                  {t("elder_onboarding.status_pending_body")}
                </Text>
              </View>
            ) : (
              <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>
                  {t("elder_onboarding.hero_title")}
                </Text>
                <Text style={styles.heroBody}>
                  {t("elder_onboarding.hero_body")}
                </Text>
              </View>
            )}

            {/* Eligibility checklist */}
            {!alreadyApproved ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {t("elder_onboarding.requirements_title")}
                  </Text>
                  <Text style={styles.cardCount}>
                    {t("elder_onboarding.requirements_count", {
                      met: metCount,
                      total: requirements.length,
                    })}
                  </Text>
                </View>
                {requirements.map((req) => (
                  <View key={req.id} style={styles.reqRow}>
                    <Ionicons
                      name={
                        req.met
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={18}
                      color={req.met ? GREEN : MUTED}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqLabel}>{req.label}</Text>
                      <Text style={styles.reqMeta}>
                        {t("elder_onboarding.req_current", {
                          current: String(req.current),
                          required: String(req.required),
                        })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Benefits */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {t("elder_onboarding.benefits_title")}
              </Text>
              <BenefitRow
                icon="shield-checkmark"
                label={t("elder_onboarding.benefit_mediate_title")}
                body={t("elder_onboarding.benefit_mediate_body")}
              />
              <BenefitRow
                icon="star"
                label={t("elder_onboarding.benefit_honor_title")}
                body={t("elder_onboarding.benefit_honor_body")}
              />
              <BenefitRow
                icon="cash"
                label={t("elder_onboarding.benefit_reward_title")}
                body={t("elder_onboarding.benefit_reward_body")}
              />
              <BenefitRow
                icon="ribbon"
                label={t("elder_onboarding.benefit_badge_title")}
                body={t("elder_onboarding.benefit_badge_body")}
              />
            </View>

            {/* Tier ladder */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {t("elder_onboarding.tiers_title")}
              </Text>
              <TierRow
                emoji="🌱"
                title={t("elder_onboarding.tier_junior")}
                meta={t("elder_onboarding.tier_junior_meta")}
                isCurrent={elderProfile?.tier === "Junior"}
              />
              <TierRow
                emoji="🌿"
                title={t("elder_onboarding.tier_senior")}
                meta={t("elder_onboarding.tier_senior_meta")}
                isCurrent={elderProfile?.tier === "Senior"}
              />
              <TierRow
                emoji="🌳"
                title={t("elder_onboarding.tier_grand")}
                meta={t("elder_onboarding.tier_grand_meta")}
                isCurrent={elderProfile?.tier === "Grand"}
              />
            </View>

            {/* Apply CTA */}
            {!alreadyApproved && !pendingApplication ? (
              <TouchableOpacity
                style={[
                  styles.applyBtn,
                  !eligible && styles.applyBtnDisabled,
                ]}
                onPress={handleApply}
                disabled={submitting || isLoading}
                accessibilityRole="button"
                accessibilityLabel={t(
                  "elder_onboarding.apply_btn",
                )}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.applyBtnText}>
                    {eligible
                      ? t("elder_onboarding.apply_btn")
                      : t("elder_onboarding.apply_btn_disabled")}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            {/* FAQ accordion */}
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>
                {t("elder_onboarding.faq_intro_title")}
              </Text>
              <Text style={styles.heroBody}>
                {t("elder_onboarding.faq_intro_body")}
              </Text>
            </View>
            {faqs.map((key) => {
              const isOpen = expandedFaq === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.faqRow}
                  onPress={() => setExpandedFaq(isOpen ? null : key)}
                  accessibilityRole="button"
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQ}>
                      {t(`elder_onboarding.faq_${key}_q`)}
                    </Text>
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={MUTED}
                    />
                  </View>
                  {isOpen ? (
                    <Text style={styles.faqA}>
                      {t(`elder_onboarding.faq_${key}_a`)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function SectionPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BenefitRow({
  icon,
  label,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  body: string;
}) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon} size={16} color={TEAL} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitLabel}>{label}</Text>
        <Text style={styles.benefitBody}>{body}</Text>
      </View>
    </View>
  );
}

function TierRow({
  emoji,
  title,
  meta,
  isCurrent,
}: {
  emoji: string;
  title: string;
  meta: string;
  isCurrent?: boolean;
}) {
  return (
    <View
      style={[
        styles.tierRow,
        isCurrent && styles.tierRowCurrent,
      ]}
    >
      <Text style={styles.tierEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.tierTitle}>{title}</Text>
        <Text style={styles.tierMeta}>{meta}</Text>
      </View>
      {isCurrent ? (
        <Ionicons name="checkmark-circle" size={18} color={TEAL} />
      ) : null}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  tabsBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  tabActive: { backgroundColor: NAVY },
  tabText: { fontSize: 13, fontWeight: "700", color: MUTED },
  tabTextActive: { color: "#FFFFFF" },

  content: { padding: 16, paddingBottom: 32 },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  heroTitle: { fontSize: 16, fontWeight: "700", color: TEXT, marginBottom: 6 },
  heroBody: { fontSize: 13, color: MUTED, lineHeight: 19 },

  statusCard: {
    backgroundColor: NAVY,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
  },
  statusEmoji: { fontSize: 36, marginBottom: 8 },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  statusStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  stat: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 18, fontWeight: "800", color: TEAL },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  pendingCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
    marginBottom: 14,
    alignItems: "center",
    gap: 6,
  },
  pendingTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  pendingBody: { fontSize: 12, color: MUTED, textAlign: "center" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: TEXT, marginBottom: 8, letterSpacing: 0.3, textTransform: "uppercase" },
  cardCount: { fontSize: 11, fontWeight: "700", color: TEAL },

  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  reqLabel: { fontSize: 13, fontWeight: "600", color: TEXT },
  reqMeta: { fontSize: 11, color: MUTED, marginTop: 2 },

  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitLabel: { fontSize: 13, fontWeight: "700", color: TEXT },
  benefitBody: { fontSize: 12, color: MUTED, marginTop: 2 },

  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  tierRowCurrent: { backgroundColor: "#F0FDFB" },
  tierEmoji: { fontSize: 22 },
  tierTitle: { fontSize: 13, fontWeight: "700", color: TEXT },
  tierMeta: { fontSize: 11, color: MUTED, marginTop: 2 },

  applyBtn: {
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  applyBtnDisabled: { backgroundColor: "#9CA3AF" },
  applyBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  faqRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  faqQ: { flex: 1, fontSize: 13, fontWeight: "700", color: TEXT },
  faqA: { fontSize: 13, color: MUTED, lineHeight: 19, marginTop: 8 },
});
