// ══════════════════════════════════════════════════════════════════════════════
// JoinConfirmScreen — Magic-link landing page at /join-confirm?pending=<id>
// Runs after the user clicks the magic link in their email. Supabase's
// detectSessionInUrl picks up the auth tokens from the URL hash on mount, so
// by the time this component runs supabase.auth.getUser() returns the user.
// It then reads the pending_joins row and promotes it into a real join.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";

const NAVY = "#0A2342";
const NAVY_DEEP = "#071832";
const TEAL = "#00C6AE";
const WHITE = "#FFFFFF";
const MUTED = "#9AA7BD";
const DANGER = "#EF4444";
const SUCCESS = "#10B981";
const BORDER = "rgba(255,255,255,0.12)";
const CARD = "rgba(255,255,255,0.06)";

type Status = "loading" | "success" | "error";
type NavProp = StackNavigationProp<RootStackParamList, "JoinConfirm">;

// Parse the ?pending= query param from the current URL. Works on web.
// On native this would come from deep-link params via useRoute, but since
// this screen is only reached via magic link (web-only), we read from URL.
function readPendingId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("pending");
  } catch {
    return null;
  }
}

export default function JoinConfirmScreen() {
  const navigation = useNavigation<NavProp>();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");
  const [subMessage, setSubMessage] = useState<string>("Confirming your spot…");

  useEffect(() => {
    completeJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completeJoin() {
    try {
      const pendingId = readPendingId();
      console.log("[JoinConfirm] start", { pendingId });
      if (!pendingId) {
        setStatus("error");
        setMessage("Missing pending id in the URL.");
        return;
      }

      // Allow Supabase a beat to finish detectSessionInUrl parsing the
      // hash tokens from the magic link redirect.
      await new Promise((r) => setTimeout(r, 100));

      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData?.user;
      console.log("[JoinConfirm] session", { hasUser: !!user, email: user?.email });
      if (!user) {
        setStatus("error");
        setMessage("Your session expired. Please request a new magic link.");
        return;
      }

      setSubMessage("Loading your circle details…");

      const { data: pending, error: fetchError } = await supabase
        .from("pending_joins")
        .select("*, circles(id, name, amount, currency)")
        .eq("id", pendingId)
        .eq("status", "awaiting_confirmation")
        .maybeSingle();

      console.log("[JoinConfirm] pending row", {
        hasRow: !!pending,
        error: fetchError ? { code: fetchError.code, message: fetchError.message } : null,
      });

      if (fetchError) {
        setStatus("error");
        setMessage(fetchError.message || "Could not read pending join.");
        return;
      }
      if (!pending) {
        setStatus("error");
        setMessage("This link has expired or already been used.");
        return;
      }

      if ((pending.email ?? "").toLowerCase() !== (user.email ?? "").toLowerCase()) {
        setStatus("error");
        setMessage("Email mismatch. Please use the same email you started with.");
        return;
      }

      setSubMessage("Adding you to the circle…");

      // Add user to circle_members. If they're already a member (repeat
      // confirmation), don't treat it as an error.
      const { error: joinError } = await supabase
        .from("circle_members")
        .insert({
          circle_id: pending.circle_id,
          user_id: user.id,
          status: "active",
          joined_at: new Date().toISOString(),
        });

      if (joinError && !/duplicate|unique|already/i.test(joinError.message)) {
        console.error("[JoinConfirm] circle_members insert failed", joinError);
        setStatus("error");
        setMessage(joinError.message || "Could not finish join.");
        return;
      }

      // Mark pending row completed. Ignore errors here — the join succeeded.
      const { error: updateError } = await supabase
        .from("pending_joins")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", pendingId);
      if (updateError) {
        console.warn("[JoinConfirm] pending update failed (non-fatal)", updateError);
      }

      // TODO (post-demo): trigger Stripe charge using pending.payment_method
      // and pending.payment_details_encrypted. For demo, join is complete.

      console.log("[JoinConfirm] success");
      setStatus("success");
      setMessage(`You're in, ${pending.circles?.name ?? "the circle"}!`);

      // Redirect to MainTabs after a short celebration pause.
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs" }],
        });
      }, 1800);
    } catch (err: any) {
      console.error("[JoinConfirm] error", err);
      setStatus("error");
      setMessage(err?.message ?? "Could not complete join.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.container}>
        <View style={styles.card}>
          {status === "loading" && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: "rgba(0,198,174,0.12)" }]}>
                <ActivityIndicator size="large" color={TEAL} />
              </View>
              <Text style={styles.title}>Almost there</Text>
              <Text style={styles.subtitle}>{subMessage}</Text>
            </>
          )}
          {status === "success" && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: "rgba(16,185,129,0.15)" }]}>
                <Ionicons name="checkmark-circle" size={56} color={SUCCESS} />
              </View>
              <Text style={styles.title}>{message}</Text>
              <Text style={styles.subtitle}>Redirecting you to your dashboard…</Text>
            </>
          )}
          {status === "error" && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                <Ionicons name="alert-circle" size={56} color={DANGER} />
              </View>
              <Text style={styles.title}>Could not complete join</Text>
              <Text style={styles.subtitle}>{message}</Text>
              <TouchableOpacity
                style={styles.primary}
                activeOpacity={0.85}
                onPress={() => {
                  if (Platform.OS === "web" && typeof window !== "undefined") {
                    window.location.href = "/";
                  } else {
                    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
                  }
                }}
              >
                <Text style={styles.primaryText}>Return home</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NAVY_DEEP },
  container: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: WHITE,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 10,
  },
  primary: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TEAL,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignSelf: "stretch",
  },
  primaryText: { color: NAVY, fontSize: 15, fontWeight: "800" },
});
