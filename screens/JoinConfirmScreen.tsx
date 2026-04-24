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
  const [circleName, setCircleName] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState<number | null>(null);

  useEffect(() => {
    completeJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completeJoin() {
    try {
      const pendingId = readPendingId();
      console.log("[JoinConfirm] start", { pendingId });

      // When Supabase rejects the magic link (already-consumed token,
      // expired window, or the user clicked it a second time after the
      // first click consumed it), it redirects here with auth error
      // params in the URL *hash*. Check those FIRST — even before we
      // try to read the session — because detectSessionInUrl won't
      // have a valid token to parse and supabase.auth.getUser() will
      // just return null, which used to show a generic "session
      // expired" message. The graceful path: if the pending_join
      // already succeeded, treat the repeat click as a success.
      const urlHash = typeof window !== "undefined" ? (window.location.hash || "") : "";
      const hashParams = new URLSearchParams(
        urlHash.startsWith("#") ? urlHash.slice(1) : urlHash
      );
      const errorCode = hashParams.get("error_code");
      const errorDescription = hashParams.get("error_description");
      console.log("[JoinConfirm] hash check", { errorCode, errorDescription });

      if (errorCode === "otp_expired" || errorCode === "access_denied") {
        if (pendingId) {
          const { data: alreadyDone, error: readErr } = await supabase
            .from("pending_joins")
            .select("status, circle_id, circles(name, amount)")
            .eq("id", pendingId)
            .maybeSingle();
          console.log("[JoinConfirm] already-used link → status check", {
            status: alreadyDone?.status, error: readErr,
          });
          if (alreadyDone?.status === "completed") {
            const circ = (alreadyDone as any).circles;
            setStatus("success");
            setCircleName(circ?.name ?? null);
            setContributionAmount(
              typeof circ?.amount === "number" ? circ.amount : parseFloat(circ?.amount ?? "0") || null
            );
            setMessage(`You're already in, ${circ?.name ?? "the circle"}!`);
            setTimeout(() => {
              navigation.reset({
                index: 0,
                routes: [{
                  name: "QuickJoinPaymentSuccess",
                  params: {
                    circleName: circ?.name ?? "your circle",
                    amount: typeof circ?.amount === "number" ? circ.amount : parseFloat(circ?.amount ?? "0") || 0,
                  },
                }],
              });
            }, 1600);
            return;
          }
        }
        // Not-yet-completed but link is dead — ask for a fresh one.
        setStatus("error");
        setMessage("This link has already been used or expired. Please request a new one from your host.");
        return;
      }

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

      setSubMessage("Completing your join…");

      // One atomic server-side step. The complete_circle_join RPC:
      //  - verifies the pending_joins row is for the caller (email match)
      //  - inserts the circle_members row (idempotent)
      //  - marks the pending_joins row completed
      //  - returns { success, already_completed, circle_name, amount, error }
      // Running it as a SECURITY DEFINER RPC means this succeeds even if
      // the caller's auth state is weird (just as the QuickJoin insert
      // fix did), and it collapses three round-trips into one.
      console.log("[JoinConfirm] calling complete_circle_join", { pendingId });
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "complete_circle_join",
        { p_pending_id: pendingId },
      );
      console.log("[JoinConfirm] RPC response", { data: rpcData, error: rpcError });

      if (rpcError || !rpcData?.success) {
        setStatus("error");
        setMessage(
          (rpcData as any)?.error
            ?? rpcError?.message
            ?? "Could not complete join. Please try again.",
        );
        return;
      }

      // TODO (post-demo): trigger Stripe charge here using the payment
      // details the RPC returns alongside the circle info.

      const resolvedName = (rpcData as any).circle_name ?? "the circle";
      const resolvedAmount = (() => {
        const raw = (rpcData as any).amount;
        if (raw == null) return null;
        const n = typeof raw === "number" ? raw : parseFloat(raw);
        return Number.isFinite(n) ? n : null;
      })();
      const alreadyCompleted = !!(rpcData as any).already_completed;

      setCircleName(resolvedName);
      setContributionAmount(resolvedAmount);

      console.log("[JoinConfirm] success", { resolvedName, resolvedAmount, alreadyCompleted });
      setStatus("success");
      setMessage(
        alreadyCompleted
          ? `You're already in, ${resolvedName}!`
          : `You're in, ${resolvedName}!`,
      );

      // Go through the QuickJoinPaymentSuccess screen so the user sees
      // the big confirmation card with their contribution amount before
      // landing on the dashboard.
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{
            name: "QuickJoinPaymentSuccess",
            params: {
              circleName: resolvedName,
              amount: resolvedAmount ?? 0,
            },
          }],
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
              {contributionAmount != null ? (
                <Text style={styles.subtitle}>
                  Your first contribution of ${contributionAmount.toFixed(2)} has been confirmed.
                </Text>
              ) : null}
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
