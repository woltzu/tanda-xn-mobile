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
import { useCommunity, Community } from "../context/CommunityContext";
import { useAuth } from "../context/AuthContext";
import VisibilityPicker from "../components/VisibilityPicker";
import VideoPlayer from "../components/VideoPlayer";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";

// ============================================
// Types
// ============================================

type PostSource = "goal" | "circle" | "new_dream";
type Step = "choose_source" | "select_item" | "compose" | "review";
type MediaType = "image" | "video" | null;

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
  const { myCommunities } = useCommunity();
  const { createDreamPost } = useFeed();

  // Flow state
  const [step, setStep] = useState<Step>("choose_source");
  const [source, setSource] = useState<PostSource | null>(null);

  // Selected item
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  // Compose state
  const [caption, setCaption] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null); // Captured at pick time
  const [visibility, setVisibility] = useState<FeedVisibility>("public");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tagging state
  const [selectedCommunities, setSelectedCommunities] = useState<Community[]>([]);
  const [location, setLocation] = useState("");
  const [hashtags, setHashtags] = useState("");

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
    if (step === "review") {
      setStep("compose");
    } else if (step === "compose" && source !== "new_dream") {
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
  // Media Picker
  // ============================================

  const pickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        aspect: [9, 16], // Portrait-first (TikTok-style)
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setMediaUri(asset.uri);
        const type: MediaType = asset.type === "video" ? "video" : "image";
        setMediaType(type);

        // Immediately capture the blob at pick time to prevent web blob URL revocation.
        // On web, blob URLs can be garbage-collected before upload time → empty file.
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          if (blob.size > 0) {
            setMediaBlob(blob);
            const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
            console.log(`[Media] Captured ${type}: ${sizeMB}MB, type: ${blob.type}`);
          } else {
            console.warn("[Media] Blob is empty — file may not have been captured correctly");
            setMediaBlob(null);
          }
        } catch (blobErr) {
          console.warn("[Media] Failed to pre-capture blob:", blobErr);
          setMediaBlob(null);
        }

        showToast(
          type === "video" ? "Video selected (up to 60s)" : "Photo selected",
          "info"
        );
      }
    } catch (err) {
      console.error("Media picker error:", err);
      Alert.alert("Error", "Could not open media picker");
    }
  };

  const uploadMedia = async (uri: string): Promise<string | null> => {
    try {
      // Use pre-captured blob (from pick time) or fetch as fallback
      let blob: Blob;
      if (mediaBlob && mediaBlob.size > 0) {
        blob = mediaBlob;
        console.log(`[Upload] Using pre-captured blob: ${(blob.size / 1024 / 1024).toFixed(1)}MB`);
      } else {
        console.log("[Upload] No pre-captured blob, fetching from URI...");
        const response = await fetch(uri);
        blob = await response.blob();
      }

      // Reject empty files
      if (!blob || blob.size === 0) {
        throw new Error("File is empty (0 bytes). Please try selecting the media again.");
      }

      // Smart extension detection — handles blob URLs, data URIs, and file paths
      let fileExt: string;
      const blobType = blob.type; // e.g. "video/mp4", "image/jpeg"
      if (blobType && blobType.includes("/")) {
        const mimeExt = blobType.split("/")[1].replace("quicktime", "mov");
        fileExt = mimeExt === "jpeg" ? "jpg" : mimeExt;
      } else {
        const uriExt = uri.split(".").pop()?.split("?")[0]?.toLowerCase();
        fileExt = uriExt && uriExt.length <= 5 ? uriExt : (mediaType === "video" ? "mp4" : "jpg");
      }

      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      const videoExts = ["mp4", "mov", "avi", "m4v", "webm"];
      const isVideo = mediaType === "video" || videoExts.includes(fileExt);
      const contentType = blobType || (isVideo ? `video/${fileExt === "mov" ? "quicktime" : fileExt}` : `image/${fileExt}`);

      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      console.log(`[Upload] Uploading ${isVideo ? "video" : "image"}: ${fileName} (${contentType}, ${sizeMB}MB)`);

      const { data, error } = await supabase.storage
        .from("feed-images")
        .upload(fileName, blob, {
          contentType,
          upsert: false,
        });

      if (error) {
        console.error("[Upload] Storage error:", error.message);
        throw new Error(error.message);
      }

      const { data: urlData } = supabase.storage
        .from("feed-images")
        .getPublicUrl(data.path);

      console.log("[Upload] Success:", urlData.publicUrl);
      return urlData.publicUrl;
    } catch (err: any) {
      console.error("[Upload] Media upload failed:", err);
      throw err;
    }
  };

  // ============================================
  // Community Tag Toggle
  // ============================================

  const toggleCommunity = (community: Community) => {
    setSelectedCommunities((prev) => {
      const exists = prev.find((c) => c.id === community.id);
      if (exists) {
        return prev.filter((c) => c.id !== community.id);
      }
      return [...prev, community];
    });
  };

  // ============================================
  // Parse hashtags
  // ============================================

  const parseHashtags = (raw: string): string[] => {
    return raw
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .slice(0, 10);
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

    // Add tagging metadata
    if (mediaType) {
      metadata.mediaType = mediaType;
    }
    if (selectedCommunities.length > 0) {
      metadata.communityTags = selectedCommunities.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
      }));
    }
    const parsedTags = parseHashtags(hashtags);
    if (parsedTags.length > 0) {
      metadata.hashtags = parsedTags;
    }
    if (location.trim()) {
      metadata.location = location.trim();
    }

    try {
      setIsSubmitting(true);

      // Upload media if selected
      let imageUrl: string | undefined;
      if (mediaUri) {
        showToast(
          mediaType === "video" ? "Uploading video..." : "Uploading photo...",
          "info",
          10000
        );
        try {
          const uploaded = await uploadMedia(mediaUri);
          if (uploaded) {
            imageUrl = uploaded;
            showToast("Upload complete!", "success");
          }
        } catch (uploadErr: any) {
          // Upload failed — ask user what to do
          const errorMsg = uploadErr?.message || "Unknown error";
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Upload Failed",
              `Could not upload your ${mediaType || "media"}: ${errorMsg}\n\nPost without media?`,
              [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Post Anyway", onPress: () => resolve(true) },
              ]
            );
          });
          if (!proceed) {
            setIsSubmitting(false);
            return;
          }
          // Clear media metadata if posting without it
          delete metadata.mediaType;
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

  const canPreview = canSubmit && caption.trim().length > 0;

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
        : step === "compose"
          ? "Compose Post"
          : "Review Post";

  const stepIndex = ["choose_source", "select_item", "compose", "review"].indexOf(step);

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
          <View style={{ width: 40 }} />
        </View>

        {/* Step Indicator — 4 dots */}
        <View style={styles.stepIndicator}>
          {[0, 1, 2, 3].map((i) => {
            const isActive = i <= stepIndex || (source === "new_dream" && i >= 0 && stepIndex >= 2 && i <= stepIndex);
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
        {/* STEP 3: Compose & Tag */}
        {/* ============================================ */}
        {step === "compose" && (
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 100 }}
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

            {/* Media Picker — with Video Preview */}
            <TouchableOpacity style={styles.photoButton} onPress={pickMedia} activeOpacity={0.7}>
              {mediaUri ? (
                <View style={styles.mediaPreviewContainer}>
                  {mediaType === "video" ? (
                    <VideoPlayer
                      uri={mediaUri}
                      style={styles.mediaPreview}
                      showControls
                      thumbnailMode={false}
                    />
                  ) : (
                    <View style={styles.photoPreview}>
                      <Image source={{ uri: mediaUri }} style={styles.photoImage} />
                      <View style={styles.mediaBadge}>
                        <Ionicons name="image" size={12} color="#FFFFFF" />
                        <Text style={styles.mediaBadgeText}>PHOTO</Text>
                      </View>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => { setMediaUri(null); setMediaType(null); }}
                  >
                    <Ionicons name="close-circle" size={28} color="#FF4444" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.changeMediaBtn} onPress={pickMedia}>
                    <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                    <Text style={styles.changeMediaText}>Change</Text>
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

            {/* ---- TAGGING SECTION ---- */}
            <View style={styles.sectionDivider} />

            {/* Community Tags */}
            {myCommunities.length > 0 && (
              <View style={styles.tagSection}>
                <View style={styles.tagLabelRow}>
                  <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.tagLabel}>Tag Communities</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.tagScrollRow}
                >
                  {myCommunities.map((community) => {
                    const isSelected = selectedCommunities.some((c) => c.id === community.id);
                    return (
                      <TouchableOpacity
                        key={community.id}
                        style={[styles.communityChip, isSelected && styles.communityChipActive]}
                        onPress={() => toggleCommunity(community)}
                      >
                        <Text style={styles.communityChipIcon}>{community.icon}</Text>
                        <Text
                          style={[
                            styles.communityChipText,
                            isSelected && styles.communityChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {community.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color={colors.accentTeal} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Location */}
            <View style={styles.tagSection}>
              <View style={styles.tagInputRow}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add location (e.g. Atlanta, GA)"
                  placeholderTextColor={colors.textSecondary}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={100}
                />
              </View>
            </View>

            {/* Hashtags */}
            <View style={styles.tagSection}>
              <View style={styles.tagInputRow}>
                <Text style={styles.hashIcon}>#</Text>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add hashtags (e.g. savings, dreams)"
                  placeholderTextColor={colors.textSecondary}
                  value={hashtags}
                  onChangeText={setHashtags}
                  maxLength={200}
                />
              </View>
              {hashtags.trim().length > 0 && (
                <View style={styles.hashtagPreviewRow}>
                  {parseHashtags(hashtags).map((tag, idx) => (
                    <View key={idx} style={styles.hashtagPill}>
                      <Text style={styles.hashtagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Visibility */}
            <View style={styles.visibilitySection}>
              <VisibilityPicker selected={visibility} onChange={setVisibility} />
            </View>

            {/* Preview Post Button */}
            <TouchableOpacity
              style={[styles.previewPostBtn, !canPreview && styles.previewPostBtnDisabled]}
              onPress={() => canPreview && setStep("review")}
              disabled={!canPreview}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
              <Text style={styles.previewPostBtnText}>Preview Post</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ============================================ */}
        {/* STEP 4: Review & Post — TikTok-style */}
        {/* ============================================ */}
        {step === "review" && (
          <View style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
            >
              {/* Media Hero — capped height, with floating side actions */}
              {mediaUri && (
                <View style={styles.rvHeroWrap}>
                  {mediaType === "video" ? (
                    <VideoPlayer
                      uri={mediaUri}
                      style={styles.rvHeroMedia}
                      disableTouch
                      showControls={false}
                      aspectRatio={3 / 4}
                    />
                  ) : (
                    <Image source={{ uri: mediaUri }} style={styles.rvHeroImage} resizeMode="cover" />
                  )}

                  {/* Floating Side Actions — TandaXn Blueprint engagement */}
                  <View style={styles.rvSideActions}>
                    <View style={styles.rvSideBtn}>
                      <View style={[styles.rvSideBtnCircle, { backgroundColor: "rgba(0, 198, 174, 0.3)" }]}>
                        <Ionicons name="wallet" size={22} color={colors.accentTeal} />
                      </View>
                      <Text style={styles.rvSideBtnLabel}>I Saved</Text>
                    </View>
                    <View style={styles.rvSideBtn}>
                      <View style={styles.rvSideBtnCircle}>
                        <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.rvSideBtnLabel}>Join</Text>
                    </View>
                    <View style={styles.rvSideBtn}>
                      <View style={styles.rvSideBtnCircle}>
                        <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.rvSideBtnLabel}>Clone</Text>
                    </View>
                    {(source === "goal" || source === "circle") && (
                      <View style={styles.rvSideBtn}>
                        <View style={[styles.rvSideBtnCircle, { backgroundColor: colors.accentTeal }]}>
                          <Ionicons name="hand-left" size={18} color="#FFFFFF" />
                        </View>
                        <Text style={styles.rvSideBtnLabel}>Support</Text>
                      </View>
                    )}
                    <View style={styles.rvSideBtn}>
                      <View style={styles.rvSideBtnCircle}>
                        <Ionicons name="arrow-redo" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.rvSideBtnLabel}>Share</Text>
                    </View>
                  </View>

                  {/* Bottom overlay — author + caption on the video */}
                  <View style={styles.rvOverlayBottom}>
                    <View style={styles.rvOverlayAuthor}>
                      <View style={styles.rvOverlayAvatar}>
                        <Text style={styles.rvOverlayAvatarText}>
                          {visibility === "anonymous"
                            ? "?"
                            : (user?.name || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.rvOverlayName}>
                        {visibility === "anonymous" ? "Anonymous" : user?.name || "You"}
                      </Text>
                      <View style={styles.rvOverlayBadge}>
                        <Text style={styles.rvOverlayBadgeText}>
                          {source === "goal" ? "\u{1F3AF}" : source === "circle" ? "\u{1F91D}" : "\u{2728}"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rvOverlayCaption} numberOfLines={2}>
                      {caption}
                    </Text>
                    {location.trim().length > 0 && (
                      <View style={styles.rvOverlayLocation}>
                        <Ionicons name="location" size={12} color="#FFFFFF" />
                        <Text style={styles.rvOverlayLocationText}>{location.trim()}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* If no media — show simple text preview */}
              {!mediaUri && (
                <View style={styles.rvNoMediaCard}>
                  <View style={styles.rvOverlayAuthor}>
                    <View style={[styles.rvOverlayAvatar, { backgroundColor: colors.primaryNavy }]}>
                      <Text style={styles.rvOverlayAvatarText}>
                        {(user?.name || "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.rvOverlayName, { color: colors.textPrimary }]}>
                      {user?.name || "You"}
                    </Text>
                  </View>
                  <Text style={styles.rvNoMediaCaption}>{caption}</Text>
                </View>
              )}

              {/* Goal/Circle Detail Card — rich info below video */}
              {source === "goal" && selectedGoal && (() => {
                const p = Math.round((selectedGoal.currentBalance / selectedGoal.targetAmount) * 100);
                return (
                  <View style={styles.rvDetailCard}>
                    <View style={styles.rvDetailHeader}>
                      <Text style={styles.rvDetailEmoji}>{selectedGoal.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rvDetailTitle}>{selectedGoal.name}</Text>
                        <Text style={styles.rvDetailSubtext}>
                          ${Number(selectedGoal.currentBalance).toLocaleString()} of ${Number(selectedGoal.targetAmount).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.rvDetailPercentBadge}>
                        <Text style={styles.rvDetailPercentText}>{p}%</Text>
                      </View>
                    </View>
                    <View style={styles.rvDetailProgressBg}>
                      <View style={[styles.rvDetailProgressFill, { width: `${Math.min(p, 100)}%` }]} />
                    </View>
                  </View>
                );
              })()}

              {source === "circle" && selectedCircle && (
                <View style={styles.rvDetailCard}>
                  <View style={styles.rvDetailHeader}>
                    <Text style={styles.rvDetailEmoji}>{selectedCircle.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rvDetailTitle}>{selectedCircle.name}</Text>
                      <Text style={styles.rvDetailSubtext}>
                        {selectedCircle.currentMembers}/{selectedCircle.memberCount} members {"\u00B7"} ${selectedCircle.amount}/{selectedCircle.frequency}
                      </Text>
                    </View>
                    <View style={styles.rvDetailPercentBadge}>
                      <Text style={styles.rvDetailPercentText}>{selectedCircle.progress}%</Text>
                    </View>
                  </View>
                  <View style={styles.rvDetailProgressBg}>
                    <View style={[styles.rvDetailProgressFill, { width: `${Math.min(selectedCircle.progress, 100)}%` }]} />
                  </View>
                </View>
              )}

              {/* Community tags */}
              {selectedCommunities.length > 0 && (
                <View style={styles.rvTagsSection}>
                  {selectedCommunities.map((c) => (
                    <View key={c.id} style={styles.rvCommunityPill}>
                      <Text style={styles.rvCommunityPillIcon}>{c.icon}</Text>
                      <Text style={styles.rvCommunityPillText}>{c.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Post Details Summary */}
              <View style={styles.rvSummary}>
                <View style={styles.rvSummaryRow}>
                  <Text style={styles.rvSummaryLabel}>Visibility</Text>
                  <Text style={styles.rvSummaryValue}>
                    {visibility === "public" ? "\u{1F30D} Public" : visibility === "community" ? "\u{1F465} Community" : "\u{1F441}\u{FE0F}\u{200D}\u{1F5E8}\u{FE0F} Anonymous"}
                  </Text>
                </View>
                {mediaUri && (
                  <View style={styles.rvSummaryRow}>
                    <Text style={styles.rvSummaryLabel}>Media</Text>
                    <Text style={styles.rvSummaryValue}>
                      {mediaType === "video" ? "\u{1F3AC} Video" : "\u{1F4F7} Photo"}
                    </Text>
                  </View>
                )}
                {parseHashtags(hashtags).length > 0 && (
                  <View style={[styles.rvSummaryRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.rvSummaryLabel}>Hashtags</Text>
                    <Text style={[styles.rvSummaryValue, { color: colors.accentTeal }]}>
                      {parseHashtags(hashtags).join(" ")}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* FIXED BOTTOM — Edit & Post buttons (always visible) */}
            <View style={styles.rvFixedBottom}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setStep("compose")}
              >
                <Ionicons name="create-outline" size={18} color={colors.accentTeal} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Post Dream</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
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

  // Item cards (Step 2)
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

  // Preview card (Step 3)
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

  // Media picker
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
  mediaPreviewContainer: {
    position: "relative",
    borderRadius: radius.card,
    overflow: "hidden",
  },
  mediaPreview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
  },
  photoPreview: {
    position: "relative",
    borderRadius: radius.card,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.card,
  },
  mediaBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  mediaBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  photoRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 14,
  },
  changeMediaBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  changeMediaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
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
    marginBottom: spacing.md,
  },

  // Section divider
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },

  // Tag sections
  tagSection: {
    marginBottom: spacing.md,
  },
  tagLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.sm,
  },
  tagLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  tagScrollRow: {
    marginBottom: spacing.xs,
  },
  communityChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  communityChipActive: {
    backgroundColor: colors.tealTintBg,
    borderColor: colors.accentTeal,
  },
  communityChipIcon: {
    fontSize: 16,
  },
  communityChipText: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    maxWidth: 120,
  },
  communityChipTextActive: {
    color: colors.accentTeal,
    fontWeight: typography.semibold,
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  hashIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  tagInput: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  hashtagPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm,
  },
  hashtagPill: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  hashtagPillText: {
    fontSize: typography.caption,
    color: colors.accentTeal,
    fontWeight: typography.semibold,
  },

  // Visibility
  visibilitySection: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },

  // Preview Post button
  previewPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 16,
    gap: 8,
  },
  previewPostBtnDisabled: {
    opacity: 0.4,
  },
  previewPostBtnText: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },

  // ============================================
  // STEP 4: Review — TikTok-style
  // ============================================

  // Hero media container (full-width)
  rvHeroWrap: {
    position: "relative",
    width: "100%",
    backgroundColor: "#000000",
    marginBottom: spacing.md,
  },
  rvHeroMedia: {
    width: "100%",
    borderRadius: 0,
  },
  rvHeroImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    maxHeight: 420,
  },

  // Floating side action buttons (right side, TikTok-style)
  rvSideActions: {
    position: "absolute",
    right: 8,
    bottom: 60,
    alignItems: "center",
    gap: 10,
  },
  rvSideBtn: {
    alignItems: "center",
    gap: 2,
  },
  rvSideBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  rvSideBtnLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Bottom overlay (author + caption on the media)
  rvOverlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 60,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 40,
    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
    // RN fallback:
    backgroundColor: "transparent",
  },
  rvOverlayAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  rvOverlayAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  rvOverlayAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rvOverlayName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rvOverlayBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rvOverlayBadgeText: {
    fontSize: 12,
  },
  rvOverlayCaption: {
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 6,
  },
  rvOverlayLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  rvOverlayLocationText: {
    fontSize: 11,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rvOverlayTags: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accentTeal,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // (Progress overlay removed — detail card shown below video instead)

  // No media fallback
  rvNoMediaCard: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  rvNoMediaCaption: {
    fontSize: typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
    marginTop: spacing.md,
  },

  // Community tags below media
  rvTagsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  rvCommunityPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 4,
  },
  rvCommunityPillIcon: {
    fontSize: 12,
  },
  rvCommunityPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accentTeal,
  },

  // Summary
  rvSummary: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  rvSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rvSummaryLabel: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  rvSummaryValue: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },

  // Goal/Circle detail card below video
  rvDetailCard: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.card,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  rvDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  rvDetailEmoji: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  rvDetailTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  rvDetailSubtext: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rvDetailPercentBadge: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  rvDetailPercentText: {
    fontSize: typography.labelSmall,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  rvDetailProgressBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  rvDetailProgressFill: {
    height: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 3,
  },

  // Fixed bottom bar with Edit & Post buttons
  rvFixedBottom: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: 30,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 16,
    gap: 6,
  },
  editBtnText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 16,
    gap: 8,
  },
  submitBtnText: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
});
