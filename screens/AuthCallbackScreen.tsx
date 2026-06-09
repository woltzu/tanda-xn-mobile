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
export default function AuthCallbackScreen() {
  const { t } = useTranslation();

  const navigation = useNavigation<AuthCallbackNavigationProp>();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Set to true when supabase.auth.onAuthStateChange fires PASSWORD_RECOVERY.
    // Some recovery links (hash-fragment / deep-link) deliver the recovery
    // signal via the auth event rather than a parseable `type=recovery` URL
    // param, so we need both paths to converge on the same routing target.
    let isRecoveryEvent = false;
    let successTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let errorTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let timeoutGuardId: ReturnType<typeof setTimeout> | null = null;

    // Determine routing target based on URL params (for hash flow we
    // can't know type without parsing, default to signup behavior)
    const getTypeFromUrl = (): string => {
      if (Platform.OS !== "web" || typeof window === "undefined") return "signup";
      const qp = new URLSearchParams(window.location.search).get("type");
      if (qp) return qp;
      // Hash flow: type comes as &type=signup inside the hash fragment
      const hash = window.location.hash || "";
      const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      return hashParams.get("type") || "signup";
    };

    const navigateOnSuccess = () => {
      if (cancelled) return;
      setStatus("success");
      const type = getTypeFromUrl();
      successTimeoutId = setTimeout(() => {
        if (cancelled) return;
        if (isRecoveryEvent || type === "recovery") {
          navigation.reset({ index: 0, routes: [{ name: "ResetPassword" }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
        }
      }, 1500);
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
      // link (regardless of whether the URL had `type=recovery` parseable).
      // Latch the flag so `navigateOnSuccess` routes to ResetPassword
      // instead of MainTabs even if SIGNED_IN arrives later.
      if (event === "PASSWORD_RECOVERY") {
        isRecoveryEvent = true;
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
      if (successTimeoutId) clearTimeout(successTimeoutId);
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
        <View style={styles.content}>
          {status === "verifying" && (
            <>
              <ActivityIndicator size="large" color="#00C6AE" />
              <Text style={styles.title}>Verifying your email...</Text>
              <Text style={styles.subtitle}>{t("final_polish.authcallback_please_wait_a_moment")}</Text>
            </>
          )}

          {status === "success" && (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#00C6AE" />
              </View>
              <Text style={styles.title}>Email Verified!</Text>
              <Text style={styles.subtitle}>Redirecting to the app...</Text>
            </>
          )}

          {status === "error" && (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name="close-circle" size={80} color="#EF4444" />
              </View>
              <Text style={styles.title}>{t("final_polish.authcallback_verification_failed")}</Text>
              <Text style={styles.subtitle}>{errorMessage}</Text>
              <Text style={styles.redirectText}>Redirecting to login...</Text>
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
