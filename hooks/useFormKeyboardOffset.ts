// useFormKeyboardOffset — compute KeyboardAvoidingView's iOS offset from the
// actual layout (safe-area top inset + measured chrome heights) instead of a
// hardcoded number. The hardcoded form gets the empty-band-above-keyboard
// bug whenever the assumed value doesn't match the device's real chrome.
//
// Returns 0 on Android, where KAV does not consult keyboardVerticalOffset.
// Requires <SafeAreaProvider /> somewhere up the tree (wired in App.tsx).

import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface FormKeyboardOffset {
  /** Pass to `<KeyboardAvoidingView keyboardVerticalOffset={offset} />`. */
  offset: number;
  /** Returns a stable `onLayout` handler for a chrome slot (e.g. 'header'). */
  measure: (key: string) => (e: LayoutChangeEvent) => void;
  /**
   * Drop a slot's measured height. Use in a useEffect when a conditionally
   * rendered chrome view (e.g. a loading banner) unmounts — otherwise its
   * last height lingers in state and over-inflates the offset.
   */
  clear: (key: string) => void;
}

export function useFormKeyboardOffset(): FormKeyboardOffset {
  const insets = useSafeAreaInsets();
  const [heights, setHeights] = useState<Record<string, number>>({});

  // Cache per-slot callbacks so attaching onLayout doesn't churn the prop on
  // every render (which would defeat React Native's layout-change debouncing).
  const callbacksRef = useRef<Record<string, (e: LayoutChangeEvent) => void>>({});

  const measure = useCallback((key: string) => {
    if (!callbacksRef.current[key]) {
      callbacksRef.current[key] = (e: LayoutChangeEvent) => {
        const h = e.nativeEvent.layout.height;
        setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
      };
    }
    return callbacksRef.current[key];
  }, []);

  const clear = useCallback((key: string) => {
    setHeights((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const offset = useMemo(() => {
    if (Platform.OS !== 'ios') return 0;
    let total = insets.top;
    for (const h of Object.values(heights)) total += h;
    return total;
  }, [insets.top, heights]);

  return { offset, measure, clear };
}
