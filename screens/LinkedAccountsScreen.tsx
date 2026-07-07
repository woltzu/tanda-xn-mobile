import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RootStackParamList } from "../App";
import { usePayment, SavedPaymentMethod } from "../context/PaymentContext";
import { useProfile } from "../hooks/useProfile";
import { showToast } from "../components/Toast";
import MethodActionsSheet from "../components/MethodActionsSheet";

type LinkedAccountsNavigationProp = StackNavigationProp<RootStackParamList>;

const CONNECT_RETURN_URL = "tandaxn://linked-accounts";

// P1.5 (payment-methods review): once-per-user-per-device coach mark
// gate. Bumped suffix forces re-show if we ever rewrite the copy.
const COACH_TIP_KEY = "@tandaxn_linked_accounts_tip_seen_v1";

// P1.2 (payment-methods review): Stripe card brands → FontAwesome
// `cc-*` glyphs. Brands not in this set fall back to the generic
// Ionicons `card` glyph already rendered in PaymentContext.getMethodIcon.
// FontAwesome was the cheapest source of trusted brand marks — they
// ship inside @expo/vector-icons so there's nothing new to install.
const CARD_BRAND_ICONS: Record<string, keyof typeof FontAwesome.glyphMap> = {
  visa: "cc-visa",
  mastercard: "cc-mastercard",
  amex: "cc-amex",
  "american express": "cc-amex",
  discover: "cc-discover",
  diners: "cc-diners-club",
  "diners club": "cc-diners-club",
  jcb: "cc-jcb",
};

// Card brand → ink color when we render the brand glyph. Generic fallback
// uses the existing teal/navy palette of the screen.
const CARD_BRAND_COLORS: Record<string, string> = {
  visa: "#1A1F71",
  mastercard: "#EB001B",
  amex: "#2E77BC",
  "american express": "#2E77BC",
  discover: "#FF6000",
  diners: "#0079BE",
  "diners club": "#0079BE",
  jcb: "#0E4C96",
};

function brandIconFor(brand?: string): {
  name: keyof typeof FontAwesome.glyphMap | null;
  color: string;
} {
  if (!brand) return { name: null, color: "#3B82F6" };
  const key = brand.toLowerCase();
  return {
    name: CARD_BRAND_ICONS[key] ?? null,
    color: CARD_BRAND_COLORS[key] ?? "#3B82F6",
  };
}

// P1.2 (payment-methods review): expiry classifier.
//   "expired"     — month/year already in the past (rendered red).
//   "expires_now" — same calendar month as today (rendered amber).
//   null          — none of the above; no badge.
// Uses Date arithmetic in the local zone — Stripe stores exp_month as
// 1-12, exp_year as four-digit. Months are 1-indexed in our column,
// 0-indexed in JS Date, so be careful.
function classifyExpiry(
  expMonth?: number,
  expYear?: number,
): "expired" | "expires_now" | null {
  if (!expMonth || !expYear) return null;
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1; // 1-12
  if (expYear < nowYear) return "expired";
  if (expYear === nowYear && expMonth < nowMonth) return "expired";
  if (expYear === nowYear && expMonth === nowMonth) return "expires_now";
  return null;
}

// P1.4 — small skeleton row that fades in/out with Animated.loop. Two of
// these render while the initial fetch is in flight and the list is empty.
// We do not pull in shimmer libs — Animated.timing on opacity is enough
// for the "something is loading" signal at P1 scope.
function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={{ flex: 1 }}>
        <View style={[styles.skeletonBar, { width: "60%" }]} />
        <View
          style={[styles.skeletonBar, { width: "35%", marginTop: 6 }]}
        />
      </View>
    </Animated.View>
  );
}

export default function LinkedAccountsScreen() {
  const { t } = useTranslation();

  const navigation = useNavigation<LinkedAccountsNavigationProp>();
  const {
    paymentMethods,
    isLoadingMethods,
    isOnboarded,
    setupConnectedAccount,
    removePaymentMethod,
    setDefaultPaymentMethod,
    refreshPaymentMethods,
    setupCardForLater,
  } = usePayment();

  // P2.5 (payment-methods review): country gate. ACH / Stripe Connect
  // onboarding are US-only — non-US users see card-only.
  const { profile } = useProfile();
  const isUS = (profile?.country ?? "").toUpperCase() === "US";

  const [addingCard, setAddingCard] = useState(false);
  // P1.1: which row's ⋮ sheet is open (null = closed).
  const [openMethod, setOpenMethod] = useState<SavedPaymentMethod | null>(null);
  // P1.4: pull-to-refresh spinner state. Separate from isLoadingMethods so
  // a user-initiated refresh shows the iOS swipe-indicator even when the
  // context refetch is fast.
  const [refreshing, setRefreshing] = useState(false);

  const bankAccounts = paymentMethods.filter((m) => m.type === "us_bank_account");
  const cardAccounts = paymentMethods.filter((m) => m.type !== "us_bank_account");

  useFocusEffect(
    useCallback(() => {
      refreshPaymentMethods();
    }, [refreshPaymentMethods]),
  );

  // P1.5: one-shot coach mark. Fires only when (a) the user has at least
  // one method (otherwise the tip is meaningless — there's no ⋮ to tap)
  // and (b) AsyncStorage doesn't yet record that we've shown it. We set
  // the flag immediately so a second render in the same session doesn't
  // re-toast.
  useEffect(() => {
    if (paymentMethods.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_TIP_KEY);
        if (cancelled || seen === "true") return;
        await AsyncStorage.setItem(COACH_TIP_KEY, "true");
        showToast(t("linked_accounts_v2.coach_tip"), "info");
      } catch {
        // AsyncStorage failure is non-fatal — worst case the tip shows
        // again next launch, which is harmless.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentMethods.length, t]);

  const handleAddBank = async () => {
    try {
      const onboardingUrl = await setupConnectedAccount(CONNECT_RETURN_URL);
      if (!onboardingUrl) {
        // Silent no-op was the source of "Link a Bank does nothing" in
        // E2E — surface a friendly message so the user knows the flow
        // isn't wired for their environment yet (missing Stripe Connect
        // config, EF not deployed, etc.) rather than staring at an
        // unresponsive button.
        Alert.alert(
          t("linked_accounts_v2.alert_error_title"),
          t("linked_accounts_v2.alert_bank_setup_unavailable"),
        );
        return;
      }
      await WebBrowser.openAuthSessionAsync(onboardingUrl, CONNECT_RETURN_URL);
      await refreshPaymentMethods();
    } catch (err: any) {
      // Pull the specific EF error out — PaymentContext now unwraps the
      // response body via extractEfErrorMessage, so `err.message` here
      // is usually the Stripe / auth / DB reason rather than the raw
      // "non-2xx status code".
      const raw = err?.message || '';
      console.warn('[LinkedAccounts] handleAddBank failed:', raw);
      // Detect the historically-most-common failure — Connect not
      // enabled on the Stripe account (see docs/audit/33). That one
      // needs a Stripe Dashboard fix, not a support ticket, so route
      // the copy accordingly.
      const isConnectDisabled = /connect/i.test(raw) && /(sign(ed)?\s*up|dashboard\.stripe\.com\/connect|not enabled)/i.test(raw);
      // Second known failure: create-connect-account created the Stripe
      // account but the stripe_connected_accounts INSERT failed. This
      // usually means schema drift (missing column) or an RLS/permission
      // issue on the service role — either way, an unhelpful message
      // for the user. Route to a friendly copy that tells them to try
      // again + contact support.
      const isPersistFailure = /persist connected account/i.test(raw);
      let body: string;
      if (isConnectDisabled) {
        body = t('linked_accounts_v2.alert_stripe_connect_disabled');
      } else if (isPersistFailure) {
        body = t('linked_accounts_v2.alert_bank_persist_failure');
      } else {
        body = raw || t('linked_accounts_v2.alert_failed_start');
      }
      Alert.alert(t('linked_accounts_v2.alert_error_title'), body);
    }
  };

  const handleAddCard = async () => {
    // [debug create-setup-intent] Temporary trace to confirm the tap
    // reaches this handler and how the guard resolves. Remove once the
    // "EF logs are empty" investigation is closed.
    console.log("[LinkedAccounts] handleAddCard tapped", { addingCard });
    if (addingCard) {
      console.log("[LinkedAccounts] handleAddCard: skipped (addingCard=true)");
      return;
    }
    setAddingCard(true);
    try {
      console.log(
        "[LinkedAccounts] typeof setupCardForLater =",
        typeof setupCardForLater,
      );
      console.log("[LinkedAccounts] calling setupCardForLater()");
      const result = await setupCardForLater();
      console.log("[LinkedAccounts] setupCardForLater returned:", result);
      const { success, error } = result;
      if (success) {
        showToast(t("linked_accounts_v2.toast_card_saved"), "success");
      } else if (error === "Canceled") {
        // Silent cancel — see P0.4 rationale.
      } else {
        showToast(
          error || t("linked_accounts_v2.toast_card_failed"),
          "error",
        );
      }
    } catch (err: any) {
      // [debug create-setup-intent] Explicit catch so a sync/async throw
      // in the call chain doesn't get silently swallowed as an unhandled
      // promise rejection. Remove with the console.log traces once the
      // "EF logs are empty" investigation is closed.
      console.error("[LinkedAccounts] handleAddCard threw:", {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      });
      showToast(
        err?.message || t("linked_accounts_v2.toast_card_failed"),
        "error",
      );
    } finally {
      setAddingCard(false);
    }
  };

  const handleSetPrimary = async (method: SavedPaymentMethod) => {
    try {
      await setDefaultPaymentMethod(method.id);
      showToast(t("linked_accounts_v2.toast_default_set"), "success");
    } catch (err: any) {
      Alert.alert(
        t("linked_accounts_v2.alert_error_title"),
        err.message || t("linked_accounts_v2.alert_failed_default"),
      );
    }
  };

  const handleRemoveAccount = (method: SavedPaymentMethod) => {
    Alert.alert(
      t("linked_accounts_v2.remove_title"),
      t("linked_accounts_v2.remove_body", { label: method.label }),
      [
        { text: t("linked_accounts_v2.action_cancel"), style: "cancel" },
        {
          text: t("linked_accounts_v2.action_remove"),
          style: "destructive",
          onPress: async () => {
            try {
              await removePaymentMethod(method.id);
              showToast(
                t("linked_accounts_v2.toast_method_removed"),
                "success",
              );
            } catch (err: any) {
              Alert.alert(
                t("linked_accounts_v2.alert_error_title"),
                err.message || t("linked_accounts_v2.alert_failed_remove"),
              );
            }
          },
        },
      ],
    );
  };

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // P2 (payment-methods review): only the manual pull-refresh asks
      // the EF to re-sync from Stripe. Focus + realtime paths stay
      // local-only — that's the brief's "best effort" guidance.
      await refreshPaymentMethods({ syncRemote: true });
    } finally {
      setRefreshing(false);
    }
  }, [refreshPaymentMethods]);

  // Render helpers ──────────────────────────────────────────────────────────

  // Render the leading icon for a method row. Cards with a recognised
  // brand get the brand glyph; everything else falls back to the
  // PaymentContext-provided Ionicons name. Apple/Google Pay / Cash App /
  // Link already get their logo via that fallback.
  const renderMethodIcon = (method: SavedPaymentMethod, bg: string, fg: string) => {
    if (method.type === "card") {
      const { name, color } = brandIconFor(method.cardBrand);
      if (name) {
        return (
          <View style={[styles.accountIcon, { backgroundColor: "#FFFFFF" }]}>
            <FontAwesome name={name} size={26} color={color} />
          </View>
        );
      }
    }
    return (
      <View style={[styles.accountIcon, { backgroundColor: bg }]}>
        <Ionicons name={method.icon as any} size={24} color={fg} />
      </View>
    );
  };

  const renderExpiryBadge = (method: SavedPaymentMethod) => {
    const cls = classifyExpiry(method.cardExpMonth, method.cardExpYear);
    if (!cls) return null;
    const isExpired = cls === "expired";
    return (
      <View
        style={[
          styles.expiryPill,
          isExpired ? styles.expiryPillExpired : styles.expiryPillSoon,
        ]}
      >
        <Ionicons
          name={isExpired ? "alert-circle" : "time-outline"}
          size={10}
          color={isExpired ? "#991B1B" : "#92400E"}
        />
        <Text
          style={[
            styles.expiryPillText,
            { color: isExpired ? "#991B1B" : "#92400E" },
          ]}
        >
          {isExpired
            ? t("linked_accounts_v2.expired")
            : t("linked_accounts_v2.expires_this_month")}
        </Text>
      </View>
    );
  };

  // Single render fn so cards + banks share the row layout. The only
  // difference is the leading icon background + the secondary line
  // (cardLast4 vs bankLast4).
  const renderMethodRow = (
    method: SavedPaymentMethod,
    secondaryLast4: string | undefined,
    bg: string,
    fg: string,
    showLastInRow: boolean,
  ) => (
    <View
      key={method.id}
      style={[styles.accountItem, !showLastInRow && styles.borderBottom]}
    >
      {renderMethodIcon(method, bg, fg)}
      <View style={styles.accountContent}>
        <View style={styles.accountTitleRow}>
          <Text style={styles.accountName} numberOfLines={1}>
            {method.label}
          </Text>
          {method.isDefault && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>
                {t("linked_accounts_v2.badge_primary")}
              </Text>
            </View>
          )}
          {renderExpiryBadge(method)}
        </View>
        {secondaryLast4 && (
          <Text style={styles.accountNumber}>****{secondaryLast4}</Text>
        )}
        <View style={styles.verifiedRow}>
          <Ionicons name="shield-checkmark" size={12} color="#00C6AE" />
          <Text style={styles.verifiedText}>
            {t("linked_accounts_v2.tag_verified")}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.moreButton}
        onPress={() => setOpenMethod(method)}
        accessibilityRole="button"
        accessibilityLabel={t("linked_accounts_v2.action_set_primary")}
      >
        <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  const isInitialLoading = isLoadingMethods && paymentMethods.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor="#00C6AE"
            colors={["#00C6AE"]}
          />
        }
      >
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>
                {t("screen_headers.linked_accounts")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("linked_accounts_v2.header_subtitle")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Onboarding Banner — P2.5: only when ACH/Connect makes sense
              for this user (US only, Connect onboarding incomplete). */}
          {isUS && !isOnboarded && (
            <TouchableOpacity style={styles.onboardingBanner} onPress={handleAddBank}>
              <View style={styles.onboardingIcon}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
              </View>
              <View style={styles.onboardingContent}>
                <Text style={styles.onboardingTitle}>
                  {t("linked_accounts_v2.banner_setup_title")}
                </Text>
                <Text style={styles.onboardingText}>
                  {t("linked_accounts_v2.banner_setup_body")}
                </Text>
                <Text style={styles.onboardingNote}>
                  {t("linked_accounts_v2.banner_setup_note")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}

          {/* P1.4 — Initial loading: skeletons rather than a centered
              spinner. Once any data lands we drop straight into the real
              list; subsequent refreshes are signalled by the
              RefreshControl swipe-indicator instead. */}
          {isInitialLoading ? (
            <View style={styles.section}>
              <View style={styles.card}>
                <SkeletonRow />
                <SkeletonRow />
              </View>
            </View>
          ) : (
            <>
              {/* P2.5 — Pay-in section. Renamed from "Cards & Other"
                  to surface the user's intent (paying in) rather than
                  the implementation. */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>
                      {t("linked_accounts_v2.section_payin_title")}
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                      {t("linked_accounts_v2.section_payin_subtitle")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddCard}
                    disabled={addingCard}
                  >
                    {addingCard ? (
                      <ActivityIndicator size="small" color="#00C6AE" />
                    ) : (
                      <Ionicons name="add" size={18} color="#00C6AE" />
                    )}
                    <Text style={styles.addButtonText}>
                      {t("linked_accounts_v2.btn_add_card")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {cardAccounts.length > 0 ? (
                  <View style={styles.card}>
                    {cardAccounts.map((method, index) =>
                      renderMethodRow(
                        method,
                        method.cardLast4,
                        "#EFF6FF",
                        "#3B82F6",
                        index === cardAccounts.length - 1,
                      ),
                    )}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="card-outline" size={40} color="#9CA3AF" />
                    <Text style={styles.emptyText}>
                      {t("linked_accounts_v2.empty_no_cards")}
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={handleAddCard}
                      disabled={addingCard}
                    >
                      {addingCard ? (
                        <ActivityIndicator size="small" color="#00C6AE" />
                      ) : (
                        <Text style={styles.emptyButtonText}>
                          {t("linked_accounts_v2.btn_add_a_card")}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Bank Accounts section — second (P1.3), US-only (P2.5).
                  Non-US users see a single note instead of an empty
                  section that would lead nowhere. */}
              {isUS ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitle}>
                        {t("linked_accounts_v2.section_bank_accounts")}
                      </Text>
                      <Text style={styles.sectionSubtitle}>
                        {t("linked_accounts_v2.section_bank_subtitle")}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.addButton} onPress={handleAddBank}>
                      <Ionicons name="add" size={18} color="#00C6AE" />
                      <Text style={styles.addButtonText}>
                        {t("linked_accounts_v2.btn_add_bank")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {bankAccounts.length > 0 ? (
                    <View style={styles.card}>
                      {bankAccounts.map((method, index) =>
                        renderMethodRow(
                          method,
                          method.bankLast4,
                          "#F5F7FA",
                          "#0A2342",
                          index === bankAccounts.length - 1,
                        ),
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Ionicons name="business-outline" size={40} color="#9CA3AF" />
                      <Text style={styles.emptyText}>
                        {t("linked_accounts_v2.empty_no_banks")}
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyButton}
                        onPress={handleAddBank}
                      >
                        <Text style={styles.emptyButtonText}>
                          {t("linked_accounts_v2.btn_link_bank")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.countryGateCard}>
                  <Ionicons name="globe-outline" size={20} color="#1E40AF" />
                  <Text style={styles.countryGateText}>
                    {t("linked_accounts_v2.country_gate_note")}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Security Note */}
          <View style={styles.securityCard}>
            <View style={styles.securityIcon}>
              <Ionicons name="lock-closed" size={20} color="#00897B" />
            </View>
            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>
                {t("final_polish.linkedaccounts_bank_level_security")}
              </Text>
              <Text style={styles.securityText}>
                {t("linked_accounts_v2.security_body")}
              </Text>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color="#3B82F6" />
            <Text style={styles.infoText}>
              {t("linked_accounts_v2.info_text")}
            </Text>
          </View>
        </View>
      </ScrollView>

      <MethodActionsSheet
        visible={openMethod !== null}
        method={openMethod}
        onClose={() => setOpenMethod(null)}
        onSetPrimary={handleSetPrimary}
        onRemove={handleRemoveAccount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
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
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  onboardingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  onboardingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  onboardingContent: {
    flex: 1,
  },
  onboardingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  onboardingText: {
    fontSize: 12,
    color: "#A16207",
    lineHeight: 17,
  },
  onboardingNote: {
    fontSize: 11,
    color: "#A16207",
    marginTop: 4,
    fontStyle: "italic",
  },
  // P2.5 — country-gate replacement for the Bank Accounts section when
  // the user's profile country is non-US. Single info card, no CTA.
  countryGateCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  countryGateText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  // P2.5 — sub-title under each section header. Explains what the
  // section is *for* so the user picks the right one.
  sectionSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 15,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  accountContent: {
    flex: 1,
  },
  accountTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  accountName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  primaryBadge: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#00C6AE",
  },
  // P1.2 — expiry chips. Two tones (amber for "this month", red for
  // already expired) keep the visual hierarchy honest.
  expiryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expiryPillSoon: { backgroundColor: "#FEF3C7" },
  expiryPillExpired: { backgroundColor: "#FEE2E2" },
  expiryPillText: { fontSize: 9, fontWeight: "800" },
  accountNumber: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 11,
    color: "#00C6AE",
    fontWeight: "500",
  },
  moreButton: {
    padding: 8,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 10,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00897B",
    marginBottom: 4,
  },
  securityText: {
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    lineHeight: 18,
  },
  // P1.4 — skeleton loader. Greyscale rectangles, opacity-animated via
  // Animated.loop in SkeletonRow.
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
});
