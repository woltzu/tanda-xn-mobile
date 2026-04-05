// ════════════���════════════════════════��════════════════════════════════════════
// EarlyInterventionEngine — Early Intervention System (Levels 1 & 2)
// Connects default_probability_scores → intervention levels → personalized
// messages → outcome tracking → auto-escalation
// ═══════���══════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type InterventionLevel = 1 | 2 | 3 | 4 | 5;
export type InterventionChannel = "in_app" | "push" | "sms" | "email";
export type InterventionLanguage = "fr" | "en" | "es" | "pt";
export type InterventionStatus =
  | "sent" | "viewed" | "engaged" | "accepted"
  | "paid" | "ignored" | "escalated" | "expired";

export type InterventionTone = "supportive" | "warm" | "direct" | "urgent";

export interface InterventionRule {
  id: string;
  level: InterventionLevel;
  scoreMin: number;
  scoreMax: number;
  daysBeforeDueMin: number;
  daysBeforeDueMax: number;
  optimalDaysBefore: number;
  autoEscalateAfterHours: number;
  maxPerCycle: number;
  cooldownHours: number;
  preferredChannel: InterventionChannel;
  fallbackChannel: InterventionChannel;
  isActive: boolean;
}

export interface InterventionTemplate {
  id: string;
  level: InterventionLevel;
  language: InterventionLanguage;
  messageKey: string;
  subject: string | null;
  body: string;
  ctaText: string | null;
  ctaAction: string | null;
  tone: InterventionTone;
  icon: string;
  color: string;
  options: InterventionOption[];
  isActive: boolean;
}

export interface InterventionOption {
  type: string;        // 'split_payment' | 'liquidity_advance' | 'pay_full' | 'cycle_pause'
  label: string;
  description: string;
}

export interface MemberIntervention {
  id: string;
  memberId: string;
  circleId: string | null;
  level: InterventionLevel;
  triggerScore: number;
  triggerBucket: string;
  triggerSource: string;
  channel: InterventionChannel;
  language: InterventionLanguage;
  messageKey: string;
  messageText: string;
  messageCta: string | null;
  contributionAmountCents: number | null;
  contributionDueDate: string | null;
  daysUntilDue: number | null;
  optionsOffered: InterventionOption[];
  status: InterventionStatus;
  responseAction: string | null;
  responseAt: string | null;
  escalatedToId: string | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  scheduledAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  engagedAt: string | null;
  defaultPrevented: boolean | null;
  outcomeRecordedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterventionDashboardRow {
  level: number;
  totalInterventions: number;
  defaultsPrevented: number;
  ignored: number;
  escalated: number;
  successCount: number;
  failureCount: number;
  successRatePct: number;
  avgResponseHours: number;
}

export interface MemberDefaultContext {
  memberId: string;
  circleId: string;
  circleName: string;
  memberName: string;
  defaultProbability: number;
  riskBucket: string;
  contributionAmountCents: number;
  contributionDueDate: string;
  daysUntilDue: number;
  preferredLanguage: InterventionLanguage;
  bestSendHour: number;        // 0-23
  communicationStyle: string;  // from notification_profiles
}

// ─── MAPPERS ──────���─────────────────────────────────────────────────────────

function mapRule(row: any): InterventionRule {
  return {
    id: row.id,
    level: row.level,
    scoreMin: parseFloat(row.score_min),
    scoreMax: parseFloat(row.score_max),
    daysBeforeDueMin: row.days_before_due_min,
    daysBeforeDueMax: row.days_before_due_max,
    optimalDaysBefore: row.optimal_days_before,
    autoEscalateAfterHours: row.auto_escalate_after_hours,
    maxPerCycle: row.max_per_cycle,
    cooldownHours: row.cooldown_hours,
    preferredChannel: row.preferred_channel,
    fallbackChannel: row.fallback_channel,
    isActive: row.is_active,
  };
}

function mapTemplate(row: any): InterventionTemplate {
  return {
    id: row.id,
    level: row.level,
    language: row.language,
    messageKey: row.message_key,
    subject: row.subject,
    body: row.body,
    ctaText: row.cta_text,
    ctaAction: row.cta_action,
    tone: row.tone,
    icon: row.icon,
    color: row.color,
    options: row.options ?? [],
    isActive: row.is_active,
  };
}

function mapIntervention(row: any): MemberIntervention {
  return {
    id: row.id,
    memberId: row.member_id,
    circleId: row.circle_id,
    level: row.level,
    triggerScore: parseFloat(row.trigger_score),
    triggerBucket: row.trigger_bucket,
    triggerSource: row.trigger_source,
    channel: row.channel,
    language: row.language,
    messageKey: row.message_key,
    messageText: row.message_text,
    messageCta: row.message_cta,
    contributionAmountCents: row.contribution_amount_cents,
    contributionDueDate: row.contribution_due_date,
    daysUntilDue: row.days_until_due,
    optionsOffered: row.options_offered ?? [],
    status: row.status,
    responseAction: row.response_action,
    responseAt: row.response_at,
    escalatedToId: row.escalated_to_id,
    escalatedAt: row.escalated_at,
    escalationReason: row.escalation_reason,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    engagedAt: row.engaged_at,
    defaultPrevented: row.default_prevented,
    outcomeRecordedAt: row.outcome_recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// EARLY INTERVENTION ENGINE
// ═════════════════════════��════════════════════════════════════════════════════

export class EarlyInterventionEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // A. RULES & TEMPLATES
  // ═════════════════════��═══════════════════════════════��═════════════════════

  /** Get active intervention rules */
  static async getRules(): Promise<InterventionRule[]> {
    const { data, error } = await supabase
      .from("intervention_rules")
      .select("*")
      .eq("is_active", true)
      .order("level");
    if (error) throw error;
    return (data ?? []).map(mapRule);
  }

  /** Get the rule for a specific score */
  static async getRuleForScore(score: number): Promise<InterventionRule | null> {
    const { data, error } = await supabase
      .from("intervention_rules")
      .select("*")
      .eq("is_active", true)
      .lte("score_min", score)
      .gte("score_max", score)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapRule(data) : null;
  }

  /** Determine intervention level from a 0-100 default probability score */
  static getLevel(score: number): InterventionLevel | null {
    if (score >= 86) return 5;
    if (score >= 76) return 4;
    if (score >= 61) return 3;
    if (score >= 46) return 2;
    if (score >= 31) return 1;
    return null; // Green zone, no intervention needed
  }

  /** Get templates for a level and language */
  static async getTemplates(level: InterventionLevel, language: InterventionLanguage): Promise<InterventionTemplate[]> {
    const { data, error } = await supabase
      .from("intervention_templates")
      .select("*")
      .eq("level", level)
      .eq("language", language)
      .eq("is_active", true);
    if (error) throw error;
    return (data ?? []).map(mapTemplate);
  }

  // ══════════════════════════════════��════════════════════════════════════════
  // B. MESSAGE PERSONALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Personalize a template with member-specific context */
  static personalizeMessage(template: InterventionTemplate, context: MemberDefaultContext): {
    text: string;
    subject: string | null;
    cta: string | null;
    options: InterventionOption[];
  } {
    const amount = (context.contributionAmountCents / 100).toFixed(0);
    const dueDate = new Date(context.contributionDueDate).toLocaleDateString(
      context.preferredLanguage === "fr" ? "fr-FR" : "en-US",
      { month: "long", day: "numeric" }
    );

    const replacements: Record<string, string> = {
      "{name}": context.memberName,
      "{amount}": amount,
      "{days}": String(context.daysUntilDue),
      "{circle}": context.circleName,
      "{date}": dueDate,
    };

    let text = template.body;
    let subject = template.subject;
    let cta = template.ctaText;

    // Apply replacements
    for (const [key, value] of Object.entries(replacements)) {
      text = text.replaceAll(key, value);
      if (subject) subject = subject.replaceAll(key, value);
      if (cta) cta = cta.replaceAll(key, value);
    }

    // Personalize options
    const options = (template.options ?? []).map(opt => ({
      ...opt,
      label: opt.label.replaceAll("${amount}", amount),
      description: opt.description.replaceAll("${amount}", amount),
    }));

    return { text, subject, cta, options };
  }

  /** Select best template variant for a member (A/B ready) */
  static selectTemplate(templates: InterventionTemplate[], context: MemberDefaultContext): InterventionTemplate {
    if (templates.length <= 1) return templates[0];

    // For Level 2: pick the advance-related template if member has existing advance, else basic split
    if (context.defaultProbability >= 46) {
      const advanceTemplate = templates.find(t => t.messageKey.includes("advance"));
      if (advanceTemplate && context.defaultProbability >= 50) return advanceTemplate;
    }

    // Default: first template
    return templates[0];
  }

  // ════════════════════════════════════���══════════════════════════��═══════════
  // C. INTERVENTION TRIGGER ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  /** Main trigger: evaluate a member and create intervention if needed */
  static async evaluateAndIntervene(context: MemberDefaultContext): Promise<MemberIntervention | null> {
    const level = this.getLevel(context.defaultProbability);

    // Green zone — no intervention needed
    if (!level) return null;

    // Only handle Levels 1 & 2 for now
    if (level > 2) {
      console.log(`[Intervention] Level ${level} for member ${context.memberId} — not yet implemented (Levels 3-5 coming soon)`);
      return null;
    }

    // Get the rule for this level
    const rules = await this.getRules();
    const rule = rules.find(r => r.level === level);
    if (!rule) return null;

    // Check timing: is contribution due within the valid window?
    if (context.daysUntilDue < rule.daysBeforeDueMin || context.daysUntilDue > rule.daysBeforeDueMax) {
      return null; // Outside intervention window
    }

    // Check cooldown: has this member received this level recently?
    const canIntervene = await this.checkCooldown(context.memberId, level, rule.cooldownHours, rule.maxPerCycle);
    if (!canIntervene) return null;

    // Get and personalize template
    const templates = await this.getTemplates(level, context.preferredLanguage);
    if (templates.length === 0) {
      // Fallback to English
      const enTemplates = await this.getTemplates(level, "en");
      if (enTemplates.length === 0) return null;
      templates.push(...enTemplates);
    }

    const template = this.selectTemplate(templates, context);
    const personalized = this.personalizeMessage(template, context);

    // Calculate optimal send time
    const scheduledAt = this.calculateOptimalSendTime(context.bestSendHour);

    // Create the intervention record
    const { data, error } = await supabase
      .from("member_interventions")
      .insert({
        member_id: context.memberId,
        circle_id: context.circleId,
        level,
        trigger_score: context.defaultProbability,
        trigger_bucket: context.riskBucket,
        trigger_source: "cron",
        channel: rule.preferredChannel,
        language: context.preferredLanguage,
        message_key: template.messageKey,
        message_text: personalized.text,
        message_cta: personalized.cta,
        contribution_amount_cents: context.contributionAmountCents,
        contribution_due_date: context.contributionDueDate,
        days_until_due: context.daysUntilDue,
        options_offered: personalized.options,
        status: "sent",
        sent_at: scheduledAt.toISOString(),
        scheduled_at: scheduledAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return mapIntervention(data);
  }

  /** Check if member is eligible for this intervention (cooldown + max per cycle) */
  static async checkCooldown(
    memberId: string,
    level: InterventionLevel,
    cooldownHours: number,
    maxPerCycle: number
  ): Promise<boolean> {
    const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();

    // Check recent interventions of same level
    const { data, error } = await supabase
      .from("member_interventions")
      .select("id, created_at")
      .eq("member_id", memberId)
      .eq("level", level)
      .gte("created_at", cooldownCutoff)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Exceeded max per cycle (approximate: check last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("member_interventions")
      .select("*", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("level", level)
      .gte("created_at", thirtyDaysAgo);

    if ((count ?? 0) >= maxPerCycle) return false;

    // Within cooldown period
    if ((data ?? []).length > 0) return false;

    return true;
  }

  /** Calculate optimal send time based on member's best hour */
  static calculateOptimalSendTime(bestHour: number): Date {
    const now = new Date();
    const scheduled = new Date(now);
    scheduled.setHours(bestHour, 0, 0, 0);

    // If that time already passed today, schedule for tomorrow
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    return scheduled;
  }

  // ══���═════════════════════════���═════════════════════════��════════════════════
  // D. MEMBER RESPONSE TRACKING
  // ═════════════��═════════════════════════════════════════════════════════════

  /** Mark intervention as viewed */
  static async markViewed(interventionId: string): Promise<void> {
    await supabase
      .from("member_interventions")
      .update({ status: "viewed" })
      .eq("id", interventionId)
      .in("status", ["sent"]);
  }

  /** Mark intervention as engaged (member tapped CTA or explored options) */
  static async markEngaged(interventionId: string): Promise<void> {
    await supabase
      .from("member_interventions")
      .update({ status: "engaged" })
      .eq("id", interventionId)
      .in("status", ["sent", "viewed"]);
  }

  /** Record member's choice from intervention options */
  static async recordResponse(interventionId: string, action: string): Promise<MemberIntervention> {
    const newStatus = action === "paid_full" || action === "pay_full" ? "paid" : "accepted";
    const { data, error } = await supabase
      .from("member_interventions")
      .update({
        status: newStatus,
        response_action: action,
      })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Mark intervention outcome (called after cycle close) */
  static async recordOutcome(interventionId: string, defaultPrevented: boolean): Promise<void> {
    await supabase
      .from("member_interventions")
      .update({
        default_prevented: defaultPrevented,
        outcome_recorded_at: new Date().toISOString(),
        status: defaultPrevented ? "paid" : "expired",
      })
      .eq("id", interventionId);
  }

  // ═══════════════════════════════════���════════════════════════════���══════════
  // E. AUTO-ESCALATION
  // ══���═══════════════════════════════════���════════════════════════════════════

  /** Check for interventions that need escalation (called by cron) */
  static async processEscalations(): Promise<number> {
    const rules = await this.getRules();
    let escalatedCount = 0;

    for (const rule of rules) {
      if (rule.level >= 3) continue; // Only handle L1→L2 escalation for now

      const cutoffHours = rule.autoEscalateAfterHours;
      const cutoff = new Date(Date.now() - cutoffHours * 60 * 60 * 1000).toISOString();

      // Find interventions at this level that were sent but not responded to
      const { data: staleInterventions, error } = await supabase
        .from("member_interventions")
        .select("*")
        .eq("level", rule.level)
        .in("status", ["sent", "viewed"])
        .lt("sent_at", cutoff)
        .is("escalated_to_id", null);

      if (error) throw error;

      for (const intervention of staleInterventions ?? []) {
        const nextLevel = (rule.level + 1) as InterventionLevel;
        if (nextLevel > 2) continue; // Cap at Level 2 for now

        // Get current score to verify escalation is still warranted
        const { data: scoreData } = await supabase
          .from("default_probability_scores")
          .select("predicted_probability, risk_bucket")
          .eq("user_id", intervention.member_id)
          .order("scored_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentScore = scoreData ? parseFloat(scoreData.predicted_probability) * 100 : 0;
        if (currentScore < 31) continue; // Score improved, no escalation needed

        // Create escalated intervention
        const templates = await this.getTemplates(nextLevel, intervention.language);
        if (templates.length === 0) continue;

        const template = templates[0];
        const personalized = this.personalizeMessage(template, {
          memberId: intervention.member_id,
          circleId: intervention.circle_id ?? "",
          circleName: "",
          memberName: intervention.message_text.split(",")[0] || "Member",
          defaultProbability: currentScore,
          riskBucket: scoreData?.risk_bucket ?? "moderate",
          contributionAmountCents: intervention.contribution_amount_cents ?? 0,
          contributionDueDate: intervention.contribution_due_date ?? "",
          daysUntilDue: intervention.days_until_due ?? 0,
          preferredLanguage: intervention.language,
          bestSendHour: 9,
          communicationStyle: "supportive",
        });

        const { data: escalated, error: escErr } = await supabase
          .from("member_interventions")
          .insert({
            member_id: intervention.member_id,
            circle_id: intervention.circle_id,
            level: nextLevel,
            trigger_score: currentScore,
            trigger_bucket: scoreData?.risk_bucket ?? "moderate",
            trigger_source: "escalation",
            channel: "push",
            language: intervention.language,
            message_key: template.messageKey,
            message_text: personalized.text,
            message_cta: personalized.cta,
            contribution_amount_cents: intervention.contribution_amount_cents,
            contribution_due_date: intervention.contribution_due_date,
            days_until_due: Math.max(0, (intervention.days_until_due ?? 0) - 2),
            options_offered: personalized.options,
            status: "sent",
            sent_at: new Date().toISOString(),
            scheduled_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (escErr) continue;

        // Mark original as escalated
        await supabase
          .from("member_interventions")
          .update({
            status: "escalated",
            escalated_to_id: escalated.id,
            escalation_reason: "ignored_48h",
          })
          .eq("id", intervention.id);

        escalatedCount++;
      }
    }

    return escalatedCount;
  }

  // ═══════════════════════════════════════════════════════════��═══════════════
  // F. QUERIES
  // ═════════════��═════════════════════════════════════════════════════════════

  /** Get active interventions for a member */
  static async getMemberInterventions(memberId: string): Promise<MemberIntervention[]> {
    const { data, error } = await supabase
      .from("member_interventions")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map(mapIntervention);
  }

  /** Get active (unresolved) interventions for a member */
  static async getActiveInterventions(memberId: string): Promise<MemberIntervention[]> {
    const { data, error } = await supabase
      .from("member_interventions")
      .select("*")
      .eq("member_id", memberId)
      .in("status", ["sent", "viewed", "engaged"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapIntervention);
  }

  /** Get the latest pending intervention for a member (for in-app display) */
  static async getLatestPendingIntervention(memberId: string): Promise<MemberIntervention | null> {
    const { data, error } = await supabase
      .from("member_interventions")
      .select("*")
      .eq("member_id", memberId)
      .in("status", ["sent", "viewed", "engaged"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapIntervention(data) : null;
  }

  /** Get intervention dashboard stats */
  static async getDashboard(): Promise<InterventionDashboardRow[]> {
    const { data, error } = await supabase
      .from("intervention_dashboard")
      .select("*");
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      level: row.level,
      totalInterventions: row.total_interventions ?? 0,
      defaultsPrevented: row.defaults_prevented ?? 0,
      ignored: row.ignored ?? 0,
      escalated: row.escalated ?? 0,
      successCount: row.success_count ?? 0,
      failureCount: row.failure_count ?? 0,
      successRatePct: parseFloat(row.success_rate_pct) || 0,
      avgResponseHours: parseFloat(row.avg_response_hours) || 0,
    }));
  }

  /** Calculate intervention effectiveness for model retraining */
  static async getEffectivenessMetrics(): Promise<{
    level1: { total: number; prevented: number; rate: number };
    level2: { total: number; prevented: number; rate: number };
    overall: { total: number; prevented: number; rate: number };
    avgTimeToRespond: number;
    mostEffectiveOption: string | null;
  }> {
    const dashboard = await this.getDashboard();

    const l1 = dashboard.find(d => d.level === 1) ?? { totalInterventions: 0, successCount: 0, successRatePct: 0, avgResponseHours: 0 } as any;
    const l2 = dashboard.find(d => d.level === 2) ?? { totalInterventions: 0, successCount: 0, successRatePct: 0, avgResponseHours: 0 } as any;
    const totalAll = l1.totalInterventions + l2.totalInterventions;
    const preventedAll = l1.successCount + l2.successCount;

    // Find most effective option from Level 2
    const { data: optionData } = await supabase
      .from("member_interventions")
      .select("response_action")
      .eq("level", 2)
      .eq("default_prevented", true)
      .not("response_action", "is", null);

    const optionCounts = new Map<string, number>();
    (optionData ?? []).forEach((r: any) => {
      optionCounts.set(r.response_action, (optionCounts.get(r.response_action) ?? 0) + 1);
    });
    let mostEffective: string | null = null;
    let maxCount = 0;
    optionCounts.forEach((count, option) => {
      if (count > maxCount) { maxCount = count; mostEffective = option; }
    });

    return {
      level1: { total: l1.totalInterventions, prevented: l1.successCount, rate: l1.successRatePct },
      level2: { total: l2.totalInterventions, prevented: l2.successCount, rate: l2.successRatePct },
      overall: { total: totalAll, prevented: preventedAll, rate: totalAll > 0 ? Math.round((preventedAll / totalAll) * 100) : 0 },
      avgTimeToRespond: (l1.avgResponseHours + l2.avgResponseHours) / 2,
      mostEffectiveOption: mostEffective,
    };
  }

  // ═════════════════════════════════��═════════════════════���═══════════════════
  // G. REALTIME
  // ═��══════════════════��═══════════════════════════════���══════════════════════

  /** Subscribe to member's interventions (for in-app banners) */
  static subscribeToInterventions(memberId: string, callback: (intervention: MemberIntervention) => void) {
    return supabase
      .channel(`interventions_${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "member_interventions",
          filter: `member_id=eq.${memberId}`,
        },
        (payload) => callback(mapIntervention(payload.new))
      )
      .subscribe();
  }
}
