// ══════════════════════════════════════════════════════════════════════════════
// lib/scoreDelta.ts — week-over-week delta line helper
// ══════════════════════════════════════════════════════════════════════════════
//
// Shared formatter used by ScoreHubScreen (all four cards) and
// XnScoreDashboardScreen (below the score ring). Was previously a local
// helper inside ScoreHubScreen; extracted so the same "↑ better −3 vs
// last week" line is composed identically everywhere.
//
// For higher-is-better scores (XnScore, Honor) a positive delta is
// improvement; for lower-is-better scores (Stress, Mood) a positive
// delta is worsening — colour flips accordingly.
//
// Translation keys are caller-provided so each screen keeps its own i18n
// namespace (score_hub.* vs xnscore_dashboard.*). Defaults preserve
// ScoreHubScreen's existing keys so the extraction is a pure move.
// ══════════════════════════════════════════════════════════════════════════════

import { colors } from '../theme/tokens';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export interface FormatDeltaOptions {
  /** i18n key used when delta === 0. Default: 'score_hub.delta_no_change' */
  noChangeKey?: string;
  /** i18n key used when delta !== 0. Receives {{sign}} and {{value}}
   *  placeholders. Default: 'score_hub.delta_vs_last_week' */
  deltaKey?: string;
}

export function formatDeltaLine(
  delta: number | null | undefined,
  higherIsBetter: boolean,
  tFn: TFn,
  opts?: FormatDeltaOptions,
): { text: string; color: string } | null {
  if (delta == null) return null;

  const noChangeKey = opts?.noChangeKey ?? 'score_hub.delta_no_change';
  const deltaKey = opts?.deltaKey ?? 'score_hub.delta_vs_last_week';

  if (delta === 0) {
    return {
      text: tFn(noChangeKey),
      color: colors.textSecondary,
    };
  }

  const isImprovement = higherIsBetter ? delta > 0 : delta < 0;
  const sign = delta > 0 ? '+' : '−'; // proper minus sign
  const abs = Math.abs(delta);

  return {
    text: tFn(deltaKey, { sign, value: abs }),
    color: isImprovement ? colors.successText : colors.errorText,
  };
}
