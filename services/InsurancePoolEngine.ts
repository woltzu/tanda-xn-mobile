/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INSURANCE POOL ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Per-circle insurance pool funded by automatic contribution withholding.
 * Covers up to 80% of default shortfalls. Dynamic rates (1-3%) based on
 * member risk profiles. Unspent reserves distributed or rolled forward
 * at cycle end via Circle Democracy vote.
 *
 * @module InsurancePoolEngine
 */

import { supabase } from '@/lib/supabase';
import { CircleDemocracyEngine } from './CircleDemocracyEngine';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PoolStatus = 'active' | 'suspended' | 'depleted' | 'closed' | 'distributing';

export type PoolTransactionType =
  | 'withholding'
  | 'coverage_payout'
  | 'distribution'
  | 'rollover'
  // Migration 206: audit row written by set_circle_pool_enabled /
  // set_member_pool_opt_in RPCs whenever a config flag flips.
  | 'config_change';

export type ClaimStatus = 'pending' | 'approved' | 'partial' | 'denied' | 'void';

export interface InsurancePool {
  id: string;
  circleId: string;
  balanceCents: number;
  totalWithheldCents: number;
  totalPaidOutCents: number;
  totalDistributedCents: number;
  totalRolledOverCents: number;
  currentRate: number;
  rateFloor: number;
  rateCeiling: number;
  status: PoolStatus;
  totalClaims: number;
  approvedClaims: number;
  createdAt: string;
  updatedAt: string;
  // Migration 206: circle-level admin switch. Read from
  // circles.insurance_pool_enabled, NOT a column on circle_insurance_pools
  // (so a single source of truth lives on circles).
  adminEnabled: boolean;
  circleName: string | null;
  // Per-cycle contribution amount in cents — used by the pool-health
  // gauge to compute "covers N defaults" relative to the pool balance.
  contributionAmountCents: number | null;
}

// Migration 206 — one row per active member of the circle, used by the
// Members tab on InsurancePoolScreen to show who is participating.
export interface CirclePoolMember {
  userId: string;
  fullName: string | null;
  role: 'creator' | 'admin' | 'elder' | 'member';
  participatesInPool: boolean;
}

export interface PoolTransaction {
  id: string;
  poolId: string;
  circleId: string;
  transactionType: PoolTransactionType;
  amountCents: number;
  runningBalanceCents: number;
  contributionId: string | null;
  defaultId: string | null;
  claimId: string | null;
  cycleId: string | null;
  userId: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface PoolRateHistory {
  id: string;
  poolId: string;
  circleId: string;
  effectiveRate: number;
  previousRate: number;
  reason: string;
  avgMemberScore: number | null;
  minMemberScore: number | null;
  membersBelowFair: number;
  defaultHistoryFactor: number | null;
  effectiveFrom: string;
  createdAt: string;
}

export interface CoverageClaim {
  id: string;
  poolId: string;
  circleId: string;
  defaultId: string;
  cycleId: string;
  defaulterUserId: string;
  shortfallAmountCents: number;
  maxCoverageCents: number;
  approvedAmountCents: number;
  coveragePct: number;
  poolBalanceBeforeCents: number;
  poolBalanceAfterCents: number;
  status: ClaimStatus;
  denialReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface WithholdingResult {
  withheldCents: number;
  netAmountCents: number;
  poolBalanceCents: number;
  rateApplied?: number;
  poolStatus?: string;
  error?: string;
}

export interface CoverageResult {
  claimId: string | null;
  approvedCents: number;
  coveragePct: number;
  claimStatus: string;
  poolBalanceBefore: number;
  poolBalanceAfter: number;
  shortfallCents: number;
  maxCoverageCents: number;
  error?: string;
  reason?: string;
}

export interface DistributionResult {
  action: string;
  totalDistributedCents?: number;
  perMemberCents?: number;
  memberCount?: number;
  remainderCents?: number;
  amountCents?: number;
  poolBalanceCents?: number;
  message?: string;
  distributions?: Array<{ user_id: string; amount_cents: number }>;
  error?: string;
}

export interface RateCalculationResult {
  newRate: number;
  previousRate: number;
  avgMemberScore: number | null;
  minMemberScore: number | null;
  membersBelowFair: number;
  defaultHistoryFactor: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS (snake_case DB → camelCase app)
// ═══════════════════════════════════════════════════════════════════════════════

function mapPool(row: any): InsurancePool {
  // The join in getPoolStatus surfaces circles.insurance_pool_enabled and
  // circles.name under row.circles. When the embed is missing (e.g., the
  // join was skipped or the circle was removed), default to true / null
  // so the screen still renders without crashing.
  const circle = row.circles ?? {};
  return {
    id: row.id,
    circleId: row.circle_id,
    balanceCents: row.balance_cents,
    totalWithheldCents: row.total_withheld_cents,
    totalPaidOutCents: row.total_paid_out_cents,
    totalDistributedCents: row.total_distributed_cents,
    totalRolledOverCents: row.total_rolled_over_cents,
    currentRate: parseFloat(row.current_rate),
    rateFloor: parseFloat(row.rate_floor),
    rateCeiling: parseFloat(row.rate_ceiling),
    status: row.status,
    totalClaims: row.total_claims,
    approvedClaims: row.approved_claims,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    adminEnabled: circle.insurance_pool_enabled !== false,
    circleName: circle.name ?? null,
    contributionAmountCents:
      circle.amount != null ? Math.round(Number(circle.amount) * 100) : null,
  };
}

function mapTransaction(row: any): PoolTransaction {
  return {
    id: row.id,
    poolId: row.pool_id,
    circleId: row.circle_id,
    transactionType: row.transaction_type,
    amountCents: row.amount_cents,
    runningBalanceCents: row.running_balance_cents,
    contributionId: row.contribution_id,
    defaultId: row.default_id,
    claimId: row.claim_id,
    cycleId: row.cycle_id,
    userId: row.user_id,
    description: row.description,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function mapRateHistory(row: any): PoolRateHistory {
  return {
    id: row.id,
    poolId: row.pool_id,
    circleId: row.circle_id,
    effectiveRate: parseFloat(row.effective_rate),
    previousRate: parseFloat(row.previous_rate),
    reason: row.reason,
    avgMemberScore: row.avg_member_score ? parseFloat(row.avg_member_score) : null,
    minMemberScore: row.min_member_score ? parseFloat(row.min_member_score) : null,
    membersBelowFair: row.members_below_fair || 0,
    defaultHistoryFactor: row.default_history_factor ? parseFloat(row.default_history_factor) : null,
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
  };
}

function mapClaim(row: any): CoverageClaim {
  return {
    id: row.id,
    poolId: row.pool_id,
    circleId: row.circle_id,
    defaultId: row.default_id,
    cycleId: row.cycle_id,
    defaulterUserId: row.defaulter_user_id,
    shortfallAmountCents: row.shortfall_amount_cents,
    maxCoverageCents: row.max_coverage_cents,
    approvedAmountCents: row.approved_amount_cents,
    coveragePct: parseFloat(row.coverage_pct),
    poolBalanceBeforeCents: row.pool_balance_before_cents,
    poolBalanceAfterCents: row.pool_balance_after_cents,
    status: row.status,
    denialReason: row.denial_reason,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE (Static Class)
// ═══════════════════════════════════════════════════════════════════════════════

export class InsurancePoolEngine {

  // ─────────────────────────────────────────────────────────────────────────
  // Pool Status
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the insurance pool for a circle
   */
  static async getPoolStatus(circleId: string): Promise<InsurancePool | null> {
    // Join circles for migration-206 fields. Use maybeSingle so a missing
    // pool row returns null instead of throwing.
    const { data, error } = await supabase
      .from('circle_insurance_pools')
      .select('*, circles(name, insurance_pool_enabled, amount)')
      .eq('circle_id', circleId)
      .maybeSingle();

    if (error || !data) return null;
    return mapPool(data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Migration 206 — optional pool (circle + member toggles)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Admin/creator/elder toggles the circle-wide pool on or off.
   * Backed by set_circle_pool_enabled SECURITY DEFINER RPC.
   */
  static async setCirclePoolEnabled(
    circleId: string,
    enabled: boolean,
  ): Promise<{ success: boolean; enabled?: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('set_circle_pool_enabled', {
      p_circle_id: circleId,
      p_enabled: enabled,
    });
    if (error) return { success: false, error: error.message };
    const payload = (data ?? {}) as { success?: boolean; enabled?: boolean; error?: string };
    return {
      success: payload.success ?? false,
      enabled: payload.enabled,
      error: payload.error,
    };
  }

  /**
   * Current user opts themselves in or out of the pool for a circle.
   * Self-only (the RPC rejects p_user_id != auth.uid()).
   */
  static async setMemberPoolOptIn(
    circleId: string,
    userId: string,
    participates: boolean,
  ): Promise<{ success: boolean; participates?: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('set_member_pool_opt_in', {
      p_circle_id: circleId,
      p_user_id: userId,
      p_participates: participates,
    });
    if (error) return { success: false, error: error.message };
    const payload = (data ?? {}) as { success?: boolean; participates?: boolean; error?: string };
    return {
      success: payload.success ?? false,
      participates: payload.participates,
      error: payload.error,
    };
  }

  /**
   * List the members of a circle with their participates_in_pool flag.
   * Used by the Members section on InsurancePoolScreen.
   */
  static async getCirclePoolMembers(circleId: string): Promise<CirclePoolMember[]> {
    const { data, error } = await supabase
      .from('circle_members')
      .select('user_id, role, participates_in_pool, profiles:user_id(full_name)')
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .order('role', { ascending: true });

    if (error || !data) return [];
    return data.map((row: any) => ({
      userId: row.user_id,
      role: row.role,
      participatesInPool: row.participates_in_pool !== false,
      fullName: row.profiles?.full_name ?? null,
    }));
  }

  /**
   * Get pool transaction history
   */
  static async getPoolTransactions(
    circleId: string,
    options?: { limit?: number; type?: PoolTransactionType }
  ): Promise<PoolTransaction[]> {
    let query = supabase
      .from('insurance_pool_transactions')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (options?.type) {
      query = query.eq('transaction_type', options.type);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapTransaction);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Rate Calculation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Recalculate the dynamic insurance rate for a circle based on member risk profiles.
   * Updates the pool and records the rate change in history.
   */
  static async calculateRate(circleId: string): Promise<RateCalculationResult> {
    // Get current rate before recalculation
    const pool = await this.getPoolStatus(circleId);
    const previousRate = pool?.currentRate ?? 0.02;

    // Call SQL function
    const { data, error } = await supabase
      .rpc('calculate_pool_rate', { p_circle_id: circleId });

    if (error) {
      throw new Error(`Rate calculation failed: ${error.message}`);
    }

    const newRate = parseFloat(data);

    // Get the latest rate history entry for factor details
    const { data: historyData } = await supabase
      .from('insurance_pool_rate_history')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      newRate,
      previousRate,
      avgMemberScore: historyData?.avg_member_score ? parseFloat(historyData.avg_member_score) : null,
      minMemberScore: historyData?.min_member_score ? parseFloat(historyData.min_member_score) : null,
      membersBelowFair: historyData?.members_below_fair || 0,
      defaultHistoryFactor: historyData?.default_history_factor ? parseFloat(historyData.default_history_factor) : null,
    };
  }

  /**
   * Get rate change history for a circle's pool
   */
  static async getPoolRateHistory(circleId: string): Promise<PoolRateHistory[]> {
    const { data, error } = await supabase
      .from('insurance_pool_rate_history')
      .select('*')
      .eq('circle_id', circleId)
      .order('effective_from', { ascending: false });

    if (error || !data) return [];
    return data.map(mapRateHistory);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Withholding
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process insurance pool withholding at contribution time.
   * Called from ContributionProcessingService after contribution is recorded.
   */
  static async processWithholding(
    contributionId: string,
    amountCents: number
  ): Promise<WithholdingResult> {
    const { data, error } = await supabase
      .rpc('process_pool_withholding', {
        p_contribution_id: contributionId,
        p_amount_cents: amountCents,
      });

    if (error) {
      throw new Error(`Pool withholding failed: ${error.message}`);
    }

    const result = data as Record<string, any>;
    return {
      withheldCents: result.withheld_cents || 0,
      netAmountCents: result.net_amount_cents || amountCents,
      poolBalanceCents: result.pool_balance_cents || 0,
      rateApplied: result.rate_applied ? parseFloat(result.rate_applied) : undefined,
      poolStatus: result.pool_status,
      error: result.error,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Coverage
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process insurance pool coverage for a default.
   * Called from DefaultCascadeHandler during resolveCircleImpact.
   */
  static async processCoverage(defaultId: string): Promise<CoverageResult> {
    const { data, error } = await supabase
      .rpc('process_pool_coverage', { p_default_id: defaultId });

    if (error) {
      throw new Error(`Pool coverage failed: ${error.message}`);
    }

    const result = data as Record<string, any>;
    return {
      claimId: result.claim_id || null,
      approvedCents: result.approved_cents || 0,
      coveragePct: result.coverage_pct ? parseFloat(result.coverage_pct) : 0,
      claimStatus: result.claim_status || 'denied',
      poolBalanceBefore: result.pool_balance_before || 0,
      poolBalanceAfter: result.pool_balance_after || 0,
      shortfallCents: result.shortfall_cents || 0,
      maxCoverageCents: result.max_coverage_cents || 0,
      error: result.error,
      reason: result.reason,
    };
  }

  /**
   * Get a coverage claim for a specific default
   */
  static async getCoverageClaim(defaultId: string): Promise<CoverageClaim | null> {
    const { data, error } = await supabase
      .from('insurance_coverage_claims')
      .select('*')
      .eq('default_id', defaultId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return mapClaim(data);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Distribution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Distribute or roll over pool balance at cycle end.
   */
  static async distributePool(
    circleId: string,
    action: 'distribute' | 'rollover'
  ): Promise<DistributionResult> {
    const { data, error } = await supabase
      .rpc('distribute_pool_balance', {
        p_circle_id: circleId,
        p_action: action,
      });

    if (error) {
      throw new Error(`Pool distribution failed: ${error.message}`);
    }

    const result = data as Record<string, any>;
    return {
      action: result.action,
      totalDistributedCents: result.total_distributed_cents,
      perMemberCents: result.per_member_cents,
      memberCount: result.member_count,
      remainderCents: result.remainder_cents,
      amountCents: result.amount_cents,
      poolBalanceCents: result.pool_balance_cents,
      message: result.message,
      distributions: result.distributions,
      error: result.error,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Democracy Integration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a Circle Democracy proposal for pool rollover vs distribution.
   * Auto-creates and opens the proposal for voting.
   */
  static async createRolloverProposal(circleId: string): Promise<any> {
    const pool = await this.getPoolStatus(circleId);
    if (!pool || pool.balanceCents <= 0) return null;

    // Count active members for per-member calculation
    const { count } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('status', 'active');

    const memberCount = count || 1;
    const perMemberCents = Math.floor(pool.balanceCents / memberCount);

    // Create proposal via Circle Democracy
    const proposal = await CircleDemocracyEngine.createProposal(circleId, {
      proposalType: 'pool_rollover',
      title: 'Insurance pool: distribute or roll over?',
      description:
        `The circle insurance pool has $${(pool.balanceCents / 100).toFixed(2)} in unspent reserves. ` +
        `Vote YES to roll the funds into the next cycle. ` +
        `Vote NO to distribute $${(perMemberCents / 100).toFixed(2)} to each member.`,
      payload: {
        pool_balance_cents: pool.balanceCents,
        per_member_if_distributed: perMemberCents,
        member_count: memberCount,
      },
    });

    // Open the proposal for voting immediately
    if (proposal) {
      await CircleDemocracyEngine.openProposal(proposal.id);
    }

    return proposal;
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Realtime
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to insurance pool changes for a circle.
   * Returns the channel for cleanup.
   */
  static subscribeToPool(
    circleId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`insurance_pool_${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_insurance_pools',
          filter: `circle_id=eq.${circleId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'insurance_pool_transactions',
          filter: `circle_id=eq.${circleId}`,
        },
        callback
      )
      .subscribe();
  }
}
