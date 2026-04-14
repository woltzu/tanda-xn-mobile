import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";

type CreateCircleStartNavigationProp = StackNavigationProp<RootStackParamList>;

const circleTypes = [
  {
    id: "traditional",
    name: "Rotating Pot",
    emoji: "🔄",
    description:
      "Classic ROSCA. Members contribute equally on a schedule. Each cycle, one member receives the full pot.",
    features: ["Equal contribution", "Rotating payouts", "Fixed schedule"],
    popular: true,
  },
  {
    id: "travel",
    name: "Travel",
    emoji: "✈️",
    description:
      "Plan a group trip with a full itinerary, collect payments, manage travelers, and share a public trip page.",
    features: ["Trip organizer", "Payment plans", "Itinerary builder"],
    popular: false,
    isNew: true,
    isTravel: true,
  },
  {
    id: "family-support",
    name: "Single Beneficiary",
    emoji: "👨‍👩‍👧‍👦",
    description:
      "One person receives all contributions. Can be one-time or recurring. Perfect for trips, gifts, or family support.",
    features: ["Pick beneficiary", "Flexible duration", "One-time or recurring"],
    popular: false,
  },
  {
    id: "beneficiary",
    name: "Flexible Fundraise",
    emoji: "🆘",
    description:
      "One-time campaign for a specific cause. Rally your community and anyone can contribute any amount.",
    features: ["Community fundraising", "Any amount", "One-time campaign"],
    popular: false,
  },
  {
    id: "goal",
    name: "Shared Goal",
    emoji: "🎯",
    description:
      "Everyone saves toward a common target. Funds are used together when the goal is reached.",
    features: ["Shared target", "Flexible amounts", "One-time or recurring"],
    popular: false,
  },
  {
    id: "emergency",
    name: "Emergency Pool",
    emoji: "🛡️",
    description:
      "Members contribute to a communal fund. Anyone can request withdrawals when needed, with group approval.",
    features: ["Safety net", "Request-based", "Community support"],
    popular: false,
  },
];

export default function CreateCircleStartScreen() {
  const navigation = useNavigation<CreateCircleStartNavigationProp>();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const userXnScore = user?.xnScore || 0;
  const minScoreRequired = 60;
  const canCreate = userXnScore >= minScoreRequired;

  const isTravelSelected = selectedType === "travel";

  const handleContinue = () => {
    if (selectedType && canCreate) {
      if (isTravelSelected) {
        // Travel type → Trip Organizer wizard (4 steps)
        navigation.navigate("CreateTripWizard" as any, {});
      } else {
        // All other types → existing circle details flow
        navigation.navigate("CreateCircleDetails", { circleType: selectedType });
      }
    }
  };

  const handleBasicCircleFallback = () => {
    // Escape hatch: user picked Travel but wants a basic savings circle instead
    if (canCreate) {
      navigation.navigate("CreateCircleDetails", { circleType: "goal" });
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
              <Text style={styles.headerTitle}>Create a Circle</Text>
              <Text style={styles.headerSubtitle}>
                Save together with people you trust
              </Text>
            </View>
          </View>

          {/* XnScore Requirement */}
          <View
            style={[
              styles.scoreCard,
              { backgroundColor: canCreate ? "rgba(0,198,174,0.2)" : "rgba(217,119,6,0.2)" },
            ]}
          >
            <View
              style={[
                styles.scoreCircle,
                { backgroundColor: canCreate ? "#00C6AE" : "#D97706" },
              ]}
            >
              <Text style={styles.scoreValue}>{userXnScore}</Text>
            </View>
            <View style={styles.scoreTextContainer}>
              <Text style={styles.scoreTitle}>
                {canCreate ? "You can create circles!" : "Score too low"}
              </Text>
              <Text style={styles.scoreSubtitle}>
                {canCreate
                  ? `Your XnScore (${userXnScore}) exceeds minimum (${minScoreRequired})`
                  : `Need ${minScoreRequired}+ XnScore to create circles`}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Circle Types */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What kind of circle?</Text>
            <Text style={styles.cardSubtitle}>Choose a purpose for your group</Text>

            {circleTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeButton,
                  selectedType === type.id && styles.typeButtonSelected,
                  selectedType === type.id && (type as any).isTravel && styles.typeButtonTravelSelected,
                  !canCreate && styles.typeButtonDisabled,
                ]}
                onPress={() => canCreate && setSelectedType(type.id)}
                activeOpacity={canCreate ? 0.7 : 1}
              >
                {type.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>POPULAR</Text>
                  </View>
                )}
                {(type as any).isNew && (
                  <View style={[styles.popularBadge, { backgroundColor: "#E8A842" }]}>
                    <Text style={styles.popularBadgeText}>NEW</Text>
                  </View>
                )}

                <View style={styles.typeContent}>
                  <View
                    style={[
                      styles.typeIconContainer,
                      selectedType === type.id && styles.typeIconContainerSelected,
                      selectedType === type.id && (type as any).isTravel && styles.typeIconContainerTravel,
                    ]}
                  >
                    <Text style={styles.typeEmoji}>{type.emoji}</Text>
                  </View>

                  <View style={styles.typeTextContainer}>
                    <Text style={styles.typeName}>{type.name}</Text>
                    <Text style={styles.typeDescription}>{type.description}</Text>

                    <View style={styles.featuresRow}>
                      {type.features.map((feature, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.featureBadge,
                            selectedType === type.id && styles.featureBadgeSelected,
                            selectedType === type.id && (type as any).isTravel && styles.featureBadgeTravel,
                          ]}
                        >
                          <Text
                            style={[
                              styles.featureText,
                              selectedType === type.id && styles.featureTextSelected,
                            ]}
                          >
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {selectedType === type.id && (
                    <View style={[
                      styles.checkCircle,
                      (type as any).isTravel && { backgroundColor: "#E8A842" },
                    ]}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Trip Organizer Mode Banner — appears when Travel is selected */}
          {isTravelSelected && (
            <View style={styles.travelBanner}>
              <View style={styles.travelBannerHeader}>
                <Text style={styles.travelBannerIcon}>✈️</Text>
                <Text style={styles.travelBannerTitle}>Trip Organizer Mode</Text>
              </View>
              <Text style={styles.travelBannerText}>
                You're building a group trip. We'll help you set up the itinerary,
                collect payments, and manage your travelers — all in one place.
              </Text>
            </View>
          )}

          {/* How It Works */}
          <TouchableOpacity
            style={styles.learnMoreButton}
            onPress={() => navigation.navigate("HowCirclesWork")}
          >
            <View style={styles.learnMoreIcon}>
              <Ionicons name="help-circle-outline" size={22} color="#0A2342" />
            </View>
            <View style={styles.learnMoreText}>
              <Text style={styles.learnMoreTitle}>
                How do savings circles work?
              </Text>
              <Text style={styles.learnMoreSubtitle}>
                Learn about tandas and rotating savings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Trust Note */}
          <View style={styles.trustNote}>
            <Ionicons
              name="shield-checkmark"
              size={18}
              color="#00897B"
              style={styles.trustIcon}
            />
            <Text style={styles.trustText}>
              <Text style={styles.trustBold}>Protected by TandaXn:</Text>{" "}
              Contributions are secured against individual member defaults.
              <Text style={styles.trustWarning}>
                {" "}
                Note: Protection does not apply in cases of suspected collusion
                or coordinated fraud.
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer — adapts for Travel vs. other types */}
      <View style={styles.footer}>
        {isTravelSelected ? (
          <View style={styles.travelFooter}>
            <TouchableOpacity
              style={[styles.continueButton, styles.continueButtonTravel]}
              onPress={handleContinue}
              disabled={!canCreate}
            >
              <Text style={styles.continueButtonText}>Set Up My Trip</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.escapeHatchButton}
              onPress={handleBasicCircleFallback}
            >
              <Text style={styles.escapeHatchText}>Just create a basic savings circle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!selectedType || !canCreate) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!selectedType || !canCreate}
          >
            <Text
              style={[
                styles.continueButtonText,
                (!selectedType || !canCreate) && styles.continueButtonTextDisabled,
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>
        )}
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
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
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
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  scoreCard: {
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scoreTextContainer: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scoreSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  typeButton: {
    padding: 16,
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    position: "relative",
  },
  typeButtonSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  typeButtonTravelSelected: {
    backgroundColor: "#FFF7ED",
    borderColor: "#E8A842",
  },
  typeButtonDisabled: {
    opacity: 0.6,
  },
  popularBadge: {
    position: "absolute",
    top: -8,
    right: 12,
    backgroundColor: "#00C6AE",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  typeContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  typeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  typeIconContainerSelected: {
    backgroundColor: "#00C6AE",
  },
  typeIconContainerTravel: {
    backgroundColor: "#E8A842",
  },
  typeEmoji: {
    fontSize: 26,
  },
  typeTextContainer: {
    flex: 1,
  },
  typeName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 6,
  },
  typeDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
    marginBottom: 10,
  },
  featuresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  featureBadge: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  featureBadgeSelected: {
    backgroundColor: "#00C6AE",
  },
  featureBadgeTravel: {
    backgroundColor: "#E8A842",
  },
  featureText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#6B7280",
  },
  featureTextSelected: {
    color: "#FFFFFF",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  learnMoreButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  learnMoreIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  learnMoreText: {
    flex: 1,
  },
  learnMoreTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  learnMoreSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  trustNote: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  trustIcon: {
    marginTop: 2,
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  trustBold: {
    fontWeight: "700",
  },
  trustWarning: {
    color: "#92400E",
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
    flexDirection: "row",
    justifyContent: "center",
  },
  continueButtonTravel: {
    backgroundColor: "#E8A842",
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
  // --- Travel banner ---
  travelBanner: {
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(232,168,66,0.35)",
  },
  travelBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  travelBannerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  travelBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E8A842",
  },
  travelBannerText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
  // --- Travel footer ---
  travelFooter: {
    width: "100%",
  },
  escapeHatchButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  escapeHatchText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});
