// ══════════════════════════════════════════════════════════════════════════════
// TOKEN SERVICE - Elder Token Incentive System
// Manages token balance, earning, spending, and real-time subscriptions
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenBalance {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lastEarnedAt?: string;
  lastSpentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'earn' | 'spend' | 'transfer_in' | 'transfer_out' | 'admin_adjustment';
  category: string;
  referenceType?: string;
  referenceId?: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface TokenRate {
  id: string;
  tokenValueUsd: number;
  effectiveFrom: string;
  effectiveUntil?: string;
}

export interface TokenAwardRule {
  id: string;
  eventType: string;
  tokenAmount: number;
  description: string;
  isActive: boolean;
  maxPerDay?: number;
  maxPerMonth?: number;
}

export interface RedeemOptions {
  type: 'fee_discount' | 'priority_placement' | 'merchandise' | 'withdrawal';
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
}

export interface TransactionQuery {
  limit?: number;
  offset?: number;
  type?: string;
  category?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const TOKEN_CATEGORY_META: Record<string, { label: string; icon: string }> = {
  // Earning categories
  vouch_success:       { label: 'Vouch Completed',    icon: 'shield-checkmark-outline' },
  mediation_resolved:  { label: 'Case Resolved',      icon: 'scale-outline' },
  appeal_upheld:       { label: 'Appeal Upheld',       icon: 'hammer-outline' },
  training_completed:  { label: 'Training Complete',   icon: 'book-outline' },
  elder_endorsed:      { label: 'Elder Endorsed',      icon: 'star-outline' },
  oversight_panel:     { label: 'Oversight Panel',     icon: 'eye-outline' },
  council_monthly:     { label: 'Council Bonus',       icon: 'ribbon-outline' },
  // Spending categories
  fee_discount:        { label: 'Fee Discount',        icon: 'pricetag-outline' },
  priority_placement:  { label: 'Priority Placement',  icon: 'rocket-outline' },
  merchandise:         { label: 'Merchandise',         icon: 'gift-outline' },
  withdrawal:          { label: 'Withdrawal',          icon: 'cash-outline' },
  // Admin
  admin_adjustment:    { label: 'Admin Adjustment',    icon: 'settings-outline' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class TokenService {

  // ─────────────────────────────────────────────────────────────────────────
  // Balance
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the token balance for a user.
   * Returns a default zero-balance if no row exists yet.
   */
  async getBalance(userId: string): Promise<TokenBalance> {
    const { data, error } = await supabase
      .from('token_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return default zero balance
      return {
        userId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      userId: data.user_id,
      balance: data.balance,
      lifetimeEarned: data.lifetime_earned,
      lifetimeSpent: data.lifetime_spent,
      lastEarnedAt: data.last_earned_at,
      lastSpentAt: data.last_spent_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transaction History
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get paginated token transaction history for a user.
   */
  async getTransactions(
    userId: string,
    options: TransactionQuery = {}
  ): Promise<{ data: TokenTransaction[]; total: number }> {
    const { limit = 20, offset = 0, type, category } = options;

    let query = supabase
      .from('token_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[TokenService] getTransactions error:', error);
      return { data: [], total: 0 };
    }

    return {
      data: (data || []).map(this.mapTransaction),
      total: count || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Token Rate
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the currently active token-to-USD conversion rate.
   */
  async getCurrentRate(): Promise<TokenRate | null> {
    const { data, error } = await supabase
      .from('token_rates')
      .select('*')
      .is('effective_until', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      tokenValueUsd: parseFloat(data.token_value_usd),
      effectiveFrom: data.effective_from,
      effectiveUntil: data.effective_until,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Award Rules
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all active token award rules.
   */
  async getAwardRules(): Promise<TokenAwardRule[]> {
    const { data, error } = await supabase
      .from('token_award_rules')
      .select('*')
      .eq('is_active', true)
      .order('token_amount', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      tokenAmount: r.token_amount,
      description: r.description,
      isActive: r.is_active,
      maxPerDay: r.max_per_day,
      maxPerMonth: r.max_per_month,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Award Tokens
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Award tokens to a user. Calls the award_tokens() PL/pgSQL function.
   * Returns the transaction ID.
   */
  async awardTokens(
    userId: string,
    amount: number,
    category: string,
    description: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('award_tokens', {
        p_user_id: userId,
        p_amount: amount,
        p_category: category,
        p_reference_type: referenceType || null,
        p_reference_id: referenceId || null,
        p_description: description,
      });

      if (error) {
        console.error('[TokenService] awardTokens error:', error);
        return null;
      }

      return data as string;
    } catch (err) {
      console.error('[TokenService] awardTokens exception:', err);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Redeem / Spend Tokens
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Spend tokens. Calls the spend_tokens() PL/pgSQL function.
   * Throws if insufficient balance.
   */
  async redeemTokens(userId: string, options: RedeemOptions): Promise<string> {
    const { data, error } = await supabase.rpc('spend_tokens', {
      p_user_id: userId,
      p_amount: options.amount,
      p_category: options.type,
      p_reference_type: options.referenceType || null,
      p_reference_id: options.referenceId || null,
      p_description: options.description,
    });

    if (error) {
      throw new Error(error.message || 'Failed to redeem tokens');
    }

    return data as string;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USD Conversion
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate the USD value of a token amount using the current rate.
   */
  async calculateUsdValue(tokenAmount: number): Promise<number> {
    const rate = await this.getCurrentRate();
    if (!rate) return 0;
    return tokenAmount * rate.tokenValueUsd;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Realtime Subscription
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to real-time balance changes for a user.
   * Returns an unsubscribe function.
   */
  subscribeToBalance(
    userId: string,
    callback: (balance: TokenBalance) => void
  ): () => void {
    const channel = supabase
      .channel(`token-balance-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'token_balances',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row) {
            callback({
              userId: row.user_id,
              balance: row.balance,
              lifetimeEarned: row.lifetime_earned,
              lifetimeSpent: row.lifetime_spent,
              lastEarnedAt: row.last_earned_at,
              lastSpentAt: row.last_spent_at,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the human-readable label for a category.
   */
  getCategoryLabel(category: string): string {
    return TOKEN_CATEGORY_META[category]?.label || category;
  }

  /**
   * Get the icon name for a category.
   */
  getCategoryIcon(category: string): string {
    return TOKEN_CATEGORY_META[category]?.icon || 'ellipse-outline';
  }

  /**
   * Format a token amount for display (e.g. "1,250 TXN").
   */
  formatTokenAmount(amount: number): string {
    return `${amount.toLocaleString()} TXN`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private mappers
  // ─────────────────────────────────────────────────────────────────────────

  private mapTransaction(row: any): TokenTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      type: row.type,
      category: row.category,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      description: row.description,
      balanceAfter: row.balance_after,
      createdAt: row.created_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const tokenService = new TokenService();
