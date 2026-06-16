// ══════════════════════════════════════════════════════════════════════════════
// screens/CreateDreamPostScreen.tsx — Dream-post composer (P1 single-screen rewrite)
// ══════════════════════════════════════════════════════════════════════════════
//
// Replaces the prior 4-step wizard (2,039 LoC: choose_source → select_item
// → compose → review). The new layout is one screen, optimistic-insert,
// background upload:
//
//   1. Live post-card preview at the top.
//   2. Caption input (multiline, autofocus) + 3 example-prompt chips.
//   3. "Attach a goal or circle" — opens a single sheet that lists the
//      user's active goals + circles. One tap links the post.
//   4. Media picker (image only; the prior video flow is dropped — keeping
//      the screen focused on the most-common case).
//   5. "More options ▾" disclosure → visibility, location, hashtags.
//   6. Post → optimistic insert with `image_upload_status = 'pending'`
//      (or `'completed'` if no image), navigation back, and a
//      fire-and-forget background upload that PATCHes the row via
//      updateDreamPostImage / markDreamPostImageFailed when it settles.
//      A failed upload surfaces a "Retry upload" pill on the post card
//      (FeedPostCard) — see FeedContext + migration 150.
//
// Shared image helpers come from utils/image.ts (downscale + bucket
// upload). The retry path stashes the local URI in AsyncStorage keyed by
// post id so the author can re-upload without re-picking.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { useFeed, FeedVisibility, FeedPost } from "../context/FeedContext";
import { useSavings, SavingsGoal } from "../context/SavingsContext";
import { useCircles, Circle } from "../context/CirclesContext";
import { showToast } from "../components/Toast";
import { uploadToBucket } from "../utils/image";
import { colors, radius, typography, spacing } from "../theme/tokens";

// ══════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════

const FEED_IMAGES_BUCKET = "feed-images";
const RETRY_URI_KEY_PREFIX = "@tandaxn_dream_post_retry_uri:";

type AttachKind = "goal" | "circle";

// ══════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════

export default function CreateDreamPostScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getActiveGoals } = useSavings();
  const { myCircles } = useCircles();
  const { createDreamPost, updateDreamPostImage, markDreamPostImageFailed } =
    useFeed();

  // ── Form state ────────────────────────────────────────────────────────
  const [caption, setCaption] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<FeedVisibility>("public");
  const [location, setLocation] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  // UI state
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [attachKind, setAttachKind] = useState<AttachKind>("goal");
  const [moreOpen, setMoreOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeGoals = useMemo(() => getActiveGoals(), [getActiveGoals]);

  // P2 (2026-06-14): most-recently-updated active goal. Drives the
  // "Share progress on X?" chip that pre-fills the caption + selects
  // the goal so the post lands linked. Hidden when nothing is active,
  // when the user already typed a caption, or when they've already
  // picked a goal manually.
  const suggestedGoal = useMemo<SavingsGoal | null>(() => {
    if (activeGoals.length === 0) return null;
    return [...activeGoals].sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    )[0];
  }, [activeGoals]);
  const showGoalSuggestionChip =
    suggestedGoal !== null &&
    caption.trim().length === 0 &&
    selectedGoal === null;
  const acceptGoalSuggestion = () => {
    if (!suggestedGoal) return;
    setSelectedGoal(suggestedGoal);
    setCaption(
      t("create_dream.goal_suggest_prefill", {
        goal: suggestedGoal.name,
      }),
    );
  };

  const activeCircles = useMemo(
    () => myCircles.filter((c) => c.status === "active"),
    [myCircles],
  );

  // ── Example-prompt chips ──────────────────────────────────────────────
  const promptChips = useMemo(
    () => [
      { key: "working", template: t("create_dream.chip_working_template") },
      { key: "milestone", template: t("create_dream.chip_milestone_template") },
      {
        key: "accountability",
        template: t("create_dream.chip_accountability_template"),
      },
    ],
    [t],
  );

  // ── Image picker ──────────────────────────────────────────────────────
  const handlePickImage = async () => {
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          t("create_dream.media_perm_title"),
          t("create_dream.media_perm_body"),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setMediaUri(result.assets[0].uri);
      }
    } finally {
      setPicking(false);
    }
  };

  // ── Visibility help ───────────────────────────────────────────────────
  const showVisibilityHelp = () => {
    Alert.alert(
      t("create_dream.visibility_help_title"),
      t("create_dream.visibility_help_body"),
    );
  };

  // ── Attach goal/circle sheet ──────────────────────────────────────────
  const handleAttachOpen = () => {
    setAttachKind(selectedCircle ? "circle" : "goal");
    setAttachSheetOpen(true);
  };
  const handleAttachClose = () => setAttachSheetOpen(false);
  const handlePickGoal = (g: SavingsGoal) => {
    setSelectedGoal(g);
    setSelectedCircle(null);
    setAttachSheetOpen(false);
  };
  const handlePickCircle = (c: Circle) => {
    setSelectedCircle(c);
    setSelectedGoal(null);
    setAttachSheetOpen(false);
  };
  const handleClearAttachment = () => {
    setSelectedGoal(null);
    setSelectedCircle(null);
  };

  // ── Build metadata for both the live preview and the insert payload ──
  const metadata = useMemo(() => {
    const m: Record<string, any> = {};
    if (mediaUri) m.mediaType = "image";
    if (selectedGoal) {
      m.goalName = selectedGoal.name;
      m.goalEmoji = selectedGoal.emoji;
      m.targetAmount = selectedGoal.targetAmount;
      m.currentBalance = selectedGoal.currentBalance;
    }
    if (selectedCircle) {
      m.circleId = selectedCircle.id;
      m.circleName = selectedCircle.name;
      m.circleEmoji = selectedCircle.emoji;
      // Use rough completion percent if available so the support CTA shows.
      m.progress = Math.round(
        ((selectedCircle.myPosition ?? 0) /
          Math.max(selectedCircle.memberCount, 1)) *
          100,
      );
    }
    const trimmedLocation = location.trim();
    if (trimmedLocation) m.location = trimmedLocation;
    const tags = hashtagsText
      .split(/[,\s]+/)
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean);
    if (tags.length > 0) m.hashtags = tags;
    return m;
  }, [mediaUri, selectedGoal, selectedCircle, location, hashtagsText]);

  // ── Submit (optimistic insert + background upload) ────────────────────
  const handlePost = async () => {
    if (submitting) return;
    const captionTrimmed = caption.trim();
    if (!captionTrimmed) {
      Alert.alert(
        t("create_dream.validation_caption_missing_title"),
        t("create_dream.validation_caption_missing_body"),
      );
      return;
    }
    if (!user?.id) {
      Alert.alert(
        t("create_dream.auth_required_title"),
        t("create_dream.auth_required_body"),
      );
      return;
    }

    setSubmitting(true);
    const hasImage = !!mediaUri;
    const relatedId = selectedGoal?.id ?? selectedCircle?.id;
    const relatedType = selectedGoal
      ? "goal"
      : selectedCircle
        ? "circle"
        : undefined;

    let createdPost: FeedPost;
    try {
      createdPost = await createDreamPost(
        captionTrimmed,
        undefined,
        undefined,
        visibility,
        metadata,
        relatedId,
        relatedType,
        hasImage ? "pending" : "completed",
      );
    } catch (e) {
      setSubmitting(false);
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t("create_dream.post_failed_title"), msg);
      return;
    }

    // Navigate back immediately — the upload runs in the background.
    showToast(
      hasImage
        ? t("create_dream.success_toast_with_image")
        : t("create_dream.success_toast"),
      "success",
    );
    navigation.goBack();

    if (hasImage && mediaUri) {
      // Best-effort: stash the local URI so a retry can re-upload without
      // re-picking. Swallow AsyncStorage errors — they're non-fatal.
      AsyncStorage.setItem(
        RETRY_URI_KEY_PREFIX + createdPost.id,
        mediaUri,
      ).catch(() => {});
      kickOffUpload(createdPost.id, mediaUri, user.id, {
        updateDreamPostImage,
        markDreamPostImageFailed,
        t,
      });
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════
  const previewPost = buildPreviewPost({
    user,
    caption,
    mediaUri,
    visibility,
    metadata,
    selectedGoal,
    selectedCircle,
  });

  const hasAttachment = !!selectedGoal || !!selectedCircle;
  const attachmentLabel = selectedGoal
    ? `${selectedGoal.emoji}  ${selectedGoal.name}`
    : selectedCircle
      ? `${selectedCircle.emoji}  ${selectedCircle.name}`
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.primaryNavy, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("create_dream.header_title")}
          </Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Live preview ──────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>
            {t("create_dream.preview_label")}
          </Text>
          <PostPreviewCard post={previewPost} t={t} />

          {/* ── Caption + prompt chips ────────────────────────────────── */}
          <Text style={styles.sectionLabel}>
            {t("create_dream.caption_label")}
          </Text>
          <View style={styles.chipRow}>
            {promptChips.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={styles.chip}
                onPress={() => setCaption(c.template)}
                accessibilityRole="button"
                accessibilityLabel={t(`create_dream.chip_${c.key}_label`)}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={12}
                  color={colors.accentTeal}
                />
                <Text style={styles.chipText}>
                  {t(`create_dream.chip_${c.key}_label`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* P2 (2026-06-14) — "Share progress on X?" goal-suggestion
              chip. Shown only when the user hasn't typed yet and hasn't
              already picked a goal manually. Tapping pre-fills the
              caption and selects the goal so the post lands linked. */}
          {showGoalSuggestionChip && suggestedGoal ? (
            <TouchableOpacity
              style={styles.p2GoalSuggestChip}
              onPress={acceptGoalSuggestion}
              accessibilityRole="button"
            >
              <Ionicons name="sparkles-outline" size={12} color="#0A2342" />
              <Text style={styles.p2GoalSuggestText}>
                {t("create_dream.goal_suggest_chip", {
                  goal: suggestedGoal.name,
                })}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder={t("create_dream.caption_placeholder")}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            autoFocus
          />

          {/* ── Attach goal / circle ──────────────────────────────────── */}
          <Text style={styles.sectionLabel}>
            {t("create_dream.attach_label")}
          </Text>
          {hasAttachment ? (
            <View style={styles.attachmentPill}>
              <Text style={styles.attachmentText} numberOfLines={1}>
                {attachmentLabel}
              </Text>
              <TouchableOpacity
                onPress={handleClearAttachment}
                accessibilityRole="button"
                accessibilityLabel={t("create_dream.attach_clear")}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={handleAttachOpen}
              accessibilityRole="button"
            >
              <Ionicons name="link-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.attachBtnText}>
                {t("create_dream.attach_cta")}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Media ─────────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>
            {t("create_dream.media_label")}
          </Text>
          {mediaUri ? (
            <View>
              <Image
                source={{ uri: mediaUri }}
                style={styles.mediaPreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.mediaBtn}
                onPress={handlePickImage}
                disabled={picking}
                accessibilityRole="button"
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={colors.primaryNavy}
                />
                <Text style={styles.mediaBtnText}>
                  {picking
                    ? t("create_dream.media_picking")
                    : t("create_dream.media_replace")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={handlePickImage}
              disabled={picking}
              accessibilityRole="button"
            >
              <Ionicons
                name="image-outline"
                size={16}
                color={colors.primaryNavy}
              />
              <Text style={styles.mediaBtnText}>
                {picking
                  ? t("create_dream.media_picking")
                  : t("create_dream.media_pick")}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── More options ─────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.disclosureHeader}
            onPress={() => setMoreOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: moreOpen }}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={colors.primaryNavy}
            />
            <Text style={styles.disclosureText}>
              {t("create_dream.more_options")}
            </Text>
            <Ionicons
              name={moreOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {moreOpen && (
            <View style={styles.moreCard}>
              {/* Visibility */}
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  {t("create_dream.visibility_label")}
                </Text>
                <TouchableOpacity
                  onPress={showVisibilityHelp}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    "create_dream.visibility_help_title",
                  )}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.visibilityRow}>
                {(["public", "community", "anonymous"] as FeedVisibility[]).map(
                  (v) => {
                    const isActive = visibility === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[
                          styles.visibilityChip,
                          isActive && styles.visibilityChipActive,
                        ]}
                        onPress={() => setVisibility(v)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text
                          style={[
                            styles.visibilityChipText,
                            isActive && styles.visibilityChipTextActive,
                          ]}
                        >
                          {t(`create_dream.visibility_${v}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>

              <Text style={styles.fieldLabel}>
                {t("create_dream.location_label")}
              </Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder={t("create_dream.location_placeholder")}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.fieldLabel}>
                {t("create_dream.hashtags_label")}
              </Text>
              <TextInput
                style={styles.input}
                value={hashtagsText}
                onChangeText={setHashtagsText}
                placeholder={t("create_dream.hashtags_placeholder")}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>
          )}
        </ScrollView>

        {/* ── Submit bar ─────────────────────────────────────────────── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.postBtn, submitting && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <>
                <Ionicons
                  name="paper-plane-outline"
                  size={16}
                  color={colors.textWhite}
                />
                <Text style={styles.postBtnText}>
                  {t("create_dream.submit_btn")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Attach sheet ──────────────────────────────────────────────── */}
      <Modal
        visible={attachSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={handleAttachClose}
      >
        <Pressable style={styles.sheetBackdrop} onPress={handleAttachClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {t("create_dream.attach_sheet_title")}
            </Text>

            <View style={styles.sheetSegmented}>
              <TouchableOpacity
                style={[
                  styles.sheetSegment,
                  attachKind === "goal" && styles.sheetSegmentActive,
                ]}
                onPress={() => setAttachKind("goal")}
              >
                <Text
                  style={[
                    styles.sheetSegmentText,
                    attachKind === "goal" && styles.sheetSegmentTextActive,
                  ]}
                >
                  {t("create_dream.attach_tab_goal")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sheetSegment,
                  attachKind === "circle" && styles.sheetSegmentActive,
                ]}
                onPress={() => setAttachKind("circle")}
              >
                <Text
                  style={[
                    styles.sheetSegmentText,
                    attachKind === "circle" && styles.sheetSegmentTextActive,
                  ]}
                >
                  {t("create_dream.attach_tab_circle")}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {attachKind === "goal" ? (
                activeGoals.length === 0 ? (
                  <Text style={styles.sheetEmpty}>
                    {t("create_dream.attach_empty_goals")}
                  </Text>
                ) : (
                  activeGoals.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.sheetRow}
                      onPress={() => handlePickGoal(g)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.sheetRowEmoji}>{g.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sheetRowTitle}>{g.name}</Text>
                        <Text style={styles.sheetRowSub}>
                          {t("create_dream.attach_goal_balance", {
                            current: Math.round(g.currentBalance),
                            target: Math.round(g.targetAmount),
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  ))
                )
              ) : activeCircles.length === 0 ? (
                <Text style={styles.sheetEmpty}>
                  {t("create_dream.attach_empty_circles")}
                </Text>
              ) : (
                activeCircles.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.sheetRow}
                    onPress={() => handlePickCircle(c)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.sheetRowEmoji}>{c.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetRowTitle}>{c.name}</Text>
                      <Text style={styles.sheetRowSub}>
                        {t("create_dream.attach_circle_members", {
                          n: c.memberCount,
                        })}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Background upload — fire-and-forget after the row insert. On success
// patches image_url + image_upload_status='completed'; on failure marks
// 'failed' so FeedPostCard surfaces the Retry pill (and the local URI
// stays cached in AsyncStorage for the retry handler).
// ══════════════════════════════════════════════════════════════════════════

function kickOffUpload(
  postId: string,
  localUri: string,
  userId: string,
  deps: {
    updateDreamPostImage: (id: string, url: string) => Promise<void>;
    markDreamPostImageFailed: (id: string) => Promise<void>;
    t: (key: string) => string;
  },
) {
  (async () => {
    const { publicUrl, error } = await uploadToBucket(
      localUri,
      userId,
      FEED_IMAGES_BUCKET,
    );
    if (error || !publicUrl) {
      await deps.markDreamPostImageFailed(postId);
      return;
    }
    try {
      await deps.updateDreamPostImage(postId, publicUrl);
      AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + postId).catch(() => {});
    } catch {
      await deps.markDreamPostImageFailed(postId);
    }
  })().catch(() => {
    deps.markDreamPostImageFailed(postId).catch(() => {});
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Inline preview card — a stripped-down FeedPostCard with no interactions.
// Mirrors the eventual rendering closely enough to function as a preview.
// ══════════════════════════════════════════════════════════════════════════

type PreviewInputs = {
  user: { id?: string; name?: string } | null | undefined;
  caption: string;
  mediaUri: string | null;
  visibility: FeedVisibility;
  metadata: Record<string, any>;
  selectedGoal: SavingsGoal | null;
  selectedCircle: Circle | null;
};

function buildPreviewPost(input: PreviewInputs): FeedPost {
  return {
    id: "preview",
    userId: input.user?.id ?? "preview",
    type: "dream",
    content: input.caption || "",
    imageUrl: input.mediaUri ?? undefined,
    imageUploadStatus: "completed",
    currency: "USD",
    visibility: input.visibility,
    metadata: input.metadata,
    likesCount: 0,
    commentsCount: 0,
    isAuto: false,
    createdAt: new Date(0).toISOString(),
    authorName: input.user?.name ?? "You",
    authorAvatar: undefined,
    authorXnScore: undefined,
  };
}

function PostPreviewCard({
  post,
  t,
}: {
  post: FeedPost;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const meta = post.metadata || {};
  return (
    <View style={previewStyles.card}>
      <View style={previewStyles.headerRow}>
        <View style={previewStyles.avatar}>
          <Ionicons name="person" size={16} color={colors.textWhite} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={previewStyles.author}>{post.authorName}</Text>
          <Text style={previewStyles.tagline}>
            {t("create_dream.preview_tagline")}
          </Text>
        </View>
        <View style={previewStyles.typeBadge}>
          <Text style={previewStyles.typeBadgeText}>✨ Dream</Text>
        </View>
      </View>

      <Text style={previewStyles.caption}>
        {post.content || t("create_dream.preview_caption_placeholder")}
      </Text>

      {post.imageUrl && (
        <Image
          source={{ uri: post.imageUrl }}
          style={previewStyles.image}
          resizeMode="cover"
        />
      )}

      {meta.goalName && (
        <View style={previewStyles.metaRow}>
          <Ionicons name="trophy-outline" size={14} color={colors.accentTeal} />
          <Text style={previewStyles.metaText} numberOfLines={1}>
            {meta.goalName}
          </Text>
        </View>
      )}
      {meta.circleName && (
        <View style={previewStyles.metaRow}>
          <Ionicons name="people-outline" size={14} color={colors.accentTeal} />
          <Text style={previewStyles.metaText} numberOfLines={1}>
            {meta.circleName}
          </Text>
        </View>
      )}
      {meta.location && (
        <View style={previewStyles.metaRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={previewStyles.metaText} numberOfLines={1}>
            {meta.location}
          </Text>
        </View>
      )}
      {Array.isArray(meta.hashtags) && meta.hashtags.length > 0 && (
        <View style={previewStyles.hashtagRow}>
          {meta.hashtags.map((tag: string, i: number) => (
            <Text key={i} style={previewStyles.hashtag}>
              #{tag}
            </Text>
          ))}
        </View>
      )}

      <View style={previewStyles.visibilityRow}>
        <Ionicons
          name="eye-outline"
          size={12}
          color={colors.textSecondary}
        />
        <Text style={previewStyles.visibilityText}>
          {t(`create_dream.visibility_${post.visibility}`)}
        </Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.textWhite,
    fontSize: 17,
    fontWeight: "700",
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: colors.accentTeal,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accentTeal,
  },

  // P2 — goal-suggestion chip styles
  p2GoalSuggestChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: colors.accentTeal,
    marginBottom: 8,
  },
  p2GoalSuggestText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0A2342",
  },

  captionInput: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: "top",
  },

  // Attach goal/circle
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryNavy,
    backgroundColor: colors.cardBg,
  },
  attachBtnText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 13,
  },
  attachmentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: colors.accentTeal,
  },
  attachmentText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  // Media
  mediaPreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.screenBg,
    marginBottom: 8,
  },
  mediaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryNavy,
    backgroundColor: colors.cardBg,
  },
  mediaBtnText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 13,
  },

  // Disclosure
  disclosureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclosureText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  moreCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 42,
    marginTop: 4,
  },
  visibilityRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  visibilityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
  },
  visibilityChipActive: {
    borderColor: colors.accentTeal,
    backgroundColor: "#F0FDFB",
  },
  visibilityChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  visibilityChipTextActive: { color: colors.accentTeal },

  // Submit
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accentTeal,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: {
    color: colors.textWhite,
    fontSize: 15,
    fontWeight: "700",
  },

  // Attach sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "82%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  sheetSegmented: {
    flexDirection: "row",
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  sheetSegment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  sheetSegmentActive: { backgroundColor: colors.primaryNavy },
  sheetSegmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  sheetSegmentTextActive: { color: colors.textWhite },
  sheetEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: 30,
    fontStyle: "italic",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetRowEmoji: { fontSize: 24 },
  sheetRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sheetRowSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

// Local preview styles — kept separate so the visual treatment can drift
// from the production FeedPostCard without bleeding styles back.
const previewStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  author: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  tagline: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  typeBadge: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  caption: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  metaText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  hashtag: { fontSize: 12, color: colors.accentTeal, fontWeight: "600" },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  visibilityText: { fontSize: 11, color: colors.textSecondary },
});
