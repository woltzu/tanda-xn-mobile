-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 023 FIX: Interest Calculation System - Function Signature Fix
-- ══════════════════════════════════════════════════════════════════════════════
-- Fix for: ERROR 42725: function name "calculate_late_fee" is not unique
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop the GRANT statements that failed and the conflicting function signatures
-- We need to use specific signatures to drop functions

-- First, let's drop any existing calculate_late_fee functions with various signatures
DROP FUNCTION IF EXISTS calculate_late_fee(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_late_fee(INTEGER, INTEGER, UUID) CASCADE;

-- Now recreate with a unique name to avoid conflicts
-- Rename to calculate_loan_late_fee to be more specific

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LATE FEE CALCULATION (Renamed to avoid conflicts)                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION calculate_loan_late_fee(
    p_scheduled_payment_cents INTEGER,
    p_days_past_due INTEGER,
    p_loan_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
    fee_cents INTEGER,
    fee_type late_fee_type,
    flat_fee_cents INTEGER,
    percentage_fee_cents INTEGER,
    grace_period_days INTEGER,
    within_grace_period BOOLEAN
) AS $$
DECLARE
    v_grace_period INTEGER;
    v_flat_fee INTEGER;
    v_percentage DECIMAL;
    v_percentage_fee INTEGER;
    v_calc_method TEXT;
    v_product RECORD;
BEGIN
    -- Get product-specific settings if available
    IF p_loan_product_id IS NOT NULL THEN
        SELECT * INTO v_product FROM loan_products WHERE id = p_loan_product_id;
        IF FOUND THEN
            v_grace_period := v_product.grace_period_days;
            v_flat_fee := v_product.late_fee_flat_cents;
            v_percentage := v_product.late_fee_percent;
        END IF;
    END IF;

    -- Fall back to config
    IF v_grace_period IS NULL THEN
        v_grace_period := (get_interest_config('late_fee_grace_period_days'))::INTEGER;
    END IF;
    IF v_flat_fee IS NULL THEN
        v_flat_fee := (get_interest_config('late_fee_flat_cents'))::INTEGER;
    END IF;
    IF v_percentage IS NULL THEN
        v_percentage := (get_interest_config('late_fee_percentage'))::DECIMAL;
    END IF;

    v_calc_method := get_interest_config('late_fee_calculation_method')::TEXT;
    v_calc_method := TRIM(BOTH '"' FROM v_calc_method); -- Remove quotes

    -- Within grace period?
    IF p_days_past_due <= v_grace_period THEN
        RETURN QUERY SELECT
            0::INTEGER,
            'flat'::late_fee_type,
            v_flat_fee,
            0::INTEGER,
            v_grace_period,
            TRUE;
        RETURN;
    END IF;

    -- Calculate percentage fee
    v_percentage_fee := ROUND(p_scheduled_payment_cents * (v_percentage / 100))::INTEGER;

    -- Apply calculation method
    CASE v_calc_method
        WHEN 'flat' THEN
            RETURN QUERY SELECT
                v_flat_fee,
                'flat'::late_fee_type,
                v_flat_fee,
                v_percentage_fee,
                v_grace_period,
                FALSE;

        WHEN 'percentage' THEN
            RETURN QUERY SELECT
                v_percentage_fee,
                'percentage'::late_fee_type,
                v_flat_fee,
                v_percentage_fee,
                v_grace_period,
                FALSE;

        WHEN 'greater_of' THEN
            IF v_flat_fee >= v_percentage_fee THEN
                RETURN QUERY SELECT
                    v_flat_fee,
                    'flat'::late_fee_type,
                    v_flat_fee,
                    v_percentage_fee,
                    v_grace_period,
                    FALSE;
            ELSE
                RETURN QUERY SELECT
                    v_percentage_fee,
                    'percentage'::late_fee_type,
                    v_flat_fee,
                    v_percentage_fee,
                    v_grace_period,
                    FALSE;
            END IF;

        ELSE
            RETURN QUERY SELECT
                v_flat_fee,
                'flat'::late_fee_type,
                v_flat_fee,
                v_percentage_fee,
                v_grace_period,
                FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update apply_late_fee_to_loan to use the renamed function
CREATE OR REPLACE FUNCTION apply_late_fee_to_loan(
    p_loan_id UUID,
    p_scheduled_payment_id UUID,
    p_days_past_due INTEGER
)
RETURNS TABLE (
    applied BOOLEAN,
    fee_id UUID,
    fee_cents INTEGER,
    reason TEXT
) AS $$
DECLARE
    v_schedule RECORD;
    v_loan RECORD;
    v_existing_fee RECORD;
    v_fee_result RECORD;
    v_fee_id UUID;
BEGIN
    -- Get scheduled payment
    SELECT * INTO v_schedule FROM loan_payment_schedule WHERE id = p_scheduled_payment_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Scheduled payment not found';
        RETURN;
    END IF;

    -- Get loan
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;

    -- Check if fee already exists
    SELECT * INTO v_existing_fee
    FROM loan_late_fees
    WHERE scheduled_payment_id = p_scheduled_payment_id;

    IF FOUND THEN
        RETURN QUERY SELECT FALSE, v_existing_fee.id, v_existing_fee.calculated_fee_cents, 'Fee already applied';
        RETURN;
    END IF;

    -- Calculate fee using renamed function
    SELECT * INTO v_fee_result
    FROM calculate_loan_late_fee(v_schedule.total_due_cents, p_days_past_due, v_loan.loan_product_id);

    IF v_fee_result.within_grace_period THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Within grace period';
        RETURN;
    END IF;

    -- Create fee record
    INSERT INTO loan_late_fees (
        loan_id, scheduled_payment_id,
        fee_type, flat_fee_cents, percentage,
        calculated_fee_cents,
        payment_due_date, grace_period_days, days_past_due, fee_applied_date
    ) VALUES (
        p_loan_id, p_scheduled_payment_id,
        v_fee_result.fee_type, v_fee_result.flat_fee_cents,
        (get_interest_config('late_fee_percentage'))::DECIMAL,
        v_fee_result.fee_cents,
        v_schedule.due_date, v_fee_result.grace_period_days, p_days_past_due, CURRENT_DATE
    )
    RETURNING id INTO v_fee_id;

    -- Update loan outstanding fees
    UPDATE loans SET
        outstanding_fees_cents = COALESCE(outstanding_fees_cents, 0) + v_fee_result.fee_cents,
        total_outstanding_cents = total_outstanding_cents + v_fee_result.fee_cents,
        updated_at = now()
    WHERE id = p_loan_id;

    -- Update schedule
    UPDATE loan_payment_schedule SET
        late_fee_applied = TRUE,
        late_fee_id = v_fee_id,
        late_fee_cents = v_fee_result.fee_cents,
        days_overdue = p_days_past_due,
        updated_at = now()
    WHERE id = p_scheduled_payment_id;

    RETURN QUERY SELECT TRUE, v_fee_id, v_fee_result.fee_cents, 'Late fee applied';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ GRANT EXECUTE PERMISSIONS                                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

GRANT EXECUTE ON FUNCTION calculate_daily_interest(INTEGER, DECIMAL, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_accrued_interest(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_payoff_amount(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payoff_quote(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_loan_late_fee(INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_effective_rate(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_index_rate(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_late_fee_to_loan(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_payment_to_loan(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 023 FIX
-- ══════════════════════════════════════════════════════════════════════════════
