// ══════════════════════════════════════════════════════════════════════════════
// HOOKS: Media Upload
// ══════════════════════════════════════════════════════════════════════════════
// Image/video picking and upload, entity media retrieval
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  MediaUploadService,
  type UploadResult,
  type BucketName,
} from '../services/MediaUploadService';

// Re-export types for consumer convenience
export type { UploadResult, BucketName };

// Internal type for media records returned by entity queries
export type MediaRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  bucket: BucketName;
  file_path: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  1. useMediaUpload — Pick, upload, and delete media files               │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simulate upload progress (0-100)
  const simulateProgress = useCallback(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const pickAndUploadImage = useCallback(async (
    bucket: BucketName,
    options?: { allowsEditing?: boolean; quality?: number },
  ): Promise<UploadResult | null> => {
    try {
      setError(null);
      const ImagePicker = await import('expo-image-picker');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options?.allowsEditing ?? true,
        quality: options?.quality ?? 0.8,
      });

      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'photo.jpg',
      };

      setUploading(true);
      const stopProgress = simulateProgress();

      const uploadResult = await MediaUploadService.upload(bucket, file);
      stopProgress();
      setProgress(100);
      setLastResult(uploadResult);
      return uploadResult;
    } catch (err: any) {
      console.error('pickAndUploadImage error:', err);
      setError(err.message || 'Failed to upload image');
      return null;
    } finally {
      setUploading(false);
    }
  }, [simulateProgress]);

  const pickAndUploadVideo = useCallback(async (
    bucket: BucketName,
    options?: { allowsEditing?: boolean; quality?: number },
  ): Promise<UploadResult | null> => {
    try {
      setError(null);
      const ImagePicker = await import('expo-image-picker');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: options?.allowsEditing ?? true,
        quality: options?.quality ?? 0.8,
      });

      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        type: asset.mimeType || 'video/mp4',
        name: asset.fileName || 'video.mp4',
      };

      setUploading(true);
      const stopProgress = simulateProgress();

      const uploadResult = await MediaUploadService.upload(bucket, file);
      stopProgress();
      setProgress(100);
      setLastResult(uploadResult);
      return uploadResult;
    } catch (err: any) {
      console.error('pickAndUploadVideo error:', err);
      setError(err.message || 'Failed to upload video');
      return null;
    } finally {
      setUploading(false);
    }
  }, [simulateProgress]);

  const uploadFile = useCallback(async (
    bucket: BucketName,
    file: { uri: string; type: string; name: string },
    _options?: Record<string, unknown>,
  ): Promise<UploadResult | null> => {
    try {
      setError(null);
      setUploading(true);
      const stopProgress = simulateProgress();

      const uploadResult = await MediaUploadService.upload(bucket, file);
      stopProgress();
      setProgress(100);
      setLastResult(uploadResult);
      return uploadResult;
    } catch (err: any) {
      console.error('uploadFile error:', err);
      setError(err.message || 'Failed to upload file');
      return null;
    } finally {
      setUploading(false);
    }
  }, [simulateProgress]);

  const deleteFile = useCallback(async (bucket: BucketName, filePath: string) => {
    try {
      setError(null);
      await MediaUploadService.deleteFile(bucket, filePath);
    } catch (err: any) {
      console.error('deleteFile error:', err);
      setError(err.message || 'Failed to delete file');
      throw err;
    }
  }, []);

  return {
    uploading, progress, lastResult, error,
    pickAndUploadImage, pickAndUploadVideo, uploadFile, deleteFile,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  2. useEntityMedia — Media records for a given entity                   │
// └──────────────────────────────────────────────────────────────────────────┘

export function useEntityMedia(entityType: string, entityId?: string) {
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const data = await MediaUploadService.getMediaForEntity(entityType, entityId);
      setMedia(data);
    } catch (err) {
      console.error('useEntityMedia error:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const hasMedia = media.length > 0;

  return { media, loading, refresh: fetch, hasMedia };
}
