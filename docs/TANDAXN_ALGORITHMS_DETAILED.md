# TandaXn Algorithms & Systems - Detailed Breakdown

**Last Updated:** February 14, 2026

## Legend

| Symbol | Meaning |
|--------|---------|
| 🟢 | Installed & Working |
| 🟡 | Lower Priority / Simple Calculation |
| 🔴 | Critical / Urgent to Install |

---

## 1. COMMUNITY & CIRCLE SYSTEMS

### 🟢 Community Creation & Management
**Status:** Installed (Migration 005)
```sql
-- Create community with elder
CREATE OR REPLACE FUNCTION create_community(
  p_name TEXT,
  p_elder_id UUID,
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
  INSERT INTO communities (name, elder_id, description)
  VALUES (p_name, p_elder_id, p_description)
  RETURNING id;
$$ LANGUAGE sql;
```

### 🟢 Circle Creation & Configuration
**Status:** Installed (Migration 004)
```sql
-- Circle with contribution settings
CREATE TABLE circles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  contribution_amount DECIMAL(15,2) NOT NULL,
  frequency TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  max_members INTEGER DEFAULT 12,
  status TEXT DEFAULT 'forming'
);
```

### 🟢 Circle Matching Algorithm
**Status:** Installed (Migration 007)
```sql
-- Match users to compatible circles based on:
-- 1. Contribution capacity
-- 2. XnScore compatibility
-- 3. Schedule preference
-- 4. Community membership
CREATE OR REPLACE FUNCTION find_compatible_circles(
  p_user_id UUID,
  p_contribution_range NUMRANGE,
  p_frequency TEXT
) RETURNS TABLE(circle_id UUID, compatibility_score DECIMAL);
```

### 🟢 Member Joining/Leaving
**Status:** Installed (Migrations 004, 017)
```sql
-- Join circle with position assignment
-- Leave circle with settlement calculation
```

---

## 2. CONTRIBUTION SYSTEMS

### 🟢 Contribution Scheduling
**Status:** Installed (Migration 011)
```sql
-- Auto-schedule contributions based on circle frequency
CREATE OR REPLACE FUNCTION schedule_member_contributions(
  p_circle_id UUID,
  p_cycle_id UUID
) RETURNS INTEGER AS $$
  -- Creates contribution records for all members
  -- Sets due dates based on circle frequency
$$ LANGUAGE plpgsql;
```

### 🟢 Contribution Processing
**Status:** Installed (Edge Function: process-contribution)
```typescript
// Processes a member's contribution
// 1. Validates amount
// 2. Debits wallet
// 3. Credits circle pool
// 4. Updates contribution status
// 5. Awards XnScore points
```

### 🟢 Late Contribution Handling
**Status:** Installed (Migration 013)
```sql
-- Grace period ladder:
-- Day 1-3: Soft late (reminder only)
-- Day 4-7: Grace period (warning)
-- Day 8-14: Final warning
-- Day 15+: Default triggered

CREATE TABLE late_contributions (
  contribution_id UUID,
  days_late INTEGER,
  late_fee_amount DECIMAL(15,2),
  late_status TEXT -- 'soft_late', 'grace_period', 'final_warning', 'defaulted'
);
```

### 🟢 Wallet Reservation System
**Status:** Installed (Migration 015)
```sql
-- Reserve funds for upcoming contributions
CREATE TABLE contribution_reservations (
  wallet_id UUID,
  circle_id UUID,
  amount_cents BIGINT,
  due_date DATE,
  reservation_status TEXT -- 'reserved', 'used', 'released'
);
```

---

## 3. CYCLE & PAYOUT SYSTEMS

### 🟢 Cycle Progression Engine
**Status:** Installed (Migration 012 + Edge Function)
```sql
-- State machine for circle cycles:
-- scheduled → collecting → deadline_reached → grace_period → ready_payout → payout_completed → closed

CREATE OR REPLACE FUNCTION progress_cycle(p_cycle_id UUID) RETURNS TEXT AS $$
DECLARE
  v_current_status TEXT;
  v_new_status TEXT;
BEGIN
  SELECT status INTO v_current_status FROM circle_cycles WHERE id = p_cycle_id;

  CASE v_current_status
    WHEN 'scheduled' THEN
      IF start_date <= CURRENT_DATE THEN v_new_status := 'collecting'; END IF;
    WHEN 'collecting' THEN
      IF all_contributions_received THEN v_new_status := 'ready_payout';
      ELSIF deadline_passed THEN v_new_status := 'deadline_reached'; END IF;
    -- ... more transitions
  END CASE;

  RETURN v_new_status;
END;
$$ LANGUAGE plpgsql;
```

### 🟢 Payout Order Algorithm
**Status:** Installed (Migration 010)
```sql
-- Position assignment methods:
-- 1. XnScore-based (highest score gets early position)
-- 2. Random (fair lottery)
-- 3. Hybrid (XnScore weighted random)
-- 4. Need-based (urgent need gets priority)

CREATE OR REPLACE FUNCTION assign_payout_positions(
  p_circle_id UUID,
  p_method TEXT -- 'xnscore', 'random', 'hybrid', 'need_based'
) RETURNS TABLE(user_id UUID, position INTEGER);
```

### 🟢 Payout Execution Engine
**Status:** Installed (Migration 015 + Edge Function)
```typescript
// Execute payout to recipient:
// 1. Calculate net amount (gross - platform fee)
// 2. Apply distribution preferences:
//    - % to wallet
//    - % to savings goal
//    - % to bank account
// 3. Execute transfers
// 4. Update cycle status
```

### 🟢 Position Swapping
**Status:** Installed (Migration 018)
```sql
-- Members can request to swap positions
-- Requires: target acceptance + optional elder approval
-- Restrictions: cooling off period, max swaps per cycle

CREATE TABLE position_swap_requests (
  requester_user_id UUID,
  target_user_id UUID,
  requester_position INTEGER,
  target_position INTEGER,
  swap_status swap_request_status -- 'pending_target', 'pending_confirmation', etc.
);
```

---

## 4. DEFAULT & RECOVERY SYSTEMS

### 🟢 Default Cascade Handler
**Status:** Installed (Migration 014)
```sql
-- When a member defaults, cascade effects:
-- 1. Record default
-- 2. Impact vouchers' XnScores
-- 3. Calculate circle shortfall
-- 4. Apply resolution method:
--    - Use reserve fund
--    - Redistribute among members
--    - Reduce payout to recipient
-- 5. Offer recovery plan to defaulter

CREATE OR REPLACE FUNCTION handle_default_cascade(
  p_user_id UUID,
  p_circle_id UUID,
  p_default_amount DECIMAL
) RETURNS void;
```

### 🟢 Recovery Plans
**Status:** Installed (Migration 014)
```sql
-- Path back to good standing:
-- - Installment payments
-- - XnScore recovery milestones (25%, 50%, 75%, 100%)

CREATE TABLE recovery_plans (
  user_id UUID,
  total_debt DECIMAL(12,2),
  installment_amount DECIMAL(12,2),
  installments_paid INTEGER,
  plan_status TEXT -- 'offered', 'active', 'completed', 'defaulted'
);
```

### 🟢 Circle Dissolution
**Status:** Installed (Migration 016)
```sql
-- Three dissolution tiers:
-- EMERGENCY: fraud, catastrophic default, regulatory (no vote)
-- VOLUNTARY: member consensus, goal achieved (requires vote)
-- ADMINISTRATIVE: natural completion, inactivity (system-initiated)

CREATE OR REPLACE FUNCTION initiate_dissolution(
  p_circle_id UUID,
  p_trigger_type dissolution_trigger,
  p_reason TEXT
) RETURNS UUID; -- dissolution_request_id
```

---

## 5. XNSCORE (TRUST SCORE) SYSTEMS

### 🟢 Initial XnScore Calculation
**Status:** Installed (Migration 019)
```sql
-- New user starts at 20 points
-- Initial signals can boost up to 40:
-- - Phone verified: +3
-- - Email verified: +2
-- - ID verified: +5
-- - Bank linked: +5
-- - Referred by high-score user: +5

CREATE OR REPLACE FUNCTION calculate_initial_xnscore(
  p_user_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  v_base_score DECIMAL := 20.00;
  v_bonus DECIMAL := 0;
BEGIN
  -- Check signals and add bonuses
  IF phone_verified THEN v_bonus := v_bonus + 3; END IF;
  IF email_verified THEN v_bonus := v_bonus + 2; END IF;
  -- ... more signals
  RETURN LEAST(v_base_score + v_bonus, 40); -- Cap at 40 for new users
END;
$$ LANGUAGE plpgsql;
```

### 🟢 XnScore Components (100 points max)
**Status:** Installed (Migrations 019-021)
```sql
-- Component breakdown:
-- Payment History:     35 pts (on-time payments)
-- Circle Completion:   25 pts (completed cycles)
-- Time Reliability:    20 pts (consistent timing)
-- Deposit Score:       10 pts (deposit patterns)
-- Diversity/Social:     7 pts (different circles/members)
-- Engagement:           3 pts (app usage)
```

### 🟢 XnScore Decay & Growth
**Status:** Installed (Migration 020 + Edge Function)
```sql
-- Inactivity decay:
-- 30-60 days inactive: -1 point/week
-- 60-90 days inactive: -2 points/week
-- 90+ days inactive: -3 points/week
-- Floor: 10 points minimum

-- Tenure bonuses:
-- 1-6 months: +0.5/month
-- 7-12 months: +1/month
-- 13-24 months: +1.5/month
-- 24+ months: +2/month
```

### 🟢 XnScore Event Triggers
**Status:** Installed (Various migrations)
```sql
-- Positive events:
-- +3: On-time contribution
-- +5: Complete circle cycle
-- +2: First contribution in new circle
-- +1: Vouch for someone who succeeds

-- Negative events:
-- -5: Late payment
-- -10: Miss payment entirely
-- -15: Default on obligation
-- -3: Vouchee defaults (voucher penalty)
```

---

## 6. LENDING SYSTEMS

### 🟢 Creditworthiness Assessment (5 Pillars)
**Status:** Installed (Migration 022)
```sql
-- PILLAR 1: XnScore (40% weight)
-- Maps XnScore 0-100 to credit score 300-850
CREATE FUNCTION xnscore_to_credit_score(xnscore DECIMAL) RETURNS INTEGER AS $$
  SELECT FLOOR(300 + (xnscore / 100.0) * 550)::INTEGER;
$$;

-- PILLAR 2: Circle Health (15% weight)
-- Average health of circles user participates in

-- PILLAR 3: Loan History (20% weight)
-- Previous loan repayment performance

-- PILLAR 4: Capacity (determines max amount)
-- Based on contribution history, wallet balance, savings

-- PILLAR 5: Community Collateral (adjusts APR)
-- Vouches, elder guarantee, co-signer
```

### 🟢 Risk Grades & Limits
**Status:** Installed (Migration 022)
```sql
-- Grade A (740-850): 5-8% APR, Max $10,000
-- Grade B (630-739): 8-12% APR, Max $5,000
-- Grade C (520-629): 12-18% APR, Max $2,000
-- Grade D (410-519): 18-24% APR, Max $500
-- Grade E (<410): Ineligible
```

### 🟢 Interest Calculation System
**Status:** Installed (Migration 023 + Edge Function)
```sql
-- Daily accrual formula:
-- daily_interest = (principal * APR) / 365

CREATE OR REPLACE FUNCTION accrue_daily_interest(p_loan_id UUID) RETURNS DECIMAL AS $$
DECLARE
  v_principal DECIMAL;
  v_apr DECIMAL;
  v_daily_interest DECIMAL;
BEGIN
  SELECT outstanding_principal_cents/100.0, apr/100.0
  INTO v_principal, v_apr
  FROM loans WHERE id = p_loan_id;

  v_daily_interest := (v_principal * v_apr) / 365;

  INSERT INTO loan_interest_accruals (loan_id, interest_accrued_cents, accrual_date)
  VALUES (p_loan_id, ROUND(v_daily_interest * 100), CURRENT_DATE);

  RETURN v_daily_interest;
END;
$$ LANGUAGE plpgsql;
```

### 🟢 Monthly Payment System
**Status:** Installed (Migration 024 + Edge Function)
```sql
-- PMT formula for amortization:
-- M = P * [r(1+r)^n] / [(1+r)^n - 1]
-- Where: P = principal, r = monthly rate, n = months

CREATE OR REPLACE FUNCTION calculate_monthly_payment(
  p_principal DECIMAL,
  p_apr DECIMAL,
  p_term_months INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  v_monthly_rate DECIMAL;
  v_payment DECIMAL;
BEGIN
  v_monthly_rate := p_apr / 100.0 / 12;
  v_payment := p_principal * (v_monthly_rate * POWER(1 + v_monthly_rate, p_term_months))
               / (POWER(1 + v_monthly_rate, p_term_months) - 1);
  RETURN ROUND(v_payment, 2);
END;
$$ LANGUAGE plpgsql;
```

### 🟢 Autopay System
**Status:** Installed (Migration 024 + Edge Function)
```sql
-- Autopay types:
-- 'minimum': Pay only minimum due
-- 'scheduled': Pay scheduled amount
-- 'fixed': Pay custom fixed amount
-- 'full_balance': Pay entire loan balance

CREATE TABLE loan_autopay_configs (
  loan_id UUID,
  autopay_type TEXT,
  fixed_amount_cents INTEGER,
  max_amount_cents INTEGER,
  status TEXT -- 'active', 'paused', 'disabled'
);
```

### 🟢 Late Fee Calculation
**Status:** Installed (Migration 023-024)
```sql
-- Late fee: 5% of amount due after grace period (5 days)
-- Applied once per obligation

CREATE OR REPLACE FUNCTION apply_late_fee(p_obligation_id UUID) RETURNS DECIMAL AS $$
DECLARE
  v_amount_due DECIMAL;
  v_late_fee DECIMAL;
BEGIN
  SELECT (total_due_cents - total_paid_cents)/100.0 INTO v_amount_due
  FROM loan_payment_obligations WHERE id = p_obligation_id;

  v_late_fee := v_amount_due * 0.05; -- 5% late fee

  UPDATE loan_payment_obligations
  SET late_fee_cents = ROUND(v_late_fee * 100),
      total_due_cents = total_due_cents + ROUND(v_late_fee * 100)
  WHERE id = p_obligation_id;

  RETURN v_late_fee;
END;
$$ LANGUAGE plpgsql;
```

---

## 7. SCHEDULED JOBS (EDGE FUNCTIONS)

### 🟢 Daily Interest Accrual
**Status:** Installed & Deployed
**Schedule:** `0 0 * * *` (Daily at midnight UTC)
```typescript
// Loops through all active loans
// Calculates: (principal × APR) ÷ 365
// Creates accrual record
// Updates outstanding balance
```

### 🟢 Process Autopay
**Status:** Installed & Deployed
**Schedule:** `0 6 * * *` (Daily at 6:00 AM UTC)
```typescript
// Fetches active autopay configs
// Checks for due obligations
// Debits wallet, credits loan
// Awards XnScore on success
```

### 🟢 Send Payment Reminders
**Status:** Installed & Deployed
**Schedule:** `0 */4 * * *` (Every 4 hours)
```typescript
// Reminder ladder:
// 7 days before: "Payment coming up"
// 3 days before: "Reminder"
// 1 day before: "Due tomorrow"
// Due date: "Due today"
// 1 day late: "Overdue"
// 3 days late: "Urgent"
// 7 days late: "Final notice"
```

### 🟢 Update Overdue Obligations
**Status:** Installed & Deployed
**Schedule:** `0 1 * * *` (Daily at 1:00 AM UTC)
```typescript
// Finds obligations past due
// After grace period: marks 'overdue'
// Applies 5% late fee
// Deducts XnScore (-5)
```

### 🟢 XnScore Decay Check
**Status:** Installed & Deployed
**Schedule:** `0 0 * * 0` (Sundays at midnight)
```typescript
// Finds inactive users (30+ days)
// Applies decay: 1-3 pts/week
// Respects recovery periods
// Floor at 10 points
```

### 🟢 XnScore Tenure Bonus
**Status:** Installed & Deployed
**Schedule:** `0 0 1 * *` (1st of month)
```typescript
// Awards tenure bonuses
// 1-6mo: +0.5, 7-12mo: +1, etc.
```

### 🟢 Cycle Progression
**Status:** Installed & Deployed
**Schedule:** `0 * * * *` (Every hour)
```typescript
// Progresses cycles through states
// Triggers notifications at transitions
```

### 🟢 Process Bank Payouts
**Status:** Installed & Deployed
**Schedule:** `0 8 * * *` (Daily at 8:00 AM UTC)
```typescript
// Fetches pending payouts
// Initiates bank/mobile money transfers
// TODO: Integrate Stripe/Flutterwave
```

### 🟢 Cleanup Expired Reservations
**Status:** Installed & Deployed
**Schedule:** `0 2 * * *` (Daily at 2:00 AM UTC)
```typescript
// Finds reservations 7+ days expired
// Releases funds to available balance
```

### 🟢 Expire Swap Requests
**Status:** Installed & Deployed
**Schedule:** `30 * * * *` (Every hour at :30)
```typescript
// Expires unanswered swap requests
// Notifies requesters
```

---

## 8. EXTERNAL INTEGRATIONS (NOT YET INSTALLED)

### 🔴 Payment Gateway Integration
**Status:** NOT INSTALLED - CRITICAL
**Priority:** HIGH
```typescript
// Stripe integration for:
// - Card deposits
// - Bank account verification (Plaid)
// - ACH transfers
// - Instant payouts

// Flutterwave for Africa:
// - Bank transfers (Nigeria, Ghana, Kenya, etc.)
// - Mobile money (M-Pesa, MTN MoMo)
// - Card payments
```

### 🔴 Push Notification Service
**Status:** NOT INSTALLED - CRITICAL
**Priority:** HIGH
```typescript
// Firebase Cloud Messaging / Expo Push
// Triggers:
// - Payment reminders
// - Payout received
// - Swap request
// - Circle updates
// - XnScore changes
```

### 🔴 KYC/Identity Verification
**Status:** NOT INSTALLED - CRITICAL
**Priority:** HIGH
```typescript
// Options:
// - Jumio
// - Onfido
// - Smile Identity (Africa)
// Verifies:
// - Government ID
// - Selfie match
// - Address proof
```

### 🟡 Email Service
**Status:** NOT INSTALLED
**Priority:** MEDIUM
```typescript
// Resend or SendGrid
// Templates:
// - Welcome email
// - Payment confirmation
// - Payout notification
// - Weekly summary
```

### 🟡 SMS Service
**Status:** NOT INSTALLED
**Priority:** MEDIUM
```typescript
// Twilio or Africa's Talking
// For:
// - OTP verification
// - Critical alerts
// - Payment reminders (fallback)
```

### 🟡 Fraud Detection
**Status:** NOT INSTALLED
**Priority:** MEDIUM
```typescript
// Checks:
// - Velocity (too many actions too fast)
// - Device fingerprinting
// - IP geolocation anomalies
// - Unusual transaction patterns
```

---

## 9. ADDITIONAL FEATURES (NOT YET INSTALLED)

### 🟡 Admin Dashboard
**Status:** NOT INSTALLED
**Priority:** MEDIUM
```typescript
// Features:
// - User management
// - Circle oversight
// - Transaction monitoring
// - KYC review queue
// - Dispute resolution
// - Analytics & reports
```

### 🟡 Dispute Resolution System
**Status:** NOT INSTALLED
**Priority:** MEDIUM
```sql
-- Dispute types:
-- - Payment not credited
-- - Unauthorized transaction
-- - Payout delay
-- - Position swap disagreement
```

### 🟡 Referral System
**Status:** NOT INSTALLED
**Priority:** LOW
```sql
-- Referrer gets XnScore bonus when:
-- - Referee completes first circle
-- - Referee makes first loan payment
-- Referee gets:
-- - Higher initial XnScore
-- - Reduced first-loan APR
```

### 🟡 Achievement/Badge System
**Status:** NOT INSTALLED
**Priority:** LOW
```sql
-- Gamification badges:
-- "First Circle" - Complete first tontine
-- "Perfect Score" - 100% on-time payments
-- "Community Builder" - Invite 5 members
-- "Trusted Elder" - Lead 3+ circles
```

---

## 10. SUMMARY DASHBOARD

| Category | 🟢 Done | 🟡 Medium | 🔴 Critical |
|----------|---------|-----------|-------------|
| Community & Circles | 4 | 0 | 0 |
| Contributions | 4 | 0 | 0 |
| Cycles & Payouts | 4 | 0 | 0 |
| Default & Recovery | 3 | 0 | 0 |
| XnScore | 4 | 0 | 0 |
| Lending | 6 | 0 | 0 |
| Edge Functions | 10 | 0 | 0 |
| External Integrations | 0 | 3 | 3 |
| Additional Features | 0 | 4 | 0 |
| **TOTAL** | **35** | **7** | **3** |

### Overall Completion: **78%** (35/45 core systems)

### Critical Items Remaining:
1. 🔴 Payment Gateway (Stripe/Flutterwave)
2. 🔴 Push Notifications (Firebase/Expo)
3. 🔴 KYC Verification

---

*Document auto-generated. Update as systems are implemented.*
