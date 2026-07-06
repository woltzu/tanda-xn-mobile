// ═══════════════════════════════════════════════════════════════════════════
// screens/MfaChallengeScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════
//
// Second factor prompt. Reached from LoginScreen when signIn resolves
// with { requiresMfa: true } — the AAL1 session is already stashed in
// supabase.auth, we just need the 6-digit TOTP code to upgrade it to
// AAL2. Success → clears pendingMfa in AuthContext, isAuthenticated
// flips true, App.tsx swaps to MainTabs. Cancel → signs out + back.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/tokens";

export default function MfaChallengeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { pendingMfa, verifyMfaAndComplete, cancelMfaChallenge } = useAuth();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleVerify = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError(t("2fa.invalid_code"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfaAndComplete(trimmed);
      // Success: pendingMfa cleared → AuthContext flips isAuthenticated
      // → App.tsx swaps to MainTabs. No explicit navigation here.
    } catch (e: any) {
      setError(t("2fa.invalid_code"));
      setSubmitting(false);
      // Clear the digits so the user can retype without deleting.
      setCode("");
      // Re-focus the input for retry.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [code, t, verifyMfaAndComplete]);

  const handleCancel = useCallback(async () => {
    await cancelMfaChallenge();
    // pendingMfa cleared → LoginScreen renders. Reset for cleanliness
    // in case the challenge was reached mid-nav.
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }, [cancelMfaChallenge, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={[colors.primaryNavy, "#143654"]}
        style={[styles.header, { paddingTop: insets.top + spacing.xl }]}
      >
        <View style={styles.iconRing}>
          <Ionicons name="shield-checkmark" size={32} color={colors.accentTeal} />
        </View>
        <Text style={styles.title}>{t("2fa.challenge_title")}</Text>
        <Text style={styles.subtitle}>{t("2fa.challenge_subtitle")}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={code}
          onChangeText={(v) => {
            // Digits only, max 6 — the input keeps the code visually
            // clean without needing 6 separate boxes to manage.
            const clean = v.replace(/[^0-9]/g, "").slice(0, 6);
            setCode(clean);
            if (error) setError(null);
          }}
          placeholder="••••••"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          editable={!submitting}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.verifyBtn,
            (submitting || code.length !== 6) && styles.verifyBtnDisabled,
          ]}
          onPress={handleVerify}
          disabled={submitting || code.length !== 6}
          accessibilityRole="button"
          accessibilityLabel={t("2fa.verify_button")}
        >
          {submitting ? (
            <ActivityIndicator color={colors.cardBg} />
          ) : (
            <Text style={styles.verifyBtnText}>{t("2fa.verify_button")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={t("2fa.cancel")}
        >
          <Text style={styles.cancelBtnText}>{t("2fa.cancel")}</Text>
        </TouchableOpacity>

        {pendingMfa?.email ? (
          <Text style={styles.hint}>{pendingMfa.email}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    // paddingTop = insets.top + spacing.xl applied inline.
    paddingBottom: spacing.xxl + spacing.lg,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.cardBg,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
  },
  body: {
    flex: 1,
    padding: 24,
    alignItems: "center",
  },
  input: {
    marginTop: 32,
    width: 240,
    height: 60,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: 8,
    color: colors.primaryNavy,
  },
  error: {
    marginTop: 12,
    color: colors.errorText,
    fontSize: 13,
    fontWeight: "500",
  },
  verifyBtn: {
    marginTop: 24,
    width: "100%",
    maxWidth: 360,
    height: 52,
    backgroundColor: colors.accentTeal,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyBtnDisabled: {
    opacity: 0.5,
  },
  verifyBtnText: {
    color: colors.cardBg,
    fontSize: 16,
    fontWeight: "700",
  },
  cancelBtn: {
    marginTop: 12,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  hint: {
    marginTop: 24,
    color: colors.textSecondary,
    fontSize: 12,
  },
});
