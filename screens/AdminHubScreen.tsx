// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminHubScreen.tsx — admin landing hub (Bucket A)
// ═══════════════════════════════════════════════════════════════════════════
//
// Lightweight 8-module hub for admin/staff. Sits above the existing
// per-module admin screens (AdminVerificationQueue, AdminTemplateQueue,
// AdminModeration, AdminDashboard) and exposes them all from one
// place. Modules with no dedicated destination yet show a "coming soon"
// toast — placeholders to be wired in future buckets.
//
// Gating: useIsAdmin (server-side via the is_admin RPC, migration 114).
// A non-admin who lands here via deep link sees a locked frame.
//
// Naming note: spec said "AdminDashboard" but that route is already
// taken by the ADVANCE-006 portfolio monitor (DashboardScreen used in
// loan ops). This screen uses AdminHub as the route name so they
// coexist; the Overview module card here links to the existing
// AdminDashboard for portfolio metrics.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

type ModuleKey =
  | "overview"
  | "users"
  | "circles"
  | "trips"
  | "disputes"
  | "elders"
  | "kyc"
  | "settings";

type ModuleDef = {
  key: ModuleKey;
  icon: keyof typeof Ionicons.glyphMap;
  // Destination route — null means "no screen wired yet, show a toast".
  route: string | null;
};

const MODULES: ModuleDef[] = [
  { key: "overview", icon: "grid-outline",          route: "AdminDashboard" },
  { key: "users",    icon: "people-outline",        route: null },
  { key: "circles",  icon: "refresh-outline",       route: null },
  { key: "trips",    icon: "airplane-outline",      route: null },
  { key: "disputes", icon: "shield-half-outline",   route: "AdminModeration" },
  { key: "elders",   icon: "ribbon-outline",        route: "ElderDashboard" },
  { key: "kyc",      icon: "id-card-outline",       route: "AdminVerificationQueue" },
  { key: "settings", icon: "cog-outline",           route: null },
];

export default function AdminHubScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading } = useIsAdmin();

  const handlePress = (m: ModuleDef) => {
    if (m.route) {
      navigation.navigate(m.route);
    } else {
      showToast(t("admin.coming_soon"), "info");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <View style={styles.loadingFrame}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={NAVY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("admin.title")}</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.loadingFrame}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.lockedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          {MODULES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={styles.card}
              onPress={() => handlePress(m)}
              accessibilityRole="button"
            >
              <View style={styles.cardIconWrap}>
                <Ionicons name={m.icon} size={24} color={TEAL} />
              </View>
              <Text style={styles.cardLabel} numberOfLines={2}>
                {t(`admin.modules.${m.key}`)}
              </Text>
              {!m.route ? (
                <Text style={styles.cardSoon}>
                  {t("admin.coming_soon_chip")}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
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
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  scroll: { padding: spacing.lg },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  card: {
    width: "47%",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: "flex-start",
    minHeight: 120,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  cardLabel: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.bold,
  },
  cardSoon: {
    marginTop: 4,
    fontSize: typography.label,
    color: MUTED,
    fontStyle: "italic",
  },
  loadingFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  lockedText: {
    fontSize: typography.body,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
  },
});
