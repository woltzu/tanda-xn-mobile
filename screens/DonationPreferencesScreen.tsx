// =============================================================================
// DonationPreferencesScreen -- per-emoji micro-donation amount editor.
// Backed by user_reaction_preferences (migration 129). Reachable from
// Profile -> Donation Preferences.
//
// Loads the user's stored map via get_user_reaction_preferences (the
// RPC auto-creates the default row on first call). Each tap on +/-
// fires set_user_reaction_preference for that emoji so the server is
// always the source of truth -- no Save button needed.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MUTED = "#6B7280";

// Emojis we surface in the editor. The stored JSONB can carry any
// emoji the user has interacted with, but we show this curated list
// so new users get a sensible default + can dial in the common ones.
const EMOJI_LIST: string[] = ["🙏", "❤️", "🕊️", "🔥", "😢", "🌟"];

const STEPS = [1, 5, 10, 25, 100]; // cents per tap; bigger taps for bigger denominations

export default function DonationPreferencesScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_user_reaction_preferences");
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; preferences?: Record<string, number> };
      if (!r.success) throw new Error("Couldn't load preferences");
      setPrefs(r.preferences || {});
    } catch (err) {
      Alert.alert(t("final_polish.donationpreferences_alert_couldn_t_load"), err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const adjust = async (emoji: string, delta: number) => {
    const current = prefs[emoji] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setUpdating(emoji);
    // Optimistic.
    setPrefs((p) => ({ ...p, [emoji]: next }));
    try {
      const { error } = await supabase.rpc("set_user_reaction_preference", {
        p_emoji: emoji,
        p_amount_cents: next,
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      // Roll back on failure.
      setPrefs((p) => ({ ...p, [emoji]: current }));
      Alert.alert(t("final_polish.donationpreferences_alert_couldn_t_save"), err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(null);
    }
  };

  const fmt = (cents: number) =>
    cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents}¢`;

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
        <Text style={styles.headerTitle}>{t("screen_headers.donation_preferences")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.hero}>
          <Ionicons name="heart" size={20} color={TEAL} />
          <Text style={styles.heroTitle}>Set per-reaction giving</Text>
          <Text style={styles.heroBody}>
            Tapping a reaction in a SyncStream room will deduct the amount
            below from your wallet. Set any to zero to react without giving.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={TEAL} />
          </View>
        ) : (
          EMOJI_LIST.map((emoji) => {
            const amount = prefs[emoji] ?? 0;
            const isUpdating = updating === emoji;
            return (
              <View key={emoji} style={styles.row}>
                <Text style={styles.rowEmoji}>{emoji}</Text>
                <View style={styles.rowMid}>
                  <Text style={styles.rowAmount}>{fmt(amount)}</Text>
                  <Text style={styles.rowLabel}>per reaction</Text>
                </View>
                <View style={styles.stepperGroup}>
                  {STEPS.map((step) => (
                    <View key={step} style={styles.stepCol}>
                      <TouchableOpacity
                        style={[styles.stepBtn, isUpdating && { opacity: 0.5 }]}
                        onPress={() => adjust(emoji, -step)}
                        disabled={isUpdating || amount === 0}
                        accessibilityLabel={`Decrease ${emoji} by ${step}`}
                      >
                        <Text style={styles.stepText}>−{step}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.stepBtn, styles.stepBtnPlus, isUpdating && { opacity: 0.5 }]}
                        onPress={() => adjust(emoji, +step)}
                        disabled={isUpdating}
                        accessibilityLabel={`Increase ${emoji} by ${step}`}
                      >
                        <Text style={[styles.stepText, { color: "#FFFFFF" }]}>
                          +{step}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.footnote}>
          Amounts are in cents and apply across every room. You can change them
          any time -- the new amount takes effect on the very next tap.
        </Text>
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

  hero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  heroTitle: { fontSize: 15, fontWeight: "700", color: NAVY, marginTop: 4 },
  heroBody: { fontSize: 12, color: MUTED, textAlign: "center", lineHeight: 18 },

  loadingBox: { paddingVertical: 32, alignItems: "center" },

  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowEmoji: { fontSize: 30, width: 44, textAlign: "center" },
  rowMid: { flex: 1 },
  rowAmount: { fontSize: 18, fontWeight: "700", color: NAVY },
  rowLabel: { fontSize: 11, color: MUTED },

  stepperGroup: { flexDirection: "row", gap: 4 },
  stepCol: { flexDirection: "column", gap: 4 },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    minWidth: 36,
    alignItems: "center",
  },
  stepBtnPlus: { backgroundColor: NAVY, borderColor: NAVY },
  stepText: { fontSize: 11, fontWeight: "700", color: NAVY },

  footnote: {
    fontSize: 11,
    color: MUTED,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 17,
  },
});
