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
  const navigation = useNavigation<AuthCallbackNavigationProp>();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // On web, read query params from window.location
        let tokenHash = "";
        let type = "";

        if (Platform.OS === "web" && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          tokenHash = params.get("token_hash") || "";
          type = params.get("type") || "";

          // Also check hash fragment for access_token (Supabase default flow)
          const hash = window.location.hash;
          if (hash && hash.includes("access_token")) {
            // This is handled by detectSessionInUrl in supabase.ts
            // Wait a moment for Supabase to process it
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setStatus("success");
              setTimeout(() => {
                navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
              }, 1500);
              return;
            }
          }
        }

        if (!tokenHash || !type) {
          setErrorMessage("Invalid verification link. Please try signing up again.");
          setStatus("error");
          setTimeout(() => {
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }, 3000);
          return;
        }

        // Verify the OTP token with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "signup" | "email" | "recovery" | "email_change" | "invite",
        });

        if (error) {
          console.error("Verification error:", error);
          setErrorMessage(error.message || "Verification failed. The link may have expired.");
          setStatus("error");
          setTimeout(() => {
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }, 3000);
          return;
        }

        // Success! User is now verified and logged in
        setStatus("success");
        setTimeout(() => {
          if (type === "recovery") {
            navigation.reset({ index: 0, routes: [{ name: "ResetPassword" }] });
          } else {
            navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
          }
        }, 1500);
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setErrorMessage("Something went wrong. Please try again.");
        setStatus("error");
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        }, 3000);
      }
    };

    verifyToken();
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
              <Text style={styles.subtitle}>Please wait a moment</Text>
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
              <Text style={styles.title}>Verification Failed</Text>
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
