import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import AuthProgressStrip from "../components/AuthProgressStrip";

type AuthCallbackNavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * AuthCallbackScreen handles email verification and password reset callbacks.
 *
 * When the user clicks the link in the email, they are sent to:
 *   https://v0-tanda-xn.vercel.app/auth/confirm?token_hash=...&type=signup
 *
 * This screen reads the token_hash and type from the URL query params,
 * calls supabase.auth.verifyOtp() to complete verification, and then
 * navigates to the appropriate screen.
 */
// Detect whether the incoming URL is a recovery (password-reset) link.
// Checks query params first (web ?type=recovery), then the hash fragment
// (#access_token=…&type=recovery). Native deep-link flows that lack a
// readable URL return false and fall back to the PASSWORD_RECOVERY auth
// event for detection.
function detectRecoveryFromUrl(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const qp = new URLSearchParams(window.location.search).get("type");
  if (qp === "recovery") return true;
  const hash = window.location.hash || "";
  const hashParams = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  );
  return hashParams.get("type") === "recovery";
}

export default function AuthCallbackScreen() {
  const { t } = useTranslation();

  const navigation = useNavigation<AuthCallbackNavigationProp>();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  // Drives the recovery-aware copy below. Initialised from the URL at
  // mount so we render the correct verifying-screen text on the first
  // paint, then flipped to true if a PASSWORD_RECOVERY event arrives
  // later (native deep-link case where the URL didn't disambiguate).
  const [isRecovery, setIsRecovery] = useState<boolean>(() =>
    detectRecoveryFromUrl(),
  );

  useEffect(() => {
    let cancelled = false;
    // Routing-decision flag. Read by navigateOnSuccess at the moment it
    // fires — never relies on event ordering. Seeded from the URL so the
    // routing target is known before any auth event arrives, then
    // latched to true if PASSWORD_RECOVERY arrives later (defensive
    // against native deep-link flows where the URL is not readable).
    let isRecoveryFlow = detectRecoveryFromUrl();
    let errorTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let timeoutGuardId: ReturnType<typeof setTimeout> | null = null;

    const markRecovery = () => {
      isRecoveryFlow = true;
      setIsRecovery(true);
    };

    const navigateOnSuccess = () => {
      if (cancelled) return;
      setStatus("success");
      // P0 fix: no decorative timeout. The routing target is read at
      // call time from isRecoveryFlow, which is authoritative — set
      // upfront from the URL and latched by PASSWORD_RECOVERY. Recovery
      // always lands on ResetPassword regardless of which auth event
      // arrives first.
      navigation.reset({
        index: 0,
        routes: [{ name: isRecoveryFlow ? "ResetPassword" : "MainTabs" }],
      });
    };

    const navigateOnError = (message: string) => {
      if (cancelled) return;
      setErrorMessage(message);
      setStatus("error");
      errorTimeoutId = setTimeout(() => {
        if (cancelled) return;
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }, 3000);
    };

    // 1. Subscribe to auth state changes — primary signal
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      // PASSWORD_RECOVERY fires when the user lands here via a recovery
      // link. Latch the flag in case SIGNED_IN arrives later, AND in
      // case it already fired before this listener attached (no-op in
      // that case — the URL-derived seed already covers it).
      if (event === "PASSWORD_RECOVERY") {
        markRecovery();
        navigateOnSuccess();
        return;
      }
      if (event === "SIGNED_IN" && session) {
        navigateOnSuccess();
      }
    });

    // 2. Synchronous session check (handles already-signed-in case)
    (async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        navigateOnSuccess();
        return;
      }

      // 3. Query-param flow: explicit verifyOtp call
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get("token_hash") || "";
        const type = params.get("type") || "";
        if (tokenHash && type) {
          // If the URL is a recovery link, mark the flow BEFORE we run
          // verifyOtp so that whichever event lands first (SIGNED_IN
          // from the verify call, or PASSWORD_RECOVERY from the auth
          // subscription) routes the user to ResetPassword.
          if (type === "recovery") markRecovery();
          const { data: verifyData, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "email" | "recovery" | "email_change" | "invite",
          });
          if (cancelled) return;
          if (error || !verifyData.session) {
            navigateOnError(error?.message || "Verification failed. Please try signing up again.");
            return;
          }
          // verifyOtp success — auth listener will fire SIGNED_IN,
          // navigateOnSuccess via the subscription. But fall through
          // here defensively in case the listener didn't catch it.
          navigateOnSuccess();
          return;
        }
      }

      // 4. Hash flow: wait for onAuthStateChange to fire SIGNED_IN
      // (handled by the subscription above; if it never fires within
      // 8s, the timeoutGuard below catches it)
    })();

    // 5. Timeout guard — if no success signal within 8s, error out
    timeoutGuardId = setTimeout(() => {
      if (cancelled) return;
      // Only fire if we're still in 'verifying' state
      setStatus((current) => {
        if (current === "verifying") {
          setErrorMessage("Verification is taking longer than expected. Please try again.");
          errorTimeoutId = setTimeout(() => {
            if (cancelled) return;
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }, 3000);
          return "error";
        }
        return current;
      });
    }, 8000);

    // 6. Cleanup
    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
      if (errorTimeoutId) clearTimeout(errorTimeoutId);
      if (timeoutGuardId) clearTimeout(timeoutGuardId);
    };
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A2342", "#1A3A5A"]}
        style={styles.gradient}
      >
        {/* Progress strip only on the recovery path. Signup verification
            uses the same callback URL but isn't part of the 3-step
            password-reset journey, so a strip there would be misleading. */}
        {isRecovery ? (
          <View style={styles.progressStripWrap}>
            <AuthProgressStrip step={2} variant="dark" />
          </View>
        ) : null}
        <View style={styles.content}>
          {status === "verifying" && (
            <>
              <ActivityIndicator size="large" color="#00C6AE" />
              <Text style={styles.title}>
                {t(
                  isRecovery
                    ? "final_polish.authcallback_verifying_reset"
                    : "final_polish.authcallback_verifying_your_email",
                )}
              </Text>
              <Text style={styles.subtitle}>
                {t("final_polish.authcallback_please_wait_a_moment")}
              </Text>
            </>
          )}

          {status === "success" && (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#00C6AE" />
              </View>
              <Text style={styles.title}>
                {t(
                  isRecovery
                    ? "final_polish.authcallback_reset_verified"
                    : "final_polish.authcallback_email_verified",
                )}
              </Text>
              <Text style={styles.subtitle}>
                {t(
                  isRecovery
                    ? "final_polish.authcallback_redirecting_to_set_password"
                    : "final_polish.authcallback_redirecting_to_the_app",
                )}
              </Text>
            </>
          )}

          {status === "error" && (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name="close-circle" size={80} color="#EF4444" />
              </View>
              <Text style={styles.title}>{t("final_polish.authcallback_verification_failed")}</Text>
              <Text style={styles.subtitle}>{errorMessage}</Text>
              <Text style={styles.redirectText}>{t("final_polish.authcallback_redirecting_to_login")}</Text>
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  iconContainer: {
    marginBottom: 20,
  },
  progressStripWrap: {
    paddingTop: 56,
    paddingHorizontal: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 20,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
  },
  redirectText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
  },
});
