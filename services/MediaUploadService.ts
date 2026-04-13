// ══════════════════════════════════════════════════════════════════════════════
// MediaUploadService — Handles all media uploads to Supabase Storage
// Images, videos, documents for trips, providers, and verification
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface UploadResult {
  success: boolean;
  url: string | null;
  filePath: string | null;
  error: string | null;
  fileSize: number;
  fileType: string;
}

export interface MediaRecord {
  id: string;
  userId: string;
  bucket: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  url: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export type BucketName = 'trip-covers' | 'provider-photos' | 'verification-docs' | 'trip-media';

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapMediaRecord(row: any): MediaRecord {
  return {
    id: row.id,
    userId: row.user_id,
    bucket: row.bucket,
    filePath: row.file_path,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    url: row.url,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
  };
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const DEFAULT_IMAGE_MAX_MB = 10;
const DEFAULT_VIDEO_MAX_MB = 100;
const DEFAULT_DOCUMENT_MAX_MB = 25;

// ══════════════════════════════════════════════════════════════════════════════
// MEDIA UPLOAD SERVICE
// ══════════════════════════════════════════════════════════════════════════════

export class MediaUploadService {

  // ═══════════════════════════════════════════════════════════════════════════
  // UPLOAD METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Upload an image to the specified storage bucket */
  static async uploadImage(
    bucket: BucketName,
    file: { uri: string; type: string; name: string },
    options?: { entityType?: string; entityId?: string; maxSizeMB?: number }
  ): Promise<UploadResult> {
    try {
      // Validate file type
      if (!IMAGE_TYPES.includes(file.type.toLowerCase())) {
        return {
          success: false,
          url: null,
          filePath: null,
          error: `Invalid image type: ${file.type}. Accepted: ${IMAGE_TYPES.join(', ')}`,
          fileSize: 0,
          fileType: file.type,
        };
      }

      // Read the file from URI
      const response = await fetch(file.uri);
      const blob = await response.blob();

      // Validate file size
      const maxMB = options?.maxSizeMB ?? DEFAULT_IMAGE_MAX_MB;
      if (!MediaUploadService._validateFileSize(blob.size, maxMB)) {
        return {
          success: false,
          url: null,
          filePath: null,
          error: `File too large: ${(blob.size / (1024 * 1024)).toFixed(1)}MB exceeds ${maxMB}MB limit`,
          fileSize: blob.size,
          fileType: file.type,
        };
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Generate unique path and upload
      const filePath = MediaUploadService._generateFilePath(user.id, file.name);
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      // Get public URL
      const url = MediaUploadService.getPublicUrl(bucket, filePath);

      // Create media record
      await supabase.from("media_uploads").insert({
        user_id: user.id,
        bucket,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: blob.size,
        url,
        entity_type: options?.entityType,
        entity_id: options?.entityId,
      });

      return {
        success: true,
        url,
        filePath,
        error: null,
        fileSize: blob.size,
        fileType: file.type,
      };
    } catch (err: any) {
      return {
        success: false,
        url: null,
        filePath: null,
        error: err.message ?? "Image upload failed",
        fileSize: 0,
        fileType: file.type,
      };
    }
  }

  /** Upload a video to the specified storage bucket */
  static async uploadVideo(
    bucket: BucketName,
    file: { uri: string; type: string; name: string },
    options?: { entityType?: string; entityId?: string; maxSizeMB?: number }
  ): Promise<UploadResult> {
    try {
      // Validate file type
      if (!VIDEO_TYPES.includes(file.type.toLowerCase())) {
        return {
          success: false,
          url: null,
          filePath: null,
          error: `Invalid video type: ${file.type}. Accepted: ${VIDEO_TYPES.join(', ')}`,
          fileSize: 0,
          fileType: file.type,
        };
      }

      // Read the file from URI
      const response = await fetch(file.uri);
      const blob = await response.blob();

      // Validate file size
      const maxMB = options?.maxSizeMB ?? DEFAULT_VIDEO_MAX_MB;
      if (!MediaUploadService._validateFileSize(blob.size, maxMB)) {
        return {
          success: false,
          url: null,
          filePath: null,
          error: `File too large: ${(blob.size / (1024 * 1024)).toFixed(1)}MB exceeds ${maxMB}MB limit`,
          fileSize: blob.size,
          fileType: file.type,
        };
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Generate unique path and upload
      const filePath = MediaUploadService._generateFilePath(user.id, file.name);
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      // Get public URL
      const url = MediaUploadService.getPublicUrl(bucket, filePath);

      // Create media record
      await supabase.from("media_uploads").insert({
        user_id: user.id,
        bucket,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: blob.size,
        url,
        entity_type: options?.entityType,
        entity_id: options?.entityId,
      });

      return {
        success: true,
        url,
        filePath,
        error: null,
        fileSize: blob.size,
        fileType: file.type,
      };
    } catch (err: any) {
      return {
        success: false,
        url: null,
        filePath: null,
        error: err.message ?? "Video upload failed",
        fileSize: 0,
        fileType: file.type,
      };
    }
  }

  /** Upload a verification document (always to verification-docs bucket) */
  static async uploadDocument(
    file: { uri: string; type: string; name: string },
    options?: { entityType?: string; entityId?: string; maxSizeMB?: number }
  ): Promise<UploadResult> {
    try {
      // Validate file type
      if (!DOCUMENT_TYPES.includes(file.type.toLowerCase())) {
        return {
          success: false,
          url: null,
          filePath: null,
          error: `Invalid document type: ${file.type}. Accepted: ${DOCUMENT_TYPES.join(', ')}`,
          fileSize: 0,
          fileType: file.type,
        };
      }

      // Read the file from URI
      const response = await fetch(file.uri);
      const blob = await response.blob();

      // Validate file size
      const maxMB = options?.maxSizeMB ?? DEFAULT_DOCUMENT_MAX_MB;
      if (!MediaUploadService._validateFileSize(blob.size, maxMB)) {
        return {
          success: false,
          url: null,
          filePath: null,
          error: `File too large: ${(blob.size / (1024 * 1024)).toFixed(1)}MB exceeds ${maxMB}MB limit`,
          fileSize: blob.size,
          fileType: file.type,
        };
      }

      const bucket: BucketName = 'verification-docs';

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Generate unique path and upload
      const filePath = MediaUploadService._generateFilePath(user.id, file.name);
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      // Get public URL
      const url = MediaUploadService.getPublicUrl(bucket, filePath);

      // Create media record
      await supabase.from("media_uploads").insert({
        user_id: user.id,
        bucket,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: blob.size,
        url,
        entity_type: options?.entityType,
        entity_id: options?.entityId,
      });

      return {
        success: true,
        url,
        filePath,
        error: null,
        fileSize: blob.size,
        fileType: file.type,
      };
    } catch (err: any) {
      return {
        success: false,
        url: null,
        filePath: null,
        error: err.message ?? "Document upload failed",
        fileSize: 0,
        fileType: file.type,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE & QUERY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Delete a media file from storage and its database record */
  static async deleteMedia(bucket: BucketName, filePath: string): Promise<boolean> {
    try {
      // Remove from storage
      const { error: storageErr } = await supabase.storage
        .from(bucket)
        .remove([filePath]);
      if (storageErr) throw storageErr;

      // Remove database record
      await supabase
        .from("media_uploads")
        .delete()
        .eq("bucket", bucket)
        .eq("file_path", filePath);

      return true;
    } catch {
      return false;
    }
  }

  /** Get all media records for a specific entity (e.g., a trip or provider) */
  static async getMediaForEntity(entityType: string, entityId: string): Promise<MediaRecord[]> {
    const { data, error } = await supabase
      .from("media_uploads")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapMediaRecord);
  }

  /** Get all media records for a user, optionally filtered by bucket */
  static async getUserMedia(userId: string, bucket?: BucketName): Promise<MediaRecord[]> {
    let query = supabase
      .from("media_uploads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (bucket) {
      query = query.eq("bucket", bucket);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapMediaRecord);
  }

  /** Get the public URL for a file in a bucket */
  static getPublicUrl(bucket: BucketName, filePath: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Generate a unique file path: {userId}/{timestamp}-{random}.{ext} */
  static _generateFilePath(userId: string, fileName: string): string {
    const ext = MediaUploadService._getFileExtension(fileName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${userId}/${timestamp}-${random}.${ext}`;
  }

  /** Validate that the file size is within the allowed limit */
  static _validateFileSize(sizeBytes: number, maxMB: number): boolean {
    const maxBytes = maxMB * 1024 * 1024;
    return sizeBytes <= maxBytes;
  }

  /** Extract the file extension from a filename */
  static _getFileExtension(fileName: string): string {
    const parts = fileName.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
  }
}
