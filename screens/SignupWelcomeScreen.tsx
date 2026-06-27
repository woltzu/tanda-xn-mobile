// ══════════════════════════════════════════════════════════════════════════════
// screens/SignupWelcomeScreen.tsx — post-signup welcome (one-shot)
// ══════════════════════════════════════════════════════════════════════════════
//
// Shown once, after a brand-new user verifies their email and before
// they land on the Dashboard. EmailVerificationScreen routes here when
// flow === "signup" (P1 wiring); other flows still go straight to
// MainTabs.
//
// One-shot gate via AsyncStorage: SIGNUP_WELCOME_SEEN_KEY. On mount we
// read the flag; if it's set, we reset straight to MainTabs without
// painting the welcome cards. The CTA writes the flag before resetting.
//
// Note: per the P0 logout review's whitelist, this key gets purged on
// sign-out (it isn't in the preserve list). Practically that means a
// user who signs out and back in re-sees the welcome on first sign-in.
// Acceptable — re-introduction reads as "welcome back" rather than a
// bug. If we want it to survive sign-out, future change would namespace
// it under `@tandaxn_onboarding_*` which is whitelisted.
//
// Three card pitch:
//   ① Save together  ② Build trust  ③ Get paid
// Renders the AuthProgressStrip at step 3 (variant=signup) so the user
// closes the loop visually on the same strip they saw at SignupScreen
// (step 1) and EmailVerificationScreen (step 2).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import AuthProgressStrip from "../components/AuthProgressStrip";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";

type NavProp = StackNavigationProp<RootStackParamList, "SignupWelcome">;

// Per brief: one-shot gate. v1 suffix lets us bump if the welcome
// content changes substantially in the future without orphaning the
// old flag.
const SIGNUP_WELCOME_SEEN_KEY = "@tandaxn_signup_welcome_seen_v1";

const NAVY_TOP = "#0A2342";
const NAVY_BOTTOM = "#1A3A5A";
const TEAL = "#00C6AE";
const NAVY = "#0A2342";
const MUTED = "#6B7280";
const TEXT = "#111827";
const BORDER = "#E5E7EB";

type Card = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
};

const CARDS: Card[] = [
  {
    icon: "people-outline",
    titleKey: "signup_welcome.card1_title",
    descKey: "signup_welcome.card1_desc",
  },
  {
    icon: "shield-checkmark-outline",
    titleKey: "signup_welcome.card2_title",
    descKey: "signup_welcome.card2_desc",
  },
  {
    icon: "wallet-outline",
    titleKey: "signup_welcome.card3_title",
    descKey: "signup_welcome.card3_desc",
  },
];

export default function SignupWelcomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  // Circle-count drives the state-aware CTA. While loading, fall back
  // to the generic dashboard CTA so the button never flashes the wrong
  // label.
  const { myCircles, isLoading: circlesLoading } = useCircles();
  // Stay in loading state until the seen-check resolves. If the flag
  // is already set we navigate away before rendering the cards — the
  // user never sees a flash of the welcome they already dismissed.
  const [ready, setReady] = useState(false);

  // First-name only for the greeting — "Hi Jane," reads warmer than
  // "Hi Jane Marie Doe,". Falls back to the un-personalised greeting
  // when there's no name on the account (AuthContext computes user.name
  // from metadata.name → full_name → display_name → email, but new
  // OAuth users with no metadata can land here with an empty string).
  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] ?? "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SIGNUP_WELCOME_SEEN_KEY);
        if (cancelled) return;
        if (seen) {
          navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
          return;
        }
      } catch {
        /* if storage fails, just render — better than blocking on it */
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const handlePrimary = async () => {
    try {
      await AsyncStorage.setItem(SIGNUP_WELCOME_SEEN_KEY, "1");
    } catch {
      /* best-effort — even if storage fails, still get the user in */
    }
    navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  };

  const handleLearnMore = () => {
    Linking.openURL("https://tandaxn.com/how-it-works").catch(() => {
      /* no-op — best-effort external link */
    });
  };

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[NAVY_TOP, NAVY_BOTTOM]} style={styles.header}>
        <Text style={styles.title}>
          {firstName
            ? t("signup_welcome.greeting_named", { name: firstName })
            : t("signup_welcome.title")}
        </Text>
      </LinearGradient>

      <View style={styles.card}>
        <AuthProgressStrip step={3} flow="signup" />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {CARDS.map((c, i) => (
            <View key={i} style={styles.tile}>
              <View style={styles.tileIconWrap}>
                <Ionicons name={c.icon} size={22} color={TEAL} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileTitle}>{t(c.titleKey)}</Text>
                <Text style={styles.tileDesc}>{t(c.descKey)}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handlePrimary}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {circlesLoading
                ? t("signup_welcome.cta")
                : myCircles.length === 0
                ? t("signup_welcome.cta_create_circle")
                : t("signup_welcome.cta_view_circles")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={handleLearnMore}
            accessibilityRole="link"
          >
            <Text style={styles.secondaryLinkText}>
              {t("signup_welcome.secondary_link")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginTop: -14,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 32 },
  tile: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  tileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E6FAF7",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 4,
  },
  tileDesc: {
    fontSize: 12.5,
    color: MUTED,
    lineHeight: 18,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryLink: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  secondaryLinkText: {
    color: TEAL,
    fontSize: 13,
    fontWeight: "600",
  },
});
