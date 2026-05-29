// ══════════════════════════════════════════════════════════════════════════════
// lib/circleDraft.ts — shared shape + key for the cross-step circle draft
// ══════════════════════════════════════════════════════════════════════════════
//
// The circle-creation wizard (Start → Details → Schedule → Invite → Success)
// keeps state per-step via local state + navigation params. To support a
// single "restore unfinished circle" banner, each data-entry step persists
// the *accumulated* params under this key via useFormDraft, and the Start
// screen reads it to offer a restore.
//
// Fields mirror the accumulated navigation-param shape (e.g. amount /
// memberCount are numbers, as the steps forward them), so the same merged
// object can be both saved as the draft and passed forward. The index
// signature lets any extra accumulated params pass through untyped.
// ══════════════════════════════════════════════════════════════════════════════

export const CIRCLE_DRAFT_KEY = "circle-create";

export type CircleDraft = {
  circleType: string;
  // Details step
  name?: string;
  amount?: number;
  frequency?: string;
  memberCount?: number;
  beneficiaryName?: string;
  beneficiaryReason?: string;
  beneficiaryPhone?: string;
  beneficiaryCountry?: string;
  isRecurring?: boolean;
  totalCycles?: number;
  targetCommunityId?: string | number;
  targetCommunityName?: string;
  isElderCreated?: boolean;
  // Schedule step
  startDate?: string | null; // ISO string (serialized from the Date picker)
  rotationMethod?: string;
  gracePeriodDays?: number; // parsed to a number when forwarded
  // Invite step
  invitedMembers?: string[];
  // Any other accumulated params pass through untyped.
  [key: string]: unknown;
};
