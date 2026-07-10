// screens/StripeRedirectScreen.tsx
//
// Landing pad for the deep link Stripe posts users back to after a
// redirect-based payment or save-card flow (Klarna, Cash App Pay,
// Amazon Pay, iDEAL, or a 3-D Secure challenge). The Stripe RN SDK
// resolves the underlying PaymentSheet/SetupIntent as soon as the
// scheme fires — this screen only needs to hold the UI still while
// that resolves, then pop the user back to wherever they were.
//
// One-second wait covers the common case where the SDK finishes
// before React re-renders; if goBack fails (e.g. we were opened from
// a cold-start deep link), fall through to LinkedAccounts.

import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { Routes } from "../lib/routes";
import { colors } from "../theme/tokens";

type NavProp = StackNavigationProp<RootStackParamList>;

export default function StripeRedirectScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();

  useEffect(() => {
    const id = setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate(Routes.LinkedAccounts as any);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accentTeal} />
      <Text style={styles.title}>{t("stripe_redirect.please_wait")}</Text>
      <Text style={styles.message}>{t("stripe_redirect.message")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.screenBg,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 8,
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
