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

import React from "react";
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

const NAVY = colors.primaryNavy;
const RED = "#DC2626";

const TripPaymentFailedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();

  const tripId: string | undefined = route.params?.tripId;
  const participantId: string | undefined = route.params?.participantId;
  const errorMessage: string =
    route.params?.errorMessage || t("trip_payment.failed_default");

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
