// ═══════════════════════════════════════════════════════════════════════════
// screens/ProfileVisibilitySettingsScreen.tsx — Doc 40 (mig 388)
// ═══════════════════════════════════════════════════════════════════════════
//
// Two sections:
//   1. Community visibility toggles — per Doc 40 §5.1, five categories
//      + a vouches-given toggle. Reads/writes profile_visibility_prefs.
//   2. Access log — Doc 40 §8. Lists rows from profile_access_log where
//      the caller is the target (RLS-gated).
//
// Reached from PrivacySettingsScreen → "Community visibility & access log".
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../components/Toast";

type PrefsKey =
  | "communities_geographic"
  | "communities_professional"
  | "communities_life_stage"
  | "communities_faith_religion"
  | "communities_identity_health"
  | "show_vouches_given";

type Prefs = Record<PrefsKey, boolean>;

const DEFAULTS: Prefs = {
  communities_geographic:      true,
  communities_professional:    true,
  communities_life_stage:      false,
  communities_faith_religion:  false,
  communities_identity_health: false,
  show_vouches_given:          true,
};

interface AccessLogRow {
  id: string;
  viewer_id: string;
  viewer_name: string | null;
  accessed_at: string;
  reason_code: string;
  accessed_fields: string[] | null;
}

const REASON_LABEL_KEY: Record<string, string> = {
  kyc_review:            "profile_visibility.reason_kyc_review",
  dispute_escalation:    "profile_visibility.reason_dispute_escalation",
  payout_investigation:  "profile_visibility.reason_payout_investigation",
  admin_audit:           "profile_visibility.reason_admin_audit",
  other:                 "profile_visibility.reason_other",
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function ProfileVisibilitySettingsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [log, setLog] = useState<AccessLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PrefsKey | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch prefs (may not exist yet — defaults apply).
      const [prefsRes, logRes] = await Promise.all([
        supabase
          .from("profile_visibility_prefs")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profile_access_log")
          .select("id, viewer_id, accessed_at, reason_code, accessed_fields, profiles:viewer_id(full_name, display_name)")
          .eq("target_user_id", user.id)
          .order("accessed_at", { ascending: false })
          .limit(100),
      ]);
      if (prefsRes.data) {
        setPrefs({
          communities_geographic:      !!prefsRes.data.communities_geographic,
          communities_professional:    !!prefsRes.data.communities_professional,
          communities_life_stage:      !!prefsRes.data.communities_life_stage,
          communities_faith_religion:  !!prefsRes.data.communities_faith_religion,
          communities_identity_health: !!prefsRes.data.communities_identity_health,
          show_vouches_given:          !!prefsRes.data.show_vouches_given,
        });
      } else {
        setPrefs(DEFAULTS);
      }
      const rows: AccessLogRow[] = ((logRes.data ?? []) as any[]).map((r) => ({
        id: r.id,
        viewer_id: r.viewer_id,
        viewer_name: r.profiles?.full_name ?? r.profiles?.display_name ?? null,
        accessed_at: r.accessed_at,
        reason_code: r.reason_code,
        accessed_fields: r.accessed_fields,
      }));
      setLog(rows);
    } catch (e) {
      Alert.alert(
        t("profile_visibility.load_error_title"),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (key: PrefsKey, next: boolean) => {
    if (!user?.id) return;
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving(key);
    try {
      // Upsert — on-demand row seeding per the mig 388 design.
      const patch: Record<string, unknown> = { user_id: user.id, [key]: next, updated_at: new Date().toISOString() };
      const { error: err } = await supabase
        .from("profile_visibility_prefs")
        .upsert(patch, { onConflict: "user_id" });
      if (err) throw new Error(err.message);
      showToast(t("profile_visibility.saved_toast"), "success");
    } catch (e) {
      // Rollback UI on failure.
      setPrefs((p) => ({ ...p, [key]: prev }));
      Alert.alert(
        t("profile_visibility.save_error_title"),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSaving(null);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.blockedText}>{t("profile_visibility.sign_in_required")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2342" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("profile_visibility.title")}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Section 1 — Community visibility */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="people-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("profile_visibility.communities_title")}</Text>
            </View>
            <Text style={styles.cardSubtitle}>{t("profile_visibility.communities_subtitle")}</Text>

            <ToggleRow
              label={t("profile_visibility.cat_geographic")}
              hint={t("profile_visibility.cat_geographic_hint")}
              value={prefs.communities_geographic}
              onChange={(v) => handleToggle("communities_geographic", v)}
              saving={saving === "communities_geographic"}
            />
            <ToggleRow
              label={t("profile_visibility.cat_professional")}
              hint={t("profile_visibility.cat_professional_hint")}
              value={prefs.communities_professional}
              onChange={(v) => handleToggle("communities_professional", v)}
              saving={saving === "communities_professional"}
            />
            <ToggleRow
              label={t("profile_visibility.cat_life_stage")}
              hint={t("profile_visibility.cat_life_stage_hint")}
              value={prefs.communities_life_stage}
              onChange={(v) => handleToggle("communities_life_stage", v)}
              saving={saving === "communities_life_stage"}
            />
            <ToggleRow
              label={t("profile_visibility.cat_faith")}
              hint={t("profile_visibility.cat_faith_hint")}
              value={prefs.communities_faith_religion}
              onChange={(v) => handleToggle("communities_faith_religion", v)}
              saving={saving === "communities_faith_religion"}
            />
            <ToggleRow
              label={t("profile_visibility.cat_identity_health")}
              hint={t("profile_visibility.cat_identity_health_hint")}
              value={prefs.communities_identity_health}
              onChange={(v) => handleToggle("communities_identity_health", v)}
              saving={saving === "communities_identity_health"}
              lastRow
            />
          </View>

          {/* Section 2 — Vouches */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="ribbon-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("profile_visibility.vouches_title")}</Text>
            </View>
            <ToggleRow
              label={t("profile_visibility.vouches_toggle")}
              hint={t("profile_visibility.vouches_hint")}
              value={prefs.show_vouches_given}
              onChange={(v) => handleToggle("show_vouches_given", v)}
              saving={saving === "show_vouches_given"}
              lastRow
            />
          </View>

          {/* Section 3 — Access log */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="eye-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("profile_visibility.access_log_title", { count: log.length })}
              </Text>
            </View>
            <Text style={styles.cardSubtitle}>{t("profile_visibility.access_log_subtitle")}</Text>
            {log.length === 0 ? (
              <Text style={styles.emptyText}>{t("profile_visibility.access_log_empty")}</Text>
            ) : (
              log.map((entry) => (
                <View key={entry.id} style={styles.logRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logViewer}>
                      {entry.viewer_name ?? "—"}
                    </Text>
                    <Text style={styles.logMeta}>
                      {t(REASON_LABEL_KEY[entry.reason_code] ?? "profile_visibility.reason_other")}
                      {" · "}
                      {fmtRelative(entry.accessed_at)}
                    </Text>
                    {entry.accessed_fields && entry.accessed_fields.length > 0 ? (
                      <Text style={styles.logFields}>
                        {t("profile_visibility.fields_accessed", {
                          fields: entry.accessed_fields.join(", "),
                        })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>{t("profile_visibility.footer_note")}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  saving,
  lastRow,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  saving: boolean;
  lastRow?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !lastRow && styles.toggleRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      {saving ? (
        <ActivityIndicator size="small" color={colors.accentTeal} />
      ) : (
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: "#E5E7EB", true: colors.accentTeal }}
          thumbColor="#FFFFFF"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: "#0A2342",
  },
  backBtn: {
    width: 38, height: 38,
    alignItems: "center", justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  scroll: { padding: 12 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.primaryNavy },
  cardSubtitle: {
    fontSize: 11, color: colors.textSecondary, fontStyle: "italic",
    marginTop: -2, marginBottom: 6,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  toggleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  toggleHint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  logRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logViewer: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  logMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  logFields: { fontSize: 11, color: colors.textPrimary, fontStyle: "italic", marginTop: 4 },

  emptyText: {
    fontSize: 12, color: colors.textSecondary, fontStyle: "italic",
    textAlign: "center", paddingVertical: 12,
  },
  blockedText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
  footer: {
    fontSize: 11, color: colors.textSecondary, textAlign: "center",
    padding: 12, lineHeight: 16,
  },
});
