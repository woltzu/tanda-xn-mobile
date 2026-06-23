// ═══════════════════════════════════════════════════════════════════════════
// screens/LeaveReviewScreen.tsx — Leave-review Bucket A.5
// ═══════════════════════════════════════════════════════════════════════════
//
// After-trip review surface. Renders:
//   • Header (trip name + dates)
//   • Section 1 — Organizer rating: 1–5 stars + optional 280-char comment
//   • Section 2 — Itinerary ratings (collapsible, default collapsed):
//       per-day list of activities, each tappable with stars + 140-char text
//   • Submit button (enabled once the organizer rating is set)
//
// Eligibility (trip ended + participant confirmed + not already reviewed) is
// gated by the caller (MyTripStatus banner) and re-enforced server-side in
// submit_trip_review. The screen still re-checks via useMyTripReview to
// handle direct deep-link entry.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";
import {
  useMyTripStatus,
  usePublicTrip,
  useItineraryBuilder,
} from "../hooks/useTripOrganizer";
import { useMyTripReview } from "../hooks/useMyTripReview";
import { useEventTracker } from "../hooks/useEventTracker";
import StarRatingInput from "../components/StarRatingInput";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const GREEN = "#10B981";
const GREEN_BG = "#ECFDF5";

const ORG_MAX = 280;
const ACT_MAX = 140;

// Leave-review Bucket B.5 — first-visit coach mark gate.
const COACH_KEY = "@tandaxn_leave_review_coach_seen_v1";

const LeaveReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const participantId: string = route.params?.participantId ?? "";
  const tripId: string = route.params?.tripId ?? "";

  // We need the trip + participant + itinerary to gate eligibility and
  // render the two sections. Reuse the same hooks MyTripStatus uses so
  // the realtime + cache pathways stay consistent.
  const myStatus = useMyTripStatus(tripId, user?.id ?? "");
  const publicTrip = usePublicTrip("", tripId);
  const itinerary = useItineraryBuilder(tripId);

  const participant =
    myStatus.participant && myStatus.participant.id === participantId
      ? myStatus.participant
      : null;
  const trip = publicTrip?.trip ?? null;

  const reviewState = useMyTripReview(trip, participant);

  // Local form state.
  const [orgRating, setOrgRating] = useState(0);
  const [orgComment, setOrgComment] = useState("");
  const [itineraryExpanded, setItineraryExpanded] = useState(false);
  const [actStates, setActStates] = useState<
    Record<string, { rating: number; text: string }>
  >({});

  // Leave-review Bucket B.4 + B.5 — HelpSheet + coach mark state.
  const [helpOpen, setHelpOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  // Leave-review Bucket C.4 — telemetry. screen_viewed fires once per mount
  // after the participant resolves so the event always carries the
  // participant_id/trip_id pair we want to slice on.
  const { track } = useEventTracker();
  const viewTrackedRef = React.useRef(false);
  useEffect(() => {
    if (viewTrackedRef.current) return;
    if (!participant) return;
    viewTrackedRef.current = true;
    track({
      name: "trip_review.screen_viewed",
      properties: { participant_id: participant.id, trip_id: tripId },
    });
  }, [participant, tripId, track]);

  useEffect(() => {
    // Show the coach once eligibility is confirmed (so we don't flash it
    // on the loading / guard renders).
    if (!participant || reviewState.alreadyReviewed || !reviewState.eligible) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_KEY);
        if (seen) return;
        setCoachOpen(true);
        timer = setTimeout(() => {
          setCoachOpen(false);
          AsyncStorage.setItem(COACH_KEY, "1").catch(() => undefined);
        }, 4000);
      } catch {
        // AsyncStorage unavailable — silently skip.
      }
    })();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [participant, reviewState.alreadyReviewed, reviewState.eligible]);

  const dismissCoach = () => {
    setCoachOpen(false);
    AsyncStorage.setItem(COACH_KEY, "1").catch(() => undefined);
  };

  const isBusy =
    myStatus.loading || publicTrip?.loading || reviewState.isLoading;

  const setActivityRating = (activityId: string, rating: number) => {
    setActStates((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] ?? { text: "" }), rating },
    }));
    // Bucket C.4 — activity-section star tap.
    track({
      name: "trip_review.star_tapped",
      properties: { section: "activity", rating, activity_id: activityId, trip_id: tripId },
    });
  };

  const handleOrgRating = (rating: number) => {
    setOrgRating(rating);
    // Bucket C.4 — organizer-section star tap.
    track({
      name: "trip_review.star_tapped",
      properties: { section: "organizer", rating, trip_id: tripId },
    });
  };

  const setActivityText = (activityId: string, text: string) => {
    setActStates((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] ?? { rating: 0 }), text },
    }));
  };

  const activityPayload = useMemo(() => {
    return Object.entries(actStates)
      .filter(([, v]) => v.rating > 0)
      .map(([activityId, v]) => ({
        activityId,
        rating: v.rating,
        text: v.text.trim() || null,
      }));
  }, [actStates]);

  const canSubmit = orgRating >= 1 && orgRating <= 5 && !reviewState.isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // Bucket C.4 — submit_attempted is fire-once per tap; succeed/fail
    // follow with the same correlation id (trip_id).
    track({
      name: "trip_review.submit_attempted",
      properties: { trip_id: tripId, rating: orgRating, activity_count: activityPayload.length },
    });
    try {
      await reviewState.submit(
        orgRating,
        orgComment.trim() || null,
        activityPayload.length > 0 ? activityPayload : null,
      );
      track({
        name: "trip_review.submit_succeeded",
        properties: {
          trip_id: tripId,
          rating: orgRating,
          has_activity_reviews: activityPayload.length > 0,
        },
      });
      showToast(t("leave_review.success_toast"), "success");
      // Land back on MyTripStatus where the banner has now flipped.
      navigation.navigate("MyTripStatus", { tripId });
    } catch (err: any) {
      // Sanitise: strip the JS prefix and keep only the first line of the
      // postgres exception so we never leak SQL fragments into telemetry.
      const raw = (err?.message ?? "").toString();
      const sanitized = raw.split("\n")[0].slice(0, 200);
      track({
        name: "trip_review.submit_failed",
        properties: { trip_id: tripId, error_message: sanitized },
      });
      const msg =
        err?.message?.includes("Review already submitted")
          ? t("leave_review.already_reviewed")
          : t("leave_review.error_toast");
      showToast(msg, "error");
    }
  };

  // ── Loading shell ────────────────────────────────────────────────────────
  if (isBusy) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!participant || !trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <Header onBack={() => navigation.goBack()} t={t} onHelp={() => setHelpOpen(true)} />
        <View style={styles.guardContainer}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.guardText}>{t("leave_review.guard_missing")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (reviewState.alreadyReviewed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <Header onBack={() => navigation.goBack()} t={t} onHelp={() => setHelpOpen(true)} />
        <View style={styles.guardContainer}>
          <Ionicons name="checkmark-circle" size={36} color={GREEN} />
          <Text style={styles.guardText}>{t("leave_review.already_reviewed")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!reviewState.eligible) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <Header onBack={() => navigation.goBack()} t={t} onHelp={() => setHelpOpen(true)} />
        <View style={styles.guardContainer}>
          <Ionicons name="time-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.guardText}>{t("leave_review.guard_not_eligible")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  const formatDateRange = (): string => {
    if (!trip.startDate || !trip.endDate) return "";
    try {
      const s = new Date(trip.startDate);
      const e = new Date(trip.endDate);
      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
      return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", {
        ...opts,
        year: "numeric",
      })}`;
    } catch {
      return "";
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <Header onBack={() => navigation.goBack()} t={t} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trip identity */}
        <View style={styles.tripIdentity}>
          <Text style={styles.tripName}>{trip.name || t("leave_review.untitled_trip")}</Text>
          <Text style={styles.tripDates}>{formatDateRange()}</Text>
        </View>

        {/* ── Organizer rating ───────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("leave_review.organizer_prompt")}</Text>
          <View style={styles.starsRowWrap}>
            <StarRatingInput value={orgRating} onChange={handleOrgRating} size={36} />
          </View>
          <TextInput
            style={styles.textArea}
            value={orgComment}
            onChangeText={setOrgComment}
            placeholder={t("leave_review.organizer_comment_placeholder")}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={ORG_MAX}
          />
          <Text style={styles.charCount}>{orgComment.length}/{ORG_MAX}</Text>
        </View>

        {/* ── Itinerary ratings (collapsible) ────────────────────────── */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.itineraryHeader}
            onPress={() => setItineraryExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>
              {t("leave_review.itinerary_section_title")}
            </Text>
            <Ionicons
              name={itineraryExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={NAVY}
            />
          </TouchableOpacity>

          {itineraryExpanded && (
            <View style={styles.itineraryBody}>
              {itinerary.days.length === 0 ? (
                <Text style={styles.itineraryEmpty}>
                  {t("leave_review.itinerary_empty")}
                </Text>
              ) : (
                itinerary.days.map((day, dIdx) => (
                  <View
                    key={day.id}
                    style={[styles.dayBlock, dIdx > 0 && styles.dayBlockBorder]}
                  >
                    <Text style={styles.dayTitle}>
                      {t("leave_review.day_label", { number: dIdx + 1 })}
                      {day.title ? ` — ${day.title}` : ""}
                    </Text>
                    {day.activities.length === 0 ? (
                      <Text style={styles.itineraryEmpty}>
                        {t("leave_review.day_empty")}
                      </Text>
                    ) : (
                      day.activities.map((act) => {
                        const state = actStates[act.id] ?? { rating: 0, text: "" };
                        return (
                          <View key={act.id} style={styles.activityRow}>
                            <Text style={styles.activityTitle}>{act.title}</Text>
                            <StarRatingInput
                              value={state.rating}
                              onChange={(r) => setActivityRating(act.id, r)}
                              size={22}
                            />
                            {state.rating > 0 && (
                              <TextInput
                                style={styles.activityInput}
                                value={state.text}
                                onChangeText={(txt) => setActivityText(act.id, txt)}
                                placeholder={t(
                                  "leave_review.activity_rating_placeholder",
                                )}
                                placeholderTextColor="#9CA3AF"
                                maxLength={ACT_MAX}
                              />
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* ── Submit ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {reviewState.isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {t("leave_review.submit_button")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Leave-review Bucket B.5 — first-visit coach mark. Anchored near the
          organizer-rating stars; dismiss on tap or after 4s. Suppressed in
          guard renders (handled by useEffect gates). */}
      {coachOpen && (
        <Pressable style={styles.coachOverlay} onPress={dismissCoach}>
          <View style={styles.coachCard}>
            <View style={styles.coachTitleRow}>
              <Ionicons name="star" size={18} color="#F59E0B" />
              <Text style={styles.coachTitle}>{t("leave_review.coach_title")}</Text>
            </View>
            <Text style={styles.coachDismiss}>{t("leave_review.coach_dismiss")}</Text>
          </View>
        </Pressable>
      )}

      {/* Leave-review Bucket B.4 — 3-topic HelpSheet. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />
    </SafeAreaView>
  );
};

// ── Leave-review Bucket B.4 — HelpSheet (3 topics) ──────────────────────────
const HELP_TOPICS = [
  { key: "how", icon: "star-outline" as const },
  { key: "feedback", icon: "create-outline" as const },
  { key: "public", icon: "eye-outline" as const },
];

const HelpSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  t: (key: string) => string;
}> = ({ visible, onClose, t }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t("leave_review.help_title")}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("leave_review.help_close")}
            >
              <Ionicons name="close" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetScroll}>
            {HELP_TOPICS.map((topic) => (
              <View key={topic.key} style={styles.helpTopic}>
                <View style={styles.helpTopicHeader}>
                  <Ionicons name={topic.icon} size={18} color={TEAL} />
                  <Text style={styles.helpTopicTitle}>
                    {t(`leave_review.help_topic_${topic.key}`)}
                  </Text>
                </View>
                <Text style={styles.helpTopicBody}>
                  {t(`leave_review.help_topic_${topic.key}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// Header shared across guard + main render.
const Header: React.FC<{
  onBack: () => void;
  t: (k: string) => string;
  onHelp?: () => void;
}> = ({ onBack, t, onHelp }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
      <Ionicons name="arrow-back" size={24} color={NAVY} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{t("leave_review.title")}</Text>
    {onHelp ? (
      <TouchableOpacity
        onPress={onHelp}
        style={styles.headerBtn}
        accessibilityRole="button"
        accessibilityLabel={t("leave_review.help_title")}
      >
        <Ionicons name="help-circle-outline" size={24} color={NAVY} />
      </TouchableOpacity>
    ) : (
      <View style={styles.headerBtn} />
    )}
  </View>
);

export default LeaveReviewScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  centered: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  tripIdentity: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  tripName: {
    fontSize: 22,
    fontWeight: "800",
    color: NAVY,
  },
  tripDates: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
  },
  starsRowWrap: {
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    padding: 12,
    minHeight: 80,
    color: NAVY,
    textAlignVertical: "top",
    fontSize: typography.body,
  },
  charCount: {
    fontSize: typography.label,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },

  itineraryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itineraryBody: {
    marginTop: spacing.md,
  },
  itineraryEmpty: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  dayBlock: {
    paddingVertical: spacing.md,
  },
  dayBlockBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: spacing.sm,
  },
  activityRow: {
    paddingVertical: spacing.sm,
    gap: 8,
  },
  activityTitle: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.semibold,
  },
  activityInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: NAVY,
    fontSize: typography.bodySmall,
  },

  submitBtn: {
    backgroundColor: TEAL,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitBtnDisabled: {
    backgroundColor: "#94D5CD",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: typography.bold,
  },

  guardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: 12,
  },
  guardText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // ── Leave-review Bucket B.5 — coach mark ────────────────────────────────
  coachOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 39, 80, 0.55)",
    justifyContent: "flex-end",
    padding: spacing.lg,
    paddingBottom: 40,
  },
  coachCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  coachTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  coachTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
    flex: 1,
    lineHeight: 22,
  },
  coachDismiss: {
    marginTop: 10,
    fontSize: typography.label,
    color: TEAL,
    fontWeight: typography.semibold,
    textAlign: "right",
  },

  // ── Leave-review Bucket B.4 — HelpSheet ─────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 39, 80, 0.55)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: "85%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    flex: 1,
  },
  sheetScroll: {
    maxHeight: "90%",
  },
  helpTopic: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  helpTopicHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  helpTopicTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  helpTopicBody: {
    fontSize: typography.bodySmall,
    color: NAVY,
    lineHeight: 20,
  },
});

// Re-export the green-bg + green tokens for the MyTripStatus chip (kept here
// so the colour story for "reviewed" lives next to the screen that defines
// review semantics).
export const REVIEWED_BG = GREEN_BG;
export const REVIEWED_COLOR = GREEN;
