/**
 * ══════════════════════════════════════════════════════════════════════════════
 * EXPLAINABLE AI ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Every AI decision affecting a member gets a plain-language explanation in
 * the member's preferred language. Pre-built templates with [PLACEHOLDER]
 * slots filled at generation time. No runtime translation services.
 *
 * Sections:
 *   A — Template Management        E — Notification Integration
 *   B — Language Resolution         F — Convenience Methods (8 types)
 *   C — Explanation Generation      G — Realtime
 *   D — Decision History
 */

import { supabase } from '@/lib/supabase';


// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DecisionType =
  | 'xnscore_increase'
  | 'xnscore_decrease'
  | 'circle_join_rejection'
  | 'liquidity_denial'
  | 'tier_advancement'
  | 'tier_demotion'
  | 'payout_position'
  | 'intervention_message';

export type SupportedLanguage =
  | 'en' | 'fr' | 'es' | 'pt' | 'hi' | 'tl' | 'zh'
  | 'vi' | 'ko' | 'ar' | 'am' | 'sw' | 'yo' | 'ha' | 'ht';

export interface ExplanationTemplate {
  id: string;
  decisionType: DecisionType;
  language: SupportedLanguage;
  templateText: string;
  requiredVariables: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIDecision {
  id: string;
  memberId: string;
  decisionType: DecisionType;
  decisionValue: string | null;
  explanationKey: string;
  explanationData: Record<string, any>;
  renderedExplanation: string | null;
  language: SupportedLanguage;
  sourceEventId: string | null;
  sourceEventType: string | null;
  notificationSent: boolean;
  createdAt: string;
}

export interface GenerateExplanationResult {
  decisionId: string;
  renderedText: string;
  language: SupportedLanguage;
  decisionType: DecisionType;
  notificationSent: boolean;
}

export interface DecisionHistoryFilters {
  decisionType?: DecisionType;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface DecisionStats {
  totalDecisions: number;
  byType: Record<string, number>;
  mostRecent: AIDecision | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// VALID LANGUAGES SET
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_LANGUAGES = new Set<string>([
  'en', 'fr', 'es', 'pt', 'hi', 'tl', 'zh',
  'vi', 'ko', 'ar', 'am', 'sw', 'yo', 'ha', 'ht',
]);


// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGER DESCRIPTIONS — Maps ScoreAdjustmentTrigger to human-readable text
// ═══════════════════════════════════════════════════════════════════════════════

const TRIGGER_DESCRIPTIONS: Record<string, Record<SupportedLanguage, string>> = {
  contribution_on_time: {
    en: 'making your contribution on time',
    fr: 'ton paiement à l\'heure',
    es: 'realizar tu contribución a tiempo',
    pt: 'fazer sua contribuição no prazo',
    hi: 'apna yogdaan samay par dena',
    tl: 'pagbibigay ng iyong kontribusyon sa oras',
    zh: '按时缴纳您的贡献',
    vi: 'đóng góp đúng hạn',
    ko: '제시간에 기여금을 납부한 것',
    ar: 'دفع مساهمتك في الوقت المحدد',
    am: 'መዋጮህን በሰዓቱ መክፈል',
    sw: 'kulipa mchango wako kwa wakati',
    yo: 'ṣe owo-ori rẹ ni akoko',
    ha: 'biyan gudummawar ka a kan lokaci',
    ht: 'peye kontribisyon ou alè',
  },
  contribution_early: {
    en: 'making your contribution early',
    fr: 'ton paiement en avance',
    es: 'realizar tu contribución antes de tiempo',
    pt: 'fazer sua contribuição antecipadamente',
    hi: 'apna yogdaan jaldi dena',
    tl: 'maagang pagbibigay ng iyong kontribusyon',
    zh: '提前缴纳您的贡献',
    vi: 'đóng góp sớm',
    ko: '기여금을 일찍 납부한 것',
    ar: 'دفع مساهمتك مبكرًا',
    am: 'መዋጮህን ቀድመህ መክፈል',
    sw: 'kulipa mchango wako mapema',
    yo: 'ṣe owo-ori rẹ ni kutukutu',
    ha: 'biyan gudummawar ka da wuri',
    ht: 'peye kontribisyon ou bonè',
  },
  contribution_late: {
    en: 'a late contribution payment',
    fr: 'un paiement en retard',
    es: 'un pago de contribución tardío',
    pt: 'um pagamento de contribuição atrasado',
    hi: 'deri se yogdaan ka bhugtan',
    tl: 'huling pagbabayad ng kontribusyon',
    zh: '逾期缴纳贡献',
    vi: 'đóng góp trễ hạn',
    ko: '기여금 연체 납부',
    ar: 'تأخر في دفع المساهمة',
    am: 'ዘግይቶ የተከፈለ መዋጮ',
    sw: 'malipo ya mchango yamechelewa',
    yo: 'isanwo owo-ori ti pẹ',
    ha: 'biyan gudummawa da latti',
    ht: 'yon peman kontribisyon an reta',
  },
  contribution_default: {
    en: 'a missed contribution (default)',
    fr: 'un paiement manqué (défaut)',
    es: 'una contribución no pagada (incumplimiento)',
    pt: 'uma contribuição não paga (inadimplência)',
    hi: 'ek chhootee hui yogdaan (default)',
    tl: 'isang hindi nabayarang kontribusyon (default)',
    zh: '未缴贡献（违约）',
    vi: 'không đóng góp (mặc định)',
    ko: '미납 기여금 (채무불이행)',
    ar: 'مساهمة فائتة (تخلف)',
    am: 'ያልተከፈለ መዋጮ (ዲፎልት)',
    sw: 'mchango ambao haukufanywa (default)',
    yo: 'owo-ori ti o padanu (aiyipada)',
    ha: 'gudummawar da aka rasa (tsohuwa)',
    ht: 'yon kontribisyon ki manke (defo)',
  },
  circle_completed: {
    en: 'completing a savings circle',
    fr: 'avoir terminé un cercle d\'épargne',
    es: 'completar un círculo de ahorro',
    pt: 'concluir um círculo de poupança',
    hi: 'ek bachat circle poora karna',
    tl: 'pagkumpleto ng isang savings circle',
    zh: '完成一个储蓄圈',
    vi: 'hoàn thành một vòng tiết kiệm',
    ko: '저축 서클 완료',
    ar: 'إكمال حلقة ادخار',
    am: 'የቁጠባ ክበብ ማጠናቀቅ',
    sw: 'kukamilisha duara la akiba',
    yo: 'pari ẹgbẹ ifowopamọ kan',
    ha: 'kammala da\'irar ajiya',
    ht: 'fini yon sèk epay',
  },
  first_circle_bonus: {
    en: 'completing your very first savings circle',
    fr: 'avoir terminé ton tout premier cercle d\'épargne',
    es: 'completar tu primer círculo de ahorro',
    pt: 'concluir seu primeiro círculo de poupança',
    hi: 'apna pehla bachat circle poora karna',
    tl: 'pagkumpleto ng iyong pinakaunang savings circle',
    zh: '完成您的第一个储蓄圈',
    vi: 'hoàn thành vòng tiết kiệm đầu tiên',
    ko: '첫 번째 저축 서클 완료',
    ar: 'إكمال أول حلقة ادخار لك',
    am: 'የመጀመሪያ የቁጠባ ክበብህን ማጠናቀቅ',
    sw: 'kukamilisha duara lako la kwanza la akiba',
    yo: 'pari ẹgbẹ ifowopamọ akọkọ rẹ',
    ha: 'kammala da\'irar ajiya ta farko',
    ht: 'fini premye sèk epay ou',
  },
  payment_streak_10: {
    en: 'maintaining a 10 on-time payment streak',
    fr: 'avoir maintenu 10 paiements consécutifs à l\'heure',
    es: 'mantener una racha de 10 pagos puntuales',
    pt: 'manter uma sequência de 10 pagamentos pontuais',
    hi: '10 samay par bhugtan ki series banana',
    tl: 'pagpapanatili ng 10 sunud-sunod na bayad sa oras',
    zh: '保持连续10次按时付款',
    vi: 'duy trì chuỗi 10 lần thanh toán đúng hạn',
    ko: '10회 연속 제시간 납부',
    ar: 'الحفاظ على سلسلة 10 دفعات في الوقت المحدد',
    am: '10 ተከታታይ በሰዓቱ ክፍያዎች',
    sw: 'kudumisha mfululizo wa malipo 10 kwa wakati',
    yo: 'tọju ilana isanwo 10 ni akoko',
    ha: 'ci gaba da jerin biya 10 a kan lokaci',
    ht: 'kenbe yon seri 10 peman alè',
  },
  payment_streak_25: {
    en: 'maintaining a 25 on-time payment streak',
    fr: 'avoir maintenu 25 paiements consécutifs à l\'heure',
    es: 'mantener una racha de 25 pagos puntuales',
    pt: 'manter uma sequência de 25 pagamentos pontuais',
    hi: '25 samay par bhugtan ki series banana',
    tl: 'pagpapanatili ng 25 sunud-sunod na bayad sa oras',
    zh: '保持连续25次按时付款',
    vi: 'duy trì chuỗi 25 lần thanh toán đúng hạn',
    ko: '25회 연속 제시간 납부',
    ar: 'الحفاظ على سلسلة 25 دفعة في الوقت المحدد',
    am: '25 ተከታታይ በሰዓቱ ክፍያዎች',
    sw: 'kudumisha mfululizo wa malipo 25 kwa wakati',
    yo: 'tọju ilana isanwo 25 ni akoko',
    ha: 'ci gaba da jerin biya 25 a kan lokaci',
    ht: 'kenbe yon seri 25 peman alè',
  },
  payment_streak_50: {
    en: 'maintaining a 50 on-time payment streak',
    fr: 'avoir maintenu 50 paiements consécutifs à l\'heure',
    es: 'mantener una racha de 50 pagos puntuales',
    pt: 'manter uma sequência de 50 pagamentos pontuais',
    hi: '50 samay par bhugtan ki series banana',
    tl: 'pagpapanatili ng 50 sunud-sunod na bayad sa oras',
    zh: '保持连续50次按时付款',
    vi: 'duy trì chuỗi 50 lần thanh toán đúng hạn',
    ko: '50회 연속 제시간 납부',
    ar: 'الحفاظ على سلسلة 50 دفعة في الوقت المحدد',
    am: '50 ተከታታይ በሰዓቱ ክፍያዎች',
    sw: 'kudumisha mfululizo wa malipo 50 kwa wakati',
    yo: 'tọju ilana isanwo 50 ni akoko',
    ha: 'ci gaba da jerin biya 50 a kan lokaci',
    ht: 'kenbe yon seri 50 peman alè',
  },
  vouch_received: {
    en: 'receiving a vouch from another member',
    fr: 'avoir reçu un soutien d\'un autre membre',
    es: 'recibir un aval de otro miembro',
    pt: 'receber um aval de outro membro',
    hi: 'kisi aur sadasya se vouch milna',
    tl: 'pagtanggap ng vouch mula sa ibang miyembro',
    zh: '收到其他会员的担保',
    vi: 'nhận được lời bảo đảm từ thành viên khác',
    ko: '다른 회원으로부터 보증 받음',
    ar: 'تلقي ضمان من عضو آخر',
    am: 'ከሌላ አባል ዋስትና መቀበል',
    sw: 'kupokea dhamana kutoka kwa mwanachama mwingine',
    yo: 'gbigba ẹri lati ọdọ ọmọ ẹgbẹ miiran',
    ha: 'samun lamuni daga wani memba',
    ht: 'resevwa yon garanti nan men yon lòt manm',
  },
  vouch_given: {
    en: 'giving a vouch to another member',
    fr: 'avoir soutenu un autre membre',
    es: 'dar un aval a otro miembro',
    pt: 'dar um aval a outro membro',
    hi: 'kisi aur sadasya ko vouch dena',
    tl: 'pagbibigay ng vouch sa ibang miyembro',
    zh: '为其他会员提供担保',
    vi: 'bảo đảm cho thành viên khác',
    ko: '다른 회원에게 보증 제공',
    ar: 'منح ضمان لعضو آخر',
    am: 'ለሌላ አባል ዋስትና መስጠት',
    sw: 'kutoa dhamana kwa mwanachama mwingine',
    yo: 'fifun ẹri si ọmọ ẹgbẹ miiran',
    ha: 'ba wani memba lamuni',
    ht: 'bay yon garanti pou yon lòt manm',
  },
  inactivity_30d: {
    en: '30 days of account inactivity',
    fr: '30 jours d\'inactivité sur ton compte',
    es: '30 días de inactividad en tu cuenta',
    pt: '30 dias de inatividade na sua conta',
    hi: '30 din ki account nishkriyata',
    tl: '30 araw na hindi paggamit ng account',
    zh: '30天账户不活跃',
    vi: '30 ngày không hoạt động tài khoản',
    ko: '30일간 계정 비활성',
    ar: '30 يومًا من عدم نشاط الحساب',
    am: '30 ቀናት የመለያ እንቅስቃሴ ማጣት',
    sw: 'siku 30 za kutofanya shughuli kwenye akaunti',
    yo: 'ọjọ 30 ti aisi iṣẹ ni akanti',
    ha: 'kwanaki 30 na rashin aiki a asusu',
    ht: '30 jou san aktivite sou kont ou',
  },
  inactivity_60d: {
    en: '60 days of account inactivity',
    fr: '60 jours d\'inactivité sur ton compte',
    es: '60 días de inactividad en tu cuenta',
    pt: '60 dias de inatividade na sua conta',
    hi: '60 din ki account nishkriyata',
    tl: '60 araw na hindi paggamit ng account',
    zh: '60天账户不活跃',
    vi: '60 ngày không hoạt động tài khoản',
    ko: '60일간 계정 비활성',
    ar: '60 يومًا من عدم نشاط الحساب',
    am: '60 ቀናት የመለያ እንቅስቃሴ ማጣት',
    sw: 'siku 60 za kutofanya shughuli kwenye akaunti',
    yo: 'ọjọ 60 ti aisi iṣẹ ni akanti',
    ha: 'kwanaki 60 na rashin aiki a asusu',
    ht: '60 jou san aktivite sou kont ou',
  },
  inactivity_90d: {
    en: '90 days of account inactivity',
    fr: '90 jours d\'inactivité sur ton compte',
    es: '90 días de inactividad en tu cuenta',
    pt: '90 dias de inatividade na sua conta',
    hi: '90 din ki account nishkriyata',
    tl: '90 araw na hindi paggamit ng account',
    zh: '90天账户不活跃',
    vi: '90 ngày không hoạt động tài khoản',
    ko: '90일간 계정 비활성',
    ar: '90 يومًا من عدم نشاط الحساب',
    am: '90 ቀናት የመለያ እንቅስቃሴ ማጣት',
    sw: 'siku 90 za kutofanya shughuli kwenye akaunti',
    yo: 'ọjọ 90 ti aisi iṣẹ ni akanti',
    ha: 'kwanaki 90 na rashin aiki a asusu',
    ht: '90 jou san aktivite sou kont ou',
  },
  fraud_confirmed: {
    en: 'confirmed fraudulent activity on your account',
    fr: 'une activité frauduleuse confirmée sur ton compte',
    es: 'actividad fraudulenta confirmada en tu cuenta',
    pt: 'atividade fraudulenta confirmada em sua conta',
    hi: 'aapke account par pushtee ki gayi dhokhadhadi gatividhi',
    tl: 'nakumpirmang mapanlinlang na aktibidad sa iyong account',
    zh: '确认的账户欺诈活动',
    vi: 'hoạt động gian lận đã xác nhận trên tài khoản',
    ko: '확인된 사기 활동',
    ar: 'نشاط احتيالي مؤكد على حسابك',
    am: 'በመለያህ ላይ የተረጋገጠ ማጭበርበር',
    sw: 'shughuli za ulaghai zilizothibitishwa kwenye akaunti yako',
    yo: 'iṣẹ ẹtan ti a fidi mulẹ ni akanti rẹ',
    ha: 'ayyukan zamba da aka tabbatar a asusun ka',
    ht: 'aktivite fwod ki konfime sou kont ou',
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS — snake_case DB → camelCase TypeScript
// ═══════════════════════════════════════════════════════════════════════════════

function mapTemplate(row: any): ExplanationTemplate {
  return {
    id: row.id,
    decisionType: row.decision_type,
    language: row.language,
    templateText: row.template_text,
    requiredVariables: row.required_variables || [],
    active: row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDecision(row: any): AIDecision {
  return {
    id: row.id,
    memberId: row.member_id,
    decisionType: row.decision_type,
    decisionValue: row.decision_value || null,
    explanationKey: row.explanation_key,
    explanationData: row.explanation_data || {},
    renderedExplanation: row.rendered_explanation || null,
    language: row.language,
    sourceEventId: row.source_event_id || null,
    sourceEventType: row.source_event_type || null,
    notificationSent: row.notification_sent ?? false,
    createdAt: row.created_at,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class ExplainableAIEngine {

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION A — Template Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get a specific active template by decision type and language.
   */
  static async getTemplate(
    decisionType: DecisionType,
    language: SupportedLanguage
  ): Promise<ExplanationTemplate | null> {
    const { data, error } = await supabase
      .from('explanation_templates')
      .select('*')
      .eq('decision_type', decisionType)
      .eq('language', language)
      .eq('active', true)
      .single();

    if (error || !data) return null;
    return mapTemplate(data);
  }

  /**
   * Get all language variants for a decision type.
   */
  static async getTemplatesForType(decisionType: DecisionType): Promise<ExplanationTemplate[]> {
    const { data, error } = await supabase
      .from('explanation_templates')
      .select('*')
      .eq('decision_type', decisionType)
      .eq('active', true)
      .order('language');

    if (error) throw error;
    return (data || []).map(mapTemplate);
  }

  /**
   * Get all templates (admin use).
   */
  static async getAllTemplates(): Promise<ExplanationTemplate[]> {
    const { data, error } = await supabase
      .from('explanation_templates')
      .select('*')
      .order('decision_type')
      .order('language');

    if (error) throw error;
    return (data || []).map(mapTemplate);
  }

  /**
   * Render a template by replacing [PLACEHOLDER] slots with values.
   * Pure function — no DB calls.
   */
  static renderTemplate(
    templateText: string,
    variables: Record<string, string | number>,
    requiredVariables?: string[]
  ): string {
    // Validate required variables are present
    if (requiredVariables) {
      const missing = requiredVariables.filter(v => !(v in variables));
      if (missing.length > 0) {
        console.warn(`[ExplainableAI] Missing required variables: ${missing.join(', ')}`);
      }
    }

    let rendered = templateText;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`\\[${key}\\]`, 'g'), String(value));
    }
    return rendered;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION B — Language Resolution
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve a member's preferred language. Defaults to 'en'.
   */
  static async getMemberLanguage(userId: string): Promise<SupportedLanguage> {
    try {
      // Try profile-level preference first
      const { data } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', userId)
        .single();

      if (data?.preferred_language && VALID_LANGUAGES.has(data.preferred_language)) {
        return data.preferred_language as SupportedLanguage;
      }
    } catch {
      // Fall through to default
    }

    return 'en';
  }

  /**
   * Type guard for valid language code.
   */
  static isValidLanguage(code: string): code is SupportedLanguage {
    return VALID_LANGUAGES.has(code);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION C — Explanation Generation (Core)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate an explanation for an AI decision.
   *
   * 1. Resolves member's preferred language
   * 2. Finds matching template (falls back to English)
   * 3. Renders template with provided data
   * 4. Stores in ai_decisions table
   * 5. Returns result
   */
  static async generateExplanation(
    userId: string,
    decisionType: DecisionType,
    decisionData: Record<string, string | number>,
    options?: {
      decisionValue?: string;
      sourceEventId?: string;
      sourceEventType?: string;
      sendNotification?: boolean;
    }
  ): Promise<GenerateExplanationResult> {
    // Resolve language
    const language = await this.getMemberLanguage(userId);

    // Find template — fallback to English if member's language not available
    let template = await this.getTemplate(decisionType, language);
    const usedLanguage = template ? language : 'en';
    if (!template) {
      template = await this.getTemplate(decisionType, 'en');
    }
    if (!template) {
      throw new Error(`No template found for decision type: ${decisionType}`);
    }

    // Render
    const renderedText = this.renderTemplate(
      template.templateText,
      decisionData,
      template.requiredVariables
    );

    // Store decision
    const { data, error } = await supabase
      .from('ai_decisions')
      .insert({
        member_id: userId,
        decision_type: decisionType,
        decision_value: options?.decisionValue || null,
        explanation_key: decisionType,
        explanation_data: decisionData,
        rendered_explanation: renderedText,
        language: usedLanguage,
        source_event_id: options?.sourceEventId || null,
        source_event_type: options?.sourceEventType || null,
        notification_sent: false,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Optionally send notification
    let notificationSent = false;
    if (options?.sendNotification !== false) {
      try {
        notificationSent = await this._sendNotification(data.id, userId, decisionType, renderedText);
      } catch (err) {
        console.warn('[ExplainableAI] Notification send failed:', err);
      }
    }

    return {
      decisionId: data.id,
      renderedText,
      language: usedLanguage,
      decisionType,
      notificationSent,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION D — Decision History
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get paginated decision history for a member.
   */
  static async getDecisionHistory(
    userId: string,
    filters?: DecisionHistoryFilters
  ): Promise<AIDecision[]> {
    let query = supabase
      .from('ai_decisions')
      .select('*')
      .eq('member_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.decisionType) query = query.eq('decision_type', filters.decisionType);
    if (filters?.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters?.toDate) query = query.lte('created_at', filters.toDate);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapDecision);
  }

  /**
   * Get a single decision by ID.
   */
  static async getDecisionById(decisionId: string): Promise<AIDecision | null> {
    const { data, error } = await supabase
      .from('ai_decisions')
      .select('*')
      .eq('id', decisionId)
      .single();

    if (error || !data) return null;
    return mapDecision(data);
  }

  /**
   * Find the explanation for a specific triggering event.
   * Used by score history screen to show explanation on tap.
   */
  static async getDecisionForEvent(
    sourceEventId: string,
    sourceEventType: string
  ): Promise<AIDecision | null> {
    const { data, error } = await supabase
      .from('ai_decisions')
      .select('*')
      .eq('source_event_id', sourceEventId)
      .eq('source_event_type', sourceEventType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return mapDecision(data);
  }

  /**
   * Get aggregate decision stats for a member.
   */
  static async getDecisionStats(userId: string): Promise<DecisionStats> {
    const { data, error } = await supabase
      .from('ai_decisions')
      .select('id, decision_type, created_at')
      .eq('member_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const decisions = data || [];
    const byType: Record<string, number> = {};
    for (const d of decisions) {
      byType[d.decision_type] = (byType[d.decision_type] || 0) + 1;
    }

    let mostRecent: AIDecision | null = null;
    if (decisions.length > 0) {
      // Fetch the full most recent decision
      mostRecent = await this.getDecisionById(decisions[0].id);
    }

    return {
      totalDecisions: decisions.length,
      byType,
      mostRecent,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION E — Notification Integration
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send an explanation as an in-app notification.
   * Non-fatal — failures are logged but don't break the flow.
   */
  private static async _sendNotification(
    decisionId: string,
    userId: string,
    decisionType: DecisionType,
    renderedText: string
  ): Promise<boolean> {
    try {
      // Map decision type to notification type
      const notificationType = this._mapDecisionToNotificationType(decisionType);

      // Insert directly into notifications table as a lightweight approach
      // The NotificationPriorityEngine can also be used for more complex routing
      const { error } = await supabase
        .from('notification_queue')
        .insert({
          member_id: userId,
          notification_type: notificationType,
          title: this._getNotificationTitle(decisionType),
          body: renderedText.substring(0, 200), // Truncate for notification body
          data: { decision_id: decisionId, explanation: renderedText, decision_type: decisionType },
          status: 'pending',
        });

      if (error) {
        console.warn('[ExplainableAI] Failed to enqueue notification:', error);
        return false;
      }

      // Mark notification as sent
      await supabase
        .from('ai_decisions')
        .update({ notification_sent: true })
        .eq('id', decisionId);

      return true;
    } catch (err) {
      console.warn('[ExplainableAI] Notification integration error:', err);
      return false;
    }
  }

  /**
   * Map decision type to notification type for the queue.
   */
  private static _mapDecisionToNotificationType(decisionType: DecisionType): string {
    switch (decisionType) {
      case 'xnscore_increase':
      case 'xnscore_decrease':
        return 'score_changes';
      case 'circle_join_rejection':
      case 'payout_position':
        return 'circle_events';
      case 'tier_advancement':
      case 'tier_demotion':
        return 'score_changes';
      case 'liquidity_denial':
        return 'platform_community';
      case 'intervention_message':
        return 'coaching_goals';
      default:
        return 'platform_community';
    }
  }

  /**
   * Get a short notification title for a decision type.
   */
  private static _getNotificationTitle(decisionType: DecisionType): string {
    switch (decisionType) {
      case 'xnscore_increase': return 'XnScore Update';
      case 'xnscore_decrease': return 'XnScore Update';
      case 'circle_join_rejection': return 'Circle Update';
      case 'liquidity_denial': return 'Advance Update';
      case 'tier_advancement': return 'Tier Advancement!';
      case 'tier_demotion': return 'Tier Update';
      case 'payout_position': return 'Payout Position';
      case 'intervention_message': return 'Account Update';
      default: return 'Account Update';
    }
  }

  /**
   * Manually resend a notification for a decision.
   */
  static async resendNotification(decisionId: string): Promise<boolean> {
    const decision = await this.getDecisionById(decisionId);
    if (!decision || !decision.renderedExplanation) return false;

    return this._sendNotification(
      decision.id,
      decision.memberId,
      decision.decisionType,
      decision.renderedExplanation
    );
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION F — Convenience Methods (8 decision types)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Explain an XnScore increase.
   */
  static async explainScoreIncrease(
    userId: string,
    points: number,
    newScore: number,
    trigger: string,
    scoreHistoryId?: string
  ): Promise<GenerateExplanationResult> {
    const language = await this.getMemberLanguage(userId);
    const factorDescription = TRIGGER_DESCRIPTIONS[trigger]?.[language]
      || TRIGGER_DESCRIPTIONS[trigger]?.en
      || trigger;

    return this.generateExplanation(userId, 'xnscore_increase', {
      POINTS: points,
      NEW_SCORE: newScore,
      FACTOR_DESCRIPTION: factorDescription,
    }, {
      decisionValue: `+${points}`,
      sourceEventId: scoreHistoryId,
      sourceEventType: 'score_adjustment',
    });
  }

  /**
   * Explain an XnScore decrease.
   */
  static async explainScoreDecrease(
    userId: string,
    points: number,
    newScore: number,
    trigger: string,
    recoveryAction: string,
    scoreHistoryId?: string
  ): Promise<GenerateExplanationResult> {
    const language = await this.getMemberLanguage(userId);
    const factorDescription = TRIGGER_DESCRIPTIONS[trigger]?.[language]
      || TRIGGER_DESCRIPTIONS[trigger]?.en
      || trigger;

    return this.generateExplanation(userId, 'xnscore_decrease', {
      POINTS: points,
      NEW_SCORE: newScore,
      FACTOR_DESCRIPTION: factorDescription,
      SPECIFIC_ACTION: recoveryAction,
    }, {
      decisionValue: `-${points}`,
      sourceEventId: scoreHistoryId,
      sourceEventType: 'score_adjustment',
    });
  }

  /**
   * Explain a circle join rejection.
   */
  static async explainCircleRejection(
    userId: string,
    condition: string,
    threshold: string,
    currentValue: string,
    action: string
  ): Promise<GenerateExplanationResult> {
    return this.generateExplanation(userId, 'circle_join_rejection', {
      CONDITION: condition,
      THRESHOLD: threshold,
      CURRENT_VALUE: currentValue,
      SPECIFIC_ACTION: action,
    }, {
      decisionValue: 'rejected',
      sourceEventType: 'circle_join',
    });
  }

  /**
   * Explain a liquidity advance denial.
   */
  static async explainLiquidityDenial(
    userId: string,
    condition: string,
    threshold: string,
    currentValue: string,
    action: string
  ): Promise<GenerateExplanationResult> {
    return this.generateExplanation(userId, 'liquidity_denial', {
      CONDITION: condition,
      THRESHOLD: threshold,
      CURRENT_VALUE: currentValue,
      SPECIFIC_ACTION: action,
    }, {
      decisionValue: 'denied',
      sourceEventType: 'advance_request',
    });
  }

  /**
   * Explain a tier advancement.
   */
  static async explainTierAdvancement(
    userId: string,
    previousTier: string,
    newTier: string,
    featureUnlocked: string,
    tierHistoryId?: string
  ): Promise<GenerateExplanationResult> {
    return this.generateExplanation(userId, 'tier_advancement', {
      PREVIOUS_TIER: previousTier,
      TIER_NAME: newTier,
      FEATURE_UNLOCKED: featureUnlocked,
    }, {
      decisionValue: newTier,
      sourceEventId: tierHistoryId,
      sourceEventType: 'tier_change',
    });
  }

  /**
   * Explain a tier demotion.
   */
  static async explainTierDemotion(
    userId: string,
    previousTier: string,
    newTier: string,
    reason: string,
    recoveryAction: string,
    tierHistoryId?: string
  ): Promise<GenerateExplanationResult> {
    return this.generateExplanation(userId, 'tier_demotion', {
      PREVIOUS_TIER: previousTier,
      TIER_NAME: newTier,
      FACTOR_DESCRIPTION: reason,
      SPECIFIC_ACTION: recoveryAction,
    }, {
      decisionValue: newTier,
      sourceEventId: tierHistoryId,
      sourceEventType: 'tier_change',
    });
  }

  /**
   * Explain a payout position assignment.
   */
  static async explainPayoutPosition(
    userId: string,
    position: number,
    totalMembers: number,
    factorDescription: string,
    percentage: number
  ): Promise<GenerateExplanationResult> {
    return this.generateExplanation(userId, 'payout_position', {
      POSITION: position,
      TOTAL_MEMBERS: totalMembers,
      FACTOR_DESCRIPTION: factorDescription,
      PERCENTAGE: percentage,
    }, {
      decisionValue: `position_${position}`,
      sourceEventType: 'payout_ordering',
    });
  }

  /**
   * Explain an intervention message.
   */
  static async explainIntervention(
    userId: string,
    factorDescription: string,
    timeframe: string,
    action: string
  ): Promise<GenerateExplanationResult> {
    return this.generateExplanation(userId, 'intervention_message', {
      FACTOR_DESCRIPTION: factorDescription,
      TIMEFRAME: timeframe,
      SPECIFIC_ACTION: action,
    }, {
      sourceEventType: 'intervention',
    });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION G — Realtime
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to AI decisions for a specific member.
   */
  static subscribeToDecisions(userId: string, callback: () => void) {
    return supabase
      .channel(`ai-decisions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_decisions',
          filter: `member_id=eq.${userId}`,
        },
        () => { callback(); }
      )
      .subscribe();
  }

  /**
   * Subscribe to template updates (admin use).
   */
  static subscribeToTemplateUpdates(callback: () => void) {
    return supabase
      .channel('explanation-templates-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'explanation_templates' },
        () => { callback(); }
      )
      .subscribe();
  }
}
