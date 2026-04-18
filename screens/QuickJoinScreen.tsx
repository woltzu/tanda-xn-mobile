// ══════════════════════════════════════════════════════════════════════════════
// QuickJoinScreen — Frictionless public onboarding via /join/:inviteCode
// Public, unauthenticated entry point. Pulls the circle from its invite_code,
// takes email + payment info, auto-creates the user's account, and drops
// them onto the Join Success screen.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";

// ── Theme ──────────────────────────────────────────────────────────────────────
const NAVY = "#0A2342";
const NAVY_DEEP = "#071832";
const TEAL = "#00C6AE";
const GOLD = "#E8A842";
const WHITE = "#FFFFFF";
const MUTED = "#9AA7BD";
const BORDER = "rgba(255,255,255,0.12)";
const CARD = "rgba(255,255,255,0.06)";
const DANGER = "#EF4444";

// ── Types ──────────────────────────────────────────────────────────────────────
type QuickJoinNavProp = StackNavigationProp<RootStackParamList, "QuickJoin">;
type QuickJoinRouteProp = RouteProp<RootStackParamList, "QuickJoin">;

interface CirclePreview {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  currency: string;
  frequency: string;
  memberCount: number;
  potSize: number;
}

// Alert polyfill that works on web (Alert.alert button callbacks don't
// fire reliably on react-native-web).
function showError(title: string, message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Format amount as "$X.XX" USD; falls back to raw amount for other currencies.
function formatMoney(amount: number, currency: string) {
  if (currency === "USD" || !currency) {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

// TEMP DIAGNOSTIC — logs once per module load so we can confirm the anon key
// is actually configured on the deployed Supabase client. Remove after
// resolving the 401-on-anon-insert bug.
if (typeof window !== "undefined") {
  const anySb = supabase as any;
  // eslint-disable-next-line no-console
  console.log("[QuickJoin DIAG] Supabase client config", {
    url: anySb?.supabaseUrl,
    hasKey: !!anySb?.supabaseKey,
    keyPrefix: typeof anySb?.supabaseKey === "string" ? anySb.supabaseKey.substring(0, 18) : null,
    keyLength: typeof anySb?.supabaseKey === "string" ? anySb.supabaseKey.length : 0,
    restUrl: anySb?.rest?.url,
    restHeaders: anySb?.rest?.headers
      ? {
          apikey_present: !!(anySb.rest.headers as any)?.apikey,
          apikey_prefix: typeof (anySb.rest.headers as any)?.apikey === "string"
            ? (anySb.rest.headers as any).apikey.substring(0, 18)
            : null,
          authorization_present: !!(anySb.rest.headers as any)?.Authorization,
        }
      : null,
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function QuickJoinScreen() {
  const navigation = useNavigation<QuickJoinNavProp>();
  const route = useRoute<QuickJoinRouteProp>();
  const inviteCode = (route.params?.inviteCode ?? "").trim();

  // Circle fetch state
  const [circle, setCircle] = useState<CirclePreview | null>(null);
  const [loadingCircle, setLoadingCircle] = useState<boolean>(true);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Form state
  const [emailOrPhone, setEmailOrPhone] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCvv, setCardCvv] = useState<string>("");
  const [agreed, setAgreed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fetch circle by invite code on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!inviteCode) {
          setLookupError("Missing invite code in the URL.");
          setLoadingCircle(false);
          return;
        }
        console.log("[QuickJoin] lookup start", { inviteCode });
        const { data, error } = await supabase
          .from("circles")
          .select("id, name, emoji, amount, currency, frequency, member_count")
          .eq("invite_code", inviteCode)
          .maybeSingle();
        console.log("[QuickJoin] lookup result", {
          hasRow: !!data,
          error: error ? { code: error.code, message: error.message } : null,
        });
        if (cancelled) return;
        if (error) {
          setLookupError(error.message);
        } else if (!data) {
          setLookupError("This invite link isn't valid or has expired.");
        } else {
          const amount = Number(data.amount) || 0;
          const memberCount = Number(data.member_count) || 1;
          setCircle({
            id: data.id,
            name: data.name ?? "A savings circle",
            emoji: data.emoji ?? "💰",
            amount,
            currency: data.currency ?? "USD",
            frequency: data.frequency ?? "monthly",
            memberCount,
            potSize: amount * memberCount,
          });
        }
      } catch (err: any) {
        console.error("[QuickJoin] lookup error", err);
        if (!cancelled) setLookupError(err?.message ?? "Could not load circle.");
      } finally {
        if (!cancelled) setLoadingCircle(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteCode]);

  // Format card number as "1234 5678 9012 3456"
  const onChangeCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 19);
    const spaced = digits.replace(/(.{4})/g, "$1 ").trim();
    setCardNumber(spaced);
  };

  // Format expiry as "MM/YY"
  const onChangeCardExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setCardExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  };

  const onChangeCardCvv = (v: string) => {
    setCardCvv(v.replace(/\D/g, "").slice(0, 4));
  };

  // Basic form validation — enough for a demo. Real flow would validate a
  // card via Stripe/Apple Pay etc. before ever hitting this screen's submit.
  const validate = (): string | null => {
    if (!circle) return "No circle loaded.";
    const trimmed = emailOrPhone.trim();
    if (!trimmed) return "Please enter your email or phone.";
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const looksLikePhone = /^\+?[0-9\s\-().]{7,}$/.test(trimmed);
    if (!looksLikeEmail && !looksLikePhone) return "Enter a valid email or phone.";
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return "Card number looks off.";
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return "Expiry should be MM/YY.";
    if (cardCvv.length < 3) return "CVV is too short.";
    if (!agreed) return "Please agree to the circle rules to continue.";
    return null;
  };

  const handleSubmit = async () => {
    console.log("[QuickJoin] Join & Pay tapped");
    const err = validate();
    if (err) {
      showError("Check your info", err);
      return;
    }
    if (!circle) return;

    try {
      setSubmitting(true);

      const trimmed = emailOrPhone.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      if (!isEmail) {
        showError("Email required", "Please use an email address for passwordless sign-in. Phone login is coming soon.");
        return;
      }
      const email = trimmed.toLowerCase();

      // 1. Record the join intent + payment stub in pending_joins. This
      //    row survives the magic-link round trip; the magic-link landing
      //    screen reads it back once the user is authenticated.
      console.log("[QuickJoin] creating pending_join", { email, circleId: circle.id });
      const { data: pendingJoin, error: pendingError } = await supabase
        .from("pending_joins")
        .insert({
          email,
          invite_code: inviteCode,
          circle_id: circle.id,
          payment_method: "debit_card",
          payment_details_encrypted: `****${cardNumber.replace(/\D/g, "").slice(-4)}`,
          consented_to_rules: true,
        })
        .select()
        .single();
      if (pendingError) {
        console.error("[QuickJoin] pending_joins insert failed", pendingError);
        throw pendingError;
      }
      console.log("[QuickJoin] pending_join created", pendingJoin.id);

      // 2. Send the magic link. shouldCreateUser:true makes this work for
      //    both new and returning users — passwordless, no rate-limit on
      //    password-based signUp attempts.
      const redirectTo = `https://v0-tanda-xn.vercel.app/join-confirm?pending=${pendingJoin.id}`;
      console.log("[QuickJoin] signInWithOtp", { email, redirectTo });
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
          data: {
            pending_join_id: pendingJoin.id,
            invite_code: inviteCode,
          },
        },
      });

      if (otpError) {
        console.error("[QuickJoin] signInWithOtp failed", otpError);
        if (/rate limit|security purposes/i.test(otpError.message)) {
          showError(
            "Please wait",
            "We just sent a link. Check your email, or wait 60 seconds to request a new one."
          );
        } else {
          showError("Could not send link", otpError.message);
        }
        return;
      }

      // 3. Advance to the "check your email" confirmation screen.
      console.log("[QuickJoin] magic link sent → pending confirmation screen");
      navigation.navigate("QuickJoinPendingConfirmation", {
        email,
        circleName: circle.name,
        amount: circle.amount,
        inviteCode,
      });
      return;
    } catch (error: any) {
      console.error("[QuickJoin] submit error", error);
      showError("Could not complete", error?.message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────────
  // Show ONLY the loading screen until the circle is fully loaded — no
  // partial header renders. If lookup finished with an error or null, show
  // the error state. Everything below this block assumes a populated circle.
  if (loadingCircle || (!circle && !lookupError)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.mutedLarge}>Loading circle…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (lookupError || !circle) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={56} color={MUTED} />
          <Text style={styles.errorTitle}>Invite not found</Text>
          <Text style={styles.mutedLarge}>
            {lookupError ?? "This invite link isn't valid."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const payButtonLabel = `Join & Pay ${formatMoney(circle.amount, circle.currency)}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Brand ────────────────────────────────────────────────────── */}
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>TandaXn</Text>
          </View>

          {/* ── Circle Preview ───────────────────────────────────────────── */}
          <LinearGradient
            colors={[TEAL, "#009D8B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.circleHero}
          >
            <Text style={styles.circleEmoji}>{circle.emoji}</Text>
            <Text style={styles.circleName} numberOfLines={2}>{circle.name}</Text>
            <View style={styles.circleStatsRow}>
              <View style={styles.circleStat}>
                <Text style={styles.circleStatValue}>
                  {formatMoney(circle.amount, circle.currency)}
                </Text>
                <Text style={styles.circleStatLabel}>
                  per {circle.frequency === "one-time" ? "cycle" : circle.frequency.replace(/ly$/, "")}
                </Text>
              </View>
              <View style={styles.circleDivider} />
              <View style={styles.circleStat}>
                <Text style={styles.circleStatValue}>
                  {formatMoney(circle.potSize, circle.currency)}
                </Text>
                <Text style={styles.circleStatLabel}>your payout</Text>
              </View>
              <View style={styles.circleDivider} />
              <View style={styles.circleStat}>
                <Text style={styles.circleStatValue}>{circle.memberCount}</Text>
                <Text style={styles.circleStatLabel}>members</Text>
              </View>
            </View>
          </LinearGradient>

          {/* ── Quick-pay buttons ────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Fast checkout</Text>
          <View style={styles.quickPayRow}>
            <TouchableOpacity
              style={[styles.quickPayButton, { backgroundColor: "#000000" }]}
              activeOpacity={0.85}
              onPress={() => showError("Coming soon", "Apple Pay will be available at launch.")}
            >
              <Ionicons name="logo-apple" size={18} color={WHITE} />
              <Text style={styles.quickPayText}>Pay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickPayButton, { backgroundColor: "#00D632" }]}
              activeOpacity={0.85}
              onPress={() => showError("Coming soon", "Cash App will be available at launch.")}
            >
              <Text style={[styles.quickPayText, { color: "#000" }]}>Cash App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickPayButton, { backgroundColor: "#003087" }]}
              activeOpacity={0.85}
              onPress={() => showError("Coming soon", "PayPal will be available at launch.")}
            >
              <Text style={styles.quickPayText}>PayPal</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.hr} />
            <Text style={styles.dividerText}>OR PAY WITH DEBIT</Text>
            <View style={styles.hr} />
          </View>

          {/* ── Contact ──────────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Your contact</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email or phone"
              placeholderTextColor={MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
            />
          </View>

          {/* ── Debit card ───────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Debit card</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="card-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              value={cardNumber}
              onChangeText={onChangeCardNumber}
              maxLength={23}
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginRight: 10 }]}>
              <Ionicons name="calendar-outline" size={18} color={MUTED} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="MM/YY"
                placeholderTextColor={MUTED}
                keyboardType="number-pad"
                value={cardExpiry}
                onChangeText={onChangeCardExpiry}
                maxLength={5}
              />
            </View>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="CVV"
                placeholderTextColor={MUTED}
                keyboardType="number-pad"
                value={cardCvv}
                onChangeText={onChangeCardCvv}
                maxLength={4}
                secureTextEntry
              />
            </View>
          </View>
          <View style={styles.noCreditRow}>
            <Ionicons name="information-circle-outline" size={14} color={GOLD} />
            <Text style={styles.noCreditText}>Debit cards only. Credit cards are not accepted.</Text>
          </View>

          {/* ── Agreement ────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.agreeRow}
            activeOpacity={0.7}
            onPress={() => setAgreed((v) => !v)}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={14} color={NAVY} />}
            </View>
            <Text style={styles.agreeText}>
              I agree to the circle rules: contributions are due each cycle, late payments incur a
              fee, and payouts rotate among members.
            </Text>
          </TouchableOpacity>

          {/* ── Pay CTA ──────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.payButton, submitting && styles.payButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color={NAVY} />
                <Text style={styles.payButtonText}>{payButtonLabel}</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footnote}>
            By joining, you authorize TandaXn to charge your selected payment method for the
            contribution amount at each cycle. You can cancel anytime from your dashboard.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NAVY_DEEP },
  scroll: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },

  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL },
  brand: { color: WHITE, fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },

  circleHero: {
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  circleEmoji: { fontSize: 44 },
  circleName: { fontSize: 22, fontWeight: "800", color: WHITE, marginTop: 8, textAlign: "center" },
  circleStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  circleStat: { flex: 1, alignItems: "center" },
  circleStatValue: { fontSize: 18, fontWeight: "800", color: WHITE },
  circleStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  circleDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 4 },

  sectionLabel: { color: MUTED, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginTop: 6 },

  quickPayRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  quickPayButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  quickPayText: { color: WHITE, fontSize: 14, fontWeight: "700" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  hr: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { color: MUTED, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: WHITE, fontSize: 15, paddingVertical: 14 },
  row: { flexDirection: "row", marginBottom: 10 },

  noCreditRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, marginBottom: 18 },
  noCreditText: { color: GOLD, fontSize: 12, fontWeight: "600" },

  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 18 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: TEAL, borderColor: TEAL },
  agreeText: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 19 },

  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText: { color: NAVY, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  footnote: {
    color: MUTED,
    fontSize: 11,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 16,
    paddingHorizontal: 6,
  },

  mutedLarge: { color: MUTED, fontSize: 15, textAlign: "center" },
  errorTitle: { color: WHITE, fontSize: 20, fontWeight: "700", marginTop: 4 },
});
