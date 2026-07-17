import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";

type OTPScreenNavigationProp = StackNavigationProp<RootStackParamList, "OTP">;
type OTPScreenRouteProp = RouteProp<RootStackParamList, "OTP">;

export default function OTPScreen() {
  const navigation = useNavigation<OTPScreenNavigationProp>();
  const route = useRoute<OTPScreenRouteProp>();
  const { t } = useTranslation();
  const phoneNumber = route.params?.phone || "+1 (555) 123-4567";
  // `from` tells us which flow originated this screen:
  //   "login"        — returns directly to MainTabs.
  //   "signup"       — hands off to OnboardingWelcome.
  //   "profile_edit" — completes a phone-change started in
  //                    PersonalInfoScreen and pops back to it.
  // Undefined falls back to signup-style behavior for backwards compat.
  const fromFlow: "login" | "signup" | "profile_edit" =
    route.params?.from ?? "signup";
  const { verifyOTP, signInWithPhone, verifyPhoneFromProfile, requestPhoneChange } = useAuth();

  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(45);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for phone icon
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
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

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    if (newOtp.every((digit) => digit)) {
      setIsComplete(true);
    } else {
      setIsComplete(false);
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otpCode.join("");
    if (code.length !== 6) {
      setError(t("otp.err_invalid_code"));
      return;
    }
    setIsVerifying(true);
    setError("");
    try {
      // Branch on flow origin.
      //   profile_edit — different Supabase OTP `type` ('phone_change'
      //                  vs 'sms'); pop back to PersonalInfoScreen so
      //                  the user sees the "Verified" badge.
      //   login        — straight to MainTabs (skip KYC).
      //   signup       — OnboardingWelcome (defers KYC to first money-action).
      if (fromFlow === "profile_edit") {
        await verifyPhoneFromProfile(phoneNumber, code);
        navigation.goBack();
      } else {
        await verifyOTP(phoneNumber, code);
        if (fromFlow === "login") {
          navigation.reset({
            index: 0,
            routes: [{ name: "MainTabs" }],
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: "OnboardingWelcome" as never }],
          });
        }
      }
    } catch (err: any) {
      setError(err?.message || t("otp.err_invalid_code"));
      setOtpCode(["", "", "", "", "", ""]);
      setIsComplete(false);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setResendTimer(45);
    setOtpCode(["", "", "", "", "", ""]);
    setError("");
    setIsComplete(false);
    inputRefs.current[0]?.focus();
    // Re-request a fresh OTP via Supabase. Branch on the flow that
    // opened this screen because Supabase issues distinct OTP TYPES per
    // flow — and verifyOtp on submit rejects any token whose type
    // doesn't match:
    //   * profile_edit  → phone_change token (via requestPhoneChange /
    //                      supabase.auth.updateUser({ phone })).
    //   * signup/login  → sms token (via signInWithPhone /
    //                      supabase.auth.signInWithOtp({ phone })).
    // Prior code sent a sms token in ALL flows, which meant a resend
    // during a profile_edit flow silently invalidated the user's next
    // code — GoTrue would 400 with "Token has expired or is invalid"
    // even when they typed it correctly.
    try {
      if (fromFlow === "profile_edit") {
        await requestPhoneChange(phoneNumber);
      } else {
        await signInWithPhone(phoneNumber);
      }
    } catch (err: any) {
      setError(err?.message || t("otp.err_invalid_code"));
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
          {/* Header Section */}
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
              <Text style={styles.backButtonText}>{t("otp.back")}</Text>
            </TouchableOpacity>

            {/* Animated Phone Icon */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <LinearGradient
                colors={["#00C6AE", "#00A896"]}
                style={styles.phoneIconContainer}
              >
                <Ionicons name="phone-portrait-outline" size={36} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>

            <Text style={styles.title}>{t("otp.title")}</Text>
            <Text style={styles.subtitle}>{t("otp.subtitle")}</Text>
            <Text style={styles.phoneText}>{phoneNumber}</Text>
          </LinearGradient>

          {/* Main Content */}
          <View style={styles.content}>
            {/* OTP Input Boxes */}
            <View style={styles.otpContainer}>
              {otpCode.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                    error ? styles.otpInputError : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(idx, text)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(idx, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus={true}
                  // OTP autofill — Apple inserts the whole code on the first
                  // focused field that opts in; Android matches via SMS Retriever.
                  textContentType={idx === 0 ? "oneTimeCode" : "none"}
                  autoComplete={idx === 0 ? "sms-otp" : "off"}
                />
              ))}
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Success Indicator */}
            {isComplete && !error && !isVerifying ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={18} color="#00C6AE" />
                <Text style={styles.successText}>
                  {t("otp.complete_hint")}
                </Text>
              </View>
            ) : null}

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.verifyButton,
                (!isComplete || isVerifying) ? styles.verifyButtonDisabled : null,
              ]}
              onPress={handleVerify}
              disabled={!isComplete || isVerifying}
              activeOpacity={0.8}
            >
              {isVerifying ? (
                <View style={styles.verifyingContainer}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.verifyButtonText}>{t("otp.verifying")}</Text>
                </View>
              ) : (
                <Text style={[
                  styles.verifyButtonText,
                  (!isComplete || isVerifying) ? styles.verifyButtonTextDisabled : null,
                ]}>
                  {t("otp.btn_verify")}
                </Text>
              )}
            </TouchableOpacity>

            {/* Resend Section */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendLabel}>{t("otp.resend_label")}</Text>
              <TouchableOpacity
                style={[
                  styles.resendButton,
                  resendTimer === 0 ? styles.resendButtonActive : null,
                ]}
                onPress={handleResend}
                disabled={resendTimer > 0}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={resendTimer === 0 ? "#FFFFFF" : "#999"}
                />
                <Text style={[
                  styles.resendButtonText,
                  resendTimer === 0 ? styles.resendButtonTextActive : null,
                ]}>
                  {resendTimer > 0 ? t("otp.resend_in", { seconds: resendTimer }) : t("otp.resend_btn")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Link */}
            <TouchableOpacity style={styles.helpLink}>
              <Text style={styles.helpText}>
                {t("otp.help_prefix")}<Text style={styles.helpLinkText}>{t("otp.help_link")}</Text>
              </Text>
            </TouchableOpacity>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  phoneIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
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
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  phoneText: {
    color: "#00C6AE",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  content: {
    padding: 30,
    paddingHorizontal: 20,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  otpInput: {
    width: 50,
    height: 60,
    textAlign: "center",
    fontSize: 26,
    fontWeight: "700",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    color: "#0A2342",
  },
  otpInputFilled: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  otpInputError: {
    borderColor: "#FF4444",
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  successText: {
    color: "#00C6AE",
    fontWeight: "600",
    fontSize: 14,
  },
  verifyButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  verifyButtonDisabled: {
    backgroundColor: "#E0E0E0",
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  verifyButtonTextDisabled: {
    color: "#999",
  },
  resendContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  resendLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  resendButtonActive: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
  },
  resendButtonTextActive: {
    color: "#FFFFFF",
  },
  helpLink: {
    marginTop: 20,
    alignItems: "center",
  },
  helpText: {
    fontSize: 13,
    color: "#666",
  },
  helpLinkText: {
    color: "#00C6AE",
    fontWeight: "600",
  },
});
