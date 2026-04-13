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
const MY_TRIP = {
  id: "trip-001",
  name: "Summer Return",
  destination: "Abidjan 2026",
  dateLabel: "Aug 2",
  daysLeft: 118,
  travelerCount: 10,
  myPaid: 720,
  tripCost: 1800,
  myProgressPercent: 40,
  groupSaved: 7740,
  groupTarget: 18000,
  groupProgressPercent: 43,
  groupBookDate: "Jul 1",
  nextContribution: {
    amount: 180,
    date: "May 1",
  },
  schedule: [
    {
      id: "s1",
      date: "May 1",
      label: "next",
      amount: 180,
      isNext: true,
    },
    {
      id: "s2",
      date: "Jun 1",
      label: "",
      amount: 180,
      isNext: false,
    },
    {
      id: "s3",
      date: "Jul 1",
      label: "Final + booking",
      amount: 180,
      isNext: false,
    },
  ],
  remaining: 6,
};

const MemberTripDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tripId = route.params?.tripId ?? MY_TRIP.id;

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
          <Text style={styles.headerTitle}>My Trip Circle</Text>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.inviteText}>Invite</Text>
          </TouchableOpacity>
        </View>

        {/* Trip Identity Card */}
        <View style={styles.identityCard}>
          <LinearGradient
            colors={["#0A4A2A", "#1A6A4A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.identityHero}
          >
            <Text style={styles.identityEmoji}>🌴</Text>
            <View style={styles.identityOverlay}>
              <Text style={styles.identityName}>{MY_TRIP.name}</Text>
              <Text style={styles.identityDate}>{MY_TRIP.dateLabel}</Text>
            </View>
          </LinearGradient>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#F97316" }]}>
                {MY_TRIP.daysLeft}
              </Text>
              <Text style={styles.statLabel}>Days left</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.accentTeal }]}>
                {MY_TRIP.travelerCount}
              </Text>
              <Text style={styles.statLabel}>Travelers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#D97706" }]}>
                ${MY_TRIP.myPaid}
              </Text>
              <Text style={styles.statLabel}>My paid</Text>
            </View>
          </View>
        </View>

        {/* My Savings Progress Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>My savings toward this trip</Text>
            <Text style={styles.progressPercentAmber}>
              {MY_TRIP.myProgressPercent}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={["#F97316", "#E8A842"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressBarFill,
                { width: `${MY_TRIP.myProgressPercent}%` },
              ]}
            />
          </View>
          <View style={styles.amountsRow}>
            <Text style={styles.amountOrange}>
              ${MY_TRIP.myPaid} Paid
            </Text>
            <Text style={styles.amountGray}>
              ${MY_TRIP.tripCost.toLocaleString()} Trip cost
            </Text>
          </View>
          <View style={styles.etaPill}>
            <Text style={styles.etaPillText}>
              💳 Next contribution · ${MY_TRIP.nextContribution.amount} on{" "}
              {MY_TRIP.nextContribution.date}
            </Text>
          </View>
        </View>

        {/* Group Total Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>Group total</Text>
            <Text style={styles.progressPercentGreen}>
              {MY_TRIP.groupProgressPercent}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={["#10B981", "#34D399"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressBarFill,
                { width: `${MY_TRIP.groupProgressPercent}%` },
              ]}
            />
          </View>
          <View style={styles.amountsRow}>
            <Text style={styles.amountGreen}>
              ${MY_TRIP.groupSaved.toLocaleString()} saved
            </Text>
            <Text style={styles.amountGray}>
              ${MY_TRIP.groupTarget.toLocaleString()} target · books{" "}
              {MY_TRIP.groupBookDate}
            </Text>
          </View>
        </View>

        {/* My Schedule Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My schedule</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>
              {MY_TRIP.remaining} remaining
            </Text>
          </TouchableOpacity>
        </View>

        {/* Schedule Card */}
        <View style={styles.card}>
          {MY_TRIP.schedule.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.scheduleRow,
                item.isNext && styles.scheduleRowHighlight,
                index < MY_TRIP.schedule.length - 1 && styles.scheduleBorder,
              ]}
            >
              <View style={styles.scheduleLeft}>
                <Text style={styles.scheduleDate}>
                  {item.date}
                  {item.label ? ` — ${item.label}` : ""}
                  {item.isNext ? " · next" : ""}
                </Text>
              </View>
              <View style={styles.scheduleRight}>
                <Text
                  style={[
                    styles.scheduleAmount,
                    { color: item.isNext ? "#D97706" : colors.textSecondary },
                  ]}
                >
                  ${item.amount}
                </Text>
                {item.isNext && (
                  <TouchableOpacity style={styles.payNowBtn}>
                    <Text style={styles.payNowText}>Pay now</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
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
  inviteText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
    textAlign: "right",
  },

  // Trip Identity Card
  identityCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  identityHero: {
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  identityEmoji: {
    fontSize: 32,
    position: "absolute",
    top: 8,
  },
  identityOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  identityName: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  identityDate: {
    fontSize: typography.label,
    color: "rgba(255,255,255,0.85)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    paddingVertical: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
  },
  statLabel: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
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
  progressPercentAmber: {
    fontSize: 22,
    fontWeight: typography.bold,
    color: "#D97706",
  },
  progressPercentGreen: {
    fontSize: 22,
    fontWeight: typography.bold,
    color: "#047857",
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
    marginBottom: spacing.sm,
  },
  amountOrange: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: "#F97316",
  },
  amountGreen: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: "#10B981",
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
    marginTop: spacing.xs,
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

  // Schedule
  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.small,
  },
  scheduleRowHighlight: {
    backgroundColor: colors.tealTintBg,
  },
  scheduleBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scheduleLeft: {
    flex: 1,
  },
  scheduleDate: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.primaryNavy,
  },
  scheduleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  scheduleAmount: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  payNowBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  payNowText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
});

export default MemberTripDashboardScreen;
