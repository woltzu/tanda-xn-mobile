import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, typography, spacing } from "../theme/tokens";

// Mock data
const TRIP = {
  id: "trip-001",
  name: "Summer Return",
  destination: "Abidjan 2026",
  pricePerPerson: 1800,
  monthlyContribution: 180,
  months: 10,
  totalTarget: 18000,
  totalSaved: 7740,
  progressPercent: 43,
  travelerCount: 10,
  bookingDate: "July 1, 2026",
  elderEndorsed: true,
  travelers: [
    {
      id: "t1",
      name: "Ama Kouassi",
      initials: "AK",
      avatarColor: "#10B981",
      circle: "Your circle · Abidjan",
      paidPercent: 40,
      paidColor: "#047857",
    },
    {
      id: "t2",
      name: "Moussa Koné",
      initials: "MK",
      avatarColor: "#8B5CF6",
      circle: "Ivorian ATL · 8 mutual",
      paidPercent: 30,
      paidColor: "#D97706",
    },
  ],
};

const TripDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tripId = route.params?.tripId ?? TRIP.id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primaryNavy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Image Area */}
        <LinearGradient
          colors={["#0A4A2A", "#1A6A4A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroEmoji}>🌴</Text>
          <View style={styles.heroOverlay}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroName}>{TRIP.name}</Text>
              <Text style={styles.heroDest}>{TRIP.destination}</Text>
            </View>
            {TRIP.elderEndorsed && (
              <View style={styles.elderBadge}>
                <Text style={styles.elderBadgeText}>👑 Elder Endorsed</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Price + Circle Savings + Join Row */}
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            <Text style={styles.priceAmount}>
              ${TRIP.pricePerPerson.toLocaleString()}
            </Text>
            <Text style={styles.priceSubtitle}>per person · all-inclusive</Text>
          </View>
          <View style={styles.priceCenter}>
            <Text style={styles.savingsLabel}>Save as a circle</Text>
            <Text style={styles.savingsDetail}>
              ${TRIP.monthlyContribution}/month × {TRIP.months} months
            </Text>
          </View>
          <TouchableOpacity style={styles.joinBtnSmall}>
            <Text style={styles.joinBtnSmallText}>Join Trip</Text>
          </TouchableOpacity>
        </View>

        {/* Group Savings Progress Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>Group savings progress</Text>
            <Text style={styles.progressPercent}>
              {TRIP.progressPercent}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={["#F97316", "#E8A842"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressBarFill,
                { width: `${TRIP.progressPercent}%` },
              ]}
            />
          </View>
          <View style={styles.amountsRow}>
            <Text style={styles.amountTeal}>
              ${TRIP.totalSaved.toLocaleString()} Saved
            </Text>
            <Text style={styles.amountGray}>
              ${TRIP.totalTarget.toLocaleString()} Target
            </Text>
          </View>
          <View style={styles.etaPill}>
            <Text style={styles.etaPillText}>
              📅 At this pace · trip books {TRIP.bookingDate}
            </Text>
          </View>
        </View>

        {/* Who's Going Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Who's going</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>
              {TRIP.travelerCount} travelers
            </Text>
          </TouchableOpacity>
        </View>

        {/* Travelers Card */}
        <View style={styles.card}>
          {TRIP.travelers.map((traveler, index) => (
            <View
              key={traveler.id}
              style={[
                styles.travelerRow,
                index < TRIP.travelers.length - 1 && styles.travelerBorder,
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: traveler.avatarColor },
                ]}
              >
                <Text style={styles.avatarText}>{traveler.initials}</Text>
              </View>
              <View style={styles.travelerInfo}>
                <Text style={styles.travelerName}>{traveler.name}</Text>
                <Text style={styles.travelerCircle}>{traveler.circle}</Text>
              </View>
              <Text
                style={[styles.paidBadge, { color: traveler.paidColor }]}
              >
                {traveler.paidPercent}% paid
              </Text>
            </View>
          ))}
        </View>

        {/* Refund / Cancellation Policy Card */}
        <View style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <Ionicons name="warning" size={20} color="#D97706" />
            <Text style={styles.policyTitle}>
              Cancellation & refund policy
            </Text>
          </View>
          <Text style={styles.policyBody}>
            If the trip doesn't reach the minimum number of travelers, you'll
            receive a full refund. If you cancel, the organizer's cancellation
            policy applies. If the organizer cancels the trip, you're guaranteed
            a 100% refund.
          </Text>
        </View>

        {/* Bottom CTA */}
        <TouchableOpacity style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>
            Join Trip — Pay $300 Deposit
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
  },
  headerBtn: {
    width: 60,
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    textAlign: "center",
    flex: 1,
  },
  shareText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
    textAlign: "right",
  },

  // Hero
  hero: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  heroEmoji: {
    fontSize: 52,
    position: "absolute",
    top: 16,
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heroLeft: {},
  heroName: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  heroDest: {
    fontSize: typography.bodySmall,
    color: "rgba(255,255,255,0.85)",
  },
  elderBadge: {
    backgroundColor: "rgba(232,168,66,0.25)",
    borderWidth: 1,
    borderColor: "#E8A842",
    borderRadius: radius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  elderBadgeText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: "#E8A842",
  },

  // Price Row
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  priceLeft: {
    flex: 1,
  },
  priceAmount: {
    fontSize: 26,
    fontWeight: typography.bold,
    color: "#D97706",
  },
  priceSubtitle: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceCenter: {
    flex: 1,
    alignItems: "center",
  },
  savingsLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  savingsDetail: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  joinBtnSmall: {
    backgroundColor: "#F97316",
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  joinBtnSmallText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },

  // Card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: typography.bold,
    color: "#D97706",
  },

  // Progress Bar
  progressBarBg: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: radius.pill,
  },

  // Amounts Row
  amountsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  amountTeal: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  amountGray: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },

  // ETA Pill
  etaPill: {
    backgroundColor: colors.tealTintBg,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: "flex-start",
  },
  etaPillText: {
    fontSize: typography.label,
    fontWeight: typography.medium,
    color: colors.accentTeal,
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  sectionLink: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },

  // Travelers
  travelerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  travelerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  travelerInfo: {
    flex: 1,
  },
  travelerName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  travelerCircle: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  paidBadge: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
  },

  // Policy Card
  policyCard: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  policyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  policyTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: "#D97706",
    marginLeft: spacing.sm,
  },
  policyBody: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // CTA
  ctaButton: {
    backgroundColor: "#F97316",
    borderRadius: radius.button,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  ctaButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
});

export default TripDetailScreen;
