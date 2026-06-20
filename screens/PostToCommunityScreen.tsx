// ══════════════════════════════════════════════════════════════════════════════
// screens/PostToCommunityScreen.tsx — Community post composer
// ══════════════════════════════════════════════════════════════════════════════
//
// Post to Community Bucket A (2026-06-20). The legacy screen wrote to the
// dead `community_posts` table with a 4-tile type picker that no consumer
// rendered. This rewrite:
//
//   - Drops the type picker. The body becomes a single "What's on your mind?"
//     input. Title remains optional.
//   - Routes the insert through FeedContext.createDreamPost(..., type:'community'),
//     landing in the live `feed_posts` pipeline that DreamFeed already uses.
//   - Adds an image picker copied from CreateDreamPostScreen: permission,
//     launch, preview with remove button, optimistic insert with
//     image_upload_status='pending', and fire-and-forget background upload
//     that PATCHes the row via updateDreamPostImage / markDreamPostImageFailed.
//   - Localises the previously hardcoded visibility-info line (line 165 in
//     the legacy version).
//
// Retry-on-failure: same pattern as Dream Post — the local URI is stashed in
// AsyncStorage keyed by post id so a future Retry affordance on FeedPostCard
// can re-upload without re-picking.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { useFeed, FeedPost } from "../context/FeedContext";
import { showToast } from "../components/Toast";
import { uploadToBucket } from "../utils/image";

const FEED_IMAGES_BUCKET = "feed-images";
// Shares the dream-post retry URI namespace — a FeedPostCard retry handler
// keyed off `post.id` will find either type's stashed local URI.
const RETRY_URI_KEY_PREFIX = "@tandaxn_dream_post_retry_uri:";

const MAX_BODY = 2000;
const MAX_TITLE = 100;

export default function PostToCommunityScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { createDreamPost, updateDreamPostImage, markDreamPostImageFailed } =
    useFeed();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Image picker ────────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          t("post_to_community.image_perm_title"),
          t("post_to_community.image_perm_body"),
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

  const handleRemoveImage = () => setMediaUri(null);

  // ── Post submission (optimistic insert + background upload) ────────────────
  const handlePost = async () => {
    if (submitting) return;
    const trimmed = body.trim();
    if (!trimmed) {
      Alert.alert(
        t("post_to_community.alert_required_title"),
        t("post_to_community.alert_required_body"),
      );
      return;
    }
    if (!user?.id) {
      Alert.alert(
        t("post_to_community.alert_error_title"),
        t("post_to_community.alert_failed_post"),
      );
      return;
    }

    setSubmitting(true);
    const hasImage = !!mediaUri;
    const metadata: Record<string, any> = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle) metadata.title = trimmedTitle;
    if (hasImage) metadata.mediaType = "image";

    let createdPost: FeedPost;
    try {
      createdPost = await createDreamPost(
        trimmed,
        undefined,
        undefined,
        "public",
        metadata,
        undefined,
        undefined,
        hasImage ? "pending" : "completed",
        "community",
      );
    } catch (err: any) {
      setSubmitting(false);
      Alert.alert(
        t("post_to_community.alert_error_title"),
        err?.message ?? t("post_to_community.alert_failed_post"),
      );
      return;
    }

    showToast(t("post_to_community.alert_posted_body"), "success");
    navigation.goBack();

    if (hasImage && mediaUri) {
      AsyncStorage.setItem(
        RETRY_URI_KEY_PREFIX + createdPost.id,
        mediaUri,
      ).catch(() => undefined);
      kickOffUpload(createdPost.id, mediaUri, user.id, {
        updateDreamPostImage,
        markDreamPostImageFailed,
      });
    }
  };

  const canPost = body.trim().length > 0 && !submitting;
  const charCount = body.length;
  const showCharCount = charCount > MAX_BODY - 200;
  const charCountColor = charCount > MAX_BODY - 50 ? "#EF4444" : "#9CA3AF";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("post_to_community.header_title")}
          </Text>
          <TouchableOpacity
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!canPost}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>
                {t("post_to_community.btn_post")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Title (optional) */}
          <TextInput
            style={styles.titleInput}
            placeholder={t("post_to_community.placeholder_title")}
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={MAX_TITLE}
          />

          {/* Body */}
          <TextInput
            style={styles.bodyInput}
            placeholder={t("post_to_community.body_placeholder")}
            placeholderTextColor="#9CA3AF"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={MAX_BODY}
            textAlignVertical="top"
            autoFocus
          />

          {showCharCount && (
            <Text style={[styles.charCount, { color: charCountColor }]}>
              {charCount}/{MAX_BODY}
            </Text>
          )}

          {/* Image preview + remove */}
          {mediaUri ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: mediaUri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.imageRemoveBtn}
                onPress={handleRemoveImage}
                accessibilityRole="button"
                accessibilityLabel={t("post_to_community.image_remove")}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addImageBtn}
              onPress={handlePickImage}
              disabled={picking}
              accessibilityRole="button"
            >
              {picking ? (
                <ActivityIndicator size="small" color="#00C6AE" />
              ) : (
                <Ionicons name="image-outline" size={20} color="#00C6AE" />
              )}
              <Text style={styles.addImageText}>
                {t("post_to_community.image_add")}
              </Text>
            </TouchableOpacity>
          )}

          {/* Visibility info */}
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#6B7280"
            />
            <Text style={styles.infoText}>
              {t("post_to_community.visibility_info")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Background upload helper ───────────────────────────────────────────────────
// Same shape as CreateDreamPostScreen's kickOffUpload — copied inline rather
// than extracted to a util so each composer screen owns its own upload path
// while still pointing at the shared `feed-images` bucket and the shared
// FeedContext patch functions.

function kickOffUpload(
  postId: string,
  localUri: string,
  userId: string,
  deps: {
    updateDreamPostImage: (id: string, url: string) => Promise<void>;
    markDreamPostImageFailed: (id: string) => Promise<void>;
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
      AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + postId).catch(() => undefined);
    } catch {
      await deps.markDreamPostImageFailed(postId);
    }
  })().catch(() => {
    deps.markDreamPostImageFailed(postId).catch(() => undefined);
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  postButton: {
    backgroundColor: "#00C6AE",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 64,
    alignItems: "center",
  },
  postButtonDisabled: { opacity: 0.4 },
  postButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  content: { flex: 1, padding: 20 },

  titleInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    fontWeight: "600",
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  bodyInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 160,
  },
  charCount: { fontSize: 12, textAlign: "right", marginTop: 4, marginBottom: 4 },

  addImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#00C6AE55",
    borderStyle: "dashed",
    marginTop: 12,
    alignSelf: "flex-start",
  },
  addImageText: { fontSize: 14, fontWeight: "600", color: "#00C6AE" },

  imageWrap: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  imagePreview: { width: "100%", height: 240, backgroundColor: "#E5E7EB" },
  imageRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoText: { flex: 1, fontSize: 13, color: "#6B7280", lineHeight: 18 },
});
