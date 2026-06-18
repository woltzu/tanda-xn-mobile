// ══════════════════════════════════════════════════════════════════════════════
// PayoutReceivedScreen — modal sheet shown when a `circle_payouts` row
// for the current user lands. Triggered either by:
//   - PayoutListener's realtime channel (foreground app)
//   - The user tapping a `payout_received` push notification (background app,
//     handled by NotificationContext's tap router)
//
// The screen is intentionally lightweight: amount, source circle, two
// buttons (View wallet / View circle), 6 s auto-dismiss. The wallet
// credit + cycle advancement have ALREADY happened by the time this
// renders — there's no "mark as received" action because the credit is
// the receipt.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useEventTracker } from "../hooks/useEventTracker";

type PayoutReceivedNavProp = StackNavigationProp<RootStackParamList>;
type PayoutReceivedRouteProp = RouteProp<RootStackParamList, "PayoutReceived">;

const AUTO_DISMISS_MS = 6000;

export default function PayoutReceivedScreen() {
  const navigation = useNavigation<PayoutReceivedNavProp>();
  const route = useRoute<PayoutReceivedRouteProp>();
  const { t } = useTranslation();
  const { payoutId, circleId, amount, currency } = route.params;
  const { circles, myCircles, browseCircles } = useCircles();
  const { track } = useEventTracker();

  const scale = useRef(new Animated.Value(0.85)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Distinguishes auto-dismiss (timer fired) from explicit user
  // dismiss (close button / outside-tap / route to wallet/circle) in
  // telemetry. We only want one dismiss event per modal lifetime.
  const dismissTrackedRef = useRef(false);
  const openTrackedRef = useRef(false);

  const circle = [...circles, ...myCircles, ...browseCircles].find(
    (c) => c.id === circleId,
  );
  const circleName = circle?.name ?? "";
  const symbol = currency === "USD" || !currency ? "$" : "";
  const suffix = currency && currency !== "USD" ? ` ${currency}` : "";
  const amountDisplay = `${symbol}${amount.toFixed(2)}${suffix}`;

  useEffect(() => {
    // Fire the `received_screen_opened` event once per mount. The
    // realtime/push-tap upstream may also fire `notification_received`
    // — those two events together let analytics dedupe the funnel.
    if (!openTrackedRef.current) {
      openTrackedRef.current = true;
      track({
        eventType: "payout_received_screen_opened",
        eventCategory: "savings",
        eventAction: "received_screen_opened",
        eventLabel: circleId,
        eventValue: { circleId, amount, payoutId },
      });
    }

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    dismissRef.current = setTimeout(() => {
      // Mark this as "auto" so the dismiss event distinguishes timer
      // from user gesture.
      trackDismiss("auto");
      doDismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
    // intentional empty deps — animation runs once on mount, dismiss
    // timer is tied to the same lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackDismiss = (reason: "auto" | "close" | "view_wallet" | "view_circle") => {
    if (dismissTrackedRef.current) return;
    dismissTrackedRef.current = true;
    track({
      eventType: "payout_received_screen_dismissed",
      eventCategory: "savings",
      eventAction: "received_screen_dismissed",
      eventLabel: reason,
      eventValue: { circleId, amount, payoutId, reason },
    });
  };

  const doDismiss = () => {
    cancelDismissTimer();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const cancelDismissTimer = () => {
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
  };

  const handleDismiss = () => {
    trackDismiss("close");
    doDismiss();
  };

  const handleViewWallet = () => {
    trackDismiss("view_wallet");
    cancelDismissTimer();
    // Wallet is the user's hub for the freshly-credited balance.
    // navigate (not replace) so back returns to whatever surface they
    // were on.
    navigation.replace("WalletMain" as never);
  };

  const handleViewCircle = () => {
    trackDismiss("view_circle");
    cancelDismissTimer();
    navigation.replace("CircleDetail", { circleId });
  };

  return (
    <View style={styles.backdrop}>
      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: fade,
            transform: [{ scale }],
          },
        ]}
      >
        <LinearGradient
          colors={["#059669", "#047857"]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.emojiBubble}>
            <Text style={styles.emoji}>🎉</Text>
          </View>
          <Text style={styles.title}>{t("payout.received_title")}</Text>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>{t("payout.received_amount")}</Text>
            <Text style={styles.amountValue}>{amountDisplay}</Text>
          </View>

          {circleName ? (
            <Text style={styles.fromText}>
              {t("payout.received_from")} {circleName}
            </Text>
          ) : null}
        </LinearGradient>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={handleViewCircle}
            accessibilityRole="button"
            accessibilityLabel={t("payout.received_view_circle")}
          >
            <Ionicons name="people-outline" size={18} color="#0A2342" />
            <Text style={styles.btnSecondaryText}>
              {t("payout.received_view_circle")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleViewWallet}
            accessibilityRole="button"
            accessibilityLabel={t("payout.received_view_wallet")}
          >
            <Ionicons name="wallet" size={18} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>
              {t("payout.received_view_wallet")}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.closeIcon}
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        {/* payoutId is captured for telemetry (Bucket C) — kept on
            the route param so we don't have to re-query the row. */}
        {__DEV__ && payoutId ? null : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 12,
  },
  gradient: {
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emojiBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emoji: {
    fontSize: 38,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 18,
    textAlign: "center",
  },
  amountBlock: {
    alignItems: "center",
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  fromText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnPrimary: {
    backgroundColor: "#00C6AE",
  },
  btnSecondary: {
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  closeIcon: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 6,
  },
});
