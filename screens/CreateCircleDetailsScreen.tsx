import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import * as Contacts from "expo-contacts";
import { useElder } from "../context/ElderContext";
import { useCommunity, Community } from "../context/CommunityContext";

type CreateCircleDetailsNavigationProp = StackNavigationProp<RootStackParamList>;
type CreateCircleDetailsRouteProp = RouteProp<RootStackParamList, "CreateCircleDetails">;

const frequencies = [
  { id: "one-time", label: "One-Time", description: "Single contribution" },
  { id: "daily", label: "Daily", description: "Every day" },
  { id: "weekly", label: "Weekly", description: "Every 7 days" },
  { id: "biweekly", label: "Bi-weekly", description: "Every 14 days" },
  { id: "monthly", label: "Monthly", description: "Once a month" },
];

type ContactItem = {
  id: string;
  name: string;
  phone: string;
};

const quickAmounts = [50, 100, 200, 500];
const quickSizes = [5, 6, 8, 10, 12];

// Helper to check if this is a family support, goal-based, or beneficiary circle (can have beneficiary)
const hasBeneficiary = (type: string) => type === "family-support" || type === "goal" || type === "beneficiary";
// Helper to check if this circle type supports one-time option
const supportsOneTime = (type: string) => type === "family-support" || type === "goal" || type === "beneficiary";
// Helper to check if this is a family support circle (supports recurring payouts)
const isFamilySupportCircle = (type: string) => type === "family-support";
// Helper to check if this is a disaster relief circle
const isDisasterReliefCircle = (type: string) => type === "beneficiary";

// Duration options for beneficiary circles (in months)
const durationOptions = [
  { months: 1, label: "1 Month", description: "Single month support" },
  { months: 3, label: "3 Months", description: "Quarterly support" },
  { months: 6, label: "6 Months", description: "Half-year support" },
  { months: 12, label: "12 Months", description: "Full year support" },
];

export default function CreateCircleDetailsScreen() {
  const navigation = useNavigation<CreateCircleDetailsNavigationProp>();
  const route = useRoute<CreateCircleDetailsRouteProp>();
  const { circleType } = route.params;

  // Elder and Community contexts
  const { isElder, elderProfile } = useElder();
  const { myCommunities } = useCommunity();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [memberCount, setMemberCount] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryReason, setBeneficiaryReason] = useState("");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [beneficiaryCountry, setBeneficiaryCountry] = useState("");
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedBeneficiaryContact, setSelectedBeneficiaryContact] = useState<ContactItem | null>(null);
  // For recurring beneficiary circles
  const [totalCycles, setTotalCycles] = useState(1);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  // For Elder disaster relief - community selection
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);

  // Get communities where user is an Elder
  const elderCommunities = myCommunities.filter(c => c.role === "elder" || c.role === "admin");

  // Load contacts when contact picker is opened
  useEffect(() => {
    if (showContactPicker && contacts.length === 0) {
      loadContacts();
    }
  }, [showContactPicker]);

  const loadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need contact access to select a beneficiary.");
        setShowContactPicker(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const contactList: ContactItem[] = data
        .filter((contact) => contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0)
        .map((contact) => ({
          id: contact.id || String(Math.random()),
          name: contact.name || "Unknown",
          phone: contact.phoneNumbers?.[0]?.number || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setContacts(contactList);
    } catch (error) {
      console.error("Error loading contacts:", error);
      Alert.alert("Error", "Failed to load contacts");
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contact.phone.includes(contactSearch)
  );

  const selectBeneficiaryFromContact = (contact: ContactItem) => {
    setSelectedBeneficiaryContact(contact);
    setBeneficiaryName(contact.name);
    setBeneficiaryPhone(contact.phone);
    setShowContactPicker(false);
    setContactSearch("");
  };

  // For family support circles: check if recurring (more than 1 cycle)
  const isFamilySupport = isFamilySupportCircle(circleType);
  const isDisasterRelief = isDisasterReliefCircle(circleType);
  const isRecurring = isFamilySupport && totalCycles > 1;

  // Check if current selection is one-time
  const isOneTime = frequency === "one-time";
  // Check if this circle type needs beneficiary (Family Support and Goal-Based)
  const showBeneficiary = hasBeneficiary(circleType);
  // Check if this circle type supports one-time frequency
  const canSelectOneTime = supportsOneTime(circleType);
  // Get available frequencies based on circle type
  const availableFrequencies = canSelectOneTime
    ? frequencies
    : frequencies.filter(f => f.id !== "one-time");
  const parsedMemberCount = parseInt(memberCount) || 0;
  const parsedAmount = parseFloat(amount) || 0;
  const totalPot = parsedAmount * parsedMemberCount;

  const getCycleDuration = () => {
    if (parsedMemberCount === 0) return "—";
    switch (frequency) {
      case "daily":
        return `${parsedMemberCount} days`;
      case "weekly":
        return `${parsedMemberCount} weeks`;
      case "biweekly":
        return `${parsedMemberCount * 2} weeks`;
      case "monthly":
        return `${parsedMemberCount} months`;
      default:
        return `${parsedMemberCount} cycles`;
    }
  };

  const isValidMemberCount = parsedMemberCount >= 3;
  const isValidAmount = parsedAmount >= 10;
  const isValidName = name.trim().length >= 3;
  // Beneficiary is required for Family Support and Disaster Relief circles
  // For Goal-Based, only required when one-time
  const isValidBeneficiary = isFamilySupport || isDisasterRelief
    ? beneficiaryName.trim().length >= 2
    : !showBeneficiary || !isOneTime || beneficiaryName.trim().length >= 2;
  const canContinue = isValidName && isValidAmount && isValidMemberCount && isValidBeneficiary;

  // Calculate totals for beneficiary circles
  const totalPayoutAllCycles = totalPot * totalCycles;
  const totalContributionPerMember = parsedAmount * totalCycles;

  const handleContinue = () => {
    if (canContinue) {
      navigation.navigate("CreateCircleSchedule", {
        circleType,
        name: name.trim(),
        amount: parsedAmount,
        frequency: isFamilySupport && totalCycles > 1 ? "monthly" : frequency, // Recurring family support is always monthly
        memberCount: parsedMemberCount,
        beneficiaryName: showBeneficiary && beneficiaryName.trim() ? beneficiaryName.trim() : undefined,
        beneficiaryReason: showBeneficiary && beneficiaryReason.trim() ? beneficiaryReason.trim() : undefined,
        // New fields for family support circles
        beneficiaryPhone: isFamilySupport && beneficiaryPhone ? beneficiaryPhone : undefined,
        beneficiaryCountry: isFamilySupport && beneficiaryCountry ? beneficiaryCountry : undefined,
        isRecurring: isRecurring || undefined,
        totalCycles: isFamilySupport ? totalCycles : undefined,
        // Elder disaster relief fields
        targetCommunityId: isDisasterRelief && selectedCommunity ? selectedCommunity.id : undefined,
        targetCommunityName: isDisasterRelief && selectedCommunity ? selectedCommunity.name : undefined,
        isElderCreated: isDisasterRelief && isElder && elderProfile?.status === "approved",
      } as any); // Type assertion for additional params
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
              <Text style={styles.headerTitle}>Circle Details</Text>
              <Text style={styles.headerSubtitle}>Step 1 of 4</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            {[1, 2, 3, 4].map((step) => (
              <View
                key={step}
                style={[
                  styles.progressStep,
                  step === 1 && styles.progressStepActive,
                ]}
              />
            ))}
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Circle Name */}
          <View style={styles.card}>
            <Text style={styles.label}>Circle Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={isOneTime ? "e.g., Help for Maria, Mom's Surgery Fund" : "e.g., Family Savings, Travel Fund"}
              placeholderTextColor="#9CA3AF"
              maxLength={30}
            />
            <Text style={styles.charCount}>{name.length}/30</Text>
          </View>

          {/* Elder Community Selection - For Disaster Relief circles only */}
          {isDisasterRelief && isElder && elderProfile?.status === "approved" && elderCommunities.length > 0 && (
            <View style={styles.card}>
              <View style={styles.elderBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                <Text style={styles.elderBadgeText}>Elder Access</Text>
              </View>

              <View style={styles.beneficiaryHeader}>
                <View style={[styles.beneficiaryIconContainer, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="people" size={28} color="#D97706" />
                </View>
                <View style={styles.beneficiaryHeaderText}>
                  <Text style={styles.label}>Target Community</Text>
                  <Text style={styles.labelDesc}>
                    As an Elder, you can create disaster relief for your communities
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.contactPickerButton, { borderColor: "#D97706", backgroundColor: "#FFFBEB" }]}
                onPress={() => setShowCommunityPicker(true)}
              >
                <Ionicons name="flag" size={20} color="#D97706" />
                <Text style={[styles.contactPickerButtonText, { color: "#D97706" }]}>
                  {selectedCommunity ? selectedCommunity.name : "Select Community"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              {selectedCommunity && (
                <View style={[styles.selectedContactInfo, { backgroundColor: "#FFFBEB" }]}>
                  <Text style={styles.communityIcon}>{selectedCommunity.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedCommunityName}>{selectedCommunity.name}</Text>
                    <Text style={styles.selectedContactPhone}>
                      {selectedCommunity.members.toLocaleString()} members • {selectedCommunity.circles} circles
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedCommunity(null)}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.elderInfoNotice}>
                <Ionicons name="information-circle" size={16} color="#D97706" />
                <Text style={styles.elderInfoText}>
                  Members of {selectedCommunity?.name || "the selected community"} will be notified and can contribute to this relief fund
                </Text>
              </View>
            </View>
          )}

          {/* Beneficiary Section - For Family Support and Goal-Based circles */}
          {showBeneficiary && (
            <View style={styles.card}>
              <View style={styles.beneficiaryHeader}>
                <View style={styles.beneficiaryIconContainer}>
                  <Ionicons name="person-circle" size={28} color="#00C6AE" />
                </View>
                <View style={styles.beneficiaryHeaderText}>
                  <Text style={styles.label}>
                    {circleType === "goal"
                      ? "Who will receive the funds?"
                      : isDisasterRelief
                      ? "Who needs help?"
                      : "Beneficiary"}
                  </Text>
                  <Text style={styles.labelDesc}>
                    {circleType === "goal"
                      ? "Optional: Specify who this goal is for"
                      : isDisasterRelief
                      ? "Enter the person, family, or community affected"
                      : "Select from your contacts or enter manually"}
                  </Text>
                </View>
              </View>

              {/* Contact Picker Button */}
              <TouchableOpacity
                style={styles.contactPickerButton}
                onPress={() => setShowContactPicker(true)}
              >
                <Ionicons name="people" size={20} color="#00C6AE" />
                <Text style={styles.contactPickerButtonText}>
                  {selectedBeneficiaryContact ? selectedBeneficiaryContact.name : "Select from Contacts"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              {selectedBeneficiaryContact && (
                <View style={styles.selectedContactInfo}>
                  <Ionicons name="call-outline" size={14} color="#6B7280" />
                  <Text style={styles.selectedContactPhone}>{selectedBeneficiaryContact.phone}</Text>
                  <TouchableOpacity onPress={() => {
                    setSelectedBeneficiaryContact(null);
                    setBeneficiaryName("");
                  }}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or enter manually</Text>
                <View style={styles.orLine} />
              </View>

              <TextInput
                style={styles.textInput}
                value={beneficiaryName}
                onChangeText={(text) => {
                  setBeneficiaryName(text);
                  if (selectedBeneficiaryContact && text !== selectedBeneficiaryContact.name) {
                    setSelectedBeneficiaryContact(null);
                  }
                }}
                placeholder={
                  circleType === "goal"
                    ? "Beneficiary's name (optional)"
                    : isDisasterRelief
                    ? "e.g., Flood victims in Bamenda, Maria's family"
                    : "Beneficiary's name"
                }
                placeholderTextColor="#9CA3AF"
                maxLength={50}
              />

              <View style={{ height: 12 }} />

              <Text style={styles.labelSmall}>
                {isDisasterRelief ? "Describe the emergency" : "Reason for support"} (optional)
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={beneficiaryReason}
                onChangeText={setBeneficiaryReason}
                placeholder={
                  circleType === "goal"
                    ? "e.g., Funeral fund, medical expenses, wedding..."
                    : isDisasterRelief
                    ? "e.g., Flooding destroyed their home, earthquake relief..."
                    : "e.g., Medical expenses, wedding, education..."
                }
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                maxLength={150}
              />
              <Text style={styles.charCount}>{beneficiaryReason.length}/150</Text>
            </View>
          )}

          {/* One-Time Notice - When one-time is selected (not for family support or disaster relief) */}
          {isOneTime && showBeneficiary && !isFamilySupport && !isDisasterRelief && (
            <View style={styles.oneTimeNotice}>
              <Ionicons name="information-circle" size={18} color="#00897B" />
              <Text style={styles.oneTimeNoticeText}>
                <Text style={styles.boldText}>One-time collection: </Text>
                Each member contributes once, and all funds go directly to{" "}
                {beneficiaryName || "the beneficiary"}.
              </Text>
            </View>
          )}

          {/* Duration Selector - For Family Support circles only */}
          {isFamilySupport && (
            <View style={styles.card}>
              <View style={styles.durationHeader}>
                <View style={styles.durationIconContainer}>
                  <Ionicons name="calendar" size={24} color="#00C6AE" />
                </View>
                <View style={styles.durationHeaderText}>
                  <Text style={styles.label}>Support Duration</Text>
                  <Text style={styles.labelDesc}>
                    How many months will the family support {beneficiaryName || "this person"}?
                  </Text>
                </View>
              </View>

              <View style={styles.durationOptionsGrid}>
                {durationOptions.map((option) => (
                  <TouchableOpacity
                    key={option.months}
                    style={[
                      styles.durationOption,
                      totalCycles === option.months && styles.durationOptionSelected,
                    ]}
                    onPress={() => setTotalCycles(option.months)}
                  >
                    <Text style={[
                      styles.durationMonths,
                      totalCycles === option.months && styles.durationMonthsSelected,
                    ]}>
                      {option.months}
                    </Text>
                    <Text style={[
                      styles.durationLabel,
                      totalCycles === option.months && styles.durationLabelSelected,
                    ]}>
                      {option.months === 1 ? "Month" : "Months"}
                    </Text>
                    {totalCycles === option.months && (
                      <View style={styles.durationCheck}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Duration */}
              <TouchableOpacity
                style={styles.customDurationButton}
                onPress={() => setShowDurationPicker(true)}
              >
                <Ionicons name="options-outline" size={18} color="#00C6AE" />
                <Text style={styles.customDurationText}>Custom duration</Text>
              </TouchableOpacity>

              {/* Recurring Info Notice */}
              {totalCycles > 1 && (
                <View style={styles.recurringNotice}>
                  <Ionicons name="repeat" size={18} color="#00897B" />
                  <Text style={styles.recurringNoticeText}>
                    <Text style={styles.boldText}>Recurring support: </Text>
                    Members contribute monthly for {totalCycles} months.
                    {beneficiaryName ? ` ${beneficiaryName}` : " The beneficiary"} receives
                    ${totalPot.toLocaleString()} each month (${totalPayoutAllCycles.toLocaleString()} total).
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Number of Members */}
          <View
            style={[
              styles.card,
              memberCount && !isValidMemberCount && styles.cardError,
            ]}
          >
            <Text style={styles.label}>Number of Members</Text>
            <Text style={styles.labelDesc}>
              How many people will be in this circle? (Including yourself)
            </Text>

            <View style={styles.memberInputContainer}>
              <Text style={styles.memberEmoji}>👥</Text>
              <TextInput
                style={styles.memberInput}
                value={memberCount}
                onChangeText={setMemberCount}
                placeholder="Enter number"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
              <Text style={styles.memberSuffix}>members</Text>
            </View>

            <View style={styles.quickButtonsRow}>
              {quickSizes.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.quickButton,
                    memberCount === size.toString() && styles.quickButtonSelected,
                  ]}
                  onPress={() => setMemberCount(size.toString())}
                >
                  <Text
                    style={[
                      styles.quickButtonText,
                      memberCount === size.toString() && styles.quickButtonTextSelected,
                    ]}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {memberCount && !isValidMemberCount ? (
              <Text style={styles.errorText}>
                Minimum 3 members required
              </Text>
            ) : !memberCount ? (
              <Text style={styles.hintText}>Minimum 3 members required</Text>
            ) : null}
          </View>

          {/* Contribution Amount */}
          <View style={styles.card}>
            <Text style={styles.label}>Contribution Amount (per cycle)</Text>

            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.quickButtonsRow}>
              {quickAmounts.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.quickButton,
                    amount === amt.toString() && styles.quickButtonSelected,
                  ]}
                  onPress={() => setAmount(amt.toString())}
                >
                  <Text
                    style={[
                      styles.quickButtonText,
                      amount === amt.toString() && styles.quickButtonTextSelected,
                    ]}
                  >
                    ${amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hintText}>Min: $10 • Max: $500 per cycle</Text>
          </View>

          {/* Frequency - Available for all circle types */}
          <View style={styles.card}>
            <Text style={styles.label}>Contribution Frequency</Text>
            <Text style={styles.labelDesc}>
              {canSelectOneTime
                ? "Choose one-time collection or recurring schedule"
                : "Match your income cycle - choose how often members contribute"}
            </Text>

            {availableFrequencies.map((freq) => (
              <TouchableOpacity
                key={freq.id}
                style={[
                  styles.frequencyButton,
                  frequency === freq.id && styles.frequencyButtonSelected,
                ]}
                onPress={() => setFrequency(freq.id)}
              >
                <View style={styles.frequencyTextContainer}>
                  <Text style={styles.frequencyLabel}>{freq.label}</Text>
                  <Text style={styles.frequencyDesc}>{freq.description}</Text>
                </View>
                {frequency === freq.id && (
                  <View style={styles.frequencyCheck}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Card */}
          {parsedAmount > 0 && isValidMemberCount && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {isFamilySupport && totalCycles > 1
                  ? "Family Support Summary"
                  : isDisasterRelief
                  ? "Disaster Relief Summary"
                  : isOneTime
                  ? "Collection Summary"
                  : "Circle Summary"}
              </Text>

              {beneficiaryName && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Beneficiary</Text>
                  <Text style={styles.summaryValueHighlight}>{beneficiaryName}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isOneTime ? "Contributors" : "Members"}</Text>
                <Text style={styles.summaryValue}>{parsedMemberCount} people</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {isFamilySupport && totalCycles > 1 ? "Monthly contribution" : "Each contribution"}
                </Text>
                <Text style={styles.summaryValue}>${parsedAmount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {isFamilySupport && totalCycles > 1
                    ? "Monthly payout"
                    : isOneTime || isDisasterRelief
                    ? "Total collection"
                    : "Pot each cycle"}
                </Text>
                <Text style={styles.summaryValueHighlight}>
                  ${totalPot.toLocaleString()}
                </Text>
              </View>

              {/* Family Support recurring rows */}
              {isFamilySupport && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Support duration</Text>
                    <Text style={styles.summaryValue}>
                      {totalCycles} {totalCycles === 1 ? "month" : "months"}
                    </Text>
                  </View>
                  {totalCycles > 1 && (
                    <>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Your total contribution</Text>
                        <Text style={styles.summaryValue}>
                          ${totalContributionPerMember.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total to beneficiary</Text>
                        <Text style={[styles.summaryValueHighlight, styles.summaryValueLarge]}>
                          ${totalPayoutAllCycles.toLocaleString()}
                        </Text>
                      </View>
                    </>
                  )}
                </>
              )}

              {!isOneTime && !(isFamilySupport && totalCycles > 1) && !isDisasterRelief && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Full cycle duration</Text>
                  <Text style={styles.summaryValue}>{getCycleDuration()}</Text>
                </View>
              )}

              <View style={styles.summaryTip}>
                <Text style={styles.summaryTipText}>
                  {isFamilySupport && totalCycles > 1
                    ? `💝 ${beneficiaryName || "Your family member"} receives $${totalPot.toLocaleString()}/month for ${totalCycles} months — one setup, continuous support!`
                    : isFamilySupport
                    ? `💝 ${beneficiaryName || "Your family member"} will receive $${totalPot.toLocaleString()} this month from ${parsedMemberCount} supporters`
                    : isDisasterRelief
                    ? `🆘 Emergency relief: $${totalPot.toLocaleString()} collected for ${beneficiaryName || "disaster relief"}`
                    : isOneTime && beneficiaryName
                    ? `💝 ${beneficiaryName} will receive $${totalPot.toLocaleString()} once all ${parsedMemberCount} contributors chip in`
                    : isOneTime
                    ? `💝 Total of $${totalPot.toLocaleString()} will be collected from ${parsedMemberCount} contributors`
                    : beneficiaryName
                    ? `💝 ${beneficiaryName} receives $${totalPot.toLocaleString()} each ${frequency === "weekly" ? "week" : frequency === "biweekly" ? "2 weeks" : "month"}`
                    : `💡 Payout happens automatically once all ${parsedMemberCount} members contribute each cycle`}
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

      {/* Custom Duration Picker Modal */}
      <Modal
        visible={showDurationPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDurationPicker(false)}
      >
        <View style={styles.durationModalOverlay}>
          <View style={styles.durationModalContent}>
            <View style={styles.durationModalHeader}>
              <Text style={styles.durationModalTitle}>Custom Duration</Text>
              <TouchableOpacity
                style={styles.durationModalClose}
                onPress={() => setShowDurationPicker(false)}
              >
                <Ionicons name="close" size={24} color="#0A2342" />
              </TouchableOpacity>
            </View>

            <Text style={styles.durationModalSubtitle}>
              Select how many months to support {beneficiaryName || "the beneficiary"}
            </Text>

            <View style={styles.durationSliderContainer}>
              <View style={styles.durationSliderRow}>
                <TouchableOpacity
                  style={styles.durationSliderButton}
                  onPress={() => setTotalCycles(Math.max(1, totalCycles - 1))}
                >
                  <Ionicons name="remove" size={24} color="#00C6AE" />
                </TouchableOpacity>

                <View style={styles.durationSliderValue}>
                  <Text style={styles.durationSliderNumber}>{totalCycles}</Text>
                  <Text style={styles.durationSliderLabel}>
                    {totalCycles === 1 ? "Month" : "Months"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.durationSliderButton}
                  onPress={() => setTotalCycles(Math.min(24, totalCycles + 1))}
                >
                  <Ionicons name="add" size={24} color="#00C6AE" />
                </TouchableOpacity>
              </View>

              <Text style={styles.durationSliderHint}>Range: 1-24 months</Text>
            </View>

            {parsedAmount > 0 && isValidMemberCount && (
              <View style={styles.durationModalSummary}>
                <View style={styles.durationModalSummaryRow}>
                  <Text style={styles.durationModalSummaryLabel}>Monthly payout</Text>
                  <Text style={styles.durationModalSummaryValue}>
                    ${totalPot.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.durationModalSummaryRow}>
                  <Text style={styles.durationModalSummaryLabel}>Total over {totalCycles} months</Text>
                  <Text style={styles.durationModalSummaryValueHighlight}>
                    ${totalPayoutAllCycles.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.durationModalConfirm}
              onPress={() => setShowDurationPicker(false)}
            >
              <Text style={styles.durationModalConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Beneficiary</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowContactPicker(false);
                setContactSearch("");
              }}
            >
              <Ionicons name="close" size={24} color="#0A2342" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder="Search contacts..."
              placeholderTextColor="#9CA3AF"
            />
            {contactSearch.length > 0 && (
              <TouchableOpacity onPress={() => setContactSearch("")}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.contactCount}>
            {filteredContacts.length} contacts found
          </Text>

          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => selectBeneficiaryFromContact(item)}
              >
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.name}</Text>
                  <Text style={styles.contactPhone}>{item.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContacts}>
                <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyContactsText}>
                  {contacts.length === 0
                    ? "Loading contacts..."
                    : "No contacts match your search"}
                </Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Community Picker Modal for Elder Disaster Relief */}
      <Modal
        visible={showCommunityPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCommunityPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Community</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCommunityPicker(false)}
            >
              <Ionicons name="close" size={24} color="#0A2342" />
            </TouchableOpacity>
          </View>

          <View style={styles.elderModalBanner}>
            <Ionicons name="shield-checkmark" size={20} color="#D97706" />
            <Text style={styles.elderModalBannerText}>
              Communities where you serve as Elder
            </Text>
          </View>

          <FlatList
            data={elderCommunities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.communityItem,
                  selectedCommunity?.id === item.id && styles.communityItemSelected,
                ]}
                onPress={() => {
                  setSelectedCommunity(item);
                  setShowCommunityPicker(false);
                }}
              >
                <View style={styles.communityItemIcon}>
                  <Text style={styles.communityItemEmoji}>{item.icon}</Text>
                </View>
                <View style={styles.communityItemInfo}>
                  <Text style={styles.communityItemName}>{item.name}</Text>
                  <Text style={styles.communityItemStats}>
                    {item.members.toLocaleString()} members • {item.circles} circles
                  </Text>
                  {item.role === "elder" && (
                    <View style={styles.elderRoleBadge}>
                      <Ionicons name="shield" size={12} color="#D97706" />
                      <Text style={styles.elderRoleBadgeText}>Elder</Text>
                    </View>
                  )}
                </View>
                {selectedCommunity?.id === item.id ? (
                  <View style={styles.communityCheckmark}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContacts}>
                <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyContactsText}>
                  No communities found where you are an Elder
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardError: {
    borderColor: "#DC2626",
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
  textInput: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 16,
    color: "#0A2342",
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 8,
  },
  labelSmall: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  beneficiaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  beneficiaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  beneficiaryHeaderText: {
    flex: 1,
  },
  oneTimeNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  oneTimeNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  boldText: {
    fontWeight: "700",
  },
  memberInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  memberEmoji: {
    fontSize: 24,
  },
  memberInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
  },
  memberSuffix: {
    fontSize: 14,
    color: "#6B7280",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0A2342",
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: "#0A2342",
  },
  quickButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  quickButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  quickButtonSelected: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  quickButtonTextSelected: {
    color: "#00C6AE",
  },
  hintText: {
    fontSize: 12,
    color: "#6B7280",
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
  },
  frequencyButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  frequencyButtonSelected: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  frequencyTextContainer: {
    flex: 1,
  },
  frequencyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  frequencyDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  frequencyCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: "#0A2342",
    borderRadius: 14,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  summaryValueHighlight: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  summaryTip: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 8,
  },
  summaryTipText: {
    fontSize: 11,
    color: "#00C6AE",
    lineHeight: 16,
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
  // Contact Picker Button Styles
  contactPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
    gap: 10,
    marginBottom: 12,
  },
  contactPickerButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  selectedContactInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F7FA",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedContactPhone: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  orText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F5F7FA",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0A2342",
  },
  contactCount: {
    fontSize: 12,
    color: "#6B7280",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
    gap: 12,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  contactPhone: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  emptyContacts: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyContactsText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
  // Duration Selector Styles
  durationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  durationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  durationHeaderText: {
    flex: 1,
  },
  durationOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  durationOption: {
    width: "23%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  durationOptionSelected: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  durationMonths: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
  },
  durationMonthsSelected: {
    color: "#00C6AE",
  },
  durationLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  durationLabelSelected: {
    color: "#00897B",
  },
  durationCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  customDurationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00C6AE",
    borderStyle: "dashed",
    marginBottom: 12,
  },
  customDurationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  recurringNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
  },
  recurringNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  // Summary card additions
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 8,
  },
  summaryValueLarge: {
    fontSize: 16,
  },
  // Duration Modal Styles
  durationModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  durationModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  durationModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  durationModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  durationModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  durationModalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  durationSliderContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  durationSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  durationSliderButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  durationSliderValue: {
    alignItems: "center",
    minWidth: 100,
  },
  durationSliderNumber: {
    fontSize: 48,
    fontWeight: "700",
    color: "#0A2342",
  },
  durationSliderLabel: {
    fontSize: 16,
    color: "#6B7280",
  },
  durationSliderHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 12,
  },
  durationModalSummary: {
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  durationModalSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  durationModalSummaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  durationModalSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  durationModalSummaryValueHighlight: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00C6AE",
  },
  durationModalConfirm: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  durationModalConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Elder Community Selection Styles
  elderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  elderBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D97706",
  },
  communityIcon: {
    fontSize: 24,
  },
  selectedCommunityName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  elderInfoNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  elderInfoText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  elderModalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  elderModalBannerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#92400E",
  },
  communityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
    gap: 12,
  },
  communityItemSelected: {
    backgroundColor: "#FFFBEB",
  },
  communityItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  communityItemEmoji: {
    fontSize: 24,
  },
  communityItemInfo: {
    flex: 1,
  },
  communityItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  communityItemStats: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  elderRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  elderRoleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
  },
  communityCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
  },
});
