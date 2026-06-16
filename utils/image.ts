// ══════════════════════════════════════════════════════════════════════════════
// utils/image.ts — shared image helpers (downscale + upload).
// ══════════════════════════════════════════════════════════════════════════════
//
// Extracted from CreateEventScreen so CreateDreamPostScreen (and any future
// uploader) shares one downscale + storage-upload implementation. Resizes
// to MAX_IMAGE_WIDTH_PX preserving aspect ratio, encodes JPEG at the given
// quality, and uploads to the configured Supabase Storage bucket.
//
// Both helpers are best-effort: `downscaleIfLarge` returns the original URI
// on any manipulator failure; `uploadToBucket` returns `{ error }` so
// callers (which run optimistic flows) can mark the row's
// `image_upload_status = 'failed'` without crashing the screen.

import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../lib/supabase";

const MAX_IMAGE_WIDTH_PX = 1600;

export async function downscaleIfLarge(uri: string): Promise<string> {
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

export type UploadResult = {
  publicUrl: string | null;
  error: string | null;
};

export async function uploadToBucket(
  localUri: string,
  userId: string,
  bucket: string,
): Promise<UploadResult> {
  try {
    const downscaled = await downscaleIfLarge(localUri);
    const resp = await fetch(downscaled);
    const blob = await resp.blob();
    const extMatch = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(downscaled);
    const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
    const ts = `${Math.floor(Math.random() * 1e9)}-${Math.floor(Math.random() * 1e9)}`;
    const path = `${userId}/${ts}.${ext}`;
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: false });
    if (upErr) return { publicUrl: null, error: upErr.message };

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { publicUrl: data.publicUrl, error: null };
  } catch (e: any) {
    return { publicUrl: null, error: e?.message ?? "unknown" };
  }
}
