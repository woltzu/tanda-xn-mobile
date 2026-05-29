// ══════════════════════════════════════════════════════════════════════════════
// hooks/useFormDraft.ts — generic auto-save form draft (AsyncStorage)
// ══════════════════════════════════════════════════════════════════════════════
//
// Persists a form's state to AsyncStorage under `draft_<draftKey>` and
// restores it on a later visit. Saving is debounced (500ms) so rapid edits
// don't thrash storage.
//
// Returns:
//   draft        — the loaded draft (or the most recently saved values), or null
//   hasDraft     — true once a draft has been loaded/saved
//   saveDraft    — debounced setter; call with the current form values
//   restoreDraft — returns the current draft (for repopulating fields)
//   clearDraft   — removes the stored draft (call on successful submit / discard)
//
// `defaultValues` is currently only used to infer the generic T; the hook
// does not seed storage with it.
//
// Pilot: wired into GoalCreateScreen only (Phase C). Generic by design so
// other forms can adopt it later.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useFormDraft = <T extends object>(
  draftKey: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultValues: T
) => {
  const [draft, setDraft] = useState<T | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const stored = await AsyncStorage.getItem(`draft_${draftKey}`);
        if (stored) {
          const parsed = JSON.parse(stored) as T;
          setDraft(parsed);
          setHasDraft(true);
        }
      } catch (e) {
        console.warn("Failed to load draft", e);
      }
    };
    loadDraft();
  }, [draftKey]);

  // Clean up any pending debounced save on unmount.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Save draft (debounced)
  const saveDraft = useCallback(
    (values: T) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(`draft_${draftKey}`, JSON.stringify(values));
          setDraft(values);
          setHasDraft(true);
        } catch (e) {
          console.warn("Failed to save draft", e);
        }
      }, 500);
    },
    [draftKey]
  );

  const restoreDraft = useCallback((): T | null => {
    return draft;
  }, [draft]);

  const clearDraft = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    try {
      await AsyncStorage.removeItem(`draft_${draftKey}`);
      setDraft(null);
      setHasDraft(false);
    } catch (e) {
      console.warn("Failed to clear draft", e);
    }
  }, [draftKey]);

  return { draft, hasDraft, saveDraft, restoreDraft, clearDraft };
};
