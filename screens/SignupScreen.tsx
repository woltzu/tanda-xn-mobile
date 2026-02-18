import React, { useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, "Signup">;

export default function SignupScreen() {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const { signUp, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreedToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;
  const passwordsDontMatch = formData.confirmPassword && formData.password !== formData.confirmPassword;

  const getStrengthLabel = () => {
    if (passwordStrength === 0) return "Weak";
    if (passwordStrength <= 2) return "Fair";
    if (passwordStrength === 3) return "Good";
    return "Strong";
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";
    if (formData.password.length < 8) newErrors.password = "Min 8 characters";
    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm password";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }
    if (!formData.agreedToTerms) newErrors.terms = "You must agree to terms";

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      try {
        await signUp(formData.email, formData.password, formData.fullName, formData.phone);
        // Navigate to email verification screen instead of OTP
        navigation.navigate("EmailVerification" as any, { email: formData.email });
      } catch (err: any) {
        // Show specific error messages from Supabase
        let errorMessage = "Failed to create account. Please try again.";

        if (err?.message) {
          if (err.message.includes("User already registered")) {
            errorMessage = "An account with this email already exists. Please log in or use a different email.";
          } else if (err.message.includes("Invalid email")) {
            errorMessage = "Please enter a valid email address.";
          } else if (err.message.includes("Password")) {
            errorMessage = err.message;
          } else if (err.message.includes("rate limit") || err.message.includes("too many")) {
            errorMessage = "Too many attempts. Please wait a few minutes and try again.";
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
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join thousands building their financial future
          </Text>

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
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputWrapper, errors.fullName ? styles.inputError : null]}>
                <Ionicons name="person-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Marcus Johnson"
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
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
                <Ionicons name="mail-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="marcus@email.com"
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

            {/* Phone */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputWrapper, errors.phone ? styles.inputError : null]}>
                <Ionicons name="call-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
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
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                <Ionicons name="lock-closed-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 8 characters"
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

              {/* Password Strength Indicator */}
              {formData.password.length > 0 ? (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthHeader}>
                    <Text style={styles.strengthLabel}>Password strength:</Text>
                    <Text style={[
                      styles.strengthValue,
                      { color: passwordStrength >= 3 ? "#00C6AE" : "#666" }
                    ]}>
                      {getStrengthLabel()}
                    </Text>
                  </View>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: level <= passwordStrength ? "#00C6AE" : "#E0E0E0" },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[
                styles.inputWrapper,
                passwordsDontMatch ? styles.inputError : null,
                passwordsMatch ? styles.inputSuccess : null,
              ]}>
                <Ionicons name="lock-closed-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Repeat your password"
                  placeholderTextColor="#999"
                  value={formData.confirmPassword}
                  onChangeText={(text) => updateFormData("confirmPassword", text)}
                  secureTextEntry={!showConfirmPassword}
                />
                {formData.confirmPassword ? (
                  <View style={styles.matchIndicator}>
                    <Ionicons
                      name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={passwordsMatch ? "#00C6AE" : "#FF4444"}
                    />
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              {formData.confirmPassword ? (
                <Text style={[
                  styles.matchText,
                  { color: passwordsMatch ? "#00C6AE" : "#FF4444" }
                ]}>
                  {passwordsMatch ? "Passwords match" : "Passwords don't match"}
                </Text>
              ) : null}
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
                I agree to the{" "}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {" "}and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading ? styles.submitButtonDisabled : null]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.loginLinkContainer}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginText}>
              Already have an account?{" "}
              <Text style={styles.loginLinkText}>Log In</Text>
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
  inputSuccess: {
    borderColor: "#00C6AE",
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
  matchIndicator: {
    paddingRight: 4,
  },
  fieldError: {
    color: "#FF4444",
    fontSize: 12,
    marginTop: 4,
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  strengthLabel: {
    fontSize: 11,
    color: "#666",
  },
  strengthValue: {
    fontSize: 11,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  matchText: {
    fontSize: 12,
    marginTop: 4,
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
