-- ============================================
-- Migration 029: Create feed-images storage bucket
-- Enables video/photo uploads for dream posts
-- ============================================

-- Step 1: Create the feed-images bucket (public, 50MB limit, media types only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed-images',
  'feed-images',
  true,
  52428800, -- 50MB for video support
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'
  ];

-- Step 2: RLS policies for the feed-images bucket (idempotent)

-- Anyone can VIEW files (bucket is public)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Anyone can view feed images'
      AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Anyone can view feed images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'feed-images');
  END IF;
END $$;

-- Authenticated users can UPLOAD to their own folder (user_id/filename)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can upload feed images'
      AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload feed images"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'feed-images'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Users can UPDATE their own files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can update their own feed images'
      AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Users can update their own feed images"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'feed-images'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Users can DELETE their own files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can delete their own feed images'
      AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Users can delete their own feed images"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'feed-images'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
