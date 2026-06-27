// ═══════════════════════════════════════════════════════════════════════════
// screens/StripeConnectScreen.tsx — Stripe Connect onboarding (organizers)
// ═══════════════════════════════════════════════════════════════════════════
//
// Surfaces the user's Connect state and walks them through Stripe's
// hosted Express onboarding via the stripe-create-account-link Edge
// Function. The flow:
//
//   1. Read profiles.stripe_connect_account_id for current state.
//   2. "Connect" → invoke EF → receive one-shot account link URL.
//   3. Open WebBrowser.openAuthSessionAsync(url, returnUrl). Stripe
//      redirects back to returnUrl when the user finishes/cancels;
//      WebBrowser auto-closes the sheet and resolves with the URL.
//   4. Refresh profile + toast result.
//
// We use openAuthSessionAsync (not openBrowserAsync) so the OS handles
// the "return to app" plumbing without needing a global deep-link
// handler — that pattern collides with React Navigation's one-path-per-
// route constraint already documented in lib/deepLinking.ts.
//
// "Disconnect" clears stripe_connect_account_id on the profile row.
// The Stripe account itself is NOT deleted (Express accounts can't be
// deleted via the API once funds have flowed); the user can re-connect
// later and the prior account will be picked back up by metadata
// (tandaxn_user_id is stamped at create time).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

function platformConfirm(message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" && window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert("", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", onPress: () => resolve(true) },
    ]);
  });
}

export default function StripeConnectScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("stripe_connect_account_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      setAccountId((data?.stripe_connect_account_id as string | null) ?? null);
    } catch (err) {
      console.warn("[StripeConnect] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = useCallback(async () => {
    if (!user?.id || connecting) return;
    setConnecting(true);
    try {
      const returnUrl = Linking.createURL("stripe/callback");
      const { data, error } = await supabase.functions.invoke(
        "stripe-create-account-link",
        { body: { return_url: returnUrl } },
      );
      if (error || !data?.url) {
        throw new Error(error?.message || "Empty response");
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url as string,
        returnUrl,
      );

      await load();

      if (result.type === "success") {
        const url = "url" in result ? (result.url as string) : "";
        const isReturn = url.includes("return=true");
        showToast(
          isReturn
            ? t("stripe.callback_success")
            : t("stripe.callback_refresh"),
          isReturn ? "success" : "info",
        );
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // User closed the sheet without completing — no toast, the
        // status row below already reflects whatever state Stripe
        // wrote (account exists but onboarding may still be pending).
      }
    } catch (err) {
      console.warn("[StripeConnect] connect failed:", err);
      showToast(t("stripe.callback_error"), "error");
    } finally {
      setConnecting(false);
    }
  }, [user?.id, connecting, t, load]);

  const handleDisconnect = useCallback(async () => {
    if (!user?.id) return;
    const ok = await platformConfirm(t("stripe.disconnect_confirm"));
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ stripe_connect_account_id: null })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      setAccountId(null);
      showToast(t("stripe.disconnect_success"), "success");
    } catch (err) {
      console.warn("[StripeConnect] disconnect failed:", err);
      showToast(t("stripe.disconnect_failed"), "error");
    }
  }, [user?.id, t]);

  const isConnected = !!accountId;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("stripe.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator size="large" color={TEAL} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusIconWrap}>
                <Ionicons
                  name={isConnected ? "checkmark-circle" : "card-outline"}
                  size={40}
                  color={isConnected ? TEAL : MUTED}
                />
              </View>
              <Text style={styles.statusTitle}>
                {isConnected
                  ? t("stripe.connected_status")
                  : t("stripe.not_connected_status")}
              </Text>
              <Text style={styles.statusBody}>
                {isConnected
                  ? t("stripe.connected_description")
                  : t("stripe.connect_description")}
              </Text>
            </View>

            {isConnected ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleConnect}
                  disabled={connecting}
                >
                  <Text style={styles.secondaryBtnText}>
                    {connecting ? "…" : t("stripe.continue_onboarding")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleDisconnect}>
                  <Text style={styles.dangerBtnText}>{t("stripe.disconnect_button")}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleConnect}
                disabled={connecting}
              >
                <Text style={styles.primaryBtnText}>
                  {connecting ? "…" : t("stripe.connect_button")}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.footnote}>{t("stripe.footnote")}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: typography.sectionHeader, fontWeight: typography.bold, color: NAVY },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  statusCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: "center",
    gap: 10,
  },
  statusIconWrap: { marginBottom: 6 },
  statusTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    textAlign: "center",
  },
  statusBody: {
    fontSize: typography.body,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },

  primaryBtn: {
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: TEAL,
  },
  secondaryBtnText: { color: TEAL, fontSize: typography.body, fontWeight: typography.bold },
  dangerBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  dangerBtnText: { color: "#B91C1C", fontSize: typography.body, fontWeight: typography.bold },
  footnote: {
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 8,
  },
});
