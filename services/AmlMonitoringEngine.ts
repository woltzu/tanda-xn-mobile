/**
 * ══════════════════════════════════════════════════════════════════════════════
 * AML MONITORING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Rules-based Anti-Money Laundering monitoring engine. Evaluates transactions
 * against 8 configurable rules, generates alerts for human review, and
 * supports the full SAR filing workflow.
 *
 * CRITICAL: AML alerts, reviews, and SAR filings must NEVER be visible to the
 * subject member (Bank Secrecy Act tipping-off prohibition). All access is
 * service_role only.
 *
 * Sections:
 *   A — Rule Evaluation Engine    F — Member Status
 *   B — Rule Implementations      G — SAR Workflow
 *   C — Alert Management          H — Batch Scanning
 *   D — Auto-Actions              I — Statistics
 *   E — Review Workflow            J — Realtime
 */

import { supabase } from '@/lib/supabase';


// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type RuleCode =
  | 'STRUCTURING'
  | 'VELOCITY_ANOMALY'
  | 'ROUND_TRIP'
  | 'GEOGRAPHIC_INCONSISTENCY'
  | 'DORMANT_ACTIVATION'
  | 'MULTIPLE_FUNDING'
  | 'RAPID_BENEFICIARY_CHANGES'
  | 'CIRCLE_LAYERING';

export type RuleCategory =
  | 'structuring' | 'velocity' | 'round_trip' | 'geographic'
  | 'dormant' | 'funding' | 'beneficiary' | 'layering';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'reviewing' | 'cleared' | 'escalated' | 'sar_filed';
export type AlertResolution = 'false_positive' | 'suspicious_confirmed' | 'sar_required' | 'inconclusive';
export type AmlStatus = 'clear' | 'enhanced_monitoring' | 'restricted' | 'frozen';
export type ReviewAction =
  | 'note_added' | 'status_changed' | 'escalated'
  | 'restriction_applied' | 'restriction_lifted'
  | 'sar_initiated' | 'sar_filed' | 'cleared';
export type SarStatus = 'draft' | 'submitted' | 'accepted' | 'amended';
export type TriggerEvent =
  | 'contribution' | 'payout' | 'deposit' | 'withdrawal'
  | 'transfer' | 'any_transaction' | 'profile_update';
export type AutoAction = 'alert_only' | 'enhanced_monitoring' | 'restrict_account' | 'freeze_account';

export interface AmlRule {
  id: string;
  ruleCode: RuleCode;
  ruleName: string;
  description: string | null;
  category: RuleCategory;
  severity: AlertSeverity;
  triggerEvent: TriggerEvent;
  lookbackWindowDays: number;
  thresholds: Record<string, any>;
  actionOnTrigger: AutoAction;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AmlAlert {
  id: string;
  memberId: string;
  ruleId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  triggerDetails: Record<string, any>;
  transactionIds: string[];
  riskScore: number;
  autoActionTaken: string | null;
  assignedTo: string | null;
  assignedAt: string | null;
  reviewedBy: string | null;
  reviewDate: string | null;
  resolution: AlertResolution | null;
  resolutionNotes: string | null;
  escalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AmlReview {
  id: string;
  alertId: string;
  reviewerId: string;
  reviewAction: ReviewAction;
  previousStatus: string | null;
  newStatus: string | null;
  notes: string | null;
  evidence: Record<string, any>;
  createdAt: string;
}

export interface SarFiling {
  id: string;
  alertId: string;
  filingReference: string | null;
  filingDate: string | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  suspiciousActivitySummary: string | null;
  totalSuspiciousAmount: number | null;
  filedBy: string | null;
  filingStatus: SarStatus;
  fincenConfirmation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuleEvaluationResult {
  ruleCode: RuleCode;
  triggered: boolean;
  details: Record<string, any>;
  riskScore: number;
  transactionIds: string[];
}

export interface AlertCreateResult {
  alertId: string;
  severity: AlertSeverity;
  autoActionTaken: AutoAction | null;
  riskScore: number;
}

export interface BatchScanResult {
  processed: number;
  alertsCreated: number;
  errors: number;
  durationMs: number;
}

export interface AmlStats {
  totalAlerts: number;
  openAlerts: number;
  reviewingAlerts: number;
  clearedAlerts: number;
  escalatedAlerts: number;
  sarFiledAlerts: number;
  alertsBySeverity: Record<AlertSeverity, number>;
  alertsByRule: Record<string, number>;
  avgReviewTimeHours: number | null;
  totalSarFilings: number;
  pendingSarFilings: number;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS — snake_case DB → camelCase TypeScript
// ═══════════════════════════════════════════════════════════════════════════════

function mapRule(row: any): AmlRule {
  return {
    id: row.id,
    ruleCode: row.rule_code,
    ruleName: row.rule_name,
    description: row.description || null,
    category: row.category,
    severity: row.severity,
    triggerEvent: row.trigger_event,
    lookbackWindowDays: parseInt(row.lookback_window_days) || 30,
    thresholds: row.thresholds || {},
    actionOnTrigger: row.action_on_trigger,
    enabled: row.enabled ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAlert(row: any): AmlAlert {
  return {
    id: row.id,
    memberId: row.member_id,
    ruleId: row.rule_id,
    severity: row.severity,
    status: row.status,
    triggerDetails: row.trigger_details || {},
    transactionIds: row.transaction_ids || [],
    riskScore: parseFloat(row.risk_score) || 0,
    autoActionTaken: row.auto_action_taken || null,
    assignedTo: row.assigned_to || null,
    assignedAt: row.assigned_at || null,
    reviewedBy: row.reviewed_by || null,
    reviewDate: row.review_date || null,
    resolution: row.resolution || null,
    resolutionNotes: row.resolution_notes || null,
    escalatedAt: row.escalated_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReview(row: any): AmlReview {
  return {
    id: row.id,
    alertId: row.alert_id,
    reviewerId: row.reviewer_id,
    reviewAction: row.review_action,
    previousStatus: row.previous_status || null,
    newStatus: row.new_status || null,
    notes: row.notes || null,
    evidence: row.evidence || {},
    createdAt: row.created_at,
  };
}

function mapSarFiling(row: any): SarFiling {
  return {
    id: row.id,
    alertId: row.alert_id,
    filingReference: row.filing_reference || null,
    filingDate: row.filing_date || null,
    reportingPeriodStart: row.reporting_period_start || null,
    reportingPeriodEnd: row.reporting_period_end || null,
    suspiciousActivitySummary: row.suspicious_activity_summary || null,
    totalSuspiciousAmount: row.total_suspicious_amount ? parseFloat(row.total_suspicious_amount) : null,
    filedBy: row.filed_by || null,
    filingStatus: row.filing_status,
    fincenConfirmation: row.fincen_confirmation || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class AmlMonitoringEngine {

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION A — Rule Evaluation Engine
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Evaluate a transaction against all enabled rules that match the trigger event.
   * Creates alerts for any rules that fire and applies auto-actions.
   */
  static async evaluateTransaction(
    userId: string,
    transactionType: TriggerEvent,
    amount: number,
    transactionId?: string
  ): Promise<AlertCreateResult[]> {
    try {
      // Fetch all enabled rules
      const { data: rulesRaw, error: rulesError } = await supabase
        .from('aml_rules')
        .select('*')
        .eq('enabled', true);

      if (rulesError) throw rulesError;
      if (!rulesRaw || rulesRaw.length === 0) return [];

      const rules = rulesRaw.map(mapRule);

      // Filter rules by trigger_event: match specific event or 'any_transaction'
      const applicableRules = rules.filter(
        r => r.triggerEvent === transactionType || r.triggerEvent === 'any_transaction'
      );

      if (applicableRules.length === 0) return [];

      const results: AlertCreateResult[] = [];

      for (const rule of applicableRules) {
        try {
          const evalResult = await this._evaluateRule(userId, rule, amount, transactionId);

          if (evalResult.triggered) {
            const alert = await this._createAlert(userId, rule, evalResult);
            results.push(alert);

            // Apply auto-action if rule specifies one beyond alert_only
            if (rule.actionOnTrigger !== 'alert_only') {
              await this._applyAutoAction(alert.alertId, rule.actionOnTrigger, userId);
            }
          }
        } catch (err) {
          console.warn(`[AML] Rule ${rule.ruleCode} evaluation failed for user ${userId}:`, err);
        }
      }

      // Update last_aml_check timestamp
      await supabase
        .from('profiles')
        .update({ last_aml_check: new Date().toISOString() })
        .eq('id', userId);

      return results;
    } catch (err) {
      console.error('[AML] evaluateTransaction failed:', err);
      return [];
    }
  }

  /**
   * Route rule evaluation to the correct check method.
   */
  private static async _evaluateRule(
    userId: string,
    rule: AmlRule,
    amount: number,
    transactionId?: string
  ): Promise<RuleEvaluationResult> {
    switch (rule.ruleCode) {
      case 'STRUCTURING':
        return this._checkStructuring(userId, rule);
      case 'VELOCITY_ANOMALY':
        return this._checkVelocityAnomaly(userId, rule);
      case 'ROUND_TRIP':
        return this._checkRoundTrip(userId, rule);
      case 'GEOGRAPHIC_INCONSISTENCY':
        return this._checkGeographicInconsistency(userId, rule);
      case 'DORMANT_ACTIVATION':
        return this._checkDormantActivation(userId, rule, amount);
      case 'MULTIPLE_FUNDING':
        return this._checkMultipleFunding(userId, rule);
      case 'RAPID_BENEFICIARY_CHANGES':
        return this._checkRapidBeneficiaryChanges(userId, rule);
      case 'CIRCLE_LAYERING':
        return this._checkCircleLayering(userId, rule);
      default:
        return { ruleCode: rule.ruleCode, triggered: false, details: {}, riskScore: 0, transactionIds: [] };
    }
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION B — Rule Implementations (8 rules)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * STRUCTURING — Detects breaking large amounts into smaller transactions
   * to stay below reporting thresholds. Pattern: multiple transactions
   * totaling near $10,000 where no single transaction exceeds $9,000.
   */
  private static async _checkStructuring(
    userId: string,
    rule: AmlRule
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'STRUCTURING',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      min_transactions: number;
      total_amount: number;
      max_single: number;
    };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rule.lookbackWindowDays);

    // Get wallet for this user
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!wallet) return result;

    // Fetch recent transactions
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('id, amount, created_at')
      .eq('wallet_id', wallet.id)
      .in('type', ['deposit', 'contribution', 'transfer_in'])
      .gte('created_at', cutoff.toISOString())
      .eq('status', 'completed');

    if (!txns || txns.length < thresholds.min_transactions) return result;

    const amounts = txns.map(t => Math.abs(parseFloat(t.amount)));
    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
    const maxSingle = Math.max(...amounts);

    // Structuring pattern: total near threshold, no single txn above max_single
    if (
      txns.length >= thresholds.min_transactions &&
      totalAmount >= thresholds.total_amount &&
      maxSingle < thresholds.max_single
    ) {
      result.triggered = true;
      result.transactionIds = txns.map(t => t.id);
      result.riskScore = Math.min(100, (totalAmount / 10000) * 80 + (txns.length / 5) * 20);
      result.details = {
        transactionCount: txns.length,
        totalAmount,
        maxSingleAmount: maxSingle,
        lookbackDays: rule.lookbackWindowDays,
        thresholds,
      };
    }

    return result;
  }

  /**
   * VELOCITY_ANOMALY — Flags sudden dramatic increases in transaction
   * frequency or volume. Triggers when 7-day volume exceeds 300% of
   * 90-day weekly average.
   */
  private static async _checkVelocityAnomaly(
    userId: string,
    rule: AmlRule
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'VELOCITY_ANOMALY',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      multiplier: number;
      baseline_days: number;
    };

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!wallet) return result;

    const now = new Date();
    const baselineCutoff = new Date();
    baselineCutoff.setDate(now.getDate() - thresholds.baseline_days);
    const recentCutoff = new Date();
    recentCutoff.setDate(now.getDate() - rule.lookbackWindowDays);

    // Get baseline transactions (90-day)
    const { data: baselineTxns } = await supabase
      .from('wallet_transactions')
      .select('id, amount, created_at')
      .eq('wallet_id', wallet.id)
      .eq('status', 'completed')
      .gte('created_at', baselineCutoff.toISOString())
      .lt('created_at', recentCutoff.toISOString());

    // Get recent transactions (7-day)
    const { data: recentTxns } = await supabase
      .from('wallet_transactions')
      .select('id, amount, created_at')
      .eq('wallet_id', wallet.id)
      .eq('status', 'completed')
      .gte('created_at', recentCutoff.toISOString());

    if (!baselineTxns || baselineTxns.length === 0) return result;
    if (!recentTxns || recentTxns.length === 0) return result;

    const baselineTotal = baselineTxns.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    const baselineWeeks = Math.max(1, (thresholds.baseline_days - rule.lookbackWindowDays) / 7);
    const weeklyAvg = baselineTotal / baselineWeeks;

    const recentTotal = recentTxns.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    if (weeklyAvg > 0 && recentTotal >= weeklyAvg * thresholds.multiplier) {
      const multiplierActual = recentTotal / weeklyAvg;
      result.triggered = true;
      result.transactionIds = recentTxns.map(t => t.id);
      result.riskScore = Math.min(100, multiplierActual * 20);
      result.details = {
        recentVolume: recentTotal,
        weeklyAverage: weeklyAvg,
        multiplier: multiplierActual,
        recentTransactionCount: recentTxns.length,
        baselineDays: thresholds.baseline_days,
        lookbackDays: rule.lookbackWindowDays,
      };
    }

    return result;
  }

  /**
   * ROUND_TRIP — Identifies money entering the platform and exiting to a
   * different destination almost immediately with no apparent savings purpose.
   */
  private static async _checkRoundTrip(
    userId: string,
    rule: AmlRule
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'ROUND_TRIP',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      max_hours: number;
      min_amount: number;
    };

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!wallet) return result;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rule.lookbackWindowDays);

    // Get recent deposits
    const { data: deposits } = await supabase
      .from('wallet_transactions')
      .select('id, amount, created_at, reference_id, reference_type')
      .eq('wallet_id', wallet.id)
      .in('type', ['deposit', 'transfer_in'])
      .eq('status', 'completed')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: true });

    // Get recent withdrawals
    const { data: withdrawals } = await supabase
      .from('wallet_transactions')
      .select('id, amount, created_at, reference_id, reference_type')
      .eq('wallet_id', wallet.id)
      .in('type', ['withdrawal', 'transfer_out'])
      .eq('status', 'completed')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: true });

    if (!deposits || !withdrawals || deposits.length === 0 || withdrawals.length === 0) return result;

    // Check for deposit → withdrawal pairs within max_hours
    const pairs: Array<{ deposit: any; withdrawal: any; hoursDiff: number }> = [];

    for (const dep of deposits) {
      const depAmount = Math.abs(parseFloat(dep.amount));
      if (depAmount < thresholds.min_amount) continue;

      const depTime = new Date(dep.created_at).getTime();

      for (const wth of withdrawals) {
        const wthTime = new Date(wth.created_at).getTime();
        if (wthTime <= depTime) continue; // withdrawal must be after deposit

        const hoursDiff = (wthTime - depTime) / (1000 * 60 * 60);
        if (hoursDiff > thresholds.max_hours) continue;

        const wthAmount = Math.abs(parseFloat(wth.amount));
        // Withdrawal should be similar amount (within 20%)
        if (wthAmount >= depAmount * 0.8 && wthAmount <= depAmount * 1.2) {
          pairs.push({ deposit: dep, withdrawal: wth, hoursDiff });
        }
      }
    }

    if (pairs.length > 0) {
      const fastest = pairs.reduce((min, p) => p.hoursDiff < min.hoursDiff ? p : min, pairs[0]);
      result.triggered = true;
      result.transactionIds = [
        ...pairs.map(p => p.deposit.id),
        ...pairs.map(p => p.withdrawal.id),
      ];
      result.riskScore = Math.min(100, 60 + pairs.length * 15);
      result.details = {
        pairsFound: pairs.length,
        fastestPairHours: fastest.hoursDiff,
        totalDepositAmount: pairs.reduce((s, p) => s + Math.abs(parseFloat(p.deposit.amount)), 0),
        totalWithdrawalAmount: pairs.reduce((s, p) => s + Math.abs(parseFloat(p.withdrawal.amount)), 0),
      };
    }

    return result;
  }

  /**
   * GEOGRAPHIC_INCONSISTENCY — Flags transactions initiated from IP addresses
   * in multiple countries within a short time period.
   */
  private static async _checkGeographicInconsistency(
    userId: string,
    rule: AmlRule
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'GEOGRAPHIC_INCONSISTENCY',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      max_countries: number;
      max_hours: number;
    };

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - thresholds.max_hours);

    // Get recent user events with geo info
    const { data: events } = await supabase
      .from('user_events')
      .select('id, geo_country, ip_address, created_at, event_type')
      .eq('user_id', userId)
      .gte('created_at', cutoff.toISOString())
      .not('geo_country', 'is', null)
      .order('created_at', { ascending: true });

    if (!events || events.length < 2) return result;

    // Count distinct countries
    const countries = [...new Set(events.map(e => e.geo_country).filter(Boolean))];

    if (countries.length > thresholds.max_countries) {
      result.triggered = true;
      result.riskScore = Math.min(100, 40 + countries.length * 20);
      result.details = {
        countriesDetected: countries,
        countryCount: countries.length,
        eventCount: events.length,
        windowHours: thresholds.max_hours,
        events: events.map(e => ({
          country: e.geo_country,
          ip: e.ip_address,
          time: e.created_at,
          type: e.event_type,
        })),
      };
    }

    return result;
  }

  /**
   * DORMANT_ACTIVATION — Flags accounts with zero activity for 6+ months
   * that suddenly become highly active with large transactions.
   */
  private static async _checkDormantActivation(
    userId: string,
    rule: AmlRule,
    currentAmount: number
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'DORMANT_ACTIVATION',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      dormancy_days: number;
      min_reactivation_amount: number;
    };

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!wallet) return result;

    const now = new Date();
    const recentCutoff = new Date();
    recentCutoff.setDate(now.getDate() - 7); // Recent activity window

    // Get last transaction before the recent window
    const { data: priorTxns } = await supabase
      .from('wallet_transactions')
      .select('id, created_at')
      .eq('wallet_id', wallet.id)
      .eq('status', 'completed')
      .lt('created_at', recentCutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (!priorTxns || priorTxns.length === 0) {
      // No prior transactions — could be a new account, not dormant reactivation
      return result;
    }

    const lastActivityDate = new Date(priorTxns[0].created_at);
    const daysSinceLastActivity = (recentCutoff.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastActivity < thresholds.dormancy_days) return result;

    // Check if reactivation amount meets threshold
    const { data: recentTxns } = await supabase
      .from('wallet_transactions')
      .select('id, amount, created_at')
      .eq('wallet_id', wallet.id)
      .eq('status', 'completed')
      .gte('created_at', recentCutoff.toISOString());

    const recentTotal = (recentTxns || []).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    if (recentTotal >= thresholds.min_reactivation_amount || currentAmount >= thresholds.min_reactivation_amount) {
      result.triggered = true;
      result.transactionIds = (recentTxns || []).map(t => t.id);
      result.riskScore = Math.min(100, 50 + (daysSinceLastActivity / 365) * 30 + (recentTotal / 5000) * 20);
      result.details = {
        dormancyDays: Math.round(daysSinceLastActivity),
        lastActivityDate: lastActivityDate.toISOString(),
        reactivationAmount: recentTotal,
        currentTransactionAmount: currentAmount,
        recentTransactionCount: (recentTxns || []).length,
      };
    }

    return result;
  }

  /**
   * MULTIPLE_FUNDING — Detects multiple different funding sources sending
   * money to the same wallet within a short period.
   */
  private static async _checkMultipleFunding(
    userId: string,
    rule: AmlRule
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'MULTIPLE_FUNDING',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      max_sources: number;
      window_hours: number;
    };

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!wallet) return result;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - thresholds.window_hours);

    // Get recent deposits with reference info
    const { data: deposits } = await supabase
      .from('wallet_transactions')
      .select('id, amount, created_at, reference_id, reference_type, description')
      .eq('wallet_id', wallet.id)
      .in('type', ['deposit', 'transfer_in'])
      .eq('status', 'completed')
      .gte('created_at', cutoff.toISOString());

    if (!deposits || deposits.length < thresholds.max_sources) return result;

    // Count distinct funding sources using reference_id as proxy
    const sources = new Set<string>();
    for (const dep of deposits) {
      // Use reference_id or a hash of description as source identifier
      const sourceKey = dep.reference_id || dep.description || dep.id;
      sources.add(sourceKey);
    }

    if (sources.size > thresholds.max_sources) {
      result.triggered = true;
      result.transactionIds = deposits.map(d => d.id);
      result.riskScore = Math.min(100, 40 + sources.size * 15);
      result.details = {
        distinctSources: sources.size,
        depositCount: deposits.length,
        totalAmount: deposits.reduce((s, d) => s + Math.abs(parseFloat(d.amount)), 0),
        windowHours: thresholds.window_hours,
      };
    }

    return result;
  }

  /**
   * RAPID_BENEFICIARY_CHANGES — Flags members who change payout destination
   * bank accounts repeatedly in a short period before a large payout.
   */
  private static async _checkRapidBeneficiaryChanges(
    userId: string,
    rule: AmlRule
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'RAPID_BENEFICIARY_CHANGES',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      max_changes: number;
      window_days: number;
      min_payout_amount: number;
    };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - thresholds.window_days);

    // Count payout method changes in window (using created_at as proxy for changes)
    const { data: methods } = await supabase
      .from('payout_methods')
      .select('id, created_at, updated_at, method_type, bank_name')
      .eq('user_id', userId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false });

    // Also check for recently updated methods
    const { data: updatedMethods } = await supabase
      .from('payout_methods')
      .select('id, created_at, updated_at, method_type, bank_name')
      .eq('user_id', userId)
      .gte('updated_at', cutoff.toISOString())
      .neq('created_at', 'updated_at'); // Only updated, not just created

    const totalChanges = (methods?.length || 0) + (updatedMethods?.length || 0);

    if (totalChanges < thresholds.max_changes) return result;

    // Check for upcoming or recent large payouts
    const { data: recentPayouts } = await supabase
      .from('payouts')
      .select('id, amount, status, created_at')
      .eq('recipient_id', userId)
      .gte('created_at', cutoff.toISOString());

    const largePayouts = (recentPayouts || []).filter(
      p => parseFloat(p.amount) >= thresholds.min_payout_amount
    );

    if (totalChanges >= thresholds.max_changes) {
      result.triggered = true;
      result.transactionIds = largePayouts.map(p => p.id);
      result.riskScore = Math.min(100, 50 + totalChanges * 10 + largePayouts.length * 15);
      result.details = {
        beneficiaryChanges: totalChanges,
        newMethodsCreated: methods?.length || 0,
        methodsUpdated: updatedMethods?.length || 0,
        largePayoutsInWindow: largePayouts.length,
        largestPayoutAmount: largePayouts.length > 0
          ? Math.max(...largePayouts.map(p => parseFloat(p.amount)))
          : 0,
        windowDays: thresholds.window_days,
      };
    }

    return result;
  }

  /**
   * CIRCLE_LAYERING — Identifies members joining multiple circles simultaneously,
   * contributing to all, receiving payouts, and immediately withdrawing — using
   * the circle structure to move money rather than save.
   */
  private static async _checkCircleLayering(
    userId: string,
    rule: AmlRule
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleCode: 'CIRCLE_LAYERING',
      triggered: false,
      details: {},
      riskScore: 0,
      transactionIds: [],
    };

    const thresholds = rule.thresholds as {
      min_circles: number;
      max_days_join_to_withdraw: number;
      min_withdrawal_pct: number;
    };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rule.lookbackWindowDays);

    // Get active circle memberships
    const { data: memberships } = await supabase
      .from('circle_members')
      .select('id, circle_id, joined_at, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('joined_at', cutoff.toISOString());

    if (!memberships || memberships.length < thresholds.min_circles) return result;

    // Get contributions in these circles
    const circleIds = memberships.map(m => m.circle_id);
    const { data: contributions } = await supabase
      .from('contributions')
      .select('id, circle_id, amount, created_at')
      .eq('user_id', userId)
      .in('circle_id', circleIds)
      .eq('status', 'completed');

    // Get payouts from these circles
    const { data: payouts } = await supabase
      .from('payouts')
      .select('id, circle_id, amount, created_at, status')
      .eq('recipient_id', userId)
      .in('circle_id', circleIds)
      .eq('status', 'completed');

    if (!payouts || payouts.length === 0) return result;

    const totalContributed = (contributions || []).reduce((s, c) => s + parseFloat(c.amount), 0);
    const totalPaidOut = payouts.reduce((s, p) => s + parseFloat(p.amount), 0);

    // Get withdrawals after payouts
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    let withdrawalTotal = 0;
    if (wallet) {
      const { data: withdrawals } = await supabase
        .from('wallet_transactions')
        .select('id, amount, created_at')
        .eq('wallet_id', wallet.id)
        .in('type', ['withdrawal', 'transfer_out'])
        .eq('status', 'completed')
        .gte('created_at', cutoff.toISOString());

      withdrawalTotal = (withdrawals || []).reduce((s, w) => s + Math.abs(parseFloat(w.amount)), 0);
    }

    // Check if withdrawal percentage exceeds threshold
    const withdrawalPct = totalPaidOut > 0 ? (withdrawalTotal / totalPaidOut) * 100 : 0;

    if (
      memberships.length >= thresholds.min_circles &&
      withdrawalPct >= thresholds.min_withdrawal_pct
    ) {
      result.triggered = true;
      result.transactionIds = [
        ...(contributions || []).map(c => c.id),
        ...payouts.map(p => p.id),
      ];
      result.riskScore = Math.min(100, 50 + memberships.length * 10 + (withdrawalPct / 100) * 20);
      result.details = {
        activeCircles: memberships.length,
        totalContributed,
        totalPaidOut,
        totalWithdrawn: withdrawalTotal,
        withdrawalPercentage: withdrawalPct,
        circleIds,
        joinDates: memberships.map(m => ({ circleId: m.circle_id, joinedAt: m.joined_at })),
      };
    }

    return result;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION C — Alert Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create an alert record from a triggered rule evaluation.
   */
  private static async _createAlert(
    userId: string,
    rule: AmlRule,
    evalResult: RuleEvaluationResult
  ): Promise<AlertCreateResult> {
    const { data, error } = await supabase
      .from('aml_alerts')
      .insert({
        member_id: userId,
        rule_id: rule.id,
        severity: rule.severity,
        status: 'open',
        trigger_details: evalResult.details,
        transaction_ids: evalResult.transactionIds,
        risk_score: evalResult.riskScore,
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      alertId: data.id,
      severity: rule.severity,
      autoActionTaken: null,
      riskScore: evalResult.riskScore,
    };
  }

  /**
   * Get alerts with optional filters.
   */
  static async getAlerts(filters?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    memberId?: string;
    ruleCode?: RuleCode;
    limit?: number;
  }): Promise<AmlAlert[]> {
    let query = supabase
      .from('aml_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.memberId) query = query.eq('member_id', filters.memberId);
    if (filters?.limit) query = query.limit(filters.limit);

    // Filter by rule code requires a join via rule_id
    if (filters?.ruleCode) {
      const { data: ruleData } = await supabase
        .from('aml_rules')
        .select('id')
        .eq('rule_code', filters.ruleCode)
        .single();
      if (ruleData) query = query.eq('rule_id', ruleData.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapAlert);
  }

  /**
   * Get alerts for a specific member (service_role only).
   */
  static async getMemberAlerts(memberId: string): Promise<AmlAlert[]> {
    return this.getAlerts({ memberId });
  }

  /**
   * Get a single alert with its reviews.
   */
  static async getAlertDetails(alertId: string): Promise<{
    alert: AmlAlert;
    reviews: AmlReview[];
    rule: AmlRule | null;
  } | null> {
    const { data: alertRow, error } = await supabase
      .from('aml_alerts')
      .select('*')
      .eq('id', alertId)
      .single();

    if (error || !alertRow) return null;

    const alert = mapAlert(alertRow);

    // Fetch reviews
    const { data: reviewRows } = await supabase
      .from('aml_reviews')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: true });

    const reviews = (reviewRows || []).map(mapReview);

    // Fetch rule
    let rule: AmlRule | null = null;
    const { data: ruleRow } = await supabase
      .from('aml_rules')
      .select('*')
      .eq('id', alert.ruleId)
      .single();
    if (ruleRow) rule = mapRule(ruleRow);

    return { alert, reviews, rule };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION D — Auto-Actions
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Apply an automatic action based on rule configuration.
   * Updates member's AML status and creates an audit trail entry.
   */
  private static async _applyAutoAction(
    alertId: string,
    action: AutoAction,
    userId: string
  ): Promise<void> {
    let newStatus: AmlStatus;
    switch (action) {
      case 'enhanced_monitoring':
        newStatus = 'enhanced_monitoring';
        break;
      case 'restrict_account':
        newStatus = 'restricted';
        break;
      case 'freeze_account':
        newStatus = 'frozen';
        break;
      default:
        return; // alert_only — no status change
    }

    // Update the alert record
    await supabase
      .from('aml_alerts')
      .update({ auto_action_taken: action })
      .eq('id', alertId);

    // Fetch current member status
    const { data: profile } = await supabase
      .from('profiles')
      .select('aml_status')
      .eq('id', userId)
      .single();

    const previousStatus = profile?.aml_status || 'clear';

    // Only escalate severity — never downgrade
    const statusHierarchy: Record<AmlStatus, number> = {
      clear: 0,
      enhanced_monitoring: 1,
      restricted: 2,
      frozen: 3,
    };

    if (statusHierarchy[newStatus] <= statusHierarchy[previousStatus as AmlStatus]) return;

    // Update member AML status
    await supabase
      .from('profiles')
      .update({
        aml_status: newStatus,
        aml_restriction_reason: `Auto-action from alert ${alertId}: ${action}`,
      })
      .eq('id', userId);

    // Create audit trail entry
    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: alertId,
        reviewer_id: userId, // system action, logged under member id
        review_action: 'restriction_applied',
        previous_status: previousStatus,
        new_status: newStatus,
        notes: `Automatic ${action} applied by AML monitoring engine`,
        evidence: { auto: true, action, alertId },
      });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION E — Review Workflow
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assign an alert to a reviewer.
   */
  static async assignAlert(
    alertId: string,
    assigneeId: string
  ): Promise<void> {
    const { data: alert } = await supabase
      .from('aml_alerts')
      .select('status')
      .eq('id', alertId)
      .single();

    if (!alert) throw new Error('Alert not found');

    const previousStatus = alert.status;

    await supabase
      .from('aml_alerts')
      .update({
        assigned_to: assigneeId,
        assigned_at: new Date().toISOString(),
        status: 'reviewing',
      })
      .eq('id', alertId);

    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: alertId,
        reviewer_id: assigneeId,
        review_action: 'status_changed',
        previous_status: previousStatus,
        new_status: 'reviewing',
        notes: `Alert assigned for review`,
      });
  }

  /**
   * Add a review note to an alert.
   */
  static async addReviewNote(
    alertId: string,
    reviewerId: string,
    notes: string,
    evidence?: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: alertId,
        reviewer_id: reviewerId,
        review_action: 'note_added',
        notes,
        evidence: evidence || {},
      });
  }

  /**
   * Resolve an alert with a determination.
   */
  static async resolveAlert(
    alertId: string,
    reviewerId: string,
    resolution: AlertResolution,
    notes: string
  ): Promise<void> {
    const { data: alert } = await supabase
      .from('aml_alerts')
      .select('status, member_id')
      .eq('id', alertId)
      .single();

    if (!alert) throw new Error('Alert not found');

    const previousStatus = alert.status;
    const newStatus: AlertStatus = resolution === 'sar_required' ? 'sar_filed' : 'cleared';

    await supabase
      .from('aml_alerts')
      .update({
        status: newStatus,
        reviewed_by: reviewerId,
        review_date: new Date().toISOString(),
        resolution,
        resolution_notes: notes,
      })
      .eq('id', alertId);

    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: alertId,
        reviewer_id: reviewerId,
        review_action: 'cleared',
        previous_status: previousStatus,
        new_status: newStatus,
        notes,
      });

    // If cleared as false_positive, check if all member alerts are cleared
    if (resolution === 'false_positive') {
      const { data: openAlerts } = await supabase
        .from('aml_alerts')
        .select('id')
        .eq('member_id', alert.member_id)
        .not('status', 'in', '("cleared")');

      // If no more open alerts, consider lifting restrictions
      if (!openAlerts || openAlerts.length <= 1) {
        // The 1 accounts for the just-resolved alert if update hasn't committed
        try {
          await this.updateAmlStatus(alert.member_id, 'clear');
        } catch (err) {
          console.warn('[AML] Failed to auto-clear member status:', err);
        }
      }
    }
  }

  /**
   * Escalate an alert.
   */
  static async escalateAlert(
    alertId: string,
    reviewerId: string,
    notes: string
  ): Promise<void> {
    const { data: alert } = await supabase
      .from('aml_alerts')
      .select('status')
      .eq('id', alertId)
      .single();

    if (!alert) throw new Error('Alert not found');

    await supabase
      .from('aml_alerts')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: alertId,
        reviewer_id: reviewerId,
        review_action: 'escalated',
        previous_status: alert.status,
        new_status: 'escalated',
        notes,
      });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION F — Member Status
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update a member's AML status.
   */
  static async updateAmlStatus(
    userId: string,
    status: AmlStatus,
    reason?: string
  ): Promise<void> {
    const updateData: Record<string, any> = { aml_status: status };
    if (reason) updateData.aml_restriction_reason = reason;
    if (status === 'clear') updateData.aml_restriction_reason = null;

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Get a member's current AML status.
   */
  static async getAmlStatus(userId: string): Promise<{
    amlStatus: AmlStatus;
    restrictionReason: string | null;
    lastAmlCheck: string | null;
  }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('aml_status, aml_restriction_reason, last_aml_check')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      amlStatus: (data?.aml_status as AmlStatus) || 'clear',
      restrictionReason: data?.aml_restriction_reason || null,
      lastAmlCheck: data?.last_aml_check || null,
    };
  }

  /**
   * Quick check: is the member clear for transactions?
   */
  static async isMemberClear(userId: string): Promise<boolean> {
    const status = await this.getAmlStatus(userId);
    return status.amlStatus === 'clear' || status.amlStatus === 'enhanced_monitoring';
  }

  /**
   * Lift a restriction on a member with audit trail.
   */
  static async liftRestriction(
    userId: string,
    reviewerId: string,
    alertId: string,
    notes: string
  ): Promise<void> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('aml_status')
      .eq('id', userId)
      .single();

    const previousStatus = profile?.aml_status || 'restricted';

    await this.updateAmlStatus(userId, 'clear');

    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: alertId,
        reviewer_id: reviewerId,
        review_action: 'restriction_lifted',
        previous_status: previousStatus,
        new_status: 'clear',
        notes,
      });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION G — SAR Workflow
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initiate a SAR filing draft.
   */
  static async initiateSar(
    alertId: string,
    filedBy: string,
    summary: string,
    totalAmount: number,
    periodStart: string,
    periodEnd: string
  ): Promise<SarFiling> {
    const { data, error } = await supabase
      .from('sar_filings')
      .insert({
        alert_id: alertId,
        filed_by: filedBy,
        suspicious_activity_summary: summary,
        total_suspicious_amount: totalAmount,
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
        filing_status: 'draft',
      })
      .select('*')
      .single();

    if (error) throw error;

    // Update alert status
    await supabase
      .from('aml_alerts')
      .update({ status: 'sar_filed' })
      .eq('id', alertId);

    // Create audit trail entry
    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: alertId,
        reviewer_id: filedBy,
        review_action: 'sar_initiated',
        notes: `SAR draft initiated: ${summary.substring(0, 100)}`,
      });

    return mapSarFiling(data);
  }

  /**
   * Submit a SAR filing (mark as submitted with reference).
   */
  static async submitSar(
    sarId: string,
    filingReference: string,
    fincenConfirmation?: string
  ): Promise<void> {
    const { data: sar } = await supabase
      .from('sar_filings')
      .select('alert_id, filed_by')
      .eq('id', sarId)
      .single();

    if (!sar) throw new Error('SAR filing not found');

    await supabase
      .from('sar_filings')
      .update({
        filing_status: 'submitted',
        filing_reference: filingReference,
        filing_date: new Date().toISOString().split('T')[0],
        fincen_confirmation: fincenConfirmation || null,
      })
      .eq('id', sarId);

    // Audit trail
    await supabase
      .from('aml_reviews')
      .insert({
        alert_id: sar.alert_id,
        reviewer_id: sar.filed_by,
        review_action: 'sar_filed',
        notes: `SAR submitted with reference: ${filingReference}`,
        evidence: { sarId, filingReference, fincenConfirmation },
      });
  }

  /**
   * Get SAR filings with optional filters.
   */
  static async getSarFilings(filters?: {
    alertId?: string;
    status?: SarStatus;
    limit?: number;
  }): Promise<SarFiling[]> {
    let query = supabase
      .from('sar_filings')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.alertId) query = query.eq('alert_id', filters.alertId);
    if (filters?.status) query = query.eq('filing_status', filters.status);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapSarFiling);
  }

  /**
   * Get a single SAR filing by ID.
   */
  static async getSarDetails(sarId: string): Promise<SarFiling | null> {
    const { data, error } = await supabase
      .from('sar_filings')
      .select('*')
      .eq('id', sarId)
      .single();

    if (error || !data) return null;
    return mapSarFiling(data);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION H — Batch Scanning
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Scan all active members against all enabled rules.
   * Used by the weekly cron job. Processes in batches of 50.
   */
  static async scanAllActiveMembers(): Promise<BatchScanResult> {
    const startTime = Date.now();
    let processed = 0;
    let alertsCreated = 0;
    let errors = 0;

    try {
      // Get all active members (those with wallet activity)
      const { data: members, error } = await supabase
        .from('profiles')
        .select('id')
        .order('id');

      if (error) throw error;
      if (!members || members.length === 0) {
        return { processed: 0, alertsCreated: 0, errors: 0, durationMs: Date.now() - startTime };
      }

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize);

        for (const member of batch) {
          try {
            const results = await this.evaluateTransaction(
              member.id,
              'any_transaction',
              0 // batch scan doesn't have a specific amount
            );
            processed++;
            alertsCreated += results.length;
          } catch (err) {
            errors++;
            console.warn(`[AML] Batch scan error for member ${member.id}:`, err);
          }
        }

        // 1-second delay between batches to avoid overwhelming the DB
        if (i + batchSize < members.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (err) {
      console.error('[AML] Batch scan failed:', err);
    }

    return {
      processed,
      alertsCreated,
      errors,
      durationMs: Date.now() - startTime,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION I — Statistics
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get aggregate AML statistics for the compliance dashboard.
   */
  static async getAmlStats(): Promise<AmlStats> {
    // Total alerts by status
    const { data: alertRows } = await supabase
      .from('aml_alerts')
      .select('id, status, severity, rule_id, created_at, review_date');

    const alerts = alertRows || [];

    const totalAlerts = alerts.length;
    const openAlerts = alerts.filter(a => a.status === 'open').length;
    const reviewingAlerts = alerts.filter(a => a.status === 'reviewing').length;
    const clearedAlerts = alerts.filter(a => a.status === 'cleared').length;
    const escalatedAlerts = alerts.filter(a => a.status === 'escalated').length;
    const sarFiledAlerts = alerts.filter(a => a.status === 'sar_filed').length;

    // By severity
    const alertsBySeverity: Record<AlertSeverity, number> = {
      low: alerts.filter(a => a.severity === 'low').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      high: alerts.filter(a => a.severity === 'high').length,
      critical: alerts.filter(a => a.severity === 'critical').length,
    };

    // By rule — need rule codes
    const { data: rules } = await supabase
      .from('aml_rules')
      .select('id, rule_code');

    const ruleMap = new Map((rules || []).map(r => [r.id, r.rule_code]));
    const alertsByRule: Record<string, number> = {};
    for (const alert of alerts) {
      const ruleCode = ruleMap.get(alert.rule_id) || 'unknown';
      alertsByRule[ruleCode] = (alertsByRule[ruleCode] || 0) + 1;
    }

    // Average review time
    const reviewedAlerts = alerts.filter(a => a.review_date && a.created_at);
    let avgReviewTimeHours: number | null = null;
    if (reviewedAlerts.length > 0) {
      const totalHours = reviewedAlerts.reduce((sum, a) => {
        const created = new Date(a.created_at).getTime();
        const reviewed = new Date(a.review_date).getTime();
        return sum + (reviewed - created) / (1000 * 60 * 60);
      }, 0);
      avgReviewTimeHours = totalHours / reviewedAlerts.length;
    }

    // SAR filings
    const { data: sarRows } = await supabase
      .from('sar_filings')
      .select('id, filing_status');

    const totalSarFilings = (sarRows || []).length;
    const pendingSarFilings = (sarRows || []).filter(s => s.filing_status === 'draft').length;

    return {
      totalAlerts,
      openAlerts,
      reviewingAlerts,
      clearedAlerts,
      escalatedAlerts,
      sarFiledAlerts,
      alertsBySeverity,
      alertsByRule,
      avgReviewTimeHours,
      totalSarFilings,
      pendingSarFilings,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION J — Realtime
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to all AML alert changes (for compliance dashboard).
   */
  static subscribeToAlerts(callback: () => void) {
    return supabase
      .channel('aml-alerts-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'aml_alerts' },
        () => { callback(); }
      )
      .subscribe();
  }

  /**
   * Subscribe to alerts for a specific member.
   */
  static subscribeToMemberAlerts(memberId: string, callback: () => void) {
    return supabase
      .channel(`aml-alerts-${memberId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aml_alerts',
          filter: `member_id=eq.${memberId}`,
        },
        () => { callback(); }
      )
      .subscribe();
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION K — Rules Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all AML rules.
   */
  static async getRules(enabledOnly = false): Promise<AmlRule[]> {
    let query = supabase
      .from('aml_rules')
      .select('*')
      .order('category');

    if (enabledOnly) query = query.eq('enabled', true);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapRule);
  }

  /**
   * Get a single rule by code.
   */
  static async getRuleByCode(code: RuleCode): Promise<AmlRule | null> {
    const { data, error } = await supabase
      .from('aml_rules')
      .select('*')
      .eq('rule_code', code)
      .single();

    if (error || !data) return null;
    return mapRule(data);
  }
}
