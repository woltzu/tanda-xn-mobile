// ═══════════════════════════════════════════════════════════════════════════
// screens/MyTripsScreen.tsx — Participant trip list
// ═══════════════════════════════════════════════════════════════════════════
//
// Member-trip-status Bucket A.2. Before this screen existed, participants
// had no path back to their joined trips: the only reach paths into
// MyTripStatus were the post-join success route and the post-failed-
// payment route. Once a user navigated away, the trip was invisible
// unless a notification deep link surfaced it.
//
// Renders TripOrganizerEngine.getParticipantTrips for the authed user as
// a vertical list of cover-image cards. Each card has the trip identity
// + a participant-status pill + a payment-status chip. Tap → MyTripStatus.
//
// Empty state nudges the user back to the Trips Home (publishing /
// browsing live trips) since this screen is reached only via the
// HomeScreen "My Trips" tile and the Profile row added in A.3.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
} from "react-native";
import { AppFlashList } from "../components/AppFlashList";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";
import { useEventTracker } from "../hooks/useEventTracker";
import {
  TripOrganizerEngine,
  type TripWithParticipantStatus,
  type ParticipantStatus,
  type PaymentStatus,
} from "../services/TripOrganizerEngine";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const GOLD = "#E8A842";
const GREEN = "#047857";
const RED = "#DC2626";
const BLUE = "#2563EB";
const GRAY = "#6B7280";

// Status pill config. Mirrors the ParticipantManager / MyTripStatus
// colour decisions so participants see consistent status framing across
// the app. Labels resolve via i18n in render.
const STATUS_PILL: Record<
  ParticipantStatus,
  { fg: string; bg: string; labelKey: string }
> = {
  confirmed: { fg: GREEN, bg: "#ECFDF5", labelKey: "my_trips.status_confirmed" },
  pending: { fg: GOLD, bg: "#FFF7ED", labelKey: "my_trips.status_pending" },
  waitlist: { fg: TEAL, bg: "rgba(0,198,174,0.1)", labelKey: "my_trips.status_waitlist" },
  cancelled: { fg: RED, bg: "#FEE2E2", labelKey: "my_trips.status_cancelled" },
};

const PAYMENT_CHIP: Record<
  PaymentStatus | "refunded",
  { fg: string; bg: string; labelKey: string }
> = {
  unpaid: { fg: RED, bg: "#FEE2E2", labelKey: "my_trips.payment_unpaid" },
  deposit_paid: { fg: BLUE, bg: "#DBEAFE", labelKey: "my_trips.payment_deposit_paid" },
  partial: { fg: GOLD, bg: "#FEF3C7", labelKey: "my_trips.payment_partial" },
  paid_in_full: { fg: GREEN, bg: "#D1FAE5", labelKey: "my_trips.payment_paid_in_full" },
  refunded: { fg: GRAY, bg: "#F3F4F6", labelKey: "my_trips.payment_refunded" },
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", {
      ...opts,
      year: "numeric",
    })}`;
  } catch {
    return "";
  }
}

const MyTripsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { track } = useEventTracker();

  const [items, setItems] = useState<TripWithParticipantStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bucket C.3 — one-shot list_viewed per mount.
  const viewTrackedRef = useRef(false);
  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    track({ name: 'my_trips.list_viewed' });
  }, [track]);

  const fetchTrips = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await TripOrganizerEngine.getParticipantTrips(user.id);
      setItems(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load your trips");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const onPullRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTrips();
  }, [fetchTrips]);

  const navigateToTrip = useCallback(
    (tripId: string, participantStatus: ParticipantStatus) => {
      // Bucket C.3 — row tap event.
      track({
        name: 'my_trips.trip_row_tapped',
        properties: { trip_id: tripId, participant_status: participantStatus },
      });
      navigation.navigate("MyTripStatus", { tripId });
    },
    [navigation, track],
  );

  // Render one card per trip.
  function TripCard({ item }: { item: TripWithParticipantStatus }) {
    const statusCfg = STATUS_PILL[item.participantStatus] ?? STATUS_PILL.pending;
    const paymentCfg =
      PAYMENT_CHIP[item.paymentStatus] ?? PAYMENT_CHIP.unpaid;
    const dateRange = formatDateRange(item.trip.startDate, item.trip.endDate);
    const cover = item.trip.coverPhotoUrl;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigateToTrip(item.trip.id, item.participantStatus)}
      >
        {cover ? (
          <ImageBackground source={{ uri: cover }} style={styles.cover} imageStyle={styles.coverImage}>
            <View style={styles.coverOverlay} />
            <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusPillText, { color: statusCfg.fg }]}>
                {t(statusCfg.labelKey)}
              </Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={styles.cover}>
            <LinearGradient colors={[NAVY, "#143A6B"]} style={StyleSheet.absoluteFill} />
            <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusPillText, { color: statusCfg.fg }]}>
                {t(statusCfg.labelKey)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.tripName} numberOfLines={1}>
            {item.trip.name || t("my_trips.untitled_trip")}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.trip.destination || "—"}
            </Text>
          </View>
          {dateRange ? (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{dateRange}</Text>
            </View>
          ) : null}
          <View style={styles.chipRow}>
            <View style={[styles.paymentChip, { backgroundColor: paymentCfg.bg }]}>
              <Text style={[styles.paymentChipText, { color: paymentCfg.fg }]}>
                {t(paymentCfg.labelKey)}
              </Text>
            </View>
            {/* Leave-review Bucket B.3 — review CTA / acknowledgement. */}
            {item.alreadyReviewed ? (
              <View style={[styles.paymentChip, styles.reviewedBadge]}>
                <Ionicons name="checkmark-circle" size={12} color={GREEN} />
                <Text style={[styles.paymentChipText, { color: GREEN }]}>
                  {t("my_trips.reviewed_badge")}
                </Text>
              </View>
            ) : item.eligibleForReview ? (
              <TouchableOpacity
                style={[styles.paymentChip, styles.rateBadge]}
                activeOpacity={0.7}
                onPress={(e) => {
                  e.stopPropagation?.();
                  // Bucket C.4 — rate-trip badge tap.
                  track({
                    name: "trip_review.badge_tapped",
                    properties: { trip_id: item.trip.id },
                  });
                  navigation.navigate("LeaveReview", {
                    participantId: item.participantId,
                    tripId: item.trip.id,
                  });
                }}
              >
                <Ionicons name="star" size={12} color="#B45309" />
                <Text style={[styles.paymentChipText, { color: "#B45309" }]}>
                  {t("my_trips.rate_badge")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Loading state — full-screen spinner on cold load.
  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  // Empty state — no trips joined yet.
  const empty = !loading && items.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("my_trips.header_title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      {error && !refreshing && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={RED} />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      )}

      {empty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="briefcase-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>{t("my_trips.empty_title")}</Text>
          <Text style={styles.emptyBody}>{t("my_trips.empty_body")}</Text>
        </View>
      ) : (
        <AppFlashList
          data={items}
          keyExtractor={(item) => item.participantId}
          estimatedItemSize={120}
          renderItem={({ item }) => <TripCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={TEAL} />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default MyTripsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  centered: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: "#FEE2E2",
    borderRadius: radius.small,
  },
  errorText: { color: RED, fontSize: typography.bodySmall, flex: 1 },

  listContent: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cover: {
    height: 140,
    backgroundColor: NAVY,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  coverImage: { resizeMode: "cover" },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,35,66,0.25)",
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
  },

  cardBody: { padding: spacing.md, gap: 4 },
  tripName: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  // Leave-review Bucket B.3 — orange "Rate trip" CTA + green "✓ Reviewed".
  rateBadge: {
    backgroundColor: "#FEF3C7",
  },
  reviewedBadge: {
    backgroundColor: "#D1FAE5",
  },
  paymentChipText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  emptyTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  emptyBody: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
