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
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { StackNavigationProp } from "@react-navigation/stack";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";
import PasswordStrengthBar from "../components/PasswordStrengthBar";
import AuthProgressStrip from "../components/AuthProgressStrip";
// Phase 2 Bucket C — sign-up flag check. Anonymous-callable RPC that
// looks up critical_account_history (migration 250). Hash happens
// server-side; we send plaintext over HTTPS.
import { supabase } from "../lib/supabase";

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, "Signup">;
type SignupScreenRouteProp = RouteProp<RootStackParamList, "Signup">;

// Keep in sync with LoginScreen.tsx and ForgotPasswordScreen.tsx — all
// three files read/write this key for the remember-me / pre-fill UX.
const LAST_IDENTIFIER_KEY = "@tandaxn/last_login_identifier";

export default function SignupScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<SignupScreenRouteProp>();
  const { t } = useTranslation();
  const { signUp, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    agreedToTerms: false,
    // Mig 353 — Twilio A2P 10DLC. Separate mandatory checkbox for SMS
    // consent so the carrier reviewer can point to a distinct opt-in,
    // not a bundled terms+SMS one. Text below matches the campaign
    // submission verbatim (via i18n key).
    agreedToSmsConsent: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // P2 (signup review): when Supabase rejects sign-up with
  // "User already registered", we swap the inline general-error banner
  // for an actionable card that offers to take the user to Login with
  // their email pre-filled. Cancel resets to false so they can edit.
  const [showAlreadyRegistered, setShowAlreadyRegistered] = useState(false);
  // Phase 2 Bucket C — debounced is_account_flagged probe. Set true
  // when the typed email/phone matches a previously-restricted account.
  // Disables submit + renders the blocking banner. Re-runs whenever
  // either identifier changes (300ms debounce).
  const [flaggedAccount, setFlaggedAccount] = useState(false);

  // Real Terms / Privacy URLs — opened externally so the user keeps
  // their typed form data while the legal text loads in the browser.
  const handleOpenTerms = () => {
    Linking.openURL("https://tandaxn.com/terms").catch(() => {});
  };
  const handleOpenPrivacy = () => {
    Linking.openURL("https://tandaxn.com/privacy").catch(() => {});
  };

  // "Sign in" tap on the already-registered banner: stash the email
  // under LAST_IDENTIFIER_KEY so LoginScreen's existing mount-effect
  // pre-fills it. Avoids widening the Login route type.
  const handleGoToLogin = async () => {
    try {
      if (formData.email.trim()) {
        await AsyncStorage.setItem(
          LAST_IDENTIFIER_KEY,
          formData.email.trim(),
        );
      }
    } catch {
      /* pre-fill is best-effort */
    }
    navigation.navigate(Routes.Login);
  };

  // Pre-fill email on mount: prefer the navigation param (passed from
  // LoginScreen when the user already typed an email there) and fall
  // back to the last-used identifier in AsyncStorage. Phone-format
  // values are ignored — signup is email-first.
  useEffect(() => {
    const fromParam = route.params?.email?.trim();
    if (fromParam && fromParam.includes("@")) {
      setFormData((f) => ({ ...f, email: fromParam }));
      return;
    }
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_IDENTIFIER_KEY);
        if (stored && stored.includes("@")) {
          setFormData((f) => ({ ...f, email: stored }));
        }
      } catch {
        /* pre-fill is best-effort */
      }
    })();
  }, [route.params?.email]);

  // Phase 2 Bucket C — debounced flag probe. Fires 400ms after the last
  // edit to email or phone, asks is_account_flagged, and toggles the
  // blocking banner. Reset to false the moment either identifier
  // changes so a quick correction clears the lock. The submit handler
  // re-checks defensively in case the debounce hasn't settled.
  useEffect(() => {
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    if (!email && !phone) {
      setFlaggedAccount(false);
      return;
    }
    setFlaggedAccount(false);
    const t0 = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc("is_account_flagged", {
          p_email: email || null,
          p_phone: phone || null,
        });
        if (data === true) setFlaggedAccount(true);
      } catch {
        // Network or RPC failure: stay permissive — better to let the
        // user attempt sign-up than to block them on a transient error.
        // The defensive re-check in handleSubmit catches real flags.
      }
    }, 400);
    return () => clearTimeout(t0);
  }, [formData.email, formData.phone]);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = t("signup.err_name_required");
    if (!formData.email.trim()) newErrors.email = t("signup.err_email_required");
    // P0 (signup review): phone is now optional. Not verified at signup
    // anyway — collection happens here only as metadata for future
    // SMS notifications. No blocking validation.
    if (formData.password.length < 8) newErrors.password = t("signup.err_password_min");
    if (!formData.agreedToTerms) newErrors.terms = t("signup.err_terms_required");
    if (!formData.agreedToSmsConsent)
      newErrors.smsConsent = t("signup.err_sms_consent_required");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = t("signup.err_email_invalid");
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      // Phase 2 Bucket C — defensive flag re-check. Covers the race
      // where the debounce hasn't run since the last edit. The banner
      // is the user-facing block; this RPC call is the server-side
      // confirmation that no flagged account is slipping through.
      try {
        const { data: isFlagged } = await supabase.rpc("is_account_flagged", {
          p_email: formData.email.trim() || null,
          p_phone: formData.phone.trim() || null,
        });
        if (isFlagged === true) {
          setFlaggedAccount(true);
          return;
        }
      } catch {
        /* permissive on transient errors — see useEffect comment */
      }
      try {
        await signUp(formData.email, formData.password, formData.fullName, formData.phone);
        // Signup → email verification → AuthCallback → Dashboard.
        // The Interest-First KYC flow (Phase KYC-2) is entered from
        // the Dashboard interest card, not from signup, so the
        // earlier NEEDS_KYC_AFTER_SIGNUP placeholder is gone.
        navigation.navigate(Routes.EmailVerification, {
          email: formData.email,
          flow: "signup",
        });
      } catch (err: any) {
        // Show specific error messages from Supabase
        let errorMessage = t("signup.err_create_default");

        if (err?.message) {
          if (
            err.message.includes("User already registered") ||
            err?.code === "user_already_exists"
          ) {
            // P2: surface the actionable banner instead of a generic
            // error toast. Bail before the setErrors call below so the
            // form area stays clean.
            setShowAlreadyRegistered(true);
            return;
          } else if (err.message.includes("Invalid email")) {
            errorMessage = t("signup.err_email_format");
          } else if (err.message.includes("Password")) {
            errorMessage = err.message;
          } else if (err.message.includes("rate limit") || err.message.includes("too many")) {
            errorMessage = t("signup.err_rate_limit");
          } else {
            errorMessage = err.message;
          }
        }

        setErrors({ general: errorMessage });
      }
    }
  };

  const updateFormData = (key: string, value: string | boolean) => {
    setFormData({ ...formData, [key]: value });
    if (errors[key]) {
      setErrors({ ...errors, [key]: "" });
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#0A2342" />
            <Text style={styles.backButtonText}>{t("signup.back")}</Text>
          </TouchableOpacity>

          {/* P1: 3-step progress strip. Pinned above the form title so
              the user sees where they are in the signup journey from
              the first paint onward. */}
          <AuthProgressStrip step={1} flow="signup" />

          {/* Header */}
          <Text style={styles.title}>{t("signup.title")}</Text>
          <Text style={styles.subtitle}>{t("signup.subtitle")}</Text>

          {/* P2: already-registered banner. Replaces the inline general
              error when Supabase says the email's taken — gives the
              user a direct path to Login instead of dead-ending. */}
          {showAlreadyRegistered ? (
            <View style={styles.banner}>
              <View style={styles.bannerHeader}>
                <Ionicons name="information-circle" size={20} color="#1E40AF" />
                <Text style={styles.bannerTitle}>
                  {t("signup.already_registered_banner_title")}
                </Text>
              </View>
              <Text style={styles.bannerBody}>
                {t("signup.already_registered_banner_body")}
              </Text>
              <View style={styles.bannerActions}>
                <TouchableOpacity
                  style={styles.bannerSecondary}
                  onPress={() => setShowAlreadyRegistered(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.bannerSecondaryText}>
                    {t("signup.already_registered_cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bannerPrimary}
                  onPress={handleGoToLogin}
                  accessibilityRole="button"
                >
                  <Text style={styles.bannerPrimaryText}>
                    {t("signup.already_registered_sign_in")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {errors.general ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#FF4444" />
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("signup.label_full_name")}</Text>
              <View style={[styles.inputWrapper, errors.fullName ? styles.inputError : null]}>
                <Ionicons name="person-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("signup.placeholder_full_name")}
                  placeholderTextColor="#999"
                  value={formData.fullName}
                  onChangeText={(text) => updateFormData("fullName", text)}
                  autoCapitalize="words"
                />
              </View>
              {errors.fullName ? <Text style={styles.fieldError}>{errors.fullName}</Text> : null}
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("signup.label_email")}</Text>
              <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
                <Ionicons name="mail-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("signup.placeholder_email")}
                  placeholderTextColor="#999"
                  value={formData.email}
                  onChangeText={(text) => updateFormData("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
            </View>

            {/* Phone — optional. Not verified at signup; collected for
                future SMS-notification opt-in only. */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {t("signup.label_phone")}{" "}
                <Text style={styles.optionalTag}>
                  {t("signup.phone_optional_tag")}
                </Text>
              </Text>
              <View style={[styles.inputWrapper, errors.phone ? styles.inputError : null]}>
                <Ionicons name="call-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("signup.placeholder_phone")}
                  placeholderTextColor="#999"
                  value={formData.phone}
                  onChangeText={(text) => updateFormData("phone", text)}
                  keyboardType="phone-pad"
                />
              </View>
              {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("signup.label_password")}</Text>
              <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                <Ionicons name="lock-closed-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("signup.placeholder_password")}
                  placeholderTextColor="#999"
                  value={formData.password}
                  onChangeText={(text) => updateFormData("password", text)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              {/* Strength indicator — shared component (Sign-up P1).
                  Renders null when password is empty. Same underlying
                  checks (length / case / digit) drive both the visual
                  pips and the back-end-of-screen submit logic. */}
              <PasswordStrengthBar password={formData.password} />
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => updateFormData("agreedToTerms", !formData.agreedToTerms)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                formData.agreedToTerms ? styles.checkboxChecked : null
              ]}>
                {formData.agreedToTerms ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={styles.termsText}>
                {t("signup.terms_prefix")}
                {/* Inline tappable links — Text onPress is the React
                    Native idiom for inline interactivity inside a
                    paragraph. TouchableOpacity wouldn't flow inline. */}
                <Text style={styles.termsLink} onPress={handleOpenTerms}>
                  {t("signup.terms_link")}
                </Text>
                {t("signup.terms_and")}
                <Text style={styles.termsLink} onPress={handleOpenPrivacy}>
                  {t("signup.privacy_link")}
                </Text>
              </Text>
            </TouchableOpacity>
            {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}

            {/* Mig 353 — Twilio A2P 10DLC SMS-consent checkbox. Text is
                submitted verbatim to the Twilio campaign; edits here
                must be re-approved by the carrier. Rendered as a
                distinct checkbox (NOT bundled into the terms row) so
                a carrier reviewer can point to a single opt-in
                affordance. */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() =>
                updateFormData("agreedToSmsConsent", !formData.agreedToSmsConsent)
              }
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: formData.agreedToSmsConsent }}
            >
              <View style={[
                styles.checkbox,
                formData.agreedToSmsConsent ? styles.checkboxChecked : null,
              ]}>
                {formData.agreedToSmsConsent ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={styles.termsText}>
                {t("signup.sms_consent_text")}
              </Text>
            </TouchableOpacity>
            {errors.smsConsent ? (
              <Text style={styles.fieldError}>{errors.smsConsent}</Text>
            ) : null}

            {/* Phase 2 Bucket C — flagged-account block. Shows when the
                debounced is_account_flagged probe returns true. Disables
                the submit button below so the only way out is to edit
                email/phone or contact support. */}
            {flaggedAccount ? (
              <View style={styles.flaggedBanner}>
                <Ionicons name="alert-circle" size={20} color="#991B1B" />
                <Text style={styles.flaggedBannerText}>
                  {t("account.flag_check_blocked")}
                </Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (isLoading || flaggedAccount) ? styles.submitButtonDisabled : null,
              ]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isLoading || flaggedAccount}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{t("signup.btn_create_account")}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.loginLinkContainer}
            onPress={() => navigation.navigate(Routes.Login)}
          >
            <Text style={styles.loginText}>
              {t("signup.have_account_prefix")}
              <Text style={styles.loginLinkText}>{t("signup.log_in")}</Text>
            </Text>
          </TouchableOpacity>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  backButtonText: {
    color: "#0A2342",
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  form: {
    marginBottom: 24,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  // P2 already-registered banner
  banner: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  bannerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  bannerBody: {
    fontSize: 13,
    color: "#1E3A8A",
    lineHeight: 19,
    marginBottom: 14,
  },
  bannerActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  bannerSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#FFFFFF",
  },
  bannerSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
  },
  bannerPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#1E40AF",
  },
  bannerPrimaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  inputError: {
    borderColor: "#FF4444",
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#0A2342",
  },
  eyeButton: {
    padding: 12,
  },
  fieldError: {
    color: "#FF4444",
    fontSize: 12,
    marginTop: 4,
  },
  optionalTag: {
    fontSize: 12,
    fontWeight: "400",
    color: "#9CA3AF",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  termsLink: {
    color: "#00C6AE",
    textDecorationLine: "underline",
  },
  submitButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  // Phase 2 Bucket C — flagged-account banner above the submit button.
  flaggedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  flaggedBannerText: {
    flex: 1,
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginLinkContainer: {
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    color: "#666",
  },
  loginLinkText: {
    color: "#00C6AE",
    fontWeight: "600",
  },
});
