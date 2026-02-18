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
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";

type EmailVerificationNavigationProp = StackNavigationProp<RootStackParamList, "EmailVerification">;
type EmailVerificationRouteProp = RouteProp<RootStackParamList, "EmailVerification">;

export default function EmailVerificationScreen() {
  const navigation = useNavigation<EmailVerificationNavigationProp>();
  const route = useRoute<EmailVerificationRouteProp>();
  const email = route.params?.email || "your email";

  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

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
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      });

      if (error) {
        Alert.alert(
          "Error",
          error.message || "Failed to resend verification email. Please try again."
        );
      } else {
        setResendSuccess(true);
        setResendTimer(60); // 60 second cooldown
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong. Please try again.");
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
          <Text style={styles.backButtonText}>Back</Text>
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

        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.subtitle}>We sent a verification link to</Text>
        <Text style={styles.emailText}>{email}</Text>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {/* Success Message */}
        {resendSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
            <Text style={styles.successText}>Verification email sent!</Text>
          </View>
        )}

        {/* Instructions Card */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>What to do next:</Text>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              Open your email inbox (check spam/junk folder too)
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Click the verification link in the email from TandaXn
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Return to this app and log in with your credentials
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
          <Text style={styles.primaryButtonText}>Open Email App</Text>
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
              ? "Sending..."
              : resendTimer > 0
              ? `Resend in ${resendTimer}s`
              : "Resend Verification Email"}
          </Text>
        </TouchableOpacity>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Email not arriving?</Text>
          <Text style={styles.helpText}>
            • Check your spam or junk folder{"\n"}
            • Make sure {email} is correct{"\n"}
            • Wait a few minutes and try again
          </Text>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleTryDifferentEmail}
          >
            <Text style={styles.linkButtonText}>Use Different Email</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleBackToLogin}
          >
            <Text style={styles.linkButtonText}>Back to Login</Text>
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
