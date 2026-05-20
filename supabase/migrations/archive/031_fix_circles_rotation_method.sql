-- ============================================
-- Migration 031: Fix circles.rotation_method CHECK constraint
-- Finds and drops ALL check constraints on rotation_method
-- regardless of name, then adds the correct one.
-- ============================================

-- Step 1: Drop ALL check constraints that reference rotation_method on circles
-- (the constraint name may differ from what we expect)
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'circles'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'  -- check constraints only
      AND pg_get_constraintdef(con.oid) ILIKE '%rotation_method%'
  LOOP
    EXECUTE format('ALTER TABLE circles DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;
END $$;

-- Step 2: Add the correct constraint with all values the app uses
ALTER TABLE circles
  ADD CONSTRAINT circles_rotation_method_check
  CHECK (rotation_method IN (
    'random', 'xnscore', 'manual', 'beneficiary',
    'auction', 'sequential', 'need_based'
  ));
