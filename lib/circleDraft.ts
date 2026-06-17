// ══════════════════════════════════════════════════════════════════════════════
// lib/circleDraft.ts — typed shape + key for the cross-step circle draft
// ══════════════════════════════════════════════════════════════════════════════
//
// The circle-creation wizard (Start → WizardForm → Invite → Success) keeps
// state across steps via navigation params + AsyncStorage. Each data-entry
// step persists the *accumulated* params under CIRCLE_DRAFT_KEY via
// useFormDraft, and the Start screen reads it back to offer a restore.
//
// Bucket B (Create-a-circle review):
//   • Promoted previously-loose string fields (circleType / frequency /
//     rotationMethod) to unions so navigation.navigate() doesn't need
//     `as any`.
//   • Kept the index signature because the Invite step still threads
//     untyped accumulated params; future cleanup can drop it once every
//     step reads via the typed shape.
//
// Fields mirror the accumulated navigation-param shape (amount /
// memberCount are numbers, startDate is an ISO string serialized from
// the date picker so AsyncStorage round-tripping doesn't lose it).
// ══════════════════════════════════════════════════════════════════════════════

export const CIRCLE_DRAFT_KEY = "circle-create";

// Sources of truth for the union types so consumers can import a single
// place. Keep aligned with create_circle RPC enums + CreateCircleStartScreen
// circleTypes catalogue.
export type CircleType =
  | "traditional"
  | "travel"
  | "family-support"
  | "beneficiary"
  | "goal"
  | "emergency";

export type CircleFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export type CircleRotationMethod = "xnscore" | "random" | "manual";

export type CircleDraft = {
  circleType: CircleType;
  // ── Basics ──────────────────────────────────────────────────────────
  name?: string;
  amount?: number;
  frequency?: CircleFrequency;
  memberCount?: number;
  // ── Type-specific extras ────────────────────────────────────────────
  // beneficiary
  beneficiaryName?: string;
  beneficiaryReason?: string;
  beneficiaryPhone?: string;
  beneficiaryCountry?: string;
  // goal
  isRecurring?: boolean;
  totalCycles?: number;
  // emergency / community-scoped
  targetCommunityId?: string | number;
  targetCommunityName?: string;
  isElderCreated?: boolean;
  // ── Schedule ────────────────────────────────────────────────────────
  startDate?: string | null; // ISO string from the date picker
  rotationMethod?: CircleRotationMethod;
  gracePeriodDays?: number;
  // ── Invite step ─────────────────────────────────────────────────────
  // List of selected member user IDs from the Invite screen's contacts
  // picker. The createCircle RPC takes a different shape ({phone, name}[])
  // and the Invite screen does the mapping.
  invitedMembers?: string[];
  // Index signature is a transition aid — the Invite step still threads
  // some untyped accumulated params. Remove once every step reads + writes
  // via the typed shape.
  [key: string]: unknown;
};
