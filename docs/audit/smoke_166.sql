SELECT 'bucket' AS k, id || ':public=' || public::text AS v
  FROM storage.buckets WHERE id='avatars'
UNION ALL
SELECT 'policy', tablename || '/' || cmd || ':' || policyname
  FROM pg_policies
 WHERE schemaname='storage' AND policyname LIKE 'avatars_%'
UNION ALL
SELECT 'registry', version || ' ' || name
  FROM supabase_migrations.schema_migrations
 WHERE version='166'
ORDER BY 1, 2;
