import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import DateTimePicker from "@react-native-community/datetimepicker";

type CreateCircleScheduleNavigationProp = StackNavigationProp<RootStackParamList>;
type CreateCircleScheduleRouteProp = RouteProp<RootStackParamList, "CreateCircleSchedule">;

const rotationMethods = [
  {
    id: "xnscore",
    name: "By XnScore",
    emoji: "⭐",
    description: "Highest XnScore members get earliest payouts. Rewards reliable savers.",
    recommended: true,
  },
  {
    id: "random",
    name: "Random Draw",
    emoji: "🎲",
    description: "Fair random selection at circle start. Everyone has equal chance.",
    recommended: false,
  },
  {
    id: "manual",
    name: "Manual Assignment",
    emoji: "📋",
    description: "You (as admin) assign the order. Good for agreed arrangements.",
    recommended: false,
  },
];

const gracePeriodOptions = [
  { value: "0", label: "No grace period" },
  { value: "1", label: "1 day" },
  { value: "2", label: "2 days" },
  { value: "3", label: "3 days" },
];

export default function CreateCircleScheduleScreen() {
  const navigation = useNavigation<CreateCircleScheduleNavigationProp>();
  const route = useRoute<CreateCircleScheduleRouteProp>();
  const {
    circleType,
    name,
    amount,
    frequency,
    memberCount,
    beneficiaryName,
    beneficiaryReason,
    beneficiaryPhone,
    beneficiaryCountry,
    isRecurring,
    totalCycles,
  } = route.params;

  // Check if this is a one-time collection (based on frequency selection, not circle type)
  const isOneTime = frequency === "one-time";
  // Check if this is a single beneficiary circle (supports recurring payouts)
  const isFamilySupport = circleType === "family-support";
  // Check if this is a flexible fundraise circle
  const isDisasterRelief = circleType === "beneficiary";
  // Check if this circle has a beneficiary (Single Beneficiary, Shared Goal, and Flexible Fundraise can have beneficiaries)
  const hasBeneficiary = isFamilySupport || circleType === "goal" || isDisasterRelief;

  // Calculate totals for beneficiary circles
  const monthlyPayout = amount * memberCount;
  const totalPayoutAllCycles = monthlyPayout * (totalCycles || 1);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rotationMethod, setRotationMethod] = useState("xnscore");
  const [gracePeriodDays, setGracePeriodDays] = useState("2");
  const [showAllCycles, setShowAllCycles] = useState(false);
  const [contributionDeadlines, setContributionDeadlines] = useState<
    Array<{ cycle: number; date: string; fullDate: Date }>
  >([]);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  useEffect(() => {
    if (!startDate) {
      setContributionDeadlines([]);
      return;
    }

    const deadlines = [];
    const start = new Date(startDate);

    const numCycles = totalCycles || memberCount;
    for (let i = 0; i < numCycles; i++) {
      const deadline = new Date(start);

      switch (frequency) {
        case "daily":
          deadline.setDate(deadline.getDate() + i);
          break;
        case "weekly":
          deadline.setDate(deadline.getDate() + i * 7);
          break;
        case "biweekly":
          deadline.setDate(deadline.getDate() + i * 14);
          break;
        case "monthly":
          deadline.setMonth(deadline.getMonth() + i);
          break;
        default:
          deadline.setMonth(deadline.getMonth() + i);
      }

      deadlines.push({
        cycle: i + 1,
        date: deadline.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: deadline.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        }),
        fullDate: deadline,
      });
    }

    setContributionDeadlines(deadlines);
  }, [startDate, frequency, memberCount]);

  const getFrequencyLabel = () => {
    switch (frequency) {
      case "daily":
        return "day";
      case "weekly":
        return "week";
      case "biweekly":
        return "2 weeks";
      case "monthly":
        return "month";
      default:
        return "cycle";
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const canContinue = startDate && rotationMethod;

  const handleContinue = () => {
    if (canContinue && startDate) {
      navigation.navigate("CreateCircleInvite", {
        circleType,
        name,
        amount,
        frequency,
        memberCount,
        startDate: startDate.toISOString(),
        rotationMethod: isOneTime || isFamilySupport || isDisasterRelief ? "beneficiary" : rotationMethod,
        gracePeriodDays: parseInt(gracePeriodDays),
        beneficiaryName,
        beneficiaryReason,
        // Pass through beneficiary circle fields
        beneficiaryPhone,
        beneficiaryCountry,
        isRecurring,
        totalCycles,
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Schedule & Rotation</Text>
              <Text style={styles.headerSubtitle}>Step 2 of 4</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            {[1, 2, 3, 4].map((step) => (
              <View
                key={step}
                style={[
                  styles.progressStep,
                  step <= 2 && styles.progressStepActive,
                ]}
              />
            ))}
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* How Payouts Work */}
          <View style={styles.infoCard}>
            <Text style={styles.infoEmoji}>{hasBeneficiary && beneficiaryName ? (isDisasterRelief ? "🆘" : "💝") : "💡"}</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>
                {isFamilySupport && isRecurring
                  ? "How Single Beneficiary Works"
                  : isDisasterRelief
                  ? "How Flexible Fundraise Works"
                  : isOneTime
                  ? "How This Collection Works"
                  : "How Payouts Work"}
              </Text>
              <Text style={styles.infoText}>
                {isFamilySupport && isRecurring && totalCycles && totalCycles > 1 ? (
                  <>
                    <Text style={styles.infoBold}>{beneficiaryName}</Text> will receive ${monthlyPayout.toLocaleString()}/month for {totalCycles} months (${totalPayoutAllCycles.toLocaleString()} total). Family members contribute monthly until all cycles complete.
                  </>
                ) : isFamilySupport && beneficiaryName ? (
                  <>
                    Each month, <Text style={styles.infoBold}>{beneficiaryName}</Text> will receive ${monthlyPayout.toLocaleString()} once all {memberCount} family members contribute.
                  </>
                ) : isDisasterRelief && beneficiaryName ? (
                  <>
                    Emergency relief: <Text style={styles.infoBold}>{beneficiaryName}</Text> will receive ${monthlyPayout.toLocaleString()} once all {memberCount} contributors chip in.
                  </>
                ) : isOneTime && beneficiaryName ? (
                  <>
                    Once all {memberCount} contributors have paid, <Text style={styles.infoBold}>{beneficiaryName}</Text> will receive the full ${monthlyPayout.toLocaleString()} automatically.
                  </>
                ) : isOneTime ? (
                  <>
                    Once all {memberCount} contributors have paid, the full ${monthlyPayout.toLocaleString()} will be collected and distributed.
                  </>
                ) : beneficiaryName ? (
                  <>
                    Each cycle, <Text style={styles.infoBold}>{beneficiaryName}</Text> will receive ${monthlyPayout.toLocaleString()} once all {memberCount} members contribute.
                  </>
                ) : (
                  <>
                    Payout happens <Text style={styles.infoBold}>automatically</Text> as soon
                    as all {memberCount} members contribute for that cycle. No waiting for a
                    specific payout day!
                  </>
                )}
              </Text>
            </View>
          </View>

          {/* Recurring Family Support Summary */}
          {isFamilySupport && isRecurring && totalCycles && totalCycles > 1 && (
            <View style={styles.recurringSummaryCard}>
              <View style={styles.recurringSummaryHeader}>
                <Ionicons name="repeat" size={20} color="#00C6AE" />
                <Text style={styles.recurringSummaryTitle}>Support Plan</Text>
              </View>
              <View style={styles.recurringSummaryContent}>
                <View style={styles.recurringSummaryRow}>
                  <Text style={styles.recurringSummaryLabel}>Contributions</Text>
                  <Text style={styles.recurringSummaryValue}>{totalCycles}× ({getFrequencyLabel()})</Text>
                </View>
                <View style={styles.recurringSummaryRow}>
                  <Text style={styles.recurringSummaryLabel}>Payout per {getFrequencyLabel()}</Text>
                  <Text style={styles.recurringSummaryValue}>${monthlyPayout.toLocaleString()}</Text>
                </View>
                <View style={styles.recurringSummaryRow}>
                  <Text style={styles.recurringSummaryLabel}>Your total contribution</Text>
                  <Text style={styles.recurringSummaryValue}>${(amount * totalCycles).toLocaleString()}</Text>
                </View>
                <View style={styles.recurringSummaryDivider} />
                <View style={styles.recurringSummaryRow}>
                  <Text style={styles.recurringSummaryLabelBold}>Total to {beneficiaryName}</Text>
                  <Text style={styles.recurringSummaryValueHighlight}>${totalPayoutAllCycles.toLocaleString()}</Text>
                </View>
              </View>
              <Text style={styles.recurringSummaryNote}>
                💡 One setup — members contribute every {getFrequencyLabel()} until all {totalCycles} contributions complete
              </Text>
            </View>
          )}

          {/* Start Date */}
          <View style={styles.card}>
            <Text style={styles.label}>
              {isOneTime ? "Contribution Deadline" : "Circle Start Date"}
            </Text>
            <Text style={styles.labelDesc}>
              {isOneTime
                ? "When should everyone contribute by?"
                : "First contribution deadline for Cycle 1"}
            </Text>

            {Platform.OS === "web" ? (
              // Web: use native HTML date input (DateTimePicker doesn't work on web)
              <View style={styles.dateButton}>
                <Ionicons name="calendar-outline" size={20} color="#0A2342" />
                <TextInput
                  style={[styles.dateButtonText, { flex: 1, outlineStyle: "none" } as any]}
                  value={startDate
                    ? startDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : ""}
                  placeholder="Select a date"
                  placeholderTextColor="#9CA3AF"
                  onFocus={(e: any) => {
                    // Create a hidden HTML date input and trigger it
                    const input = document.createElement("input");
                    input.type = "date";
                    input.min = minDate.toISOString().split("T")[0];
                    input.style.position = "absolute";
                    input.style.opacity = "0";
                    input.style.pointerEvents = "none";
                    document.body.appendChild(input);
                    input.addEventListener("change", () => {
                      if (input.value) {
                        const [year, month, day] = input.value.split("-").map(Number);
                        setStartDate(new Date(year, month - 1, day));
                      }
                      document.body.removeChild(input);
                    });
                    input.addEventListener("blur", () => {
                      setTimeout(() => {
                        if (document.body.contains(input)) document.body.removeChild(input);
                      }, 200);
                    });
                    input.showPicker?.();
                    input.click();
                    e.target.blur();
                  }}
                  editable={true}
                  showSoftInputOnFocus={false}
                />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#0A2342" />
                  <Text style={styles.dateButtonText}>
                    {startDate
                      ? startDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Select a date"}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={startDate || minDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    minimumDate={minDate}
                  />
                )}
              </>
            )}

            {startDate && (
              <Text style={styles.dateConfirmText}>
                ✓ Contributions due every {getFrequencyLabel()} starting{" "}
                {startDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            )}
          </View>

          {/* Grace Period */}
          <View style={styles.card}>
            <Text style={styles.label}>Grace Period for Late Contributions</Text>
            <Text style={styles.labelDesc}>
              Time after deadline before late fees apply
            </Text>

            <View style={styles.gracePeriodRow}>
              {gracePeriodOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.gracePeriodButton,
                    gracePeriodDays === option.value && styles.gracePeriodButtonSelected,
                  ]}
                  onPress={() => setGracePeriodDays(option.value)}
                >
                  <Text
                    style={[
                      styles.gracePeriodText,
                      gracePeriodDays === option.value && styles.gracePeriodTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Missing Contribution Warning */}
          <View style={styles.warningCard}>
            <Text style={styles.warningEmoji}>⚠️</Text>
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Missing Contributions</Text>
              <Text style={styles.warningText}>
                If not everyone has contributed by the deadline, the system will
                automatically send a reminder showing who hasn't paid yet. After the grace
                period, late fees apply.
              </Text>
            </View>
          </View>

          {/* Rotation Method - Only for recurring circles without a fixed beneficiary */}
          {!isOneTime && !hasBeneficiary && (
            <View style={styles.card}>
              <Text style={styles.label}>Rotation Order Method</Text>
              <Text style={styles.labelDesc}>
                How do we decide who gets paid first?
              </Text>

              {rotationMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.rotationButton,
                    rotationMethod === method.id && styles.rotationButtonSelected,
                  ]}
                  onPress={() => setRotationMethod(method.id)}
                >
                  {method.recommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                    </View>
                  )}

                  <View style={styles.rotationContent}>
                    <Text style={styles.rotationEmoji}>{method.emoji}</Text>
                    <View style={styles.rotationTextContainer}>
                      <Text style={styles.rotationName}>{method.name}</Text>
                      <Text style={styles.rotationDesc}>{method.description}</Text>
                    </View>
                    {rotationMethod === method.id && (
                      <View style={styles.rotationCheck}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Beneficiary Info - For circles with beneficiaries */}
          {beneficiaryName && (
            <View style={styles.beneficiaryCard}>
              <View style={styles.beneficiaryIcon}>
                <Ionicons name="person-circle" size={32} color="#00C6AE" />
              </View>
              <View style={styles.beneficiaryInfo}>
                <Text style={styles.beneficiaryLabel}>Beneficiary</Text>
                <Text style={styles.beneficiaryNameText}>{beneficiaryName}</Text>
                {beneficiaryReason && (
                  <Text style={styles.beneficiaryReasonText}>{beneficiaryReason}</Text>
                )}
              </View>
              <Text style={styles.beneficiaryAmount}>
                ${(amount * memberCount).toLocaleString()}
              </Text>
            </View>
          )}

          {/* Schedule Preview - For recurring circles */}
          {!isOneTime && startDate && contributionDeadlines.length > 0 && (
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Contribution Schedule Preview</Text>
              <Text style={styles.scheduleSubtitle}>
                Payout releases automatically when all {memberCount} members contribute
              </Text>

              {(showAllCycles ? contributionDeadlines : contributionDeadlines.slice(0, 6)).map((item, idx) => (
                <View key={idx} style={styles.scheduleItem}>
                  <View
                    style={[
                      styles.scheduleNumber,
                      idx === 0 && styles.scheduleNumberActive,
                    ]}
                  >
                    <Text style={styles.scheduleNumberText}>{item.cycle}</Text>
                  </View>
                  <View style={styles.scheduleItemText}>
                    <Text style={styles.scheduleCycleText}>Cycle {item.cycle}</Text>
                    <Text style={styles.scheduleDateText}>Contribute by {item.date}</Text>
                  </View>
                  <View style={styles.schedulePot}>
                    <Text style={styles.schedulePotValue}>
                      ${(amount * memberCount).toLocaleString()}
                    </Text>
                    <Text style={styles.schedulePotLabel}>pot</Text>
                  </View>
                </View>
              ))}

              {contributionDeadlines.length > 6 && (
                <TouchableOpacity
                  style={styles.scheduleExpandButton}
                  onPress={() => setShowAllCycles(!showAllCycles)}
                >
                  <Text style={styles.scheduleExpandText}>
                    {showAllCycles
                      ? "Show less"
                      : `Show all ${contributionDeadlines.length} cycles`}
                  </Text>
                  <Ionicons
                    name={showAllCycles ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#00C6AE"
                  />
                </TouchableOpacity>
              )}

              <View style={styles.autoPayoutBadge}>
                <Text style={styles.autoPayoutEmoji}>⚡</Text>
                <Text style={styles.autoPayoutText}>
                  <Text style={styles.autoPayoutBold}>Auto-Payout:</Text> As soon as all
                  members pay, the pot is released to that cycle's recipient
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text
            style={[
              styles.continueButtonText,
              !canContinue && styles.continueButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  progressBar: {
    flexDirection: "row",
    gap: 6,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressStepActive: {
    backgroundColor: "#00C6AE",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  infoCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#00C6AE",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoEmoji: {
    fontSize: 20,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  labelDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F5F7FA",
  },
  dateButtonText: {
    fontSize: 16,
    color: "#0A2342",
    flex: 1,
  },
  dateConfirmText: {
    fontSize: 12,
    color: "#00897B",
    marginTop: 10,
  },
  gracePeriodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gracePeriodButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  gracePeriodButtonSelected: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  gracePeriodText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  gracePeriodTextSelected: {
    color: "#00C6AE",
  },
  warningCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  warningEmoji: {
    fontSize: 20,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 6,
  },
  warningText: {
    fontSize: 12,
    color: "#A16207",
    lineHeight: 18,
  },
  rotationButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F5F7FA",
    marginBottom: 10,
    position: "relative",
  },
  rotationButtonSelected: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  recommendedBadge: {
    position: "absolute",
    top: -8,
    right: 12,
    backgroundColor: "#00C6AE",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rotationContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  rotationEmoji: {
    fontSize: 24,
  },
  rotationTextContainer: {
    flex: 1,
  },
  rotationName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  rotationDesc: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
    marginTop: 4,
  },
  rotationCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleCard: {
    backgroundColor: "#0A2342",
    borderRadius: 14,
    padding: 16,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  scheduleSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 14,
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    marginBottom: 8,
  },
  scheduleNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleNumberActive: {
    backgroundColor: "#00C6AE",
  },
  scheduleNumberText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scheduleItemText: {
    flex: 1,
  },
  scheduleCycleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scheduleDateText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  schedulePot: {
    alignItems: "flex-end",
  },
  schedulePotValue: {
    fontSize: 12,
    color: "#00C6AE",
  },
  schedulePotLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  scheduleExpandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    backgroundColor: "rgba(0,198,174,0.15)",
    borderRadius: 8,
  },
  scheduleExpandText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00C6AE",
  },
  autoPayoutBadge: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  autoPayoutEmoji: {
    fontSize: 16,
  },
  autoPayoutText: {
    flex: 1,
    fontSize: 11,
    color: "#00C6AE",
    lineHeight: 16,
  },
  autoPayoutBold: {
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  continueButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  continueButtonTextDisabled: {
    color: "#9CA3AF",
  },
  beneficiaryCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#00C6AE",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  beneficiaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  beneficiaryInfo: {
    flex: 1,
  },
  beneficiaryLabel: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  beneficiaryNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginTop: 2,
  },
  beneficiaryReasonText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  beneficiaryAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  // Recurring Beneficiary Summary Styles
  recurringSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  recurringSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  recurringSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  recurringSummaryContent: {
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 12,
  },
  recurringSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recurringSummaryLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  recurringSummaryLabelBold: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  recurringSummaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  recurringSummaryValueHighlight: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00C6AE",
  },
  recurringSummaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  recurringSummaryNote: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 12,
    textAlign: "center",
  },
});
