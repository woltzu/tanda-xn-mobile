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
//   5. "More options ▾" disclosure → visibility, location.
//   6. Post → optimistic insert with `image_upload_status = 'pending'`
//      (or `'completed'` if no image), navigation back, and a
//      fire-and-forget background upload that PATCHes the row via
//      updateDreamPostImage / markDreamPostImageFailed when it settles.
//      A failed upload surfaces a "Retry upload" pill on the post card
//      (FeedPostCard) — see FeedContext + migration 150.
//
// CDP Bucket A (2026-06-21):
//   • A.1 Debounced AsyncStorage draft (caption + attachment + media +
//         visibility + location). Restored-pill UI with discard confirm.
//   • A.2 Image downscale to 1600px via expo-image-manipulator before
//         the upload kicks off (mirrors CreateEventScreen).
//   • A.3 Inline ImageStatusPill on the picker — idle / uploading /
//         uploaded / failed + Retry / Skip. The status survives until
//         the user navigates away.
//   • A.4 hashtagsText field is dropped; the server-side
//         extract_hashtags trigger (migration 159) is the only source
//         of truth. A static tip replaces the input.
//   • A.5 createDreamPost no longer accepts an `amount` arg.
//
// Shared image helpers come from utils/image.ts (downscale + bucket
// upload). The retry path stashes the local URI in AsyncStorage keyed by
// post id so the author can re-upload without re-picking.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { useFeed, FeedVisibility, FeedPost } from "../context/FeedContext";
import { useSavings, SavingsGoal } from "../context/SavingsContext";
import { useCircles, Circle } from "../context/CirclesContext";
import { showToast } from "../components/Toast";
import { uploadToBucket } from "../utils/image";
import { colors } from "../theme/tokens";

// ══════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════

const FEED_IMAGES_BUCKET = "feed-images";
const RETRY_URI_KEY_PREFIX = "@tandaxn_dream_post_retry_uri:";

// CDP Bucket A.1 — draft saving.
const DRAFT_KEY_PREFIX = "@tandaxn_dream_post_draft_v1:";
const DRAFT_DEBOUNCE_MS = 500;

// CDP Bucket A.2 — image downscaling target.
const MAX_IMAGE_WIDTH_PX = 1600;

type AttachKind = "goal" | "circle";

// CDP Bucket A.3 — upload state machine for the inline status pill.
type ImageUploadState = "idle" | "uploading" | "uploaded" | "failed";

// CDP Bucket A.1 — serialised draft shape. Only the fields the user
// can hand-edit; not the upload state or the preview-only metadata.
type DraftV1 = {
  v: 1;
  caption: string;
  mediaUri: string | null;
  visibility: FeedVisibility;
  location: string;
  selectedGoalId: string | null;
  selectedCircleId: string | null;
};

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

// CDP Bucket A.2 — downscale phone-camera shots before the background
// upload. Falls back to the original URI on any manipulator error so a
// downscale failure never blocks the post.
async function downscaleIfLarge(uri: string): Promise<string> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_WIDTH_PX } }],
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return out.uri;
  } catch {
    return uri;
  }
}

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
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  // UI state
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [attachKind, setAttachKind] = useState<AttachKind>("goal");
  const [moreOpen, setMoreOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // CDP Bucket A.3 — upload status machine for the inline pill.
  // Tracks the most-recent upload attempt for the currently-staged
  // image (pre-submit) AND the in-flight background upload after
  // submit. publishedPostIdRef is the post we should patch when a
  // post-submit Retry succeeds.
  const [uploadStatus, setUploadStatus] = useState<ImageUploadState>("idle");
  const publishedPostIdRef = useRef<string | null>(null);

  // CDP Bucket A.1 — draft hydration / save guards.
  const [draftRestored, setDraftRestored] = useState(false);
  const hydratedRef = useRef(false);
  const publishedRef = useRef(false);
  const draftKey = user?.id ? DRAFT_KEY_PREFIX + user.id : null;

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

  // ── CDP Bucket A.1 — hydrate the draft once goals + circles load ────
  // We defer hydration until the goal / circle lists are populated so a
  // saved selectedGoalId can resolve to the live SavingsGoal object on
  // the first paint, instead of a flash-no-attachment frame.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!draftKey) return;
    if (activeGoals.length === 0 && activeCircles.length === 0) {
      // Nothing to resolve against; still try to hydrate text fields.
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (cancelled || !raw) {
          hydratedRef.current = true;
          return;
        }
        const draft = JSON.parse(raw) as DraftV1;
        if (draft.v !== 1) {
          hydratedRef.current = true;
          return;
        }
        const hasContent =
          (draft.caption?.length ?? 0) > 0 ||
          !!draft.mediaUri ||
          (draft.location?.length ?? 0) > 0 ||
          !!draft.selectedGoalId ||
          !!draft.selectedCircleId;
        if (!hasContent) {
          hydratedRef.current = true;
          return;
        }
        setCaption(draft.caption ?? "");
        setMediaUri(draft.mediaUri ?? null);
        setVisibility(draft.visibility ?? "public");
        setLocation(draft.location ?? "");
        if (draft.selectedGoalId) {
          const g = activeGoals.find((x) => x.id === draft.selectedGoalId);
          if (g) setSelectedGoal(g);
        }
        if (draft.selectedCircleId) {
          const c = activeCircles.find((x) => x.id === draft.selectedCircleId);
          if (c) setSelectedCircle(c);
        }
        setDraftRestored(true);
      } catch {
        // Corrupt draft → ignore and continue.
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey, activeGoals, activeCircles]);

  // ── CDP Bucket A.1 — debounced save. Skips writes until hydration
  // has happened so we don't overwrite an existing draft with a fresh
  // blank state on the first render.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!draftKey) return;
    if (publishedRef.current) return;
    const handle = setTimeout(() => {
      const draft: DraftV1 = {
        v: 1,
        caption,
        mediaUri,
        visibility,
        location,
        selectedGoalId: selectedGoal?.id ?? null,
        selectedCircleId: selectedCircle?.id ?? null,
      };
      const hasContent =
        caption.length > 0 ||
        !!mediaUri ||
        location.length > 0 ||
        !!selectedGoal ||
        !!selectedCircle;
      if (hasContent) {
        AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {});
      } else {
        AsyncStorage.removeItem(draftKey).catch(() => {});
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [
    draftKey,
    caption,
    mediaUri,
    visibility,
    location,
    selectedGoal,
    selectedCircle,
  ]);

  const handleDiscardDraft = useCallback(() => {
    Alert.alert(
      t("create_dream.draft_discard_title"),
      t("create_dream.draft_discard_body"),
      [
        { text: t("create_dream.draft_keep"), style: "cancel" },
        {
          text: t("create_dream.draft_discard_confirm"),
          style: "destructive",
          onPress: () => {
            setCaption("");
            setMediaUri(null);
            setVisibility("public");
            setLocation("");
            setSelectedGoal(null);
            setSelectedCircle(null);
            setUploadStatus("idle");
            setDraftRestored(false);
            if (draftKey) {
              AsyncStorage.removeItem(draftKey).catch(() => {});
            }
          },
        },
      ],
    );
  }, [t, draftKey]);

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
  // CDP Bucket A.2 — downscale picked URI to MAX_IMAGE_WIDTH_PX before
  // it lands in state. The status pill resets to idle on each pick so a
  // prior "failed" badge doesn't ghost into the new selection.
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
        const downscaled = await downscaleIfLarge(result.assets[0].uri);
        setMediaUri(downscaled);
        setUploadStatus("idle");
      }
    } finally {
      setPicking(false);
    }
  };

  // CDP Bucket A.3 — × remove on the image preview. Clears the staged
  // image and resets the status pill.
  const handleRemoveImage = () => {
    setMediaUri(null);
    setUploadStatus("idle");
  };

  // CDP Bucket A.3 — Retry hookup for the failed-upload pill. If the
  // post has already been published (publishedPostIdRef set), re-kick
  // the background upload against that post; otherwise it's a no-op
  // since pre-submit "failure" can't happen (uploads only start after
  // publish).
  const handleRetryUpload = () => {
    if (!mediaUri || !user?.id) return;
    const postId = publishedPostIdRef.current;
    if (!postId) return;
    setUploadStatus("uploading");
    kickOffUpload(postId, mediaUri, user.id, {
      updateDreamPostImage,
      markDreamPostImageFailed,
      onStatus: setUploadStatus,
      t,
    });
  };

  // Skip = drop the local URI from state AND clear the published post's
  // pending status so the FeedPostCard stops showing a Retry chip.
  const handleSkipUpload = () => {
    const postId = publishedPostIdRef.current;
    if (postId) {
      markDreamPostImageFailed(postId).catch(() => undefined);
      AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + postId).catch(() => {});
    }
    setMediaUri(null);
    setUploadStatus("idle");
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
  // CDP Bucket A.4 — hashtags are no longer collected here; the
  // server-side extract_hashtags trigger reads them out of `content`
  // on INSERT, so any metadata.hashtags we sent would be ignored
  // anyway. The static tip below the caption explains the convention.
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
    return m;
  }, [mediaUri, selectedGoal, selectedCircle, location]);

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

    // CDP Bucket A.1 — publish succeeded. Mark published so the save
    // effect doesn't race a final write, and clear the draft.
    publishedRef.current = true;
    if (draftKey) {
      AsyncStorage.removeItem(draftKey).catch(() => {});
    }

    publishedPostIdRef.current = createdPost.id;

    // Navigate back immediately — the upload runs in the background.
    showToast(
      hasImage
        ? t("create_dream.success_toast_with_image")
        : t("create_dream.success_toast"),
      "success",
    );
    navigation.goBack();

    if (hasImage && mediaUri) {
      setUploadStatus("uploading");
      // Best-effort: stash the local URI so a retry can re-upload without
      // re-picking. Swallow AsyncStorage errors — they're non-fatal.
      AsyncStorage.setItem(
        RETRY_URI_KEY_PREFIX + createdPost.id,
        mediaUri,
      ).catch(() => {});
      kickOffUpload(createdPost.id, mediaUri, user.id, {
        updateDreamPostImage,
        markDreamPostImageFailed,
        onStatus: setUploadStatus,
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
          {/* CDP Bucket A.1 — restored-draft banner. */}
          {draftRestored && (
            <View style={styles.draftPill}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#0A2342"
              />
              <Text style={styles.draftPillText}>
                {t("create_dream.draft_restored")}
              </Text>
              <TouchableOpacity
                onPress={handleDiscardDraft}
                accessibilityRole="button"
              >
                <Text style={styles.draftPillDiscardText}>
                  {t("create_dream.draft_discard_btn")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
          {/* CDP Bucket A.4 — replaces the dropped hashtagsText input.
              The server-side extract_hashtags trigger reads tokens out
              of `content` on INSERT, so a separate field would just be
              ignored. */}
          <Text style={styles.hashtagTip}>
            {t("create_dream.hashtag_tip")}
          </Text>

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
              <View style={styles.mediaPreviewWrap}>
                <Image
                  source={{ uri: mediaUri }}
                  style={styles.mediaPreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={[
                    styles.mediaRemoveBtn,
                    uploadStatus === "uploading" && { opacity: 0.5 },
                  ]}
                  onPress={handleRemoveImage}
                  disabled={uploadStatus === "uploading"}
                  accessibilityRole="button"
                  accessibilityLabel={t("create_dream.media_remove_a11y")}
                >
                  <Ionicons name="close" size={16} color={colors.textWhite} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.mediaBtn}
                onPress={handlePickImage}
                disabled={picking || uploadStatus === "uploading"}
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

          {/* CDP Bucket A.3 — inline upload-status pill. Idle is a no-op;
              other states paint a status bar with Retry / Skip when
              the upload has failed. */}
          {mediaUri && uploadStatus !== "idle" ? (
            <ImageStatusPill
              status={uploadStatus}
              onRetry={handleRetryUpload}
              onSkip={handleSkipUpload}
              t={t}
            />
          ) : null}

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
//
// CDP Bucket A.3 — onStatus lets the inline pill on this screen track
// the upload while the user is still here (most of the time the user
// has already navigated back; the callback is a no-op once the screen
// unmounts, but cheap to keep).
// ══════════════════════════════════════════════════════════════════════════

function kickOffUpload(
  postId: string,
  localUri: string,
  userId: string,
  deps: {
    updateDreamPostImage: (id: string, url: string) => Promise<void>;
    markDreamPostImageFailed: (id: string) => Promise<void>;
    onStatus: (status: ImageUploadState) => void;
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
      deps.onStatus("failed");
      return;
    }
    try {
      await deps.updateDreamPostImage(postId, publicUrl);
      AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + postId).catch(() => {});
      deps.onStatus("uploaded");
    } catch {
      await deps.markDreamPostImageFailed(postId);
      deps.onStatus("failed");
    }
  })().catch(() => {
    deps.markDreamPostImageFailed(postId).catch(() => {});
    deps.onStatus("failed");
  });
}

// ══════════════════════════════════════════════════════════════════════════
// ImageStatusPill — CDP Bucket A.3
// ══════════════════════════════════════════════════════════════════════════
// Mirrors the CreateEventScreen pattern. Idle is filtered out by the
// caller so the pill only renders for the meaningful states.

function ImageStatusPill({
  status,
  onRetry,
  onSkip,
  t,
}: {
  status: ImageUploadState;
  onRetry: () => void;
  onSkip: () => void;
  t: (key: string, opts?: any) => string;
}) {
  if (status === "uploading") {
    return (
      <View style={[styles.uploadPill, styles.uploadPillUploading]}>
        <ActivityIndicator size="small" color={colors.primaryNavy} />
        <Text style={styles.uploadPillText}>
          {t("create_dream.image_uploading")}
        </Text>
      </View>
    );
  }
  if (status === "uploaded") {
    return (
      <View style={[styles.uploadPill, styles.uploadPillUploaded]}>
        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
        <Text style={styles.uploadPillText}>
          {t("create_dream.image_uploaded")}
        </Text>
      </View>
    );
  }
  // failed
  return (
    <View style={[styles.uploadPill, styles.uploadPillFailed]}>
      <Ionicons name="alert-circle" size={14} color="#DC2626" />
      <Text style={[styles.uploadPillText, { flex: 1 }]}>
        {t("create_dream.image_upload_failed_short")}
      </Text>
      <TouchableOpacity onPress={onRetry} accessibilityRole="button">
        <Text style={styles.uploadPillAction}>
          {t("create_dream.image_retry")}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} accessibilityRole="button">
        <Text style={styles.uploadPillActionMuted}>
          {t("create_dream.image_skip")}
        </Text>
      </TouchableOpacity>
    </View>
  );
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

  // CDP Bucket A.1 — restored-draft pill
  draftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  draftPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
  },
  draftPillDiscardText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryNavy,
    textDecorationLine: "underline",
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

  // CDP Bucket A.4 — hashtag tip below caption
  hashtagTip: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 6,
    paddingHorizontal: 2,
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
  mediaPreviewWrap: {
    position: "relative",
    marginBottom: 8,
  },
  mediaPreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.screenBg,
  },
  // CDP Bucket A.3 — × remove pill overlaid on the image preview.
  mediaRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(10,35,66,0.7)",
    alignItems: "center",
    justifyContent: "center",
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

  // CDP Bucket A.3 — upload pill
  uploadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
  },
  uploadPillUploading: {
    backgroundColor: "#F3F4F6",
    borderColor: colors.border,
  },
  uploadPillUploaded: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  uploadPillFailed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#DC2626",
  },
  uploadPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  uploadPillAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
    textDecorationLine: "underline",
  },
  uploadPillActionMuted: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textDecorationLine: "underline",
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
