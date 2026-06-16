// ══════════════════════════════════════════════════════════════════════════════
// screens/KYCHubScreen.tsx — KYC P1 unified hub
// ══════════════════════════════════════════════════════════════════════════════
//
// Merges the prior `VerificationHubScreen` (visual layout, mock-data
// driven) and `KYCVerificationScreen` (real engine hooks). One screen
// owns:
//
//   - The tier card with (?) → KYCTiersModal explainer
//   - A progress chip ("Step 1 of 3 — Identity") tied to live status
//   - The Start verification CTA (routes to KYCDocument)
//   - Pending / verified / rejected state summaries
//   - First-visit coach mark (AsyncStorage `@tandaxn_kyc_hub_seen_v1`)
//   - One-shot "Tier 2 reached" celebration banner
//     (AsyncStorage `@tandaxn_kyc_tier2_celebrated_v1`)
//
// Universe A → Universe B consolidation: after P1, all KYC entry points
// land here. The legacy `Routes.VerificationHub` and `Routes.KYCVerification`
// route names redirect to this screen for backward compatibility.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useKYCStatus } from "../hooks/useKYCVerification";
import { useMemberTier } from "../hooks/useGraduatedEntry";
import KYCTiersModal from "../components/KYCTiersModal";
import { colors } from "../theme/tokens";
import { consumeDeferredAction } from "../lib/deferredAction";
import AuthProgressStrip from "../components/AuthProgressStrip";

const COACH_MARK_KEY = "@tandaxn_kyc_hub_seen_v1";
const TIER2_FLAG_KEY = "@tandaxn_kyc_tier2_celebrated_v1";

// Map kycTier → progress-step index for the chip.
function stepForTier(
  isVerified: boolean,
  isPending: boolean,
): { step: 1 | 2 | 3; key: "identity" | "documents" | "review" } {
  if (isVerified) return { step: 3, key: "review" };
  if (isPending) return { step: 3, key: "review" };
  return { step: 1, key: "identity" };
}

export default function KYCHubScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const { user, refreshKyc } = useAuth();

  const kyc = useKYCStatus(user?.id);
  const memberTier = useMemberTier(user?.id);

  const liveTier =
    (memberTier.status?.currentTier as number | undefined) ?? kyc.kycTier ?? 0;

  // ── Coach mark ─────────────────────────────────────────────────────
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachSlide, setCoachSlide] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_MARK_KEY);
        if (!cancelled && seen !== "1") setCoachVisible(true);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissCoach = () => {
    setCoachVisible(false);
    AsyncStorage.setItem(COACH_MARK_KEY, "1").catch(() => {});
  };

  // ── Tier 2 celebration banner (one-shot) ────────────────────────────
  const [tier2Banner, setTier2Banner] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (liveTier < 2) return;
      try {
        const seen = await AsyncStorage.getItem(TIER2_FLAG_KEY);
        if (!cancelled && seen !== "1") setTier2Banner(true);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveTier]);
  const dismissTier2Banner = () => {
    setTier2Banner(false);
    AsyncStorage.setItem(TIER2_FLAG_KEY, "1").catch(() => {});
  };

  // ── Tiers explainer modal ──────────────────────────────────────────
  const [tiersOpen, setTiersOpen] = useState(false);

  // ── Refresh control ────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await kyc.refresh();
    setRefreshing(false);
  }, [kyc]);

  // KYC P2 — auto-route the Start CTA. Reads the user's prior
  // verification row (id_type, tax_id) and profiles.country once on
  // mount, then picks the best default for KYCDocumentScreen:
  //   - existing id_type    → resume with that document type
  //   - profile.country = US → 'national_id' (DL/ID)
  //   - else                  → 'passport' (works internationally)
  const [routingHint, setRoutingHint] = useState<{
    idType: "national_id" | "drivers_license" | "passport";
    hasTaxId: boolean;
  }>({ idType: "national_id", hasTaxId: false });
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { data: ver }] = await Promise.all([
        supabase
          .from("profiles")
          .select("country")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("kyc_verifications")
          .select("id_type, tax_id")
          .eq("member_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const priorType = (ver as { id_type?: string } | null)?.id_type;
      const hasTaxId = !!(ver as { tax_id?: string } | null)?.tax_id;
      const countryUpper = ((prof as { country?: string } | null)?.country ?? "").toUpperCase();
      const isUS = countryUpper === "US" || countryUpper === "USA";
      const next: "national_id" | "drivers_license" | "passport" =
        priorType === "passport" ||
        priorType === "drivers_license" ||
        priorType === "national_id"
          ? (priorType as "national_id" | "drivers_license" | "passport")
          : isUS
          ? "national_id"
          : "passport";
      setRoutingHint({ idType: next, hasTaxId });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleStartVerification = () => {
    navigation.navigate(
      Routes.KYCDocument as never,
      { idType: routingHint.idType } as never,
    );
  };

  // P0 (kyc-trigger review): when verified, project the freshest kyc
  // row onto AuthContext.user.kyc (the screen-level hook's realtime
  // sub already updated `kyc.isVerified` here; we also need to push
  // through to the auth-level summary so future gate checks pass
  // without waiting for the next session-establishment fetch). Then
  // consume any deferred action and navigate the user back to the
  // money screen they were on. The TTL inside the lib drops stale
  // entries, so an old action from days ago won't surprise the user.
  useEffect(() => {
    if (!kyc.isVerified) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshKyc();
      } catch {
        /* best-effort */
      }
      if (cancelled) return;
      const action = await consumeDeferredAction();
      if (cancelled || !action) return;
      Alert.alert(
        t("kyc_gate.toast_resumed"),
        undefined,
        [
          {
            text: t("common.ok"),
            onPress: () =>
              navigation.navigate(
                action.route as never,
                (action.params ?? undefined) as never,
              ),
          },
        ],
        { cancelable: false },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [kyc.isVerified, navigation, refreshKyc, t]);

  const showStartCta = !kyc.isVerified && !kyc.isPending;
  const progress = stepForTier(kyc.isVerified, kyc.isPending);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2342" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Header gradient with tier card ───────────────────────── */}
        <LinearGradient
          colors={["#0A2342", "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() =>
                navigation.canGoBack() ? navigation.goBack() : null
              }
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("kyc_hub.header")}</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.tierCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.tierLabelRow}>
                <Text style={styles.tierLabel}>{t("kyc_hub.tier_label")}</Text>
                <TouchableOpacity
                  onPress={() => setTiersOpen(true)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={t("kyc_hub.tiers_help_a11y")}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color="rgba(255,255,255,0.85)"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.tierValue}>
                {t("kyc_hub.tier_display", {
                  tier: liveTier,
                  label: t(`kyc_hub.tier_${liveTier}_label`, {
                    defaultValue: t("kyc_hub.tier_unknown_label"),
                  }),
                })}
              </Text>
            </View>
            <View style={styles.tierEmojiBox}>
              <Text style={styles.tierEmoji}>
                {liveTier >= 3
                  ? "🏆"
                  : liveTier === 2
                    ? "✨"
                    : liveTier === 1
                      ? "🌱"
                      : "🔒"}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* ── P1 progress strip + estimated-time chip ──────────────
              Replaces the prior single-line "Step N — label" chip with
              the shared 3-step strip used by signup/reset. flow="kyc"
              labels = Identity → Documents → Review. The estimated-
              time chip sits below for new users to set expectation
              before they tap Start. */}
          <AuthProgressStrip step={progress.step} flow="kyc" />
          <View style={styles.estimatedTimeChip}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.estimatedTimeChipText}>
              {t("kyc_hub.estimated_time")}
            </Text>
          </View>

          {/* ── Tier 2 celebration banner (one-shot) ──────────────── */}
          {tier2Banner ? (
            <View style={styles.tier2Banner}>
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.tier2Title}>
                  {t("kyc_hub.tier2_banner_title")}
                </Text>
                <Text style={styles.tier2Body}>
                  {t("kyc_hub.tier2_banner_body")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={dismissTier2Banner}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Loading / error / state cards ─────────────────────── */}
          {kyc.loading && !kyc.verification ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.accentTeal} />
              <Text style={styles.centerStateText}>
                {t("kyc_hub.loading")}
              </Text>
            </View>
          ) : kyc.error ? (
            <View style={styles.errorCard}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={colors.errorText}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>
                  {t("kyc_hub.error_title")}
                </Text>
                <Text style={styles.errorBody}>{kyc.error}</Text>
              </View>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => kyc.refresh()}
                accessibilityRole="button"
              >
                <Text style={styles.retryBtnText}>
                  {t("kyc_hub.retry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : kyc.isVerified ? (
            <View style={styles.verifiedCard}>
              <Ionicons
                name="shield-checkmark"
                size={36}
                color={colors.successText}
              />
              <Text style={styles.verifiedTitle}>
                {t("kyc_hub.verified_title")}
              </Text>
              <Text style={styles.verifiedBody}>
                {t("kyc_hub.verified_body")}
              </Text>
            </View>
          ) : kyc.isPending ? (
            <View style={styles.pendingCard}>
              <ActivityIndicator size="large" color={colors.warningAmber} />
              <Text style={styles.pendingTitle}>
                {t("kyc_hub.pending_title")}
              </Text>
              <Text style={styles.pendingBody}>
                {kyc.needsReview
                  ? t("kyc_hub.pending_review_body")
                  : t("kyc_hub.pending_processing_body")}
              </Text>
            </View>
          ) : (
            // not_started / rejected / expired → CTA
            <>
              {kyc.isRejected ? (
                <View style={styles.rejectedCard}>
                  <Ionicons
                    name="warning"
                    size={18}
                    color={colors.errorText}
                  />
                  <Text style={styles.rejectedText}>
                    {kyc.canRetry
                      ? t("kyc_hub.rejected_retry", {
                          n: kyc.attemptsRemaining,
                        })
                      : t("kyc_hub.rejected_blocked")}
                  </Text>
                </View>
              ) : null}

              {showStartCta && (!kyc.isRejected || kyc.canRetry) ? (
                <TouchableOpacity
                  style={styles.startCta}
                  onPress={handleStartVerification}
                  accessibilityRole="button"
                  accessibilityLabel={t("kyc_hub.start_cta_label")}
                >
                  <View style={styles.startCtaIcon}>
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.startCtaTitle}>
                      {kyc.isRejected
                        ? t("kyc_hub.retry_cta_title")
                        : t("kyc_hub.start_cta_title")}
                    </Text>
                    <Text style={styles.startCtaBody}>
                      {t("kyc_hub.start_cta_body")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {/* Tiers explainer modal */}
      <KYCTiersModal
        visible={tiersOpen}
        currentTier={liveTier}
        onClose={() => setTiersOpen(false)}
      />

      {/* First-visit coach mark */}
      <Modal
        visible={coachVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissCoach}
      >
        <View style={styles.coachBackdrop}>
          <View style={styles.coachCard}>
            <Ionicons
              name={coachSlide === 0 ? "shield-outline" : "scan-outline"}
              size={36}
              color={colors.accentTeal}
              style={{ marginBottom: 14 }}
            />
            <Text style={styles.coachTitle}>
              {t(`kyc_hub.coach_slide${coachSlide + 1}_title`)}
            </Text>
            <Text style={styles.coachBody}>
              {t(`kyc_hub.coach_slide${coachSlide + 1}_body`)}
            </Text>
            <View style={styles.coachDots}>
              <View
                style={[
                  styles.coachDot,
                  coachSlide === 0 && styles.coachDotActive,
                ]}
              />
              <View
                style={[
                  styles.coachDot,
                  coachSlide === 1 && styles.coachDotActive,
                ]}
              />
            </View>
            <View style={styles.coachActions}>
              <TouchableOpacity
                onPress={dismissCoach}
                style={styles.coachSkipBtn}
                accessibilityRole="button"
              >
                <Text style={styles.coachSkipText}>
                  {t("kyc_hub.coach_skip")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (coachSlide === 1) dismissCoach();
                  else setCoachSlide(1);
                }}
                style={styles.coachPrimaryBtn}
                accessibilityRole="button"
              >
                <Text style={styles.coachPrimaryText}>
                  {coachSlide === 1
                    ? t("kyc_hub.coach_got_it")
                    : t("kyc_hub.coach_next")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  tierCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 14,
  },
  tierLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tierLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tierValue: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginTop: 4 },
  tierEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  tierEmoji: { fontSize: 22 },

  contentWrap: { padding: 16, marginTop: -8 },

  progressChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryNavy,
  },

  // P1 (kyc-trigger review): "~3 min" expectation-setter chip below
  // the progress strip. Subtle visual weight — the strip is the
  // primary signal; this is a supporting affordance.
  estimatedTimeChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: -4,
    marginBottom: 14,
  },
  estimatedTimeChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  tier2Banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.accentTeal,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  tier2Title: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  tier2Body: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    marginTop: 2,
  },

  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  centerStateText: { fontSize: 14, color: colors.textSecondary },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.errorText,
  },
  errorBody: {
    fontSize: 12,
    color: colors.errorText,
    marginTop: 2,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.errorText,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.errorText,
  },

  verifiedCard: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    gap: 8,
    marginBottom: 14,
  },
  verifiedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  verifiedBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },

  pendingCard: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    gap: 10,
    marginBottom: 14,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  pendingBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },

  rejectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  rejectedText: {
    flex: 1,
    fontSize: 12,
    color: colors.errorText,
    fontWeight: "600",
  },

  startCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.accentTeal,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  startCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  startCtaTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  startCtaBody: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 2,
  },

  // Coach mark
  coachBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  coachCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  coachTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  coachBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  coachDots: { flexDirection: "row", gap: 6, marginBottom: 18 },
  coachDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  coachDotActive: { backgroundColor: colors.accentTeal, width: 18 },
  coachActions: { flexDirection: "row", gap: 10, width: "100%" },
  coachSkipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.screenBg,
  },
  coachSkipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  coachPrimaryBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.accentTeal,
  },
  coachPrimaryText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
