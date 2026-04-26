// ══════════════════════════════════════════════════════════════════════════════
// SetPasswordScreen — Optional password setup after a magic-link signup.
// Shown to brand-new QuickJoin users immediately after the payment-success
// screen, gated by profiles.password_set === false AND password_skipped_at IS NULL.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";

// ── Theme (matches QuickJoin / JoinConfirm) ────────────────────────────────────
const NAVY = "#0A2342";
const NAVY_DEEP = "#071832";
const TEAL = "#00C6AE";
const WHITE = "#FFFFFF";
const MUTED = "#9AA7BD";
const DANGER = "#EF4444";
const SUCCESS = "#10B981";
const BORDER = "rgba(255,255,255,0.12)";
const CARD = "rgba(255,255,255,0.06)";
const INPUT_BG = "rgba(255,255,255,0.08)";

const MIN_PASSWORD_LENGTH = 8;

type NavProp = StackNavigationProp<RootStackParamList, "SetPassword">;

export default function SetPasswordScreen() {
  const navigation = useNavigation<NavProp>();

  // Auth state — populated on mount
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Form state
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<TextInput>(null);

  // ── Mount: confirm session, capture user id, auto-focus first input ─────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getUser();
        if (cancelled) return;
        const u = sessionData?.user;
        if (!u) {
          console.log("[SetPassword] no session on mount");
          setUserId(null);
        } else {
          setUserId(u.id);
        }
      } catch (err) {
        console.log("[SetPassword] error", { error: err });
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-focus the first password field once auth resolves
  useEffect(() => {
    if (!authLoading && userId) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [authLoading, userId]);

  // ── Validation ───────────────────────────────────────────────────────────────
  const lengthOk = newPassword.length >= MIN_PASSWORD_LENGTH;
  const matchOk =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = lengthOk && matchOk && !saving;

  // Inline message under inputs (real-time)
  const inlineMessage: { text: string; tone: "muted" | "danger" } | null = (() => {
    if (newPassword.length === 0 && confirmPassword.length === 0) {
      return { text: `At least ${MIN_PASSWORD_LENGTH} characters.`, tone: "muted" };
    }
    if (!lengthOk) {
      return {
        text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters (${newPassword.length}/${MIN_PASSWORD_LENGTH}).`,
        tone: "danger",
      };
    }
    if (confirmPassword.length === 0) {
      return { text: "Confirm your password.", tone: "muted" };
    }
    if (!matchOk) {
      return { text: "Passwords don't match.", tone: "danger" };
    }
    return { text: "Looks good — ready to save.", tone: "muted" };
  })();

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    if (!canSubmit || !userId) return;
    setError(null);
    setSaving(true);
    try {
      console.log("[SetPassword] saving password", { userId });
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        console.log("[SetPassword] error", { error: updateErr });
        setError(`Could not save password: ${updateErr.message}`);
        setSaving(false);
        return;
      }

      console.log("[SetPassword] password saved, marking profile");
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          password_set: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (profErr) {
        // The auth password is the source of truth; profile flag is a UX
        // hint. Log but don't block the user.
        console.log("[SetPassword] error", { error: profErr });
      }

      // Brief success flash before navigating away.
      setSaving(false);
      setSaved(true);
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs" }],
        });
      }, 1100);
    } catch (err: any) {
      console.log("[SetPassword] error", { error: err });
      setError(err?.message ?? "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (saving || saved) return;
    if (!userId) {
      // No session — still navigate home so we don't trap the user
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
      return;
    }
    try {
      console.log("[SetPassword] user skipped", { userId });
      const { error: skipErr } = await supabase
        .from("profiles")
        .update({ password_skipped_at: new Date().toISOString() })
        .eq("id", userId);
      if (skipErr) {
        console.log("[SetPassword] error", { error: skipErr });
        // Still proceed — user explicitly chose to skip
      }
    } catch (err) {
      console.log("[SetPassword] error", { error: err });
    } finally {
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    }
  };

  // ── Render: loading state while we fetch the session ────────────────────────
  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: no session error state ──────────────────────────────────────────
  if (!userId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centered}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={56} color={DANGER} />
          </View>
          <Text style={styles.title}>Session expired</Text>
          <Text style={styles.subtitle}>
            Your magic-link session ended. Please return to the home screen and
            request a fresh login link.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => {
              if (Platform.OS === "web" && typeof window !== "undefined") {
                window.location.href = "/";
              } else {
                navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
              }
            }}
          >
            <Text style={styles.primaryBtnText}>Return home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: success flash ───────────────────────────────────────────────────
  if (saved) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centered}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={72} color={SUCCESS} />
          </View>
          <Text style={styles.title}>Password saved!</Text>
          <Text style={styles.subtitle}>Taking you to your dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: main form ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>TandaXn</Text>
          </View>

          {/* Header */}
          <Text style={styles.heading}>Welcome to TandaXn 🎉</Text>
          <Text style={styles.subheading}>
            Set a password so you can log back in anytime
          </Text>
          <Text style={styles.explainer}>
            Your email magic-link login still works, but a password is faster.
          </Text>

          {/* New password */}
          <Text style={styles.label}>New password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              ref={firstInputRef}
              style={styles.input}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              placeholderTextColor={MUTED}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="next"
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword((v) => !v)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityLabel={showNewPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={MUTED}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm password */}
          <Text style={styles.label}>Confirm password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Type it again"
              placeholderTextColor={MUTED}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleSavePassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword((v) => !v)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={MUTED}
              />
            </TouchableOpacity>
          </View>

          {/* Inline real-time hint */}
          {inlineMessage ? (
            <Text
              style={[
                styles.inlineMessage,
                inlineMessage.tone === "danger" ? styles.inlineDanger : styles.inlineMuted,
              ]}
            >
              {inlineMessage.text}
            </Text>
          ) : null}

          {/* Error from server */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={DANGER} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Save Password */}
          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSavePassword}
            disabled={!canSubmit}
          >
            {saving ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color={NAVY} />
                <Text style={styles.primaryBtnText}>Save password</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Skip for now */}
          <TouchableOpacity
            style={styles.skipBtn}
            activeOpacity={0.7}
            onPress={handleSkip}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NAVY_DEEP },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12,
  },
  scroll: { padding: 24, paddingTop: 40 },

  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL },
  brand: { color: WHITE, fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },

  heading: { color: WHITE, fontSize: 26, fontWeight: "800", marginBottom: 8 },
  subheading: { color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 22, marginBottom: 4 },
  explainer: { color: MUTED, fontSize: 13, lineHeight: 18, marginBottom: 28 },

  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: WHITE, fontSize: 15, paddingVertical: 14 },

  inlineMessage: { fontSize: 12, marginTop: -8, marginBottom: 16, paddingHorizontal: 4 },
  inlineMuted: { color: MUTED },
  inlineDanger: { color: DANGER },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: DANGER, fontSize: 13 },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: NAVY, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  skipBtn: { alignItems: "center", paddingVertical: 16, marginTop: 6 },
  skipText: { color: MUTED, fontSize: 13, fontWeight: "600" },

  errorIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  successIconWrap: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: "rgba(16,185,129,0.15)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  title: { color: WHITE, fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  subtitle: {
    color: "rgba(255,255,255,0.8)", fontSize: 15, textAlign: "center", lineHeight: 22,
    marginBottom: 16, paddingHorizontal: 12,
  },
});
