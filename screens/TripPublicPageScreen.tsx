import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Image,
  Linking,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { usePublicTrip } from "../hooks/useTripOrganizer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 420;
const GOLD = "#E8A842";
const GOLD_LIGHT = "rgba(232,168,66,0.12)";
const TEAL = colors.accentTeal;
const NAVY = colors.primaryNavy;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Activity {
  id: string;
  time: string;
  name: string;
  location?: string;
  mapsUrl?: string;
}

interface DayBlock {
  day: number;
  title: string;
  activities: Activity[];
}

interface TripData {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  coverImage?: string;
  duration: string;
  activityCount: number;
  pricePerPerson: number;
  spotsRemaining: number;
  totalSpots: number;
  registrationDeadline: string;
  itinerary: DayBlock[];
  included: string[];
  excluded: string[];
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_TRIP: TripData = {
  id: "trip-pub-001",
  slug: "abidjan-summer-2026",
  name: "Abidjan Summer\nExperience 2026",
  tagline: "14 days of culture, connection, and unforgettable memories",
  coverImage: undefined,
  duration: "14 Days",
  activityCount: 22,
  pricePerPerson: 1800,
  spotsRemaining: 7,
  totalSpots: 25,
  registrationDeadline: "May 15, 2026",
  itinerary: [
    {
      day: 1,
      title: "Arrival & Welcome",
      activities: [
        { id: "a1", time: "2:00 PM", name: "Arrive at Abidjan FHB Airport", location: "FHB Airport", mapsUrl: "https://maps.google.com/?q=Abidjan+Airport" },
        { id: "a2", time: "4:00 PM", name: "Hotel check-in & refresh" },
        { id: "a3", time: "7:30 PM", name: "Welcome dinner at Le Bushman", location: "Le Bushman", mapsUrl: "https://maps.google.com/?q=Le+Bushman+Abidjan" },
      ],
    },
    {
      day: 2,
      title: "Exploring the Plateau",
      activities: [
        { id: "a4", time: "9:00 AM", name: "Guided tour of Le Plateau district", location: "Le Plateau", mapsUrl: "https://maps.google.com/?q=Le+Plateau+Abidjan" },
        { id: "a5", time: "12:30 PM", name: "Lunch at Chez Amandine" },
        { id: "a6", time: "3:00 PM", name: "Visit Musee des Civilisations", location: "Musee des Civilisations", mapsUrl: "https://maps.google.com/?q=Musee+Civilisations+Abidjan" },
      ],
    },
    {
      day: 3,
      title: "Beach Day & Relaxation",
      activities: [
        { id: "a7", time: "10:00 AM", name: "Assinie beach resort day trip", location: "Assinie", mapsUrl: "https://maps.google.com/?q=Assinie+Cote+dIvoire" },
        { id: "a8", time: "1:00 PM", name: "Beachside grilled fish lunch" },
        { id: "a9", time: "5:00 PM", name: "Sunset boat cruise" },
      ],
    },
  ],
  included: [
    "Round-trip flight ATL to ABJ",
    "Hotel accommodation (14 nights)",
    "Airport transfers & ground transport",
    "Welcome & farewell dinners",
    "Guided city tours (3 days)",
    "Beach resort day trip",
    "Travel insurance",
  ],
  excluded: [
    "Daily meals (est. $20/day)",
    "Personal shopping & souvenirs",
    "Optional excursions",
    "Visa fees ($80)",
    "COVID testing if required",
  ],
};

// ── Component ──────────────────────────────────────────────────────────────────
const TripPublicPageScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug = route.params?.slug ?? '';
  const tripId = route.params?.tripId ?? '';

  // Hook fetches by slug — falls back to mock when no real data
  const hookResult = usePublicTrip(slug);
  const rawTrip = hookResult?.trip;

  // Calculate duration in days from start/end dates
  const calcDurationDays = (startStr?: string | null, endStr?: string | null): number => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff + 1 : 0;
  };

  // Split newline or comma-separated text into a list
  const splitList = (text?: string | null): string[] => {
    if (!text) return [];
    return text
      .split(/\r?\n|,|;|•/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // Format a date as "May 15, 2026"
  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Map from Trip + days to TripData format
  const trip: TripData = rawTrip ? {
    id: rawTrip.id,
    slug: rawTrip.slug ?? slug,
    name: rawTrip.name ?? 'Untitled Trip',
    tagline: (rawTrip as any).tagline ?? rawTrip.description ?? '',
    coverImage: rawTrip.coverPhotoUrl ?? undefined,
    duration: (() => {
      const days = calcDurationDays(rawTrip.startDate, rawTrip.endDate);
      return days > 0 ? `${days} ${days === 1 ? 'Day' : 'Days'}` : '';
    })(),
    activityCount: (rawTrip as any).days?.reduce((sum: number, d: any) => sum + (d.activities?.length ?? 0), 0) ?? 0,
    pricePerPerson: rawTrip.priceCents ?? 0,
    spotsRemaining: (rawTrip as any).spotsRemaining ?? rawTrip.maxParticipants ?? 0,
    totalSpots: rawTrip.maxParticipants ?? 0,
    registrationDeadline: formatDate((rawTrip as any).registrationDeadline ?? rawTrip.startDate),
    itinerary: ((rawTrip as any).days ?? []).map((d: any) => ({
      day: d.dayNumber,
      title: d.title ?? `Day ${d.dayNumber}`,
      activities: (d.activities ?? []).map((a: any) => ({
        id: a.id,
        time: a.startTime ?? '',
        name: a.title ?? '',
        location: a.location ?? undefined,
        mapsUrl: a.location ? `https://maps.google.com/?q=${encodeURIComponent(a.location)}` : undefined,
      })),
    })),
    included: splitList((rawTrip as any).whatsIncluded),
    excluded: splitList((rawTrip as any).whatsExcluded),
  } : MOCK_TRIP;
  const isLoading = hookResult?.loading ?? false;

  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const openMaps = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const spotsPercent = ((trip.totalSpots - trip.spotsRemaining) / trip.totalSpots) * 100;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Section ──────────────────────────────────────────────── */}
        <View style={styles.heroContainer}>
          {trip.coverImage ? (
            <Image source={{ uri: trip.coverImage }} style={styles.heroImage} />
          ) : (
            <LinearGradient
              colors={[NAVY, "#143A6B", "#1A5276"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroImage}
            />
          )}
          <LinearGradient
            colors={["transparent", "rgba(10,35,66,0.85)"]}
            style={styles.heroOverlay}
          />

          {/* Back button */}
          <TouchableOpacity
            style={styles.heroBackBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity style={styles.heroShareBtn}>
            <Ionicons name="share-outline" size={20} color="#FFF" />
          </TouchableOpacity>

          {/* Hero text */}
          <View style={styles.heroTextContainer}>
            <View style={styles.durationRow}>
              <View style={styles.durationPill}>
                <Ionicons name="calendar-outline" size={13} color="#FFF" />
                <Text style={styles.durationPillText}>{trip.duration}</Text>
              </View>
              <View style={styles.durationPill}>
                <Ionicons name="flag-outline" size={13} color="#FFF" />
                <Text style={styles.durationPillText}>{trip.activityCount} Activities</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{trip.name}</Text>
            <Text style={styles.heroTagline}>{trip.tagline}</Text>
          </View>
        </View>

        {/* ── Price Card ────────────────────────────────────────────────── */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Per Person</Text>
              <View style={styles.priceAmountRow}>
                <Text style={styles.priceDollar}>$</Text>
                <Text style={styles.priceAmount}>
                  {trip.pricePerPerson.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.spotsContainer}>
              <View style={styles.spotsBadge}>
                <Ionicons name="people" size={14} color={GOLD} />
                <Text style={styles.spotsText}>
                  {trip.spotsRemaining} spots left
                </Text>
              </View>
              <View style={styles.spotsBar}>
                <View style={[styles.spotsBarFill, { width: `${spotsPercent}%` }]} />
              </View>
            </View>
          </View>
          <View style={styles.deadlineRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.deadlineText}>
              Registration closes {trip.registrationDeadline}
            </Text>
          </View>
        </View>

        {/* ── Itinerary Preview ─────────────────────────────────────────── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Ionicons name="map-outline" size={20} color={NAVY} />
            <Text style={styles.sectionTitle}>Itinerary Preview</Text>
          </View>

          {trip.itinerary.map((dayBlock) => {
            const isExpanded = expandedDays[dayBlock.day] ?? false;
            return (
              <View key={dayBlock.day} style={styles.dayCard}>
                <TouchableOpacity
                  style={styles.dayHeader}
                  onPress={() => toggleDay(dayBlock.day)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayLabelRow}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>Day {dayBlock.day}</Text>
                    </View>
                    <Text style={styles.dayTitle}>{dayBlock.title}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.activitiesContainer}>
                    {dayBlock.activities.map((activity, index) => (
                      <View key={activity.id} style={styles.activityRow}>
                        {/* Timeline dot + line */}
                        <View style={styles.timelineCol}>
                          <View style={styles.timelineDot} />
                          {index < dayBlock.activities.length - 1 && (
                            <View style={styles.timelineLine} />
                          )}
                        </View>
                        {/* Activity content */}
                        <View style={styles.activityContent}>
                          <Text style={styles.activityTime}>{activity.time}</Text>
                          <Text style={styles.activityName}>{activity.name}</Text>
                          {activity.mapsUrl && (
                            <TouchableOpacity
                              onPress={() => openMaps(activity.mapsUrl!)}
                              style={styles.mapsLink}
                            >
                              <Ionicons name="location" size={13} color={TEAL} />
                              <Text style={styles.mapsLinkText}>
                                View on Maps{" "}
                                <Text style={{ fontSize: 11 }}>{"\u2192"}</Text>
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── What's Included ───────────────────────────────────────────── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-circle" size={20} color={colors.successText} />
            <Text style={styles.sectionTitle}>What's Included</Text>
          </View>
          <View style={styles.listCard}>
            {trip.included.map((item, i) => (
              <View key={i} style={styles.listRow}>
                <Ionicons name="checkmark-circle" size={18} color={TEAL} />
                <Text style={styles.listItemText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── What's Excluded ───────────────────────────────────────────── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Not Included</Text>
          </View>
          <View style={styles.listCard}>
            {trip.excluded.map((item, i) => (
              <View key={i} style={styles.listRow}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                <Text style={[styles.listItemText, { color: colors.textSecondary }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Map Preview ───────────────────────────────────────────────── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={NAVY} />
            <Text style={styles.sectionTitle}>Destination</Text>
          </View>
          <View style={styles.mapPlaceholder}>
            <LinearGradient
              colors={[TEAL, "#009D8B"]}
              style={styles.mapGradient}
            >
              <Text style={styles.mapPin}>{"📍"}</Text>
              <Text style={styles.mapLabel}>Abidjan, Cote d'Ivoire</Text>
              <Text style={styles.mapSublabel}>Interactive map coming soon</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Bottom spacer for sticky CTA */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky CTA ──────────────────────────────────────────────────── */}
      <View style={styles.stickyCta}>
        <View style={styles.stickyCtaInner}>
          <View>
            <Text style={styles.stickyPrice}>
              ${trip.pricePerPerson.toLocaleString()}
            </Text>
            <Text style={styles.stickyPriceSub}>per person</Text>
          </View>
          <TouchableOpacity
            style={styles.joinButton}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate("MyTripStatus", { tripId: trip.id })
            }
          >
            <Text style={styles.joinButtonText}>Join This Trip</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default TripPublicPageScreen;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // ── Hero ──
  heroContainer: {
    height: HERO_HEIGHT,
    width: "100%",
    position: "relative",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBackBtn: {
    position: "absolute",
    top: 52,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroShareBtn: {
    position: "absolute",
    top: 52,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTextContainer: {
    position: "absolute",
    bottom: 28,
    left: 20,
    right: 20,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  durationPillText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: "#FFF",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFF",
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroTagline: {
    fontSize: typography.body,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
  },

  // ── Price Card ──
  priceCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: radius.card,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  priceLabel: {
    fontSize: typography.label,
    fontWeight: typography.medium,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceAmountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  priceDollar: {
    fontSize: 18,
    fontWeight: typography.bold,
    color: GOLD,
    marginTop: 4,
    marginRight: 2,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: -1,
  },
  spotsContainer: {
    alignItems: "flex-end",
    minWidth: 110,
  },
  spotsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  spotsText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: GOLD,
  },
  spotsBar: {
    width: 110,
    height: 6,
    backgroundColor: "rgba(232,168,66,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  spotsBarFill: {
    height: "100%",
    backgroundColor: GOLD,
    borderRadius: 3,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deadlineText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },

  // ── Section ──
  sectionContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  // ── Itinerary Day Card ──
  dayCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  dayLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dayBadge: {
    backgroundColor: NAVY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dayBadgeText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
    color: "#FFF",
  },
  dayTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: NAVY,
    flex: 1,
  },

  // ── Activities ──
  activitiesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  activityRow: {
    flexDirection: "row",
    minHeight: 56,
  },
  timelineCol: {
    width: 24,
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TEAL,
    marginTop: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(0,198,174,0.2)",
    marginTop: 4,
  },
  activityContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 14,
  },
  activityTime: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: TEAL,
    marginBottom: 2,
  },
  activityName: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: NAVY,
    lineHeight: 20,
  },
  mapsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  mapsLinkText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: TEAL,
  },

  // ── Included / Excluded Lists ──
  listCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listItemText: {
    fontSize: typography.body,
    color: NAVY,
    flex: 1,
    lineHeight: 20,
  },

  // ── Map Placeholder ──
  mapPlaceholder: {
    borderRadius: radius.card,
    overflow: "hidden",
    height: 160,
  },
  mapGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mapPin: {
    fontSize: 36,
    marginBottom: 8,
  },
  mapLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
  mapSublabel: {
    fontSize: typography.label,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },

  // ── Sticky CTA ──
  stickyCta: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  stickyCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: NAVY,
  },
  stickyPriceSub: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 1,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: GOLD,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: radius.button,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
});
