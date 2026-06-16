// components/AvatarPicker.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal action sheet for uploading the user's avatar. Wraps:
//
//   1. expo-image-picker (camera OR library, requesting permissions
//      first; square crop via aspect=[1,1]).
//   2. expo-image-manipulator (resize to 512px, JPEG quality 0.7) so we
//      don't burn Storage bandwidth on multi-MB iPhone photos.
//   3. supabase.storage.from('avatars').upload (path = '<uid>.jpg',
//      upsert) — one row per user, no accumulation.
//   4. createSignedUrl (1-year expiry) so the private bucket is still
//      readable by <Image> without a fresh sign on every render.
//   5. profiles.avatar_url update.
//   6. onUpdated() callback so the caller can bust useProfile()'s cache.
//
// The "Remove" action clears profiles.avatar_url and best-effort-deletes
// the storage object. UI falls back to the initial-letter circle.
//
// Migration 166 provisioned the bucket + owner-keyed RLS. Anonymous and
// non-owner authenticated users have zero read/write capability — only
// the row's owner can SELECT / INSERT / UPDATE / DELETE.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const DANGER = "#EF4444";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year
const AVATAR_PATH = (userId: string) => `${userId}.jpg`;

export default function AvatarPicker({
  visible,
  hasExisting,
  onClose,
  onUpdated,
}: {
  visible: boolean;
  hasExisting: boolean;
  onClose: () => void;
  onUpdated: (newUrl: string | null) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [busy, setBusy] = useState<null | "pick" | "camera" | "remove">(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setBusy(null);
    setError(null);
  };

  const finish = (url: string | null) => {
    reset();
    onUpdated(url);
    onClose();
  };

  const handlePick = async (source: "library" | "camera") => {
    if (!user?.id) {
      setError(t("avatar_picker.err_no_user"));
      return;
    }
    setBusy(source === "library" ? "pick" : "camera");
    setError(null);
    try {
      // Permissions first — the picker won't open without them.
      const perm =
        source === "library"
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        setError(t("avatar_picker.err_permission_denied"));
        setBusy(null);
        return;
      }

      const picker =
        source === "library"
          ? ImagePicker.launchImageLibraryAsync
          : ImagePicker.launchCameraAsync;
      const result = await picker({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setBusy(null);
        return;
      }

      // Resize + compress before upload. 512x512 JPEG @ q=0.7 is
      // typically <60 KB — well under the Storage default cap.
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512, height: 512 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      // RN-friendly upload — Supabase's JS client accepts an ArrayBuffer
      // here. The `fetch(localUri).arrayBuffer()` round-trip works on
      // both iOS and Android (the .blob() variant can return empty on
      // Android, hence arrayBuffer).
      const arraybuffer = await fetch(manipulated.uri).then((r) =>
        r.arrayBuffer(),
      );

      const path = AVATAR_PATH(user.id);
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, arraybuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (upErr) throw upErr;

      // Bucket is private — store a long-lived signed URL so <Image>
      // can hit it without resigning per render. P2 may migrate this
      // to a path-based render-time signer.
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) {
        throw signErr ?? new Error("createSignedUrl returned empty");
      }

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: signed.signedUrl })
        .eq("id", user.id);
      if (profErr) throw profErr;

      finish(signed.signedUrl);
    } catch (e: any) {
      console.warn("[AvatarPicker] upload failed", e);
      setError(e?.message ?? t("avatar_picker.err_upload"));
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!user?.id) return;
    setBusy("remove");
    setError(null);
    try {
      const path = AVATAR_PATH(user.id);
      // Best-effort delete — if the storage row is already gone we
      // still want the profile column cleared.
      await supabase.storage.from("avatars").remove([path]).catch(() => null);
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (profErr) throw profErr;
      finish(null);
    } catch (e: any) {
      console.warn("[AvatarPicker] remove failed", e);
      setError(e?.message ?? t("avatar_picker.err_remove"));
      setBusy(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t("avatar_picker.title")}</Text>

          <Action
            icon="image-outline"
            label={t("avatar_picker.pick_library")}
            busy={busy === "pick"}
            disabled={busy !== null}
            onPress={() => handlePick("library")}
          />
          <Action
            icon="camera-outline"
            label={t("avatar_picker.take_photo")}
            busy={busy === "camera"}
            disabled={busy !== null}
            onPress={() => handlePick("camera")}
          />
          {hasExisting ? (
            <Action
              icon="trash-outline"
              label={t("avatar_picker.remove")}
              tone="danger"
              busy={busy === "remove"}
              disabled={busy !== null}
              onPress={handleRemove}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={busy ? undefined : onClose}
            disabled={busy !== null}
          >
            <Text style={styles.cancelText}>{t("avatar_picker.cancel")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Action({
  icon,
  label,
  tone,
  busy,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: "danger";
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const fg = tone === "danger" ? DANGER : NAVY;
  return (
    <TouchableOpacity
      style={[styles.action, disabled && styles.actionDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
      {busy ? <ActivityIndicator size="small" color={fg} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 12,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionDisabled: { opacity: 0.6 },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  error: {
    fontSize: 12,
    color: DANGER,
    marginTop: 8,
    marginHorizontal: 8,
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: MUTED },
});
