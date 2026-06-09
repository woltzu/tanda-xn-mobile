import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import { getEmailRedirectUrl } from "../context/AuthContext";

type EmailVerificationNavigationProp = StackNavigationProp<RootStackParamList, "EmailVerification">;
type EmailVerificationRouteProp = RouteProp<RootStackParamList, "EmailVerification">;

export default function EmailVerificationScreen() {
  const navigation = useNavigation<EmailVerificationNavigationProp>();
  const route = useRoute<EmailVerificationRouteProp>();
  const { t } = useTranslation();
  const email = route.params?.email || t("email_verification.fallback_email");

  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Auto-route off the verification screen the moment Supabase tells
  // us the email is confirmed. This fires on two paths:
  //   1. The user taps the link in their email; AuthCallbackScreen
  //      handles the deep link, Supabase emits TOKEN_REFRESHED /
  //      USER_UPDATED with email_confirmed_at populated.
  //   2. The user was already verified when they landed here (edge
  //      case: stale navigation). We catch that on mount via getUser.
  // Either way we navigation.reset to MainTabs so a back-press can't
  // land them back on the verify screen.
  useEffect(() => {
    let cancelled = false;

    const goToMain = () => {
      if (cancelled) return;
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    };

    // Path 2: already-verified check on mount.
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email_confirmed_at) goToMain();
    })();

    // Path 1: subscribe to live auth changes.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) goToMain();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigation]);

  // Pulse animation for email icon
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleResendEmail = async () => {
    setIsResending(true);
    setResendSuccess(false);

    try {
      // Redirect target must be /auth/confirm (AuthCallbackScreen), not
      // /verify-email — same fix as in AuthContext.signUp(). See commit
      // message for full context.
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: getEmailRedirectUrl("auth/confirm"),
        },
      });

      if (error) {
        Alert.alert(
          t("email_verification.alert_error_title"),
          error.message || t("email_verification.alert_resend_failed")
        );
      } else {
        setResendSuccess(true);
        setResendTimer(60); // 60 second cooldown
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch (err) {
      Alert.alert(t("email_verification.alert_error_title"), t("email_verification.alert_generic_failure"));
    } finally {
      setIsResending(false);
    }
  };

  const handleOpenEmailApp = () => {
    // Try to open the default email app
    Linking.openURL("mailto:");
  };

  const handleBackToLogin = () => {
    navigation.navigate("Login");
  };

  const handleTryDifferentEmail = () => {
    navigation.navigate("Signup");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#0A2342", "#1A3A5A"]}
        style={styles.header}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.backButtonText}>{t("email_verification.back")}</Text>
        </TouchableOpacity>

        {/* Animated Email Icon */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient
            colors={["#00C6AE", "#00A896"]}
            style={styles.iconContainer}
          >
            <Ionicons name="mail-outline" size={40} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.title}>{t("email_verification.title")}</Text>
        <Text style={styles.subtitle}>{t("email_verification.subtitle")}</Text>
        <Text style={styles.emailText}>{email}</Text>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {/* Success Message */}
        {resendSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
            <Text style={styles.successText}>{t("email_verification.success_banner")}</Text>
          </View>
        )}

        {/* Instructions Card */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>{t("email_verification.instructions_title")}</Text>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              {t("email_verification.step_1")}
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              {t("email_verification.step_2")}
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              {t("email_verification.step_3")}
            </Text>
          </View>
        </View>

        {/* Open Email Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleOpenEmailApp}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-open-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{t("email_verification.btn_open_email")}</Text>
        </TouchableOpacity>

        {/* Resend Email Button */}
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            (isResending || resendTimer > 0) && styles.secondaryButtonDisabled,
          ]}
          onPress={handleResendEmail}
          disabled={isResending || resendTimer > 0}
          activeOpacity={0.8}
        >
          {isResending ? (
            <ActivityIndicator color="#00C6AE" size="small" />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={18}
              color={resendTimer > 0 ? "#999" : "#00C6AE"}
            />
          )}
          <Text
            style={[
              styles.secondaryButtonText,
              (isResending || resendTimer > 0) && styles.secondaryButtonTextDisabled,
            ]}
          >
            {isResending
              ? t("email_verification.btn_sending")
              : resendTimer > 0
              ? t("email_verification.btn_resend_in", { seconds: resendTimer })
              : t("email_verification.btn_resend")}
          </Text>
        </TouchableOpacity>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>{t("email_verification.help_title")}</Text>
          <Text style={styles.helpText}>
            {t("email_verification.help_body", { email })}
          </Text>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleTryDifferentEmail}
          >
            <Text style={styles.linkButtonText}>{t("email_verification.use_different_email")}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleBackToLogin}
          >
            <Text style={styles.linkButtonText}>{t("email_verification.back_to_login")}</Text>
          </TouchableOpacity>
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
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  emailText: {
    color: "#00C6AE",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#00C6AE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successText: {
    color: "#00C6AE",
    fontWeight: "600",
    fontSize: 14,
  },
  instructionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 16,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#00C6AE",
    marginBottom: 20,
  },
  secondaryButtonDisabled: {
    borderColor: "#E0E0E0",
  },
  secondaryButtonText: {
    color: "#00C6AE",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonTextDisabled: {
    color: "#999",
  },
  helpSection: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9A3412",
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: "#C2410C",
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  linkButton: {
    padding: 8,
  },
  linkButtonText: {
    color: "#00C6AE",
    fontSize: 14,
    fontWeight: "600",
  },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: "#E0E0E0",
  },
});
