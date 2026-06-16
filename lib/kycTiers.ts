// lib/kycTiers.ts — P2 of the KYC trigger review.
//
// Tier model and the "what tier does this amount require?" helper.
// Lives outside the engine deliberately — the tier→amount thresholds
// are a UX product decision (the engine just reports what kyc_tier the
// user actually has). Keeping them in their own module lets us
// re-tune thresholds without touching the engine, the gate, or the
// screens.
//
// The tier numbering matches the kyc_verifications.kyc_tier column
// values written by the existing Persona / admin-review pipeline so
// `user.kyc.tier >= required` is a direct integer comparison.
//
//   Tier 0  — Unverified.   View-only; no money actions allowed at all.
//   Tier 1  — Basic.        Approved email + phone verified.  ≤ $500
//                           per transaction.
//   Tier 2  — Verified.     Identity document + tax ID on file.
//                           ≤ $5 000 per transaction.
//   Tier 3  — Full KYC.     Identity + address proof.  Unlimited.

// Tier constants. Use these instead of magic numbers when calling
// useKYCGate({ requiredTier: KYC_TIER_BASIC }) etc.
export const KYC_TIER_UNVERIFIED = 0 as const;
export const KYC_TIER_BASIC = 1 as const;
export const KYC_TIER_VERIFIED = 2 as const;
export const KYC_TIER_FULL = 3 as const;

export type KycTier =
  | typeof KYC_TIER_UNVERIFIED
  | typeof KYC_TIER_BASIC
  | typeof KYC_TIER_VERIFIED
  | typeof KYC_TIER_FULL;

// Per-transaction USD ceilings per tier. These are the "this single
// transaction is at most $X" caps; the larger product (monthly
// rolling caps, daily caps, regulatory ceilings) lives server-side
// and the gate trusts those for the final word.
export const TIER_LIMITS_USD = {
  [KYC_TIER_BASIC]: 500,
  [KYC_TIER_VERIFIED]: 5_000,
  [KYC_TIER_FULL]: Number.POSITIVE_INFINITY,
} as const;

// Threshold AT WHICH the persistent Home banner / one-time toast
// nudges an unverified user. Below this, we don't want to surface the
// nudge for a sub-$10 wallet — most users move money in and out before
// the balance ever sits long enough to matter.
export const WALLET_NUDGE_THRESHOLD_USD = 100;

/**
 * Map a (positive) transaction amount in USD to the minimum tier a
 * member must hold to perform it. Values that fall through to Tier 3
 * are amounts above the Verified ceiling — large remittances etc.
 *
 * Symmetric for sends and withdrawals. Refunds, deposits, and other
 * inbound flows don't gate on a tier ceiling.
 */
export function requiredTierForAmountUsd(amountUsd: number): KycTier {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    // A zero or NaN amount can't fail the gate. Return Basic so the
    // existing "must be approved" floor still applies.
    return KYC_TIER_BASIC;
  }
  if (amountUsd <= TIER_LIMITS_USD[KYC_TIER_BASIC]) return KYC_TIER_BASIC;
  if (amountUsd <= TIER_LIMITS_USD[KYC_TIER_VERIFIED]) return KYC_TIER_VERIFIED;
  return KYC_TIER_FULL;
}

/**
 * Convenience: human-readable label for a tier, keyed for i18n. The
 * label keys live in the kyc_hub namespace already (tier_0_label …
 * tier_3_label) so the same strings power the hub card and the gate.
 */
export function tierLabelKey(tier: number): string {
  if (tier === KYC_TIER_FULL) return "kyc_hub.tier_3_label";
  if (tier === KYC_TIER_VERIFIED) return "kyc_hub.tier_2_label";
  if (tier === KYC_TIER_BASIC) return "kyc_hub.tier_1_label";
  return "kyc_hub.tier_0_label";
}
