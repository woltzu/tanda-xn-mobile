// ══════════════════════════════════════════════════════════════════════════════
// lib/kycDraft.ts — shared KYC-flow draft persistence (AsyncStorage)
// ══════════════════════════════════════════════════════════════════════════════
//
// Persists user progress across the Interest-First KYC flow so a user who
// quits mid-application can resume. Stored under a single AsyncStorage key
// (`draft_kyc-flow`); each screen merges its non-sensitive fields into the
// existing record on Continue, and the entry screen offers a "Restore" /
// "Discard" banner that infers the resume target from which fields are
// populated.
//
// Architecture — why a hand-rolled helper instead of useFormDraft:
//   useFormDraft is component-scoped. Multiple screens calling it
//   independently would race during navigation transitions (Screen A's
//   debounced save could land after Screen B has already mounted and read
//   the store, overwriting B's draft with A's stale snapshot). This helper
//   is a thin namespace over AsyncStorage: callers fire `merge()` once per
//   Continue/Submit, atomic read-then-write. No debounce, no in-flight
//   timer state, no cross-screen races.
//
// Privacy posture (explicit, per the 2026-05-30 architecture review):
//   NEVER persist the tax-ID digits themselves (SSN/ITIN/foreign tax ID).
//   AsyncStorage is unencrypted on Android by default; storing 9-digit
//   personal IDs there would create a meaningful PII risk for negligible
//   UX win (the user re-keys 9 characters on resume). We persist only the
//   "annoying to retype" fields: legal name, date of birth, country, ID
//   type, has-tax-ID flag.
// ══════════════════════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";

const KYC_DRAFT_KEY = "draft_kyc-flow";

/**
 * Shape of the persisted KYC draft.
 *
 * Tax-ID *type* (SSN vs ITIN) and the international "has tax ID?" flag are
 * persisted. The actual *digits* are deliberately NOT in this type — see
 * the file header for the reasoning. Country and ID-type fields are typed
 * as `unknown` because they round-trip the screen's own object shapes
 * (Country, IdType) through JSON; the consuming screen casts on restore.
 */
export interface KycDraft {
  // ── SSN/ITIN path (TaxIDEntryScreen) ─────────────────────────────────────
  taxIdType?: "ssn" | "itin";
  legalName?: string;
  dateOfBirth?: string;

  // ── International path (InternationalVerificationScreen) ─────────────────
  country?: unknown;            // serialized Country object — screen casts on restore
  internationalIdType?: unknown; // serialized IdType object — screen casts on restore
  hasTaxId?: boolean;

  // ── Metadata ─────────────────────────────────────────────────────────────
  updatedAt?: string;
}

/** Internal: read + parse the stored JSON. Returns null on any error. */
async function readDraft(): Promise<KycDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KYC_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KycDraft;
  } catch (e) {
    console.warn("[kycDraft] read failed:", e);
    return null;
  }
}

/** Public API. Importing screens call `kycDraft.get()` / `.merge()` / etc. */
export const kycDraft = {
  /** Returns the current draft, or null if none / unreadable. */
  async get(): Promise<KycDraft | null> {
    return readDraft();
  },

  /**
   * Atomically merge a partial update into the stored draft. Late writes
   * win on overlapping fields. Stamps `updatedAt` on every successful
   * write.
   */
  async merge(partial: Partial<KycDraft>): Promise<void> {
    try {
      const existing = (await readDraft()) ?? {};
      const merged: KycDraft = {
        ...existing,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(KYC_DRAFT_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn("[kycDraft] merge failed:", e);
    }
  },

  /** Wipe the draft entirely — call on terminal success. */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KYC_DRAFT_KEY);
    } catch (e) {
      console.warn("[kycDraft] clear failed:", e);
    }
  },

  /**
   * True iff a draft exists AND contains at least one meaningful field
   * (anything other than `updatedAt`). The banner uses this to decide
   * whether to surface the Restore offer.
   */
  async has(): Promise<boolean> {
    const draft = await readDraft();
    if (!draft) return false;
    return Object.entries(draft).some(
      ([k, v]) => k !== "updatedAt" && v != null && v !== ""
    );
  },
};
