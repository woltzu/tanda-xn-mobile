import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, typography, spacing } from "../theme/tokens";

const ORANGE_PRIMARY = "#F97316";
const ORANGE_LIGHT = "#FB923C";
const AMBER_GOLD = "#E8A842";

interface IncludeItem {
  id: string;
  emoji: string;
  label: string;
  checked: boolean;
}

const CreateTripListingScreen = () => {
  const navigation = useNavigation<any>();

  const [tripName, setTripName] = useState("Summer Return — Abidjan 2026");
  const [departureDate, setDepartureDate] = useState("Aug 2, 2026");
  const [returnDate, setReturnDate] = useState("Aug 16, 2026");
  const [minTravelers, setMinTravelers] = useState("10");
  const [maxTravelers, setMaxTravelers] = useState("25");

  const [includes, setIncludes] = useState<IncludeItem[]>([
    { id: "flight", emoji: "✈️", label: "Round-trip flight ATL → ABJ", checked: true },
    { id: "hotel", emoji: "🏨", label: "Hotel (14 nights)", checked: true },
    { id: "transfers", emoji: "🚌", label: "Airport transfers", checked: true },
    { id: "meals", emoji: "🍽️", label: "Meals (not included)", checked: false },
    { id: "excursions", emoji: "🏖️", label: "Excursions (add-on)", checked: false },
  ]);

  const toggleInclude = (id: string) => {
    setIncludes((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

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
        <Text style={styles.headerTitle}>New Trip</Text>
        <TouchableOpacity>
          <Text style={styles.headerAction}>Preview</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Photo Upload */}
        <TouchableOpacity style={styles.coverUpload} activeOpacity={0.7}>
          <Text style={styles.coverIcon}>🖼️</Text>
          <Text style={styles.coverLabel}>Add cover photo</Text>
        </TouchableOpacity>

        {/* Trip Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Trip name</Text>
          <TextInput
            style={styles.textInput}
            value={tripName}
            onChangeText={setTripName}
            placeholder="Enter trip name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Dates Row */}
        <View style={styles.row}>
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.fieldLabel}>Departure date</Text>
            <TextInput
              style={styles.textInput}
              value={departureDate}
              onChangeText={setDepartureDate}
              placeholder="Select date"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={{ width: spacing.md }} />
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.fieldLabel}>Return date</Text>
            <TextInput
              style={styles.textInput}
              value={returnDate}
              onChangeText={setReturnDate}
              placeholder="Select date"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Travelers Row */}
        <View style={styles.row}>
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.fieldLabel}>Min travelers</Text>
            <TextInput
              style={styles.textInput}
              value={minTravelers}
              onChangeText={setMinTravelers}
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={{ width: spacing.md }} />
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.fieldLabel}>Max travelers</Text>
            <TextInput
              style={styles.textInput}
              value={maxTravelers}
              onChangeText={setMaxTravelers}
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Pricing Section */}
        <Text style={styles.sectionHeader}>Pricing</Text>
        <View style={styles.card}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Price per person</Text>
            <View style={styles.pricingRight}>
              <Text style={[styles.pricingValue, { color: AMBER_GOLD }]}>$1,800</Text>
              <TouchableOpacity>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Deposit to hold spot</Text>
            <View style={styles.pricingRight}>
              <Text style={[styles.pricingValue, { color: colors.accentTeal }]}>$300</Text>
              <TouchableOpacity>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Suggested circle contribution</Text>
            <View style={styles.pricingRight}>
              <Text style={[styles.pricingValue, { color: colors.textSecondary }]}>
                $180/mo × 10
              </Text>
              <Text style={styles.autoBadge}>Auto ✓</Text>
            </View>
          </View>
        </View>

        {/* What's Included Section */}
        <Text style={styles.sectionHeader}>What's included</Text>
        <View style={styles.card}>
          {includes.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.includeRow}
                onPress={() => toggleInclude(item.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    item.checked && styles.checkboxChecked,
                  ]}
                >
                  {item.checked && (
                    <Ionicons name="checkmark" size={14} color={colors.cardBg} />
                  )}
                </View>
                <Text style={styles.includeEmoji}>{item.emoji}</Text>
                <Text
                  style={[
                    styles.includeLabel,
                    !item.checked && styles.includeLabelUnchecked,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Escrow Card */}
        <View style={styles.escrowCard}>
          <View style={styles.escrowHeader}>
            <Text style={styles.escrowIcon}>🔒</Text>
            <Text style={styles.escrowTitle}>
              Funds held in escrow until booking confirmed
            </Text>
          </View>
          <Text style={styles.escrowBody}>
            Deposits are collected as members join. Full payment releases to you
            when the trip reaches minimum travelers and booking is confirmed by
            the provider.
          </Text>
        </View>

        {/* Publish CTA */}
        <TouchableOpacity style={styles.publishBtn} activeOpacity={0.85}>
          <Text style={styles.publishBtnText}>
            Publish Trip → Ivorian Atlanta
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

  // Cover Photo
  coverUpload: {
    height: 130,
    borderWidth: 2,
    borderColor: colors.accentTeal,
    borderStyle: "dashed",
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    marginBottom: spacing.xl,
  },
  coverIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  coverLabel: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },

  // Fields
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.bodyLarge,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
  },
  halfField: {
    flex: 1,
  },

  // Section Header
  sectionHeader: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  // Card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Pricing
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  pricingLabel: {
    fontSize: typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  pricingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pricingValue: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
  },
  editLink: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  autoBadge: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Includes
  includeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.accentTeal,
    borderColor: colors.accentTeal,
  },
  includeEmoji: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  includeLabel: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  includeLabelUnchecked: {
    color: colors.textSecondary,
  },

  // Escrow Card
  escrowCard: {
    backgroundColor: colors.tealTintBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  escrowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  escrowIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  escrowTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.accentTeal,
    flex: 1,
  },
  escrowBody: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Publish Button
  publishBtn: {
    backgroundColor: ORANGE_PRIMARY,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  publishBtnText: {
    color: colors.textWhite,
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
  },
});

export default CreateTripListingScreen;
