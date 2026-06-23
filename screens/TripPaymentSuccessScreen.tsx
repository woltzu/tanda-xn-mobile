// ══════════════════════════════════════════════════════════════════════════
// TripPaymentSuccessScreen — Join-trip Bucket A.6
// ══════════════════════════════════════════════════════════════════════════
//
// Confirmation screen after Stripe PaymentSheet returns success. The
// webhook (migration 241 RPC) has already inserted the trip_payments row
// and likely promoted the participant from pending→confirmed by the time
// the user sees this — but we don't depend on a fresh fetch here because
// the user's PaymentSheet success is the authoritative client signal.
//
// Route params (set by TripPaymentScreen):
//   tripId          — required, used for the "back to status" CTA
//   participantId   — required
//   amountDollars   — what was just paid (already in dollars; rendered as $X.XX)
//   paymentType     — 'deposit' | 'full' | 'installment'
//
// Uses navigation.reset() in the back CTA so the user can't navigate
// back into the (now-paid) TripPayment screen.
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
import { useNavigation, useRoute, CommonActions } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography } from "../theme/tokens";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const GREEN = "#10B981";

const fmtMoney = (dollars: number): string =>
  `$${(dollars || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TripPaymentSuccessScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();

  const tripId: string = route.params?.tripId ?? "";
  const amountDollars: number = route.params?.amountDollars ?? 0;

  const goToStatus = () => {
    // Reset the back stack so the success screen and the (now-stale)
    // TripPayment screen aren't reachable via the back gesture.
    if (tripId) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "MyTripStatus", params: { tripId } }],
        }),
      );
    } else {
      navigation.popToTop();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-circle" size={88} color={GREEN} />
        </View>
        <Text style={styles.title}>{t("trip_payment.success_title")}</Text>
        <Text style={styles.amount}>{fmtMoney(amountDollars)}</Text>
        <Text style={styles.body}>
          {t("trip_payment.success_body", { amount: fmtMoney(amountDollars) })}
        </Text>

        <TouchableOpacity style={styles.cta} onPress={goToStatus} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{t("trip_payment.success_cta")}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default TripPaymentSuccessScreen;

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
  amount: {
    fontSize: 36,
    fontWeight: "800",
    color: GREEN,
    marginBottom: 12,
  },
  body: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TEAL,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: radius.button,
  },
  ctaText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
});
