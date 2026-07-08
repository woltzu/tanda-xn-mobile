// utils/scrollDiagnostics.ts
//
// Runtime scroll-container diagnostics. Not shipped to production —
// this file is loaded but the loggers gate themselves on the
// SCROLL_DEBUG_ENABLED flag below, which stays off in normal builds.
//
// Purpose: the #1 cause of "scrolling feels dead / needs an edge swipe"
// on RN is a scroll container mounted inside another scroll container
// with unspecified gesture priorities (VirtualizedList's warning about
// nested ScrollView/FlatList). This module makes those mounts visible.
//
// What it exposes:
//   ScrollDiagnosticProvider — wrap the app root once.
//   useScrollDiagnostic(name) — hook every scroll container calls at
//       mount. Logs the parent chain and flags nesting depth ≥ 2 as
//       a WARN so it's easy to grep.
//   DiagnosticScrollView / DiagnosticFlatList — drop-in wrappers over
//       React Native's ScrollView / FlatList that call the hook for
//       you. Screens replacing their raw components with these get
//       the full mount log without threading anything by hand.
//   logScrollTouch(name, event) / logScrollEvent(name, event) —
//       throttled console.log helpers so screens can trace whether a
//       gesture is reaching the scroll surface at all.
//
// Flip SCROLL_DEBUG_ENABLED to false to silence all output. Keep this
// as a compile-time constant so Metro dead-strips the console calls
// in release builds.

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  FlatList,
  FlatListProps,
  ScrollView,
  ScrollViewProps,
} from "react-native";

// [debug scroll] Master switch. Set to false to remove all output
// without touching any callsite.
export const SCROLL_DEBUG_ENABLED = true;

type Ctx = {
  depth: number;
  chain: string[]; // parent scroll-container names, oldest first
};

const ScrollDiagnosticContext = createContext<Ctx>({ depth: 0, chain: [] });

export function ScrollDiagnosticProvider({ children }: { children: ReactNode }) {
  const value = useMemo<Ctx>(() => ({ depth: 0, chain: [] }), []);
  return (
    <ScrollDiagnosticContext.Provider value={value}>
      {children}
    </ScrollDiagnosticContext.Provider>
  );
}

/**
 * Every scroll container calls this on mount. Logs a single line
 * describing where it sits in the ancestor chain; upgrades to a WARN
 * when depth is ≥ 2 so nested-scroll offenders are easy to grep.
 */
export function useScrollDiagnostic(name: string) {
  const parent = useContext(ScrollDiagnosticContext);
  const child = useMemo<Ctx>(
    () => ({
      depth: parent.depth + 1,
      chain: [...parent.chain, name],
    }),
    [name, parent],
  );

  useEffect(() => {
    if (!SCROLL_DEBUG_ENABLED) return;
    const line = `[scroll] mount ${name} depth=${child.depth} chain=[${child.chain.join(
      " > ",
    )}]`;
    if (child.depth >= 2) {
      console.warn(`${line}  ⚠ NESTED SCROLL — likely the source of dead scroll`);
    } else {
      console.log(line);
    }
    return () => {
      if (SCROLL_DEBUG_ENABLED) {
        console.log(`[scroll] unmount ${name} depth=${child.depth}`);
      }
    };
    // Static chain per mount — no reason to re-run on ref changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return child;
}

/**
 * Wraps ScrollView so children see the nested scroll depth via
 * ScrollDiagnosticContext. Otherwise identical to RN's ScrollView.
 */
export const DiagnosticScrollView = React.forwardRef<
  ScrollView,
  ScrollViewProps & { diagName: string }
>(function DiagnosticScrollView({ diagName, children, ...rest }, ref) {
  const value = useScrollDiagnostic(diagName);
  return (
    <ScrollDiagnosticContext.Provider value={value}>
      <ScrollView ref={ref} {...rest}>
        {children}
      </ScrollView>
    </ScrollDiagnosticContext.Provider>
  );
});

/**
 * FlatList counterpart to DiagnosticScrollView. FlatList already
 * virtualizes so nesting one inside a plain ScrollView is what most
 * "why doesn't this scroll" bugs boil down to.
 */
export function DiagnosticFlatList<ItemT>(
  props: FlatListProps<ItemT> & { diagName: string },
) {
  const { diagName, ...rest } = props;
  const value = useScrollDiagnostic(diagName);
  return (
    <ScrollDiagnosticContext.Provider value={value}>
      <FlatList {...rest} />
    </ScrollDiagnosticContext.Provider>
  );
}

// ── Touch + scroll event traces ──────────────────────────────────────────
//
// Both helpers throttle to one log per THROTTLE_MS window per name so a
// live scroll doesn't flood the console. The screen name distinguishes
// per-surface throttling — HomeScreen's outer ScrollView and its inner
// FlatList each get their own bucket.

const THROTTLE_MS = 250;
const lastLogAt = new Map<string, number>();

function throttled(name: string): boolean {
  const now = Date.now();
  const prev = lastLogAt.get(name) ?? 0;
  if (now - prev < THROTTLE_MS) return false;
  lastLogAt.set(name, now);
  return true;
}

export function logScrollTouch(name: string, phase: "start" | "move" | "end") {
  if (!SCROLL_DEBUG_ENABLED) return;
  if (!throttled(`${name}:${phase}`)) return;
  console.log(`[scroll] ${name} touch=${phase}`);
}

export function logScrollEvent(name: string, contentOffsetY?: number) {
  if (!SCROLL_DEBUG_ENABLED) return;
  if (!throttled(`${name}:scroll`)) return;
  console.log(
    `[scroll] ${name} onScroll y=${
      contentOffsetY != null ? Math.round(contentOffsetY) : "?"
    }`,
  );
}
