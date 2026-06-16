import React, { useState, useEffect } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import AuthProgressStrip from "../components/AuthProgressStrip";
import PasswordStrengthBar, {
  computeStrengthChecks,
} from "../components/PasswordStrengthBar";

type ResetPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, "ResetPassword">;
type ResetPasswordScreenRouteProp = RouteProp<RootStackParamList, "ResetPassword">;

export default function ResetPasswordScreen() {
  const navigation = useNavigation<ResetPasswordScreenNavigationProp>();
  const route = useRoute<ResetPasswordScreenRouteProp>();
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Acceptance criteria unchanged from the pre-P1 4-row checklist —
  // length / upper / lower / digit. Submit gate is "all four pass".
  // The visual bar lives in <PasswordStrengthBar /> (shared with
  // SignupScreen, Sign-up P1 review); we only need the booleans here
  // to gate the submit button.
  const passwordChecks = computeStrengthChecks(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleResetPassword = async () => {
    if (!isPasswordValid) {
      setError(t("reset_password.err_password_requirements"));
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // updateUser already returned a fresh authenticated session — the
      // user is signed in with the new password. Skip the legacy
      // signOut → re-login round-trip and drop them straight into the
      // app. (P0 fix: previous version waited 3s, signed out, and
      // bounced through Login forcing the user to re-enter the password
      // they just set.)
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    } catch (err: any) {
      setError(err.message || t("reset_password.err_update_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Logo */}
      <LinearGradient
        colors={["#0A2342", "#1A3A5A"]}
        style={styles.headerGradient}
      >
        <View style={styles.logoBox}>
          <Ionicons name="lock-open-outline" size={36} color="#0A2342" />
        </View>
        <Text style={styles.title}>
          {success ? t("reset_password.title_success") : t("reset_password.title_initial")}
        </Text>
        <Text style={styles.subtitle}>
          {success
            ? t("reset_password.subtitle_success")
            : t("reset_password.subtitle_initial")}
        </Text>
      </LinearGradient>

      {/* Form Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formCard}
      >
        <AuthProgressStrip step={3} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {success ? (
            /* Success State */
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>{t("reset_password.success_title")}</Text>
              <Text style={styles.successText}>
                {t("reset_password.success_text")}
              </Text>
              <Text style={styles.redirectText}>
                {t("reset_password.redirecting")}
              </Text>
              <ActivityIndicator color="#00C6AE" style={{ marginTop: 20 }} />
            </View>
          ) : (
            /* Password Input State */
            <>
              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* New Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("reset_password.label_new_password")}</Text>
                <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t("reset_password.placeholder_new_password")}
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError("");
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
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

              {/* Strength indicator — shared component (Sign-up P1). */}
              <PasswordStrengthBar password={password} />

              {/* Update Password Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!isPasswordValid || isLoading) ? styles.buttonDisabled : null,
                ]}
                onPress={handleResetPassword}
                activeOpacity={0.8}
                disabled={!isPasswordValid || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>{t("reset_password.btn_update_password")}</Text>
                  </>
                )}
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
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: "#E0E0E0",
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
  },
  redirectText: {
    fontSize: 14,
    color: "#999",
  },
});
