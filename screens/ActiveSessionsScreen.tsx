// ═══════════════════════════════════════════════════════════════════════════
// screens/ActiveSessionsScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════
//
// Real sessions list. Backed by:
//   - get_my_sessions()  RPC (migration 285) → row per auth.sessions
//   - revoke_my_session(session_id) RPC (migration 285) → per-row revoke
//   - supabase.auth.signOut({ scope: 'others' }) → log out all other sessions
//
// The current session is identified by decoding the access-token JWT to
// pull the session_id claim (Supabase stamps it). If the decode fails
// (rare — RN Hermes 0.70+ has atob), we fall back to the row with the
// max updated_at as the current-session heuristic. Revoke is hidden for
// the current row so the user can't accidentally sign themselves out
// from a per-row action; use the sign-out flow for that.
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
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";
import { colors, radius, spacing, typography } from "../theme/tokens";

type ActiveSessionsNavigationProp = StackNavigationProp<RootStackParamList>;

type SessionRow = {
  session_id: string;
  created_at: string | null;
  updated_at: string | null;
  user_agent: string | null;
  ip: string | null;
  aal: string | null;
  not_after: string | null;
  factor_id: string | null;
};

type DeviceType = "mobile" | "desktop" | "tablet" | "unknown";

// ── Helpers ──────────────────────────────────────────────────────────────

function parseUa(ua: string | null): { device: string; deviceType: DeviceType } {
  if (!ua) return { device: "", deviceType: "unknown" };
  const lower = ua.toLowerCase();

  // Native RN identifies as "okhttp" (Android) or "CFNetwork" (iOS)
  // with expo-managed clients. Match those first so we don't fall into
  // the desktop-browser branches.
  if (/expo|okhttp/.test(lower)) {
    if (/android/.test(lower)) return { device: "Android app", deviceType: "mobile" };
    if (/iphone|ios/.test(lower)) return { device: "iPhone app", deviceType: "mobile" };
    if (/ipad/.test(lower)) return { device: "iPad app", deviceType: "tablet" };
    return { device: "TandaXn app", deviceType: "mobile" };
  }

  if (/ipad/.test(lower)) return { device: "iPad", deviceType: "tablet" };
  if (/iphone/.test(lower)) return { device: "iPhone", deviceType: "mobile" };
  if (/android/.test(lower)) {
    return { device: /tablet/.test(lower) ? "Android tablet" : "Android", deviceType: /tablet/.test(lower) ? "tablet" : "mobile" };
  }
  if (/edg\//.test(lower)) return { device: "Edge · desktop", deviceType: "desktop" };
  if (/chrome/.test(lower)) return { device: "Chrome · desktop", deviceType: "desktop" };
  if (/firefox/.test(lower)) return { device: "Firefox · desktop", deviceType: "desktop" };
  if (/safari/.test(lower)) return { device: "Safari · desktop", deviceType: "desktop" };
  if (/mac os|macintosh/.test(lower)) return { device: "Mac", deviceType: "desktop" };
  if (/windows/.test(lower)) return { device: "Windows PC", deviceType: "desktop" };

  return { device: "", deviceType: "unknown" };
}

function maskIp(ip: string | null): string {
  if (!ip) return "—";
  // IPv4 → replace last octet.
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.x`;
  // IPv6 → keep first two groups + …
  const v6 = ip.split(":");
  if (v6.length > 2) return `${v6[0]}:${v6[1]}::…`;
  return ip;
}

function iconFor(t: DeviceType): keyof typeof Ionicons.glyphMap {
  switch (t) {
    case "mobile": return "phone-portrait";
    case "tablet": return "tablet-portrait";
    case "desktop": return "desktop";
    default: return "hardware-chip";
  }
}

function decodeSessionIdFromJwt(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    // JWT uses base64url; convert to base64 for atob.
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    const raw = typeof g.atob === "function" ? g.atob(padded) : null;
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

function formatDate(t: (k: string) => string, iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

// ── Screen ───────────────────────────────────────────────────────────────

export default function ActiveSessionsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ActiveSessionsNavigationProp>();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [rowsRes, sessionRes] = await Promise.all([
        supabase.rpc("get_my_sessions"),
        supabase.auth.getSession(),
      ]);
      if (rowsRes.error) throw rowsRes.error;
      const rows: SessionRow[] = Array.isArray(rowsRes.data) ? rowsRes.data : [];

      let cur = decodeSessionIdFromJwt(sessionRes.data.session?.access_token);
      // Fallback heuristic when the JWT couldn't be decoded — the row we
      // just updated (this GET) will have the newest updated_at.
      if (!cur && rows.length > 0) {
        const sorted = [...rows].sort((a, b) => {
          const av = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bv = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bv - av;
        });
        cur = sorted[0]?.session_id ?? null;
      }

      setSessions(rows);
      setCurrentId(cur);
    } catch (e: any) {
      console.warn("[ActiveSessions] load failed", e?.message);
      setError(e?.message ?? "Failed to load sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const handleRevoke = useCallback(
    (row: SessionRow) => {
      Alert.alert(
        t("sessions.revoke"),
        `${row.user_agent ?? t("sessions.device_unknown")}`,
        [
          { text: t("2fa.cancel"), style: "cancel" },
          {
            text: t("sessions.revoke"),
            style: "destructive",
            onPress: async () => {
              setBusyId(row.session_id);
              try {
                const { error: rpcErr } = await supabase.rpc(
                  "revoke_my_session",
                  { p_session_id: row.session_id },
                );
                if (rpcErr) throw rpcErr;
                showToast(t("sessions.revoke_success"), "success");
                await load();
              } catch (e: any) {
                Alert.alert(
                  t("sessions.title"),
                  e?.message ?? "Failed to revoke session",
                );
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [load, t],
  );

  const handleRevokeAll = useCallback(() => {
    Alert.alert(
      t("sessions.revoke_all"),
      t("final_polish.activesessions_log_out_confirm") ||
        "This will log you out from all other devices. You'll stay logged in on this device.",
      [
        { text: t("2fa.cancel"), style: "cancel" },
        {
          text: t("sessions.revoke_all"),
          style: "destructive",
          onPress: async () => {
            setBusyAll(true);
            try {
              const { error: sErr } = await supabase.auth.signOut({
                scope: "others",
              });
              if (sErr) throw sErr;
              showToast(t("sessions.revoke_all_success"), "success");
              await load();
            } catch (e: any) {
              Alert.alert(
                t("sessions.title"),
                e?.message ?? "Failed to log out other sessions",
              );
            } finally {
              setBusyAll(false);
            }
          },
        },
      ],
    );
  }, [load, t]);

  // ── Derived groupings ───────────────────────────────────────────────
  const current = sessions.find((s) => s.session_id === currentId);
  const others = sessions.filter((s) => s.session_id !== currentId);

  const renderRow = (row: SessionRow, isCurrent: boolean) => {
    const { device, deviceType } = parseUa(row.user_agent);
    const deviceLabel = device || t("sessions.device_unknown");
    const last = formatDate(t, row.updated_at ?? row.created_at);
    const revoking = busyId === row.session_id;
    return (
      <View
        key={row.session_id}
        style={[
          styles.sessionRow,
          isCurrent && styles.sessionRowCurrent,
        ]}
      >
        <View
          style={[
            styles.deviceIcon,
            isCurrent ? styles.deviceIconCurrent : styles.deviceIconOther,
          ]}
        >
          <Ionicons
            name={iconFor(deviceType)}
            size={22}
            color={isCurrent ? colors.accentTeal : colors.primaryNavy}
          />
        </View>
        <View style={styles.sessionContent}>
          <View style={styles.sessionTitleRow}>
            <Text style={styles.sessionDevice}>{deviceLabel}</Text>
            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>
                  {t("sessions.current")}
                </Text>
              </View>
            ) : null}
            {row.aal === "aal2" ? (
              <View style={styles.aalBadge}>
                <Text style={styles.aalBadgeText}>2FA</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sessionMeta}>{maskIp(row.ip)}</Text>
          <Text style={styles.sessionMeta}>
            {t("sessions.last_active", { date: last })}
          </Text>
        </View>
        {!isCurrent ? (
          <TouchableOpacity
            style={[styles.revokeBtn, revoking && styles.revokeBtnDisabled]}
            onPress={() => handleRevoke(row)}
            disabled={revoking || busyAll}
          >
            {revoking ? (
              <ActivityIndicator color={colors.errorText} size="small" />
            ) : (
              <Text style={styles.revokeBtnText}>{t("sessions.revoke")}</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <LinearGradient
          colors={[colors.primaryNavy, "#143654"]}
          style={[styles.header, { paddingTop: insets.top + spacing.md }]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.cardBg} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>{t("sessions.title")}</Text>
              <Text style={styles.headerSubtitle}>
                {sessions.length}{" "}
                {sessions.length === 1 ? "device" : "devices"}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accentTeal} />
            </View>
          ) : error ? (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={18} color={colors.warningAmber} />
              <Text style={styles.warningText}>{error}</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t("sessions.empty")}</Text>
            </View>
          ) : (
            <>
              {current ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t("final_polish.activesessions_this_device")}
                  </Text>
                  <View style={styles.card}>{renderRow(current, true)}</View>
                </View>
              ) : null}

              {others.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t("final_polish.activesessions_other_sessions")}
                  </Text>
                  <View style={styles.card}>
                    {others.map((s) => renderRow(s, false))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {others.length > 0 ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.revokeAllBtn,
              busyAll && styles.revokeBtnDisabled,
            ]}
            onPress={handleRevokeAll}
            disabled={busyAll}
          >
            {busyAll ? (
              <ActivityIndicator color={colors.errorText} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={colors.errorText} />
                <Text style={styles.revokeAllText}>
                  {t("sessions.revoke_all")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    // paddingTop = insets.top + spacing.md applied inline on LinearGradient.
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
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
    color: colors.cardBg,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  loading: {
    padding: 40,
    alignItems: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.screenBg,
  },
  sessionRowCurrent: {
    borderBottomWidth: 0,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceIconCurrent: { backgroundColor: colors.tealTintBg },
  deviceIconOther: { backgroundColor: colors.screenBg },
  sessionContent: { flex: 1 },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  sessionDevice: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  currentBadge: {
    backgroundColor: colors.accentTeal,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.cardBg,
  },
  aalBadge: {
    backgroundColor: "#DBEAFE",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  aalBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  sessionMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  revokeBtn: {
    backgroundColor: colors.errorBg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 76,
    alignItems: "center",
  },
  revokeBtnDisabled: { opacity: 0.5 },
  revokeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.errorText,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.warningBg,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: colors.warningLabel,
    lineHeight: 18,
  },
  emptyCard: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cardBg,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  revokeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.errorText,
    paddingVertical: 16,
    gap: 8,
  },
  revokeAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.errorText,
  },
});
