// ═══════════════════════════════════════════════════════════════════════════
// screens/SecuritySettingsScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════
//
// Real security hub. Shows:
//   * Change password → ChangePassword (already real)
//   * 2FA on/off status → TwoFactorAuth (now real)
//   * Biometrics toggle → wired to AuthContext (already real)
//   * Active sessions count → get_my_sessions RPC → ActiveSessions (now real)
//
// Dropped from the previous mock:
//   * Fake security-score gauge (derived from unwired toggles).
//   * "Login alerts" + "Transaction alerts" toggles — pure local useState
//     that persisted nothing.
//   * Hardcoded "Last changed 30 days ago" / "Authenticator app enabled"
//     copy that lied when neither was true.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";

import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type SecuritySettingsNavigationProp = StackNavigationProp<RootStackParamList>;

export default function SecuritySettingsScreen() {
  const navigation = useNavigation<SecuritySettingsNavigationProp>();
  const { t } = useTranslation();
  const {
    biometricsEnabled,
    biometricsAvailable,
    setBiometricsEnabled,
  } = useAuth();

  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [factorsRes, sessionsRes] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.rpc("get_my_sessions"),
      ]);
      const verified = factorsRes.data?.totp?.find(
        (f) => f.status === "verified",
      );
      setMfaEnabled(!!verified);
      setSessionCount(
        Array.isArray(sessionsRes.data) ? sessionsRes.data.length : 0,
      );
    } catch (e) {
      console.warn("[SecuritySettings] load failed", e);
      // Leave state as-is so the UI doesn't flicker between real / mock.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-fetch on focus so a change in TwoFactorAuth / ActiveSessions is
  // reflected the moment the user comes back to this hub.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const mfaSubtitle =
    mfaEnabled === null
      ? "…"
      : mfaEnabled
      ? t("2fa.enabled")
      : t("2fa.disabled");

  const sessionSubtitle =
    sessionCount === null ? "…" : String(sessionCount);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>
                {t("screen_headers.security_settings")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("final_polish.securitysettings_protect_your_account")}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Password Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("final_polish.securitysettings_password")}
            </Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("ChangePassword" as any)}
              >
                <View style={[styles.menuIcon, { backgroundColor: "#F0FDFB" }]}>
                  <Ionicons name="key-outline" size={20} color="#00C6AE" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>
                    {t("final_polish.securitysettings_change_password")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Two-Factor Authentication */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("final_polish.securitysettings_two_factor_authentication")}
            </Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("TwoFactorAuth" as any)}
                disabled={loading}
              >
                <View style={[styles.menuIcon, { backgroundColor: "#F0FDFB" }]}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#00C6AE"
                  />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{t("2fa.title")}</Text>
                  <Text style={styles.menuSubtitle}>{mfaSubtitle}</Text>
                </View>
                {mfaEnabled === true ? (
                  <View style={styles.enabledBadge}>
                    <Text style={styles.enabledText}>
                      {t("final_polish.securitysettings_enabled")}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Biometrics — wired to real AuthContext */}
          {biometricsAvailable ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("final_polish.securitysettings_biometrics")}
              </Text>
              <View style={styles.card}>
                <View style={styles.toggleItem}>
                  <View style={[styles.menuIcon, { backgroundColor: "#EFF6FF" }]}>
                    <Ionicons name="finger-print" size={20} color="#3B82F6" />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>Face ID / Touch ID</Text>
                    <Text style={styles.menuSubtitle}>
                      Quick &amp; secure login
                    </Text>
                  </View>
                  <Switch
                    value={biometricsEnabled}
                    onValueChange={(v) => {
                      void setBiometricsEnabled(v);
                    }}
                    trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {/* Active Sessions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("final_polish.securitysettings_sessions")}
            </Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("ActiveSessions" as any)}
                disabled={loading}
              >
                <View style={[styles.menuIcon, { backgroundColor: "#F5F7FA" }]}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color="#0A2342"
                  />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>
                    {t("final_polish.securitysettings_active_sessions")}
                  </Text>
                  <Text style={styles.menuSubtitle}>{sessionSubtitle}</Text>
                </View>
                {sessionCount !== null && sessionCount > 0 ? (
                  <View style={styles.sessionsBadge}>
                    <Text style={styles.sessionsBadgeText}>{sessionCount}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Tip */}
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={20} color="#00897B" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>
                {t("final_polish.securitysettings_security_tips")}
              </Text>
              <Text style={styles.tipText}>
                Enable 2FA and use a strong, unique password to keep your
                account safe.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  headerTop: {
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
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  enabledBadge: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  enabledText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00C6AE",
  },
  sessionsBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0A2342",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00897B",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: "#065F46",
    lineHeight: 18,
  },
});
