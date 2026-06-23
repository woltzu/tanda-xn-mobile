// ══════════════════════════════════════════════════════════════════════════
// TripPaymentScreen — Join-trip Bucket A.4
// ══════════════════════════════════════════════════════════════════════════
//
// Participant-driven payment flow for joining a trip. The previous
// version was almost entirely mock-driven: MOCK_PAYMENT for the headline
// installment, a Visa-4242 payment-method card, a `processPayment` that
// resolved to a no-op because useTripPayment didn't expose `pay`, and
// no Stripe PaymentSheet anywhere in the code path. The button looked
// like a Stripe checkout but actually did nothing.
//
// This rewrite:
//   • Reads `participantId` from route params (`participantId='me'`
//     fallback removed — caller must pass a real UUID).
//   • Fetches the participant + trip via
//     TripOrganizerEngine.getParticipantDetail (now fixed in A.1 to
//     filter trip_payments by the right column).
//   • Renders a deposit-vs-full toggle when the participant is unpaid
//     and the trip enables a deposit. When paid_in_full, the screen
//     short-circuits to a "Paid in full" success state.
//   • Stages the PaymentIntent via TripOrganizerEngine.createPaymentIntent
//     with the participant_id + payment_type stamped into PI metadata,
//     then opens the Stripe PaymentSheet via usePayment().presentPaymentSheet
//     (the same hook the contribution/wallet flows use).
//   • Navigates to TripPaymentSuccess on confirm and TripPaymentFailed
//     on error.
//
// The server-side trigger chain (migration 241) does the heavy lifting
// after the user dismisses Stripe's sheet — record_trip_payment_succeeded
// flips payment_status and promotes pending→confirmed, the notify
// trigger pings the organizer, the AI-decision wrapper records the
// event. The client only needs to drive the PaymentSheet and route the
// user to the right post-flow screen.
// ══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { TripOrganizerEngine } from "../services/TripOrganizerEngine";
import type { Trip, TripParticipant, TripPayment } from "../services/TripOrganizerEngine";
import { useAuth } from "../context/AuthContext";
import { usePayment } from "../context/PaymentContext";
import { showToast } from "../components/Toast";
import { useEventTracker } from "../hooks/useEventTracker";

// Join-trip Bucket B.1 — HelpSheet topic ids. Order mirrors what a first-
// time payer asks in order: what am I paying for → what's the fee →
// can I get my money back → what changes after.
const HELP_TOPICS = [
  "deposit_vs_full",
  "processing_fee",
  "refund_policy",
  "after_pay",
] as const;

const COACH_SEEN_KEY = "@tandaxn_trip_payment_coach_seen_v1";

const GOLD = "#E8A842";
const GOLD_BG = "rgba(232,168,66,0.1)";
const TEAL = colors.accentTeal;
const NAVY = colors.primaryNavy;
const GREEN = "#10B981";

type PaymentChoice = "deposit" | "full";

const fmtMoney = (dollars: number): string =>
  `$${dollars.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TripPaymentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { presentPaymentSheet } = usePayment();

  const participantId: string = route.params?.participantId ?? "";
  // tripId + paymentType are advisory — we re-derive trip context from
  // the participant row so a stale param can't desync the screen.
  const incomingPaymentType: PaymentChoice =
    route.params?.paymentType === "full" ? "full" : "deposit";

  // ── State ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participant, setParticipant] = useState<TripParticipant | null>(null);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [choice, setChoice] = useState<PaymentChoice>(incomingPaymentType);
  const [processing, setProcessing] = useState(false);

  // Join-trip Bucket B.1 — HelpSheet visibility.
  const [helpOpen, setHelpOpen] = useState(false);

  // Join-trip Bucket B.2 — first-visit coach mark anchored to the
  // deposit/full toggle. Suppressed when the user is paying a final
  // balance (paymentStatus already promoted past 'unpaid'), since the
  // toggle isn't meaningfully a choice in that case.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join-trip Bucket C.1 — telemetry.
  const { track } = useEventTracker();
  const openedFiredRef = useRef(false);

  // Refresh helper — used both for the initial mount and after a
  // PaymentSheet returns success (the screen needs to render the new
  // payment_status before we navigate to the success screen).
  const reload = async () => {
    if (!participantId) {
      setErrorMsg(t("trip_payment.missing_participant"));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const detail = await TripOrganizerEngine.getParticipantDetail(participantId);
      setParticipant(detail);
      setPayments(detail.payments ?? []);
      const tripRow = await TripOrganizerEngine.getTripById(detail.tripId);
      setTrip(tripRow);
    } catch (err: any) {
      console.warn("[TripPaymentScreen] load failed:", err);
      setErrorMsg(err?.message || t("trip_payment.load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  // Coach-mark gating + fade-out. Runs once participant resolves so we
  // can read paymentStatus before deciding to show. Auto-dismiss after
  // 4 s with a 250 ms fade; tap-anywhere also dismisses. The flag is
  // stamped in AsyncStorage on dismiss so the coach never reappears.
  useEffect(() => {
    if (!participant) return;
    // Don't coach users who've already paid the deposit — they've seen
    // the toggle on a prior visit (or simply don't need it for the
    // remaining-balance payment).
    if (participant.paymentStatus !== "unpaid") return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_SEEN_KEY);
        if (cancelled || seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
        coachTimeoutRef.current = setTimeout(() => {
          dismissCoach();
        }, 4000);
      } catch {
        /* AsyncStorage errors are non-fatal — fall back to hiding the coach. */
      }
    })();
    return () => {
      cancelled = true;
      if (coachTimeoutRef.current) clearTimeout(coachTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant?.paymentStatus, participant?.id]);

  const dismissCoach = () => {
    if (coachTimeoutRef.current) {
      clearTimeout(coachTimeoutRef.current);
      coachTimeoutRef.current = null;
    }
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(COACH_SEEN_KEY, "1").catch(() => undefined);
  };

  // Join-trip Bucket C.1 — `trip_payment.opened` fires once per session
  // after participant + trip resolve. Gated on participant so we have a
  // real payment_status to attach; gated on trip so the deposit-option
  // flag is meaningful.
  useEffect(() => {
    if (!participant || !trip || openedFiredRef.current) return;
    openedFiredRef.current = true;
    track({
      eventType: "trip_payment.opened",
      eventCategory: "cross_border",
      eventAction: "view",
      eventLabel: "trip_payment_screen",
      eventValue: {
        trip_id: trip.id,
        participant_id: participant.id,
        payment_status: participant.paymentStatus,
        is_deposit_available: (trip.depositCents ?? 0) > 0,
      },
    });
  }, [participant, trip, track]);

  // ── Derived amounts (all in DOLLARS to match the DB column unit) ─────
  // The Trip type's `*Cents` fields are a misnomer — mapTrip reads them
  // from DECIMAL DOLLARS columns (price_per_person, deposit_amount), so
  // they're already dollars. We treat them as such throughout.
  const price = trip?.priceCents ?? 0;
  const depositAmt = trip?.depositCents ?? 0;
  const totalPaid = participant?.totalPaidCents ?? 0;
  const remaining = Math.max(0, price - totalPaid);
  // A deposit option is "real" when there's a deposit amount AND it's
  // strictly less than the full price (otherwise it's just the full
  // payment under a different label).
  const hasDepositOption = depositAmt > 0 && depositAmt < price;
  const fullyPaid = participant?.paymentStatus === "paid_in_full" || remaining <= 0;

  // Amount the user will be charged this transaction.
  const chargeDollars =
    choice === "deposit" && hasDepositOption ? Math.max(0, depositAmt - totalPaid) : remaining;
  const chargeCents = Math.round(chargeDollars * 100);

  // If we don't have a deposit option, force `full` so the toggle isn't
  // a tap-target that doesn't change anything.
  useEffect(() => {
    if (!hasDepositOption && choice !== "full") setChoice("full");
  }, [hasDepositOption, choice]);

  // ── Pay handler ──────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!trip || !participant || !user?.id) {
      Alert.alert(
        t("trip_payment.alert_failed_title"),
        t("trip_payment.missing_context"),
      );
      return;
    }
    if (chargeCents < 50) {
      // Stripe rejects sub-50¢ charges; surface a friendly error.
      Alert.alert(
        t("trip_payment.alert_failed_title"),
        t("trip_payment.amount_too_small"),
      );
      return;
    }
    setProcessing(true);
    try {
      // Step 1: stage the PaymentIntent. The EF stamps participant_id +
      // payment_type into metadata so the webhook can route to the
      // record_trip_payment_succeeded RPC.
      const { clientSecret } = await TripOrganizerEngine.createPaymentIntent({
        tripId: trip.id,
        amountCents: chargeCents,
        purpose: choice === "deposit" ? "trip_deposit" : "trip_full_payment",
        participantId: participant.id,
        paymentType: choice,
      });
      // Join-trip Bucket C.1 — fire intent_created after the EF returns
      // a clientSecret. amount is in dollars to match the user-facing UI
      // and the trip_payments.amount column unit.
      track({
        eventType: "trip_payment.intent_created",
        eventCategory: "cross_border",
        eventAction: "create",
        eventLabel: choice,
        eventValue: {
          trip_id: trip.id,
          participant_id: participant.id,
          amount: chargeDollars,
          payment_type: choice,
        },
      });

      // Step 2: present the PaymentSheet. usePayment().presentPaymentSheet
      // initializes the sheet (merchantDisplayName etc.) AND presents it
      // — see PaymentContext.presentPaymentSheetAction. Returns
      // { success, error? }.
      const result = await presentPaymentSheet(clientSecret);
      if (!result.success) {
        // Join-trip Bucket C.1 — sanitise the Stripe message before
        // putting it into telemetry: keep the first 200 chars and strip
        // out anything that looks like a token / id so PII or PI ids
        // don't leak. (Stripe's message rarely contains PII, but the
        // safer default is the truncation.)
        const sanitised = (result.error || "")
          .replace(/(pi|seti|cus|src|tok|ch)_[a-zA-Z0-9_]+/g, "<id>")
          .slice(0, 200);
        track({
          eventType: "trip_payment.failed",
          eventCategory: "cross_border",
          eventAction: "failure",
          eventLabel: "payment_sheet_error",
          eventValue: {
            trip_id: trip.id,
            participant_id: participant.id,
            error_code: "payment_sheet_error",
            error_message: sanitised,
          },
        });
        navigation.replace("TripPaymentFailed", {
          tripId: trip.id,
          participantId: participant.id,
          errorMessage: result.error || t("trip_payment.failed_default"),
        });
        return;
      }

      // Join-trip Bucket C.1 — payment confirmed by Stripe. Fire BEFORE
      // navigate so the event lands even if the navigation transition
      // unmounts the screen mid-flush.
      track({
        eventType: "trip_payment.confirmed",
        eventCategory: "cross_border",
        eventAction: "success",
        eventLabel: choice,
        eventValue: {
          trip_id: trip.id,
          participant_id: participant.id,
          amount: chargeDollars,
          payment_type: choice,
        },
      });

      // Step 3: PaymentSheet confirmed. The succeeded webhook may race
      // ahead of us; refetch the participant so the success screen has
      // the latest payment_status if we read it from there. We rely on
      // the navigation params, not the local state, to drive the
      // success screen's labels.
      await reload();
      navigation.replace("TripPaymentSuccess", {
        tripId: trip.id,
        participantId: participant.id,
        amountDollars: chargeDollars,
        paymentType: choice,
      });
    } catch (err: any) {
      console.warn("[TripPaymentScreen] pay failed:", err);
      // Sanitise + truncate the error text before telemetry; same rule
      // as the payment-sheet error path above.
      const sanitised = String(err?.message || "")
        .replace(/(pi|seti|cus|src|tok|ch)_[a-zA-Z0-9_]+/g, "<id>")
        .slice(0, 200);
      track({
        eventType: "trip_payment.failed",
        eventCategory: "cross_border",
        eventAction: "failure",
        eventLabel: "exception",
        eventValue: {
          trip_id: trip?.id ?? null,
          participant_id: participant?.id ?? null,
          error_code: "exception",
          error_message: sanitised,
        },
      });
      navigation.replace("TripPaymentFailed", {
        tripId: trip?.id,
        participantId: participant?.id,
        errorMessage: err?.message || t("trip_payment.failed_default"),
      });
    } finally {
      setProcessing(false);
    }
  };

  // Join-trip Bucket C.1 — `method_selected` fires when the user changes
  // the toggle. We wrap setChoice so the call sites stay one-liner.
  const selectChoice = (next: PaymentChoice) => {
    if (next === choice) return;
    setChoice(next);
    if (trip) {
      track({
        eventType: "trip_payment.method_selected",
        eventCategory: "cross_border",
        eventAction: "select",
        eventLabel: next,
        eventValue: {
          trip_id: trip.id,
          participant_id: participant?.id ?? null,
          method: next,
        },
      });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={NAVY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("trip_payment.title")}</Text>
          {/* Join-trip Bucket B.1 — (?) HelpSheet trigger. */}
          <TouchableOpacity
            onPress={() => setHelpOpen(true)}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t("trip_payment.help.title")}
          >
            <Ionicons name="help-circle-outline" size={24} color={NAVY} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryBtnText}>{t("trip_payment.failed_try_again")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (fullyPaid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={NAVY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("trip_payment.title")}</Text>
          {/* Join-trip Bucket B.1 — (?) HelpSheet trigger. */}
          <TouchableOpacity
            onPress={() => setHelpOpen(true)}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t("trip_payment.help.title")}
          >
            <Ionicons name="help-circle-outline" size={24} color={NAVY} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={56} color={GREEN} />
          <Text style={styles.paidTitle}>{t("trip_payment.paid_in_full")}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryBtnText}>{t("trip_payment.success_cta")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("trip_payment.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Trip context strip */}
        <View style={styles.tripCard}>
          <Text style={styles.tripName}>{trip?.name ?? ""}</Text>
          <View style={styles.tripMetaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.tripMetaText}>{trip?.destination ?? ""}</Text>
          </View>
          {trip?.startDate && trip?.endDate ? (
            <View style={styles.tripMetaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.tripMetaText}>
                {trip.startDate} → {trip.endDate}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Deposit / full toggle */}
        {hasDepositOption && participant?.paymentStatus === "unpaid" && (
          <View style={styles.toggleCard}>
            {/* Join-trip Bucket B.2 — coach mark anchored above the toggle.
                Renders only on first-visit when payment_status='unpaid'.
                The bubble's tail (rotated square) sits just below the
                title and points at the deposit radio row. */}
            {coachVisible && (
              <Animated.View
                style={[styles.coachWrap, { opacity: coachOpacity }]}
                pointerEvents="box-none"
              >
                <TouchableOpacity
                  style={styles.coachBubble}
                  activeOpacity={0.9}
                  onPress={dismissCoach}
                  accessibilityRole="button"
                  accessibilityLabel={t("trip_payment.coach.dismiss")}
                >
                  <Ionicons
                    name="bulb-outline"
                    size={16}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.coachText}>{t("trip_payment.coach.title")}</Text>
                </TouchableOpacity>
                <View style={styles.coachTail} />
              </Animated.View>
            )}
            <Text style={styles.toggleTitle}>{t("trip_payment.toggle_title")}</Text>
            <TouchableOpacity
              style={[styles.choiceRow, choice === "deposit" && styles.choiceRowActive]}
              onPress={() => selectChoice("deposit")}
              activeOpacity={0.7}
            >
              <View style={[styles.radio, choice === "deposit" && styles.radioActive]}>
                {choice === "deposit" && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.choiceLabel}>
                {t("trip_payment.deposit_label", { amount: fmtMoney(depositAmt) })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.choiceRow, choice === "full" && styles.choiceRowActive]}
              onPress={() => selectChoice("full")}
              activeOpacity={0.7}
            >
              <View style={[styles.radio, choice === "full" && styles.radioActive]}>
                {choice === "full" && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.choiceLabel}>
                {t("trip_payment.full_label", { amount: fmtMoney(price) })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Breakdown — what they're paying right now */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>{t("trip_payment.breakdown_title")}</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t("trip_payment.label_total_charged")}</Text>
            <Text style={styles.breakdownTotalValue}>{fmtMoney(chargeDollars)}</Text>
          </View>
          {totalPaid > 0 && (
            <View style={styles.breakdownSubRow}>
              <Text style={styles.breakdownLabel}>{t("trip_payment.label_paid")}</Text>
              <Text style={styles.breakdownValue}>{fmtMoney(totalPaid)}</Text>
            </View>
          )}
          {price > 0 && (
            <View style={styles.breakdownSubRow}>
              <Text style={styles.breakdownLabel}>{t("trip_payment.label_total")}</Text>
              <Text style={styles.breakdownValue}>{fmtMoney(price)}</Text>
            </View>
          )}
        </View>

        {/* Past payments — now actually populated since the engine A.1 fix
            stopped filtering by the wrong column. */}
        {payments.length > 0 && (
          <View style={styles.paymentsCard}>
            <Text style={styles.breakdownTitle}>{t("trip_payment.history_title")}</Text>
            {payments.map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <Text style={styles.paymentRowLabel}>
                  {p.type} · {p.status}
                </Text>
                <Text style={styles.paymentRowAmount}>
                  {fmtMoney(p.amountCents)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Join-trip Bucket B.1 — HelpSheet rendered as a sibling of the
          ScrollView so the modal can size full-screen without being
          constrained by the scroll container. */}
      <TripPaymentHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />

      {/* Pay button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.payButton, processing && { opacity: 0.6 }]}
          onPress={handlePay}
          disabled={processing}
          activeOpacity={0.85}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#FFF" />
              <Text style={styles.payButtonText}>
                {t("trip_payment.pay_button_with_amount", {
                  amount: fmtMoney(chargeDollars),
                })}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.stripeFooter}>{t("trip_payment.stripe_footer")}</Text>
      </View>
    </SafeAreaView>
  );
};

export default TripPaymentScreen;

// silence unused-import lint without changing runtime — useMemo retained
// for future per-row memoization (kept the import to avoid a churny diff
// in a later bucket).
void useMemo;
void showToast;

// ══════════════════════════════════════════════════════════════════════════
// TripPaymentHelpSheet — Join-trip Bucket B.1
// ══════════════════════════════════════════════════════════════════════════
// 4 topics: deposit-vs-full, processing fee, refund policy, what changes
// after I pay. Mirrors the inline-HelpSheet pattern from
// CreateTripWizardScreen so users get a consistent feel across the trip
// flow.
function TripPaymentHelpSheet({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: (key: string, opts?: any) => string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.helpBackdrop} onPress={onClose}>
        <Pressable style={styles.helpSheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <View style={styles.helpHeaderRow}>
            <Text style={styles.helpTitle}>{t("trip_payment.help.title")}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("trip_payment.help.close")}
            >
              <Ionicons name="close" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.helpScroll}>
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={styles.helpItem}>
                <Text style={styles.helpItemTitle}>
                  {t(`trip_payment.help.topic_${topic}`)}
                </Text>
                <Text style={styles.helpItemBody}>
                  {t(`trip_payment.help.topic_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, gap: 12 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  errorText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  retryBtnText: { color: "#FFF", fontSize: typography.body, fontWeight: typography.semibold },

  paidTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: NAVY,
    marginTop: 8,
  },

  tripCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    marginVertical: 12,
    gap: 6,
  },
  tripName: { fontSize: 18, fontWeight: "700", color: NAVY, marginBottom: 4 },
  tripMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tripMetaText: { fontSize: typography.bodySmall, color: colors.textSecondary },

  toggleCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  toggleTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceRowActive: {
    borderColor: TEAL,
    backgroundColor: "rgba(0,198,174,0.06)",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: TEAL },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TEAL,
  },
  choiceLabel: {
    flex: 1,
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.medium,
  },

  breakdownCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
  },
  breakdownTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  breakdownSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  breakdownLabel: { fontSize: typography.body, color: colors.textSecondary },
  breakdownValue: { fontSize: typography.body, color: NAVY, fontWeight: typography.semibold },
  breakdownTotalValue: { fontSize: 22, fontWeight: "800", color: GOLD },

  paymentsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentRowLabel: { fontSize: typography.bodySmall, color: colors.textSecondary, textTransform: "capitalize" },
  paymentRowAmount: { fontSize: typography.bodySmall, color: NAVY, fontWeight: typography.semibold },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: radius.button,
    width: "100%",
  },
  payButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
  stripeFooter: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 10,
    textAlign: "center",
  },

  _gold_bg_keep: { backgroundColor: GOLD_BG },

  // ── Coach mark — Bucket B.2 ──
  // The wrap is absolutely positioned over the toggle card so the bubble
  // floats above the title. The tail is a small rotated square that
  // visually anchors the bubble to the radio rows below.
  coachWrap: {
    position: "absolute",
    top: -56,
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 10,
  },
  coachBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: "100%",
  },
  coachText: {
    color: "#FFF",
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    flexShrink: 1,
  },
  coachTail: {
    width: 12,
    height: 12,
    backgroundColor: NAVY,
    transform: [{ rotate: "45deg" }],
    marginTop: -6,
  },

  // ── HelpSheet — Bucket B.1 ──
  helpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  helpSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: spacing.xl,
    maxHeight: "80%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 12,
  },
  helpHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
  },
  helpScroll: { paddingBottom: 8 },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  helpItemTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 4,
  },
  helpItemBody: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
