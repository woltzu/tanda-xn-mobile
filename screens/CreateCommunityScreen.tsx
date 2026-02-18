import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import {
  useCommunity,
  CommunityType,
  CommunityPrivacy,
  SimilarCommunity,
  Community,
} from "../context/CommunityContext";

type CreateCommunityNavigationProp = StackNavigationProp<RootStackParamList>;
type CreateCommunityRouteProp = RouteProp<RootStackParamList, "CreateCommunity">;

const communityTypes: {
  id: CommunityType;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "diaspora",
    label: "Diaspora / Nationality",
    icon: "✈️",
    description: "Connect with people from your home country",
  },
  {
    id: "religious",
    label: "Faith / Religious",
    icon: "🙏",
    description: "Share beliefs and support each other",
  },
  {
    id: "professional",
    label: "Professional / Industry",
    icon: "💼",
    description: "Network with colleagues and peers",
  },
  {
    id: "neighborhood",
    label: "Local / Neighborhood",
    icon: "🏘️",
    description: "Connect with neighbors and locals",
  },
  {
    id: "school",
    label: "School / Alumni",
    icon: "🎓",
    description: "Stay connected with classmates",
  },
  {
    id: "interest",
    label: "Interest / Hobby",
    icon: "⭐",
    description: "Bond over shared interests",
  },
];

const iconOptions = [
  // Flags
  "🇨🇮", "🇳🇬", "🇬🇭", "🇰🇪", "🇮🇳", "🇵🇭", "🇲🇽", "🇯🇲", "🇪🇹", "🇸🇳",
  // Religious
  "⛪", "🕌", "🕍", "🛕", "🙏", "✝️", "☪️", "✡️",
  // Professional
  "💼", "👩‍💻", "👨‍⚕️", "👩‍🍳", "👨‍🏫", "👷", "🏢", "📊",
  // Local
  "🏘️", "🏠", "🌆", "🏙️", "🌳", "🏖️", "⛰️", "🌾",
  // School
  "🎓", "📚", "🏫", "🎒", "✏️", "🔬", "🎨", "🎵",
  // Interest
  "⚽", "🏀", "🎮", "🎯", "🎭", "🎪", "🧘", "💪",
];

export default function CreateCommunityScreen() {
  const navigation = useNavigation<CreateCommunityNavigationProp>();
  const route = useRoute<CreateCommunityRouteProp>();
  const parentIdFromRoute = route.params?.parentId;

  const {
    createCommunity,
    checkSimilarCommunities,
    myCommunities,
    discoverCommunities,
    getCommunityById,
    isLoading,
  } = useCommunity();

  // Form state
  const [communityName, setCommunityName] = useState("");
  const [communityType, setCommunityType] = useState<CommunityType | "">("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [isSubCommunity, setIsSubCommunity] = useState(!!parentIdFromRoute);
  const [parentCommunity, setParentCommunity] = useState<Community | null>(
    parentIdFromRoute ? getCommunityById(parentIdFromRoute) || null : null
  );
  const [privacy, setPrivacy] = useState<CommunityPrivacy>("public");

  // UI state
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [similarCommunities, setSimilarCommunities] = useState<SimilarCommunity[]>([]);
  const [nameWarning, setNameWarning] = useState<string | null>(null);

  // Get parent communities (top-level only)
  const parentCommunities = [...myCommunities, ...discoverCommunities].filter(
    (c) => !c.parentId
  );

  // Check for similar communities when name or type changes (anti-fragmentation)
  useEffect(() => {
    if (communityName.length >= 3 && communityType) {
      const similar = checkSimilarCommunities(communityName, communityType as CommunityType);
      if (similar.length > 0 && similar[0].similarity >= 50) {
        setNameWarning(
          `Similar community exists: "${similar[0].name}" (${similar[0].members.toLocaleString()} members)`
        );
      } else {
        setNameWarning(null);
      }
    } else {
      setNameWarning(null);
    }
  }, [communityName, communityType]);

  const canCreate =
    communityName.length >= 3 &&
    communityType &&
    icon &&
    (!isSubCommunity || parentCommunity);

  const handleCreate = async () => {
    if (!canCreate || !communityType) return;

    // Check for high similarity before creating
    const similar = checkSimilarCommunities(communityName, communityType as CommunityType);
    if (similar.length > 0 && similar[0].similarity >= 70) {
      setSimilarCommunities(similar);
      setShowSimilarModal(true);
      return;
    }

    // Proceed with creation
    await proceedWithCreation();
  };

  const proceedWithCreation = async () => {
    if (!communityType) return;

    const result = await createCommunity({
      name: communityName,
      icon,
      type: communityType as CommunityType,
      description,
      privacy,
      parentId: isSubCommunity ? parentCommunity?.id : undefined,
    });

    if (result.success && result.communityId) {
      setShowSimilarModal(false);
      navigation.replace("CommunityHub", { communityId: result.communityId });
    } else if (result.similarCommunities) {
      setSimilarCommunities(result.similarCommunities);
      setShowSimilarModal(true);
    }
  };

  const handleJoinExisting = (communityId: string) => {
    setShowSimilarModal(false);
    navigation.replace("CommunityHub", { communityId });
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
              <Text style={styles.headerTitle}>Create Community</Text>
              <Text style={styles.headerSubtitle}>
                Build your savings community
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Sub-community Toggle */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setIsSubCommunity(!isSubCommunity)}
            >
              <View style={styles.toggleContent}>
                <View style={[styles.toggleIcon, isSubCommunity && styles.toggleIconActive]}>
                  <Text style={styles.toggleEmoji}>🔗</Text>
                </View>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>Create as sub-community</Text>
                  <Text style={styles.toggleSubtitle}>Nest under an existing community</Text>
                </View>
              </View>

              <View style={[styles.toggle, isSubCommunity && styles.toggleActive]}>
                <View style={[styles.toggleThumb, isSubCommunity && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            {/* Parent Community Selection */}
            {isSubCommunity && (
              <View style={styles.parentSelection}>
                <Text style={styles.parentLabel}>Select parent community</Text>
                <View style={styles.parentList}>
                  {parentCommunities.map((comm) => (
                    <TouchableOpacity
                      key={comm.id}
                      style={[
                        styles.parentOption,
                        parentCommunity?.id === comm.id && styles.parentOptionActive,
                      ]}
                      onPress={() => setParentCommunity(comm)}
                    >
                      <Text style={styles.parentOptionIcon}>{comm.icon}</Text>
                      <Text style={styles.parentOptionName}>{comm.name}</Text>
                      {parentCommunity?.id === comm.id && (
                        <Ionicons name="checkmark" size={18} color="#00C6AE" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Community Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Community Details</Text>

            {/* Icon Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Community Icon</Text>
              <TouchableOpacity
                style={[styles.iconButton, icon && styles.iconButtonSelected]}
                onPress={() => setShowIconPicker(!showIconPicker)}
              >
                <Text style={styles.iconButtonText}>{icon || "➕"}</Text>
              </TouchableOpacity>

              {showIconPicker && (
                <View style={styles.iconPicker}>
                  {iconOptions.map((emoji, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.iconOption,
                        icon === emoji && styles.iconOptionActive,
                      ]}
                      onPress={() => {
                        setIcon(emoji);
                        setShowIconPicker(false);
                      }}
                    >
                      <Text style={styles.iconOptionText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Community Name</Text>
              <TextInput
                style={[styles.input, nameWarning && styles.inputWarning]}
                placeholder={
                  isSubCommunity && parentCommunity
                    ? `e.g., ${parentCommunity.name.split(" ")[0]} in Atlanta`
                    : "e.g., Ivorian in Atlanta"
                }
                placeholderTextColor="#9CA3AF"
                value={communityName}
                onChangeText={setCommunityName}
              />
              {nameWarning && (
                <View style={styles.warningBanner}>
                  <Ionicons name="alert-circle" size={16} color="#D97706" />
                  <Text style={styles.warningText}>{nameWarning}</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Description <Text style={styles.inputLabelOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="What is this community about?"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Community Type Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Community Type</Text>

            {communityTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeOption,
                  communityType === type.id && styles.typeOptionActive,
                ]}
                onPress={() => setCommunityType(type.id)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <View style={styles.typeText}>
                  <Text style={styles.typeLabel}>{type.label}</Text>
                  <Text style={styles.typeDescription}>{type.description}</Text>
                </View>
                {communityType === type.id && (
                  <Ionicons name="checkmark" size={20} color="#00C6AE" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Privacy Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Privacy</Text>

            <View style={styles.privacyOptions}>
              {[
                {
                  id: "public" as const,
                  label: "Public",
                  icon: "🌍",
                  desc: "Anyone can discover and join",
                },
                {
                  id: "private" as const,
                  label: "Private",
                  icon: "🔒",
                  desc: "Invite only, hidden from search",
                },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.privacyOption,
                    privacy === opt.id && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy(opt.id)}
                >
                  <Text style={styles.privacyIcon}>{opt.icon}</Text>
                  <Text style={styles.privacyLabel}>{opt.label}</Text>
                  <Text style={styles.privacyDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canCreate || isLoading}
        >
          <Text
            style={[
              styles.createButtonText,
              !canCreate && styles.createButtonTextDisabled,
            ]}
          >
            {isLoading ? "Creating..." : "Create Community"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Similar Communities Modal (Anti-fragmentation) */}
      <Modal
        visible={showSimilarModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSimilarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="information-circle" size={28} color="#D97706" />
              </View>
              <Text style={styles.modalTitle}>Similar Community Found</Text>
              <Text style={styles.modalSubtitle}>
                We found existing communities similar to "{communityName}". Consider joining one of these instead to strengthen the community.
              </Text>
            </View>

            <ScrollView style={styles.similarList}>
              {similarCommunities.map((similar) => (
                <View key={similar.id} style={styles.similarCard}>
                  <View style={styles.similarInfo}>
                    <View style={styles.similarTop}>
                      <Text style={styles.similarIcon}>{similar.icon}</Text>
                      <View style={styles.similarText}>
                        <Text style={styles.similarName}>{similar.name}</Text>
                        <Text style={styles.similarMembers}>
                          {similar.members.toLocaleString()} members
                        </Text>
                      </View>
                      <View style={styles.similarityBadge}>
                        <Text style={styles.similarityText}>{similar.similarity}% match</Text>
                      </View>
                    </View>
                    <View style={styles.matchReasons}>
                      {similar.matchReasons.map((reason, idx) => (
                        <View key={idx} style={styles.matchReason}>
                          <Ionicons name="checkmark-circle" size={12} color="#00C6AE" />
                          <Text style={styles.matchReasonText}>{reason}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.joinExistingButton}
                    onPress={() => handleJoinExisting(similar.id)}
                  >
                    <Text style={styles.joinExistingText}>Join This Community</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.createAnywayButton}
                onPress={proceedWithCreation}
              >
                <Text style={styles.createAnywayText}>Create New Anyway</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowSimilarModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleIconActive: {
    backgroundColor: "#F0FDFB",
  },
  toggleEmoji: {
    fontSize: 20,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  toggleSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    padding: 2,
  },
  toggleActive: {
    backgroundColor: "#00C6AE",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  parentSelection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  parentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 10,
  },
  parentList: {
    gap: 8,
  },
  parentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  parentOptionActive: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  parentOptionIcon: {
    fontSize: 24,
  },
  parentOptionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  inputLabelOptional: {
    fontWeight: "400",
    color: "#6B7280",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0A2342",
  },
  inputWarning: {
    borderColor: "#D97706",
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
  },
  iconButton: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonSelected: {
    backgroundColor: "#F0FDFB",
    borderStyle: "solid",
    borderColor: "#00C6AE",
  },
  iconButtonText: {
    fontSize: 40,
  },
  iconPicker: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOptionActive: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  iconOptionText: {
    fontSize: 20,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  typeOptionActive: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  typeIcon: {
    fontSize: 24,
  },
  typeText: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  typeDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  privacyOptions: {
    flexDirection: "row",
    gap: 10,
  },
  privacyOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  privacyOptionActive: {
    borderWidth: 2,
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  privacyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  privacyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  privacyDesc: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
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
  createButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  createButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  createButtonTextDisabled: {
    color: "#9CA3AF",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  similarList: {
    padding: 20,
    maxHeight: 300,
  },
  similarCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  similarInfo: {
    marginBottom: 12,
  },
  similarTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  similarIcon: {
    fontSize: 32,
  },
  similarText: {
    flex: 1,
  },
  similarName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  similarMembers: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  similarityBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  similarityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  matchReasons: {
    gap: 6,
  },
  matchReason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  matchReasonText: {
    fontSize: 12,
    color: "#6B7280",
  },
  joinExistingButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  joinExistingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalActions: {
    padding: 20,
    paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  createAnywayButton: {
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  createAnywayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
});
