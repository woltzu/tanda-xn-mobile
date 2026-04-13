import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, typography, spacing } from "../theme/tokens";

const ORANGE_PRIMARY = "#F97316";
const AMBER_GOLD = "#E8A842";

// Mock data
const TRAVELERS = [
  {
    initials: "AK",
    name: "Ama Kouassi",
    avatarColor: colors.successText,
    detail: "Joined Mar 5 · 4 payments made",
    amount: "$720",
    percent: "40% paid",
    statusColor: colors.successText,
  },
  {
    initials: "MK",
    name: "Moussa Koné",
    avatarColor: "#7C3AED",
    detail: "Joined Mar 12 · 3 payments",
    amount: "$540",
    percent: "30% paid",
    statusColor: colors.warningAmber,
  },
  {
    initials: "DT",
    name: "Dramane Touré",
    avatarColor: ORANGE_PRIMARY,
    detail: "Joined Mar 20 · 1 payment",
    amount: "$300",
    percent: "17% — behind",
    statusColor: colors.errorText,
  },
];

const ProviderTripDashboardScreen = () => {
  const navigation = useNavigation<any>();

  const progressPercent = 43;
  const collected = 5400;
  const target = 18000;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primaryNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Trips</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("CreateTripListing")}
        >
          <Text style={styles.headerAction}>+ New Trip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Trip Card */}
        <View style={styles.card}>
          {/* Image area */}
          <View style={styles.tripImageArea}>
            <Text style={styles.tripEmoji}>🌍</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>Live</Text>
            </View>
          </View>

          {/* Trip details */}
          <View style={styles.tripDetails}>
            <Text style={styles.tripName}>Summer Return — Abidjan 2026</Text>
            <Text style={styles.tripSubtitle}>
              Aug 2–16 · 10/25 travelers · $5,400 collected
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressSaved}>
                ${collected.toLocaleString()} saved
              </Text>
              <Text style={styles.progressTarget}>
                ${target.toLocaleString()} target
              </Text>
            </View>
          </View>
        </View>

        {/* Payout Timeline Section */}
        <Text style={styles.sectionHeader}>Payout timeline</Text>
        <View style={styles.card}>
          <View style={styles.payoutRow}>
            <Text style={styles.payoutEmoji}>💳</Text>
            <Text style={styles.payoutLabel}>Deposits collected so far</Text>
            <Text style={[styles.payoutValue, { color: colors.accentTeal }]}>
              $3,000
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.payoutRow}>
            <Text style={styles.payoutEmoji}>🎯</Text>
            <Text style={styles.payoutLabel}>
              Full payout — at booking confirmation
            </Text>
            <Text style={[styles.payoutValue, { color: AMBER_GOLD }]}>
              $17,415
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.payoutRow}>
            <Text style={styles.payoutEmoji}>📅</Text>
            <Text style={styles.payoutLabel}>Estimated booking date</Text>
            <Text
              style={[styles.payoutValue, { color: colors.textSecondary }]}
            >
              Jul 1
            </Text>
          </View>
        </View>

        {/* Travelers Section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>Travelers</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>All 10</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {TRAVELERS.map((traveler, index) => (
            <React.Fragment key={traveler.initials}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.travelerRow}>
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
                  <Text style={styles.travelerDetail}>{traveler.detail}</Text>
                </View>
                <View style={styles.travelerPayment}>
                  <Text
                    style={[
                      styles.travelerAmount,
                      { color: traveler.statusColor },
                    ]}
                  >
                    {traveler.amount}
                  </Text>
                  <Text
                    style={[
                      styles.travelerPercent,
                      { color: traveler.statusColor },
                    ]}
                  >
                    {traveler.percent}
                  </Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.screenBg,
  },
  headerBackBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  headerAction: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },

  // Card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },

  // Trip Image Area
  tripImageArea: {
    height: 80,
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tripEmoji: {
    fontSize: 32,
  },
  liveBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.successText,
    marginRight: spacing.xs,
  },
  liveBadgeText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: colors.successText,
  },

  // Trip Details
  tripDetails: {
    padding: spacing.lg,
  },
  tripName: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: spacing.xs,
  },
  tripSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  // Progress Bar
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accentTeal,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressSaved: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  progressTarget: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },

  // Section
  sectionHeader: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLink: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  // Payout
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  payoutEmoji: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  payoutLabel: {
    fontSize: typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  payoutValue: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
  },

  // Travelers
  travelerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.body,
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
  travelerDetail: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  travelerPayment: {
    alignItems: "flex-end",
  },
  travelerAmount: {
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
  travelerPercent: {
    fontSize: typography.label,
    fontWeight: typography.medium,
    marginTop: 2,
  },
});

export default ProviderTripDashboardScreen;
