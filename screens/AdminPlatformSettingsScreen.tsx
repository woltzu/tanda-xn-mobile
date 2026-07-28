// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminPlatformSettingsScreen.tsx — admin Bucket C mod 8
// ═══════════════════════════════════════════════════════════════════════════
//
// Platform-wide admin settings: feature flags, notification templates,
// system config, admin user roster. Route name is AdminPlatformSettings
// (NOT AdminSettings — that one already exists for per-circle governance
// and takes circleId params).
//
// Defensive table reads: notification_templates and system_config are
// queried with a try/empty fallback because they may not exist in the
// current schema; the screen still renders the other sections.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  TextInput,
  Modal,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface FeatureGate {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

// Mig 393 — override + audit history returned by get_feature_gate_history.
interface FeatureOverrideRow {
  override_id: string;
  user_id: string;
  user_name: string | null;
  access_granted: boolean;
  reason: string | null;
  granted_by: string | null;
  granted_by_name: string | null;
  expires_at: string | null;
  created_at: string;
  expired: boolean;
}
interface FeatureAuditRow {
  id: string;
  admin_id: string | null;
  admin_name: string | null;
  action: string;
  entity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
}
interface PlatformSettings {
  scoring_frozen: boolean;
  scoring_frozen_reason: string | null;
  scoring_frozen_at: string | null;
  payouts_paused: boolean;
  payouts_paused_reason: string | null;
  payouts_paused_at: string | null;
}

interface NotifTemplate {
  id: string;
  type: string;
  title: string;
  body: string;
}

interface SysConfig {
  key: string;
  value: string;
}

interface AdminUserRow {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

const SETTABLE_ROLES = ["super_admin", "admin", "support", "viewer"] as const;
type SettableRole = (typeof SETTABLE_ROLES)[number];

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

export default function AdminPlatformSettingsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [features, setFeatures] = useState<FeatureGate[]>([]);
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [config, setConfig] = useState<SysConfig[]>([]);
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editTemplate, setEditTemplate] = useState<NotifTemplate | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  const [addAdminVisible, setAddAdminVisible] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<SettableRole>("support");

  // Mig 393 — platform kill switches + reason-prompt for feature toggle +
  // per-gate details modal (audit + overrides + grant form).
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [pendingToggle, setPendingToggle] = useState<
    | { kind: "feature"; feature: FeatureGate; nextEnabled: boolean }
    | { kind: "platform"; setting: "scoring_frozen" | "payouts_paused"; nextEnabled: boolean }
    | null
  >(null);
  const [pendingReason, setPendingReason] = useState("");
  const [pendingSaving, setPendingSaving] = useState(false);

  const [detailsFor, setDetailsFor] = useState<FeatureGate | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOverrides, setDetailsOverrides] = useState<FeatureOverrideRow[]>([]);
  const [detailsHistory, setDetailsHistory] = useState<FeatureAuditRow[]>([]);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAccess, setGrantAccess] = useState<boolean>(true);
  const [grantReason, setGrantReason] = useState("");
  const [grantExpiresDays, setGrantExpiresDays] = useState("");
  const [grantSaving, setGrantSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const callerRowP = supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const gatesP = supabase
        .from("feature_gates")
        .select("id, name, description, enabled")
        .order("display_order", { ascending: true });

      const adminsP = supabase
        .from("admin_users")
        .select("id, user_id, role, profiles:user_id(full_name, email)")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      const templatesP = supabase
        .from("notification_templates")
        .select("id, type, title, body")
        .limit(50);

      const configP = supabase
        .from("system_config")
        .select("key, value")
        .limit(50);

      const platformP = supabase
        .from("platform_settings")
        .select(
          "scoring_frozen, scoring_frozen_reason, scoring_frozen_at, payouts_paused, payouts_paused_reason, payouts_paused_at",
        )
        .eq("id", 1)
        .maybeSingle();

      const [callerR, gatesR, adminsR, templatesR, configR, platformR] = await Promise.all([
        callerRowP,
        gatesP,
        adminsP,
        templatesP,
        configP,
        platformP,
      ]);

      setCallerRole(((callerR.data as any) || {}).role ?? null);
      setFeatures(((gatesR.data ?? []) as FeatureGate[]) || []);
      setPlatform((platformR.data as PlatformSettings | null) ?? null);

      const adminRows = ((adminsR.data ?? []) as any[]).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        full_name: r.profiles?.full_name ?? null,
        email: r.profiles?.email ?? null,
      }));
      setAdmins(adminRows);

      // Templates and config: silent fallback if the table doesn't exist.
      setTemplates(templatesR.error ? [] : ((templatesR.data ?? []) as NotifTemplate[]));
      setConfig(configR.error ? [] : ((configR.data ?? []) as SysConfig[]));
    } catch (err) {
      console.warn("[AdminPlatformSettings] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canManageAdmins = callerRole === "super_admin";

  // Mig 393 — toggle now opens a reason prompt instead of firing directly.
  // The confirmed submit calls admin_toggle_feature_gate which writes an
  // admin_audit_log row alongside the mutation.
  const requestToggleFeature = useCallback(
    (gate: FeatureGate, next: boolean) => {
      setPendingToggle({ kind: "feature", feature: gate, nextEnabled: next });
      setPendingReason("");
    },
    [],
  );

  const requestTogglePlatform = useCallback(
    (setting: "scoring_frozen" | "payouts_paused", next: boolean) => {
      setPendingToggle({ kind: "platform", setting, nextEnabled: next });
      setPendingReason("");
    },
    [],
  );

  const confirmPendingToggle = useCallback(async () => {
    if (!pendingToggle) return;
    const reason = pendingReason.trim();
    if (!reason) {
      showToast(t("admin.settings.reason_required"), "error");
      return;
    }
    setPendingSaving(true);
    try {
      if (pendingToggle.kind === "feature") {
        const { error } = await supabase.rpc("admin_toggle_feature_gate", {
          p_feature_id: pendingToggle.feature.id,
          p_enabled: pendingToggle.nextEnabled,
          p_reason: reason,
        });
        if (error) throw new Error(error.message);
        setFeatures((prev) =>
          prev.map((g) =>
            g.id === pendingToggle.feature.id
              ? { ...g, enabled: pendingToggle.nextEnabled }
              : g,
          ),
        );
      } else {
        const { error } = await supabase.rpc("admin_toggle_platform_setting", {
          p_setting: pendingToggle.setting,
          p_enabled: pendingToggle.nextEnabled,
          p_reason: reason,
        });
        if (error) throw new Error(error.message);
        setPlatform((prev) => {
          if (!prev) return prev;
          if (pendingToggle.setting === "scoring_frozen") {
            return {
              ...prev,
              scoring_frozen: pendingToggle.nextEnabled,
              scoring_frozen_reason: pendingToggle.nextEnabled ? reason : null,
              scoring_frozen_at: pendingToggle.nextEnabled
                ? new Date().toISOString()
                : null,
            };
          }
          return {
            ...prev,
            payouts_paused: pendingToggle.nextEnabled,
            payouts_paused_reason: pendingToggle.nextEnabled ? reason : null,
            payouts_paused_at: pendingToggle.nextEnabled
              ? new Date().toISOString()
              : null,
          };
        });
      }
      showToast(t("admin.settings.toggle_saved"), "success");
      setPendingToggle(null);
      setPendingReason("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(t("admin.settings.toggle_failed_msg", { msg }), "error");
    } finally {
      setPendingSaving(false);
    }
  }, [pendingToggle, pendingReason, t]);

  // Feature details modal — load overrides + audit history.
  const openFeatureDetails = useCallback(async (gate: FeatureGate) => {
    setDetailsFor(gate);
    setGrantEmail("");
    setGrantAccess(true);
    setGrantReason("");
    setGrantExpiresDays("");
    setDetailsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_feature_gate_history", {
        p_feature_id: gate.id,
        p_limit: 20,
      });
      if (error) throw new Error(error.message);
      const payload = data as
        | {
            overrides: FeatureOverrideRow[];
            history: FeatureAuditRow[];
          }
        | null;
      setDetailsOverrides(payload?.overrides ?? []);
      setDetailsHistory(payload?.history ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error");
      setDetailsOverrides([]);
      setDetailsHistory([]);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const refreshDetails = useCallback(async () => {
    if (!detailsFor) return;
    await openFeatureDetails(detailsFor);
  }, [detailsFor, openFeatureDetails]);

  const submitGrant = useCallback(async () => {
    if (!detailsFor) return;
    const email = grantEmail.trim().toLowerCase();
    const reason = grantReason.trim();
    if (!email) {
      showToast(t("admin.settings.grant_email_required"), "error");
      return;
    }
    if (!reason) {
      showToast(t("admin.settings.reason_required"), "error");
      return;
    }
    setGrantSaving(true);
    try {
      const { data: profile, error: lookupErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (lookupErr || !profile?.id) {
        showToast(t("admin.settings.user_not_found"), "error");
        setGrantSaving(false);
        return;
      }
      let expiresAt: string | null = null;
      const daysNum = parseInt(grantExpiresDays, 10);
      if (Number.isFinite(daysNum) && daysNum > 0) {
        expiresAt = new Date(Date.now() + daysNum * 86400_000).toISOString();
      }
      const { error } = await supabase.rpc("admin_grant_feature_override", {
        p_feature_id: detailsFor.id,
        p_user_id: profile.id,
        p_access_granted: grantAccess,
        p_reason: reason,
        p_expires_at: expiresAt,
      });
      if (error) throw new Error(error.message);
      showToast(t("admin.settings.grant_saved"), "success");
      setGrantEmail("");
      setGrantReason("");
      setGrantExpiresDays("");
      await refreshDetails();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error");
    } finally {
      setGrantSaving(false);
    }
  }, [detailsFor, grantEmail, grantAccess, grantReason, grantExpiresDays, refreshDetails, t]);

  const revokeOverride = useCallback(
    async (row: FeatureOverrideRow) => {
      if (!detailsFor) return;
      const ok = await platformConfirm(
        t("admin.settings.revoke_confirm", {
          name: row.user_name ?? row.user_id.slice(0, 8),
        }),
      );
      if (!ok) return;
      try {
        const { error } = await supabase.rpc("admin_revoke_feature_override", {
          p_feature_id: detailsFor.id,
          p_user_id: row.user_id,
          p_reason: "Revoked via admin console",
        });
        if (error) throw new Error(error.message);
        showToast(t("admin.settings.revoke_saved"), "success");
        await refreshDetails();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(msg, "error");
      }
    },
    [detailsFor, refreshDetails, t],
  );

  const openEditTemplate = (tpl: NotifTemplate) => {
    setEditTemplate(tpl);
    setEditTitle(tpl.title || "");
    setEditBody(tpl.body || "");
  };

  const saveTemplate = async () => {
    if (!editTemplate) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_templates")
        .update({ title: editTitle, body: editBody })
        .eq("id", editTemplate.id);
      if (error) throw new Error(error.message);
      setTemplates((prev) =>
        prev.map((p) =>
          p.id === editTemplate.id ? { ...p, title: editTitle, body: editBody } : p,
        ),
      );
      showToast(t("admin.settings.template_saved"), "success");
      setEditTemplate(null);
    } catch (err) {
      console.warn("[AdminPlatformSettings] save template failed:", err);
      showToast(t("admin.settings.template_save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const addAdmin = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setSaving(true);
    try {
      const { data: profile, error: lookupErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (lookupErr || !profile?.id) {
        showToast(t("admin.settings.user_not_found"), "error");
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("admin_users").insert({
        user_id: profile.id,
        role: newRole,
        is_active: true,
      });
      if (error) throw new Error(error.message);
      showToast(t("admin.settings.admin_added"), "success");
      setAddAdminVisible(false);
      setNewEmail("");
      setNewRole("support");
      await load();
    } catch (err) {
      console.warn("[AdminPlatformSettings] add admin failed:", err);
      showToast(t("admin.settings.admin_add_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (row: AdminUserRow) => {
    const ok = await platformConfirm(t("admin.settings.remove_confirm"));
    if (!ok) return;
    const { error } = await supabase
      .from("admin_users")
      .update({ is_active: false })
      .eq("id", row.id);
    if (error) {
      showToast(t("admin.settings.admin_remove_failed"), "error");
      return;
    }
    setAdmins((prev) => prev.filter((a) => a.id !== row.id));
    showToast(t("admin.settings.admin_removed"), "success");
  };

  const featureLabelKey = useMemo(
    () => ({
      cross_border: "admin.settings.cross_border",
      loans: "admin.settings.loans",
      provider_network: "admin.settings.provider_network",
      trip_escrow: "admin.settings.trip_escrow",
    }),
    [],
  );

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.mutedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.settings.title")}</Text>
        <TouchableOpacity onPress={load} style={styles.headerBtn} disabled={loading}>
          <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator size="small" color={TEAL} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Mig 393 — Platform kill switches (scoring / payouts).
                Sits at the top so an admin dropping in during an
                incident sees the two big red buttons first. Both
                toggles route through admin_toggle_platform_setting
                which writes an admin_audit_log row. */}
            <Section title={t("admin.settings.kill_switches")}>
              {!platform ? (
                <Text style={styles.emptyText}>
                  {t("admin.settings.kill_switches_unavailable")}
                </Text>
              ) : (
                <>
                  <View style={[styles.row, styles.rowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>
                        {t("admin.settings.kill_scoring")}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={2}>
                        {platform.scoring_frozen && platform.scoring_frozen_reason
                          ? t("admin.settings.kill_reason", {
                              reason: platform.scoring_frozen_reason,
                            })
                          : t("admin.settings.kill_scoring_hint")}
                      </Text>
                    </View>
                    <Switch
                      value={platform.scoring_frozen}
                      onValueChange={(v) =>
                        requestTogglePlatform("scoring_frozen", v)
                      }
                      trackColor={{ false: "#E5E7EB", true: "#DC2626" }}
                    />
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>
                        {t("admin.settings.kill_payouts")}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={2}>
                        {platform.payouts_paused && platform.payouts_paused_reason
                          ? t("admin.settings.kill_reason", {
                              reason: platform.payouts_paused_reason,
                            })
                          : t("admin.settings.kill_payouts_hint")}
                      </Text>
                    </View>
                    <Switch
                      value={platform.payouts_paused}
                      onValueChange={(v) =>
                        requestTogglePlatform("payouts_paused", v)
                      }
                      trackColor={{ false: "#E5E7EB", true: "#DC2626" }}
                    />
                  </View>
                </>
              )}
            </Section>

            {/* a. Feature flags */}
            <Section title={t("admin.settings.feature_flags")}>
              {features.length === 0 ? (
                <Text style={styles.emptyText}>{t("admin.settings.no_features")}</Text>
              ) : (
                features.map((f, i) => {
                  const label =
                    (featureLabelKey as Record<string, string>)[f.name];
                  return (
                    <View
                      key={f.id}
                      style={[styles.row, i < features.length - 1 && styles.rowBorder]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>
                          {label ? t(label) : f.name}
                        </Text>
                        {f.description ? (
                          <Text style={styles.rowMeta} numberOfLines={2}>
                            {f.description}
                          </Text>
                        ) : null}
                      </View>
                      <Switch
                        value={!!f.enabled}
                        onValueChange={(v) => requestToggleFeature(f, v)}
                        trackColor={{ false: "#E5E7EB", true: TEAL }}
                      />
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => openFeatureDetails(f)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.smallBtnText}>
                          {t("admin.settings.details")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </Section>

            {/* b. Notification templates */}
            <Section title={t("admin.settings.notification_templates")}>
              {templates.length === 0 ? (
                <Text style={styles.emptyText}>{t("admin.settings.no_templates")}</Text>
              ) : (
                templates.map((tpl, i) => (
                  <View
                    key={tpl.id}
                    style={[styles.row, i < templates.length - 1 && styles.rowBorder]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{tpl.type}</Text>
                      <Text style={styles.rowMeta} numberOfLines={2}>
                        {tpl.title}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.smallBtn}
                      onPress={() => openEditTemplate(tpl)}
                    >
                      <Text style={styles.smallBtnText}>{t("admin.settings.edit")}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </Section>

            {/* c. System configuration */}
            <Section title={t("admin.settings.system_config")}>
              {config.length === 0 ? (
                <Text style={styles.emptyText}>{t("admin.settings.no_config")}</Text>
              ) : (
                config.map((c, i) => (
                  <View
                    key={c.key}
                    style={[styles.row, i < config.length - 1 && styles.rowBorder]}
                  >
                    <Text style={styles.rowName}>{c.key}</Text>
                    <Text
                      style={[styles.rowMeta, { textAlign: "right", maxWidth: "60%" }]}
                      numberOfLines={2}
                    >
                      {c.value}
                    </Text>
                  </View>
                ))
              )}
            </Section>

            {/* d. Admin users */}
            <Section
              title={t("admin.settings.admin_users")}
              right={
                canManageAdmins ? (
                  <TouchableOpacity
                    style={styles.headerCtaBtn}
                    onPress={() => setAddAdminVisible(true)}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.headerCtaText}>
                      {t("admin.settings.add_admin")}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            >
              {admins.length === 0 ? (
                <Text style={styles.emptyText}>{t("admin.settings.no_admins")}</Text>
              ) : (
                admins.map((a, i) => (
                  <View
                    key={a.id}
                    style={[styles.row, i < admins.length - 1 && styles.rowBorder]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>
                        {a.full_name || a.email || a.user_id.slice(0, 8)}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {a.email ?? "—"} ·{" "}
                        {t(`admin.settings.role_${a.role}`, a.role)}
                      </Text>
                    </View>
                    {canManageAdmins && a.user_id !== user?.id ? (
                      <TouchableOpacity
                        style={styles.dangerBtn}
                        onPress={() => removeAdmin(a)}
                      >
                        <Text style={styles.dangerBtnText}>
                          {t("admin.settings.remove_admin")}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>

      {/* Edit template modal */}
      <Modal
        visible={!!editTemplate}
        animationType="slide"
        transparent
        onRequestClose={() => setEditTemplate(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editTemplate?.type ?? ""}</Text>
            <Text style={styles.modalLabel}>{t("admin.settings.template_title")}</Text>
            <TextInput
              style={styles.modalInput}
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <Text style={styles.modalLabel}>{t("admin.settings.template_body")}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              value={editBody}
              onChangeText={setEditBody}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => setEditTemplate(null)}
                disabled={saving}
              >
                <Text style={styles.modalSecondaryText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={saveTemplate}
                disabled={saving}
              >
                <Text style={styles.modalPrimaryText}>
                  {saving ? "…" : t("admin.settings.save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mig 393 — Pending toggle confirm modal. Fires for BOTH feature
          gates and platform kill switches. Reason is required by every
          admin_toggle_* RPC so the audit trail is never empty. */}
      <Modal
        visible={!!pendingToggle}
        animationType="fade"
        transparent
        onRequestClose={() => (pendingSaving ? null : setPendingToggle(null))}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pendingToggle?.kind === "feature"
                ? t(
                    pendingToggle.nextEnabled
                      ? "admin.settings.confirm_enable_title"
                      : "admin.settings.confirm_disable_title",
                    { name: pendingToggle.feature.name },
                  )
                : pendingToggle
                ? t(
                    pendingToggle.nextEnabled
                      ? "admin.settings.confirm_kill_on_title"
                      : "admin.settings.confirm_kill_off_title",
                    { name: t(`admin.settings.kill_${pendingToggle.setting}`) },
                  )
                : ""}
            </Text>
            <Text style={styles.modalLabel}>
              {t("admin.settings.confirm_reason_label")}
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              value={pendingReason}
              onChangeText={setPendingReason}
              placeholder={t("admin.settings.confirm_reason_placeholder")}
              placeholderTextColor={MUTED}
              multiline
              editable={!pendingSaving}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => setPendingToggle(null)}
                disabled={pendingSaving}
              >
                <Text style={styles.modalSecondaryText}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={confirmPendingToggle}
                disabled={pendingSaving || !pendingReason.trim()}
              >
                <Text style={styles.modalPrimaryText}>
                  {pendingSaving ? "…" : t("admin.settings.confirm_apply")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mig 393 — Per-feature details modal.
          Shows current per-user overrides (with revoke), recent audit
          entries (last 20), and a grant form to add a new override. */}
      <Modal
        visible={!!detailsFor}
        animationType="slide"
        transparent
        onRequestClose={() => (grantSaving ? null : setDetailsFor(null))}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "90%" }]}>
            <Text style={styles.modalTitle}>
              {detailsFor
                ? t("admin.settings.details_title", {
                    name: detailsFor.name,
                  })
                : ""}
            </Text>
            <ScrollView style={{ maxHeight: 520 }}>
              {detailsLoading ? (
                <ActivityIndicator size="small" color={TEAL} style={{ marginTop: 20 }} />
              ) : (
                <>
                  {/* Overrides */}
                  <Text style={styles.detailsSection}>
                    {t("admin.settings.overrides_title", {
                      count: detailsOverrides.length,
                    })}
                  </Text>
                  {detailsOverrides.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {t("admin.settings.overrides_empty")}
                    </Text>
                  ) : (
                    detailsOverrides.map((o) => (
                      <View key={o.override_id} style={styles.detailsRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {o.user_name ?? o.user_id.slice(0, 8) + "…"}
                          </Text>
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {o.access_granted
                              ? t("admin.settings.override_granted")
                              : t("admin.settings.override_denied")}
                            {o.expires_at
                              ? " · " +
                                (o.expired
                                  ? t("admin.settings.override_expired")
                                  : t("admin.settings.override_expires_at", {
                                      date: new Date(o.expires_at).toLocaleDateString(),
                                    }))
                              : ""}
                          </Text>
                          {o.reason ? (
                            <Text style={styles.rowMeta} numberOfLines={2}>
                              "{o.reason}"
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.dangerBtn}
                          onPress={() => revokeOverride(o)}
                        >
                          <Text style={styles.dangerBtnText}>
                            {t("admin.settings.override_revoke")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  {/* Grant form */}
                  <Text style={styles.detailsSection}>
                    {t("admin.settings.grant_title")}
                  </Text>
                  <Text style={styles.modalLabel}>
                    {t("admin.settings.grant_email_label")}
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    value={grantEmail}
                    onChangeText={setGrantEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="user@example.com"
                    placeholderTextColor={MUTED}
                    editable={!grantSaving}
                  />
                  <View style={styles.roleRow}>
                    <TouchableOpacity
                      style={[styles.roleChip, grantAccess && styles.roleChipActive]}
                      onPress={() => setGrantAccess(true)}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          grantAccess && styles.roleChipTextActive,
                        ]}
                      >
                        {t("admin.settings.grant_access_true")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleChip, !grantAccess && styles.roleChipActive]}
                      onPress={() => setGrantAccess(false)}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          !grantAccess && styles.roleChipTextActive,
                        ]}
                      >
                        {t("admin.settings.grant_access_false")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalLabel}>
                    {t("admin.settings.grant_expires_label")}
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    value={grantExpiresDays}
                    onChangeText={setGrantExpiresDays}
                    keyboardType="numeric"
                    placeholder={t("admin.settings.grant_expires_placeholder")}
                    placeholderTextColor={MUTED}
                    editable={!grantSaving}
                  />
                  <Text style={styles.modalLabel}>
                    {t("admin.settings.grant_reason_label")}
                  </Text>
                  <TextInput
                    style={[styles.modalInput, styles.modalInputMulti]}
                    value={grantReason}
                    onChangeText={setGrantReason}
                    placeholder={t("admin.settings.grant_reason_placeholder")}
                    placeholderTextColor={MUTED}
                    multiline
                    editable={!grantSaving}
                  />
                  <TouchableOpacity
                    style={[styles.modalPrimary, { marginTop: 12, alignSelf: "flex-start" }]}
                    onPress={submitGrant}
                    disabled={grantSaving || !grantEmail.trim() || !grantReason.trim()}
                  >
                    <Text style={styles.modalPrimaryText}>
                      {grantSaving ? "…" : t("admin.settings.grant_submit")}
                    </Text>
                  </TouchableOpacity>

                  {/* Recent audit */}
                  <Text style={styles.detailsSection}>
                    {t("admin.settings.history_title")}
                  </Text>
                  {detailsHistory.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {t("admin.settings.history_empty")}
                    </Text>
                  ) : (
                    detailsHistory.slice(0, 10).map((h) => (
                      <View key={h.id} style={styles.detailsAuditRow}>
                        <Text style={styles.rowMeta}>
                          {h.action} ·{" "}
                          {h.admin_name ??
                            (h.admin_id ? h.admin_id.slice(0, 8) + "…" : "—")}
                          {" · "}
                          {new Date(h.created_at).toLocaleString()}
                        </Text>
                        {h.details ? (
                          <Text style={styles.rowMeta} numberOfLines={2}>
                            {(h.details as any).reason ?? ""}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => setDetailsFor(null)}
                disabled={grantSaving}
              >
                <Text style={styles.modalSecondaryText}>
                  {t("common.close")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add admin modal */}
      <Modal
        visible={addAdminVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddAdminVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("admin.settings.add_admin")}</Text>
            <Text style={styles.modalLabel}>{t("admin.settings.email_placeholder")}</Text>
            <TextInput
              style={styles.modalInput}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="user@example.com"
              placeholderTextColor={MUTED}
            />
            <Text style={styles.modalLabel}>{t("admin.settings.role_label")}</Text>
            <View style={styles.roleRow}>
              {SETTABLE_ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, newRole === r && styles.roleChipActive]}
                  onPress={() => setNewRole(r)}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      newRole === r && styles.roleChipTextActive,
                    ]}
                  >
                    {t(`admin.settings.role_${r}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => setAddAdminVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalSecondaryText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={addAdmin}
                disabled={saving || !newEmail.trim()}
              >
                <Text style={styles.modalPrimaryText}>
                  {saving ? "…" : t("admin.settings.add_admin")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
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

  section: { gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F3F4F6" },
  rowName: { fontSize: typography.body, color: NAVY, fontWeight: typography.medium },
  rowMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  emptyText: {
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    padding: spacing.md,
    fontStyle: "italic",
  },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 8,
  },
  smallBtnText: { fontSize: typography.label, color: TEAL, fontWeight: typography.bold },
  dangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  dangerBtnText: { fontSize: typography.label, color: "#B91C1C", fontWeight: typography.bold },
  headerCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  headerCtaText: { color: "#FFFFFF", fontSize: typography.label, fontWeight: typography.bold },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: spacing.lg,
    gap: 8,
  },
  modalTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: typography.label,
    color: MUTED,
    marginTop: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.body,
    color: NAVY,
  },
  modalInputMulti: { minHeight: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },
  modalSecondary: { paddingHorizontal: 16, paddingVertical: 10 },
  modalSecondaryText: { color: MUTED, fontSize: typography.body, fontWeight: typography.bold },
  modalPrimary: {
    backgroundColor: TEAL,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalPrimaryText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },

  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  roleChipActive: { backgroundColor: TEAL, borderColor: TEAL },
  roleChipText: { fontSize: typography.label, color: NAVY },
  roleChipTextActive: { color: "#FFFFFF", fontWeight: typography.bold },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },

  // Mig 393 — feature details modal
  detailsSection: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 6,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F3F4F6",
    gap: 8,
  },
  detailsAuditRow: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F3F4F6",
    gap: 2,
  },
});
