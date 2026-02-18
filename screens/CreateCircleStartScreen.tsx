import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
    name: "Traditional Tanda",
    emoji: "🔄",
    description:
      "Classic rotating savings. Each member contributes equally on a fixed schedule, and one member receives the pot each cycle.",
    features: ["Equal contribution", "Rotating payouts", "Fixed schedule"],
    popular: true,
  },
  {
    id: "family-support",
    name: "Family Support",
    emoji: "👨‍👩‍👧‍👦",
    description:
      "Support a family member or friend. Pick the beneficiary and choose one-time, recurring monthly (1-24 months), or ongoing support.",
    features: ["Multi-month payouts", "Pick beneficiary", "Flexible duration"],
    popular: false,
    isNew: true,
  },
  {
    id: "beneficiary",
    name: "Disaster Relief",
    emoji: "🆘",
    description:
      "Fundraise for communities affected by disasters. Rally your community to provide emergency support when it's needed most.",
    features: ["Emergency support", "Community fundraising", "One-time relief"],
    popular: false,
  },
  {
    id: "goal",
    name: "Goal-Based Circle",
    emoji: "🎯",
    description:
      "Save together toward a shared goal like a funeral fund, wedding, or group purchase. One-time or recurring.",
    features: ["Shared target", "Flexible amounts", "One-time or recurring"],
    popular: false,
  },
  {
    id: "emergency",
    name: "Emergency Fund Circle",
    emoji: "🛡️",
    description:
      "Build emergency funds together. Members can request funds when unexpected situations arise.",
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

  const handleContinue = () => {
    if (selectedType && canCreate) {
      navigation.navigate("CreateCircleDetails", { circleType: selectedType });
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
            <Text style={styles.cardTitle}>Choose Circle Type</Text>

            {circleTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeButton,
                  selectedType === type.id && styles.typeButtonSelected,
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
                  <View style={[styles.popularBadge, { backgroundColor: "#6366F1" }]}>
                    <Text style={styles.popularBadgeText}>NEW</Text>
                  </View>
                )}

                <View style={styles.typeContent}>
                  <View
                    style={[
                      styles.typeIconContainer,
                      selectedType === type.id && styles.typeIconContainerSelected,
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
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

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

      {/* Continue Button */}
      <View style={styles.footer}>
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
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
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
});
