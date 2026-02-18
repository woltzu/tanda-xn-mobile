import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type ChangePasswordNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ChangePasswordScreen() {
  const navigation = useNavigation<ChangePasswordNavigationProp>();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "", color: "#E5E7EB" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: "Weak", color: "#DC2626" };
    if (score <= 3) return { score, label: "Fair", color: "#D97706" };
    if (score <= 4) return { score, label: "Good", color: "#00C6AE" };
    return { score, label: "Strong", color: "#00897B" };
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isValid =
    currentPassword.length >= 8 &&
    newPassword.length >= 8 &&
    passwordsMatch &&
    strength.score >= 3;

  const requirements = [
    { met: newPassword.length >= 8, text: "At least 8 characters" },
    {
      met: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword),
      text: "Upper & lowercase letters",
    },
    { met: /\d/.test(newPassword), text: "At least one number" },
    { met: /[^a-zA-Z0-9]/.test(newPassword), text: "At least one special character" },
  ];

  const handleSave = async () => {
    if (!isValid) return;

    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.alert(
        "Success",
        "Your password has been changed successfully.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to change password. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Reset Password",
      "We'll send a password reset link to your registered email address.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send Link", onPress: () => console.log("Reset link sent") },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Change Password</Text>
              <Text style={styles.headerSubtitle}>Create a strong password</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Current Password */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrent(!showCurrent)}
              >
                <Ionicons
                  name={showCurrent ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNew(!showNew)}
              >
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* Strength Indicator */}
            {newPassword.length > 0 && (
              <View style={styles.strengthSection}>
                <View style={styles.strengthHeader}>
                  <Text style={styles.strengthLabel}>Password Strength</Text>
                  <Text style={[styles.strengthValue, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${(strength.score / 5) * 100}%`,
                        backgroundColor: strength.color,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Requirements */}
            <View style={styles.requirements}>
              {requirements.map((req, idx) => (
                <View key={idx} style={styles.requirementRow}>
                  <View
                    style={[
                      styles.requirementDot,
                      { backgroundColor: req.met ? "#00C6AE" : "#E5E7EB" },
                    ]}
                  >
                    {req.met && (
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.requirementText,
                      { color: req.met ? "#065F46" : "#6B7280" },
                    ]}
                  >
                    {req.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View
              style={[
                styles.inputWrapper,
                confirmPassword.length > 0 && {
                  borderColor: passwordsMatch ? "#00C6AE" : "#DC2626",
                  borderWidth: 2,
                },
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm(!showConfirm)}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.mismatchText}>Passwords don't match</Text>
            )}
            {passwordsMatch && (
              <Text style={styles.matchText}>Passwords match</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveButton, (!isValid || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isValid || isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? "Updating..." : "Update Password"}
          </Text>
        </TouchableOpacity>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: "#0A2342",
  },
  eyeButton: {
    padding: 4,
  },
  forgotText: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "500",
    marginTop: 8,
  },
  strengthSection: {
    marginTop: 12,
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  strengthLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  strengthValue: {
    fontSize: 11,
    fontWeight: "600",
  },
  strengthBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  requirements: {
    marginTop: 12,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  requirementDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  requirementText: {
    fontSize: 12,
  },
  mismatchText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 8,
  },
  matchText: {
    fontSize: 12,
    color: "#00897B",
    marginTop: 8,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  saveButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
