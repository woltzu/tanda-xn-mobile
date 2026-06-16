import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRoute, RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import { getEmailRedirectUrl } from "../context/AuthContext";
import AuthProgressStrip from "../components/AuthProgressStrip";

const RESEND_COOLDOWN_SECONDS = 30;

type ForgotPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, "ForgotPassword">;
type ForgotPasswordScreenRouteProp = RouteProp<RootStackParamList, "ForgotPassword">;

// Keep in sync with LoginScreen.tsx — both files read/write this key.
const LAST_IDENTIFIER_KEY = "@tandaxn/last_login_identifier";

export default function ForgotPasswordScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<ForgotPasswordScreenRouteProp>();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");
  // Resend cooldown counter. Seeded to RESEND_COOLDOWN_SECONDS the moment
  // emailSent flips to true (initial send) AND when the user successfully
  // resends. Ticks down to 0 via the effect below.
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Pre-fill email on mount: prefer the navigation param (passed from
  // LoginScreen if the user typed an email there before tapping
  // "Forgot password?") and fall back to the last-used identifier in
  // AsyncStorage. Phone-format identifiers are ignored — password
  // reset is email-only on the Supabase side, so a pre-filled phone
  // string would just look like a bug.
  useEffect(() => {
    const fromParam = route.params?.email?.trim();
    if (fromParam && fromParam.includes("@")) {
      setEmail(fromParam);
      return;
    }
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_IDENTIFIER_KEY);
        if (stored && stored.includes("@")) setEmail(stored);
      } catch {
        /* AsyncStorage failure is non-fatal — pre-fill is best-effort */
      }
    })();
  }, [route.params?.email]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      setError(t("forgot_password.err_email_required"));
      return;
    }

    if (!validateEmail(email)) {
      setError(t("forgot_password.err_email_invalid"));
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // Uses the same platform-aware helper as signUp/email confirmation, so
      // on Expo Go we get an exp:// URL (which Expo Go actually handles), and
      // on dev-client / production builds we get tandaxn://.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getEmailRedirectUrl("reset-password"),
      });

      if (resetError) throw resetError;

      setEmailSent(true);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(err.message || t("forgot_password.err_send_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || isLoading) return;
    setError("");
    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: getEmailRedirectUrl("reset-password") },
      );
      if (resetError) throw resetError;
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(err.message || t("forgot_password.err_send_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMail = async () => {
    // iOS Mail exposes a stable URL scheme to open the inbox. Everywhere
    // else (Android, web), no inbox URL exists — the next-best is mailto:
    // which opens the default mail composer; users can navigate to inbox
    // from there.
    const url = Platform.OS === "ios" ? "message://" : "mailto:";
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) return;
      await Linking.openURL(url);
    } catch {
      /* best-effort — nothing to surface if the mail app is missing */
    }
  };

  const handleTryAgain = () => {
    setEmailSent(false);
    setEmail("");
    setError("");
    setSecondsLeft(0);
  };

  // Resend cooldown ticker. Decrements once per second while emailSent
  // and the counter is above 0. Uses chained setTimeouts (one per tick)
  // so cleanup is automatic when the component unmounts mid-countdown.
  useEffect(() => {
    if (!emailSent || secondsLeft <= 0) return;
    const id = setTimeout(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearTimeout(id);
  }, [emailSent, secondsLeft]);

  // Same-device auto-jump. If the user taps the reset link on the same
  // device while the email-sent panel is still visible, Supabase fires
  // PASSWORD_RECOVERY (or SIGNED_IN as the session lands). Hop straight
  // to ResetPassword so the user doesn't have to come back to this
  // screen to dismiss it manually.
  useEffect(() => {
    if (!emailSent) return;
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          navigation.reset({
            index: 0,
            routes: [{ name: "ResetPassword" }],
          });
        }
      },
    );
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [emailSent, navigation]);

  return (
    <View style={styles.container}>
      {/* Header with Logo */}
      <LinearGradient
        colors={["#0A2342", "#1A3A5A"]}
        style={styles.headerGradient}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.logoBox}>
          <Ionicons name="key-outline" size={36} color="#0A2342" />
        </View>
        <Text style={styles.title}>{t("forgot_password.title")}</Text>
        <Text style={styles.subtitle}>
          {emailSent
            ? t("forgot_password.subtitle_sent")
            : t("forgot_password.subtitle_initial")}
        </Text>
      </LinearGradient>

      {/* Form Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formCard}
      >
        <AuthProgressStrip step={1} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {emailSent ? (
            /* Inline "email sent" panel (P2). Compact — keeps the user
               oriented in the flow rather than swapping to a full-screen
               success state. */
            <View style={styles.sentPanel}>
              <View style={styles.sentIconRow}>
                <Ionicons name="mail-open" size={28} color="#00C6AE" />
                <Text style={styles.sentTitle}>
                  {t("forgot_password.email_sent_to", { email })}
                </Text>
              </View>
              <Text style={styles.sentHint}>
                {t("forgot_password.spam_hint")}
              </Text>

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleOpenMail}
                accessibilityRole="button"
              >
                <Ionicons name="mail" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {t("forgot_password.open_mail")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  (secondsLeft > 0 || isLoading) && styles.buttonDisabled,
                ]}
                onPress={handleResend}
                disabled={secondsLeft > 0 || isLoading}
                accessibilityRole="button"
              >
                {isLoading ? (
                  <ActivityIndicator color="#00C6AE" />
                ) : (
                  <Text style={styles.secondaryActionText}>
                    {secondsLeft > 0
                      ? t("forgot_password.resend_in_seconds", {
                          count: secondsLeft,
                        })
                      : t("forgot_password.resend")}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backToLogin}
                onPress={() => navigation.navigate(Routes.Login)}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back" size={16} color="#00C6AE" />
                <Text style={styles.backToLoginText}>
                  {t("forgot_password.back_to_login")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tryAgainLink}
                onPress={handleTryAgain}
                accessibilityRole="button"
              >
                <Text style={styles.tryAgainLinkText}>
                  {t("forgot_password.btn_try_again")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Email Input State */
            <>
              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("forgot_password.label_email")}</Text>
                <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t("forgot_password.placeholder_email")}
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError("");
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>
              </View>

              {/* Send Reset Email Button */}
              <TouchableOpacity
                style={[styles.primaryButton, isLoading ? styles.buttonDisabled : null]}
                onPress={handleSendResetEmail}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>{t("forgot_password.btn_send_reset_link")}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Back to Login */}
              <TouchableOpacity
                style={styles.backToLogin}
                onPress={() => navigation.navigate(Routes.Login)}
              >
                <Ionicons name="arrow-back" size={16} color="#00C6AE" />
                <Text style={styles.backToLoginText}>{t("forgot_password.back_to_login")}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 20,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  formCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 30,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#0A2342",
  },
  primaryButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  backToLogin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  backToLoginText: {
    color: "#00C6AE",
    fontSize: 14,
    fontWeight: "600",
  },
  // Inline "email sent" panel (P2). Replaces the full-screen success
  // state — keeps the user in the same visual frame so the progress
  // strip and form context stay continuous.
  sentPanel: {
    paddingTop: 4,
  },
  sentIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sentTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0A2342",
  },
  sentHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
    lineHeight: 18,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  secondaryActionText: {
    color: "#00C6AE",
    fontSize: 14,
    fontWeight: "700",
  },
  tryAgainLink: {
    paddingVertical: 10,
    alignItems: "center",
  },
  tryAgainLinkText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
  },
});
