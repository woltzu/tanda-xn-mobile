import React, { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_IDENTIFIER_KEY = "@tandaxn/last_login_identifier";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import {
  useAuth,
  SESSION_EXPIRES_AT_KEY,
  TEMPORARY_SESSION_DURATION_MS,
} from "../context/AuthContext";

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const {
    signIn,
    signInWithPhone,
    signInWithBiometrics,
    enableBiometrics,
    hasAskedBiometricOptIn,
    markBiometricOptInAsked,
    biometricsAvailable,
    biometricsEnabled,
    hasStoredRefreshToken,
    isLoading,
  } = useAuth();
  // Single identifier field — auto-detects email vs phone on submit.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  // P1 (logout review): drives the "Switch account" link. Captured once
  // from AsyncStorage at mount; null means no remembered identifier so
  // the link stays hidden. Link is shown when the current input still
  // equals the remembered value — once the user starts typing fresh
  // text the link is redundant.
  const [storedIdentifier, setStoredIdentifier] = useState<string | null>(null);
  const identifierRef = useRef<TextInput>(null);

  // Pre-fill the last identifier the user signed in with. Honour the
  // "remember me" UX: only pre-fill if storage has a value.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_IDENTIFIER_KEY);
        if (stored) {
          setIdentifier(stored);
          setStoredIdentifier(stored);
        }
      } catch {
        /* silently ignore — pre-fill is a nice-to-have, not load-bearing */
      }
    })();
  }, []);

  // Tap "Switch account" — clear the field and refocus so the user can
  // type a different identifier. Does NOT sign out (user is already
  // signed out if they reached Login via the sign-out path); does NOT
  // clear AsyncStorage (the next successful sign-in overwrites).
  const handleSwitchAccount = () => {
    setIdentifier("");
    setError("");
    setTimeout(() => identifierRef.current?.focus(), 60);
  };

  // After a successful password login, optionally surface the one-shot
  // biometric opt-in modal. Returns true if the user picked an action
  // (enable / not now); false if conditions aren't met. Caller resets
  // navigation regardless.
  const maybeSurfaceBiometricOptIn = async (): Promise<void> => {
    if (!biometricsAvailable || biometricsEnabled) return;
    const asked = await hasAskedBiometricOptIn();
    if (asked) return;
    await new Promise<void>((resolve) => {
      Alert.alert(
        t("login.biometric_opt_in_title"),
        t("login.biometric_opt_in_message"),
        [
          {
            text: t("login.biometric_opt_in_no"),
            style: "cancel",
            onPress: async () => {
              await markBiometricOptInAsked();
              resolve();
            },
          },
          {
            text: t("login.biometric_opt_in_yes"),
            onPress: async () => {
              await enableBiometrics();
              await markBiometricOptInAsked();
              resolve();
            },
          },
        ],
      );
    });
  };

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setError(t("login.error_required"));
      return;
    }

    const id = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const normalizedPhone = id.replace(/[\s\-().]/g, "");
    const isPhone = /^\+?\d{8,}$/.test(normalizedPhone);

    if (!isEmail && !isPhone) {
      setError(t("login.error_invalid_format"));
      return;
    }

    setError("");

    // ─── Phone OTP path ─────────────────────────────────────────────────
    // Password is not required for phone — Supabase signInWithOtp sends an
    // SMS and we navigate to OTPScreen for the 6-digit verification.
    if (isPhone) {
      const phone = normalizedPhone.startsWith("+")
        ? normalizedPhone
        : `+${normalizedPhone}`;
      try {
        await signInWithPhone(phone);
        if (rememberMe) {
          try {
            await AsyncStorage.setItem(LAST_IDENTIFIER_KEY, phone);
          } catch {
            /* ignore */
          }
        }
        navigation.navigate("OTP", { phone, from: "login" } as never);
      } catch (err) {
        setError(t("login.error_phone_otp_failed"));
      }
      return;
    }

    // ─── Email + password path ──────────────────────────────────────────
    if (!password.trim()) {
      setError(t("login.error_required"));
      return;
    }
    try {
      await signIn(id, password);
      // Remember the identifier for next launch (only after a successful
      // sign-in so we never persist a fat-fingered string).
      if (rememberMe) {
        try {
          await AsyncStorage.setItem(LAST_IDENTIFIER_KEY, id);
        } catch {
          /* storage write is best-effort */
        }
        // Make sure no stale temporary-session expiry is left over from a
        // previous "Remember me OFF" sign-in.
        try {
          await AsyncStorage.removeItem(SESSION_EXPIRES_AT_KEY);
        } catch {
          /* ignore */
        }
      } else {
        try {
          await AsyncStorage.removeItem(LAST_IDENTIFIER_KEY);
        } catch {
          /* ignore */
        }
        // P2 (session-persistence review): temporary session. Stamp
        // expiry so AuthContext can sign the user out after
        // TEMPORARY_SESSION_DURATION_MS regardless of Supabase's own
        // token refresh activity.
        try {
          const expiresAt = Date.now() + TEMPORARY_SESSION_DURATION_MS;
          await AsyncStorage.setItem(
            SESSION_EXPIRES_AT_KEY,
            String(expiresAt),
          );
        } catch {
          /* ignore — falls back to the default persistent behaviour */
        }
      }
      // Surface the biometric opt-in modal (returns immediately if conditions
      // aren't met). Blocks navigation reset until the user picks an action.
      await maybeSurfaceBiometricOptIn();
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    } catch (err) {
      setError(t("login.error_invalid_credentials"));
    }
  };

  // Tap on the biometric button — single tap, no fields required.
  const handleBiometricLogin = async () => {
    setError("");
    const ok = await signInWithBiometrics();
    if (!ok) {
      setError(t("login.error_biometric_failed"));
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  const showBiometricButton =
    biometricsAvailable && biometricsEnabled && hasStoredRefreshToken;

  return (
    <View style={styles.container}>
      {/* Header with Logo */}
      <LinearGradient
        colors={["#0A2342", "#1A3A5A"]}
        style={styles.headerGradient}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>Xn</Text>
        </View>
        <Text style={styles.title}>{t("login.title")}</Text>
        <Text style={styles.subtitle}>{t("login.subtitle")}</Text>
      </LinearGradient>

      {/* Form Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formCard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Login method toggle removed — single identifier field below
              auto-detects email vs phone format on submit. */}

          {/* Fast biometric sign-in — only shown for users who previously
              opted in AND who have a fresh stashed refresh token. Tapping
              triggers the OS prompt; success replays the refresh token
              through Supabase and resets to MainTabs. */}
          {showBiometricButton ? (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              accessibilityRole="button"
            >
              <Ionicons name="finger-print" size={22} color="#FFFFFF" />
              <Text style={styles.biometricButtonText}>
                {t("login.biometric_button_label")}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Identifier Input — single field, format auto-detected on submit */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t("login.label_identifier")}</Text>
            <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                ref={identifierRef}
                style={styles.input}
                placeholder={t("login.placeholder_identifier")}
                placeholderTextColor="#999"
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  setError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {storedIdentifier !== null && identifier.trim() === storedIdentifier ? (
              <TouchableOpacity
                style={styles.switchAccountLink}
                onPress={handleSwitchAccount}
                accessibilityRole="button"
              >
                <Ionicons name="person-add-outline" size={14} color="#00C6AE" />
                <Text style={styles.switchAccountText}>
                  {t("login.switch_account")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t("login.label_password")}</Text>
            <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t("login.placeholder_password")}
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError("");
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe ? styles.checkboxChecked : null]}>
                {rememberMe ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.rememberText}>{t("login.remember_me")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                // Pass the identifier through when it looks like an email
                // so ForgotPasswordScreen can pre-fill — saves a re-type
                // for the common case of "tapped Forgot after typing
                // their email here". Falls through silently for
                // phone-format identifiers; ForgotPassword still has
                // an AsyncStorage fallback.
                const id = identifier.trim();
                if (id.includes("@")) {
                  navigation.navigate(Routes.ForgotPassword, { email: id } as never);
                } else {
                  navigation.navigate(Routes.ForgotPassword);
                }
              }}
            >
              <Text style={styles.forgotText}>{t("login.forgot_password")}</Text>
            </TouchableOpacity>
          </View>
          {/* P2 (session-persistence review): when "Remember me" is
              unchecked, surface the one-hour temporary-session rule so
              users don't get confused by an automatic sign-out later. */}
          {!rememberMe ? (
            <Text style={styles.rememberHint}>
              {t("login.remember_me_hint")}
            </Text>
          ) : null}

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading ? styles.loginButtonDisabled : null]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>{t("login.btn_sign_in")}</Text>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Biometric login + divider removed pending the expo-local-
              authentication wire-up. Will return as a single-tap button
              when re-implemented (refresh token via expo-secure-store). */}

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>
              {t("login.no_account_prefix")}
              <Text
                style={styles.signupLink}
                onPress={() => {
                  // Pass the email through when it looks like one — saves
                  // a re-type in the common case of "typed email here,
                  // then realised they don't have an account yet".
                  const id = identifier.trim();
                  if (id.includes("@")) {
                    navigation.navigate(Routes.Signup, { email: id } as never);
                  } else {
                    navigation.navigate(Routes.Signup);
                  }
                }}
              >
                {t("login.sign_up")}
              </Text>
            </Text>
          </View>
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
  logoText: {
    color: "#0A2342",
    fontSize: 32,
    fontWeight: "800",
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
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#0A2342",
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
    marginBottom: 16,
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
  eyeButton: {
    padding: 14,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  rememberText: {
    fontSize: 14,
    color: "#666",
  },
  rememberHint: {
    fontSize: 12,
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: -12,
    marginBottom: 16,
  },
  forgotText: {
    color: "#00C6AE",
    fontSize: 14,
    fontWeight: "600",
  },
  switchAccountLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  switchAccountText: {
    color: "#00C6AE",
    fontSize: 12,
    fontWeight: "600",
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0A2342",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  biometricButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  loginButton: {
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
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: "#999",
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 24,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  signupContainer: {
    alignItems: "center",
  },
  signupText: {
    fontSize: 14,
    color: "#666",
  },
  signupLink: {
    color: "#00C6AE",
    fontWeight: "600",
  },
});
