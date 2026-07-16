import React, { useEffect, useRef, useState } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";
import { useFormDraft } from "../hooks/useFormDraft";
import { CircleDraft, CIRCLE_DRAFT_KEY, type CircleType } from "../lib/circleDraft";
import { useEventTracker } from "../hooks/useEventTracker";

type CreateCircleStartNavigationProp = StackNavigationProp<RootStackParamList>;

// Bucket C — typed catalogue shape so the JSX below doesn't need
// `type.isTravel` etc. The `isTravel` and `isNew` props are
// optional flags only set on the travel entry; without the type
// TypeScript infers a narrower row shape from the first item.
type CircleTypeOption = {
  id: string;
  nameKey: string;
  emoji: string;
  descKey: string;
  featureKeys: string[];
  popular: boolean;
  isNew?: boolean;
  isTravel?: boolean;
};

// i18n: nameKey/descKey/featureKeys resolved per-render via t() at call site.
const circleTypes: CircleTypeOption[] = [
  {
    id: "traditional",
    nameKey: "create_circle_start.type_traditional_name",
    emoji: "🔄",
    descKey: "create_circle_start.type_traditional_desc",
    featureKeys: [
      "create_circle_start.type_traditional_feat_1",
      "create_circle_start.type_traditional_feat_2",
      "create_circle_start.type_traditional_feat_3",
    ],
    popular: true,
  },
  {
    id: "travel",
    nameKey: "create_circle_start.type_travel_name",
    emoji: "✈️",
    descKey: "create_circle_start.type_travel_desc",
    featureKeys: [
      "create_circle_start.type_travel_feat_1",
      "create_circle_start.type_travel_feat_2",
      "create_circle_start.type_travel_feat_3",
    ],
    popular: false,
    isNew: true,
    isTravel: true,
  },
  {
    id: "family-support",
    nameKey: "create_circle_start.type_family_name",
    emoji: "👨‍👩‍👧‍👦",
    descKey: "create_circle_start.type_family_desc",
    featureKeys: [
      "create_circle_start.type_family_feat_1",
      "create_circle_start.type_family_feat_2",
      "create_circle_start.type_family_feat_3",
    ],
    popular: false,
  },
  {
    id: "beneficiary",
    nameKey: "create_circle_start.type_beneficiary_name",
    emoji: "🆘",
    descKey: "create_circle_start.type_beneficiary_desc",
    featureKeys: [
      "create_circle_start.type_beneficiary_feat_1",
      "create_circle_start.type_beneficiary_feat_2",
      "create_circle_start.type_beneficiary_feat_3",
    ],
    popular: false,
  },
  {
    id: "goal",
    nameKey: "create_circle_start.type_goal_name",
    emoji: "🎯",
    descKey: "create_circle_start.type_goal_desc",
    featureKeys: [
      "create_circle_start.type_goal_feat_1",
      "create_circle_start.type_goal_feat_2",
      "create_circle_start.type_goal_feat_3",
    ],
    popular: false,
  },
  {
    id: "emergency",
    nameKey: "create_circle_start.type_emergency_name",
    emoji: "🛡️",
    descKey: "create_circle_start.type_emergency_desc",
    featureKeys: [
      "create_circle_start.type_emergency_feat_1",
      "create_circle_start.type_emergency_feat_2",
      "create_circle_start.type_emergency_feat_3",
    ],
    popular: false,
  },
];

export default function CreateCircleStartScreen() {
  const navigation = useNavigation<CreateCircleStartNavigationProp>();
  const route = useRoute();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Phase 7 — CommunityHubScreen may pass communityId/communityName
  // to pre-scope the new circle to a community. When present, we
  // include them in the initial CircleDraft so downstream wizard
  // steps carry the scope through to the createCircle RPC via
  // CircleDraft.targetCommunityId.
  const params = (route.params ?? {}) as
    | { communityId?: string; communityName?: string }
    | undefined;
  const preseedCommunityId = params?.communityId;
  const preseedCommunityName = params?.communityName;

  const userXnScore = user?.xnScore || 0;
  const minScoreRequired = 60;
  const canCreate = userXnScore >= minScoreRequired;

  // Bucket C — telemetry. circle_create.advanced_opened fires once
  // per mount (the Start screen IS the Advanced wizard entry). Ref-
  // guarded so re-renders don't double-emit.
  const { track } = useEventTracker();
  const advancedOpenedRef = useRef(false);
  useEffect(() => {
    if (advancedOpenedRef.current) return;
    advancedOpenedRef.current = true;
    track({
      eventType: "circle_create_advanced_opened",
      eventCategory: "savings",
      eventAction: "advanced_opened",
    });
  }, [track]);

  const isTravelSelected = selectedType === "travel";

  // Cross-step draft (shared key). This screen only READS the draft to offer
  // a restore; it does not save (Continue starts a fresh wizard). The later
  // step screens save/clear it.
  const { hasDraft, restoreDraft, clearDraft } = useFormDraft<CircleDraft>(
    CIRCLE_DRAFT_KEY,
    { circleType: "" }
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handleRestoreDraft = () => {
    const d = restoreDraft();
    if (d) {
      // Bucket B (Create-a-circle review): route to the merged
      // WizardForm screen with the typed draft instead of the old
      // CreateCircleDetails step. The form rehydrates from the draft's
      // accumulated fields on mount.
      navigation.navigate("CreateCircleWizardForm", { draft: d });
    }
    setBannerDismissed(true);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setBannerDismissed(true);
  };

  const handleContinue = () => {
    if (selectedType && canCreate) {
      if (isTravelSelected) {
        // Travel type → Trip Organizer wizard (4 steps). The cast
        // remains because CreateTripWizard is registered in a different
        // navigator (TripStack) and isn't typed in the circle-creation
        // RootStackParamList. Out of scope for the circle-create
        // typing sweep; would need a cross-stack types refactor.
        navigation.navigate("CreateTripWizard" as never, {});
      } else {
        // Bucket B — all other types route through the merged
        // WizardForm screen with a typed draft. Replaces the old
        // CreateCircleDetails → CreateCircleSchedule two-hop chain.
        navigation.navigate("CreateCircleWizardForm", {
          draft: {
            circleType: selectedType as CircleType,
            ...(preseedCommunityId
              ? {
                  targetCommunityId: preseedCommunityId,
                  targetCommunityName: preseedCommunityName,
                }
              : {}),
          },
        });
      }
    }
  };

  const handleBasicCircleFallback = () => {
    // Escape hatch: user picked Travel but wants a basic savings circle instead
    if (canCreate) {
      navigation.navigate("CreateCircleWizardForm", {
        draft: {
          circleType: "goal",
          ...(preseedCommunityId
            ? {
                targetCommunityId: preseedCommunityId,
                targetCommunityName: preseedCommunityName,
              }
            : {}),
        },
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
              <Text style={styles.headerTitle}>{t("create_circle_start.header_title")}</Text>
              <Text style={styles.headerSubtitle}>
                {t("create_circle_start.header_subtitle")}
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
                {canCreate ? t("create_circle_start.score_can_create") : t("create_circle_start.score_too_low")}
              </Text>
              <Text style={styles.scoreSubtitle}>
                {canCreate
                  ? t("create_circle_start.score_exceeds", { score: userXnScore, min: minScoreRequired })
                  : t("create_circle_start.score_need_min", { min: minScoreRequired })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Unfinished-circle draft banner */}
          {hasDraft && !bannerDismissed && (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>
                {t("create_circle_start.draft_banner")}
              </Text>
              <View style={styles.draftBannerActions}>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleRestoreDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>{t("create_circle_start.draft_restore")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleDiscardDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>{t("create_circle_start.draft_discard")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Circle Types */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("create_circle_start.card_title")}</Text>
            <Text style={styles.cardSubtitle}>{t("create_circle_start.card_subtitle")}</Text>

            {circleTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeButton,
                  selectedType === type.id && styles.typeButtonSelected,
                  selectedType === type.id && type.isTravel && styles.typeButtonTravelSelected,
                  !canCreate && styles.typeButtonDisabled,
                ]}
                onPress={() => canCreate && setSelectedType(type.id)}
                activeOpacity={canCreate ? 0.7 : 1}
              >
                {type.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{t("create_circle_start.badge_popular")}</Text>
                  </View>
                )}
                {type.isNew && (
                  <View style={[styles.popularBadge, { backgroundColor: "#E8A842" }]}>
                    <Text style={styles.popularBadgeText}>{t("create_circle_start.badge_new")}</Text>
                  </View>
                )}

                <View style={styles.typeContent}>
                  <View
                    style={[
                      styles.typeIconContainer,
                      selectedType === type.id && styles.typeIconContainerSelected,
                      selectedType === type.id && type.isTravel && styles.typeIconContainerTravel,
                    ]}
                  >
                    <Text style={styles.typeEmoji}>{type.emoji}</Text>
                  </View>

                  <View style={styles.typeTextContainer}>
                    <Text style={styles.typeName}>{t(type.nameKey)}</Text>
                    <Text style={styles.typeDescription}>{t(type.descKey)}</Text>

                    <View style={styles.featuresRow}>
                      {type.featureKeys.map((featureKey, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.featureBadge,
                            selectedType === type.id && styles.featureBadgeSelected,
                            selectedType === type.id && type.isTravel && styles.featureBadgeTravel,
                          ]}
                        >
                          <Text
                            style={[
                              styles.featureText,
                              selectedType === type.id && styles.featureTextSelected,
                            ]}
                          >
                            {t(featureKey)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {selectedType === type.id && (
                    <View style={[
                      styles.checkCircle,
                      type.isTravel && { backgroundColor: "#E8A842" },
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
                <Text style={styles.travelBannerTitle}>{t("create_circle_start.travel_banner_title")}</Text>
              </View>
              <Text style={styles.travelBannerText}>
                {t("create_circle_start.travel_banner_text")}
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
                {t("create_circle_start.learn_more_title")}
              </Text>
              <Text style={styles.learnMoreSubtitle}>
                {t("create_circle_start.learn_more_subtitle")}
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
              <Text style={styles.trustBold}>{t("create_circle_start.trust_strong")}</Text>
              {t("create_circle_start.trust_body")}
              <Text style={styles.trustWarning}>
                {t("create_circle_start.trust_warning")}
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
              <Text style={styles.continueButtonText}>{t("create_circle_start.btn_setup_trip")}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.escapeHatchButton}
              onPress={handleBasicCircleFallback}
            >
              <Text style={styles.escapeHatchText}>{t("create_circle_start.btn_basic_fallback")}</Text>
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
              {t("create_circle_start.btn_continue")}
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
  draftBanner: {
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  draftBannerText: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    fontWeight: "500",
  },
  draftBannerActions: { flexDirection: "row", alignItems: "center" },
  draftBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginLeft: 8,
  },
  draftBannerButtonText: { color: "#D97706", fontWeight: "600", fontSize: 13 },
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
