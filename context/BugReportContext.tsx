// ═══════════════════════════════════════════════════════════════════════════
// context/BugReportContext.tsx — current screen name for BugReportButton
// ═══════════════════════════════════════════════════════════════════════════
//
// Tiny store the NavigationContainer's onStateChange feeds into. The
// FAB reads `screenName` so a submitted bug report can record which
// screen the user was on. Decoupled from React Navigation so future
// consumers (deep-link handlers, error boundaries) can override it
// without dragging in the nav state hook tree.
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface BugReportContextValue {
  screenName: string;
  setScreenName: (name: string) => void;
}

const BugReportContext = createContext<BugReportContextValue>({
  screenName: "Unknown",
  setScreenName: () => {},
});

export function BugReportProvider({ children }: { children: React.ReactNode }) {
  const [screenName, setScreenNameState] = useState<string>("Unknown");

  const setScreenName = useCallback((name: string) => {
    setScreenNameState((prev) => (prev === name ? prev : name));
  }, []);

  const value = useMemo(
    () => ({ screenName, setScreenName }),
    [screenName, setScreenName],
  );

  return (
    <BugReportContext.Provider value={value}>
      {children}
    </BugReportContext.Provider>
  );
}

export function useBugReportScreen(): BugReportContextValue {
  return useContext(BugReportContext);
}
