// ═══════════════════════════════════════════════════════════════════════════
// screens/TwoFactorAuthScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════
//
// Real TOTP enrol / disable. Wraps supabase.auth.mfa.*:
//   - listFactors() to detect current state (verified / unverified / none)
//   - enroll({ factorType: 'totp' }) to start a new enrolment
//   - challengeAndVerify() to confirm the code and mark the factor verified
//   - unenroll({ factorId }) to disable
//
// The screen is a simple two-mode surface:
//   * VIEW mode — 2FA already verified. Big status card + Disable btn.
//   * ENROL mode — no factor OR unverified factor left over. QR code + secret
//                  + 6-digit input + Verify btn. Cancel drops the enrolment.
//
// Backup codes are NOT built into Supabase MFA and are out of scope for this
// bucket. The password-reset flow remains the account-recovery fallback.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import QRCode from "react-native-qrcode-svg";

import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import ScreenState from "../components/ScreenState";
import { colors, radius, spacing, typography } from "../theme/tokens";

type Mode = "loading" | "view" | "enrol";

type EnrolPayload = {
  factorId: string;
  secret: string;
  uri: string;
};

export default function TwoFactorAuthScreen() {
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>("loading");
  // The verified factor id, when 2FA is already on. Kept so the Disable
  // button knows which factor to unenroll.
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(
    null,
  );
  const [enrol, setEnrol] = useState<EnrolPayload | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setMode("loading");
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) throw err;
      const verified = data?.totp?.find((f) => f.status === "verified");
      const unverified = data?.totp?.find((f) => f.status === "unverified");

      if (verified) {
        setVerifiedFactorId(verified.id);
        setMode("view");
        return;
      }

      // Clean up any dangling unverified factor before starting a fresh
      // enrolment — Supabase will otherwise reject the new enroll for
      // conflicting with the pending one.
      if (unverified) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: unverified.id });
        } catch {
          /* ignore — we'll surface the enroll error if any */
        }
      }
      setVerifiedFactorId(null);
      setMode("view"); // land on view first; user taps Enable to move to enrol
    } catch (e: any) {
      console.warn("[TwoFactorAuth] listFactors failed", e?.message);
      setError(e?.message ?? "Failed to load 2FA status");
      setMode("view");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const startEnrol = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "TandaXn",
      });
      if (err) throw err;
      if (!data?.id || !data.totp?.secret || !data.totp?.uri) {
        throw new Error("Enrolment payload missing required fields");
      }
      setEnrol({
        factorId: data.id,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setCode("");
      setMode("enrol");
    } catch (e: any) {
      Alert.alert(t("2fa.title"), e?.message ?? "Failed to start enrolment");
    } finally {
      setBusy(false);
    }
  }, [t]);

  const verifyEnrol = useCallback(async () => {
    if (!enrol) return;
    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError(t("2fa.invalid_code"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrol.factorId,
        code: trimmed,
      });
      if (err) throw err;
      showToast(t("2fa.enable_success"), "success");
      setEnrol(null);
      setCode("");
      await refreshStatus();
    } catch (e: any) {
      setError(e?.message ?? t("2fa.invalid_code"));
    } finally {
      setBusy(false);
    }
  }, [code, enrol, refreshStatus, t]);

  const cancelEnrol = useCallback(async () => {
    if (!enrol) return;
    setBusy(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId: enrol.factorId });
    } catch {
      /* best-effort */
    } finally {
      setEnrol(null);
      setCode("");
      setBusy(false);
      await refreshStatus();
    }
  }, [enrol, refreshStatus]);

  const confirmDisable = useCallback(() => {
    if (!verifiedFactorId) return;
    Alert.alert(t("2fa.title"), t("2fa.disable_confirm"), [
      { text: t("2fa.cancel"), style: "cancel" },
      {
        text: t("2fa.disable_button"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const { error: err } = await supabase.auth.mfa.unenroll({
              factorId: verifiedFactorId,
            });
            if (err) throw err;
            showToast(t("2fa.disable_success"), "success");
            await refreshStatus();
          } catch (e: any) {
            Alert.alert(t("2fa.title"), e?.message ?? "Failed to disable 2FA");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [refreshStatus, t, verifiedFactorId]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t("2fa.title")} />

        <View style={styles.body}>
          {mode === "loading" ? (
            <ScreenState type="loading" />
          ) : mode === "enrol" && enrol ? (
            <View>
              <Text style={styles.instruction}>{t("2fa.qr_instruction")}</Text>
              <View style={styles.qrWrap}>
                <QRCode
                  value={enrol.uri}
                  size={200}
                  color={colors.primaryNavy}
                  backgroundColor={colors.cardBg}
                />
              </View>
              <Text style={styles.secretLabel}>{t("2fa.secret_label")}</Text>
              <View style={styles.secretBox}>
                <Text style={styles.secretText} selectable>
                  {enrol.secret}
                </Text>
              </View>

              <Text style={styles.codeLabel}>
                {t("2fa.verify_code_label")}
              </Text>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(v) => {
                  const clean = v.replace(/[^0-9]/g, "").slice(0, 6);
                  setCode(clean);
                  if (error) setError(null);
                }}
                placeholder="••••••"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete={
                  Platform.OS === "web" ? "one-time-code" : "sms-otp"
                }
                maxLength={6}
                editable={!busy}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (busy || code.length !== 6) && styles.primaryBtnDisabled,
                ]}
                onPress={verifyEnrol}
                disabled={busy || code.length !== 6}
              >
                {busy ? (
                  <ActivityIndicator color={colors.cardBg} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t("2fa.verify_button")}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={cancelEnrol}
                disabled={busy}
              >
                <Text style={styles.secondaryBtnText}>{t("2fa.cancel")}</Text>
              </TouchableOpacity>
            </View>
          ) : verifiedFactorId ? (
            // View mode — 2FA already enabled.
            <View>
              <View style={styles.statusCard}>
                <View style={[styles.statusIcon, styles.statusIconOn]}>
                  <Ionicons
                    name="shield-checkmark"
                    size={26}
                    color={colors.accentTeal}
                  />
                </View>
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>{t("2fa.enabled")}</Text>
                  <Text style={styles.statusSubtitle}>
                    {t("2fa.verified")}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.dangerBtn, busy && styles.primaryBtnDisabled]}
                onPress={confirmDisable}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.errorText} />
                ) : (
                  <Text style={styles.dangerBtnText}>
                    {t("2fa.disable_button")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // View mode — 2FA not enabled.
            <View>
              <View style={styles.statusCard}>
                <View style={[styles.statusIcon, styles.statusIconOff]}>
                  <Ionicons
                    name="shield-outline"
                    size={26}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>{t("2fa.disabled")}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
                onPress={startEnrol}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.cardBg} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t("2fa.enable_button")}
                  </Text>
                )}
              </TouchableOpacity>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { paddingBottom: 40 },
  body: { padding: 20 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    marginBottom: 20,
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconOn: { backgroundColor: colors.tealTintBg },
  statusIconOff: { backgroundColor: colors.screenBg },
  statusText: { flex: 1 },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  statusSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  instruction: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 16,
    lineHeight: 20,
  },
  qrWrap: {
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  secretLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  secretBox: {
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 20,
  },
  secretText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 13,
    color: colors.primaryNavy,
    letterSpacing: 1,
    textAlign: "center",
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryNavy,
    marginBottom: 8,
  },
  codeInput: {
    height: 56,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 6,
    color: colors.primaryNavy,
    marginBottom: 12,
  },
  error: {
    color: colors.errorText,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
    textAlign: "center",
  },
  primaryBtn: {
    height: 52,
    backgroundColor: colors.accentTeal,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: colors.cardBg,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    height: 44,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  dangerBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.errorText,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  dangerBtnText: {
    color: colors.errorText,
    fontSize: 16,
    fontWeight: "700",
  },
});
