import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useAuth, getEmailRedirectUrl } from "../context/AuthContext";
import { useXnScore } from "../context/XnScoreContext";
import { useWalkthrough } from "../hooks/useWalkthrough";
import { supabase } from "../lib/supabase";

type SettingsNavigationProp = StackNavigationProp<RootStackParamList>;

interface SettingItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  route?: keyof RootStackParamList;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
}

export default function SettingsMainScreen() {
  const navigation = useNavigation<SettingsNavigationProp>();
  const { t } = useTranslation();
  const { user, logout, isEmailVerified } = useAuth();
  const { score } = useXnScore();
  const { resetAllWalkthroughs } = useWalkthrough();

  // Email-verification resend state. Lives at component scope so the
  // cooldown survives across re-renders; cleared automatically when
  // isEmailVerified flips true and the card stops rendering.
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailResent, setEmailResent] = useState(false);

  const handleResendVerificationEmail = async () => {
    if (!user?.email) {
      Alert.alert(
        t("settings_main.no_email_title"),
        t("settings_main.no_email_body"),
      );
      return;
    }
    setResendingEmail(true);
    setEmailResent(false);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: { emailRedirectTo: getEmailRedirectUrl("auth/confirm") },
      });
      if (error) {
        Alert.alert(
          t("settings_main.couldnt_send_title"),
          error.message || t("settings_main.couldnt_send_body"),
        );
        return;
      }
      setEmailResent(true);
      // Auto-clear the success state so the button reverts to a
      // tappable state after the user reads the confirmation.
      setTimeout(() => setEmailResent(false), 6000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert(t("settings_main.couldnt_send_title"), msg);
    } finally {
      setResendingEmail(false);
    }
  };

  // DEV-only: wipe walkthrough completion flags so the next visit to a
  // hub screen re-triggers the tour. Gated by __DEV__ so the button
  // never ships to prod builds.
  const handleResetWalkthroughs = () => {
    Alert.alert(
      t("settings_main.reset_walkthroughs_title"),
      t("settings_main.reset_walkthroughs_body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings_main.reset_walkthroughs_action"),
          style: "destructive",
          onPress: async () => {
            await resetAllWalkthroughs();
            Alert.alert(
              t("settings_main.reset_walkthroughs_done_title"),
              t("settings_main.reset_walkthroughs_done_body"),
            );
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(
      t("settings_main.logout_confirm_title"),
      t("settings_main.logout_confirm_body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings_main.logout"),
          style: "destructive",
          onPress: () => {
            logout();
            navigation.reset({
              index: 0,
              routes: [{ name: "Welcome" }],
            });
          },
        },
      ]
    );
  };

  // i18n: groups + items are computed inside the component so t() picks
  // up the current language on every render. Keeping the static config
  // shape (SettingItem[]) means renderSettingItem doesn't change.
  const accountSettings: SettingItem[] = [
    {
      id: "profile",
      icon: "person-outline",
      iconBg: "#F0FDFB",
      iconColor: "#00C6AE",
      title: t("settings_main.item_personal_info"),
      subtitle: t("settings_main.item_personal_info_subtitle"),
      route: "PersonalInfo",
    },
    {
      id: "verification",
      icon: "shield-checkmark-outline",
      iconBg: "#FEF3C7",
      iconColor: "#D97706",
      title: t("settings_main.item_verification"),
      subtitle: t("settings_main.item_verification_subtitle"),
      badge: t("settings_main.item_verification_badge"),
      badgeColor: "#00C6AE",
    },
    {
      id: "linked",
      icon: "link-outline",
      iconBg: "#EFF6FF",
      iconColor: "#3B82F6",
      title: t("settings_main.item_linked_accounts"),
      subtitle: t("settings_main.item_linked_accounts_subtitle"),
      route: "LinkedAccounts",
    },
  ];

  const securitySettings: SettingItem[] = [
    {
      id: "security",
      icon: "lock-closed-outline",
      iconBg: "#F0FDFB",
      iconColor: "#00C6AE",
      title: t("settings_main.item_security"),
      subtitle: t("settings_main.item_security_subtitle"),
      route: "SecuritySettings",
    },
    {
      id: "sessions",
      icon: "phone-portrait-outline",
      iconBg: "#F5F7FA",
      iconColor: "#0A2342",
      title: t("settings_main.item_sessions"),
      subtitle: t("settings_main.item_sessions_subtitle"),
      route: "ActiveSessions",
    },
  ];

  const preferenceSettings: SettingItem[] = [
    {
      id: "notifications",
      icon: "notifications-outline",
      iconBg: "#FEE2E2",
      iconColor: "#DC2626",
      title: t("settings_main.item_notifications"),
      subtitle: t("settings_main.item_notifications_subtitle"),
      route: "NotificationPrefs",
    },
    {
      id: "language",
      icon: "globe-outline",
      iconBg: "#EFF6FF",
      iconColor: "#3B82F6",
      title: t("settings_main.item_language"),
      subtitle: t("settings_main.item_language_subtitle"),
      route: "LanguageRegion",
    },
    {
      id: "privacy",
      icon: "eye-off-outline",
      iconBg: "#F5F3FF",
      iconColor: "#8B5CF6",
      title: t("settings_main.item_privacy"),
      subtitle: t("settings_main.item_privacy_subtitle"),
      route: "PrivacySettings",
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      id: "help",
      icon: "help-circle-outline",
      iconBg: "#F0FDFB",
      iconColor: "#00C6AE",
      title: t("settings_main.item_help"),
      subtitle: t("settings_main.item_help_subtitle"),
      route: "HelpCenter",
    },
    // P0 (legal-docs review): wire the previously-orphan
    // LegalDocumentsScreen into Settings. Before this row was added
    // the route was registered but unreachable from the UI.
    {
      id: "legal",
      icon: "document-text-outline",
      iconBg: "#EFF6FF",
      iconColor: "#3B82F6",
      title: t("settings_main.item_legal_documents"),
      subtitle: t("settings_main.item_legal_documents_subtitle"),
      route: "LegalDocuments",
    },
    {
      id: "about",
      icon: "information-circle-outline",
      iconBg: "#F5F7FA",
      iconColor: "#6B7280",
      title: t("settings_main.item_about"),
      subtitle: t("settings_main.item_about_subtitle"),
      route: "AboutApp",
    },
  ];

  const renderSettingItem = (item: SettingItem, isLast: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.settingItem, !isLast && styles.settingItemBorder]}
      onPress={() => {
        if (item.route) {
          navigation.navigate(item.route as any);
        } else if (item.onPress) {
          item.onPress();
        }
      }}
    >
      <View style={[styles.settingIcon, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={20} color={item.iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{item.title}</Text>
        {item.subtitle && (
          <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
        )}
      </View>
      {item.badge && (
        <View
          style={[
            styles.badge,
            { backgroundColor: item.badgeColor || "#00C6AE" },
          ]}
        >
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderSettingsGroup = (
    title: string,
    items: SettingItem[]
  ) => (
    <View style={styles.settingsGroup}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>
        {items.map((item, index) =>
          renderSettingItem(item, index === items.length - 1)
        )}
      </View>
    </View>
  );

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
            <Text style={styles.headerTitle}>{t("settings_main.header")}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Profile Preview */}
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => navigation.navigate("PersonalInfo")}
          >
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.name || t("settings_main.default_user")}
              </Text>
              <Text style={styles.profilePhone}>{user?.phone || "+1 (***) ***-****"}</Text>
            </View>
            <View style={styles.xnScoreBadge}>
              <Text style={styles.xnScoreLabel}>{t("settings_main.xn_score_label")}</Text>
              <Text style={styles.xnScoreValue}>{score}</Text>
            </View>
          </TouchableOpacity>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>$2,450</Text>
              <Text style={styles.statLabel}>{t("settings_main.stat_total_saved")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>{t("settings_main.stat_active_circles")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>{t("settings_main.stat_contributions")}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Email verification card. Renders only when the active
            session's email_confirmed_at is missing. Pulled outside
            the existing settings groups so it reads as a banner, not
            as another row in the list. Once isEmailVerified flips true
            the component unmounts and the cooldown state is GC'd. */}
        {user && !isEmailVerified ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              borderRadius: 14,
              padding: 14,
              backgroundColor: "#FEF3C7",
              borderWidth: 1,
              borderColor: "#FCD34D",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="mail-unread-outline" size={20} color="#92400E" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#92400E", fontWeight: "700", fontSize: 13 }}>
                  {t("settings_main.email_unverified_title")}
                </Text>
                <Text style={{ color: "#92400E", fontSize: 12, marginTop: 2 }}>
                  {user.email
                    ? t("settings_main.email_unverified_with_address", {
                        email: user.email,
                      })
                    : t("settings_main.email_unverified_generic")}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleResendVerificationEmail}
              disabled={resendingEmail || emailResent}
              accessibilityRole="button"
              accessibilityLabel="Resend verification email"
              style={{
                marginTop: 10,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: emailResent ? "#10B981" : "#0A2342",
                opacity: resendingEmail ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
                {resendingEmail
                  ? t("settings_main.email_resend_sending")
                  : emailResent
                    ? t("settings_main.email_resend_sent")
                    : t("settings_main.email_resend")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : user ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              borderRadius: 14,
              padding: 12,
              backgroundColor: "#D1FAE5",
              borderWidth: 1,
              borderColor: "#6EE7B7",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Ionicons name="shield-checkmark" size={18} color="#065F46" />
            <Text style={{ color: "#065F46", fontWeight: "700", fontSize: 13 }}>
              {t("settings_main.email_verified")}
            </Text>
          </View>
        ) : null}

        {/* Content */}
        <View style={styles.content}>
          {renderSettingsGroup(t("settings_main.section_account"), accountSettings)}
          {renderSettingsGroup(t("settings_main.section_security"), securitySettings)}
          {renderSettingsGroup(t("settings_main.section_preferences"), preferenceSettings)}
          {renderSettingsGroup(t("settings_main.section_support"), supportSettings)}

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>{t("settings_main.logout")}</Text>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footerText}>{t("settings_main.footer")}</Text>

          {/* DEV-only walkthrough reset. Lives under the footer so it's
              never visible in prod builds and doesn't crowd the main
              settings list. */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={handleResetWalkthroughs}
              accessibilityRole="button"
              accessibilityLabel="Reset walkthroughs (DEV only)"
              style={{
                marginTop: 12,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                backgroundColor: "#FFFFFF",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="refresh-circle-outline" size={16} color="#0A2342" />
              <Text style={{ color: "#0A2342", fontWeight: "600", fontSize: 13 }}>
                {t("settings_main.reset_walkthroughs_button")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>{t("common.help")}</Text>
      </TouchableOpacity>
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
    justifyContent: "space-between",
    marginBottom: 20,
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
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profilePhone: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  xnScoreBadge: {
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  xnScoreLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
  },
  xnScoreValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  quickStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  settingsGroup: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  settingSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginTop: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 20,
  },
  floatingHelp: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
