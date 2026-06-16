import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, "Splash">;

export default function SplashScreen() {
  const { t } = useTranslation();

  const navigation = useNavigation<SplashScreenNavigationProp>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  // isLoading is now derived from authLoading — no decorative timer. As soon
  // as auth resolves we either reset to MainTabs (authed) or surface the
  // CTAs (unauthed). Saves ~2.5 s on every cold start.
  const isLoading = authLoading;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Auto-redirect to MainTabs if user already has an active session
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    // Pulse animation for loading dots
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

  }, []);

  const handleGetStarted = () => {
    // Merge: skip the legacy Welcome stop — go straight to Signup.
    // OnboardingWelcome was redundant with this Splash CTA pair.
    navigation.navigate("Signup");
  };

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <LinearGradient colors={["#0A2342", "#132D4E"]} style={styles.container}>
      {/* Logo Container with floating animation */}
      <View style={styles.logoContainer}>
        <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
          <LinearGradient
            colors={["#00C6AE", "#00A896"]}
            style={styles.logoBox}
          >
            <Text style={styles.logoText}>Xn</Text>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.title}>{t("final_polish.splash_tandaxn")}</Text>
        <Text style={styles.subtitle}>{t("final_polish.splash_save_together_grow_together")}</Text>
      </View>

      {/* Loading Dots */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.loadingDot,
                {
                  opacity: pulseAnim,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {/* First-launch journey indicator: subtle three-step preview of what
          a new user will do after signing in. Only shown when we have CTAs
          (i.e. unauthed and auth check finished). */}
      {!isLoading ? (
        <View style={styles.journeyContainer}>
          <View style={styles.journeyStep}>
            <View style={[styles.journeyDot, styles.journeyDotActive]} />
            <Text style={styles.journeyLabel}>
              {t("splash.journey_step_signin")}
            </Text>
          </View>
          <View style={styles.journeyLine} />
          <View style={styles.journeyStep}>
            <View style={styles.journeyDot} />
            <Text style={styles.journeyLabel}>
              {t("splash.journey_step_join_circle")}
            </Text>
          </View>
          <View style={styles.journeyLine} />
          <View style={styles.journeyStep}>
            <View style={styles.journeyDot} />
            <Text style={styles.journeyLabel}>
              {t("splash.journey_step_first_contribution")}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Buttons */}
      {!isLoading ? (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#00C6AE", "#00A896"]}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>{t("final_polish.splash_get_started")}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>
              {t("splash.cta_i_have_account")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoBox: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  logoText: {
    color: "#0A2342",
    fontSize: 48,
    fontWeight: "800",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    color: "#00C6AE",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: "row",
    marginBottom: 40,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00C6AE",
    marginHorizontal: 4,
  },
  // ----- First-launch journey indicator -----
  journeyContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
    gap: 4,
  },
  journeyStep: {
    alignItems: "center",
    gap: 4,
    maxWidth: 100,
  },
  journeyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  journeyDotActive: {
    backgroundColor: "#00C6AE",
  },
  journeyLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
  },
  journeyLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: 2,
    marginBottom: 16,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 300,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#0A2342",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
