// services/VoucherCascadeService.ts
// Voucher Cascade Service - Manages the ripple effects on vouchers when their vouchees default
// Handles reliability tracking, restrictions, and voucher standing

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface VoucherStanding {
  userId: string;
  totalVouches: number;
  activeVouches: number;
  voucheeDefaults: number;
  reliabilityStatus: 'good' | 'warning' | 'poor' | 'restricted';
  canVouch: boolean;
  restrictionEndsAt: string | null;
  xnScoreImpactFromVouching: number;
}

export interface VoucheeDefaultRecord {
  id: string;
  vouchId: string;
  defaultId: string;
  defaulterUserId: string;
  xnscoreImpact: number;
  createdAt: string;
}

export interface VoucherRestriction {
  id: string;
  userId: string;
  reason: string;
  restrictionType: string;
  activeUntil: string;
  status: string;
}

// ============================================================================
// VOUCHER CASCADE SERVICE
// ============================================================================

export class VoucherCascadeService {

  // --------------------------------------------------------------------------
  // VOUCHER STANDING MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get a voucher's complete standing
   */
  async getVoucherStanding(userId: string): Promise<VoucherStanding> {
    // Get total vouches
    const { count: totalVouches } = await supabase
      .from('vouches')
      .select('*', { count: 'exact', head: true })
      .eq('voucher_id', userId);

    // Get active vouches
    const { count: activeVouches } = await supabase
      .from('vouches')
      .select('*', { count: 'exact', head: true })
      .eq('voucher_id', userId)
      .eq('vouch_status', 'active');

    // Get vouchee defaults
    const { count: voucheeDefaults } = await supabase
      .from('voucher_default_impacts')
      .select('*', { count: 'exact', head: true })
      .eq('voucher_user_id', userId);

    // Calculate total XnScore impact from vouching
    const { data: impacts } = await supabase
      .from('voucher_default_impacts')
      .select('xnscore_impact')
      .eq('voucher_user_id', userId);

    const xnScoreImpactFromVouching = impacts?.reduce((sum, i) => sum + (i.xnscore_impact || 0), 0) || 0;

    // Check for active restrictions
    const { data: restriction } = await supabase
      .from('user_restrictions')
      .select('*')
      .eq('user_id', userId)
      .eq('restriction_type', 'cannot_vouch')
      .eq('status', 'active')
      .single();

    // Calculate reliability status
    const reliabilityStatus = this.calculateReliabilityStatus(voucheeDefaults || 0);
    const canVouch = !restriction && reliabilityStatus !== 'restricted';

    return {
      userId,
      totalVouches: totalVouches || 0,
      activeVouches: activeVouches || 0,
      voucheeDefaults: voucheeDefaults || 0,
      reliabilityStatus,
      canVouch,
      restrictionEndsAt: restriction?.active_until || null,
      xnScoreImpactFromVouching
    };
  }

  /**
   * Calculate reliability status based on vouchee defaults
   */
  calculateReliabilityStatus(voucheeDefaults: number): 'good' | 'warning' | 'poor' | 'restricted' {
    if (voucheeDefaults >= 5) return 'restricted';
    if (voucheeDefaults >= 3) return 'poor';
    if (voucheeDefaults >= 2) return 'warning';
    return 'good';
  }

  /**
   * Check if user can vouch for others
   */
  async canUserVouch(userId: string): Promise<{ canVouch: boolean; reason?: string }> {
    // Check for active restriction
    const { data: restriction } = await supabase
      .from('user_restrictions')
      .select('*')
      .eq('user_id', userId)
      .eq('restriction_type', 'cannot_vouch')
      .eq('status', 'active')
      .single();

    if (restriction) {
      return {
        canVouch: false,
        reason: restriction.active_until
          ? `Vouching restricted until ${new Date(restriction.active_until).toLocaleDateString()}`
          : 'Vouching privileges suspended'
      };
    }

    // Check reliability status
    const { count: voucheeDefaults } = await supabase
      .from('voucher_default_impacts')
      .select('*', { count: 'exact', head: true })
      .eq('voucher_user_id', userId);

    if ((voucheeDefaults || 0) >= 5) {
      return {
        canVouch: false,
        reason: 'Too many vouchee defaults. Vouching privileges restricted.'
      };
    }

    // Check if user has active defaults themselves
    const { count: activeDefaults } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('default_status', 'unresolved');

    if ((activeDefaults || 0) > 0) {
      return {
        canVouch: false,
        reason: 'Cannot vouch while you have unresolved defaults'
      };
    }

    return { canVouch: true };
  }

  // --------------------------------------------------------------------------
  // VOUCHEE DEFAULT TRACKING
  // --------------------------------------------------------------------------

  /**
   * Get all vouchee defaults for a voucher
   */
  async getVoucheeDefaults(voucherUserId: string): Promise<VoucheeDefaultRecord[]> {
    const { data, error } = await supabase
      .from('voucher_default_impacts')
      .select(`
        id,
        vouch_id,
        default_id,
        defaulter_user_id,
        xnscore_impact,
        created_at
      `)
      .eq('voucher_user_id', voucherUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
      id: d.id,
      vouchId: d.vouch_id,
      defaultId: d.default_id,
      defaulterUserId: d.defaulter_user_id,
      xnscoreImpact: d.xnscore_impact,
      createdAt: d.created_at
    }));
  }

  /**
   * Get voucher's impact history with details
   */
  async getVoucherImpactHistory(voucherUserId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('voucher_default_impacts')
      .select(`
        *,
        defaults (
          total_owed,
          circle_id,
          circles (name)
        ),
        profiles:defaulter_user_id (
          full_name
        )
      `)
      .eq('voucher_user_id', voucherUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(impact => ({
      id: impact.id,
      defaulterName: (impact.profiles as any)?.full_name || 'Unknown',
      circleName: (impact.defaults as any)?.circles?.name || 'Unknown',
      amountDefaulted: (impact.defaults as any)?.total_owed || 0,
      xnscoreImpact: impact.xnscore_impact,
      xnscoreBefore: impact.xnscore_before,
      xnscoreAfter: impact.xnscore_after,
      reliabilityStatusAfter: impact.voucher_reliability_status,
      triggeredRestriction: impact.triggered_restriction,
      date: impact.created_at
    }));
  }

  // --------------------------------------------------------------------------
  // RESTRICTION MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Apply vouching restriction to a user
   */
  async applyVouchRestriction(
    userId: string,
    reason: string,
    durationMonths: number = 6
  ): Promise<VoucherRestriction> {
    const activeUntil = new Date();
    activeUntil.setMonth(activeUntil.getMonth() + durationMonths);

    const { data, error } = await supabase
      .from('user_restrictions')
      .insert({
        user_id: userId,
        reason,
        restriction_type: 'cannot_vouch',
        scope: 'platform',
        is_permanent: false,
        active_until: activeUntil.toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      reason: data.reason,
      restrictionType: data.restriction_type,
      activeUntil: data.active_until,
      status: data.status
    };
  }

  /**
   * Lift vouching restriction
   */
  async liftVouchRestriction(
    restrictionId: string,
    liftedBy: string,
    reason: string
  ): Promise<void> {
    await supabase
      .from('user_restrictions')
      .update({
        status: 'lifted',
        lifted_at: new Date().toISOString(),
        lifted_by: liftedBy,
        lifted_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', restrictionId);
  }

  /**
   * Get active vouch restriction for a user
   */
  async getActiveVouchRestriction(userId: string): Promise<VoucherRestriction | null> {
    const { data } = await supabase
      .from('user_restrictions')
      .select('*')
      .eq('user_id', userId)
      .eq('restriction_type', 'cannot_vouch')
      .eq('status', 'active')
      .single();

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      reason: data.reason,
      restrictionType: data.restriction_type,
      activeUntil: data.active_until,
      status: data.status
    };
  }

  /**
   * Process expired vouch restrictions (called by cron)
   */
  async processExpiredRestrictions(): Promise<number> {
    const { data, error } = await supabase
      .from('user_restrictions')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('restriction_type', 'cannot_vouch')
      .eq('status', 'active')
      .lt('active_until', new Date().toISOString())
      .select('id');

    if (error) throw error;

    return data?.length || 0;
  }

  // --------------------------------------------------------------------------
  // VOUCH RELATIONSHIP QUERIES
  // --------------------------------------------------------------------------

  /**
   * Get all people a user has vouched for
   */
  async getVouchees(voucherUserId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('vouches')
      .select(`
        id,
        vouchee_id,
        vouch_status,
        vouchee_default_count,
        created_at,
        profiles:vouchee_id (
          full_name,
          email
        )
      `)
      .eq('voucher_id', voucherUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(v => ({
      vouchId: v.id,
      voucheeId: v.vouchee_id,
      voucheeName: (v.profiles as any)?.full_name || 'Unknown',
      voucheeEmail: (v.profiles as any)?.email,
      status: v.vouch_status,
      defaultCount: v.vouchee_default_count || 0,
      vouchedAt: v.created_at
    }));
  }

  /**
   * Get all people who have vouched for a user
   */
  async getVouchers(voucheeUserId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('vouches')
      .select(`
        id,
        voucher_id,
        vouch_status,
        created_at,
        profiles:voucher_id (
          full_name,
          email
        )
      `)
      .eq('vouchee_id', voucheeUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(v => ({
      vouchId: v.id,
      voucherId: v.voucher_id,
      voucherName: (v.profiles as any)?.full_name || 'Unknown',
      voucherEmail: (v.profiles as any)?.email,
      status: v.vouch_status,
      vouchedAt: v.created_at
    }));
  }

  // --------------------------------------------------------------------------
  // VOUCHER RECOVERY
  // --------------------------------------------------------------------------

  /**
   * Check if voucher can recover their standing through good behavior
   */
  async checkVoucherRecoveryEligibility(userId: string): Promise<{
    eligible: boolean;
    currentStatus: string;
    monthsSinceLastDefault: number;
    requiredMonths: number;
  }> {
    const standing = await this.getVoucherStanding(userId);

    // Get date of last vouchee default
    const { data: lastDefault } = await supabase
      .from('voucher_default_impacts')
      .select('created_at')
      .eq('voucher_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let monthsSinceLastDefault = 0;
    if (lastDefault) {
      const lastDefaultDate = new Date(lastDefault.created_at);
      const now = new Date();
      monthsSinceLastDefault = Math.floor(
        (now.getTime() - lastDefaultDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
    }

    // Requirements for recovery:
    // - 'warning' status: 6 months clean = back to 'good'
    // - 'poor' status: 9 months clean = upgrade to 'warning'
    // - 'restricted' status: 12 months clean = upgrade to 'poor'
    let requiredMonths = 6;
    if (standing.reliabilityStatus === 'poor') requiredMonths = 9;
    if (standing.reliabilityStatus === 'restricted') requiredMonths = 12;

    const eligible = monthsSinceLastDefault >= requiredMonths;

    return {
      eligible,
      currentStatus: standing.reliabilityStatus,
      monthsSinceLastDefault,
      requiredMonths
    };
  }

  /**
   * Process voucher recovery (upgrade status after clean period)
   */
  async processVoucherRecovery(userId: string): Promise<{
    upgraded: boolean;
    previousStatus: string;
    newStatus: string;
  }> {
    const eligibility = await this.checkVoucherRecoveryEligibility(userId);

    if (!eligibility.eligible) {
      return {
        upgraded: false,
        previousStatus: eligibility.currentStatus,
        newStatus: eligibility.currentStatus
      };
    }

    // Determine new status
    let newStatus = eligibility.currentStatus;
    if (eligibility.currentStatus === 'warning') newStatus = 'good';
    if (eligibility.currentStatus === 'poor') newStatus = 'warning';
    if (eligibility.currentStatus === 'restricted') newStatus = 'poor';

    if (newStatus === eligibility.currentStatus) {
      return {
        upgraded: false,
        previousStatus: eligibility.currentStatus,
        newStatus
      };
    }

    // If upgrading from restricted, lift the restriction
    if (eligibility.currentStatus === 'restricted') {
      const restriction = await this.getActiveVouchRestriction(userId);
      if (restriction) {
        await this.liftVouchRestriction(
          restriction.id,
          'system',
          'Automatic recovery after clean period'
        );
      }
    }

    // Send notification about status upgrade
    await supabase.from('scheduled_notifications').insert({
      user_id: userId,
      notification_type: 'voucher_status_upgraded',
      scheduled_for: new Date().toISOString(),
      notification_status: 'pending',
      payload: {
        previousStatus: eligibility.currentStatus,
        newStatus,
        monthsClean: eligibility.monthsSinceLastDefault
      }
    });

    return {
      upgraded: true,
      previousStatus: eligibility.currentStatus,
      newStatus
    };
  }

  // --------------------------------------------------------------------------
  // ANALYTICS & REPORTING
  // --------------------------------------------------------------------------

  /**
   * Get voucher network statistics for a community
   */
  async getCommunityVoucherStats(communityId: string): Promise<{
    totalVouches: number;
    activeVouches: number;
    vouchersWithDefaults: number;
    avgDefaultsPerVoucher: number;
    restrictedVouchers: number;
  }> {
    // This would need a proper query joining vouches to community
    // For now, return placeholder structure
    const { count: totalVouches } = await supabase
      .from('vouches')
      .select('*', { count: 'exact', head: true });

    const { count: activeVouches } = await supabase
      .from('vouches')
      .select('*', { count: 'exact', head: true })
      .eq('vouch_status', 'active');

    // Get vouchers with at least one default
    const { data: vouchersWithDefaults } = await supabase
      .from('voucher_default_impacts')
      .select('voucher_user_id')
      .eq('community_id', communityId);

    const uniqueVouchersWithDefaults = new Set(vouchersWithDefaults?.map(v => v.voucher_user_id) || []);

    // Get restricted vouchers count
    const { count: restrictedVouchers } = await supabase
      .from('user_restrictions')
      .select('*', { count: 'exact', head: true })
      .eq('restriction_type', 'cannot_vouch')
      .eq('status', 'active');

    // Calculate average defaults per voucher
    const { data: impacts } = await supabase
      .from('voucher_default_impacts')
      .select('voucher_user_id')
      .eq('community_id', communityId);

    const avgDefaultsPerVoucher = uniqueVouchersWithDefaults.size > 0
      ? (impacts?.length || 0) / uniqueVouchersWithDefaults.size
      : 0;

    return {
      totalVouches: totalVouches || 0,
      activeVouches: activeVouches || 0,
      vouchersWithDefaults: uniqueVouchersWithDefaults.size,
      avgDefaultsPerVoucher: Math.round(avgDefaultsPerVoucher * 100) / 100,
      restrictedVouchers: restrictedVouchers || 0
    };
  }

  /**
   * Get top vouchers by reliability in a community
   */
  async getTopVouchers(communityId: string, limit: number = 10): Promise<any[]> {
    // Get vouchers with their stats
    const { data: vouches } = await supabase
      .from('vouches')
      .select(`
        voucher_id,
        profiles:voucher_id (
          full_name
        )
      `)
      .eq('vouch_status', 'active');

    if (!vouches) return [];

    // Group by voucher and count
    const voucherCounts = new Map<string, { count: number; name: string }>();
    for (const vouch of vouches) {
      const existing = voucherCounts.get(vouch.voucher_id) || {
        count: 0,
        name: (vouch.profiles as any)?.full_name || 'Unknown'
      };
      existing.count++;
      voucherCounts.set(vouch.voucher_id, existing);
    }

    // Get default counts for each voucher
    const voucherIds = Array.from(voucherCounts.keys());
    const results = [];

    for (const voucherId of voucherIds) {
      const { count: defaultCount } = await supabase
        .from('voucher_default_impacts')
        .select('*', { count: 'exact', head: true })
        .eq('voucher_user_id', voucherId);

      const voucherData = voucherCounts.get(voucherId)!;
      results.push({
        userId: voucherId,
        name: voucherData.name,
        totalVouches: voucherData.count,
        voucheeDefaults: defaultCount || 0,
        reliabilityStatus: this.calculateReliabilityStatus(defaultCount || 0),
        successRate: voucherData.count > 0
          ? Math.round(((voucherData.count - (defaultCount || 0)) / voucherData.count) * 100)
          : 100
      });
    }

    // Sort by success rate, then by total vouches
    return results
      .sort((a, b) => {
        if (b.successRate !== a.successRate) return b.successRate - a.successRate;
        return b.totalVouches - a.totalVouches;
      })
      .slice(0, limit);
  }
}

// Export singleton instance
export const voucherCascadeService = new VoucherCascadeService();
