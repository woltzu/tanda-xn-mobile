// =============================================================================
// useWalkthrough -- AsyncStorage-backed completion tracking for the
// first-time-user walkthroughs defined in config/walkthroughs.ts.
//
// Three operations:
//   isWalkthroughCompleted(id)   has the user already seen this one?
//   markWalkthroughCompleted(id) record that they finished or skipped
//   resetAllWalkthroughs()       wipe everything (logout + DEV reset)
//
// Plus a constant the screens own:
//   activeStep / setActiveStep   normal React state on the screen
//
// Version handling: the first call to isWalkthroughCompleted compares the
// stored version against WALKTHROUGH_VERSION from the config. A mismatch
// triggers a one-shot reset so a major copy revision re-prompts returning
// users automatically.
//
// All async; callers should `await` from inside a useEffect or event
// handler -- never call from a render path.
// =============================================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback } from "react";
import {
  WALKTHROUGH_VERSION,
  WALKTHROUGHS,
  type WalkthroughId,
} from "../config/walkthroughs";

const VERSION_KEY = "@walkthroughs:version";
const KEY_PREFIX = "@walkthroughs:completed:";

const storageKey = (id: WalkthroughId) => `${KEY_PREFIX}${id}`;

// Idempotent: ensures the stored version matches the current
// WALKTHROUGH_VERSION. If it doesn't, wipes every completion flag and
// stamps the new version. Cheap enough to call on every check.
async function reconcileVersion(): Promise<void> {
  const stored = await AsyncStorage.getItem(VERSION_KEY);
  const current = String(WALKTHROUGH_VERSION);

  if (stored === current) return;

  // Wipe every walkthrough's completion flag, then stamp the new version.
  // We delete keys explicitly rather than clearing all of AsyncStorage so
  // we don't nuke unrelated state (auth tokens, biometrics prefs, etc.).
  const ids = Object.keys(WALKTHROUGHS) as WalkthroughId[];
  await AsyncStorage.multiRemove(ids.map(storageKey));
  await AsyncStorage.setItem(VERSION_KEY, current);
}

export function useWalkthrough() {
  const isWalkthroughCompleted = useCallback(
    async (id: WalkthroughId): Promise<boolean> => {
      await reconcileVersion();
      const v = await AsyncStorage.getItem(storageKey(id));
      return v === "true";
    },
    [],
  );

  const markWalkthroughCompleted = useCallback(
    async (id: WalkthroughId): Promise<void> => {
      await reconcileVersion();
      await AsyncStorage.setItem(storageKey(id), "true");
    },
    [],
  );

  const resetAllWalkthroughs = useCallback(async (): Promise<void> => {
    const ids = Object.keys(WALKTHROUGHS) as WalkthroughId[];
    await AsyncStorage.multiRemove(ids.map(storageKey));
    // Re-stamp the current version so the very next read doesn't see a
    // missing version and trigger another (redundant) wipe.
    await AsyncStorage.setItem(VERSION_KEY, String(WALKTHROUGH_VERSION));
  }, []);

  return {
    isWalkthroughCompleted,
    markWalkthroughCompleted,
    resetAllWalkthroughs,
  };
}
