// ══════════════════════════════════════════════════════════════════════════
// TripPaymentFailedScreen — Join-trip Bucket A.6
// ══════════════════════════════════════════════════════════════════════════
//
// Failure screen after Stripe PaymentSheet returns an error OR the
// createPaymentIntent call throws. Shows a friendly localised message
// (Stripe decline codes get a soft-translation fallback in B) and two
// CTAs: try again (pop back to TripPayment) or cancel (back to status).
//
// Route params:
//   tripId          — required for back navigation
//   participantId   — required
//   errorMessage    — raw string from Stripe / EF; surfaced verbatim
//                     for now. B.4 will map Stripe codes to friendlier
//                     localized strings.
// ══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography } from "../theme/tokens";
import { useEventTracker } from "../hooks/useEventTracker";

const NAVY = colors.primaryNavy;
const RED = "#DC2626";

// Join-trip Bucket B.4 — Stripe decline-code → i18n-key map. Stripe
// returns either the canonical decline_code (preferred) or a high-level
// error code; both end up in the message we receive. We pattern-match
// the most common cases and fall back to the generic message. Anything
// we don't recognise still shows the raw Stripe message verbatim so the
// user (or support) can still act on it.
const STRIPE_FRIENDLY_KEY: Array<[RegExp, string]> = [
  [/card[\s_]?declined|do[\s_]?not[\s_]?honor/i, "trip_payment.failure_card_declined"],
  [/insufficient[\s_]?funds/i, "trip_payment.failure_insufficient_funds"],
  [/expired[\s_]?card/i, "trip_payment.failure_expired_card"],
  [/incorrect[\s_]?cvc|invalid[\s_]?cvc/i, "trip_payment.failure_incorrect_cvc"],
  [/processing[\s_]?error|try[\s_]?again[\s_]?later/i, "trip_payment.failure_processing_error"],
];

function friendlyStripeMessage(
  raw: string | undefined,
  t: (k: string) => string,
): string {
  if (!raw) return t("trip_payment.failure_default");
  for (const [re, key] of STRIPE_FRIENDLY_KEY) {
    if (re.test(raw)) return t(key);
  }
  // Unknown code — surface the raw Stripe message so support has the
  // signal; the default key wraps it for context.
  return t("trip_payment.failed_body").replace("{{error}}", raw);
}

const TripPaymentFailedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { track } = useEventTracker();

  const tripId: string | undefined = route.params?.tripId;
  const participantId: string | undefined = route.params?.participantId;
  const rawError: string | undefined = route.params?.errorMessage;

  // Join-trip Bucket C.1 — fire once on mount; ref-guarded so a
  // re-render (e.g. theme switch) doesn't double-count. We pass the
  // sanitised body so the event is searchable by friendly reason.
  const viewedFiredRef = useRef(false);
  useEffect(() => {
    if (viewedFiredRef.current) return;
    viewedFiredRef.current = true;
    const sanitised = (rawError || "")
      .replace(/(pi|seti|cus|src|tok|ch)_[a-zA-Z0-9_]+/g, "<id>")
      .slice(0, 200);
    track({
      eventType: "trip_payment.failed_screen_viewed",
      eventCategory: "cross_border",
      eventAction: "view",
      eventLabel: "trip_payment_failed_screen",
      eventValue: {
        trip_id: tripId ?? null,
        participant_id: participantId ?? null,
        raw_error: sanitised,
      },
    });
  }, [tripId, participantId, rawError, track]);
  // Bucket B.4 — friendly localised body when Stripe sent a known code,
  // else fall back to the generic failure_default. The raw message is
  // still preserved in the unknown-code path for diagnosability.
  const errorMessage: string = friendlyStripeMessage(
    route.params?.errorMessage,
    t,
  );

  const handleRetry = () => {
    // Replace so the failed screen doesn't sit in the back stack.
    if (tripId && participantId) {
      navigation.replace("TripPayment", { tripId, participantId });
    } else {
      navigation.goBack();
    }
  };

  const handleCancel = () => {
    if (tripId) {
      navigation.navigate("MyTripStatus", { tripId });
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="close-circle" size={88} color={RED} />
        </View>
        <Text style={styles.title}>{t("trip_payment.failed_title")}</Text>
        <Text style={styles.body}>
          {t("trip_payment.failed_body", { error: errorMessage })}
        </Text>

        <TouchableOpacity style={styles.retryCta} onPress={handleRetry} activeOpacity={0.85}>
          <Ionicons name="refresh" size={18} color="#FFF" />
          <Text style={styles.retryCtaText}>{t("trip_payment.failed_try_again")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelCta} onPress={handleCancel} activeOpacity={0.85}>
          <Text style={styles.cancelCtaText}>{t("trip_payment.failed_cancel")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default TripPaymentFailedScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  iconCircle: { marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 4,
  },
  body: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    marginTop: 8,
  },
  retryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: RED,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.button,
    marginBottom: 12,
    width: "100%",
  },
  retryCtaText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
  cancelCta: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  cancelCtaText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
});
