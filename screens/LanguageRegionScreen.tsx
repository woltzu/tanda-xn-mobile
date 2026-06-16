// LanguageRegionScreen — P2 (language-switcher review).
//
// Post-P2 this screen is language-only. The "Where I'm from" + "Join
// communities" sections live in CommunityPreferencesScreen.tsx, reached
// from a sibling row in ProfileScreen → Preferences.
//
// Sections, top → bottom:
//   1. App Language card
//      - Device-locale hint banner (when the device locale differs from
//        the active app language and the user hasn't dismissed it).
//      - Follow-device toggle (i18n "system" sentinel).
//      - Inline language rows (en + fr).
//      - Example sentence card — live preview that the switch worked.
//   2. Coming-soon list — 13 unsupported languages with a vote-stub
//      Alert when tapped. Static list; no vote storage. Keeps users
//      who scroll past the picker oriented on what's planned.
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  usePreferences,
  SUPPORTED_LANGUAGES,
} from "../context/PreferencesContext";
import { resolveDeviceLanguage } from "../i18n";

// P2 — 13 languages we plan to support but haven't shipped yet. Order
// roughly by speaker count + diaspora overlap with TandaXn's target
// markets. Tap fires a vote-stub Alert — we don't persist the vote
// anywhere yet, but the message acknowledges interest so the row
// doesn't feel inert.
const COMING_SOON_LANGUAGES: ReadonlyArray<{
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}> = [
  { code: "es", name: "Spanish",        nativeName: "Español",          flag: "🇪🇸" },
  { code: "pt", name: "Portuguese",     nativeName: "Português",        flag: "🇵🇹" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl Ayisyen",   flag: "🇭🇹" },
  { code: "ar", name: "Arabic",         nativeName: "العربية",          flag: "🇸🇦" },
  { code: "sw", name: "Swahili",        nativeName: "Kiswahili",        flag: "🇰🇪" },
  { code: "yo", name: "Yoruba",         nativeName: "Yorùbá",           flag: "🇳🇬" },
  { code: "ha", name: "Hausa",          nativeName: "Hausa",            flag: "🇳🇬" },
  { code: "am", name: "Amharic",        nativeName: "አማርኛ",            flag: "🇪🇹" },
  { code: "hi", name: "Hindi",          nativeName: "हिन्दी",           flag: "🇮🇳" },
  { code: "tl", name: "Tagalog",        nativeName: "Tagalog",          flag: "🇵🇭" },
  { code: "vi", name: "Vietnamese",     nativeName: "Tiếng Việt",       flag: "🇻🇳" },
  { code: "ko", name: "Korean",         nativeName: "한국어",           flag: "🇰🇷" },
  { code: "zh", name: "Chinese",        nativeName: "中文",             flag: "🇨🇳" },
];

export default function LanguageRegionScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const { setLanguage, isSystemLanguage, setFollowDeviceLanguage } =
    usePreferences();

  const [hintDismissed, setHintDismissed] = useState(false);

  const deviceCode = useMemo(() => resolveDeviceLanguage(), []);
  const deviceLanguageMeta = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === deviceCode) ?? null,
    [deviceCode],
  );

  // P2 — the source of truth for the active language is i18n.language,
  // not the preferences blob (we removed language from the blob). When
  // following the device, i18n.language is the resolved code, not the
  // "system" sentinel — so direct equality is safe here.
  const activeCode = i18n.language;

  const showDeviceHint =
    !isSystemLanguage &&
    !hintDismissed &&
    deviceLanguageMeta != null &&
    deviceCode !== activeCode;

  const handleLanguageSelect = async (
    language: (typeof SUPPORTED_LANGUAGES)[0],
  ) => {
    await setLanguage(language);
  };

  const handleToggleFollowDevice = async (value: boolean) => {
    await setFollowDeviceLanguage(value);
  };

  const handleSwitchToDevice = async () => {
    if (!deviceLanguageMeta) return;
    await setLanguage(deviceLanguageMeta);
    setHintDismissed(true);
  };

  const handleComingSoonTap = (lang: (typeof COMING_SOON_LANGUAGES)[0]) => {
    Alert.alert(
      t("language_screen.coming_soon_vote_title", { name: lang.name }),
      t("language_screen.coming_soon_vote_body"),
      [{ text: t("common.ok") }],
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("language_screen.title")}</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("language_region.app_language")}</Text>

          {showDeviceHint && deviceLanguageMeta && (
            <View style={styles.hintBanner}>
              <Ionicons name="globe-outline" size={18} color="#1E40AF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.hintBannerText}>
                  {t("language_screen.device_hint_body", {
                    name: deviceLanguageMeta.nativeName,
                  })}
                </Text>
                <View style={styles.hintBannerActions}>
                  <TouchableOpacity
                    style={styles.hintSwitchBtn}
                    onPress={handleSwitchToDevice}
                  >
                    <Text style={styles.hintSwitchBtnText}>
                      {t("language_screen.device_hint_switch", {
                        name: deviceLanguageMeta.name,
                      })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.hintDismissBtn}
                    onPress={() => setHintDismissed(true)}
                  >
                    <Text style={styles.hintDismissBtnText}>
                      {t("language_screen.device_hint_dismiss")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={styles.followRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.followRowTitle}>
                {t("language_screen.follow_device_title")}
              </Text>
              <Text style={styles.followRowSubtitle}>
                {t("language_screen.follow_device_subtitle")}
              </Text>
            </View>
            <Switch
              value={isSystemLanguage}
              onValueChange={handleToggleFollowDevice}
              trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.languageRowsCard}>
            {SUPPORTED_LANGUAGES.map((lang, index) => {
              const isSelected = activeCode === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageRow,
                    index < SUPPORTED_LANGUAGES.length - 1 && styles.languageRowBorder,
                    isSystemLanguage && styles.languageRowDimmed,
                  ]}
                  onPress={() => handleLanguageSelect(lang)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={styles.languageRowFlag}>{lang.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.languageRowLabel}>{lang.name}</Text>
                    <Text style={styles.languageRowSubLabel}>
                      {lang.nativeName}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#00C6AE"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.exampleCard}>
            <Text style={styles.exampleLabel}>
              {t("language_screen.example_label")}
            </Text>
            <Text style={styles.exampleSentence}>
              {t("language_screen.example_sentence")}
            </Text>
          </View>
        </View>

        {/* P2 — Coming-soon list. Static; tap fires a vote-stub Alert.
            No vote storage yet — the message acknowledges interest so
            the row isn't inert, but we don't persist it. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("language_screen.coming_soon_header")}
          </Text>
          <Text style={styles.sectionDesc}>
            {t("language_screen.coming_soon_body")}
          </Text>
          <View style={styles.comingSoonCard}>
            {COMING_SOON_LANGUAGES.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.comingSoonRow,
                  index < COMING_SOON_LANGUAGES.length - 1 &&
                    styles.comingSoonRowBorder,
                ]}
                onPress={() => handleComingSoonTap(lang)}
              >
                <Text style={styles.comingSoonFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.comingSoonLabel}>{lang.name}</Text>
                  <Text style={styles.comingSoonSubLabel}>
                    {lang.nativeName}
                  </Text>
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>
                    {t("language_screen.coming_soon_chip")}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 12,
    lineHeight: 20,
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  followRowTitle: { fontSize: 15, fontWeight: "700", color: "#0A2342" },
  followRowSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  languageRowsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  languageRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  languageRowDimmed: { opacity: 0.5 },
  languageRowFlag: { fontSize: 24 },
  languageRowLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  languageRowSubLabel: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  hintBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 12,
  },
  hintBannerText: { fontSize: 13, color: "#1E40AF", lineHeight: 18 },
  hintBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  hintSwitchBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#1E40AF",
    borderRadius: 8,
  },
  hintSwitchBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  hintDismissBtn: { paddingVertical: 6 },
  hintDismissBtnText: { fontSize: 12, fontWeight: "600", color: "#1E40AF" },
  exampleCard: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  exampleLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#00897B",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exampleSentence: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#065F46",
    lineHeight: 18,
  },
  comingSoonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  comingSoonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  comingSoonRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  comingSoonFlag: { fontSize: 22, opacity: 0.85 },
  comingSoonLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  comingSoonSubLabel: { fontSize: 12, color: "#9CA3AF", marginTop: 1 },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  comingSoonBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.3,
  },
});
