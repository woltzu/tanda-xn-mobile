-- Check moderation_actions.action CHECK constraint
SELECT pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  JOIN pg_class r ON r.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
 WHERE n.nspname='public'
   AND r.relname='moderation_actions'
   AND c.contype='c';
