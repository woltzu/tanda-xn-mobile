-- ============================================
-- Migration 031: Fix circles.rotation_method CHECK constraint
-- Adds 'manual' and 'beneficiary' to allowed values
-- (app sends these from CreateCircleScheduleScreen)
-- ============================================

-- Drop existing constraint if it exists
ALTER TABLE circles DROP CONSTRAINT IF EXISTS circles_rotation_method_check;

-- Re-add with all values the app uses:
--   random       - Fair random selection
--   xnscore      - Highest XnScore goes first
--   manual       - Admin assigns order
--   beneficiary  - One-time / family support / disaster relief
--   auction      - Members bid for position
--   sequential   - Fixed order
--   need_based   - Highest need goes first
ALTER TABLE circles
  ADD CONSTRAINT circles_rotation_method_check
  CHECK (rotation_method IN (
    'random', 'xnscore', 'manual', 'beneficiary',
    'auction', 'sequential', 'need_based'
  ));
