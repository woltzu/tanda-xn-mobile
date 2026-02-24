import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useFeed, FeedVisibility } from "../context/FeedContext";
import { useSavings, SavingsGoal } from "../context/SavingsContext";
import { useCircles, Circle } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";
import VisibilityPicker from "../components/VisibilityPicker";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";

// ============================================
// Types
// ============================================

type PostSource = "goal" | "circle" | "new_dream";
type Step = "choose_source" | "select_item" | "compose";

const DREAM_CATEGORIES = [
  { id: "home", emoji: "\u{1F3E0}", label: "Home" },
  { id: "education", emoji: "\u{1F4DA}", label: "Education" },
  { id: "travel", emoji: "\u{2708}\u{FE0F}", label: "Travel" },
  { id: "vehicle", emoji: "\u{1F697}", label: "Vehicle" },
  { id: "business", emoji: "\u{1F4BC}", label: "Business" },
  { id: "family", emoji: "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}", label: "Family" },
  { id: "health", emoji: "\u{1F3E5}", label: "Health" },
  { id: "other", emoji: "\u{2728}", label: "Other" },
];

// ============================================
// Main Component
// ============================================

export default function CreateDreamPostScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getActiveGoals } = useSavings();
  const { myCircles } = useCircles();
  const { createDreamPost } = useFeed();

  // Flow state
  const [step, setStep] = useState<Step>("choose_source");
  const [source, setSource] = useState<PostSource | null>(null);

  // Selected item
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  // Compose state
  const [caption, setCaption] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<FeedVisibility>("public");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New dream fields
  const [dreamTitle, setDreamTitle] = useState("");
  const [dreamAmount, setDreamAmount] = useState("");
  const [dreamCategory, setDreamCategory] = useState<string | null>(null);

  const activeGoals = getActiveGoals();

  // ============================================
  // Navigation Handlers
  // ============================================

  const handleSourceSelect = (src: PostSource) => {
    setSource(src);
    if (src === "new_dream") {
      setStep("compose");
    } else {
      setStep("select_item");
    }
  };

  const handleGoalSelect = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    const progress = Math.round((goal.currentBalance / goal.targetAmount) * 100);
    setCaption(`${progress}% of the way to ${goal.name}! \u{1F4AA}`);
    setStep("compose");
  };

  const handleCircleSelect = (circle: Circle) => {
    setSelectedCircle(circle);
    setCaption(`Saving together in ${circle.name}! \u{1F91D}`);
    setStep("compose");
  };

  const handleBack = () => {
    if (step === "compose" && source !== "new_dream") {
      setStep("select_item");
      if (source === "goal") setSelectedGoal(null);
      if (source === "circle") setSelectedCircle(null);
      setCaption("");
    } else if (step === "compose" && source === "new_dream") {
      setStep("choose_source");
      setSource(null);
      setDreamTitle("");
      setDreamAmount("");
      setDreamCategory(null);
    } else if (step === "select_item") {
      setStep("choose_source");
      setSource(null);
    } else {
      navigation.goBack();
    }
  };

  // ============================================
  // Image Picker
  // ============================================

  const pickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.type === "video") {
          showToast("Video selected (up to 60s)", "info");
        }
      }
    } catch (err) {
      console.error("Media picker error:", err);
      Alert.alert("Error", "Could not open media picker");
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split(".").pop()?.split("?")[0] || "jpg";
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("feed-images")
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (error) {
        console.warn("[Upload] Storage error (bucket may not exist):", error.message);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("feed-images")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err) {
      console.warn("[Upload] Image upload failed:", err);
      return null;
    }
  };

  // ============================================
  // Submit
  // ============================================

  const handleSubmit = async () => {
    if (isSubmitting) return;

    let content = caption.trim();
    let amount: number | undefined;
    let metadata: Record<string, any> = {};
    let relatedId: string | undefined;
    let relatedType: string | undefined;

    if (source === "goal" && selectedGoal) {
      const progress = Math.round((selectedGoal.currentBalance / selectedGoal.targetAmount) * 100);
      if (!content) content = `Saving for ${selectedGoal.name}! ${progress}% there!`;
      amount = selectedGoal.currentBalance;
      metadata = {
        goalName: selectedGoal.name,
        goalEmoji: selectedGoal.emoji,
        goalType: selectedGoal.type,
        currentBalance: selectedGoal.currentBalance,
        targetAmount: selectedGoal.targetAmount,
        progress,
        interestEarned: selectedGoal.interestEarned,
      };
      relatedId = selectedGoal.id;
      relatedType = "savings_goal";
    } else if (source === "circle" && selectedCircle) {
      if (!content) content = `Saving together in ${selectedCircle.name}!`;
      amount = selectedCircle.amount;
      metadata = {
        circleName: selectedCircle.name,
        circleEmoji: selectedCircle.emoji,
        circleType: selectedCircle.type,
        memberCount: selectedCircle.memberCount,
        currentMembers: selectedCircle.currentMembers,
        contributionAmount: selectedCircle.amount,
        frequency: selectedCircle.frequency,
        progress: selectedCircle.progress,
      };
      relatedId = selectedCircle.id;
      relatedType = "circle";
    } else if (source === "new_dream") {
      if (!dreamTitle.trim()) {
        Alert.alert("Missing Title", "Give your dream a name!");
        return;
      }
      if (!content) content = dreamTitle.trim();
      amount = dreamAmount ? parseFloat(dreamAmount) : undefined;
      metadata = {
        dreamTitle: dreamTitle.trim(),
        dreamCategory,
        dreamCategoryEmoji: DREAM_CATEGORIES.find((c) => c.id === dreamCategory)?.emoji || "\u{2728}",
      };
    }

    if (!content) {
      Alert.alert("Missing Content", "Add a caption to your post!");
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload image if selected
      let imageUrl: string | undefined;
      if (imageUri) {
        const uploaded = await uploadImage(imageUri);
        if (uploaded) {
          imageUrl = uploaded;
        }
      }

      await createDreamPost(content, imageUrl, amount, visibility, metadata, relatedId, relatedType);
      showToast("Dream posted successfully! \u{2728}", "success");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", "Failed to create post. Please try again.");
      console.error("Error creating post:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    source === "new_dream"
      ? dreamTitle.trim().length > 0
      : selectedGoal !== null || selectedCircle !== null;

  // ============================================
  // Header
  // ============================================

  const headerTitle =
    step === "choose_source"
      ? "Share a Dream"
      : step === "select_item"
        ? source === "goal"
          ? "Select Goal"
          : "Select Circle"
        : "Compose Post";

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            {step === "choose_source" ? (
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            ) : (
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {step === "compose" ? (
            <TouchableOpacity
              style={[styles.postButton, (!canSubmit || isSubmitting) && styles.postButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 70 }} />
          )}
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map((i) => {
            const stepIndex = ["choose_source", "select_item", "compose"].indexOf(step);
            const isActive = i <= stepIndex || (source === "new_dream" && i <= 2 && stepIndex >= 0);
            return (
              <View
                key={i}
                style={[styles.stepDot, isActive && styles.stepDotActive]}
              />
            );
          })}
        </View>

        {/* ============================================ */}
        {/* STEP 1: Choose Source */}
        {/* ============================================ */}
        {step === "choose_source" && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>What would you like to share?</Text>
            <Text style={styles.stepSubtitle}>
              Connect your post to real financial activity
            </Text>

            {/* Goal Source */}
            <TouchableOpacity
              style={styles.sourceCard}
              onPress={() => handleSourceSelect("goal")}
              activeOpacity={0.7}
            >
              <View style={[styles.sourceIconWrap, { backgroundColor: "#D1FAE5" }]}>
                <Text style={styles.sourceEmoji}>{"\u{1F3AF}"}</Text>
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceTitle}>My Savings Goal</Text>
                <Text style={styles.sourceDescription}>
                  Share progress on a savings goal
                </Text>
                {activeGoals.length > 0 && (
                  <Text style={styles.sourceCount}>
                    {activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Circle Source */}
            <TouchableOpacity
              style={styles.sourceCard}
              onPress={() => handleSourceSelect("circle")}
              activeOpacity={0.7}
            >
              <View style={[styles.sourceIconWrap, { backgroundColor: "#EEF2FF" }]}>
                <Text style={styles.sourceEmoji}>{"\u{1F91D}"}</Text>
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceTitle}>My Circle</Text>
                <Text style={styles.sourceDescription}>
                  Share your circle savings journey
                </Text>
                {myCircles.length > 0 && (
                  <Text style={styles.sourceCount}>
                    {myCircles.length} circle{myCircles.length !== 1 ? "s" : ""}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* New Dream Source */}
            <TouchableOpacity
              style={styles.sourceCard}
              onPress={() => handleSourceSelect("new_dream")}
              activeOpacity={0.7}
            >
              <View style={[styles.sourceIconWrap, { backgroundColor: "#FEF3C7" }]}>
                <Text style={styles.sourceEmoji}>{"\u{2728}"}</Text>
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceTitle}>New Dream</Text>
                <Text style={styles.sourceDescription}>
                  Share a new dream or aspiration
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ============================================ */}
        {/* STEP 2A: Select Goal */}
        {/* ============================================ */}
        {step === "select_item" && source === "goal" && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Select a Savings Goal</Text>
            {activeGoals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>{"\u{1F3AF}"}</Text>
                <Text style={styles.emptyTitle}>No Active Goals</Text>
                <Text style={styles.emptyText}>
                  Create a savings goal first to share your progress!
                </Text>
              </View>
            ) : (
              activeGoals.map((goal) => {
                const progress = Math.round(
                  (goal.currentBalance / goal.targetAmount) * 100
                );
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={styles.itemCard}
                    onPress={() => handleGoalSelect(goal)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemEmoji}>{goal.emoji}</Text>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{goal.name}</Text>
                        <Text style={styles.itemSubtext}>
                          ${goal.currentBalance.toLocaleString()} / $
                          {goal.targetAmount.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.progressBadge}>
                        <Text style={styles.progressBadgeText}>{progress}%</Text>
                      </View>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.min(progress, 100)}%` },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ============================================ */}
        {/* STEP 2B: Select Circle */}
        {/* ============================================ */}
        {step === "select_item" && source === "circle" && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Select a Circle</Text>
            {myCircles.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>{"\u{1F91D}"}</Text>
                <Text style={styles.emptyTitle}>No Circles Yet</Text>
                <Text style={styles.emptyText}>
                  Join or create a savings circle to share your journey!
                </Text>
              </View>
            ) : (
              myCircles.map((circle) => (
                <TouchableOpacity
                  key={circle.id}
                  style={styles.itemCard}
                  onPress={() => handleCircleSelect(circle)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemEmoji}>{circle.emoji}</Text>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{circle.name}</Text>
                      <Text style={styles.itemSubtext}>
                        {circle.currentMembers}/{circle.memberCount} members{" "}
                        {"\u00B7"} ${circle.amount}/{circle.frequency}
                      </Text>
                    </View>
                    <View style={styles.progressBadge}>
                      <Text style={styles.progressBadgeText}>{circle.progress}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(circle.progress, 100)}%` },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {/* ============================================ */}
        {/* STEP 3: Compose Post */}
        {/* ============================================ */}
        {step === "compose" && (
          <ScrollView
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Preview Card — Goal */}
            {source === "goal" && selectedGoal && (() => {
              const progress = Math.round(
                (selectedGoal.currentBalance / selectedGoal.targetAmount) * 100
              );
              return (
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewEmoji}>{selectedGoal.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewTitle}>{selectedGoal.name}</Text>
                      <Text style={styles.previewAmount}>
                        ${selectedGoal.currentBalance.toLocaleString()} of $
                        {selectedGoal.targetAmount.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(progress, 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.previewProgress}>{progress}% complete</Text>
                </View>
              );
            })()}

            {/* Preview Card — Circle */}
            {source === "circle" && selectedCircle && (
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewEmoji}>{selectedCircle.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewTitle}>{selectedCircle.name}</Text>
                    <Text style={styles.previewAmount}>
                      ${selectedCircle.amount}/{selectedCircle.frequency} {"\u00B7"}{" "}
                      {selectedCircle.currentMembers} members
                    </Text>
                  </View>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(selectedCircle.progress, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.previewProgress}>
                  {selectedCircle.progress}% of cycle complete
                </Text>
              </View>
            )}

            {/* New Dream Fields */}
            {source === "new_dream" && (
              <>
                <TextInput
                  style={styles.dreamTitleInput}
                  placeholder="Name your dream..."
                  placeholderTextColor={colors.textSecondary}
                  value={dreamTitle}
                  onChangeText={setDreamTitle}
                  maxLength={100}
                  autoFocus
                />

                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Target Amount (optional)</Text>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      value={dreamAmount}
                      onChangeText={setDreamAmount}
                    />
                  </View>
                </View>

                <Text style={styles.categoryLabel}>Category</Text>
                <View style={styles.categoryGrid}>
                  {DREAM_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        dreamCategory === cat.id && styles.categoryChipActive,
                      ]}
                      onPress={() => setDreamCategory(cat.id)}
                    >
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          styles.categoryText,
                          dreamCategory === cat.id && styles.categoryTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Photo Picker */}
            <TouchableOpacity style={styles.photoButton} onPress={pickMedia} activeOpacity={0.7}>
              {imageUri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: imageUri }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => setImageUri(null)}
                  >
                    <Ionicons name="close-circle" size={26} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="videocam-outline" size={24} color={colors.accentTeal} />
                  <Text style={styles.photoText}>Add Photo or Video</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Caption */}
            <TextInput
              style={styles.captionInput}
              placeholder={
                source === "new_dream"
                  ? "Tell the community about your dream..."
                  : "Add a caption to your post..."
              }
              placeholderTextColor={colors.textSecondary}
              multiline
              value={caption}
              onChangeText={setCaption}
              maxLength={500}
            />
            <Text style={styles.charCount}>{caption.length}/500</Text>

            {/* Visibility */}
            <View style={styles.visibilitySection}>
              <VisibilityPicker selected={visibility} onChange={setVisibility} />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  postButton: {
    backgroundColor: colors.accentTeal,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minWidth: 70,
    alignItems: "center",
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.accentTeal,
    width: 24,
  },

  content: {
    flex: 1,
    padding: spacing.lg,
  },

  // Step titles
  stepTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  // Source cards (Step 1)
  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sourceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  sourceEmoji: {
    fontSize: 22,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  sourceDescription: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sourceCount: {
    fontSize: typography.caption,
    color: colors.accentTeal,
    fontWeight: typography.semibold,
    marginTop: 4,
  },

  // Item cards (Step 2 — goals/circles)
  itemCard: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  itemEmoji: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  itemSubtext: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressBadge: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  progressBadgeText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 3,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },

  // Preview card (Step 3 — selected goal/circle)
  previewCard: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.tealTintBg,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  previewEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  previewTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  previewAmount: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  previewProgress: {
    fontSize: typography.labelSmall,
    color: colors.accentTeal,
    fontWeight: typography.semibold,
    marginTop: spacing.sm,
    textAlign: "right",
  },

  // New Dream fields
  dreamTitleInput: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colors.accentTeal,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  amountRow: {
    marginBottom: spacing.lg,
  },
  amountLabel: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
  },
  dollarSign: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.sectionHeader,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  categoryLabel: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.tealTintBg,
    borderColor: colors.accentTeal,
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  categoryText: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  categoryTextActive: {
    color: colors.accentTeal,
    fontWeight: typography.semibold,
  },

  // Photo picker
  photoButton: {
    marginBottom: spacing.lg,
  },
  photoPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  photoText: {
    fontSize: typography.body,
    color: colors.accentTeal,
    fontWeight: typography.semibold,
    marginLeft: spacing.sm,
  },
  photoPreview: {
    position: "relative",
    borderRadius: radius.card,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: 200,
    borderRadius: radius.card,
  },
  photoRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 13,
  },

  // Caption
  captionInput: {
    fontSize: typography.body,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
    lineHeight: 22,
    backgroundColor: colors.screenBg,
    borderRadius: radius.small,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  charCount: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: "right",
    marginBottom: spacing.lg,
  },

  // Visibility
  visibilitySection: {
    marginTop: spacing.sm,
  },
});
