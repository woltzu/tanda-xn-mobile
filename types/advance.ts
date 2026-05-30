// ══════════════════════════════════════════════════════════════════════════════
// types/advance.ts — shared types for the Advance flow
// ══════════════════════════════════════════════════════════════════════════════
//
// AdvanceDraft is the AsyncStorage shape persisted by useFormDraft under the
// 'advance-application' key. It captures the cross-step state of the
// ApplicationFlow wizard so a partially-completed application can be
// resumed after the app is closed or backgrounded.
// ══════════════════════════════════════════════════════════════════════════════

export interface AdvanceDraft {
  /** Which of the 3 wizard steps the user was on when the draft was saved. */
  step: 1 | 2 | 3;

  /** Step 1 selection — which upcoming circle payout to advance against. */
  selectedPayout?: {
    id: string;
    circleName: string;
    amount: number;
    date: string;
    maxAdvance: number;
  };

  /**
   * Step 2 snapshot — the fee/total/rate computed upstream by SmartCalculator
   * and forwarded here via route params. Persisted so that a restored draft
   * shows the same numbers even when the user returns without the original
   * route params. `term` is optional and reserved for future use; the
   * current step 2 UI does not surface a term selector.
   */
  advanceDetails?: {
    amount: number;
    fee: number;
    total: number;
    rate: number;
    term?: number;
  };

  /** Step 3 — the three required agreement checkboxes. */
  termsAgreed?: {
    agreedToWithholding?: boolean;
    agreedToDefault?: boolean;
    agreedToTerms?: boolean;
  };
}
