-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 046: Explainable AI Decisions
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Every AI decision affecting a member gets a plain-language explanation in
-- the member's preferred language (15 languages). Pre-built templates with
-- [PLACEHOLDER] slots filled at generation time. No runtime translation.
--
-- Tables: explanation_templates, ai_decisions
-- 120 seed templates = 8 decision types × 15 languages
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: explanation_templates
-- Admin-editable template catalog. One template per decision type per language.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS explanation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'xnscore_increase', 'xnscore_decrease', 'circle_join_rejection',
    'liquidity_denial', 'tier_advancement', 'tier_demotion',
    'payout_position', 'intervention_message'
  )),

  language TEXT NOT NULL CHECK (language IN (
    'en','fr','es','pt','hi','tl','zh','vi','ko','ar','am','sw','yo','ha','ht'
  )),

  template_text TEXT NOT NULL,
  required_variables TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(decision_type, language)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: ai_decisions
-- Every AI decision with rendered explanation. Members see their own.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'xnscore_increase', 'xnscore_decrease', 'circle_join_rejection',
    'liquidity_denial', 'tier_advancement', 'tier_demotion',
    'payout_position', 'intervention_message'
  )),

  decision_value TEXT,
  explanation_key TEXT NOT NULL,
  explanation_data JSONB NOT NULL DEFAULT '{}',
  rendered_explanation TEXT,
  language TEXT NOT NULL DEFAULT 'en',

  source_event_id TEXT,
  source_event_type TEXT,

  notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_decisions_member
  ON ai_decisions(member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_type
  ON ai_decisions(decision_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_source
  ON ai_decisions(source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_explanation_templates_lookup
  ON explanation_templates(decision_type, language)
  WHERE active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE explanation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;

-- explanation_templates: all authenticated can read, service_role manages
CREATE POLICY "explanation_templates_select_auth" ON explanation_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "explanation_templates_service_all" ON explanation_templates
  FOR ALL USING (auth.role() = 'service_role');

-- ai_decisions: members see own, service_role manages
CREATE POLICY "ai_decisions_select_own" ON ai_decisions
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY "ai_decisions_service_all" ON ai_decisions
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE ai_decisions;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_explanation_templates_updated_at
  BEFORE UPDATE ON explanation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA: 120 Explanation Templates (8 types × 15 languages)
-- ─────────────────────────────────────────────────────────────────────────────


-- ── xnscore_increase (15 languages) ─────────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('xnscore_increase', 'en',
  'Your XnScore went up by [POINTS] points to [NEW_SCORE]. This happened because [FACTOR_DESCRIPTION]. Keep it up!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'fr',
  'Ton XnScore a augmenté de [POINTS] points pour atteindre [NEW_SCORE]. C''est grâce à [FACTOR_DESCRIPTION]. Continue comme ça !',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'es',
  'Tu XnScore subió [POINTS] puntos a [NEW_SCORE]. Esto ocurrió porque [FACTOR_DESCRIPTION]. ¡Sigue así!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'pt',
  'Seu XnScore subiu [POINTS] pontos para [NEW_SCORE]. Isso aconteceu porque [FACTOR_DESCRIPTION]. Continue assim!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'hi',
  'Aapka XnScore [POINTS] ank badhkar [NEW_SCORE] ho gaya. Yah [FACTOR_DESCRIPTION] ke kaaran hua. Aise hi aage badhte rahiye!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'tl',
  'Ang iyong XnScore ay tumaas ng [POINTS] puntos sa [NEW_SCORE]. Ito ay dahil sa [FACTOR_DESCRIPTION]. Ipagpatuloy mo!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'zh',
  '您的XnScore增加了[POINTS]分，现在是[NEW_SCORE]。原因是[FACTOR_DESCRIPTION]。继续保持！',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'vi',
  'Điểm XnScore của bạn tăng [POINTS] điểm lên [NEW_SCORE]. Lý do là [FACTOR_DESCRIPTION]. Hãy tiếp tục phát huy!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'ko',
  'XnScore가 [POINTS]점 올라 [NEW_SCORE]이 되었습니다. [FACTOR_DESCRIPTION] 덕분입니다. 계속 잘 해주세요!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'ar',
  'ارتفع XnScore الخاص بك [POINTS] نقطة إلى [NEW_SCORE]. هذا بسبب [FACTOR_DESCRIPTION]. استمر!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'am',
  'የXnScore ነጥብህ በ[POINTS] ጨምሮ [NEW_SCORE] ደርሷል። ይህ የሆነው [FACTOR_DESCRIPTION] ስለሆነ ነው። ቀጥል!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'sw',
  'XnScore yako imepanda pointi [POINTS] hadi [NEW_SCORE]. Hii ilitokana na [FACTOR_DESCRIPTION]. Endelea hivyo!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'yo',
  'XnScore rẹ ti gun pẹlu ami [POINTS] si [NEW_SCORE]. Eyi waye nitori [FACTOR_DESCRIPTION]. Tẹsiwaju!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'ha',
  'XnScore ka ya ƙaru da maki [POINTS] zuwa [NEW_SCORE]. Wannan ya faru saboda [FACTOR_DESCRIPTION]. Ka ci gaba!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}'),
('xnscore_increase', 'ht',
  'XnScore ou monte [POINTS] pwen pou rive [NEW_SCORE]. Sa rive paske [FACTOR_DESCRIPTION]. Kontinye konsa!',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION}');


-- ── xnscore_decrease (15 languages) ─────────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('xnscore_decrease', 'en',
  'Your XnScore dropped by [POINTS] points to [NEW_SCORE] because [FACTOR_DESCRIPTION]. To recover, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'fr',
  'Ton XnScore a baissé de [POINTS] points, il est maintenant à [NEW_SCORE]. La raison : [FACTOR_DESCRIPTION]. Pour remonter, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'es',
  'Tu XnScore bajó [POINTS] puntos a [NEW_SCORE] porque [FACTOR_DESCRIPTION]. Para recuperarte, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'pt',
  'Seu XnScore caiu [POINTS] pontos para [NEW_SCORE] porque [FACTOR_DESCRIPTION]. Para recuperar, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'hi',
  'Aapka XnScore [POINTS] ank girkar [NEW_SCORE] ho gaya kyunki [FACTOR_DESCRIPTION]. Sudhaarne ke liye, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'tl',
  'Ang iyong XnScore ay bumaba ng [POINTS] puntos sa [NEW_SCORE] dahil sa [FACTOR_DESCRIPTION]. Para makabawi, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'zh',
  '您的XnScore下降了[POINTS]分，现在是[NEW_SCORE]。原因是[FACTOR_DESCRIPTION]。要恢复，[SPECIFIC_ACTION]。',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'vi',
  'Điểm XnScore của bạn giảm [POINTS] điểm xuống [NEW_SCORE] vì [FACTOR_DESCRIPTION]. Để phục hồi, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'ko',
  'XnScore가 [POINTS]점 하락하여 [NEW_SCORE]이 되었습니다. 원인: [FACTOR_DESCRIPTION]. 회복하려면, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'ar',
  'انخفض XnScore الخاص بك [POINTS] نقطة إلى [NEW_SCORE] بسبب [FACTOR_DESCRIPTION]. للتعافي، [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'am',
  'የXnScore ነጥብህ በ[POINTS] ቀንሶ [NEW_SCORE] ሆኗል። ምክንያቱ [FACTOR_DESCRIPTION] ነው። ለማገገም፣ [SPECIFIC_ACTION]።',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'sw',
  'XnScore yako imeshuka pointi [POINTS] hadi [NEW_SCORE] kwa sababu ya [FACTOR_DESCRIPTION]. Ili kupona, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'yo',
  'XnScore rẹ ti ṣubu pẹlu ami [POINTS] si [NEW_SCORE] nitori [FACTOR_DESCRIPTION]. Lati gba pada, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'ha',
  'XnScore ka ya ragu da maki [POINTS] zuwa [NEW_SCORE] saboda [FACTOR_DESCRIPTION]. Don farfadowa, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('xnscore_decrease', 'ht',
  'XnScore ou desann [POINTS] pwen pou rive [NEW_SCORE] paske [FACTOR_DESCRIPTION]. Pou remonte, [SPECIFIC_ACTION].',
  '{POINTS,NEW_SCORE,FACTOR_DESCRIPTION,SPECIFIC_ACTION}');


-- ── circle_join_rejection (15 languages) ────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('circle_join_rejection', 'en',
  'You weren''t able to join this circle because [CONDITION]. You need [THRESHOLD] but currently have [CURRENT_VALUE]. To qualify, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'fr',
  'Tu n''as pas pu rejoindre ce cercle parce que [CONDITION]. Il te faut [THRESHOLD] mais tu as actuellement [CURRENT_VALUE]. Pour te qualifier, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'es',
  'No pudiste unirte a este círculo porque [CONDITION]. Necesitas [THRESHOLD] pero actualmente tienes [CURRENT_VALUE]. Para calificar, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'pt',
  'Você não pôde entrar neste círculo porque [CONDITION]. Você precisa de [THRESHOLD] mas atualmente tem [CURRENT_VALUE]. Para se qualificar, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'hi',
  'Aap is circle mein shamil nahi ho sake kyunki [CONDITION]. Aapko [THRESHOLD] chahiye lekin aapke paas [CURRENT_VALUE] hai. Yogya hone ke liye, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'tl',
  'Hindi ka nakasali sa circle na ito dahil [CONDITION]. Kailangan mo ng [THRESHOLD] pero mayroon ka lang [CURRENT_VALUE]. Para maging kuwalipikado, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'zh',
  '您未能加入此圈子，因为[CONDITION]。您需要[THRESHOLD]，但目前只有[CURRENT_VALUE]。要获得资格，[SPECIFIC_ACTION]。',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'vi',
  'Bạn không thể tham gia vòng tròn này vì [CONDITION]. Bạn cần [THRESHOLD] nhưng hiện tại chỉ có [CURRENT_VALUE]. Để đủ điều kiện, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'ko',
  '이 서클에 참여할 수 없었습니다. 이유: [CONDITION]. [THRESHOLD]이 필요하지만 현재 [CURRENT_VALUE]입니다. 자격을 갖추려면, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'ar',
  'لم تتمكن من الانضمام إلى هذه الحلقة بسبب [CONDITION]. تحتاج إلى [THRESHOLD] لكن لديك حاليًا [CURRENT_VALUE]. للتأهل، [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'am',
  'ይህን ክበብ መቀላቀል አልቻልክም ምክንያቱም [CONDITION]። [THRESHOLD] ያስፈልግሃል ግን አሁን [CURRENT_VALUE] አለህ። ብቁ ለመሆን፣ [SPECIFIC_ACTION]።',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'sw',
  'Hukuweza kujiunga na duara hii kwa sababu [CONDITION]. Unahitaji [THRESHOLD] lakini kwa sasa una [CURRENT_VALUE]. Ili kustahiki, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'yo',
  'O ko le darapọ mọ ẹgbẹ yii nitori [CONDITION]. O nilo [THRESHOLD] ṣugbọn o ni [CURRENT_VALUE] lọwọlọwọ. Lati yẹ, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'ha',
  'Ba ka iya shiga wannan da''irar ba saboda [CONDITION]. Kana buƙatar [THRESHOLD] amma a yanzu kana da [CURRENT_VALUE]. Don cancanta, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('circle_join_rejection', 'ht',
  'Ou pa t kapab antre nan sèk sa a paske [CONDITION]. Ou bezwen [THRESHOLD] men kounye a ou gen [CURRENT_VALUE]. Pou kalifye, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}');


-- ── liquidity_denial (15 languages) ─────────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('liquidity_denial', 'en',
  'Your advance request was not approved because [CONDITION]. The requirement is [THRESHOLD] but your current level is [CURRENT_VALUE]. To improve your eligibility, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'fr',
  'Ta demande d''avance n''a pas été approuvée parce que [CONDITION]. Le minimum requis est [THRESHOLD] mais ton niveau actuel est [CURRENT_VALUE]. Pour améliorer ton éligibilité, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'es',
  'Tu solicitud de anticipo no fue aprobada porque [CONDITION]. El requisito es [THRESHOLD] pero tu nivel actual es [CURRENT_VALUE]. Para mejorar tu elegibilidad, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'pt',
  'Seu pedido de adiantamento não foi aprovado porque [CONDITION]. O requisito é [THRESHOLD] mas seu nível atual é [CURRENT_VALUE]. Para melhorar sua elegibilidade, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'hi',
  'Aapki advance ki request manjoor nahi hui kyunki [CONDITION]. Zaroorat hai [THRESHOLD] lekin aapka maujuda star hai [CURRENT_VALUE]. Yogyata sudharne ke liye, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'tl',
  'Ang iyong kahilingan para sa advance ay hindi naaprubahan dahil [CONDITION]. Ang kinakailangan ay [THRESHOLD] pero ang kasalukuyan mong lebel ay [CURRENT_VALUE]. Para mapabuti ang iyong pagiging kuwalipikado, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'zh',
  '您的预支申请未获批准，因为[CONDITION]。要求是[THRESHOLD]，但您当前的水平是[CURRENT_VALUE]。要提高资格，[SPECIFIC_ACTION]。',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'vi',
  'Yêu cầu ứng trước của bạn không được phê duyệt vì [CONDITION]. Yêu cầu là [THRESHOLD] nhưng mức hiện tại của bạn là [CURRENT_VALUE]. Để cải thiện, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'ko',
  '선불 요청이 승인되지 않았습니다. 이유: [CONDITION]. 요구사항은 [THRESHOLD]이지만 현재 수준은 [CURRENT_VALUE]입니다. 자격을 개선하려면, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'ar',
  'لم تتم الموافقة على طلب السلفة الخاص بك بسبب [CONDITION]. المطلوب هو [THRESHOLD] لكن مستواك الحالي هو [CURRENT_VALUE]. لتحسين أهليتك، [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'am',
  'የቅድመ ክፍያ ጥያቄህ አልጸደቀም ምክንያቱም [CONDITION]። መስፈርቱ [THRESHOLD] ነው ግን የአሁን ደረጃህ [CURRENT_VALUE] ነው። ብቁነትህን ለማሻሻል፣ [SPECIFIC_ACTION]።',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'sw',
  'Ombi lako la malipo ya mapema halikuidhinishwa kwa sababu [CONDITION]. Mahitaji ni [THRESHOLD] lakini kiwango chako cha sasa ni [CURRENT_VALUE]. Ili kuboresha ustahiki wako, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'yo',
  'Ìbéèrè rẹ fún ìsáájú kò jẹ́ ìfọwọ́sí nítorí [CONDITION]. Ohun tí ó nílò ni [THRESHOLD] ṣùgbọ́n ìpele rẹ lọ́wọ́lọ́wọ́ ni [CURRENT_VALUE]. Láti mú àǹfààní rẹ dára sí i, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'ha',
  'Ba a amince da buƙatar tallafin ka ba saboda [CONDITION]. Abin da ake buƙata shi ne [THRESHOLD] amma matakin ka na yanzu shi ne [CURRENT_VALUE]. Don inganta cancantarka, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}'),
('liquidity_denial', 'ht',
  'Demann avans ou pa t apwouve paske [CONDITION]. Kondisyon an se [THRESHOLD] men nivo ou kounye a se [CURRENT_VALUE]. Pou amelyore kalifikasyon ou, [SPECIFIC_ACTION].',
  '{CONDITION,THRESHOLD,CURRENT_VALUE,SPECIFIC_ACTION}');


-- ── tier_advancement (15 languages) ─────────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('tier_advancement', 'en',
  'Congratulations! You''ve advanced from [PREVIOUS_TIER] to [TIER_NAME]! This unlocks: [FEATURE_UNLOCKED]. Thank you for being a trusted member.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'fr',
  'Félicitations ! Tu es passé de [PREVIOUS_TIER] à [TIER_NAME] ! Ça débloque : [FEATURE_UNLOCKED]. Merci d''être un membre de confiance.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'es',
  '¡Felicidades! Has avanzado de [PREVIOUS_TIER] a [TIER_NAME]. Esto desbloquea: [FEATURE_UNLOCKED]. Gracias por ser un miembro de confianza.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'pt',
  'Parabéns! Você avançou de [PREVIOUS_TIER] para [TIER_NAME]! Isso desbloqueia: [FEATURE_UNLOCKED]. Obrigado por ser um membro confiável.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'hi',
  'Badhai ho! Aap [PREVIOUS_TIER] se [TIER_NAME] mein pahunch gaye! Isse khulta hai: [FEATURE_UNLOCKED]. Ek vishwasniya sadasya hone ke liye dhanyavaad.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'tl',
  'Binabati kita! Nag-advance ka mula sa [PREVIOUS_TIER] patungo sa [TIER_NAME]! Na-unlock nito: [FEATURE_UNLOCKED]. Salamat sa pagiging mapagkakatiwalaang miyembro.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'zh',
  '恭喜！您已从[PREVIOUS_TIER]晋升到[TIER_NAME]！这将解锁：[FEATURE_UNLOCKED]。感谢您成为值得信赖的会员。',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'vi',
  'Chúc mừng! Bạn đã thăng hạng từ [PREVIOUS_TIER] lên [TIER_NAME]! Điều này mở khóa: [FEATURE_UNLOCKED]. Cảm ơn bạn đã là thành viên đáng tin cậy.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'ko',
  '축하합니다! [PREVIOUS_TIER]에서 [TIER_NAME]으로 승급했습니다! 잠금 해제: [FEATURE_UNLOCKED]. 신뢰할 수 있는 회원이 되어주셔서 감사합니다.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'ar',
  'تهانينا! لقد تقدمت من [PREVIOUS_TIER] إلى [TIER_NAME]! هذا يفتح: [FEATURE_UNLOCKED]. شكرًا لكونك عضوًا موثوقًا.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'am',
  'እንኳን ደስ አለህ! ከ[PREVIOUS_TIER] ወደ [TIER_NAME] ከፍ ብለሃል! ይህ ይከፍታል: [FEATURE_UNLOCKED]። ታማኝ አባል ስለሆንክ እናመሰግናለን።',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'sw',
  'Hongera! Umepanda kutoka [PREVIOUS_TIER] hadi [TIER_NAME]! Hii inafungua: [FEATURE_UNLOCKED]. Asante kwa kuwa mwanachama wa kuaminika.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'yo',
  'Eku orire! O ti goke lati [PREVIOUS_TIER] si [TIER_NAME]! Eyi ṣi silẹ: [FEATURE_UNLOCKED]. O ṣeun fun jije ọmọ ẹgbẹ ti a gbẹkẹle.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'ha',
  'Taya murna! Ka tashi daga [PREVIOUS_TIER] zuwa [TIER_NAME]! Wannan ya buɗe: [FEATURE_UNLOCKED]. Na gode da kasancewa memba mai amana.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}'),
('tier_advancement', 'ht',
  'Felisitasyon! Ou monte soti nan [PREVIOUS_TIER] rive nan [TIER_NAME]! Sa debòke: [FEATURE_UNLOCKED]. Mèsi paske ou se yon manm serye.',
  '{PREVIOUS_TIER,TIER_NAME,FEATURE_UNLOCKED}');


-- ── tier_demotion (15 languages) ────────────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('tier_demotion', 'en',
  'Your tier has moved from [PREVIOUS_TIER] to [TIER_NAME] due to [FACTOR_DESCRIPTION]. To regain your previous tier, [SPECIFIC_ACTION]. We''re here to help.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'fr',
  'Ton niveau est passé de [PREVIOUS_TIER] à [TIER_NAME] à cause de [FACTOR_DESCRIPTION]. Pour retrouver ton ancien niveau, [SPECIFIC_ACTION]. On est là pour t''aider.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'es',
  'Tu nivel ha bajado de [PREVIOUS_TIER] a [TIER_NAME] debido a [FACTOR_DESCRIPTION]. Para recuperar tu nivel anterior, [SPECIFIC_ACTION]. Estamos aquí para ayudarte.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'pt',
  'Seu nível mudou de [PREVIOUS_TIER] para [TIER_NAME] devido a [FACTOR_DESCRIPTION]. Para recuperar seu nível anterior, [SPECIFIC_ACTION]. Estamos aqui para ajudar.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'hi',
  'Aapka star [PREVIOUS_TIER] se [TIER_NAME] mein aa gaya hai [FACTOR_DESCRIPTION] ki wajah se. Pehle wala star paane ke liye, [SPECIFIC_ACTION]. Hum madad ke liye yahan hain.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'tl',
  'Ang iyong tier ay bumaba mula [PREVIOUS_TIER] patungo sa [TIER_NAME] dahil sa [FACTOR_DESCRIPTION]. Para maibalik ang dati mong tier, [SPECIFIC_ACTION]. Nandito kami para tumulong.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'zh',
  '您的等级已从[PREVIOUS_TIER]降至[TIER_NAME]，原因是[FACTOR_DESCRIPTION]。要恢复之前的等级，[SPECIFIC_ACTION]。我们随时为您提供帮助。',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'vi',
  'Hạng của bạn đã chuyển từ [PREVIOUS_TIER] sang [TIER_NAME] do [FACTOR_DESCRIPTION]. Để lấy lại hạng cũ, [SPECIFIC_ACTION]. Chúng tôi luôn sẵn sàng hỗ trợ.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'ko',
  '등급이 [PREVIOUS_TIER]에서 [TIER_NAME]으로 변경되었습니다. 원인: [FACTOR_DESCRIPTION]. 이전 등급을 되찾으려면, [SPECIFIC_ACTION]. 도움이 필요하시면 말씀해주세요.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'ar',
  'انتقل مستواك من [PREVIOUS_TIER] إلى [TIER_NAME] بسبب [FACTOR_DESCRIPTION]. لاستعادة مستواك السابق، [SPECIFIC_ACTION]. نحن هنا للمساعدة.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'am',
  'ደረጃህ ከ[PREVIOUS_TIER] ወደ [TIER_NAME] ተቀይሯል በ[FACTOR_DESCRIPTION] ምክንያት። የቀድሞ ደረጃህን ለማግኘት፣ [SPECIFIC_ACTION]። እኛ ለመርዳት እዚህ ነን።',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'sw',
  'Kiwango chako kimeshuka kutoka [PREVIOUS_TIER] hadi [TIER_NAME] kwa sababu ya [FACTOR_DESCRIPTION]. Ili kurudisha kiwango chako cha awali, [SPECIFIC_ACTION]. Tuko hapa kukusaidia.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'yo',
  'Ìpele rẹ ti yipada lati [PREVIOUS_TIER] si [TIER_NAME] nitori [FACTOR_DESCRIPTION]. Lati gba ìpele rẹ tẹlẹ pada, [SPECIFIC_ACTION]. A wa nibi lati ṣe iranlọwọ.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'ha',
  'Matakin ka ya sauka daga [PREVIOUS_TIER] zuwa [TIER_NAME] saboda [FACTOR_DESCRIPTION]. Don dawo da matakin ka na baya, [SPECIFIC_ACTION]. Muna nan don taimaka.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}'),
('tier_demotion', 'ht',
  'Nivo ou desann soti nan [PREVIOUS_TIER] rive nan [TIER_NAME] akòz [FACTOR_DESCRIPTION]. Pou rekipere nivo ou te genyen an, [SPECIFIC_ACTION]. Nou la pou ede ou.',
  '{PREVIOUS_TIER,TIER_NAME,FACTOR_DESCRIPTION,SPECIFIC_ACTION}');


-- ── payout_position (15 languages) ──────────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('payout_position', 'en',
  'You''ve been assigned position [POSITION] of [TOTAL_MEMBERS] in this cycle. This is based on [FACTOR_DESCRIPTION], where your combined score placed you in the top [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'fr',
  'Tu as été placé en position [POSITION] sur [TOTAL_MEMBERS] dans ce cycle. C''est basé sur [FACTOR_DESCRIPTION], ton score combiné te place dans le top [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'es',
  'Se te asignó la posición [POSITION] de [TOTAL_MEMBERS] en este ciclo. Esto se basa en [FACTOR_DESCRIPTION], donde tu puntuación combinada te ubicó en el top [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'pt',
  'Você foi atribuído à posição [POSITION] de [TOTAL_MEMBERS] neste ciclo. Isso é baseado em [FACTOR_DESCRIPTION], onde sua pontuação combinada o colocou no top [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'hi',
  'Aapko is cycle mein [TOTAL_MEMBERS] mein se [POSITION] sthaan diya gaya hai. Yah [FACTOR_DESCRIPTION] par aadhaarit hai, jahan aapka sanyukt score aapko top [PERCENTAGE]% mein rakhta hai.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'tl',
  'Na-assign ka sa posisyon [POSITION] sa [TOTAL_MEMBERS] sa cycle na ito. Ito ay batay sa [FACTOR_DESCRIPTION], kung saan ang iyong pinagsama-samang score ang naglagay sa iyo sa top [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'zh',
  '您在本周期中被分配到第[POSITION]位（共[TOTAL_MEMBERS]位）。这基于[FACTOR_DESCRIPTION]，您的综合得分将您排在前[PERCENTAGE]%。',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'vi',
  'Bạn được xếp vị trí [POSITION] trên [TOTAL_MEMBERS] trong chu kỳ này. Điều này dựa trên [FACTOR_DESCRIPTION], điểm tổng hợp của bạn đặt bạn trong top [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'ko',
  '이번 주기에서 [TOTAL_MEMBERS]명 중 [POSITION]번 위치에 배정되었습니다. 이는 [FACTOR_DESCRIPTION]에 기반하며, 종합 점수로 상위 [PERCENTAGE]%에 해당합니다.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'ar',
  'تم تعيينك في المركز [POSITION] من [TOTAL_MEMBERS] في هذه الدورة. يعتمد هذا على [FACTOR_DESCRIPTION]، حيث وضعتك نتيجتك المجمعة ضمن أفضل [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'am',
  'በዚህ ዙር ከ[TOTAL_MEMBERS] ውስጥ [POSITION]ኛ ቦታ ተሰጥቶሃል። ይህ በ[FACTOR_DESCRIPTION] ላይ የተመሰረተ ሲሆን፣ የተጣመረ ነጥብህ ከላይኛው [PERCENTAGE]% ውስጥ አስቀምጦሃል።',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'sw',
  'Umepewa nafasi ya [POSITION] kati ya [TOTAL_MEMBERS] katika mzunguko huu. Hii inategemea [FACTOR_DESCRIPTION], ambapo alama yako ya jumla ilikuweka katika asilimia [PERCENTAGE]% ya juu.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'yo',
  'A fi ọ si ipo [POSITION] ninu [TOTAL_MEMBERS] ni akoko yii. Eyi da lori [FACTOR_DESCRIPTION], nibi ti ami apapọ rẹ fi ọ sinu oke [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'ha',
  'An sanya ka a matsayi [POSITION] daga cikin [TOTAL_MEMBERS] a wannan zagayen. Wannan ya dogara ne akan [FACTOR_DESCRIPTION], inda jimlar maki ka ta sanya ka cikin [PERCENTAGE]% na sama.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}'),
('payout_position', 'ht',
  'Yo ba ou pozisyon [POSITION] sou [TOTAL_MEMBERS] nan sik sa a. Sa baze sou [FACTOR_DESCRIPTION], kote pwen konbine ou mete ou nan tòp [PERCENTAGE]%.',
  '{POSITION,TOTAL_MEMBERS,FACTOR_DESCRIPTION,PERCENTAGE}');


-- ── intervention_message (15 languages) ─────────────────────────────────────

INSERT INTO explanation_templates (decision_type, language, template_text, required_variables) VALUES
('intervention_message', 'en',
  'We noticed [FACTOR_DESCRIPTION] over the past [TIMEFRAME]. We want to help you stay on track. Here''s what you can do: [SPECIFIC_ACTION]. You''re not alone in this.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'fr',
  'On a remarqué [FACTOR_DESCRIPTION] ces derniers [TIMEFRAME]. On veut t''aider à rester sur la bonne voie. Voici ce que tu peux faire : [SPECIFIC_ACTION]. Tu n''es pas seul.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'es',
  'Notamos [FACTOR_DESCRIPTION] en los últimos [TIMEFRAME]. Queremos ayudarte a mantenerte en camino. Esto es lo que puedes hacer: [SPECIFIC_ACTION]. No estás solo en esto.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'pt',
  'Notamos [FACTOR_DESCRIPTION] nos últimos [TIMEFRAME]. Queremos ajudá-lo a se manter no caminho certo. Aqui está o que você pode fazer: [SPECIFIC_ACTION]. Você não está sozinho.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'hi',
  'Humne pichle [TIMEFRAME] mein [FACTOR_DESCRIPTION] dekha. Hum aapki madad karna chahte hain. Aap yah kar sakte hain: [SPECIFIC_ACTION]. Aap is mein akele nahi hain.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'tl',
  'Napansin namin [FACTOR_DESCRIPTION] sa nakaraang [TIMEFRAME]. Gusto naming tulungan kang manatili sa tamang landas. Narito ang magagawa mo: [SPECIFIC_ACTION]. Hindi ka nag-iisa.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'zh',
  '我们注意到在过去[TIMEFRAME]中[FACTOR_DESCRIPTION]。我们希望帮助您保持正轨。您可以这样做：[SPECIFIC_ACTION]。您并不孤单。',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'vi',
  'Chúng tôi nhận thấy [FACTOR_DESCRIPTION] trong [TIMEFRAME] qua. Chúng tôi muốn giúp bạn đi đúng hướng. Đây là những gì bạn có thể làm: [SPECIFIC_ACTION]. Bạn không đơn độc.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'ko',
  '지난 [TIMEFRAME] 동안 [FACTOR_DESCRIPTION]을 확인했습니다. 올바른 방향으로 나아갈 수 있도록 돕고 싶습니다. 다음을 시도해보세요: [SPECIFIC_ACTION]. 혼자가 아닙니다.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'ar',
  'لاحظنا [FACTOR_DESCRIPTION] خلال [TIMEFRAME] الماضية. نريد مساعدتك للبقاء على المسار الصحيح. إليك ما يمكنك فعله: [SPECIFIC_ACTION]. لست وحدك في هذا.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'am',
  'ባለፈው [TIMEFRAME] ውስጥ [FACTOR_DESCRIPTION] አስተውለናል። በትክክለኛው መንገድ ላይ እንድትቆይ መርዳት እንፈልጋለን። ይህን ማድረግ ትችላለህ: [SPECIFIC_ACTION]። ብቻህን አይደለህም።',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'sw',
  'Tumeona [FACTOR_DESCRIPTION] katika [TIMEFRAME] zilizopita. Tunataka kukusaidia kubaki njiani. Hivi ndivyo unavyoweza kufanya: [SPECIFIC_ACTION]. Huko peke yako.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'yo',
  'A ṣe akiyesi [FACTOR_DESCRIPTION] ni [TIMEFRAME] to kọja. A fẹ ran ọ lọwọ lati duro lori ọna. Eyi ni ohun ti o le ṣe: [SPECIFIC_ACTION]. Iwọ ko nikan ninu eyi.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'ha',
  'Mun lura [FACTOR_DESCRIPTION] a cikin [TIMEFRAME] da suka gabata. Muna so mu taimake ka ka ci gaba daidai. Ga abin da za ka iya yi: [SPECIFIC_ACTION]. Ba kai kaɗai ba ne.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}'),
('intervention_message', 'ht',
  'Nou remake [FACTOR_DESCRIPTION] nan dènye [TIMEFRAME]. Nou vle ede ou rete sou bon chemen an. Men sa ou ka fè: [SPECIFIC_ACTION]. Ou pa poukont ou nan sa.',
  '{FACTOR_DESCRIPTION,TIMEFRAME,SPECIFIC_ACTION}');
