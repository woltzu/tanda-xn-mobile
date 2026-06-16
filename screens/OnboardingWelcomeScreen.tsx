// ══════════════════════════════════════════════════════════════════════════════
// screens/OnboardingWelcomeScreen.tsx — KYC-000 inclusive welcome
// ══════════════════════════════════════════════════════════════════════════════
//
// First screen in the native KYC flow. Translated from the original
// web-React design (KYC screens/00_OnboardingWelcome.jsx). The web
// version used <div>, <button>, CSS strings, and prop callbacks; this
// version uses React Native primitives, StyleSheet, LinearGradient,
// and useTypedNavigation.
//
// Visual design preserved: navy → #143654 gradient hero, decorative
// teal circles, "Tx" logo block, hero copy, flag row, white card with
// 4 highlights, trust badges, two-button footer.
//
// Navigation:
//   - Get Started → VerificationOptions (start KYC flow)
//   - I already have an account → Login (existing auth screen)
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { kycDraft, type KycDraft } from "../lib/kycDraft";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

// i18n: titleKey / descKey carry translation keys instead of literal
// strings. Resolved per-render via t() at the call site.
const HIGHLIGHTS = [
  { icon: "🌍", titleKey: "onboarding_welcome.highlight_diaspora_title", descKey: "onboarding_welcome.highlight_diaspora_desc" },
  { icon: "🤝", titleKey: "onboarding_welcome.highlight_no_ssn_title", descKey: "onboarding_welcome.highlight_no_ssn_desc" },
  { icon: "🔒", titleKey: "onboarding_welcome.highlight_secure_title", descKey: "onboarding_welcome.highlight_secure_desc" },
  { icon: "💚", titleKey: "onboarding_welcome.highlight_inclusive_title", descKey: "onboarding_welcome.highlight_inclusive_desc" },
];

const FLAGS = ["🇸🇳", "🇳🇬", "🇬🇭", "🇨🇲", "🇰🇪", "🇪🇹", "🇿🇦", "🇲🇦"];

const TRUST_BADGES = [
  { icon: "🔐", textKey: "onboarding_welcome.trust_encryption" },
  { icon: "🏦", textKey: "onboarding_welcome.trust_fdic" },
];

export default function OnboardingWelcomeScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();

  // ── KYC draft restore banner ─────────────────────────────────────────────
  // Read once on mount. If a draft exists, surface the yellow banner. The
  // banner is dismissed (locally) on Restore or Discard; data side-effects
  // live in the handlers below. The draft itself is the single source of
  // truth — each input screen also hydrates its fields from kycDraft.get()
  // on mount, so Restore here just navigates to the right screen and lets
  // it pull its slice of the draft.
  const [draft, setDraft] = useState<KycDraft | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasIt = await kycDraft.has();
      if (cancelled) return;
      if (hasIt) {
        const d = await kycDraft.get();
        if (cancelled) return;
        setDraft(d);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resume target inferred from which fields are populated. We do NOT
  // store a step counter — that would break silently if screen order
  // ever changes. The presence of `country` (international path) or
  // `taxIdType` (SSN/ITIN path) tells us which path the user was on.
  const handleRestoreDraft = () => {
    setBannerDismissed(true);
    if (!draft) return;
    if (draft.country != null) {
      navigation.navigate(Routes.InternationalVerification);
    } else if (
      draft.taxIdType ||
      draft.legalName ||
      draft.dateOfBirth
    ) {
      navigation.navigate(Routes.TaxIDEntry);
    } else {
      // Defensive: kycDraft.has() returned true but no recognized fields
      // are populated. Send the user through the unified KYCHub.
      navigation.navigate(Routes.KYCHub);
    }
  };

  const handleDiscardDraft = () => {
    kycDraft.clear();
    setBannerDismissed(true);
    setDraft(null);
  };

  const showBanner = draft != null && !bannerDismissed;
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero gradient */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles */}
          <View style={styles.decorCircleTopRight} />
          <View style={styles.decorCircleBottomLeft} />

          {/* Logo block */}
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>Tx</Text>
          </View>

          <Text style={styles.heroTitle}>{t("onboarding_welcome.hero_title")}</Text>
          <Text style={styles.heroSubtitle}>
            {t("onboarding_welcome.hero_subtitle")}
          </Text>

          {/* Flag row */}
          <View style={styles.flagRow}>
            {FLAGS.map((flag, idx) => (
              <Text key={idx} style={styles.flag}>
                {flag}
              </Text>
            ))}
          </View>
        </LinearGradient>

        {/* Highlights card */}
        <View style={styles.contentWrap}>
          {/* KYC draft restore banner — shown only when a draft exists. */}
          {showBanner && (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>
                {t("onboarding_welcome.draft_banner")}
              </Text>
              <View style={styles.draftBannerActions}>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleRestoreDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>{t("onboarding_welcome.draft_restore")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleDiscardDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>{t("onboarding_welcome.draft_discard")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.highlightsCard}>
            {HIGHLIGHTS.map((item, idx) => (
              <View
                key={idx}
                style={[styles.highlightRow, idx > 0 && styles.highlightRowGap]}
              >
                <View style={styles.highlightIconBox}>
                  <Text style={styles.highlightIconText}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightTitle}>{t(item.titleKey)}</Text>
                  <Text style={styles.highlightDesc}>{t(item.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Trust badges */}
          <View style={styles.trustBadges}>
            {TRUST_BADGES.map((badge, idx) => (
              <View key={idx} style={styles.trustBadge}>
                <Text style={styles.trustBadgeIcon}>{badge.icon}</Text>
                <Text style={styles.trustBadgeText}>{t(badge.textKey)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar — pinned outside scroll */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          // KYC deferred — drop the user straight into the app. The Home
          // soft-banner reminds them to verify before any $-action. If they
          // had a partial KYC draft, handleRestoreDraft is still surfaced
          // earlier in the screen as an inline banner.
          onPress={() => navigation.reset({ index: 0, routes: [{ name: "MainTabs" as never }] })}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.primaryButtonText}>{t("onboarding_welcome.btn_get_started")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate(Routes.Login)}
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
        >
          <Text style={styles.secondaryButtonText}>{t("onboarding_welcome.btn_have_account")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 20,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  decorCircleTopRight: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(0, 198, 174, 0.1)",
  },
  decorCircleBottomLeft: {
    position: "absolute",
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0, 198, 174, 0.05)",
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 280,
    lineHeight: 24,
    textAlign: "center",
  },
  flagRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  flag: { fontSize: 24, opacity: 0.9 },

  contentWrap: { paddingHorizontal: 20, marginTop: -40 },

  // Draft restore banner — mirrors GoalCreateScreen for visual consistency.
  draftBanner: {
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  draftBannerText: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    fontWeight: "500",
  },
  draftBannerActions: { flexDirection: "row", alignItems: "center" },
  draftBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginLeft: 8,
  },
  draftBannerButtonText: { color: "#D97706", fontWeight: "600", fontSize: 13 },

  highlightsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  highlightRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  highlightRowGap: { marginTop: 16 },
  highlightIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  highlightIconText: { fontSize: 24 },
  highlightTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  highlightDesc: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },

  trustBadges: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 24,
  },
  trustBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  trustBadgeIcon: { fontSize: 14 },
  trustBadgeText: { fontSize: 11, color: MUTED },

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
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: MUTED,
  },
});
