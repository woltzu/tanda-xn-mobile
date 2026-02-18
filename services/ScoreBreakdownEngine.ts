// ══════════════════════════════════════════════════════════════════════════════
// SCORE BREAKDOWN ENGINE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
// Provides score transparency by showing users exactly what affects their XnScore
// with detailed factor breakdowns and actionable improvement tips.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPES                                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

export type FactorStatus = 'excellent' | 'good' | 'fair' | 'needs_work' | 'critical';
export type FactorTrend = 'improving' | 'stable' | 'declining';
export type TipPriority = 'high' | 'medium' | 'low';
export type TipCategory = 'payment' | 'completion' | 'tenure' | 'community' | 'financial';

export interface FactorComponent {
  score: number;
  max: number;
}

export interface FactorBreakdown {
  score: number;
  max_score: number;
  weight: number;
  status: FactorStatus;
  trend: FactorTrend;
  components: Record<string, FactorComponent>;
  details: Record<string, any>;
}

export interface ScoreBreakdown {
  user_id: string;
  total_score: number;
  calculated_total: number;
  tier: string;
  factors: {
    payment_reliability: FactorBreakdown;
    circle_completion: FactorBreakdown;
    tenure_activity: FactorBreakdown;
    community_standing: FactorBreakdown;
    financial_behavior: FactorBreakdown;
  };
  improvement_tips: ImprovementTip[];
  percentiles?: Record<string, number>;
  cached?: boolean;
  calculated_at: string;
}

export interface ImprovementTip {
  id: string;
  factor: string;
  component: string | null;
  title: string;
  description: string;
  action: string;
  priority: TipPriority;
  potential_points: number;
  current_score: number;
}

export interface FactorDefinition {
  id: string;
  factor_key: string;
  factor_name: string;
  factor_description: string;
  factor_icon: string;
  weight_percentage: number;
  max_points: number;
  component_count: number;
  is_active: boolean;
  display_order: number;
}

export interface FactorComponentDefinition {
  id: string;
  factor_id: string;
  component_key: string;
  component_name: string;
  component_description: string;
  max_points: number;
  calculation_formula: string;
  display_order: number;
  show_in_breakdown: boolean;
}

export interface BreakdownCache {
  id: string;
  user_id: string;
  total_score: number;
  payment_reliability_score: number;
  payment_reliability_status: FactorStatus;
  payment_reliability_trend: FactorTrend;
  circle_completion_score: number;
  circle_completion_status: FactorStatus;
  circle_completion_trend: FactorTrend;
  tenure_activity_score: number;
  tenure_activity_status: FactorStatus;
  tenure_activity_trend: FactorTrend;
  community_standing_score: number;
  community_standing_status: FactorStatus;
  community_standing_trend: FactorTrend;
  financial_behavior_score: number;
  financial_behavior_status: FactorStatus;
  financial_behavior_trend: FactorTrend;
  factor_breakdown: Record<string, any>;
  improvement_tips: ImprovementTip[];
  calculated_at: string;
  expires_at: string;
}

export interface FullRecalculationResult {
  success: boolean;
  previous_score: number;
  new_score: number;
  factor_totals: {
    payment_reliability: number;
    circle_completion: number;
    tenure_activity: number;
    community_standing: number;
    financial_behavior: number;
    raw_total: number;
    age_cap: number;
    capped_total: number;
  };
}

export interface FactorPerformanceSummary {
  factor: string;
  max_score: number;
  avg_score: number;
  excellent_count: number;
  good_count: number;
  fair_count: number;
  needs_work_count: number;
  critical_count: number;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SCORE BREAKDOWN ENGINE CLASS                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

export class ScoreBreakdownEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // FACTOR DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all factor definitions
   */
  async getFactorDefinitions(): Promise<FactorDefinition[]> {
    const { data, error } = await supabase
      .from('xn_score_factor_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific factor definition
   */
  async getFactorDefinition(factorKey: string): Promise<FactorDefinition | null> {
    const { data, error } = await supabase
      .from('xn_score_factor_definitions')
      .select('*')
      .eq('factor_key', factorKey)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get components for a factor
   */
  async getFactorComponents(factorId: string): Promise<FactorComponentDefinition[]> {
    const { data, error } = await supabase
      .from('xn_score_factor_components')
      .select('*')
      .eq('factor_id', factorId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get all factors with their components
   */
  async getFactorsWithComponents(): Promise<(FactorDefinition & { components: FactorComponentDefinition[] })[]> {
    const factors = await this.getFactorDefinitions();

    const factorsWithComponents = await Promise.all(
      factors.map(async (factor) => {
        const components = await this.getFactorComponents(factor.id);
        return { ...factor, components };
      })
    );

    return factorsWithComponents;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE BREAKDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get score breakdown for a user (uses cache if valid)
   */
  async getScoreBreakdown(userId: string): Promise<ScoreBreakdown> {
    const { data, error } = await supabase.rpc('get_score_breakdown', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data as ScoreBreakdown;
  }

  /**
   * Calculate fresh breakdown (bypasses cache)
   */
  async calculateBreakdown(userId: string): Promise<ScoreBreakdown> {
    const { data, error } = await supabase.rpc('calculate_score_breakdown', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data as ScoreBreakdown;
  }

  /**
   * Refresh breakdown cache
   */
  async refreshBreakdownCache(userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('refresh_score_breakdown', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data as boolean;
  }

  /**
   * Get cached breakdown (returns null if expired)
   */
  async getCachedBreakdown(userId: string): Promise<BreakdownCache | null> {
    const { data, error } = await supabase
      .from('xn_score_breakdown_cache')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPROVEMENT TIPS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get improvement tips for a user
   */
  async getImprovementTips(userId: string, limit: number = 5): Promise<ImprovementTip[]> {
    const { data, error } = await supabase.rpc('get_improvement_tips', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) throw error;
    return data as ImprovementTip[];
  }

  /**
   * Get all available improvement tips (for admin/reference)
   */
  async getAllImprovementTips(): Promise<any[]> {
    const { data, error } = await supabase
      .from('xn_score_improvement_tips')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('potential_points', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get tips for a specific factor
   */
  async getTipsForFactor(factorKey: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('xn_score_improvement_tips')
      .select('*')
      .eq('factor_key', factorKey)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL RECALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Trigger full score recalculation based on all factors
   */
  async recalculateFullScore(userId: string): Promise<FullRecalculationResult> {
    const { data, error } = await supabase.rpc('recalculate_full_xnscore', {
      p_user_id: userId,
    });

    if (error) throw error;

    // Transform the array result to object
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as FullRecalculationResult;
    }

    return {
      success: false,
      previous_score: 0,
      new_score: 0,
      factor_totals: {
        payment_reliability: 0,
        circle_completion: 0,
        tenure_activity: 0,
        community_standing: 0,
        financial_behavior: 0,
        raw_total: 0,
        age_cap: 0,
        capped_total: 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS & COMPARISONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get factor performance summary (aggregate stats)
   */
  async getFactorPerformanceSummary(): Promise<FactorPerformanceSummary[]> {
    const { data, error } = await supabase
      .from('v_factor_performance_summary')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get improvement opportunities for all users
   */
  async getImprovementOpportunities(limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_improvement_opportunities')
      .select('*')
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get users by factor status
   */
  async getUsersByFactorStatus(
    factorKey: string,
    status: FactorStatus
  ): Promise<any[]> {
    const statusColumn = `${factorKey}_status`;

    const { data, error } = await supabase
      .from('xn_score_breakdown_cache')
      .select(`
        user_id,
        total_score,
        ${factorKey}_score,
        ${statusColumn},
        profiles!inner(full_name, email)
      `)
      .eq(statusColumn, status);

    if (error) throw error;
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate factor status from score
   */
  getFactorStatus(score: number, maxScore: number): FactorStatus {
    if (maxScore === 0) return 'critical';
    const pct = (score / maxScore) * 100;

    if (pct >= 90) return 'excellent';
    if (pct >= 70) return 'good';
    if (pct >= 50) return 'fair';
    if (pct >= 30) return 'needs_work';
    return 'critical';
  }

  /**
   * Get factor status display info
   */
  getFactorStatusInfo(status: FactorStatus): { label: string; color: string; icon: string } {
    const statusInfo: Record<FactorStatus, { label: string; color: string; icon: string }> = {
      excellent: { label: 'Excellent', color: '#22c55e', icon: '🌟' },
      good: { label: 'Good', color: '#84cc16', icon: '✅' },
      fair: { label: 'Fair', color: '#eab308', icon: '⚠️' },
      needs_work: { label: 'Needs Work', color: '#f97316', icon: '📈' },
      critical: { label: 'Critical', color: '#ef4444', icon: '🚨' },
    };

    return statusInfo[status] || statusInfo.needs_work;
  }

  /**
   * Get factor trend display info
   */
  getFactorTrendInfo(trend: FactorTrend): { label: string; color: string; icon: string } {
    const trendInfo: Record<FactorTrend, { label: string; color: string; icon: string }> = {
      improving: { label: 'Improving', color: '#22c55e', icon: '📈' },
      stable: { label: 'Stable', color: '#6b7280', icon: '➡️' },
      declining: { label: 'Declining', color: '#ef4444', icon: '📉' },
    };

    return trendInfo[trend] || trendInfo.stable;
  }

  /**
   * Calculate overall health score from breakdown
   */
  calculateHealthScore(breakdown: ScoreBreakdown): number {
    const factors = breakdown.factors;
    let totalHealth = 0;
    let totalWeight = 0;

    const factorWeights: Record<string, number> = {
      payment_reliability: 35,
      circle_completion: 20,
      tenure_activity: 15,
      community_standing: 15,
      financial_behavior: 15,
    };

    for (const [key, factor] of Object.entries(factors)) {
      const weight = factorWeights[key] || 0;
      const health = factor.max_score > 0 ? (factor.score / factor.max_score) * 100 : 0;
      totalHealth += health * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(totalHealth / totalWeight) : 0;
  }

  /**
   * Get the weakest factor that needs improvement
   */
  getWeakestFactor(breakdown: ScoreBreakdown): {
    factor: string;
    score: number;
    maxScore: number;
    status: FactorStatus;
  } | null {
    const factors = breakdown.factors;
    let weakest: { factor: string; score: number; maxScore: number; status: FactorStatus } | null = null;
    let lowestPercentage = 100;

    for (const [key, factor] of Object.entries(factors)) {
      const percentage = factor.max_score > 0 ? (factor.score / factor.max_score) * 100 : 0;
      if (percentage < lowestPercentage) {
        lowestPercentage = percentage;
        weakest = {
          factor: key,
          score: factor.score,
          maxScore: factor.max_score,
          status: factor.status,
        };
      }
    }

    return weakest;
  }

  /**
   * Get top improvement actions
   */
  getTopImprovementActions(breakdown: ScoreBreakdown, count: number = 3): ImprovementTip[] {
    return breakdown.improvement_tips
      .sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // Then by potential points
        return b.potential_points - a.potential_points;
      })
      .slice(0, count);
  }

  /**
   * Format factor name for display
   */
  formatFactorName(factorKey: string): string {
    const names: Record<string, string> = {
      payment_reliability: 'Payment Reliability',
      circle_completion: 'Circle Completion',
      tenure_activity: 'Tenure & Activity',
      community_standing: 'Community Standing',
      financial_behavior: 'Financial Behavior',
    };

    return names[factorKey] || factorKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Get factor icon
   */
  getFactorIcon(factorKey: string): string {
    const icons: Record<string, string> = {
      payment_reliability: '💳',
      circle_completion: '🔄',
      tenure_activity: '⏳',
      community_standing: '🤝',
      financial_behavior: '📊',
    };

    return icons[factorKey] || '📌';
  }
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SINGLETON EXPORT                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

export const scoreBreakdownEngine = new ScoreBreakdownEngine();
