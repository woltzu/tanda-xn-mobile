// lib/deferredAction.ts — P0 of the KYC trigger review.
//
// Stores ONE "what was the user trying to do?" snapshot in AsyncStorage
// so we can resume after an interruption — the typical case is the KYC
// gate intercepting a money action (Send Money, Withdraw, Apply for
// advance) before any server call. After the user finishes the
// interrupting flow (KYC verification, in this version), the resume
// site reads the snapshot back and navigates the user to the exact
// screen + params they were on.
//
// One-slot, last-writer-wins. The product flow doesn't need a queue —
// only one "in-progress action" can be in flight at a time, so a single
// JSON cell keeps the API tiny and the resume logic obvious.
//
// TTL safety: every action carries an expiresAt timestamp. consume /
// get checks against the wall clock and treats expired entries as
// "not present" (and clears them). Default 24h — long enough for KYC
// (Persona review + admin queue), short enough that a stale "send $X
// to recipient Y" doesn't surprise the user weeks later.
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@tandaxn_deferred_action";

// Default TTL — 24 hours from the moment of writing.
export const DEFAULT_DEFERRED_TTL_MS = 24 * 60 * 60 * 1000;

export type DeferredAction = {
  // Route name as registered in the navigator. Free-form string here
  // because deepLinking already does the runtime validation.
  route: string;
  // Whatever the consuming screen needs to rehydrate its form. Must be
  // JSON-serializable — the writer is responsible for that. Schemas are
  // owned by each screen; this module is intentionally generic.
  params?: unknown;
  // Absolute epoch ms after which this action is considered stale and
  // will be cleared on read.
  expiresAt: number;
};

// Internal helper — `Date.now()` is forbidden in workflow contexts but
// `new Date()` in a plain client module is fine. Wrapped so future
// portability fixes have one place to land.
function now(): number {
  return new Date().getTime();
}

/**
 * Persist a deferred action. `expiresAt` is optional; when omitted we
 * stamp `now + DEFAULT_DEFERRED_TTL_MS`. Throws never — write failures
 * log to console and resolve so the calling submit handler isn't
 * blocked by a storage hiccup (worst case: no resume, but the user can
 * still continue manually).
 */
export async function setDeferredAction(
  action: Omit<DeferredAction, "expiresAt"> & { expiresAt?: number },
): Promise<void> {
  const record: DeferredAction = {
    route: action.route,
    params: action.params,
    expiresAt: action.expiresAt ?? now() + DEFAULT_DEFERRED_TTL_MS,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn(
      "[deferredAction] write failed:",
      (e as Error)?.message ?? "unknown",
    );
  }
}

/**
 * Read the current deferred action without clearing it. Returns null
 * when missing, malformed, or expired (and clears expired entries as
 * a side-effect so the next read is a fast miss).
 */
export async function getDeferredAction(): Promise<DeferredAction | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeferredAction;
    if (
      !parsed ||
      typeof parsed.route !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      // Malformed — drop it so we don't keep tripping over it.
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.expiresAt < now()) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn(
      "[deferredAction] read failed:",
      (e as Error)?.message ?? "unknown",
    );
    return null;
  }
}

/**
 * Read AND delete in one call. Use this from the resume site (KYCHub
 * after verification) so the same action can't replay twice.
 */
export async function consumeDeferredAction(): Promise<DeferredAction | null> {
  const action = await getDeferredAction();
  if (!action) return null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn(
      "[deferredAction] clear-after-consume failed:",
      (e as Error)?.message ?? "unknown",
    );
  }
  return action;
}

/**
 * Drop any stored action, regardless of expiry. Called by signOut so
 * a deferred action from a previous user can't leak into a new one.
 */
export async function clearDeferredAction(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn(
      "[deferredAction] clear failed:",
      (e as Error)?.message ?? "unknown",
    );
  }
}
