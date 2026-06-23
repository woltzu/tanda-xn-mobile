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

import React, { useState, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import StarRatingInput from "../components/StarRatingInput";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const GREEN = "#10B981";
const GREEN_BG = "#ECFDF5";

const ORG_MAX = 280;
const ACT_MAX = 140;

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

  const isBusy =
    myStatus.loading || publicTrip?.loading || reviewState.isLoading;

  const setActivityRating = (activityId: string, rating: number) => {
    setActStates((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] ?? { text: "" }), rating },
    }));
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
    try {
      await reviewState.submit(
        orgRating,
        orgComment.trim() || null,
        activityPayload.length > 0 ? activityPayload : null,
      );
      showToast(t("leave_review.success_toast"), "success");
      // Land back on MyTripStatus where the banner has now flipped.
      navigation.navigate("MyTripStatus", { tripId });
    } catch (err: any) {
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
        <Header onBack={() => navigation.goBack()} t={t} />
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
        <Header onBack={() => navigation.goBack()} t={t} />
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
        <Header onBack={() => navigation.goBack()} t={t} />
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
            <StarRatingInput value={orgRating} onChange={setOrgRating} size={36} />
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
    </SafeAreaView>
  );
};

// Header shared across guard + main render.
const Header: React.FC<{ onBack: () => void; t: (k: string) => string }> = ({
  onBack,
  t,
}) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
      <Ionicons name="arrow-back" size={24} color={NAVY} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{t("leave_review.title")}</Text>
    <View style={styles.headerBtn} />
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
});

// Re-export the green-bg + green tokens for the MyTripStatus chip (kept here
// so the colour story for "reviewed" lives next to the screen that defines
// review semantics).
export const REVIEWED_BG = GREEN_BG;
export const REVIEWED_COLOR = GREEN;
