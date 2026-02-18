import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors, radius, typography } from "../theme/tokens";

export default function LockScreen() {
  const {
    user,
    biometricsEnabled,
    biometricsAvailable,
    unlockWithBiometrics,
    unlockWithPassword,
    signOut,
  } = useAuth();

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-attempt biometric unlock on mount
  useEffect(() => {
    if (biometricsEnabled && biometricsAvailable) {
      handleBiometricUnlock();
    }
  }, []);

  const handleBiometricUnlock = async () => {
    setIsLoading(true);
    setError(null);

    const success = await unlockWithBiometrics();

    if (!success) {
      setShowPasswordInput(true);
    }

    setIsLoading(false);
  };

  const handlePasswordUnlock = async () => {
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);
    setError(null);

    const success = await unlockWithPassword(password);

    if (!success) {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }

    setIsLoading(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? You'll need to log in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: signOut,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo/Icon */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="lock-closed" size={40} color={colors.accentTeal} />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            {user?.name ? `Hi, ${user.name}` : "Your session has timed out"}
          </Text>
          <Text style={styles.description}>
            For your security, please unlock to continue
          </Text>

          {/* Biometric Button */}
          {biometricsEnabled && biometricsAvailable && !showPasswordInput && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricUnlock}
              disabled={isLoading}
              accessibilityLabel="Unlock with biometrics"
              accessibilityRole="button"
            >
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.accentTeal} />
              ) : (
                <>
                  <Ionicons
                    name="finger-print"
                    size={48}
                    color={colors.accentTeal}
                  />
                  <Text style={styles.biometricText}>
                    Tap to unlock with biometrics
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Password Input */}
          {(showPasswordInput || !biometricsEnabled || !biometricsAvailable) && (
            <View style={styles.passwordSection}>
              <Text style={styles.passwordLabel}>Enter your password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  accessibilityLabel="Password input"
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.errorText} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.unlockButton,
                  isLoading && styles.unlockButtonDisabled,
                ]}
                onPress={handlePasswordUnlock}
                disabled={isLoading}
                accessibilityLabel="Unlock with password"
                accessibilityRole="button"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <Text style={styles.unlockButtonText}>Unlock</Text>
                )}
              </TouchableOpacity>

              {/* Switch to biometrics */}
              {biometricsEnabled && biometricsAvailable && showPasswordInput && (
                <TouchableOpacity
                  style={styles.switchMethodButton}
                  onPress={() => {
                    setShowPasswordInput(false);
                    handleBiometricUnlock();
                  }}
                  accessibilityLabel="Use biometrics instead"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="finger-print"
                    size={18}
                    color={colors.accentTeal}
                  />
                  <Text style={styles.switchMethodText}>
                    Use biometrics instead
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Sign Out Link */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
          >
            <Text style={styles.signOutText}>Sign out and use different account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    marginBottom: 4,
  },
  description: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },
  biometricButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderRadius: radius.card,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
    marginBottom: 24,
  },
  biometricText: {
    fontSize: typography.body,
    color: colors.accentTeal,
    fontWeight: typography.semibold,
    marginTop: 12,
  },
  passwordSection: {
    width: "100%",
    marginBottom: 24,
  },
  passwordLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: typography.body,
    color: colors.primaryNavy,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.errorText,
  },
  unlockButton: {
    backgroundColor: colors.accentTeal,
    paddingVertical: 16,
    borderRadius: radius.button,
    alignItems: "center",
    marginBottom: 16,
  },
  unlockButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  unlockButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  switchMethodButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
  switchMethodText: {
    fontSize: typography.body,
    color: colors.accentTeal,
    fontWeight: typography.semibold,
  },
  signOutButton: {
    marginTop: 24,
    padding: 12,
  },
  signOutText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
});
