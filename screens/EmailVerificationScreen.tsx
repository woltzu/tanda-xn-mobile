// ══════════════════════════════════════════════════════════════════════════════
// screens/EmailVerificationScreen.tsx
// ══════════════════════════════════════════════════════════════════════════════
// Inline "check your email" panel shown after Signup. Used only by the
// signup flow today (recovery uses a different flow via AuthCallback +
// ResetPassword). The `flow` route param defaults to "signup" so the
// 3-step progress strip renders by default; pass flow="recovery" to
// suppress it.
//
// Auto-route: once Supabase confirms `email_confirmed_at` (either on
// mount via getUser, or live via onAuthStateChange), reset to MainTabs.
//
// Sign-up P1 changes:
//   - Drops the full-screen animated card + instructions card + help
//     section + resend cooldown. Replaces them with a compact inline
//     panel mirroring ForgotPassword P2's sent-panel.
//   - Mounts AuthProgressStrip step=2 variant=signup at the top.
//   - Open Mail target was platform-aware in P0 already (message:// on
//     iOS, mailto: elsewhere).
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import AuthProgressStrip from "../components/AuthProgressStrip";

type EmailVerificationNavigationProp = StackNavigationProp<RootStackParamList, "EmailVerification">;
type EmailVerificationRouteProp = RouteProp<RootStackParamList, "EmailVerification">;

const NAVY_TOP = "#0A2342";
const NAVY_BOTTOM = "#1A3A5A";
const TEAL = "#00C6AE";
const NAVY = "#0A2342";
const MUTED = "#6B7280";
const TEXT = "#111827";
const BORDER = "#E5E7EB";

export default function EmailVerificationScreen() {
  const navigation = useNavigation<EmailVerificationNavigationProp>();
  const route = useRoute<EmailVerificationRouteProp>();
  const { t } = useTranslation();
  const email = route.params?.email || t("email_verification.fallback_email");
  const flow: "signup" | "recovery" = route.params?.flow ?? "signup";

  // Auto-route off the verification screen the moment Supabase tells
  // us the email is confirmed. Fires on two paths:
  //   1. The user taps the link in their email; Supabase emits
  //      TOKEN_REFRESHED / USER_UPDATED with email_confirmed_at populated.
  //   2. The user was already verified when they landed here (edge
  //      case: stale navigation). We catch that on mount via getUser.
  // Either way we navigation.reset to MainTabs so a back-press can't
  // land them back on the verify screen.
  useEffect(() => {
    let cancelled = false;

    const goToNext = () => {
      if (cancelled) return;
      // P2: signup flow lands on SignupWelcome (one-shot, self-gates
      // via AsyncStorage). Other flows keep the existing direct route
      // to MainTabs — they may be used by future paths (email change,
      // re-verification) that have no signup-welcome story.
      const target = flow === "signup" ? "SignupWelcome" : "MainTabs";
      navigation.reset({ index: 0, routes: [{ name: target }] });
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email_confirmed_at) goToNext();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) goToNext();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigation, flow]);

  const handleOpenEmailApp = () => {
    // P0 (signup review): iOS Mail exposes a stable scheme to open the
    // inbox directly. Everywhere else (Android, web), no inbox URL
    // exists — `mailto:` opens the default mail composer, which is the
    // closest stand-in.
    const mailUrl = Platform.OS === "ios" ? "message://" : "mailto:";
    Linking.openURL(mailUrl);
  };

  const handleBackToLogin = () => {
    navigation.navigate("Login");
  };

  const handleTryDifferentEmail = () => {
    navigation.navigate("Signup");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[NAVY_TOP, NAVY_BOTTOM]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.backButtonText}>
            {t("email_verification.back")}
          </Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("email_verification.title")}</Text>
      </LinearGradient>

      <View style={styles.card}>
        {flow === "signup" ? (
          <AuthProgressStrip step={2} flow="signup" />
        ) : null}

        <View style={styles.panel}>
          <View style={styles.sentRow}>
            <Ionicons name="mail-open" size={28} color={TEAL} />
            <Text style={styles.sentTitle} numberOfLines={2}>
              {t("email_verification.sent_to", { email })}
            </Text>
          </View>
          <Text style={styles.hint}>
            {t("forgot_password.spam_hint")}
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenEmailApp}
            accessibilityRole="button"
          >
            <Ionicons name="mail" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {t("forgot_password.open_mail")}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleTryDifferentEmail}
              accessibilityRole="button"
            >
              <Text style={styles.linkButtonText}>
                {t("email_verification.use_different_email")}
              </Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleBackToLogin}
              accessibilityRole="button"
            >
              <Text style={styles.linkButtonText}>
                {t("email_verification.back_to_login")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    marginBottom: 18,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginTop: -14,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  panel: {
    padding: 20,
    paddingTop: 12,
  },
  sentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  sentTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 20,
    lineHeight: 18,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  linkButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkButtonText: {
    color: TEAL,
    fontSize: 13,
    fontWeight: "600",
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: BORDER,
  },
});
