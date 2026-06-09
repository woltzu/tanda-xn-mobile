// =============================================================================
// ReferralScreen -- show the user's referral code + stats, with a Share CTA.
//
// Flow:
//   1. On mount, query referral_codes for the current user via PostgREST
//      (owner_read_referral_codes policy lets authenticated users see
//      their own row).
//   2. If no code exists, call the generate-referral-code EF -- it mints
//      one server-side (with collision retries) and returns it. The EF
//      handles the race where two concurrent generates land on the same
//      user.
//   3. Show the code + a Share button (uses the React Native Share API
//      so no expo-sharing dep is needed for plain-text shares).
//   4. Show the user's stats: how many referrals they have, how many
//      completed, total cents credited from referral_rewards rows where
//      the user is the recipient.
//
// In-app errors land in an Alert; we never silently swallow.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Share,
  ActivityIndicator,
  Alert,
  Clipboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MUTED = "#6B7280";

type Stats = {
  totalReferrals: number;
  completed: number;
  pending: number;
  totalCentsEarned: number;
};

export default function ReferralScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalReferrals: 0,
    completed: 0,
    pending: 0,
    totalCentsEarned: 0,
  });

  // Combined fetch: code + stats. Run on mount and on manual refresh.
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Code (may be null on first visit).
      const { data: codeRow } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();
      setCode(codeRow?.code ?? null);

      // Stats: referrals where user is the referrer.
      const { data: refs } = await supabase
        .from("referrals")
        .select("status")
        .eq("referrer_id", user.id);

      const total = refs?.length ?? 0;
      const completed = (refs ?? []).filter((r) => r.status === "completed").length;
      const pending = (refs ?? []).filter((r) => r.status === "pending").length;

      // Rewards earned by THIS user (could be from being referred too).
      const { data: rewards } = await supabase
        .from("referral_rewards")
        .select("amount_cents")
        .eq("user_id", user.id);
      const totalCents = (rewards ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

      setStats({
        totalReferrals: total,
        completed,
        pending,
        totalCentsEarned: totalCents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t("referral.alert_could_not_load"), msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-referral-code");
      if (error) throw new Error(error.message);
      if (data?.code) {
        setCode(data.code);
      } else {
        throw new Error("No code returned");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t("referral.alert_could_not_generate"), msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      const message =
        `Join me on TandaXn -- save with people you trust. ` +
        `Use my code at sign-up: ${code}`;
      await Share.share({ message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t("referral.alert_could_not_share"), msg);
    }
  };

  const handleCopy = () => {
    if (!code) return;
    Clipboard.setString(code);
    Alert.alert(t("referral.alert_copied_title"), t("referral.alert_copied_body"));
  };

  const fmtDollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("screen_headers.referral")}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={refresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <View style={styles.heroCard}>
          <Ionicons name="gift" size={28} color={TEAL} />
          <Text style={styles.heroTitle}>{t("referral.hero_title")}</Text>
          <Text style={styles.heroBody}>
            {t("referral.hero_body")}
          </Text>
        </View>

        {/* Code block */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>{t("referral.code_label")}</Text>
          {loading ? (
            <View style={styles.codeLoading}>
              <ActivityIndicator color={TEAL} />
            </View>
          ) : code ? (
            <>
              <Text style={styles.codeValue} selectable accessibilityLabel={t("referral.code_a11y", { code })}>
                {code}
              </Text>
              <View style={styles.codeActions}>
                <TouchableOpacity
                  style={styles.codeActionBtn}
                  onPress={handleCopy}
                  accessibilityRole="button"
                  accessibilityLabel={t("referral.a11y_copy_code")}
                >
                  <Ionicons name="copy-outline" size={16} color={NAVY} />
                  <Text style={styles.codeActionText}>{t("referral.btn_copy")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.codeActionBtn, styles.codeActionPrimary]}
                  onPress={handleShare}
                  accessibilityRole="button"
                  accessibilityLabel={t("referral.a11y_share_code")}
                >
                  <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                  <Text style={[styles.codeActionText, { color: "#FFFFFF" }]}>{t("referral.btn_share")}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.generateBtn, generating && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={generating}
              accessibilityRole="button"
              accessibilityLabel={t("referral.a11y_generate")}
            >
              <Ionicons name="flash" size={16} color="#FFFFFF" />
              <Text style={styles.generateBtnText}>
                {generating ? t("referral.btn_generating") : t("referral.btn_generate")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{stats.totalReferrals}</Text>
            <Text style={styles.statLabel}>{t("referral.stat_referrals")}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>{t("referral.stat_completed")}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: TEAL }]}>
              {fmtDollars(stats.totalCentsEarned)}
            </Text>
            <Text style={styles.statLabel}>{t("referral.stat_earned")}</Text>
          </View>
        </View>

        {stats.pending > 0 ? (
          <View style={styles.pendingBox}>
            <Ionicons name="time-outline" size={16} color="#92400E" />
            <Text style={styles.pendingText}>
              {stats.pending === 1
                ? t("referral.pending_one", { count: stats.pending })
                : t("referral.pending_other", { count: stats.pending })}
            </Text>
          </View>
        ) : null}

        <View style={styles.howCard}>
          <Text style={styles.howTitle}>{t("referral.how_title")}</Text>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>1</Text>
            <Text style={styles.howText}>{t("referral.how_step_1")}</Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>2</Text>
            <Text style={styles.howText}>
              {t("referral.how_step_2")}
            </Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>3</Text>
            <Text style={styles.howText}>
              {t("referral.how_step_3")}
            </Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>4</Text>
            <Text style={styles.howText}>
              {t("referral.how_step_4")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: NAVY,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { flex: 1 },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  heroTitle: { fontSize: 18, fontWeight: "700", color: NAVY, marginTop: 4 },
  heroBody: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
  },

  codeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: 4,
    marginBottom: 12,
    fontFamily: "monospace",
  },
  codeLoading: { paddingVertical: 20 },
  codeActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  codeActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  codeActionPrimary: { backgroundColor: NAVY, borderColor: NAVY },
  codeActionText: { fontSize: 13, fontWeight: "700", color: NAVY },

  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: TEAL,
    marginTop: 6,
  },
  generateBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCell: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  statValue: { fontSize: 22, fontWeight: "700", color: NAVY },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 2, fontWeight: "600" },

  pendingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  pendingText: { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 18 },

  howCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  howTitle: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 10 },
  howRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  howNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BG,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "700",
    color: NAVY,
  },
  howText: { flex: 1, fontSize: 13, color: NAVY, lineHeight: 20 },
});
